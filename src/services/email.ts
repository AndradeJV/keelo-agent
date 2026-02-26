import nodemailer from 'nodemailer';
import { logger } from '../config/index.js';

// =============================================================================
// Email Service Configuration
// =============================================================================

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || `Keelo <${SMTP_USER || 'noreply@keelo.dev'}>`;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

let transporter: nodemailer.Transporter | null = null;

/**
 * Initialize the email transporter.
 * Returns true if email is configured and ready.
 */
export function initEmailService(): boolean {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    logger.warn('SMTP not configured (SMTP_HOST, SMTP_USER, SMTP_PASS) — email sending disabled');
    return false;
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  logger.info({ host: SMTP_HOST, port: SMTP_PORT, user: SMTP_USER }, 'Email service initialized');
  return true;
}

/**
 * Check if email service is available.
 */
export function isEmailEnabled(): boolean {
  return transporter !== null;
}

/**
 * Send an email.
 */
async function sendMail(to: string, subject: string, html: string): Promise<boolean> {
  if (!transporter) {
    logger.warn({ to, subject }, 'Email not sent — SMTP not configured');
    return false;
  }

  try {
    await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject,
      html,
    });
    logger.info({ to, subject }, 'Email sent successfully');
    return true;
  } catch (error) {
    logger.error({ error, to, subject }, 'Failed to send email');
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

export { FRONTEND_URL };

