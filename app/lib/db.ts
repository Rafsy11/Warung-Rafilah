import { Pool } from 'pg';
import { readdir, readFile } from 'fs/promises';
import path from 'path';
import { requireProductionEnv } from '@/lib/runtime-env';

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432', 10),
  user: process.env.POSTGRES_USER || 'pos_admin',
  password: process.env.NODE_ENV === 'production'
    ? requireProductionEnv('POSTGRES_PASSWORD')
    : (process.env.POSTGRES_PASSWORD || 'pos_password_123'),
  database: process.env.POSTGRES_DB || 'pos_production',
  min: 4,                       // Keep 4 warm connections ready (no cold-start delay)
  max: 20,                      // Maximum pool size for POS local server
  idleTimeoutMillis: 30000,     // Close idle clients after 30s
  connectionTimeoutMillis: 5000, // Timeout connection attempts after 5s
  statement_timeout: 10000,     // Kill any query hanging longer than 10s (prevents pool lockup)
});

// Singleton pattern for pg.Pool to prevent connection leaks during HMR
const globalForPg = global as unknown as { pgPool: Pool };

export const db = globalForPg.pgPool || pool;

if (process.env.NODE_ENV !== 'production') {
  globalForPg.pgPool = db;
}

// Auto-run migrations on server startup (fully async — never blocks event loop)
if (typeof window === 'undefined') {
  (async () => {
    try {
      console.log('Checking database migrations...');
      
      // Ensure migrations table exists
      await db.query(`
        CREATE SCHEMA IF NOT EXISTS warung;
        CREATE TABLE IF NOT EXISTS warung.schema_migrations (
          filename VARCHAR(255) PRIMARY KEY,
          applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Resolve migrations directory path (async I/O — non-blocking)
      const migrationsDir = path.join(process.cwd(), 'migrations');
      let files: string[];
      try {
        files = (await readdir(migrationsDir))
          .filter(f => f.endsWith('.sql'))
          .sort();
      } catch {
        files = []; // No migrations directory — skip silently
      }

      for (const file of files) {
        const checkRes = await db.query(
          'SELECT 1 FROM warung.schema_migrations WHERE filename = $1',
          [file]
        );

        if (checkRes.rows.length === 0) {
          console.log(`Applying database migration: ${file}`);
          const sql = await readFile(path.join(migrationsDir, file), 'utf8');
          await db.query('BEGIN');
          try {
            await db.query(sql);
            await db.query(
              'INSERT INTO warung.schema_migrations (filename) VALUES ($1)',
              [file]
            );
            await db.query('COMMIT');
            console.log(`Migration ${file} applied successfully.`);
          } catch (err) {
            await db.query('ROLLBACK');
            console.error(`Error applying migration ${file}:`, err);
          }
        }
      }
      console.log('Database migrations check completed.');
    } catch (err) {
      console.warn('Database connection or migration failed (expected during build if DB is offline):', err);
    }
  })();
}

