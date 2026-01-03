import { emailService } from './emailService';
import {
  Notification,
  NotificationRule,
  CrossoverType,
  canSendEmail,
  updateEmailRateLimit,
  updateNotificationReadStatus,
} from '../db/notificationDynamodb';

const DOMAIN_NAME = process.env.DOMAIN_NAME || 'cryptoquantlab.com';

/**
 * Format crossover type for display
 */
function formatCrossoverType(type: CrossoverType): string {
  switch (type) {
    case 'GOLDEN_CROSS':
      return 'Golden Cross';
    case 'DEATH_CROSS':
      return 'Death Cross';
    case 'PRICE_ABOVE_MA':
      return 'Price Crossed Above MA';
    case 'PRICE_BELOW_MA':
      return 'Price Crossed Below MA';
    default:
      return 'Crossover';
  }
}

/**
 * Get emoji for crossover type
 */
function getCrossoverEmoji(type: CrossoverType): string {
  switch (type) {
    case 'GOLDEN_CROSS':
    case 'PRICE_ABOVE_MA':
      return '📈';
    case 'DEATH_CROSS':
    case 'PRICE_BELOW_MA':
      return '📉';
    default:
      return '📊';
  }
}

/**
 * Get color for crossover type
 */
function getCrossoverColor(type: CrossoverType): string {
  switch (type) {
    case 'GOLDEN_CROSS':
    case 'PRICE_ABOVE_MA':
      return '#10B981'; // Green
    case 'DEATH_CROSS':
    case 'PRICE_BELOW_MA':
      return '#EF4444'; // Red
    default:
      return '#6366F1'; // Indigo
  }
}

/**
 * Format price for display
 */
function formatPrice(price: number): string {
  if (price >= 1) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(price);
}

/**
 * Format MA values for display
 */
function formatMAValues(maValues: Record<string, number>): string {
  return Object.entries(maValues)
    .map(([key, value]) => {
      const period = key.replace('ma', '');
      return `${period}-day MA: ${formatPrice(value)}`;
    })
    .join(' | ');
}

/**
 * Generate HTML email for crossover alert
 */
