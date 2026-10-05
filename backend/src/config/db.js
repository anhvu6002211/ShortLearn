const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'shortlearn_secret',
  database: process.env.DB_NAME || 'shortlearn_db',
  charset: 'utf8mb4_unicode_ci',
  timezone: 'Z',
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10_000,
  connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT_MS) || 5_000,
});

async function checkDatabase() {
  await pool.query('SELECT 1');
  return true;
}

async function closeDatabase() {
  await pool.end();
}

pool.getConnection()
  .then((connection) => {
    console.log('✅ [MySQL] Connected to database successfully.');
    connection.release();
  })
  .catch((error) => {
    console.error('❌ [MySQL] Connection error:', error.message);
  });

module.exports = Object.assign(pool, { checkDatabase, closeDatabase });
