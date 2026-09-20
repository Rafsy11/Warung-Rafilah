import pg from 'pg';
import { migrate } from './migrate.mjs';

import path from 'node:path';
import { fileURLToPath } from 'node:url';

export async function verifyUpgrade(client, directory) {
  const tables = (await client.query(`SELECT table_schema,table_name FROM information_schema.tables
    WHERE table_schema IN ('warung','agent','core') AND table_type='BASE TABLE' AND table_name <> 'schema_migrations'
    ORDER BY table_schema,table_name`)).rows;
  // Compare every existing column of every existing row, ignoring only new columns.
  const snapshots = [];
  for (const table of tables) {
    const columns = (await client.query(`SELECT column_name FROM information_schema.columns
      WHERE table_schema=$1 AND table_name=$2 ORDER BY ordinal_position`, [table.table_schema,table.table_name])).rows;
    const quote = name => '"' + name.replaceAll('"','""') + '"';
    const projection = columns.map(c => quote(c.column_name)).join(',');
    const sql = `SELECT count(*)::text AS count, md5(COALESCE(string_agg(row_text, E'\\n' ORDER BY row_text),'')) AS hash
      FROM (SELECT row_to_json(t)::text AS row_text FROM (SELECT ${projection} FROM ${quote(table.table_schema)}.${quote(table.table_name)}) t) rows`;
    snapshots.push({ sql, expected: (await client.query(sql)).rows[0], table: table.table_name });
  }
  await migrate(client, directory);
  await migrate(client, directory); // rerun must be a no-op
  for (const snapshot of snapshots) {
    if (JSON.stringify((await client.query(snapshot.sql)).rows[0]) !== JSON.stringify(snapshot.expected)) {
      throw new Error(`Existing rows changed in ${snapshot.table}; production upgrade refused.`);
    }
  }
  console.log(`Upgrade/re-run preserved all existing values in ${snapshots.length} operational tables.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  async function main() {
    if (!/^pos_restore_check_\d+_\d+$/.test(process.env.POSTGRES_DB || '')) throw new Error('Verification must run on an isolated restore database.');
    const client = new pg.Client({ host: process.env.PGHOST, port: Number(process.env.PGPORT || 5432), user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD, database: process.env.POSTGRES_DB });
    try { await client.connect(); await verifyUpgrade(client); }
    finally { await client.end(); }
  }
  main().catch(error => { console.error(error); process.exitCode = 1; });
}
