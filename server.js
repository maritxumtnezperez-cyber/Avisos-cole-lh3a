import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
const { Pool } = pkg;

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
        title TEXT,
        category TEXT,
        description TEXT,
        date TEXT,
        time TEXT,
        image_url TEXT
      );
    `);

    // 2. Asegurar que las columnas de notices existan
    await pool.query(`
      ALTER TABLE notices ADD COLUMN IF NOT EXISTS image_url TEXT;
      ALTER TABLE notices ADD COLUMN IF NOT EXISTS title TEXT;
      ALTER TABLE notices ADD COLUMN IF NOT EXISTS date TEXT;
      ALTER TABLE notices ADD COLUMN IF NOT EXISTS time TEXT;
      ALTER TABLE notices ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE notices ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'General 📌';
      ALTER TABLE notices ALTER COLUMN data DROP NOT NULL;
    `);

    // 3. Crear la tabla urine_logs si no existe y asegurar columnas
    await pool.query(`
      CREATE TABLE IF NOT EXISTS urine_logs (
        date_key VARCHAR(10) PRIMARY KEY,
        logs JSONB
      );
      ALTER TABLE urine_logs ADD COLUMN IF NOT EXISTS logs JSONB;
      ALTER TABLE urine_logs ADD COLUMN IF NOT EXISTS val VARCHAR(20);
      ALTER TABLE urine_logs ADD COLUMN IF NOT EXISTS color VARCHAR(20);
      ALTER TABLE urine_logs ADD COLUMN IF NOT EXISTS text_color VARCHAR(20);
      ALTER TABLE urine_logs ADD COLUMN IF NOT EXISTS notes TEXT;
    `);

    console.log("Base de datos inicializada correctamente");
  } catch (err) {
    console.error("Error al inicializar la base de datos:", err);
  }
}
initDb();

// Ruta para servir la imagen del logo
app.get(['/Logo.png', '/logo.png'], (req, res) => {
  const rootLogo = path.join(__dirname, 'Logo.png');
  const rootLogoLower = path.join(__dirname, 'logo.png');
  
  if (path.resolve(rootLogo)) {
    return res.sendFile(rootLogo);
  } else if (path.resolve(rootLogoLower)) {
    return res.sendFile(rootLogoLower);
  }
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
    return res.json({ ok: true });
  }
  return res.status(401).json({ error: "Contraseña incorrecta" });
});

// GET: Obtener todos los avisos
app.get('/api/notices', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM notices ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    console.error("Error al obtener avisos:", err);
    res.status(500).json({ error: "Error de servidor al obtener avisos" });
  }
});

// POST: Crear un nuevo aviso / evento
app.post('/api/notices', checkAppPassword, async (req, res) => {
  const { title, category, description, date, time, imageUrl } = req.body;
  const id = Date.now().toString();

  try {
    await pool.query(
      `INSERT INTO notices (id, title, category, description, date, time, image_url) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        String(id),
        String(title || 'Sin título'),
        String(category || 'General 📌'),
        String(description || ''),
        date ? String(date) : '',
        time ? String(time) : '',
        imageUrl ? String(imageUrl) : ''
      ]
    );
    res.json({ ok: true, notice: { id, title, category, description, date, time, imageUrl } });
  } catch (err) {
    console.error("Error al insertar evento:", err);
    res.status(500).json({ error: `Error BD: ${err.message}` });
  }
});

// DELETE: Eliminar un aviso por ID
app.delete('/api/notices/:id', checkAppPassword, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM notices WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error("Error al eliminar aviso:", err);
    res.status(500).json({ error: "Error de servidor al eliminar aviso" });
  }
});

// GET: Obtener registros de tiras de proteína por fecha
app.get('/api/urine_logs/:dateKey', async (req, res) => {
  const { dateKey } = req.params;
  try {
    const result = await pool.query('SELECT * FROM urine_logs WHERE date_key = $1', [dateKey]);
    if (result.rows.length > 0) {
      const row = result.rows[0];
      if (row.logs) {
        return res.json(row.logs);
      }
      return res.json({
        protein: {
          val: row.val,
          color: row.color,
          textcolor: row.text_color
        },
        notes: row.notes
      });
    }
    res.json(null);
  } catch (err) {
    console.error("Error al obtener registros de pis:", err);
    res.status(500).json({ error: "Error de servidor al cargar registros" });
  }
});

// POST: Guardar registros de tiras de proteína
app.post('/api/urine_logs/:dateKey', checkAppPassword, async (req, res) => {
  const { dateKey } = req.params;
  const body = req.body;

  const proteinVal = body.protein ? body.protein.val : body.val;
  const proteinColor = body.protein ? body.protein.color : body.color;
  const proteinTextColor = body.protein ? body.protein.textcolor : body.text_color;
  const notes = body.notes || '';

  try {
    await pool.query(
      `INSERT INTO urine_logs (date_key, val, color, text_color, notes, logs) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       ON CONFLICT (date_key) 
       DO UPDATE SET 
         val = EXCLUDED.val,
         color = EXCLUDED.color,
         text_color = EXCLUDED.text_color,
         notes = EXCLUDED.notes,
         logs = EXCLUDED.logs`,
      [
        dateKey,
        proteinVal || null,
        proteinColor || null,
        proteinTextColor || null,
        notes,
        JSON.stringify(body)
      ]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("Error al guardar registros de pis:", err);
    res.status(500).json({ error: `Error BD: ${err.message}` });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
