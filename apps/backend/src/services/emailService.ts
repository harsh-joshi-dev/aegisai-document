import nodemailer from 'nodemailer';
import { config } from '../config/env.js';

// Create reusable transporter
let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: false, // true for 465, false for other ports
      auth: {
        user: config.smtp.user,
        pass: config.smtp.password,
      },
    });
  }
  return transporter;
}

/**
 * Send welcome email to new users
 */
export async function sendWelcomeEmail(
  userEmail: string,
  userName: string
): Promise<void> {
  try {
    const transporter = getTransporter();
    const frontendUrl = config.frontendUrl;
    
    const mailOptions = {
      from: `"Aegis AI" <${config.smtp.fromEmail}>`,
      to: userEmail,
      subject: 'Welcome to Aegis AI - Your Intelligent Document Assistant',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f5f5f5;
            }
            .container {
              background-color: #ffffff;
              border-radius: 8px;
              padding: 40px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .logo {
              font-size: 32px;
              font-weight: bold;
              color: #2563eb;
              margin-bottom: 10px;
            }
            .title {
              font-size: 24px;
              font-weight: 600;
              color: #1f2937;
              margin-bottom: 20px;
            }
            .content {
              color: #4b5563;
              margin-bottom: 30px;
            }
            .feature {
              background-color: #f9fafb;
              padding: 15px;
              border-radius: 6px;
              margin-bottom: 15px;
              border-left: 4px solid #2563eb;
            }
            .feature-title {
              font-weight: 600;
              color: #1f2937;
              margin-bottom: 5px;
            }
            .feature-description {
              color: #6b7280;
              font-size: 14px;
            }
            .cta-button {
              display: inline-block;
              background-color: #2563eb;
              color: #ffffff;
              padding: 12px 24px;
              text-decoration: none;
              border-radius: 6px;
              font-weight: 600;
              margin: 20px 0;
              text-align: center;
            }
            .mobile-app {
              background-color: #f0fdf4;
              border: 1px solid #10b981;
              border-radius: 6px;
              padding: 20px;
              margin: 20px 0;
            }
        .mobile-app-title {
          font-weight: 600;
          color: #059669;
          margin-bottom: 10px;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
          color: #9ca3af;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">🛡️ Aegis AI</div>
          <h1 class="title">Welcome, ${userName}!</h1>
        </div>
        
        <div class="content">
          <p>Thank you for joining Aegis AI! We're excited to help you manage and analyze your documents with the power of artificial intelligence.</p>
          
          <h2 style="color: #1f2937; font-size: 20px; margin-top: 30px;">What You Can Do:</h2>
          
          <div class="feature">
            <div class="feature-title">📄 Document Upload & Analysis</div>
            <div class="feature-description">Upload PDFs, Word documents, Excel files, and more. Our AI automatically analyzes your documents for risks, compliance issues, and important information.</div>
          </div>
          
          <div class="feature">
            <div class="feature-title">🤖 Intelligent Chat Assistant</div>
            <div class="feature-description">Ask questions about your documents and get instant answers with citations. Our AI understands context and provides accurate information.</div>
          </div>
          
          <div class="feature">
            <div class="feature-title">⚠️ Risk Classification</div>
            <div class="feature-description">Automatically identify critical, warning, or normal risk levels in your documents. Get detailed explanations and recommendations.</div>
          </div>
          
          <div class="feature">
            <div class="feature-title">🌍 Multi-Language Support</div>
            <div class="feature-description">Get document explanations and chat responses in your preferred language, including English, Hindi, Gujarati, and more.</div>
          </div>
          
          <div class="feature">
            <div class="feature-title">🏢 Solution Providers</div>
            <div class="feature-description">For critical documents, we help you find relevant professionals (lawyers, accountants, doctors, etc.) in your area.</div>
          </div>
          
          <div class="mobile-app">
            <div class="mobile-app-title">📱 Download Our Mobile App</div>
            <p style="color: #047857; margin: 10px 0;">Take Aegis AI with you wherever you go! Our mobile app offers:</p>
            <ul style="color: #047857; margin: 10px 0; padding-left: 20px;">
              <li>📸 Scan documents with your camera</li>
              <li>📴 Offline document analysis</li>
              <li>🎤 Voice queries and responses</li>
              <li>🔔 Push notifications for important updates</li>
            </ul>
            <p style="color: #047857; margin-top: 15px;">
              <strong>Download now:</strong> <a href="${frontendUrl}/mobile" style="color: #059669; text-decoration: underline;">Get the Mobile App</a>
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${frontendUrl}" class="cta-button">Get Started Now</a>
          </div>
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            If you have any questions or need help, feel free to reach out to our support team. We're here to help!
          </p>
        </div>
        
        <div class="footer">
          <p>© ${new Date().getFullYear()} Aegis AI. All rights reserved.</p>
          <p>You're receiving this email because you signed up for Aegis AI.</p>
        </div>
      </div>
    </body>
    </html>
      `,
      text: `
Welcome to Aegis AI, ${userName}!

Thank you for joining Aegis AI! We're excited to help you manage and analyze your documents with the power of artificial intelligence.

What You Can Do:

📄 Document Upload & Analysis
Upload PDFs, Word documents, Excel files, and more. Our AI automatically analyzes your documents for risks, compliance issues, and important information.

🤖 Intelligent Chat Assistant
Ask questions about your documents and get instant answers with citations. Our AI understands context and provides accurate information.

⚠️ Risk Classification
Automatically identify critical, warning, or normal risk levels in your documents. Get detailed explanations and recommendations.

🌍 Multi-Language Support
Get document explanations and chat responses in your preferred language, including English, Hindi, Gujarati, and more.

🏢 Solution Providers
For critical documents, we help you find relevant professionals (lawyers, accountants, doctors, etc.) in your area.

📱 Download Our Mobile App
Take Aegis AI with you wherever you go! Our mobile app offers:
- Scan documents with your camera
- Offline document analysis
- Voice queries and responses
- Push notifications for important updates

Download now: ${frontendUrl}/mobile

Get started: ${frontendUrl}

If you have any questions or need help, feel free to reach out to our support team.

© ${new Date().getFullYear()} Aegis AI. All rights reserved.
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Welcome email sent to ${userEmail}`);
  } catch (error) {
    console.error('Error sending welcome email:', error);
    // Don't throw - email failures shouldn't break the login flow
  }
}

/**
 * Send document upload confirmation email
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
  try {
    const transporter = getTransporter();
    const frontendUrl = config.frontendUrl;
    const documentUrl = `${frontendUrl}/?document=${documentId}`;
    
    const riskBadgeColor = 
      riskLevel === 'Critical' ? '#dc2626' :
      riskLevel === 'Warning' ? '#d97706' :
      '#059669';
    
    const riskBadgeBg = 
      riskLevel === 'Critical' ? '#fef2f2' :
      riskLevel === 'Warning' ? '#fffbeb' :
      '#f0fdf4';

    const mailOptions = {
      from: `"Aegis AI" <${config.smtp.fromEmail}>`,
      to: userEmail,
      subject: `Document Analysis Complete: ${documentName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f5f5f5;
            }
            .container {
              background-color: #ffffff;
              border-radius: 8px;
              padding: 40px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .logo {
              font-size: 32px;
              font-weight: bold;
              color: #2563eb;
              margin-bottom: 10px;
            }
            .title {
              font-size: 24px;
              font-weight: 600;
              color: #1f2937;
              margin-bottom: 20px;
            }
            .document-info {
              background-color: #f9fafb;
              padding: 20px;
              border-radius: 6px;
              margin-bottom: 20px;
            }
            .document-name {
              font-weight: 600;
              color: #1f2937;
              font-size: 18px;
              margin-bottom: 15px;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
              border-bottom: 1px solid #e5e7eb;
            }
            .info-row:last-child {
              border-bottom: none;
            }
            .info-label {
              color: #6b7280;
              font-weight: 500;
            }
            .info-value {
              color: #1f2937;
              font-weight: 600;
            }
            .risk-section {
              background-color: ${riskBadgeBg};
              border-left: 4px solid ${riskBadgeColor};
              padding: 20px;
              border-radius: 6px;
              margin: 20px 0;
            }
            .risk-level {
              font-size: 20px;
              font-weight: 700;
              color: ${riskBadgeColor};
              margin-bottom: 10px;
            }
            .risk-explanation {
              color: #4b5563;
              margin-top: 10px;
            }
            .recommendations {
              background-color: #f9fafb;
              padding: 20px;
              border-radius: 6px;
              margin: 20px 0;
            }
            .recommendations-title {
              font-weight: 600;
              color: #1f2937;
              margin-bottom: 15px;
            }
            .recommendations ul {
              margin: 0;
              padding-left: 20px;
            }
            .recommendations li {
              color: #4b5563;
              margin-bottom: 8px;
            }
            .cta-button {
              display: inline-block;
              background-color: #2563eb;
              color: #ffffff;
              padding: 12px 24px;
              text-decoration: none;
              border-radius: 6px;
              font-weight: 600;
              margin: 20px 0;
              text-align: center;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              text-align: center;
              color: #9ca3af;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">🛡️ Aegis AI</div>
              <h1 class="title">Document Analysis Complete</h1>
            </div>
            
            <div class="content">
              <p>Hi ${userName},</p>
              
              <p>Your document has been successfully uploaded and analyzed. Here's the complete report:</p>
              
              <div class="document-info">
                <div class="document-name">📄 ${documentName}</div>
                <div class="info-row">
                  <span class="info-label">Pages/Sheets:</span>
                  <span class="info-value">${numPages}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Chunks:</span>
                  <span class="info-value">${numChunks}</span>
                </div>
                ${riskCategory && riskCategory !== 'None' ? `
                <div class="info-row">
                  <span class="info-label">Category:</span>
                  <span class="info-value">${riskCategory}</span>
                </div>
                ` : ''}
                ${riskConfidence ? `
                <div class="info-row">
                  <span class="info-label">Confidence:</span>
                  <span class="info-value">${Math.round(riskConfidence * 100)}%</span>
                </div>
                ` : ''}
              </div>
              
              <div class="risk-section">
                <div class="risk-level">Risk Level: ${riskLevel}</div>
                ${riskExplanation ? `
                <div class="risk-explanation">
                  <strong>Analysis:</strong> ${riskExplanation}
                </div>
                ` : ''}
              </div>
              
              ${recommendations && recommendations.length > 0 ? `
              <div class="recommendations">
                <div class="recommendations-title">💡 Recommendations:</div>
                <ul>
                  ${recommendations.map(rec => `<li>${rec}</li>`).join('')}
                </ul>
              </div>
              ` : ''}
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${documentUrl}" class="cta-button">View Document Details</a>
              </div>
              
              <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                You can also chat with your document, get explanations in different languages, and find solution providers if needed.
              </p>
            </div>
            
            <div class="footer">
              <p>© ${new Date().getFullYear()} Aegis AI. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Document Analysis Complete

Hi ${userName},

Your document has been successfully uploaded and analyzed. Here's the complete report:

Document: ${documentName}
Pages/Sheets: ${numPages}
Chunks: ${numChunks}
${riskCategory && riskCategory !== 'None' ? `Category: ${riskCategory}\n` : ''}
${riskConfidence ? `Confidence: ${Math.round(riskConfidence * 100)}%\n` : ''}

Risk Level: ${riskLevel}
${riskExplanation ? `\nAnalysis: ${riskExplanation}\n` : ''}

${recommendations && recommendations.length > 0 ? `\nRecommendations:\n${recommendations.map(rec => `- ${rec}`).join('\n')}\n` : ''}

View Document Details: ${documentUrl}

You can also chat with your document, get explanations in different languages, and find solution providers if needed.

© ${new Date().getFullYear()} Aegis AI. All rights reserved.
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Document upload email sent to ${userEmail} for document: ${documentName}`);
  } catch (error) {
    console.error('Error sending document upload email:', error);
    // Don't throw - email failures shouldn't break the upload flow
  }
}

/**
 * Verify SMTP connection
 */
export async function verifySMTPConnection(): Promise<boolean> {
  try {
    const transporter = getTransporter();
    await transporter.verify();
    console.log('✅ SMTP connection verified');
    return true;
  } catch (error) {
    console.error('❌ SMTP connection failed:', error);
    return false;
  }
}
