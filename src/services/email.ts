import nodemailer from 'nodemailer';
import dns from 'node:dns';
import { Resend } from 'resend';
import { logger } from '../config/index.js';

// =============================================================================
// Email Service Configuration
// =============================================================================
// Priority: RESEND_API_KEY (HTTP API, works everywhere) > SMTP (may be blocked)
// =============================================================================

// Resend config (recommended for cloud providers like Render)
const RESEND_API_KEY = process.env.RESEND_API_KEY;

// SMTP config (fallback)
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

// Shared config
const EMAIL_FROM = process.env.SMTP_FROM || process.env.EMAIL_FROM || `Keelo <onboarding@resend.dev>`;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Provider state
let emailProvider: 'resend' | 'smtp' | null = null;
let resendClient: Resend | null = null;
let smtpTransporter: nodemailer.Transporter | null = null;

// =============================================================================
// Initialization
// =============================================================================

/**
 * Initialize the email service.
 * Tries Resend first (HTTP API, no port restrictions), then SMTP as fallback.
 */
export async function initEmailService(): Promise<boolean> {
  // 1. Try Resend (HTTP-based — works on all cloud providers)
  if (RESEND_API_KEY) {
    try {
      resendClient = new Resend(RESEND_API_KEY);
      emailProvider = 'resend';
      logger.info('Email service initialized with Resend (HTTP API)');
      return true;
    } catch (error) {
      logger.error({ error: (error as Error).message }, 'Failed to initialize Resend');
    }
  }

  // 2. Fallback to SMTP
  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    try {
      // Resolve hostname to IPv4 to avoid IPv6 issues on cloud providers
      let smtpHost = SMTP_HOST;
      try {
        const ipv4 = await resolveIPv4(SMTP_HOST);
        logger.info({ originalHost: SMTP_HOST, resolvedIPv4: ipv4 }, 'Resolved SMTP host to IPv4');
        smtpHost = ipv4;
      } catch {
        logger.warn({ host: SMTP_HOST }, 'Could not resolve SMTP host to IPv4, using original hostname');
      }

      smtpTransporter = nodemailer.createTransport({
        host: smtpHost,
        port: SMTP_PORT,
        secure: SMTP_PORT === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
        name: SMTP_HOST,
        tls: { servername: SMTP_HOST },
      });

      // Verify connection (non-blocking — log result but don't fail)
      try {
        await smtpTransporter.verify();
        logger.info({ host: smtpHost, port: SMTP_PORT }, 'SMTP connection verified');
      } catch (verifyErr) {
        logger.error({ error: (verifyErr as Error).message }, 'SMTP verification failed — emails via SMTP may not work');
      }

      emailProvider = 'smtp';
      logger.info({ host: smtpHost, port: SMTP_PORT, user: SMTP_USER }, 'Email service initialized with SMTP');
      return true;
    } catch (error) {
      logger.error({ error: (error as Error).message }, 'Failed to initialize SMTP transport');
    }
  }

  logger.warn('No email provider configured. Set RESEND_API_KEY (recommended) or SMTP_HOST/SMTP_USER/SMTP_PASS');
  return false;
}

// =============================================================================
// Public API
// =============================================================================

export function isEmailEnabled(): boolean {
  return emailProvider !== null;
}

export async function verifyEmailConnection(): Promise<{ ok: boolean; error?: string }> {
  if (emailProvider === 'resend' && resendClient) {
    // Resend uses HTTP API, so we just check if the key is set
    return { ok: true };
  }

  if (emailProvider === 'smtp' && smtpTransporter) {
    try {
      await smtpTransporter.verify();
      return { ok: true };
    } catch (error) {
      return { ok: false, error: (error as Error).message };
    }
  }

  return { ok: false, error: 'No email provider configured' };
}

export function getEmailDiagnostics() {
  return {
    provider: emailProvider || 'none',
    configured: emailProvider !== null,
    resend: {
      apiKeySet: !!RESEND_API_KEY,
    },
    smtp: {
      host: SMTP_HOST || '(not set)',
      port: SMTP_PORT,
      user: SMTP_USER 
        ? `${SMTP_USER.substring(0, 3)}...${SMTP_USER.includes('@') ? '@' + SMTP_USER.split('@')[1] : ''}` 
        : '(not set)',
    },
    from: EMAIL_FROM,
    frontendUrl: FRONTEND_URL,
    baseUrl: process.env.BASE_URL || '(not set — will use localhost)',
  };
}

// =============================================================================
// Email Sending
// =============================================================================

async function sendMail(to: string, subject: string, html: string): Promise<boolean> {
  if (!emailProvider) {
    logger.warn({ to, subject }, 'Email not sent — no email provider configured');
    return false;
  }

  try {
    if (emailProvider === 'resend' && resendClient) {
      const { error } = await resendClient.emails.send({
        from: EMAIL_FROM,
        to: [to],
        subject,
        html,
      });

      if (error) {
        logger.error({ error, to, subject }, 'Resend: failed to send email');
        return false;
      }

      logger.info({ to, subject, provider: 'resend' }, 'Email sent successfully');
      return true;
    }

    if (emailProvider === 'smtp' && smtpTransporter) {
      const info = await smtpTransporter.sendMail({
        from: EMAIL_FROM,
        to,
        subject,
        html,
      });

      logger.info({ to, subject, messageId: info.messageId, provider: 'smtp' }, 'Email sent successfully');
      return true;
    }

    return false;
  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : error,
      to,
      subject,
      provider: emailProvider,
    }, 'Failed to send email');
    return false;
  }
}

