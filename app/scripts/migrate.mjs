import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

export async function migrate(client, directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../migrations')) {
  const files = (await readdir(directory)).filter(f => f.endsWith('.sql')).sort();
  if (!files.length) throw new Error('Migration files missing; startup refused.');
  await client.query('SELECT pg_advisory_lock(824730)');
  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS warung;
      CREATE TABLE IF NOT EXISTS warung.schema_migrations
      (filename VARCHAR(255) PRIMARY KEY, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    for (const file of files) {
      if ((await client.query('SELECT 1 FROM warung.schema_migrations WHERE filename=$1', [file])).rows.length) continue;
      if (file === '007_waha_debt_alert_workflow.sql' && !(await client.query("SELECT to_regclass('n8n.workflow_entity') AS table_name")).rows[0].table_name) {
        console.warn('Deferred optional WhatsApp workflow: n8n schema is not ready.');
        continue;
      }
      // Legacy 016/021 own their transaction. The runner now owns the boundary.
      const sql = (await readFile(path.join(directory, file), 'utf8'))
        .replace(/^BEGIN;\s*$/gm, '').replace(/^COMMIT;\s*$/gm, '');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO warung.schema_migrations(filename) VALUES ($1) ON CONFLICT DO NOTHING', [file]);
        await client.query('COMMIT');
        console.log(`Applied ${file}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed; application will not start.`, { cause: error });
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock(824730)');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  async function main() {
  const client = new pg.Client({
    host: process.env.PGHOST || 'localhost', port: Number(process.env.PGPORT || 5432),
    user: process.env.POSTGRES_USER, password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB, connectionTimeoutMillis: 10000,
  });
  try { await client.connect(); await migrate(client); }
  catch (error) { console.error(error); process.exitCode = 1; }
  finally { await client.end(); }
  }
  main();
}
