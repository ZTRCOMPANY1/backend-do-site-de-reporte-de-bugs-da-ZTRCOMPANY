require('dotenv').config();
const { initDatabase, pool } = require('./db');

initDatabase()
  .then(() => {
    console.log('Banco e admin configurados com sucesso.');
    return pool.end();
  })
  .catch((err) => {
    console.error('Erro ao configurar admin:', err);
    process.exit(1);
  });
