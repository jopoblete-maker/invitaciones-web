const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

// Middleware para parsear contenido JSON
app.use(express.json());

// Servir archivos estáticos (CSS, JS, imágenes, etc.) desde la raíz
app.use(express.static(__dirname));

// Función auxiliar para leer data.json de manera segura
function readData() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            fs.writeFileSync(DATA_FILE, JSON.stringify({ invitaciones: [] }, null, 2));
        }
        const content = fs.readFileSync(DATA_FILE, 'utf-8');
        return JSON.parse(content);
    } catch (err) {
        console.error('Error leyendo data.json:', err);
        return { invitaciones: [] };
    }
}

// Función auxiliar para guardar en data.json
function saveData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
        console.error('Error guardando en data.json:', err);
    }
}

// RUTA PRINCIPAL (/): Carga directamente el panel de administración
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Ruta explícita por si ingresan escribiendo /admin.html
app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// API: Obtener todas las invitaciones
app.get('/api/invitaciones', (req, res) => {
    const data = readData();
    res.json(data.invitaciones);
});

// API: Obtener una invitación por ID
app.get('/api/invitaciones/:id', (req, res) => {
    const { id } = req.params;
    const data = readData();
    const item = data.invitaciones.find((i) => i.id === id);

    if (!item) {
        return res.status(404).json({ ok: false, message: 'Invitación no encontrada' });
    }

    res.json({ ok: true, invitación: item });
});

// API: Crear o actualizar una invitación
app.post('/api/invitaciones', (req, res) => {
    const data = readData();
    const newInv = req.body;

    if (!newInv.id) {
        return res.status(400).json({ ok: false, message: 'Falta el ID de la invitación' });
    }

    const index = data.invitaciones.findIndex((i) => i.id === newInv.id);
    if (index !== -1) {
        data.invitaciones[index] = newInv;
    } else {
        data.invitaciones.push(newInv);
    }

    saveData(data);

    const host = req.get('host');
    const protocol = req.protocol;
    const fullUrl = `${protocol}://${host}/invitacion.html?id=${newInv.id}`;

    res.json({
        ok: true,
        id: newInv.id,
        url: fullUrl
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor activo en el puerto ${PORT}`);
});