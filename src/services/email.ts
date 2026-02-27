import nodemailer from 'nodemailer';
import dns from 'node:dns';
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
 * Resolve a hostname to its IPv4 address.
 * Cloud providers like Render don't support IPv6 outbound, so smtp.gmail.com
 * (which resolves to IPv6 first) fails with ENETUNREACH.
 */
async function resolveIPv4(hostname: string): Promise<string> {
  return new Promise((resolve, reject) => {
    dns.lookup(hostname, { family: 4 }, (err, address) => {
      if (err) {
        reject(err);
      } else {
        resolve(address);
      }
    });
  });
}

/**
 * Initialize the email transporter.
 * Returns true if email is configured and ready.
 */
export async function initEmailService(): Promise<boolean> {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    logger.warn('SMTP not configured (SMTP_HOST, SMTP_USER, SMTP_PASS) — email sending disabled');
    return false;
  }

  try {
    // Resolve hostname to IPv4 to avoid IPv6 issues on cloud providers (Render, etc.)
    let smtpHost = SMTP_HOST;
    try {
      const ipv4 = await resolveIPv4(SMTP_HOST);
      logger.info({ originalHost: SMTP_HOST, resolvedIPv4: ipv4 }, 'Resolved SMTP host to IPv4');
      smtpHost = ipv4;
    } catch (dnsErr) {
      logger.warn({ host: SMTP_HOST, error: (dnsErr as Error).message }, 'Could not resolve SMTP host to IPv4, using original hostname');
    }

    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
      // Send the original hostname in EHLO/HELO, not the IP
      name: SMTP_HOST,
      tls: {
        // Gmail expects the certificate to match smtp.gmail.com, not the IP
        servername: SMTP_HOST,
      },
    });

    // Verify SMTP connection at startup
    try {
      await transporter.verify();
      logger.info({ host: smtpHost, port: SMTP_PORT, user: SMTP_USER }, 'Email service initialized and SMTP connection verified');
    } catch (verifyErr) {
      logger.error({ error: (verifyErr as Error).message, host: smtpHost, port: SMTP_PORT }, 'SMTP connection verification failed — emails may not work');
    }

    return true;
  } catch (error) {
    logger.error({ error: (error as Error).message }, 'Failed to initialize email service');
    return false;
  }
}

/**
 * Check if email service is available.
 */
export function isEmailEnabled(): boolean {
  return transporter !== null;
}

/**
 * Verify SMTP connection is working.
 */
export async function verifyEmailConnection(): Promise<{ ok: boolean; error?: string }> {
  if (!transporter) {
    return { ok: false, error: 'SMTP not configured (missing SMTP_HOST, SMTP_USER, or SMTP_PASS)' };
  }

  try {
    await transporter.verify();
    return { ok: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error: msg }, 'SMTP connection verification failed');
    return { ok: false, error: msg };
  }
}

/**
 * Get email service diagnostic info (no sensitive data).
 */
export function getEmailDiagnostics() {
  return {
    configured: !!SMTP_HOST && !!SMTP_USER && !!SMTP_PASS,
    host: SMTP_HOST || '(not set)',
    port: SMTP_PORT,
    user: SMTP_USER ? `${SMTP_USER.substring(0, 3)}...${SMTP_USER.includes('@') ? '@' + SMTP_USER.split('@')[1] : ''}` : '(not set)',
    from: SMTP_FROM,
    frontendUrl: FRONTEND_URL,
    baseUrl: process.env.BASE_URL || '(not set — will use localhost)',
    transporterReady: transporter !== null,
  };
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
    const info = await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject,
      html,
    });
    logger.info({ to, subject, messageId: info.messageId, response: info.response }, 'Email sent successfully');
    return true;
  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : error, 
      to, 
      subject,
      smtpHost: SMTP_HOST,
      smtpPort: SMTP_PORT,
      smtpUser: SMTP_USER,
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

export { FRONTEND_URL };
