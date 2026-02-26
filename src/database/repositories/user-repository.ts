import { queryOne, isDatabaseEnabled } from '../connection.js';
import { logger } from '../../config/index.js';
import bcrypt from 'bcryptjs';

// =============================================================================
// Types
// =============================================================================

export interface UserRecord {
  id: string;
  google_id: string | null;
  email: string;
  name: string | null;
  avatar: string | null;
  role: 'user' | 'admin';
  username: string | null;
  password_hash: string | null;
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

// =============================================================================
// Username/Password Authentication
// =============================================================================

/**
 * Find a user by username
 */
export async function findUserByUsername(username: string): Promise<UserRecord | null> {
  if (!isDatabaseEnabled()) return null;

  return queryOne<UserRecord>(
    'SELECT * FROM users WHERE username = $1',
    [username]
  );
}

/**
 * Verify a user's password
 */
export async function verifyPassword(user: UserRecord, password: string): Promise<boolean> {
  if (!user.password_hash) return false;
  return bcrypt.compare(password, user.password_hash);
}

/**
 * Create a user with username and password (for admin accounts)
 */
export async function createUserWithPassword(data: {
  username: string;
  password: string;
  email: string;
  name?: string;
  role?: 'user' | 'admin';
}): Promise<UserRecord> {
  if (!isDatabaseEnabled()) {
    throw new Error('Database not enabled');
  }

  const passwordHash = await bcrypt.hash(data.password, 10);

  const result = await queryOne<UserRecord>(
    `INSERT INTO users (username, password_hash, email, name, role, last_login_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (username) DO UPDATE SET
       password_hash = $2,
       role = $5,
       last_login_at = NOW()
     RETURNING *`,
    [data.username, passwordHash, data.email, data.name || data.username, data.role || 'user']
  );

  if (!result) {
    throw new Error('Failed to create user');
  }

  logger.info({ userId: result.id, username: result.username, role: result.role }, 'User created with password');
  return result;
}

/**
 * Seed the admin user if it doesn't exist.
 * Called at startup.
 */
export async function seedAdminUser(): Promise<void> {
  if (!isDatabaseEnabled()) return;

  const adminUsername = 'AdminKeelo';
  const adminPassword = 'Admin@Keelo21377';

  try {
    const existing = await findUserByUsername(adminUsername);
    if (existing) {
      logger.debug({ username: adminUsername }, 'Admin user already exists');
      return;
    }

    await createUserWithPassword({
      username: adminUsername,
      password: adminPassword,
      email: 'admin@keelo.dev',
      name: 'Admin Keelo',
      role: 'admin',
    });

    logger.info({ username: adminUsername }, 'Admin user seeded successfully');
  } catch (error) {
    logger.error({ error }, 'Failed to seed admin user');
  }
}

