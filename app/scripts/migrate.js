const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Basic manual parsing of .env
const envPath = path.join(__dirname, '../.env');
const env = {};
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const parts = trimmed.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const value = parts.slice(1).join('=').trim();
      env[key] = value;
    }
  });
}

const client = new Client({
  host: env.PGHOST || 'localhost',
  port: parseInt(env.PGPORT || '5432', 10),
  user: env.POSTGRES_USER || 'pos_admin',
  password: env.POSTGRES_PASSWORD || 'pos_password_123',
  database: env.POSTGRES_DB || 'pos_production',
});

async function run() {
  console.log('Connecting to database...');
  await client.connect();
  console.log('Connected successfully!');

  // Ensure migration table exists
  await client.query(`
    CREATE SCHEMA IF NOT EXISTS warung;
    CREATE TABLE IF NOT EXISTS warung.schema_migrations (
      filename VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const migrationsDir = path.join(__dirname, '../migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.log('No migrations directory found.');
    await client.end();
    return;
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`Found ${files.length} migration files.`);

  for (const file of files) {
    // Check if applied
    const res = await client.query(
      'SELECT 1 FROM warung.schema_migrations WHERE filename = $1',
      [file]
    );

    if (res.rows.length > 0) {
      console.log(`Migration ${file} is already applied. Skipping.`);
      continue;
    }

    console.log(`Applying migration ${file}...`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query(
        'INSERT INTO warung.schema_migrations (filename) VALUES ($1)',
        [file]
      );
      await client.query('COMMIT');
      console.log(`Migration ${file} applied successfully!`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`Failed to apply migration ${file}:`, err);
      process.exit(1);
    }
  }

  console.log('All migrations checked and up to date.');
  await client.end();
}

run().catch(console.error);
