import express from "express";
import Database from "better-sqlite3";
import webpush from "web-push";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const db = new Database("avisos-cole.db");

db.exec(`
CREATE TABLE IF NOT EXISTS notices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL DEFAULT 'aviso',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  date TEXT,
  time TEXT,
  important INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint TEXT UNIQUE NOT NULL,
  subscription_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

app.use(express.json({limit:"1mb"}));
app.use(express.static(path.join(__dirname, "public")));

const adminPassword = process.env.ADMIN_PASSWORD || "demo";
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

app.get("/api/config", (_req,res) => {
  res.json({ vapidPublicKey: process.env.VAPID_PUBLIC_KEY || "" });
});

app.get("/api/notices", (_req,res) => {
  const rows = db.prepare(`
    SELECT id,type,title,description,date,time,important,created_at
    FROM notices ORDER BY COALESCE(date,'9999-12-31'), COALESCE(time,'23:59'), id DESC
  `).all();
  res.json(rows);
});

app.post("/api/notices", async (req,res) => {
  if (!isAdmin(req)) return res.status(401).json({error:"No autorizado"});
  const {type="aviso",title,description="",date=null,time=null,important=false} = req.body;
  if (!title?.trim()) return res.status(400).json({error:"Falta el título"});
  const info = db.prepare(`
    INSERT INTO notices(type,title,description,date,time,important)
    VALUES(?,?,?,?,?,?)
  `).run(type,title.trim(),description.trim(),date,time,important?1:0);

  const notice = db.prepare("SELECT * FROM notices WHERE id=?").get(info.lastInsertRowid);
  await sendPush({
    title: "Avisos Cole · LH3A",
    body: notice.title,
    url: "/"
  });
  res.status(201).json(notice);
});

app.delete("/api/notices/:id", async (req,res) => {
  if (!isAdmin(req)) return res.status(401).json({error:"No autorizado"});
  db.prepare("DELETE FROM notices WHERE id=?").run(req.params.id);
  res.status(204).end();
});

app.post("/api/push/subscribe", (req,res) => {
  const sub=req.body;
  if (!sub?.endpoint) return res.status(400).json({error:"Suscripción inválida"});
  db.prepare(`
    INSERT INTO subscriptions(endpoint,subscription_json)
    VALUES(?,?)
    ON CONFLICT(endpoint) DO UPDATE SET subscription_json=excluded.subscription_json
  `).run(sub.endpoint, JSON.stringify(sub));
  res.status(201).json({ok:true});
});

async function sendPush(payload) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;
  const subs=db.prepare("SELECT * FROM subscriptions").all();
  const message=JSON.stringify(payload);
  for (const row of subs) {
    try {
      await webpush.sendNotification(JSON.parse(row.subscription_json), message);
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) {
        db.prepare("DELETE FROM subscriptions WHERE id=?").run(row.id);
      }
    }
  }
}

app.get("*", (_req,res) => {
  res.sendFile(path.join(__dirname,"public","index.html"));
});

const port=Number(process.env.PORT||3000);
app.listen(port,()=>console.log(`Avisos Cole: http://localhost:${port}`));
