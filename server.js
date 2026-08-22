const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

// Asegurar archivo de datos
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([]));
}

// Redirigir la raíz al administrador
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Endpoint para guardar/actualizar eventos
app.post('/api/eventos', (req, res) => {
    try {
        const nuevoEvento = req.body;
        let eventos = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

        const index = eventos.findIndex(e => e.id === nuevoEvento.id);
        if (index !== -1) {
            eventos[index] = nuevoEvento;
        } else {
            eventos.push(nuevoEvento);
        }

        fs.writeFileSync(DATA_FILE, JSON.stringify(eventos, null, 2));
        res.json({ success: true, id: nuevoEvento.id });
    } catch (err) {
        res.status(500).json({ error: 'Error al guardar el evento' });
    }
});

// Endpoint para obtener evento por ID
app.get('/api/eventos/:id', (req, res) => {
    try {
        const eventos = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        const evento = eventos.find(e => e.id === req.params.id);
        if (!evento) return res.status(404).json({ error: 'Evento no encontrado' });
        res.json(evento);
    } catch (err) {
        res.status(500).json({ error: 'Error al leer los datos' });
    }
});

app.listen(PORT, () => console.log(`Servidor iniciado en puerto ${PORT}`));