function generateCrossoverEmailHtml(notification: Notification): string {
  const crossoverColor = getCrossoverColor(notification.crossoverType);
  const crossoverEmoji = getCrossoverEmoji(notification.crossoverType);
  const crossoverTypeDisplay = formatCrossoverType(notification.crossoverType);
  const formattedPrice = formatPrice(notification.priceAtCrossover);
  const formattedMAValues = formatMAValues(notification.maValuesAtCrossover);
  const coinDetailUrl = `https://${DOMAIN_NAME}/crypto/${notification.coinId}`;
  const settingsUrl = `https://${DOMAIN_NAME}/notifications`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Crypto Alert - ${notification.coinSymbol.toUpperCase()}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">
                Crypto Quant Lab
              </h1>
              <p style="color: rgba(255, 255, 255, 0.9); margin: 8px 0 0 0; font-size: 14px;">
                Moving Average Alert
              </p>
            </td>
          </tr>

          <!-- Alert Badge -->
          <tr>
            <td style="padding: 30px 40px 0 40px; text-align: center;">
              <div style="display: inline-block; background-color: ${crossoverColor}; color: #ffffff; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: 600;">
                ${crossoverEmoji} ${crossoverTypeDisplay}
              </div>
            </td>
          </tr>

          <!-- Coin Info -->
          <tr>
            <td style="padding: 24px 40px; text-align: center;">
              <h2 style="margin: 0; color: #1f2937; font-size: 28px; font-weight: 700;">
                ${notification.coinSymbol.toUpperCase()}
              </h2>
              <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 16px;">
                ${notification.coinId.charAt(0).toUpperCase() + notification.coinId.slice(1)}
              </p>
            </td>
          </tr>

          <!-- Price Info -->
          <tr>
            <td style="padding: 0 40px 24px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; padding: 20px;">
                <tr>
                  <td style="text-align: center;">
                    <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;">Price at Crossover</p>
                    <p style="margin: 0; color: #1f2937; font-size: 24px; font-weight: 700;">${formattedPrice}</p>
                  </td>
                </tr>
                <tr>
                  <td style="text-align: center; padding-top: 16px;">
                    <p style="margin: 0; color: #6b7280; font-size: 13px;">${formattedMAValues}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Description -->
          <tr>
            <td style="padding: 0 40px 24px 40px;">
              <p style="margin: 0; color: #4b5563; font-size: 15px; line-height: 1.6; text-align: center;">
                ${getAlertDescription(notification)}
              </p>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding: 0 40px 30px 40px; text-align: center;">
              <a href="${coinDetailUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                View ${notification.coinSymbol.toUpperCase()} Details
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 13px;">
                Triggered at ${new Date(notification.triggeredAt).toLocaleString('en-US', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                <a href="${settingsUrl}" style="color: #6366f1; text-decoration: none;">Manage notification settings</a>
              </p>
              <p style="margin: 16px 0 0 0; color: #9ca3af; font-size: 12px;">
                © ${new Date().getFullYear()} Crypto Quant Lab. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Get alert description based on crossover type
 */
function getAlertDescription(notification: Notification): string {
  const periods = notification.maPeriods.sort((a, b) => a - b);

  switch (notification.crossoverType) {
    case 'GOLDEN_CROSS':
      return `The ${periods[0]}-day moving average has crossed above the ${periods[periods.length - 1]}-day moving average. This is traditionally considered a bullish signal.`;
    case 'DEATH_CROSS':
      return `The ${periods[0]}-day moving average has crossed below the ${periods[periods.length - 1]}-day moving average. This is traditionally considered a bearish signal.`;
    case 'PRICE_ABOVE_MA':
      return `The price has crossed above the ${periods[0]}-day moving average. This may indicate upward momentum.`;
    case 'PRICE_BELOW_MA':
      return `The price has crossed below the ${periods[0]}-day moving average. This may indicate downward momentum.`;
    default:
      return 'A moving average crossover has been detected for this cryptocurrency.';
  }
}

/**
 * Generate plain text email for crossover alert
 */
function generateCrossoverEmailText(notification: Notification): string {
  const crossoverTypeDisplay = formatCrossoverType(notification.crossoverType);
  const formattedPrice = formatPrice(notification.priceAtCrossover);
  const coinDetailUrl = `https://${DOMAIN_NAME}/crypto/${notification.coinId}`;
  const settingsUrl = `https://${DOMAIN_NAME}/notifications`;

  return `
CRYPTO QUANT LAB - MOVING AVERAGE ALERT
========================================

${crossoverTypeDisplay} Detected!

Coin: ${notification.coinSymbol.toUpperCase()} (${notification.coinId})
Price at Crossover: ${formattedPrice}
MA Values: ${formatMAValues(notification.maValuesAtCrossover)}

${getAlertDescription(notification)}

View details: ${coinDetailUrl}

---
Triggered at ${new Date(notification.triggeredAt).toLocaleString()}
Manage notifications: ${settingsUrl}

© ${new Date().getFullYear()} Crypto Quant Lab
  `.trim();
}

/**
 * Service for sending notification emails
 */
export const notificationEmailService = {
  /**
   * Check if user can receive email (rate limit check)
   */
  async canSendToUser(userId: string): Promise<boolean> {
    return canSendEmail(userId);
  },

  /**
   * Send crossover alert email
   */
  async sendCrossoverAlert(
    userEmail: string,
    userId: string,
    notification: Notification,
    rule: NotificationRule
  ): Promise<boolean> {
    // Check if email is enabled for this rule
    if (!rule.emailEnabled) {
      console.log(`[NotificationEmail] Email disabled for rule ${rule.ruleId}`);
      return false;
    }

    // Check rate limit
    const canSend = await canSendEmail(userId);
    if (!canSend) {
      console.log(`[NotificationEmail] Rate limit exceeded for user ${userId}`);
      return false;
    }

    try {
      const crossoverTypeDisplay = formatCrossoverType(notification.crossoverType);
      const subject = `[Crypto Alert] ${notification.coinSymbol.toUpperCase()} ${crossoverTypeDisplay}`;

      await emailService.sendEmail({
        to: userEmail,
        subject,
        htmlBody: generateCrossoverEmailHtml(notification),
        textBody: generateCrossoverEmailText(notification),
      });

      // Update rate limit
      await updateEmailRateLimit(userId);

      // Mark notification as email sent
      await updateNotificationReadStatus(notification.notificationId, notification.isRead);
      // Note: We should add an updateNotificationEmailSent function, but for now
      // we'll handle this in the calling code

      console.log(
        `[NotificationEmail] Sent alert for ${notification.coinSymbol} ` +
        `${notification.crossoverType} to ${userEmail}`
      );

      return true;
    } catch (error) {
      console.error('[NotificationEmail] Failed to send email:', error);
      return false;
    }
  },

  /**
   * Generate email preview (for testing/debugging)
   */
  generatePreview(notification: Notification): { html: string; text: string } {
    return {
      html: generateCrossoverEmailHtml(notification),
      text: generateCrossoverEmailText(notification),
    };
  },
};

export default notificationEmailService;
