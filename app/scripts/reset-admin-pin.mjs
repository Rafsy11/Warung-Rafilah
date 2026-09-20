import pg from 'pg';
import { readFileSync } from 'node:fs';

const pin = readFileSync(0, 'utf8').trim();
if (pin.length < 8 || pin.length > 64) throw new Error('PIN/password harus 8–64 karakter.');
const client = new pg.Client({ host: process.env.PGHOST || 'localhost', user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD, database: process.env.POSTGRES_DB });
try {
  await client.connect();
  const result = await client.query("UPDATE core.users SET pin_hash=crypt($1,gen_salt('bf',12)) WHERE username='admin' RETURNING id", [pin]);
  if (!result.rowCount) throw new Error('Akun admin tidak ditemukan.');
  console.log('Password admin diperbarui. Sesi lama dicabut.');
} finally { await client.end(); }
