const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
    })
  : new Pool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: Number(process.env.DB_PORT || 5432),
    });

let initializePromise = null;

const ensureMigrationTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMP DEFAULT NOW()
    )
  `);
};

const runMigrations = async () => {
  const migrationsDir = path.join(__dirname, 'migrations');
  const safeMigrations = [
    '000_core_bootstrap.sql',
    '003_healthcare_module.sql',
    '004_schema_fixes.sql',
    '005_auth_sessions.sql',
    '006_vault_files.sql',
    '007_vault_encryption.sql',
    '008_notification_system.sql',
    '009_nominee_life_emergency.sql',
    '010_emergency_user_flag.sql',
    '011_user_active_flag.sql',
    '012_secure_vault_entries.sql',
    '013_security_questions.sql',
    '014_nominee_access_scope.sql',
    '015_life_server_detection.sql',
    '016_nominee_otp_access_flow.sql',
    '017_admin_auth_and_blocking.sql',
    '018_multi_role_relationships.sql',
    '019_caretaker_otp_flow.sql',
    '020_medicine_schedules.sql',
  ];

  if (!fs.existsSync(migrationsDir)) {
    console.warn(`[DB] Migrations directory not found: ${migrationsDir}`);
    return;
  }

  await ensureMigrationTable();

  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => safeMigrations.includes(file))
    .sort((a, b) => a.localeCompare(b));

  console.log(`[DB] Checking ${files.length} migration files...`);

  for (const file of files) {
    const { rows } = await pool.query(
      'SELECT 1 FROM schema_migrations WHERE filename = $1 LIMIT 1',
      [file]
    );

    if (rows.length > 0) {
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    await pool.query('BEGIN');

    try {
      await pool.query(sql);
      await pool.query(
        'INSERT INTO schema_migrations (filename) VALUES ($1)',
        [file]
      );
      await pool.query('COMMIT');
      console.log(`[DB] Migration applied: ${file}`);
    } catch (error) {
      await pool.query('ROLLBACK');
      console.error(`[DB] Migration failed: ${file}`);
      throw error;
    }
  }

  console.log('[DB] Migration check completed.');
};

const initializeDatabase = async () => {
  if (initializePromise) {
    return initializePromise;
  }

  initializePromise = (async () => {
    console.log('[DB] Connecting to PostgreSQL...');

    const client = await pool.connect();
    client.release();

    console.log('[DB] Database connection established.');

    await runMigrations();

    console.log('[DB] Database is ready.');
  })().catch((error) => {
    initializePromise = null;
    throw error;
  });

  return initializePromise;
};

module.exports = pool;
module.exports.initializeDatabase = initializeDatabase;


