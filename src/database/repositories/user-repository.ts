import { queryOne, isDatabaseEnabled } from '../connection.js';
import { logger } from '../../config/index.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// =============================================================================
// Types
// =============================================================================

export interface UserRecord {
  id: string;
  google_id: string | null;
  github_id: string | null;
  email: string;
  name: string | null;
  avatar: string | null;
  role: 'user' | 'admin';
  username: string | null;
  password_hash: string | null;
  email_verified: boolean;
  verification_token: string | null;
  verification_token_expires: Date | null;
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
    `INSERT INTO users (username, password_hash, email, name, role, email_verified, last_login_at)
     VALUES ($1, $2, $3, $4, $5, TRUE, NOW())
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

// =============================================================================
// Email/Password Registration
// =============================================================================

/**
 * Register a new user with email and password.
 * Creates an unverified user and returns a verification token.
 */
export async function registerUserWithEmail(data: {
  email: string;
  password: string;
  name: string;
}): Promise<{ user: UserRecord; verificationToken: string }> {
  if (!isDatabaseEnabled()) {
    throw new Error('Database not enabled');
  }

  // Check if email already exists
  const existing = await findUserByEmail(data.email);
  if (existing) {
    throw new Error('EMAIL_EXISTS');
  }

  const passwordHash = await bcrypt.hash(data.password, 12);
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  const result = await queryOne<UserRecord>(
    `INSERT INTO users (email, name, password_hash, email_verified, verification_token, verification_token_expires, role, last_login_at)
     VALUES ($1, $2, $3, FALSE, $4, $5, 'user', NOW())
     RETURNING *`,
    [data.email, data.name, passwordHash, verificationToken, tokenExpires]
  );

  if (!result) {
    throw new Error('Failed to register user');
  }

  logger.info({ userId: result.id, email: result.email }, 'User registered (pending email verification)');
  return { user: result, verificationToken };
}

/**
 * Confirm a user's email using a verification token.
 */
export async function confirmUserEmail(token: string): Promise<UserRecord | null> {
  if (!isDatabaseEnabled()) return null;

  const user = await queryOne<UserRecord>(
    `UPDATE users 
     SET email_verified = TRUE, 
         verification_token = NULL, 
         verification_token_expires = NULL
     WHERE verification_token = $1 
       AND verification_token_expires > NOW()
       AND email_verified = FALSE
     RETURNING *`,
    [token]
  );

  if (user) {
    logger.info({ userId: user.id, email: user.email }, 'Email verified successfully');
  }

  return user;
}

/**
 * Resend verification email — generates a new token.
 */
export async function regenerateVerificationToken(email: string): Promise<{ user: UserRecord; verificationToken: string } | null> {
  if (!isDatabaseEnabled()) return null;

  const verificationToken = crypto.randomBytes(32).toString('hex');
  const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const user = await queryOne<UserRecord>(
    `UPDATE users 
     SET verification_token = $1, 
         verification_token_expires = $2
     WHERE email = $3 
       AND email_verified = FALSE
     RETURNING *`,
    [verificationToken, tokenExpires, email]
  );

  if (!user) return null;

  return { user, verificationToken };
}

// =============================================================================
// GitHub OAuth
// =============================================================================

/**
 * Find a user by their GitHub ID
 */
export async function findUserByGithubId(githubId: string): Promise<UserRecord | null> {
  if (!isDatabaseEnabled()) return null;

  return queryOne<UserRecord>(
    'SELECT * FROM users WHERE github_id = $1',
    [githubId]
  );
}

/**
 * Create or update a user from GitHub login data.
 */
export async function upsertGithubUser(data: {
  githubId: string;
  email: string;
  name?: string;
  avatar?: string;
}): Promise<UserRecord> {
  if (!isDatabaseEnabled()) {
    throw new Error('Database not enabled');
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  const role = adminEmail && data.email.toLowerCase() === adminEmail.toLowerCase() ? 'admin' : 'user';

  // First try to find by github_id
  const existingByGithub = await findUserByGithubId(data.githubId);
  if (existingByGithub) {
    const result = await queryOne<UserRecord>(
      `UPDATE users SET 
         email = $1, name = $2, avatar = $3, role = $4, 
         last_login_at = NOW(), email_verified = TRUE
       WHERE github_id = $5
       RETURNING *`,
      [data.email, data.name || existingByGithub.name, data.avatar || existingByGithub.avatar, role, data.githubId]
    );
    if (!result) throw new Error('Failed to update GitHub user');
    logger.info({ userId: result.id, email: result.email }, 'GitHub user logged in');
    return result;
  }

  // Check if a user with same email exists (link accounts)
  const existingByEmail = await findUserByEmail(data.email);
  if (existingByEmail) {
    const result = await queryOne<UserRecord>(
      `UPDATE users SET 
         github_id = $1, name = COALESCE(name, $2), avatar = COALESCE(avatar, $3), 
         last_login_at = NOW(), email_verified = TRUE
       WHERE email = $4
       RETURNING *`,
      [data.githubId, data.name, data.avatar, data.email]
    );
    if (!result) throw new Error('Failed to link GitHub account');
    logger.info({ userId: result.id, email: result.email }, 'GitHub account linked to existing user');
    return result;
  }

  // Create new user
  const result = await queryOne<UserRecord>(
    `INSERT INTO users (github_id, email, name, avatar, role, email_verified, last_login_at)
     VALUES ($1, $2, $3, $4, $5, TRUE, NOW())
     RETURNING *`,
    [data.githubId, data.email, data.name || null, data.avatar || null, role]
  );

  if (!result) throw new Error('Failed to create GitHub user');
  logger.info({ userId: result.id, email: result.email }, 'New GitHub user created');
  return result;
}

// =============================================================================
// Password Reset
// =============================================================================

/**
 * Generate a password reset token for a user (found by email).
 * Token expires in 1 hour.
 * Returns null if the email is not found (caller should NOT reveal this).
 */
export async function createPasswordResetToken(email: string): Promise<{ user: UserRecord; resetToken: string } | null> {
  if (!isDatabaseEnabled()) return null;

  const resetToken = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  const user = await queryOne<UserRecord>(
    `UPDATE users
     SET password_reset_token = $1,
         password_reset_expires = $2
     WHERE email = $3
     RETURNING *`,
    [resetToken, expires, email]
  );

  if (!user) return null;

  logger.info({ userId: user.id, email: user.email }, 'Password reset token generated');
  return { user, resetToken };
}

/**
 * Reset a user's password using a valid reset token.
 * Clears the token after use.
 * Returns the updated user or null if token is invalid/expired.
 */
export async function resetPasswordWithToken(token: string, newPassword: string): Promise<UserRecord | null> {
  if (!isDatabaseEnabled()) return null;

  const passwordHash = await bcrypt.hash(newPassword, 12);

  const user = await queryOne<UserRecord>(
    `UPDATE users
     SET password_hash = $1,
         password_reset_token = NULL,
         password_reset_expires = NULL,
         email_verified = TRUE
     WHERE password_reset_token = $2
       AND password_reset_expires > NOW()
     RETURNING *`,
    [passwordHash, token]
  );

  if (user) {
    logger.info({ userId: user.id, email: user.email }, 'Password reset successfully');
  }

  return user;
}

// =============================================================================
// Admin Seed
// =============================================================================

/**
 * Seed the admin user if it doesn't exist.
 * Called at startup.
 *
 * Reads credentials from env vars:
 *   ADMIN_USERNAME  (required to seed)
 *   ADMIN_PASSWORD  (required to seed)
 *   ADMIN_EMAIL     (optional, defaults to admin@keelo.dev)
 *
 * If neither ADMIN_USERNAME nor ADMIN_PASSWORD is set, seeding is skipped silently.
 */
export async function seedAdminUser(): Promise<void> {
  if (!isDatabaseEnabled()) return;

  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminUsername || !adminPassword) {
    logger.debug('ADMIN_USERNAME / ADMIN_PASSWORD not set — skipping admin seed');
    return;
  }

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@keelo.dev';

  try {
    const existing = await findUserByUsername(adminUsername);
    if (existing) {
      logger.debug({ username: adminUsername }, 'Admin user already exists');
      return;
    }

    await createUserWithPassword({
      username: adminUsername,
      password: adminPassword,
      email: adminEmail,
      name: adminUsername,
      role: 'admin',
    });

    logger.info({ username: adminUsername }, 'Admin user seeded successfully');
  } catch (error) {
    logger.error({ error }, 'Failed to seed admin user');
  }
}

