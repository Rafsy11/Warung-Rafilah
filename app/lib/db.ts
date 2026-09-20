import { Pool } from 'pg';
import { requireProductionEnv } from '@/lib/runtime-env';

const globalForPg = global as unknown as { pgPool?: Pool };
const pool = globalForPg.pgPool ?? new Pool({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432', 10),
  user: process.env.POSTGRES_USER || 'pos_admin',
  password: process.env.NODE_ENV === 'production'
    ? requireProductionEnv('POSTGRES_PASSWORD')
    : (process.env.POSTGRES_PASSWORD || 'pos_password_123'),
  database: process.env.POSTGRES_DB || 'pos_production',
  options: '-c timezone=Asia/Jakarta',
  min: 2,                       // Retain up to two idle connections once opened
  max: 8,                      // Maximum pool size for POS local server
  idleTimeoutMillis: 30000,     // Close idle clients after 30s
  connectionTimeoutMillis: 5000, // Timeout connection attempts after 5s
  statement_timeout: 10000,     // Kill any query hanging longer than 10s (prevents pool lockup)
});

globalForPg.pgPool = pool;
export const db = pool;
