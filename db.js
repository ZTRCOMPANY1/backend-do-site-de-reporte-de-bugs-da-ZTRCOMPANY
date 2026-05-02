const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

if (!process.env.DATABASE_URL) {
  console.error('ERRO: DATABASE_URL não configurada. Configure no Render em Environment.');
  process.exit(1);
}

const isRenderDb = process.env.DATABASE_URL.includes('render.com') || process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isRenderDb ? { rejectUnauthorized: false } : false
});

async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admins (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // Migração automática para bancos já criados em versões antigas do projeto.
  await pool.query(`ALTER TABLE admins ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS catalog_items (
      id SERIAL PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('game','site','app')),
      name TEXT NOT NULL,
      url TEXT,
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reports (
      id SERIAL PRIMARY KEY,
      report_type TEXT NOT NULL CHECK (report_type IN ('game','site','app')),
      item_id INTEGER REFERENCES catalog_items(id) ON DELETE SET NULL,
      item_name TEXT,
      site_url TEXT,
      player_name TEXT,
      player_email TEXT,
      severity TEXT DEFAULT 'medium',
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      steps TEXT,
      device TEXT,
      game_version TEXT,
      status TEXT DEFAULT 'open',
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await syncAdminFromEnv();
  await seedCatalog();
}

async function syncAdminFromEnv() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';

  if (!email || !password) {
    console.warn('AVISO: ADMIN_EMAIL ou ADMIN_PASSWORD não configurados. Login admin ficará indisponível.');
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await pool.query(`
    INSERT INTO admins (email, password_hash)
    VALUES ($1, $2)
    ON CONFLICT (email)
    DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = NOW();
  `, [email, passwordHash]);

  console.log(`Admin sincronizado pelo ENV: ${email}`);
}

async function seedCatalog() {
  const count = await pool.query('SELECT COUNT(*) FROM catalog_items');
  if (Number(count.rows[0].count) === 0) {
    await pool.query(`
      INSERT INTO catalog_items (type, name, url) VALUES
      ('game', 'Race Low Poly', NULL),
      ('site', 'ZTR COMPANY Site Oficial', 'https://ztrcompany.site'),
      ('app', 'ZTR COMPANY Launcher', NULL)
    `);
  }
}

module.exports = { pool, initDatabase };
