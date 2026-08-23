const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Reemplaza con tus datos de Supabase que copiaste anteriormente
const SUPABASE_URL = 'https://jqewkmebhdyrjeawdmon.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxZXdrbWViaGR5cmplYXdkbW9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0NDc2OTMsImV4cCI6MjEwMzAyMzY5M30.bwBlacPpsOQSMKc3JBv9loS2pL_chyZr0wnKmK6EWqw';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Aumentamos el limite para soportar audios e imagenes en Base64
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Guardar o actualizar evento
app.post('/api/eventos', async (req, res) => {
    try {
        const evento = req.body;
        const { data, error } = await supabase
            .from('eventos')
            .upsert({ id: evento.id, datos: evento });

        if (error) {
            console.error('Error Supabase:', error);
            throw error;
        }
        res.json({ success: true, id: evento.id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al guardar en la base de datos' });
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

app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));