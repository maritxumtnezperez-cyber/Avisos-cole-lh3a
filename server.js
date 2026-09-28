import express from 'express';
import fs from 'fs';
import path from 'path';
import webpush from 'web-push';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '1234';

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@ejemplo.com';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const DATA_FILE = path.join(__dirname, 'notices.json');
const SUBS_FILE = path.join(__dirname, 'subscriptions.json');

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

// Función para verificar y lanzar las notificaciones automáticas
function checkAndSendReminders() {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;

  const notices = readJSON(DATA_FILE);
  const subs = readJSON(SUBS_FILE);
  if (subs.length === 0) return;

  const now = new Date();
  let modified = false;

  notices.forEach(notice => {
    if (!notice.date) return;

    // 1. Recordatorio 24 horas antes
    if (notice.reminder24h && !notice.reminderSent24h) {
      const eventDateTimeStr = notice.time ? `${notice.date}T${notice.time}` : `${notice.date}T09:00:00`;
      const eventTime = new Date(eventDateTimeStr).getTime();
      const diffHours = (eventTime - now.getTime()) / (1000 * 60 * 60);

      if (diffHours > 0 && diffHours <= 24) {
        const payload = JSON.stringify({
          title: `🔔 Mañana: ${notice.title}`,
          body: notice.description || 'Recordatorio de evento programado para mañana.'
        });

        subs.forEach(sub => webpush.sendNotification(sub, payload).catch(() => {}));
        notice.reminderSent24h = true;
        modified = true;
      }
    }

    // 2. Recordatorio el día del evento a las 07:30 AM
    if (notice.reminderSameDay && !notice.reminderSentSameDay) {
      const targetDate = new Date(`${notice.date}T07:30:00`).getTime();
      // Se evalúa si el momento actual ha alcanzado o superado las 7:30 AM del día programado
      if (now.getTime() >= targetDate) {
        const payload = JSON.stringify({
          title: `⏰ HOY: ${notice.title}`,
          body: notice.time ? `Hoy a las ${notice.time}. ${notice.description || ''}` : (notice.description || 'Evento programado para el día de hoy.')
        });

        subs.forEach(sub => webpush.sendNotification(sub, payload).catch(() => {}));
        notice.reminderSentSameDay = true;
        modified = true;
      }
    }
  });

  if (modified) {
    writeJSON(DATA_FILE, notices);
  }
}

// Revisar la programación cada 10 minutos
setInterval(checkAndSendReminders, 10 * 60 * 1000);

app.get('/api/config', (req, res) => {
  res.json({ vapidPublicKey: VAPID_PUBLIC });
});

app.get('/api/notices', (req, res) => {
  const notices = readJSON(DATA_FILE);
  res.json(notices);
});

app.post('/api/notices', checkAdmin, (req, res) => {
  const notices = readJSON(DATA_FILE);
  const newNotice = {
    id: Date.now().toString(),
    created_at: new Date().toISOString(),
    reminderSent24h: false,
    reminderSentSameDay: false,
    ...req.body
  };
  notices.push(newNotice);
  writeJSON(DATA_FILE, notices);

  checkAndSendReminders();

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

app.post('/api/push/subscribe', (req, res) => {
  const subs = readJSON(SUBS_FILE);
  const newSub = req.body;
  if (!subs.some(s => s.endpoint === newSub.endpoint)) {
    subs.push(newSub);
    writeJSON(SUBS_FILE, subs);
  }
  res.status(201).json({});
});

app.listen(PORT, () => {
  console.log(`Servidor activo en el puerto ${PORT}`);
});
