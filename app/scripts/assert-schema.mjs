import pg from 'pg';

// Startup is read-only. Migrations run explicitly through the verified upgrade path.
const client = new pg.Client({ host: process.env.PGHOST, port: Number(process.env.PGPORT || 5432),
  user: process.env.POSTGRES_USER, password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB, connectionTimeoutMillis: 10000 });
try {
  await client.connect();
  const { rowCount } = await client.query("SELECT 1 FROM warung.schema_migrations WHERE filename='022_transaction_integrity.sql'");
  if (!rowCount) throw new Error('Schema belum siap. Jalankan bash deploy-update.sh dengan backup eksternal.');
} catch (error) {
  console.error('POS tidak dimulai:', error.message);
  process.exitCode = 1;
} finally { await client.end(); }
