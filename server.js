const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Configura la clave que le darás a tus clientes cuando te paguen
const ADMIN_PASSWORD = 'invitacion2026'; // <--- Cambia esto por la contraseña que quieras usar

// Configuración de Supabase
const SUPABASE_URL = 'https://jqewkmebhdyrjeawdmon.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxZXdrbWViaGR5cmplYXdkbW9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0NDc2OTMsImV4cCI6MjEwMzAyMzY5M30.bwBlacPpsOQSMKc3JBv9loS2pL_chyZr0wnKmK6EWqw'; // <--- Reemplaza con tu clave anon de Supabase

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const TEMAS_VALIDOS = ['frozen', 'pesca', 'elegante', 'fiesta', 'minimalista'];

app.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
});

// Aumentamos el límite para permitir subir imágenes locales (Base64)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(__dirname));

// Ruta principal para abrir el panel de administración
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Endpoint para guardar o actualizar la invitación
app.post('/api/eventos', async (req, res) => {
    try {
        const { password, ...evento } = req.body;

        // 1. Validar clave de acceso
        if (password !== ADMIN_PASSWORD) {
            return res.status(401).json({ error: 'Clave de acceso incorrecta. Verifica el código entregado.' });
        }

        if (!evento.id) {
            return res.status(400).json({ error: 'Debes ingresar un ID para el evento.' });
        }

        evento.tema = TEMAS_VALIDOS.includes(evento.tema) ? evento.tema : 'fiesta';

        // 2. Verificar si el ID ya existe en Supabase
        const { data: existente } = await supabase
            .from('eventos')
            .select('id')
            .eq('id', evento.id)
            .maybeSingle();

        // Si el ID ya existe y no se autorizó sobrescribir
        if (existente && !req.body.overwrite) {
            return res.status(409).json({
                error: `El ID "${evento.id}" ya está registrado. Por favor, elige otro ID diferente.`
            });
        }

        // 3. Guardar evento en Supabase
        const { error } = await supabase
            .from('eventos')
            .upsert({ id: evento.id, datos: evento });

        if (error) throw error;

        res.json({ success: true, id: evento.id });

    } catch (err) {
        console.error('Error al guardar:', err);
        res.status(500).json({ error: 'Ocurrió un error en el servidor al guardar los datos.' });
    }
});

// Endpoint para leer la invitación desde el frontend (invitacion.html)
app.get('/api/eventos/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('eventos')
            .select('datos')
            .eq('id', req.params.id)
            .single();

        if (error || !data) {
            return res.status(404).json({ error: 'Invitación no encontrada' });
        }

        res.json(data.datos);
    } catch (err) {
        console.error('Error al leer:', err);
        res.status(500).json({ error: 'Error al consultar la base de datos' });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor iniciado correctamente en el puerto ${PORT}`);
});
