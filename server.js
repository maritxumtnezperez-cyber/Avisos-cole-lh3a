import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Única contraseña de la App
const APP_PASSWORD = (process.env.APP_PASSWORD || "78875879").trim();

app.use(express.json({ limit: '10mb' }));

// Ruta para servir la imagen del logo
app.get(['/Logo.png', '/logo.png'], (req, res) => {
  const rootLogo = path.join(__dirname, 'Logo.png');
  const rootLogoLower = path.join(__dirname, 'logo.png');
  const publicLogo = path.join(__dirname, 'public', 'Logo.png');
  const publicLogoLower = path.join(__dirname, 'public', 'logo.png');

  if (fs.existsSync(rootLogo)) return res.sendFile(rootLogo);
  if (fs.existsSync(rootLogoLower)) return res.sendFile(rootLogoLower);
  if (fs.existsSync(publicLogo)) return res.sendFile(publicLogo);
  if (fs.existsSync(publicLogoLower)) return res.sendFile(publicLogoLower);
  
  res.status(404).send('Logo no encontrado');
});

// Middleware para verificar contraseña de API
function checkAppPassword(req, res, next) {
  const pass = req.headers['x-app-password'];
  if (pass && pass.trim() === APP_PASSWORD) {
    return next();
  }
  return res.status(401).json({ error: "Acceso no autorizado" });
}

// Endpoint de Login
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password && password.trim() === APP_PASSWORD) {
    res.status(200).json({ ok: true });
  } else {
    res.status(401).json({ error: "Contraseña incorrecta" });
  }
});

// Archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

const DATA_FILE = path.join(__dirname, 'data', 'notices.json');

if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}

function getNotices() {
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

function saveNotices(notices) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(notices, null, 2));
}

// Rutas de API protegidas
app.get('/api/notices', checkAppPassword, (req, res) => {
  res.json(getNotices());
});

app.post('/api/notices', checkAppPassword, (req, res) => {
  const notices = getNotices();
  const newNotice = {
    id: Date.now().toString(),
    title: req.body.title,
    category: req.body.category || "General",
    description: req.body.description || "",
    date: req.body.date || null,
    time: req.body.time || null,
    imageUrl: req.body.imageUrl || null
  };
  notices.push(newNotice);
  saveNotices(notices);
  res.json({ ok: true, notice: newNotice });
});

app.put('/api/notices/:id', checkAppPassword, (req, res) => {
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

app.delete('/api/notices/:id', checkAppPassword, (req, res) => {
  let notices = getNotices();
  notices = notices.filter(n => n.id !== req.params.id);
  saveNotices(notices);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Servidor iniciado en el puerto ${PORT}`);
});
