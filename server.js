const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { validateEventForPersistence } = require('./js/core/event-validator');
const ThemeRegistry = require('./js/core/theme-registry');
const { createPublicEventResolver } = require('./js/core/public-event-resolver');
const { createEventVersionRpcAdapter } = require('./js/core/event-version-rpc-adapter');
const { createEventVersionEditorialService } = require('./js/core/event-version-editorial-service');
const { createEventVersionReadRepository } = require('./js/core/event-version-read-repository-supabase');
const { createEventVersionEditorialHttp } = require('./js/core/event-version-editorial-http');
const { createAdminOriginPolicy } = require('./js/core/admin-origin-policy');
const { signPreviewToken, verifyPreviewToken, DEFAULT_TTL_SECONDS } = require('./js/core/private-preview-token');

const app = express();
const PORT = process.env.PORT || 3000;

const REQUIRED_ENV_VARS = ['ADMIN_PASSWORD', 'SUPABASE_URL', 'SUPABASE_KEY'];
const missingEnvVars = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);

if (missingEnvVars.length) {
    throw new Error(`Faltan variables de entorno requeridas: ${missingEnvVars.join(', ')}`);
}

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const adminOriginPolicy = createAdminOriginPolicy(process.env.ADMIN_ALLOWED_ORIGINS);
const PREVIEW_SIGNING_KEY = process.env.PREVIEW_SIGNING_KEY || '';
const PREVIEW_TTL_SECONDS = Number(process.env.PREVIEW_TTL_SECONDS) || DEFAULT_TTL_SECONDS;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const SUPABASE_TIMEOUT_MS = 15000;
const MAX_EVENT_PAYLOAD_BYTES = 12 * 1024 * 1024;
const ASSET_CACHE_MAX_AGE_MS = 60 * 60 * 1000;
const TEMAS_VALIDOS = ThemeRegistry.listThemes().map((theme) => theme.slug);
const EVENT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*-?$/;

app.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
});

// Aumentamos el límite para permitir subir imágenes locales (Base64)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use((err, req, res, next) => {
    if (!err) return next();

    const status = err.type === 'entity.too.large' || err.status === 413
        ? 413
        : err instanceof SyntaxError || err.status === 400
            ? 400
            : err.status >= 400 && err.status < 600
                ? err.status
                : 500;

    console.error('Error al procesar la solicitud:', err);
    res.status(status).json({
        error: err.message || 'Error al procesar la solicitud.'
    });
});

app.use('/assets', express.static(path.join(__dirname, 'assets'), {
    maxAge: ASSET_CACHE_MAX_AGE_MS
}));
app.use(express.static(__dirname));

