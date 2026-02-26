import { Router, Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { logger } from '../../config/index.js';
import { upsertUser, isDatabaseEnabled } from '../../database/index.js';
import { signToken, requireAuth } from '../middleware/auth.js';

// =============================================================================
// Google OAuth Client
// =============================================================================

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  'postmessage' // Required for auth-code flow from @react-oauth/google
) : null;

// =============================================================================
// Router
// =============================================================================

const router = Router();

/**
 * POST /auth/google
 * 
 * Accepts either:
 * - { code: string } — authorization code from Google Sign-In (auth-code flow)
 * - { idToken: string } — ID token from Google Sign-In (implicit flow)
 * 
 * Verifies with Google, creates/updates user in DB, returns JWT.
 */
router.post('/google', async (req: Request, res: Response) => {
  try {
    const { code, idToken } = req.body;

    if (!code && !idToken) {
      return res.status(400).json({ error: 'code ou idToken é obrigatório' });
    }

    if (!googleClient || !GOOGLE_CLIENT_ID) {
      logger.error('GOOGLE_CLIENT_ID not configured');
      return res.status(503).json({ error: 'Google OAuth não configurado no servidor' });
    }

    if (!isDatabaseEnabled()) {
      return res.status(503).json({ error: 'Banco de dados não disponível' });
    }

    let googleId: string;
    let email: string;
    let name: string | undefined;
    let picture: string | undefined;

    if (code) {
      // Auth-code flow: exchange code for tokens
      const { tokens } = await googleClient.getToken(code);
      const idTokenStr = tokens.id_token;

      if (!idTokenStr) {
        return res.status(401).json({ error: 'Não foi possível obter ID token do Google' });
      }

      const ticket = await googleClient.verifyIdToken({
        idToken: idTokenStr,
        audience: GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.sub || !payload.email) {
        return res.status(401).json({ error: 'Token Google inválido' });
      }

      googleId = payload.sub;
      email = payload.email;
      name = payload.name;
      picture = payload.picture;
    } else {
      // Implicit flow: verify ID token directly
      const ticket = await googleClient.verifyIdToken({
        idToken: idToken as string,
        audience: GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.sub || !payload.email) {
        return res.status(401).json({ error: 'Token Google inválido' });
      }

      googleId = payload.sub;
      email = payload.email;
      name = payload.name;
      picture = payload.picture;
    }

    // Create or update user
    const user = await upsertUser({
      googleId,
      email,
      name,
      avatar: picture,
    });

    // Generate JWT
    const token = signToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        role: user.role,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Google auth failed');

    if (error instanceof Error && error.message.includes('Token used too late')) {
      return res.status(401).json({ error: 'Token Google expirado. Tente novamente.' });
    }

    res.status(401).json({
      error: 'Falha na autenticação com Google',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

/**
 * GET /auth/me
 * 
 * Returns the authenticated user's profile.
 */
router.get('/me', requireAuth, (req: Request, res: Response) => {
  res.json({
    success: true,
    user: req.user,
  });
});

export default router;
