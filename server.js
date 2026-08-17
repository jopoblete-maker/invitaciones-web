const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

const publicDir = __dirname;
const dataDir = path.join(__dirname, 'data');

if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

app.use(express.json({ limit: '1mb' }));
app.use(express.static(publicDir, {
    index: 'index.html',
    extensions: ['html']
}));

function slugify(value) {
    return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}

function buildInvitationId(nombre, fechaEvento) {
    const baseName = slugify(nombre || 'invitacion');
    const fecha = new Date(fechaEvento || Date.now());
    const day = String(fecha.getDate()).padStart(2, '0');
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const year = fecha.getFullYear();

    return `${baseName}-${day}-${month}-${year}`;
}

app.post('/api/invitaciones', (req, res) => {
    const payload = req.body;

    if (!payload || typeof payload !== 'object') {
        return res.status(400).json({ error: 'Se requiere un JSON válido del evento.' });
    }

    const nombre = payload.nombre || 'invitacion';
    const fechaEvento = payload.fechaEvento || new Date().toISOString();
    const id = buildInvitationId(nombre, fechaEvento);
    const filePath = path.join(dataDir, `${id}.json`);

    const cleanedPayload = {
        ...payload,
        nombre,
        fechaEvento,
        id
    };

    fs.writeFile(filePath, JSON.stringify(cleanedPayload, null, 2), 'utf8', (error) => {
        if (error) {
            console.error('Error guardando invitación:', error);
            return res.status(500).json({ error: 'No se pudo guardar la invitación.' });
        }

        const invitationUrl = `/invitacion?id=${encodeURIComponent(id)}`;
        return res.status(201).json({
            ok: true,
            id,
            url: invitationUrl,
            fullUrl: `${req.protocol}://${req.get('host')}${invitationUrl}`
        });
    });
});

app.get('/invitacion', (req, res) => {
    const id = req.query.id;

    if (!id) {
        return res.sendFile(path.join(publicDir, 'index.html'));
    }

    const filePath = path.join(dataDir, `${id}.json`);

    if (!fs.existsSync(filePath)) {
        return res.status(404).send('Invitación no encontrada');
    }

    return res.sendFile(path.join(publicDir, 'index.html'));
});

app.get('/api/invitaciones/:id', (req, res) => {
    const { id } = req.params;
    const filePath = path.join(dataDir, `${id}.json`);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Invitación no encontrada.' });
    }

    const file = fs.readFileSync(filePath, 'utf8');
    return res.json(JSON.parse(file));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor iniciado en http://0.0.0.0:${PORT}`);
});
