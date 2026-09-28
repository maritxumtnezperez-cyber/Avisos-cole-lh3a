import express from 'express';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '1234';

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

await pool.query(`
  CREATE TABLE IF NOT EXISTS notices (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL
  )
`);

const wrap = fn => (req, res, next) =>
  fn(req, res, next).catch(err => {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  });

function checkAdmin(req, res, next) {
  const pass = req.headers['x-admin-password'];
  if (pass === ADMIN_PASSWORD) {
    next();
  } else {
    res.status(401).json({ error: 'Contraseña incorrecta' });
  }
}

app.get('/api/notices', wrap(async (req, res) => {
  const { rows } = await pool.query('SELECT data FROM notices');
  res.json(rows.map(r => r.data));
}));

app.post('/api/notices', checkAdmin, wrap(async (req, res) => {
  const newNotice = {
    id: Date.now().toString(),
    created_at: new Date().toISOString(),
    ...req.body
  };
  newNotice.id = newNotice.id.toString();
  await pool.query(
    'INSERT INTO notices (id, data) VALUES ($1, $2)',
    [newNotice.id, newNotice]
  );
  res.status(201).json(newNotice);
}));

app.put('/api/notices/:id', checkAdmin, wrap(async (req, res) => {
  const { rows } = await pool.query(
    'SELECT data FROM notices WHERE id = $1',
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Aviso no encontrado' });
  const updated = { ...rows[0].data, ...req.body, id: req.params.id };
  await pool.query(
    'UPDATE notices SET data = $2 WHERE id = $1',
    [req.params.id, updated]
  );
  res.json(updated);
}));

app.delete('/api/notices/:id', checkAdmin, wrap(async (req, res) => {
  await pool.query('DELETE FROM notices WHERE id = $1', [req.params.id]);
  res.json({ success: true });
}));

app.listen(PORT, () => {
  console.log(`Servidor activo en el puerto ${PORT}`);
});
