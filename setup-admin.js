require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool, initDatabase } = require('./db');

async function main() {
  await initDatabase();
  const email = (process.env.ADMIN_EMAIL || 'admin@ztrcompany.com').toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '12345678';
  const hash = await bcrypt.hash(password, 12);
  await pool.query(`
    INSERT INTO admins (email, password_hash)
    VALUES ($1, $2)
    ON CONFLICT (email) DO UPDATE SET password_hash=$2
  `, [email, hash]);
  console.log('Admin criado/atualizado:', email);
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
