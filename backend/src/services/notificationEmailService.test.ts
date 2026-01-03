import { describe, it, expect, beforeEach, vi } from 'vitest';
import { notificationEmailService } from './notificationEmailService';
import * as emailService from './emailService';
import * as notificationDb from '../db/notificationDynamodb';

vi.mock('./emailService');
vi.mock('../db/notificationDynamodb');

describe('NotificationEmailService', () => {
  const mockNotification = {
    notificationId: 'notification-123',
    userId: 'user-123',
    ruleId: 'rule-123',
    coinId: 'bitcoin',
    coinSymbol: 'BTC',
    crossoverType: 'GOLDEN_CROSS' as const,
    maPeriods: [7, 21],
    priceAtCrossover: 50000,
    maValuesAtCrossover: { ma7: 49000, ma21: 48000 },
    isRead: false,
    emailSent: false,
    triggeredAt: '2024-01-01T12:00:00Z',
    createdAt: '2024-01-01T12:00:00Z',
  };

  const mockRule = {
    ruleId: 'rule-123',
    userId: 'user-123',
    coinId: 'bitcoin',
    coinSymbol: 'BTC',
    ruleType: 'MA_CROSSOVER' as const,
    maPeriods: [7, 21],
    crossDirection: 'BOTH' as const,
    inAppEnabled: true,
    emailEnabled: true,
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DOMAIN_NAME = 'cryptoquantlab.com';
  });

  describe('canSendToUser', () => {
    it('should return true if user can receive email', async () => {
      vi.mocked(notificationDb.canSendEmail).mockResolvedValue(true);

      const result = await notificationEmailService.canSendToUser('user-123');

      expect(result).toBe(true);
      expect(notificationDb.canSendEmail).toHaveBeenCalledWith('user-123');
    });

    it('should return false if rate limit exceeded', async () => {
      vi.mocked(notificationDb.canSendEmail).mockResolvedValue(false);

      const result = await notificationEmailService.canSendToUser('user-123');

      expect(result).toBe(false);
    });
  });

  describe('sendCrossoverAlert', () => {
    it('should send email successfully', async () => {
      vi.mocked(notificationDb.canSendEmail).mockResolvedValue(true);
      vi.mocked(emailService.emailService.sendEmail).mockResolvedValue(undefined);
      vi.mocked(notificationDb.updateEmailRateLimit).mockResolvedValue({
        userId: 'user-123',
        lastEmailSentAt: new Date().toISOString(),
        emailCount5Min: 1,
        windowStart: new Date().toISOString(),
      });
      vi.mocked(notificationDb.updateNotificationReadStatus).mockResolvedValue({
        ...mockNotification,
        emailSent: true,
      });

      const result = await notificationEmailService.sendCrossoverAlert(
        'user@example.com',
        'user-123',
        mockNotification,
        mockRule
      );

      expect(result).toBe(true);
      expect(emailService.emailService.sendEmail).toHaveBeenCalled();
      expect(notificationDb.updateEmailRateLimit).toHaveBeenCalledWith('user-123');
    });

    it('should not send if email disabled in rule', async () => {
      const ruleWithoutEmail = { ...mockRule, emailEnabled: false };

      const result = await notificationEmailService.sendCrossoverAlert(
        'user@example.com',
        'user-123',
        mockNotification,
        ruleWithoutEmail
      );

      expect(result).toBe(false);
      expect(emailService.emailService.sendEmail).not.toHaveBeenCalled();
    });

    it('should not send if rate limit exceeded', async () => {
      vi.mocked(notificationDb.canSendEmail).mockResolvedValue(false);

      const result = await notificationEmailService.sendCrossoverAlert(
        'user@example.com',
        'user-123',
        mockNotification,
        mockRule
      );

      expect(result).toBe(false);
      expect(emailService.emailService.sendEmail).not.toHaveBeenCalled();
    });

    it('should handle email sending errors', async () => {
      vi.mocked(notificationDb.canSendEmail).mockResolvedValue(true);
      vi.mocked(emailService.emailService.sendEmail).mockRejectedValue(
        new Error('Email failed')
      );

      const result = await notificationEmailService.sendCrossoverAlert(
        'user@example.com',
        'user-123',
        mockNotification,
        mockRule
      );

      expect(result).toBe(false);
    });
  });

  describe('generatePreview', () => {
    it('should generate HTML and text preview for GOLDEN_CROSS', () => {
      const preview = notificationEmailService.generatePreview(mockNotification);

      expect(preview.html).toContain('Golden Cross');
      expect(preview.html).toContain('BTC');
      expect(preview.html).toContain('$50,000.00');
      expect(preview.text).toContain('Golden Cross');
      expect(preview.text).toContain('BTC');
    });

    it('should generate preview for DEATH_CROSS', () => {
      const deathCrossNotification = {
        ...mockNotification,
        crossoverType: 'DEATH_CROSS' as const,
      };

      const preview = notificationEmailService.generatePreview(deathCrossNotification);

      expect(preview.html).toContain('Death Cross');
      expect(preview.text).toContain('Death Cross');
    });

    it('should generate preview for PRICE_ABOVE_MA', () => {
      const priceAboveNotification = {
        ...mockNotification,
        crossoverType: 'PRICE_ABOVE_MA' as const,
        maPeriods: [21],
      };

      const preview = notificationEmailService.generatePreview(priceAboveNotification);

      expect(preview.html).toContain('Price Crossed Above MA');
      expect(preview.text).toContain('Price Crossed Above MA');
    });

    it('should generate preview for PRICE_BELOW_MA', () => {
      const priceBelowNotification = {
        ...mockNotification,
        crossoverType: 'PRICE_BELOW_MA' as const,
        maPeriods: [21],
      };

      const preview = notificationEmailService.generatePreview(priceBelowNotification);

      expect(preview.html).toContain('Price Crossed Below MA');
      expect(preview.text).toContain('Price Crossed Below MA');
    });

    it('should format prices correctly', () => {
      const lowPriceNotification = {
        ...mockNotification,
        priceAtCrossover: 0.0001234,
      };

      const preview = notificationEmailService.generatePreview(lowPriceNotification);

      expect(preview.html).toContain('$0.000123');
    });

    it('should include coin detail URL', () => {
      const preview = notificationEmailService.generatePreview(mockNotification);

      expect(preview.html).toContain('/crypto/bitcoin');
      expect(preview.text).toContain('/crypto/bitcoin');
    });

    it('should include notification settings URL', () => {
      const preview = notificationEmailService.generatePreview(mockNotification);

      expect(preview.html).toContain('/notifications');
      expect(preview.text).toContain('/notifications');
    });
  });
});
