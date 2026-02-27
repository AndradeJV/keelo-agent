import { Router, Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { logger } from '../../config/index.js';
import {
  upsertUser,
  upsertGithubUser,
  isDatabaseEnabled,
  findUserByUsername,
  findUserByEmail,
  verifyPassword,
  registerUserWithEmail,
  confirmUserEmail,
  regenerateVerificationToken,
} from '../../database/index.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { sendVerificationEmail, isEmailEnabled, verifyEmailConnection, getEmailDiagnostics, FRONTEND_URL } from '../../services/email.js';

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
// GitHub OAuth Config
// =============================================================================

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

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
 * POST /auth/github
 * 
 * Exchange GitHub OAuth code for user info, create/update user, return JWT.
 * Accepts { code: string }
 */
router.post('/github', async (req: Request, res: Response) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'code é obrigatório' });
    }

    if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
      logger.error('GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET not configured');
      return res.status(503).json({ error: 'GitHub OAuth não configurado no servidor' });
    }

    if (!isDatabaseEnabled()) {
      return res.status(503).json({ error: 'Banco de dados não disponível' });
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const tokenData = await tokenResponse.json() as { access_token?: string; error?: string; error_description?: string };

    if (!tokenData.access_token) {
      logger.error({ error: tokenData.error }, 'GitHub token exchange failed');
      return res.status(401).json({
        error: 'Falha ao trocar código GitHub',
        details: tokenData.error_description || tokenData.error,
      });
    }

    // Get user info from GitHub
    const [userResponse, emailsResponse] = await Promise.all([
      fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: 'application/json' },
      }),
      fetch('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: 'application/json' },
      }),
    ]);

    const githubUser = await userResponse.json() as {
      id: number;
      login: string;
      name?: string;
      avatar_url?: string;
      email?: string;
    };

    // Get primary email (GitHub may not include it in /user)
    let email = githubUser.email;
    if (!email) {
      const emails = await emailsResponse.json() as Array<{ email: string; primary: boolean; verified: boolean }>;
      const primaryEmail = emails.find(e => e.primary && e.verified);
      email = primaryEmail?.email || emails.find(e => e.verified)?.email;
    }

    if (!email) {
      return res.status(400).json({
        error: 'Não foi possível obter email do GitHub. Verifique se seu email está público ou autorize acesso ao email.',
      });
    }

    // Create or update user
    const user = await upsertGithubUser({
      githubId: String(githubUser.id),
      email,
      name: githubUser.name || githubUser.login,
      avatar: githubUser.avatar_url,
    });

    // Generate JWT
    const token = signToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    logger.info({ userId: user.id, email: user.email, githubLogin: githubUser.login }, 'GitHub login successful');

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
    logger.error({ error }, 'GitHub auth failed');
    res.status(401).json({
      error: 'Falha na autenticação com GitHub',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

/**
 * POST /auth/register
 * 
 * Register a new user with email and password.
 * Sends a verification email.
 * Accepts { email: string, password: string, name: string }
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Formato de email inválido' });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({ error: 'A senha deve ter pelo menos 8 caracteres' });
    }

    if (!isDatabaseEnabled()) {
      return res.status(503).json({ error: 'Banco de dados não disponível' });
    }

    // Register user
    const { user, verificationToken } = await registerUserWithEmail({ email, password, name });

    // Send verification email
    if (isEmailEnabled()) {
      const sent = await sendVerificationEmail(email, name, verificationToken);
      if (!sent) {
        logger.warn({ email }, 'Failed to send verification email, but user was created');
      }
    } else {
      logger.warn({ email }, 'Email service not configured — user needs manual verification or SMTP setup');
    }

    res.status(201).json({
      success: true,
      message: isEmailEnabled()
        ? 'Conta criada! Verifique seu email para ativar sua conta.'
        : 'Conta criada! Contate o administrador para ativar sua conta (serviço de email não configurado).',
      emailSent: isEmailEnabled(),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'EMAIL_EXISTS') {
      return res.status(409).json({ error: 'Este email já está cadastrado' });
    }

    logger.error({ error }, 'Registration failed');
    res.status(500).json({
      error: 'Falha no cadastro',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

/**
 * GET /auth/confirm-email?token=xxx
 * 
 * Confirms a user's email and redirects to the login page.
 */
router.get('/confirm-email', async (req: Request, res: Response) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.redirect(`${FRONTEND_URL}/login?error=Token inválido`);
    }

    const user = await confirmUserEmail(token);

    if (!user) {
      return res.redirect(`${FRONTEND_URL}/login?error=Token expirado ou inválido. Solicite um novo email de confirmação.`);
    }

    logger.info({ userId: user.id, email: user.email }, 'Email confirmed via link');
    return res.redirect(`${FRONTEND_URL}/login?confirmed=true`);
  } catch (error) {
    logger.error({ error }, 'Email confirmation failed');
    return res.redirect(`${FRONTEND_URL}/login?error=Erro ao confirmar email`);
  }
});

