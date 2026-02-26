import { queryOne, isDatabaseEnabled } from '../connection.js';
import { logger } from '../../config/index.js';

// =============================================================================
// Types
// =============================================================================

export interface UserRecord {
  id: string;
  google_id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  role: 'user' | 'admin';
  created_at: Date;
  last_login_at: Date;
}

// =============================================================================
// User Operations
// =============================================================================

/**
 * Find a user by their Google ID
 */
export async function findUserByGoogleId(googleId: string): Promise<UserRecord | null> {
  if (!isDatabaseEnabled()) return null;

  return queryOne<UserRecord>(
    'SELECT * FROM users WHERE google_id = $1',
    [googleId]
  );
}

/**
 * Find a user by email
 */
export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  if (!isDatabaseEnabled()) return null;

  return queryOne<UserRecord>(
    'SELECT * FROM users WHERE email = $1',
    [email]
  );
}

/**
 * Find a user by ID
 */
export async function findUserById(id: string): Promise<UserRecord | null> {
  if (!isDatabaseEnabled()) return null;

  return queryOne<UserRecord>(
    'SELECT * FROM users WHERE id = $1',
    [id]
  );
}

/**
 * Create or update a user from Google login data.
 * If user exists (by google_id), update their info and last_login_at.
 * If not, create a new user.
 * Admin role is assigned if the email matches ADMIN_EMAIL env var.
 */
export async function upsertUser(data: {
  googleId: string;
  email: string;
  name?: string;
  avatar?: string;
}): Promise<UserRecord> {
  if (!isDatabaseEnabled()) {
    throw new Error('Database not enabled');
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  const role = adminEmail && data.email.toLowerCase() === adminEmail.toLowerCase() ? 'admin' : 'user';

  const result = await queryOne<UserRecord>(
    `INSERT INTO users (google_id, email, name, avatar, role, last_login_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (google_id) DO UPDATE SET
       email = EXCLUDED.email,
       name = EXCLUDED.name,
       avatar = EXCLUDED.avatar,
       role = $5,
       last_login_at = NOW()
     RETURNING *`,
    [data.googleId, data.email, data.name || null, data.avatar || null, role]
  );

  if (!result) {
    throw new Error('Failed to create/update user');
  }

  logger.info({ userId: result.id, email: result.email, role: result.role }, 'User logged in');
  return result;
}

