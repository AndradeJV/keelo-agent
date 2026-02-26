import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { logger } from '../config/index.js';

// =============================================================================
// Database Connection Pool
// =============================================================================

let pool: Pool | null = null;

/**
 * Initialize database connection pool
 */
export function initDatabase(): Pool {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    logger.warn('DATABASE_URL not configured. Database features disabled.');
    return null as unknown as Pool;
  }

  pool = new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  pool.on('error', (err) => {
    logger.error({ error: err.message }, 'Unexpected database error');
  });

  pool.on('connect', () => {
    logger.debug('New database connection established');
  });

  logger.info('Database connection pool initialized');
  return pool;
}

/**
 * Get database pool instance
 */
export function getPool(): Pool | null {
  return pool;
}

/**
 * Check if database is configured
 */
export function isDatabaseEnabled(): boolean {
  return !!process.env.DATABASE_URL && pool !== null;
}

/**
 * Execute a query
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  if (!pool) {
    throw new Error('Database not initialized');
  }
  
  const start = Date.now();
  try {
    const result = await pool.query<T>(sql, params);
    const duration = Date.now() - start;
    
    logger.debug({ 
      sql: sql.substring(0, 100), 
      duration, 
      rows: result.rowCount 
    }, 'Query executed');
    
    return result;
  } catch (error) {
    logger.error({ 
      error: (error as Error).message, 
      sql: sql.substring(0, 100) 
    }, 'Query failed');
    throw error;
  }
}

/**
 * Execute a query and return first row
 */
export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params?: unknown[]
): Promise<T | null> {
  const result = await query<T>(sql, params);
  return result.rows[0] || null;
}

/**
 * Execute a query and return all rows
 */
export async function queryAll<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await query<T>(sql, params);
  return result.rows;
}

/**
 * Get a client from the pool for transactions
 */
export async function getClient(): Promise<PoolClient> {
  if (!pool) {
    throw new Error('Database not initialized');
  }
  return pool.connect();
}

/**
 * Execute operations within a transaction
 */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Close all database connections
 */
export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database connections closed');
  }
}

/**
 * Health check for database
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  if (!pool) return false;
  
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

