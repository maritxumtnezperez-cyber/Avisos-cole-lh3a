import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '1234';

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const DATA_FILE = path.join(__dirname, 'notices.json');

function readJSON(file) {
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return [];
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function checkAdmin(req, res, next) {
  const pass = req.headers['x-admin-password'];
  if (pass === ADMIN_PASSWORD) {
    next();
  } else {
    res.status(401).json({ error: 'Contraseña incorrecta' });
  }
}

app.get('/api/notices', (req, res) => {
  const notices = readJSON(DATA_FILE);
  res.json(notices);
});

app.post('/api/notices', checkAdmin, (req, res) => {
  const notices = readJSON(DATA_FILE);
  const newNotice = {
    id: Date.now().toString(),
    created_at: new Date().toISOString(),
    ...req.body
  };
  notices.push(newNotice);
  writeJSON(DATA_FILE, notices);
  res.status(201).json(newNotice);
});

app.put('/api/notices/:id', checkAdmin, (req, res) => {
  const notices = readJSON(DATA_FILE);
  const index = notices.findIndex(n => n.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Aviso no encontrado' });

  notices[index] = { ...notices[index], ...req.body };
  writeJSON(DATA_FILE, notices);
  res.json(notices[index]);
});

app.delete('/api/notices/:id', checkAdmin, (req, res) => {
  let notices = readJSON(DATA_FILE);
  notices = notices.filter(n => n.id !== req.params.id);
  writeJSON(DATA_FILE, notices);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Servidor activo en el puerto ${PORT}`);
});
