import nodemailer from 'nodemailer';
import { config } from '../config/env.js';

// Create reusable transporter
let transporter: nodemailer.Transporter | null = null;

/** Returns false if SMTP is not configured (no emails will be sent). Set SMTP_USER, SMTP_PASSWORD, FROM_EMAIL in production. */
function isEmailConfigured(): boolean {
  return !!(config.smtp.user && config.smtp.password && config.smtp.fromEmail);
}

/** Call at startup or for debugging: returns status and list of missing vars. */
export function getEmailConfigStatus(): { configured: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!config.smtp.user) missing.push('SMTP_USER');
  if (!config.smtp.password) missing.push('SMTP_PASSWORD');
  if (!config.smtp.fromEmail) missing.push('FROM_EMAIL');
  return { configured: missing.length === 0, missing };
}

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: config.smtp.user && config.smtp.password
        ? { user: config.smtp.user, pass: config.smtp.password }
        : undefined,
    });
  }
  return transporter;
}

function logEmailError(context: string, error: unknown): void {
  const err = error as { message?: string; code?: string; response?: string; responseCode?: number };
  console.error(`[Email] ${context}:`, err?.message ?? error);
  if (err?.code) console.error('[Email] code:', err.code);
  if (err?.response) console.error('[Email] response:', err.response);
  if (err?.responseCode) console.error('[Email] responseCode:', err.responseCode);
}

function formatConfidence(val: number | null): string {
  if (val == null) return '—';
  const pct = typeof val === 'number' && val <= 1 ? Math.round(val * 100) : val;
  return `${pct}%`;
}

/**
 * Send welcome email to new users (on sign up).
 * Requires SMTP_USER, SMTP_PASSWORD, FROM_EMAIL to be set in env.
 */
export async function sendWelcomeEmail(
  userEmail: string,
  userName: string
): Promise<void> {
  if (!isEmailConfigured()) {
    const { missing } = getEmailConfigStatus();
    console.warn('⚠️ SMTP not configured. Missing:', missing.join(', '), '— skipping welcome email.');
    return;
  }
  try {
    const transporter = getTransporter();
    const frontendUrl = config.frontendUrl;
    const year = new Date().getFullYear();

    const mailOptions = {
      from: `"Aegis AI" <${config.smtp.fromEmail}>`,
      to: userEmail,
      subject: 'Welcome to Aegis AI — Your Intelligent Document Assistant',
      html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Aegis AI</title>
</head>
<body style="margin:0; padding:0; background: linear-gradient(145deg, #0f172a 0%, #1e293b 100%); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <tr>
      <td style="text-align: center; padding-bottom: 32px;">
        <table align="center" cellpadding="0" cellspacing="0">
          <tr>
            <td style="background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); padding: 14px 20px; border-radius: 14px;">
              <span style="font-size: 22px; font-weight: 800; color: #fff; letter-spacing: -0.02em;">🛡️ Aegis AI</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="background: rgba(30, 41, 59, 0.8); border-radius: 20px; padding: 40px 36px; border: 1px solid rgba(255,255,255,0.08);">
        <h1 style="margin: 0 0 8px 0; font-size: 26px; font-weight: 800; color: #f1f5f9; letter-spacing: -0.03em;">Welcome, ${userName.replace(/</g, '&lt;')}!</h1>
        <p style="margin: 0 0 28px 0; font-size: 16px; color: #94a3b8; line-height: 1.6;">Thank you for signing up. You're ready to analyze documents with AI — upload, chat, and get risk insights in one place.</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
          <tr><td style="height: 1px; background: linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.4), transparent);"></td></tr>
        </table>
        <p style="margin: 0 0 16px 0; font-size: 13px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.06em;">What you can do</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 12px;">
          <tr><td style="background: rgba(59, 130, 246, 0.1); border-left: 4px solid #3b82f6; border-radius: 0 10px 10px 0; padding: 14px 18px;">
            <strong style="color: #e2e8f0;">📄 Upload &amp; analyze</strong><br/>
            <span style="color: #94a3b8; font-size: 14px;">PDFs, Word, Excel — automatic risk and compliance analysis.</span>
          </td></tr>
        </table>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 12px;">
          <tr><td style="background: rgba(59, 130, 246, 0.08); border-left: 4px solid #8b5cf6; border-radius: 0 10px 10px 0; padding: 14px 18px;">
            <strong style="color: #e2e8f0;">🤖 Chat with documents</strong><br/>
            <span style="color: #94a3b8; font-size: 14px;">Ask questions and get answers with citations.</span>
          </td></tr>
        </table>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 12px;">
          <tr><td style="background: rgba(59, 130, 246, 0.08); border-left: 4px solid #10b981; border-radius: 0 10px 10px 0; padding: 14px 18px;">
            <strong style="color: #e2e8f0;">📱 Mobile</strong><br/>
            <span style="color: #94a3b8; font-size: 14px;">Scan with camera, voice queries, offline support.</span>
          </td></tr>
        </table>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 32px;">
          <tr>
            <td align="center">
              <a href="${frontendUrl}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); color: #fff; padding: 16px 32px; text-decoration: none; font-weight: 700; font-size: 15px; border-radius: 12px;">Get started</a>
            </td>
          </tr>
        </table>
        <p style="margin: 28px 0 0 0; font-size: 12px; color: #64748b; text-align: center;">You're receiving this because you signed up for Aegis AI.</p>
      </td>
    </tr>
    <tr><td style="padding: 24px 0; text-align: center; color: #64748b; font-size: 12px;">© ${year} Aegis AI</td></tr>
  </table>
</body>
</html>`,
      text: `Welcome to Aegis AI, ${userName}!\n\nThank you for signing up. Get started: ${frontendUrl}\n\n© ${year} Aegis AI.`,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Welcome email sent to ${userEmail}`);
  } catch (error) {
    logEmailError('welcome email', error);
  }
}

