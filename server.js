import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { neon } from '@neondatabase/serverless'; // Uso directo del cliente serverless de Neon

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Única contraseña de la App
const APP_PASSWORD = (process.env.APP_PASSWORD || "78875879").trim();

app.use(express.json({ limit: '10mb' }));

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// Conexión a Neon PostgreSQL mediante tag de plantillas SQL
const sql = neon(process.env.DATABASE_URL);

// Inicialización de las Tablas en la Base de Datos
async function initDb() {
  try {
    // Tabla para eventos del calendario
    await sql`
      CREATE TABLE IF NOT EXISTS notices (
        id VARCHAR(50) PRIMARY KEY,
        title TEXT NOT NULL,
        category TEXT,
        description TEXT,
        date TEXT,
        time TEXT,
        image_url TEXT
      );
    `;

    // Tabla para registros de proteínas/tiras
    await sql`
      CREATE TABLE IF NOT EXISTS urine_logs (
        date_key VARCHAR(10) PRIMARY KEY,
        val VARCHAR(20),
        color VARCHAR(20),
        text_color VARCHAR(20),
        notes TEXT
      );
    `;
    console.log("🟢 Conectado exitosamente a Neon PostgreSQL y tablas inicializadas");
  } catch (err) {
    console.error("🔴 Error inicializando tablas en PostgreSQL:", err);
  }
}
initDb();

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

/* ========================================================
   RUTAS API: EVENTOS Y NOTICIAS
======================================================== */

app.get('/api/notices', checkAppPassword, async (req, res) => {
  try {
    const rows = await sql`
      SELECT id, title, category, description, date, time, image_url AS "imageUrl" 
      FROM notices
    `;
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener eventos de la base de datos" });
  }
});

app.post('/api/notices', checkAppPassword, async (req, res) => {
  const { title, category, description, date, time, imageUrl } = req.body;
  const id = Date.now().toString();

  try {
    await sql`
      INSERT INTO notices (id, title, category, description, date, time, image_url) 
      VALUES (${id}, ${title}, ${category || "General 📌"}, ${description || ""}, ${date || null}, ${time || null}, ${imageUrl || null})
    `;
    res.json({ ok: true, notice: { id, title, category, description, date, time, imageUrl } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al guardar el evento en la base de datos" });
  }
});

app.put('/api/notices/:id', checkAppPassword, async (req, res) => {
  const { title, category, description, date, time, imageUrl } = req.body;
  const { id } = req.params;

  try {
    await sql`
      UPDATE notices 
      SET title = COALESCE(${title}, title),
          category = COALESCE(${category}, category),
          description = COALESCE(${description}, description),
          date = COALESCE(${date}, date),
          time = COALESCE(${time}, time),
          image_url = COALESCE(${imageUrl}, image_url)
      WHERE id = ${id}
    `;
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar evento" });
  }
});

app.delete('/api/notices/:id', checkAppPassword, async (req, res) => {
  try {
    await sql`DELETE FROM notices WHERE id = ${req.params.id}`;
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al eliminar evento" });
  }
});

/* ========================================================
   RUTAS API: HISTORIAL DE TIRAS/PROTEÍNAS
======================================================== */

app.get('/api/urine-logs', checkAppPassword, async (req, res) => {
  try {
    const rows = await sql`SELECT * FROM urine_logs`;
    const logs = {};
    
    rows.forEach(row => {
      logs[row.date_key] = {
        protein: {
          val: row.val,
          color: row.color,
          textcolor: row.text_color
        },
        notes: row.notes
      };
    });

    res.json(logs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al cargar lecturas de proteína" });
  }
});

app.post('/api/urine-logs', checkAppPassword, async (req, res) => {
  const { dateKey, protein, notes } = req.body;

  if (!dateKey || !protein) {
    return res.status(400).json({ error: "Faltan datos obligatorios" });
  }

  try {
    await sql`
      INSERT INTO urine_logs (date_key, val, color, text_color, notes)
      VALUES (${dateKey}, ${protein.val}, ${protein.color}, ${protein.textcolor}, ${notes || ''})
      ON CONFLICT (date_key) DO UPDATE 
      SET val = EXCLUDED.val,
          color = EXCLUDED.color,
          text_color = EXCLUDED.text_color,
          notes = EXCLUDED.notes
    `;
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al guardar el registro en la base de datos" });
  }
});

app.delete('/api/urine-logs/:dateKey', checkAppPassword, async (req, res) => {
  try {
    await sql`DELETE FROM urine_logs WHERE date_key = ${req.params.dateKey}`;
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al eliminar registro" });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor iniciado en el puerto ${PORT}`);
});
