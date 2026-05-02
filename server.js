require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool, initDatabase } = require('./db');
const { authRequired } = require('./middleware');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(cors({
  origin: process.env.FRONTEND_URL ? [process.env.FRONTEND_URL, 'http://localhost:5500', 'http://127.0.0.1:5500'] : '*',
  credentials: true
}));

app.get('/', (req, res) => {
  res.json({ name: 'ZTR COMPANY Report API', status: 'online' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'online', timestamp: new Date().toISOString() });
});

app.post('/api/admin/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email e senha são obrigatórios.' });

  const result = await pool.query('SELECT * FROM admins WHERE email=$1', [email.toLowerCase()]);
  const admin = result.rows[0];
  if (!admin) return res.status(401).json({ error: 'Login inválido.' });

  const ok = await bcrypt.compare(password, admin.password_hash);
  if (!ok) return res.status(401).json({ error: 'Login inválido.' });

  const token = jwt.sign({ id: admin.id, email: admin.email }, process.env.JWT_SECRET, { expiresIn: '8h' });
  res.json({ token, admin: { email: admin.email } });
});

app.get('/api/catalog', async (req, res) => {
  const result = await pool.query('SELECT id, type, name, url FROM catalog_items WHERE active=true ORDER BY type, name');
  res.json(result.rows);
});

app.post('/api/reports', async (req, res) => {
  const {
    report_type, item_id, item_name, site_url, player_name, player_email,
    severity, title, description, steps, device, game_version
  } = req.body;

  if (!['game', 'site', 'app'].includes(report_type)) {
    return res.status(400).json({ error: 'Tipo de reporte inválido.' });
  }
  if (!title || !description) {
    return res.status(400).json({ error: 'Título e descrição são obrigatórios.' });
  }

  const result = await pool.query(`
    INSERT INTO reports
    (report_type, item_id, item_name, site_url, player_name, player_email, severity, title, description, steps, device, game_version)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    RETURNING id, created_at
  `, [report_type, item_id || null, item_name || null, site_url || null, player_name || null, player_email || null, severity || 'medium', title, description, steps || null, device || null, game_version || null]);

  res.status(201).json({ message: 'Reporte enviado com sucesso.', report: result.rows[0] });
});

app.get('/api/admin/reports', authRequired, async (req, res) => {
  const result = await pool.query('SELECT * FROM reports ORDER BY created_at DESC');
  res.json(result.rows);
});

app.patch('/api/admin/reports/:id/status', authRequired, async (req, res) => {
  const { status } = req.body;
  if (!['open', 'reviewing', 'fixed', 'closed'].includes(status)) {
    return res.status(400).json({ error: 'Status inválido.' });
  }
  const result = await pool.query('UPDATE reports SET status=$1 WHERE id=$2 RETURNING *', [status, req.params.id]);
  res.json(result.rows[0]);
});

app.get('/api/admin/catalog', authRequired, async (req, res) => {
  const result = await pool.query('SELECT * FROM catalog_items ORDER BY type, name');
  res.json(result.rows);
});

app.post('/api/admin/catalog', authRequired, async (req, res) => {
  const { type, name, url } = req.body;
  if (!['game', 'site', 'app'].includes(type) || !name) {
    return res.status(400).json({ error: 'Tipo e nome são obrigatórios.' });
  }
  const result = await pool.query('INSERT INTO catalog_items (type, name, url) VALUES ($1,$2,$3) RETURNING *', [type, name, url || null]);
  res.status(201).json(result.rows[0]);
});

app.patch('/api/admin/catalog/:id', authRequired, async (req, res) => {
  const { active } = req.body;
  const result = await pool.query('UPDATE catalog_items SET active=$1 WHERE id=$2 RETURNING *', [Boolean(active), req.params.id]);
  res.json(result.rows[0]);
});

initDatabase()
  .then(() => app.listen(PORT, () => console.log(`ZTR Report API online na porta ${PORT}`)))
  .catch((err) => {
    console.error('Erro ao iniciar banco:', err);
    process.exit(1);
  });