/**
 * Send document upload confirmation email with shared link and full details.
 * Requires SMTP_USER, SMTP_PASSWORD, FROM_EMAIL. Uses shared document URL so recipient can open without logging in.
 */
export async function sendDocumentUploadEmail(
  userEmail: string,
  userName: string,
  documentName: string,
  documentId: string,
  riskLevel: string,
  riskCategory: string | null,
  riskConfidence: number | null,
  riskExplanation: string | null,
  recommendations: string[],
  numPages: number,
  numChunks: number
): Promise<void> {
  if (!isEmailConfigured()) {
    const { missing } = getEmailConfigStatus();
    console.warn('⚠️ SMTP not configured. Missing:', missing.join(', '), '— skipping document upload email.');
    return;
  }
  try {
    const transporter = getTransporter();
    const frontendUrl = config.frontendUrl;
    const sharedDocumentUrl = `${frontendUrl}/document/${documentId}`;
    const confidenceStr = formatConfidence(riskConfidence);
    const year = new Date().getFullYear();

    const riskColor = riskLevel === 'Critical' ? '#ef4444' : riskLevel === 'Warning' ? '#f59e0b' : '#10b981';
    const riskBg = riskLevel === 'Critical' ? 'rgba(239, 68, 68, 0.15)' : riskLevel === 'Warning' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(34, 197, 94, 0.15)';

    const safeName = (documentName || 'Document').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const safeExplanation = (riskExplanation || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const recList = (recommendations || []).map(r => `<li style="margin-bottom:6px; color:#94a3b8;">${(r || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</li>`).join('');

    const mailOptions = {
      from: `"Aegis AI" <${config.smtp.fromEmail}>`,
      to: userEmail,
      subject: `Document analyzed: ${documentName}`,
      html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document analysis complete</title>
</head>
<body style="margin:0; padding:0; background: linear-gradient(145deg, #0f172a 0%, #1e293b 100%); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <tr>
      <td style="text-align: center; padding-bottom: 24px;">
        <table align="center" cellpadding="0" cellspacing="0">
          <tr>
            <td style="background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); padding: 12px 18px; border-radius: 12px;">
              <span style="font-size: 18px; font-weight: 800; color: #fff;">🛡️ Aegis AI</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="background: rgba(30, 41, 59, 0.9); border-radius: 20px; padding: 36px 32px; border: 1px solid rgba(255,255,255,0.08);">
        <h1 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 800; color: #f1f5f9;">Document analysis complete</h1>
        <p style="margin: 0 0 24px 0; font-size: 15px; color: #94a3b8;">Hi ${(userName || 'User').replace(/</g, '&lt;')}, here are the details for your uploaded document.</p>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px; background: rgba(15, 23, 42, 0.6); border-radius: 14px; border: 1px solid rgba(255,255,255,0.06);">
          <tr><td style="padding: 20px 20px 12px 20px;">
            <p style="margin: 0 0 16px 0; font-size: 16px; font-weight: 700; color: #e2e8f0;">📄 ${safeName}</p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.06);"><span style="color: #94a3b8; font-size: 13px;">Risk level</span></td><td style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.06); text-align: right;"><span style="font-weight: 600; color: ${riskColor};">${riskLevel}</span></td></tr>
              <tr><td style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.06);"><span style="color: #94a3b8; font-size: 13px;">Category</span></td><td style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.06); text-align: right; color: #e2e8f0;">${riskCategory && riskCategory !== 'None' ? riskCategory.replace(/</g, '&lt;').replace(/>/g, '&gt;') : '—'}</td></tr>
              <tr><td style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.06);"><span style="color: #94a3b8; font-size: 13px;">Confidence</span></td><td style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.06); text-align: right; color: #e2e8f0;">${confidenceStr}</td></tr>
              <tr><td style="padding: 8px 0;"><span style="color: #94a3b8; font-size: 13px;">Pages / chunks</span></td><td style="padding: 8px 0; text-align: right; color: #e2e8f0;">${numPages} / ${numChunks}</td></tr>
            </table>
          </td></tr>
        </table>

        ${riskExplanation ? `
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px; background: ${riskBg}; border-radius: 14px; border-left: 4px solid ${riskColor};">
          <tr><td style="padding: 18px 20px;">
            <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Why this status</p>
            <p style="margin: 0; font-size: 14px; color: #cbd5e1; line-height: 1.5;">${safeExplanation}</p>
          </td></tr>
        </table>
        ` : ''}

        ${recList ? `
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px; background: rgba(59, 130, 246, 0.08); border-radius: 14px; border: 1px solid rgba(59, 130, 246, 0.2);">
          <tr><td style="padding: 18px 20px;">
            <p style="margin: 0 0 12px 0; font-size: 13px; font-weight: 700; color: #e2e8f0;">💡 Recommendations</p>
            <ul style="margin: 0; padding-left: 20px; color: #94a3b8; font-size: 14px; line-height: 1.5;">${recList}</ul>
          </td></tr>
        </table>
        ` : ''}

        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
          <tr>
            <td align="center" style="padding: 20px; background: rgba(59, 130, 246, 0.1); border-radius: 14px; border: 1px dashed rgba(59, 130, 246, 0.3);">
              <p style="margin: 0 0 12px 0; font-size: 12px; color: #94a3b8;">Share this link — anyone can view the analysis (no login required)</p>
              <a href="${sharedDocumentUrl}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); color: #fff; padding: 14px 28px; text-decoration: none; font-weight: 700; font-size: 15px; border-radius: 12px;">View document details</a>
              <p style="margin: 12px 0 0 0; font-size: 11px; color: #64748b; word-break: break-all;">${sharedDocumentUrl}</p>
            </td>
          </tr>
        </table>

        <p style="margin: 0; font-size: 12px; color: #64748b; text-align: center;">You can also chat with this document and get explanations in the app.</p>
      </td>
    </tr>
    <tr><td style="padding: 20px 0; text-align: center; color: #64748b; font-size: 12px;">© ${year} Aegis AI</td></tr>
  </table>
</body>
</html>`,
      text: `Document analysis complete\n\nHi ${userName},\n\nDocument: ${documentName}\nRisk level: ${riskLevel}\nCategory: ${riskCategory || '—'}\nConfidence: ${confidenceStr}\nPages/chunks: ${numPages} / ${numChunks}\n${riskExplanation ? `\nWhy this status: ${riskExplanation}\n` : ''}${recommendations?.length ? `\nRecommendations:\n${recommendations.map(r => `- ${r}`).join('\n')}\n` : ''}\nView document (shareable link): ${sharedDocumentUrl}\n\n© ${year} Aegis AI`,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Document upload email sent to ${userEmail} for document: ${documentName}`);
  } catch (error) {
    logEmailError('document upload email', error);
  }
}

/**
 * Verify SMTP connection (useful at startup or for health checks).
 * Logs clearly if not configured or if connection fails.
 */
export async function verifySMTPConnection(): Promise<boolean> {
  const { configured, missing } = getEmailConfigStatus();
  if (!configured) {
    console.warn('⚠️ SMTP not configured. Missing:', missing.join(', '));
    return false;
  }
  try {
    const t = getTransporter();
    await t.verify();
    console.log('✅ SMTP connection verified');
    return true;
  } catch (error) {
    logEmailError('SMTP verify', error);
    return false;
  }
}
