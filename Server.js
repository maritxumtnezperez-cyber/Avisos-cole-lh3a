import express from "express";
import Database from "better-sqlite3";
import webpush from "web-push";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

const dbPath = process.env.DATABASE_PATH || "./data/avisos-cole.db";
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);

db.exec(`
CREATE TABLE IF NOT EXISTS notices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL DEFAULT 'aviso',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  date TEXT,
  time TEXT,
  important INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint TEXT UNIQUE,
  subscription_json TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const adminPassword = process.env.ADMIN_PASSWORD || "cambia-esta-clave";

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@example.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

function isAdmin(req) {
  return req.headers["x-admin-password"] === adminPassword;
}

app.get("/api/config", (req, res) => {
  res.json({
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY || ""
  });
});

app.get("/api/notices", (req, res) => {
  const notices = db.prepare(`
    SELECT *
    FROM notices
    ORDER BY COALESCE(date, '9999-12-31'),
             COALESCE(time, '23:59'),
             id DESC
  `).all();

  res.json(notices);
});

app.post("/api/notices", async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(401).json({
      error: "No autorizado"
    });
  }

  const {
    type = "aviso",
    title,
    description = "",
    date = null,
    time = null,
    important = false
  } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({
      error: "Falta el título"
    });
  }

  const result = db.prepare(`
    INSERT INTO notices
    (type, title, description, date, time, important)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    type,
    title.trim(),
    description.trim(),
    date,
    time,
    important ? 1 : 0
  );

  const notice = db.prepare(
    "SELECT * FROM notices WHERE id = ?"
  ).get(result.lastInsertRowid);

  await sendPush({
    title: "Avisos Cole · LH3A",
    body: notice.title
  });

  res.status(201).json(notice);
});

app.post("/api/push/subscribe", (req, res) => {
  const subscription = req.body;

  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({
      error: "Suscripción inválida"
    });
  }

  db.prepare(`
    INSERT INTO subscriptions
    (endpoint, subscription_json)
    VALUES (?, ?)
    ON CONFLICT(endpoint)
    DO UPDATE SET subscription_json = excluded.subscription_json
  `).run(
    subscription.endpoint,
    JSON.stringify(subscription)
  );

  res.json({ ok: true });
});

async function sendPush(payload) {
  if (
    !process.env.VAPID_PUBLIC_KEY ||
    !process.env.VAPID_PRIVATE_KEY
  ) {
    return;
  }

  const subscriptions = db
    .prepare("SELECT * FROM subscriptions")
    .all();

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        JSON.parse(subscription.subscription_json),
        JSON.stringify(payload)
      );
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        db.prepare(
          "DELETE FROM subscriptions WHERE id = ?"
        ).run(subscription.id);
      }
    }
  }
}

app.get("*", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "index.html")
  );
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Avisos Cole funcionando en el puerto ${port}`);
});
