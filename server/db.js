import mysql from 'mysql2/promise';

let pool;

export function getPool() {
  if (!pool) {
    const {
      DB_HOST = 'localhost',
      DB_PORT = '3306',
      DB_NAME = 'colourcode',
      DB_USER = 'colourcode',
      DB_PASSWORD = '',
      DB_CONNECTION_LIMIT = '10',
    } = process.env;
    // Minimal startup log (no secrets)
    try {
      console.log(`[DB] host=${DB_HOST} port=${DB_PORT} user=${DB_USER} name=${DB_NAME} password_set=${DB_PASSWORD ? 'yes' : 'no'}`);
    } catch {}
    pool = mysql.createPool({
      host: DB_HOST,
      port: Number(DB_PORT),
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      waitForConnections: true,
      connectionLimit: Number(DB_CONNECTION_LIMIT),
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    });
  }
  return pool;
}

export async function ping() {
  const p = getPool();
  const [rows] = await p.query('SELECT 1 AS ok');
  return rows?.[0]?.ok === 1;
}
