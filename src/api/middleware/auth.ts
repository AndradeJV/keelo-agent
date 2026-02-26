import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../../config/index.js';

// =============================================================================
// Types
// =============================================================================

export interface AuthUser {
  id: string;
  email: string;
  role: 'user' | 'admin';
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// =============================================================================
// JWT Helpers
// =============================================================================

const JWT_SECRET = process.env.JWT_SECRET || 'keelo-dev-secret-change-in-production';
const JWT_EXPIRY = '7d';

/** True when JWT_SECRET is NOT explicitly set — local dev / demo mode */
const IS_DEMO_MODE = !process.env.JWT_SECRET;

const DEMO_USER: AuthUser = {
  id: 'demo-user',
  email: 'demo@keelo.dev',
  role: 'admin',
};

export function signToken(payload: AuthUser): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    return decoded;
  } catch {
    return null;
  }
}

// =============================================================================
// Auth Middleware
// =============================================================================

/**
 * Middleware that requires a valid JWT token.
 * Extracts user info and attaches to req.user.
 * 
 * In demo mode (JWT_SECRET not set), allows unauthenticated access
 * with a demo admin user for local development.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // Demo mode: allow unauthenticated access with admin privileges
    if (IS_DEMO_MODE) {
      req.user = DEMO_USER;
      return next();
    }
    res.status(401).json({ error: 'Token de autenticação não fornecido' });
    return;
  }

  const token = authHeader.substring(7);

  // Demo mode: accept 'demo-token' as valid
  if (IS_DEMO_MODE && token === 'demo-token') {
    req.user = DEMO_USER;
    return next();
  }

  const user = verifyToken(token);

  if (!user) {
    res.status(401).json({ error: 'Token inválido ou expirado' });
    return;
  }

  req.user = user;
  next();
}

/**
 * Optional auth middleware — attaches user if token is present but doesn't reject.
 * Useful for endpoints that work with or without auth.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);

    if (IS_DEMO_MODE && token === 'demo-token') {
      req.user = DEMO_USER;
      return next();
    }

    const user = verifyToken(token);
    if (user) {
      req.user = user;
    }
  } else if (IS_DEMO_MODE) {
    // In demo mode, always attach demo user
    req.user = DEMO_USER;
  }

  next();
}

/**
 * Middleware that requires admin role.
 * Must be used AFTER requireAuth.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Autenticação necessária' });
    return;
  }

  if (req.user.role !== 'admin') {
    logger.warn({ userId: req.user.id, email: req.user.email }, 'Non-admin user attempted admin action');
    res.status(403).json({ error: 'Acesso restrito a administradores' });
    return;
  }

  next();
}

