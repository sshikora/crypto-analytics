import { SESClient, SendEmailCommand, SendEmailCommandInput } from '@aws-sdk/client-ses';

// SES Client Configuration
const sesClient = new SESClient({
  region: process.env.AWS_REGION || 'us-east-1',
  // IAM role credentials are automatically provided by EKS when running in production
  // For local development, AWS SDK will use default credentials from ~/.aws/credentials
});

interface EmailOptions {
  to: string | string[];
  subject: string;
  htmlBody: string;
  textBody?: string;
}

/**
 * Email Service for sending transactional emails via AWS SES
 */
export class EmailService {
  private readonly fromAddress: string;
  private readonly fromName: string;

  constructor() {
    this.fromAddress = process.env.EMAIL_FROM_ADDRESS || `noreply@${process.env.DOMAIN_NAME || 'cryptoquantlab.com'}`;
    this.fromName = process.env.EMAIL_FROM_NAME || 'Crypto Quant Lab';
  }

  /**
   * Send an email via AWS SES
   */
  async sendEmail(options: EmailOptions): Promise<void> {
    const { to, subject, htmlBody, textBody } = options;

    const toAddresses = Array.isArray(to) ? to : [to];

    const params: SendEmailCommandInput = {
      Source: `${this.fromName} <${this.fromAddress}>`,
      Destination: {
        ToAddresses: toAddresses,
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: htmlBody,
            Charset: 'UTF-8',
          },
          ...(textBody && {
            Text: {
              Data: textBody,
              Charset: 'UTF-8',
            },
          }),
        },
      },
    };

    try {
      const command = new SendEmailCommand(params);
      const response = await sesClient.send(command);
      console.log('[Email] Successfully sent email:', {
        to: toAddresses,
        subject,
        messageId: response.MessageId,
      });
    } catch (error) {
      console.error('[Email] Failed to send email:', error);
      throw new Error('Failed to send email');
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
    const resetUrl = `https://${process.env.DOMAIN_NAME || 'cryptoquantlab.com'}/reset-password?token=${resetToken}`;

    const htmlBody = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              padding: 30px;
              text-align: center;
              border-radius: 8px 8px 0 0;
            }
            .header h1 {
              color: white;
              margin: 0;
              font-size: 24px;
            }
            .content {
              background: #ffffff;
              padding: 30px;
              border: 1px solid #e0e0e0;
              border-top: none;
            }
            .button {
              display: inline-block;
              padding: 12px 24px;
              background: #667eea;
              color: white;
              text-decoration: none;
              border-radius: 6px;
              margin: 20px 0;
            }
            .footer {
              text-align: center;
              padding: 20px;
              color: #666;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Crypto Quant Lab</h1>
          </div>
          <div class="content">
            <h2>Password Reset Request</h2>
            <p>We received a request to reset your password for your Crypto Quant Lab account.</p>
            <p>Click the button below to reset your password. This link will expire in 1 hour.</p>
            <a href="${resetUrl}" class="button">Reset Password</a>
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #667eea;">${resetUrl}</p>
            <p><strong>If you didn't request a password reset, you can safely ignore this email.</strong></p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Crypto Quant Lab. All rights reserved.</p>
          </div>
        </body>
      </html>
    `;

    const textBody = `
Password Reset Request

We received a request to reset your password for your Crypto Quant Lab account.

To reset your password, visit this link (expires in 1 hour):
${resetUrl}

If you didn't request a password reset, you can safely ignore this email.

© ${new Date().getFullYear()} Crypto Quant Lab. All rights reserved.
    `.trim();

    await this.sendEmail({
      to: email,
      subject: 'Reset Your Password - Crypto Quant Lab',
      htmlBody,
      textBody,
    });
  }

  /**
   * Send welcome email to new users
   */
  async sendWelcomeEmail(email: string, name?: string): Promise<void> {
    const greeting = name ? `Hi ${name}` : 'Welcome';

    const htmlBody = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              padding: 30px;
              text-align: center;
              border-radius: 8px 8px 0 0;
            }
            .header h1 {
              color: white;
              margin: 0;
              font-size: 24px;
            }
            .content {
              background: #ffffff;
              padding: 30px;
              border: 1px solid #e0e0e0;
              border-top: none;
            }
            .button {
              display: inline-block;
              padding: 12px 24px;
              background: #667eea;
              color: white;
              text-decoration: none;
              border-radius: 6px;
              margin: 20px 0;
            }
            .footer {
              text-align: center;
              padding: 20px;
              color: #666;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Crypto Quant Lab</h1>
          </div>
          <div class="content">
            <h2>${greeting}!</h2>
            <p>Welcome to Crypto Quant Lab - your quantitative cryptocurrency analytics platform.</p>
            <p>You can now:</p>
            <ul>
              <li>Track real-time cryptocurrency prices and market data</li>
              <li>Analyze moving averages and price trends</li>
              <li>Customize your dashboard with your favorite coins</li>
              <li>Save your preferences across devices</li>
            </ul>
            <a href="https://${process.env.DOMAIN_NAME || 'cryptoquantlab.com'}" class="button">Get Started</a>
            <p>If you have any questions, feel free to reach out to us at <a href="mailto:support@${process.env.DOMAIN_NAME || 'cryptoquantlab.com'}">support@${process.env.DOMAIN_NAME || 'cryptoquantlab.com'}</a>.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Crypto Quant Lab. All rights reserved.</p>
          </div>
        </body>
      </html>
    `;

    const textBody = `
${greeting}!

Welcome to Crypto Quant Lab - your quantitative cryptocurrency analytics platform.

You can now:
- Track real-time cryptocurrency prices and market data
- Analyze moving averages and price trends
- Customize your dashboard with your favorite coins
- Save your preferences across devices

Get started: https://${process.env.DOMAIN_NAME || 'cryptoquantlab.com'}

If you have any questions, reach out to support@${process.env.DOMAIN_NAME || 'cryptoquantlab.com'}.

© ${new Date().getFullYear()} Crypto Quant Lab. All rights reserved.
    `.trim();

    await this.sendEmail({
      to: email,
      subject: 'Welcome to Crypto Quant Lab!',
      htmlBody,
      textBody,
    });
  }
}

// Export singleton instance
export const emailService = new EmailService();
