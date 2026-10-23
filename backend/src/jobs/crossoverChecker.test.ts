import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { triggerCrossoverCheck } from './crossoverChecker';
import { processAllActiveRules } from '../services/crossoverDetectionService';
import { emailService } from '../services/emailService';
import * as notificationDb from '../db/notificationDynamodb';

vi.mock('../services/crossoverDetectionService');
vi.mock('../services/emailService');
vi.mock('../db/notificationDynamodb');

const cognitoSend = vi.spyOn(CognitoIdentityProviderClient.prototype, 'send');

const rule = {
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
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
};

const crossover = {
  type: 'GOLDEN_CROSS' as const,
  coinId: 'bitcoin',
  coinSymbol: 'BTC',
  priceAtCrossover: 82943.83,
  maValues: { ma7: 82000, ma21: 81000 },
  maPeriods: [7, 21],
  triggeredAt: '2026-10-23T00:00:00Z',
};

function cognitoUser(emailVerified: string) {
  return {
    Enabled: true,
    UserAttributes: [
      { Name: 'sub', Value: 'user-123' },
      { Name: 'email', Value: 'user@example.com' },
      { Name: 'email_verified', Value: emailVerified },
    ],
  };
}

describe('crossover checker email delivery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cognitoSend.mockReset();
    vi.mocked(notificationDb.createNotification).mockImplementation(async (input) => ({
      ...input,
      notificationId: 'notification-123',
      createdAt: '2026-10-23T00:00:05Z',
    }));
    vi.mocked(notificationDb.canSendEmail).mockResolvedValue(true);
  });

  it('emails the verified address on the Cognito account and records the send', async () => {
    vi.mocked(processAllActiveRules).mockResolvedValue([{ rule, crossover }]);
    cognitoSend.mockResolvedValue(cognitoUser('true') as never);

    const result = await triggerCrossoverCheck();

    expect(result).toMatchObject({ success: true, crossoversDetected: 1 });
    expect((cognitoSend.mock.calls[0][0] as any).input.Username).toBe('user-123');
    expect(emailService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'user@example.com', subject: '[Crypto Alert] BTC Golden Cross' })
    );
    expect(notificationDb.markNotificationEmailSent).toHaveBeenCalledWith('notification-123');
    expect(notificationDb.updateEmailRateLimit).toHaveBeenCalledWith('user-123');
  });

  it('keeps the in-app notification but sends no email when the address is unverified', async () => {
    vi.mocked(processAllActiveRules).mockResolvedValue([{ rule, crossover }]);
    cognitoSend.mockResolvedValue(cognitoUser('false') as never);

    await triggerCrossoverCheck();

    expect(notificationDb.createNotification).toHaveBeenCalledTimes(1);
    expect(emailService.sendEmail).not.toHaveBeenCalled();
    expect(notificationDb.markNotificationEmailSent).not.toHaveBeenCalled();
  });

  it('does not look up the user when the rule has email turned off', async () => {
    vi.mocked(processAllActiveRules).mockResolvedValue([{ rule: { ...rule, emailEnabled: false }, crossover }]);

    await triggerCrossoverCheck();

    expect(notificationDb.createNotification).toHaveBeenCalledTimes(1);
    expect(cognitoSend).not.toHaveBeenCalled();
    expect(emailService.sendEmail).not.toHaveBeenCalled();
  });
});
