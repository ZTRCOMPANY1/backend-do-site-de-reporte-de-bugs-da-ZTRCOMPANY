const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('render.com')
    ? { rejectUnauthorized: false }
    : false
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
