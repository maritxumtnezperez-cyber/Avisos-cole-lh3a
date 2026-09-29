import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de contraseñas
const APP_PASSWORD = process.env.APP_PASSWORD || "78875879";      // Contraseña para acceder a la app
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "LH3Aadmin";  // Contraseña para publicar/editar/borrar

app.use(express.json({ limit: '10mb' }));

// Servir archivos estáticos de la carpeta public (incluye login.html)
app.use(express.static(path.join(__dirname, 'public')));

// Middleware para verificar la contraseña de la App en la API
function checkAppPassword(req, res, next) {
  const pass = req.headers['x-app-password'];
  if (pass === APP_PASSWORD) {
    return next();
  }
  return res.status(401).json({ error: "Acceso no autorizado" });
}

// Middleware para verificar la contraseña de Administrador
function checkAdminPassword(req, res, next) {
  const pass = req.headers['x-admin-password'];
  if (pass === ADMIN_PASSWORD) {
    return next();
  }
  return res.status(401).json({ error: "Contraseña de administración incorrecta" });
}

const DATA_FILE = path.join(__dirname, 'data', 'notices.json');

// Crear carpeta data si no existe
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}

// Leer avisos
function getNotices() {
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

// Guardar avisos
function saveNotices(notices) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(notices, null, 2));
}

// Endpoint para verificar contraseña de entrada
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === APP_PASSWORD) {
    res.json({ ok: true });
  } else {
    res.status(401).json({ error: "Contraseña incorrecta" });
  }
});

// Rutas de la API protegidas con contraseña de la App
app.get('/api/notices', checkAppPassword, (req, res) => {
  res.json(getNotices());
});

app.post('/api/notices', checkAppPassword, checkAdminPassword, (req, res) => {
  const notices = getNotices();
  const newNotice = {
    id: Date.now().toString(),
    title: req.body.title,
    description: req.body.description || "",
    date: req.body.date || null,
    time: req.body.time || null,
    imageUrl: req.body.imageUrl || null
  };
  notices.push(newNotice);
  saveNotices(notices);
  res.json({ ok: true, notice: newNotice });
});

app.put('/api/notices/:id', checkAppPassword, checkAdminPassword, (req, res) => {
  let notices = getNotices();
  const idx = notices.findIndex(n => n.id === req.params.id);
  if (idx !== -1) {
    notices[idx] = { ...notices[idx], ...req.body };
    saveNotices(notices);
    res.json({ ok: true });
  } else {
    res.status(404).json({ error: "Evento no encontrado" });
  }
});

app.delete('/api/notices/:id', checkAppPassword, checkAdminPassword, (req, res) => {
  let notices = getNotices();
  notices = notices.filter(n => n.id !== req.params.id);
  saveNotices(notices);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Servidor iniciado en el puerto ${PORT}`);
});
