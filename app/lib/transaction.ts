import type { PoolClient } from 'pg';

// One local POS: serialize financial mutations before reading balances/stock.
// All participating writers acquire this before row locks, avoiding lock inversion.
export async function beginTransaction(client: PoolClient) {
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(824731)');
}
