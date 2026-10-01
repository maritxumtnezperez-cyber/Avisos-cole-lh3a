import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool } from '@neondatabase/serverless';

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

// Conexión mediante Pool de Neon Serverless
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Inicialización de las Tablas en la Base de Datos
async function initDb() {
  try {
    // 1. Crear la tabla notices si no existe
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notices (
        id VARCHAR(50) PRIMARY KEY,
        title TEXT NOT NULL,
        category TEXT,
        description TEXT,
        date TEXT,
        time TEXT,
        image_url TEXT
      );
    `);

    // 2. Asegurar que la columna image_url exista si la tabla se creó previamente sin ella
    await pool.query(`
      ALTER TABLE notices ADD COLUMN IF NOT EXISTS image_url TEXT;
    `);

    // 3. Crear la tabla urine_logs si no existe
    await pool.query(`
      CREATE TABLE IF NOT EXISTS urine_logs (
        date_key VARCHAR(10) PRIMARY KEY,
        val VARCHAR(20),
        color VARCHAR(20),
        text_color VARCHAR(20),
        notes TEXT
      );
    `);
    console.log("🟢 Conectado exitosamente a Neon PostgreSQL y tablas inicializadas");
  } catch (err) {
    console.error("🔴 Error inicializando tablas en PostgreSQL:", err);
  }
}
initDb();

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

/* ========================================================
   RUTAS API: EVENTOS Y NOTICIAS
======================================================== */

app.get('/api/notices', checkAppPassword, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, title, category, description, date, time, image_url AS "imageUrl" FROM notices'
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error al obtener eventos:", err);
    res.status(500).json({ error: "Error al obtener eventos de la base de datos" });
  }
});

app.post('/api/notices', checkAppPassword, async (req, res) => {
  const { title, category, description, date, time, imageUrl } = req.body;
  const id = Date.now().toString();

  try {
    await pool.query(
      `INSERT INTO notices (id, title, category, description, date, time, image_url) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, title, category || "General 📌", description || "", date || null, time || null, imageUrl || null]
    );
    res.json({ ok: true, notice: { id, title, category, description, date, time, imageUrl } });
  } catch (err) {
    console.error("Error al insertar evento:", err);
    res.status(500).json({ error: "Error al guardar el evento en la base de datos" });
  }
});

app.put('/api/notices/:id', checkAppPassword, async (req, res) => {
  const { title, category, description, date, time, imageUrl } = req.body;
  const { id } = req.params;

  try {
    await pool.query(
      `UPDATE notices 
       SET title = COALESCE($1, title),
           category = COALESCE($2, category),
           description = COALESCE($3, description),
           date = COALESCE($4, date),
           time = COALESCE($5, time),
           image_url = COALESCE($6, image_url)
       WHERE id = $7`,
      [title, category, description, date, time, imageUrl, id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("Error al actualizar evento:", err);
    res.status(500).json({ error: "Error al actualizar evento" });
  }
});

app.delete('/api/notices/:id', checkAppPassword, async (req, res) => {
  try {
    await pool.query('DELETE FROM notices WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error("Error al eliminar evento:", err);
    res.status(500).json({ error: "Error al eliminar evento" });
  }
});

/* ========================================================
   RUTAS API: HISTORIAL DE TIRAS/PROTEÍNAS
======================================================== */

app.get('/api/urine-logs', checkAppPassword, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM urine_logs');
    const logs = {};
    
    result.rows.forEach(row => {
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
    console.error("Error al cargar tiras:", err);
    res.status(500).json({ error: "Error al cargar lecturas de proteína" });
  }
});

app.post('/api/urine-logs', checkAppPassword, async (req, res) => {
  const { dateKey, protein, notes } = req.body;

  if (!dateKey || !protein) {
    return res.status(400).json({ error: "Faltan datos obligatorios" });
  }

  try {
    await pool.query(
      `INSERT INTO urine_logs (date_key, val, color, text_color, notes)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (date_key) DO UPDATE 
       SET val = EXCLUDED.val,
           color = EXCLUDED.color,
           text_color = EXCLUDED.text_color,
           notes = EXCLUDED.notes`,
      [dateKey, protein.val, protein.color, protein.textcolor, notes || '']
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("Error al guardar tira:", err);
    res.status(500).json({ error: "Error al guardar el registro en la base de datos" });
  }
});

app.delete('/api/urine-logs/:dateKey', checkAppPassword, async (req, res) => {
  try {
    await pool.query('DELETE FROM urine_logs WHERE date_key = $1', [req.params.dateKey]);
    res.json({ ok: true });
  } catch (err) {
    console.error("Error al eliminar tira:", err);
    res.status(500).json({ error: "Error al eliminar registro" });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor iniciado en el puerto ${PORT}`);
});
