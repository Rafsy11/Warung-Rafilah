import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'toko_rafilah',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelayMs: 0,
  decimalNumbers: true
});

/**
 * Execute database query
 */
export async function query(sql, params = []) {
  const connection = await pool.getConnection();
  try {
    const [result] = await connection.execute(sql, params);
    return result;
  } finally {
    connection.release();
  }
}

/**
 * Get single row from database
 */
export async function getRow(sql, params = []) {
  const result = await query(sql, params);
  return result.length > 0 ? result[0] : null;
}

/**
 * Insert data and return insert ID
 */
export async function insert(sql, params = []) {
  const result = await query(sql, params);
  return result.insertId;
}

/**
 * Start transaction
 */
export async function beginTransaction() {
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  return connection;
}

/**
 * Commit transaction
 */
export async function commit(connection) {
  await connection.commit();
  connection.release();
}

/**
 * Rollback transaction
 */
export async function rollback(connection) {
  await connection.rollback();
  connection.release();
}

/**
 * Close database connection pool
 */
export async function close() {
  await pool.end();
}

export default { query, getRow, insert, beginTransaction, commit, rollback, close };