/**
 * Send email verification link.
 */
export async function sendVerificationEmail(
  email: string,
  name: string,
  token: string,
): Promise<boolean> {
  const apiUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  const confirmUrl = `${apiUrl}/auth/confirm-email?token=${token}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background: #020617; color: #f1f5f9; }
    .container { max-width: 560px; margin: 0 auto; padding: 40px 24px; }
    .header { text-align: center; margin-bottom: 32px; }
    .logo { display: inline-block; background: linear-gradient(135deg, #34d399, #059669); border-radius: 12px; width: 48px; height: 48px; line-height: 48px; font-size: 24px; font-weight: bold; color: white; text-align: center; }
    .title { font-size: 24px; font-weight: 700; color: #f1f5f9; margin: 16px 0 4px; }
    .subtitle { color: #94a3b8; font-size: 14px; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 32px 24px; }
    .greeting { font-size: 16px; color: #e2e8f0; margin-bottom: 16px; }
    .text { font-size: 14px; color: #94a3b8; line-height: 1.6; margin-bottom: 24px; }
    .btn { display: inline-block; background: linear-gradient(135deg, #10b981, #059669); color: white !important; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; }
    .btn-wrapper { text-align: center; margin: 24px 0; }
    .small { font-size: 12px; color: #64748b; margin-top: 24px; line-height: 1.5; }
    .footer { text-align: center; margin-top: 32px; font-size: 12px; color: #475569; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">✓</div>
      <div class="title">Keelo</div>
      <div class="subtitle">QA Intelligence Platform</div>
    </div>
    <div class="card">
      <div class="greeting">Olá, ${name}! 👋</div>
      <div class="text">
        Obrigado por criar sua conta no Keelo. Para ativar sua conta e começar a usar a plataforma, confirme seu email clicando no botão abaixo:
      </div>
      <div class="btn-wrapper">
        <a href="${confirmUrl}" class="btn">Confirmar meu email</a>
      </div>
      <div class="small">
        Se o botão não funcionar, copie e cole este link no navegador:<br>
        <a href="${confirmUrl}" style="color: #10b981; word-break: break-all;">${confirmUrl}</a>
      </div>
      <div class="small">
        Este link expira em 24 horas. Se você não criou uma conta no Keelo, ignore este email.
      </div>
    </div>
    <div class="footer">
      © ${new Date().getFullYear()} Keelo — Autonomous QA Agent
    </div>
  </div>
</body>
</html>`;

  return sendMail(email, 'Confirme seu email — Keelo', html);
}

/**
 * Send password reset link.
 */
export async function sendPasswordResetEmail(
  email: string,
  name: string,
  token: string,
): Promise<boolean> {
  const resetUrl = `${FRONTEND_URL}/reset-password?token=${token}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background: #020617; color: #f1f5f9; }
    .container { max-width: 560px; margin: 0 auto; padding: 40px 24px; }
    .header { text-align: center; margin-bottom: 32px; }
    .logo { display: inline-block; background: linear-gradient(135deg, #34d399, #059669); border-radius: 12px; width: 48px; height: 48px; line-height: 48px; font-size: 24px; font-weight: bold; color: white; text-align: center; }
    .title { font-size: 24px; font-weight: 700; color: #f1f5f9; margin: 16px 0 4px; }
    .subtitle { color: #94a3b8; font-size: 14px; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 32px 24px; }
    .greeting { font-size: 16px; color: #e2e8f0; margin-bottom: 16px; }
    .text { font-size: 14px; color: #94a3b8; line-height: 1.6; margin-bottom: 24px; }
    .btn { display: inline-block; background: linear-gradient(135deg, #10b981, #059669); color: white !important; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; }
    .btn-wrapper { text-align: center; margin: 24px 0; }
    .small { font-size: 12px; color: #64748b; margin-top: 24px; line-height: 1.5; }
    .footer { text-align: center; margin-top: 32px; font-size: 12px; color: #475569; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">✓</div>
      <div class="title">Keelo</div>
      <div class="subtitle">QA Intelligence Platform</div>
    </div>
    <div class="card">
      <div class="greeting">Olá, ${name}! 👋</div>
      <div class="text">
        Recebemos uma solicitação para redefinir a senha da sua conta no Keelo. Clique no botão abaixo para criar uma nova senha:
      </div>
      <div class="btn-wrapper">
        <a href="${resetUrl}" class="btn">Redefinir minha senha</a>
      </div>
      <div class="small">
        Se o botão não funcionar, copie e cole este link no navegador:<br>
        <a href="${resetUrl}" style="color: #10b981; word-break: break-all;">${resetUrl}</a>
      </div>
      <div class="small">
        Este link expira em 1 hora. Se você não solicitou a redefinição de senha, ignore este email — sua conta permanece segura.
      </div>
    </div>
    <div class="footer">
      © ${new Date().getFullYear()} Keelo — Autonomous QA Agent
    </div>
  </div>
</body>
</html>`;

  return sendMail(email, 'Redefinir senha — Keelo', html);
}

// =============================================================================
// Helpers
// =============================================================================

async function resolveIPv4(hostname: string): Promise<string> {
  return new Promise((resolve, reject) => {
    dns.lookup(hostname, { family: 4 }, (err, address) => {
      if (err) reject(err);
      else resolve(address);
    });
  });
}

export { FRONTEND_URL };