// Ruta principal para abrir el panel de administración
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Endpoint para guardar o actualizar la invitación
async function guardarEvento(req, res) {
    try {
        const { password, overwrite, ...evento } = req.body;

        // 1. Validar clave de acceso
        if (password !== ADMIN_PASSWORD) {
            return res.status(401).json({ error: 'Clave de acceso incorrecta. Verifica el código entregado.' });
        }

        if (!evento.id) {
            return res.status(400).json({ error: 'Debes ingresar un ID para el evento.' });
        }

        if (!EVENT_ID_PATTERN.test(evento.id)) {
            return res.status(400).json({ error: 'El ID del evento solo puede contener minusculas, numeros y guiones.' });
        }

        const payloadBytes = Buffer.byteLength(JSON.stringify(evento), 'utf8');
        if (payloadBytes > MAX_EVENT_PAYLOAD_BYTES) {
            return res.status(413).json({
                error: 'Los archivos multimedia superan el peso recomendado. Comprime las imágenes o utiliza URLs externas para archivos pesados.'
            });
        }

        const isNewSchema = Object.prototype.hasOwnProperty.call(evento, 'schema_version')
            || Object.prototype.hasOwnProperty.call(evento, 'sections');
        if (isNewSchema) {
            const validation = validateEventForPersistence(evento);
            if (!validation.valid) {
                return res.status(400).json({
                    error: 'El evento new-schema no es válido.',
                    validationErrors: validation.errors
                });
            }
        }

        if (evento.schema_version !== 2) {
            evento.tema = TEMAS_VALIDOS.includes(evento.tema) ? evento.tema : 'fiesta';
        }

        // 2. Verificar si el ID ya existe en Supabase
        const { data: existente } = await withSupabaseTimeout(supabase
            .from('eventos')
            .select('id')
            .eq('id', evento.id)
            .maybeSingle());

        // Si el ID ya existe y no se autorizó sobrescribir
        if (existente && !overwrite) {
            return res.status(409).json({
                error: `El ID "${evento.id}" ya está registrado. Por favor, elige otro ID diferente.`
            });
        }

        // 3. Guardar evento en Supabase
        const { error } = await withSupabaseTimeout(supabase
            .from('eventos')
            .upsert({ id: evento.id, datos: evento }));

        if (error) throw error;

        res.json({ success: true, id: evento.id });

    } catch (err) {
        console.error('Error al guardar:', err);
        const isTimeout = err.code === 'SUPABASE_TIMEOUT' || /statement timeout|timeout/i.test(err.message || '');
        const status = err.status === 413 || err.code === 'PAYLOAD_TOO_LARGE'
            ? 413
            : isTimeout
                ? 504
                : err.status >= 400 && err.status < 500
                    ? err.status
                    : 500;
        res.status(status).json({
            error: isTimeout
                ? 'Supabase tardó demasiado en guardar la invitación. Reduce el peso de las imágenes o utiliza URLs externas para archivos multimedia pesados.'
                : err.message || 'Ocurrió un error interno al guardar los datos.'
        });
    }
}

function withSupabaseTimeout(query, timeoutMs = SUPABASE_TIMEOUT_MS) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
            const error = new Error('La consulta a Supabase superó el tiempo de espera.');
            error.code = 'SUPABASE_TIMEOUT';
            reject(error);
        }, timeoutMs);
    });
    return Promise.race([query, timeout]).finally(() => clearTimeout(timer));
}

app.post('/api/eventos', guardarEvento);
app.put('/api/eventos', guardarEvento);

const eventVersionRpcAdapter = createEventVersionRpcAdapter({
    rpc(name, parameters) {
        return withSupabaseTimeout(supabase.rpc(name, parameters));
    }
});
const eventVersionEditorialService = createEventVersionEditorialService(eventVersionRpcAdapter);
const eventVersionReadRepository = createEventVersionReadRepository(supabase, {
    execute: withSupabaseTimeout,
    cursorSecret: PREVIEW_SIGNING_KEY
});
const eventVersionEditorialHttp = createEventVersionEditorialHttp({
    service: eventVersionEditorialService,
    readRepository: eventVersionReadRepository,
    adminPassword: ADMIN_PASSWORD,
    originPolicy: adminOriginPolicy,
    previewTtlSeconds: PREVIEW_TTL_SECONDS,
    issuePreviewToken(options) {
        if (!PREVIEW_SIGNING_KEY) {
            const error = new Error('Preview signing key is not configured.');
            error.code = 'PREVIEW_NOT_CONFIGURED';
            throw error;
        }
        const token = signPreviewToken({ ...options, secret: PREVIEW_SIGNING_KEY });
        const payload = verifyPreviewToken(token, { secret: PREVIEW_SIGNING_KEY }).payload;
        return { token, expiresAt: new Date(payload.expiresAt * 1000).toISOString() };
    }
});

