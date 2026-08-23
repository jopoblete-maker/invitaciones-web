const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Configura tu clave de acceso al panel
const ADMIN_PASSWORD = 'TU_CLAVE_SECRETA_AQUI'; // <--- Cambia esto por la clave que quieras

const SUPABASE_URL = 'https://jqewkmebhdyrjeawdmon.supabase.co';
const SUPABASE_KEY = 'TU_CLAVE_ANON_REAL_DE_SUPABASE'; // <--- Tu clave anon que pegaste antes

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Guardar o actualizar evento (Con validaciones de seguridad)
app.post('/api/eventos', async (req, res) => {
    try {
        const { password, ...evento } = req.body;

        // 1. Validar la clave secreta
        if (password !== ADMIN_PASSWORD) {
            return res.status(401).json({ error: 'Clave de acceso incorrecta.' });
        }

        if (!evento.id) {
            return res.status(400).json({ error: 'Debes definir un ID para la invitación.' });
        }

        // 2. Verificar si el ID ya existe en Supabase
        const { data: existente } = await supabase
            .from('eventos')
            .select('id')
            .eq('id', evento.id)
            .single();

        // Si ya existe y no envías una bandera de confirmación, bloquea la acción
        if (existente && !req.body.overwrite) {
            return res.status(409).json({
                error: `El ID "${evento.id}" ya existe. Elige otro ID para no sobrescribir la invitación de otro cliente.`
            });
        }

        // 3. Guardar en Supabase
        const { error } = await supabase
            .from('eventos')
            .upsert({ id: evento.id, datos: evento });

        if (error) throw error;
        res.json({ success: true, id: evento.id });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al guardar en la base de datos.' });
    }
});

// Obtener evento
app.get('/api/eventos/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('eventos')
            .select('datos')
            .eq('id', req.params.id)
            .single();

        if (error || !data) return res.status(404).json({ error: 'Evento no encontrado' });
        res.json(data.datos);
    } catch (err) {
        res.status(500).json({ error: 'Error al leer la base de datos' });
    }
});

app.listen(PORT, () => console.log(`Servidor activo en puerto ${PORT}`));