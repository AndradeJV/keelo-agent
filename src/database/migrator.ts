import { readFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { getClient, isDatabaseEnabled } from './connection.js';
import { logger } from '../config/index.js';

// =============================================================================
// Auto-Migration Runner
//
// Reads SQL files from database/migrations/, tracks which ones have been
// applied in a `schema_migrations` table, and runs pending ones in order.
// =============================================================================

/**
 * Resolve the migrations directory.
 * Works both in development (project root) and production (Docker /app).
 */
function getMigrationsDir(): string {
  // In production (Docker), CWD is /app and database/ is copied there.
  // In development, CWD is the project root.
  return resolve(process.cwd(), 'database', 'migrations');
}

/**
 * Ensure the schema_migrations tracking table exists.
 */
async function ensureMigrationsTable(): Promise<void> {
  const client = await getClient();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  } finally {
    client.release();
  }
}

/**
 * Get the set of migration names that have already been applied.
 */
async function getAppliedMigrations(): Promise<Set<string>> {
  const client = await getClient();
  try {
    const result = await client.query<{ name: string }>(
      'SELECT name FROM schema_migrations ORDER BY name'
    );
    return new Set(result.rows.map((r) => r.name));
  } finally {
    client.release();
  }
}

/**
 * Discover all .sql files in the migrations directory, sorted by name.
 */
function discoverMigrationFiles(dir: string): string[] {
  try {
    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort(); // Lexicographic sort — works because files are prefixed 001_, 002_, etc.
    return files;
  } catch (error) {
    logger.warn({ dir, error: (error as Error).message }, 'Could not read migrations directory');
    return [];
  }
}

/**
 * Run all pending database migrations.
 *
 * Each migration is executed inside its own transaction. If a migration
 * fails, the transaction is rolled back and subsequent migrations are
 * skipped so the operator can fix the issue and re-deploy.
 */
export async function runMigrations(): Promise<void> {
  if (!isDatabaseEnabled()) {
    logger.debug('Database not enabled — skipping migrations');
    return;
  }

  const migrationsDir = getMigrationsDir();
  logger.info({ dir: migrationsDir }, 'Running database migrations');

  // 1. Ensure tracking table exists
  await ensureMigrationsTable();

  // 2. Get already-applied migrations
  const applied = await getAppliedMigrations();

  // 3. Discover files on disk
  const files = discoverMigrationFiles(migrationsDir);

  if (files.length === 0) {
    logger.info('No migration files found');
    return;
  }

  // 4. Determine pending migrations
  const pending = files.filter((f) => !applied.has(f));

  if (pending.length === 0) {
    logger.info({ total: files.length }, 'All migrations already applied');
    return;
  }

  logger.info({ pending: pending.length, total: files.length }, 'Pending migrations found');

  // 5. Apply each pending migration in order
  for (const file of pending) {
    const filePath = join(migrationsDir, file);
    const sql = readFileSync(filePath, 'utf-8');

    const client = await getClient();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (name) VALUES ($1)',
        [file]
      );
      await client.query('COMMIT');
      logger.info({ migration: file }, 'Migration applied successfully');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(
        { migration: file, error: (error as Error).message },
        'Migration failed — stopping migration runner'
      );
      throw error; // Stop processing further migrations
    } finally {
      client.release();
    }
  }

  logger.info({ applied: pending.length }, 'All pending migrations applied');
}