app.get('/api/admin/eventos', eventVersionEditorialHttp.listEvents);
app.get('/api/admin/eventos/:eventId', eventVersionEditorialHttp.getEditorialState);
app.post('/api/admin/eventos', eventVersionEditorialHttp.createEvent);
app.post('/api/admin/eventos/:eventId/versions', eventVersionEditorialHttp.createVersion);
app.get('/api/admin/eventos/:eventId/versions/:versionId', eventVersionEditorialHttp.getVersion);
app.post(
    '/api/admin/eventos/:eventId/versions/:versionId/workflow',
    eventVersionEditorialHttp.transitionWorkflow
);
app.post(
    '/api/admin/eventos/:eventId/versions/:versionId/publish',
    eventVersionEditorialHttp.publishVersion
);
app.post('/api/admin/eventos/:eventId/rollback', eventVersionEditorialHttp.rollbackVersion);
app.post(
    '/api/admin/eventos/:eventId/versions/:versionId/preview',
    eventVersionEditorialHttp.requestPreview
);

app.get('/api/preview', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    const verification = verifyPreviewToken(req.query?.token, { secret: PREVIEW_SIGNING_KEY });
    if (!verification.ok) {
        return res.status(verification.code === 'TOKEN_EXPIRED' ? 410 : 401).json({
            error: { code: verification.code, message: 'Private preview is not available.' }
        });
    }
    try {
        const { eventId, versionId } = verification.payload;
        const state = await eventVersionReadRepository.getEditorialState(eventId);
        if (state.eventStatus === 'archived') {
            return res.status(403).json({ error: { code: 'EVENT_ARCHIVED', message: 'Private preview is not available.' } });
        }
        const version = await eventVersionReadRepository.getVersion(eventId, versionId);
        if (!state.versions.some((item) => item.versionId === versionId)) {
            return res.status(403).json({ error: { code: 'VERSION_NOT_AUTHORIZED', message: 'Private preview is not available.' } });
        }
        return res.status(200).json(version.content);
    } catch (error) {
        if (error.code === 'EVENT_NOT_FOUND' || error.code === 'VERSION_NOT_FOUND' || error.code === 'VERSION_EVENT_MISMATCH') {
            return res.status(404).json({ error: { code: 'PREVIEW_NOT_FOUND', message: 'Private preview is not available.' } });
        }
        console.error('Private preview read failed:', { code: error.code || 'PREVIEW_READ_FAILED' });
        return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Private preview is not available.' } });
    }
});

const publicEventResolver = createPublicEventResolver({
    async getEvent(id) {
        const { data, error } = await withSupabaseTimeout(supabase
            .from('eventos')
            .select('id, datos, published_version_id, current_working_version_id, event_status')
            .eq('id', id)
            .maybeSingle());
        if (error) throw error;
        return data;
    },
    async getVersion(id) {
        const { data, error } = await withSupabaseTimeout(supabase
            .from('event_versions')
            .select('id, event_id, content')
            .eq('id', id)
            .maybeSingle());
        if (error) throw error;
        return data;
    }
}, {
    onFallback({ eventId, reason, publishedVersionId }) {
        console.warn('Public event legacy fallback:', {
            eventId,
            reason,
            publishedVersionId
        });
    }
});

// Endpoint para leer la invitación desde el frontend (invitacion.html)
app.get('/api/eventos/:id', async (req, res) => {
    try {
        const event = await publicEventResolver.resolvePublicEvent(req.params.id);
        res.json(event);
    } catch (err) {
        if (err.code === 'PUBLIC_EVENT_NOT_FOUND') {
            return res.status(404).json({ error: 'Invitación no encontrada' });
        }
        if (err.code === 'PUBLIC_EVENT_INVALID_CONTENT') {
            console.error('Contenido público de invitación no disponible:', {
                eventId: req.params.id,
                code: err.code
            });
            return res.status(500).json({ error: 'Invitación no disponible' });
        }
        console.error('Error al leer invitación:', {
            eventId: req.params.id,
            code: err.code || 'PUBLIC_EVENT_READ_FAILED'
        });
        return res.status(500).json({ error: 'Error al consultar la base de datos' });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor iniciado correctamente en el puerto ${PORT}`);
});