/**
 * POST /auth/resend-verification
 * 
 * Resend the verification email.
 * Accepts { email: string }
 */
router.post('/resend-verification', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email é obrigatório' });
    }

    if (!isEmailEnabled()) {
      return res.status(503).json({ error: 'Serviço de email não configurado' });
    }

    const result = await regenerateVerificationToken(email);

    if (!result) {
      // Don't reveal if the email exists or is already verified
      return res.json({ success: true, message: 'Se o email estiver cadastrado, um novo link será enviado.' });
    }

    await sendVerificationEmail(result.user.email, result.user.name || 'Usuário', result.verificationToken);

    res.json({ success: true, message: 'Email de verificação reenviado.' });
  } catch (error) {
    logger.error({ error }, 'Resend verification failed');
    res.status(500).json({ error: 'Falha ao reenviar email' });
  }
});

/**
 * POST /auth/login
 * 
 * Username/password or email/password login.
 * Accepts { username: string, password: string } or { email: string, password: string }
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body;

    const identifier = username || email;

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Usuário/email e senha são obrigatórios' });
    }

    if (!isDatabaseEnabled()) {
      return res.status(503).json({ error: 'Banco de dados não disponível' });
    }

    // Try to find user by username or email
    let user = await findUserByUsername(identifier);
    if (!user) {
      user = await findUserByEmail(identifier);
    }

    if (!user) {
      return res.status(401).json({ error: 'Usuário ou senha inválidos' });
    }

    const valid = await verifyPassword(user, password);

    if (!valid) {
      return res.status(401).json({ error: 'Usuário ou senha inválidos' });
    }

    // Check email verification (skip for admin users)
    if (!user.email_verified && user.role !== 'admin') {
      return res.status(403).json({
        error: 'Email não verificado. Verifique sua caixa de entrada.',
        code: 'EMAIL_NOT_VERIFIED',
        email: user.email,
      });
    }

    // Generate JWT
    const token = signToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    logger.info({ userId: user.id, username: user.username || user.email }, 'Login successful');

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
    logger.error({ error }, 'Login failed');
    res.status(500).json({
      error: 'Falha no login',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

/**
 * GET /auth/github/config
 * 
 * Returns GitHub OAuth client ID for frontend to initiate the flow.
 */
router.get('/github/config', (_req: Request, res: Response) => {
  res.json({
    clientId: GITHUB_CLIENT_ID || null,
    configured: !!GITHUB_CLIENT_ID,
  });
});

/**
 * GET /auth/email-diagnostics
 * 
 * Returns email service diagnostics (for debugging).
 * Tests SMTP connection.
 */
router.get('/email-diagnostics', async (_req: Request, res: Response) => {
  const diagnostics = getEmailDiagnostics();
  const verification = await verifyEmailConnection();

  res.json({
    ...diagnostics,
    smtpConnection: verification,
  });
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
