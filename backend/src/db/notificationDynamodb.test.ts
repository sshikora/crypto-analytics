import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { claimRuleTrigger } from './notificationDynamodb';

const send = vi.spyOn(DynamoDBDocumentClient.prototype, 'send');

describe('claimRuleTrigger', () => {
  beforeEach(() => {
    send.mockReset();
  });

  it('records the trigger only if the rule still has the state that was read', async () => {
    send.mockResolvedValue({} as never);

    await expect(
      claimRuleTrigger('rule-123', 'PRICE_BELOW_MA', 'PRICE_ABOVE_MA', '2026-10-23T04:05:00Z')
    ).resolves.toBe(true);

    const input = (send.mock.calls[0][0] as any).input;
    expect(input.Key).toEqual({ ruleId: 'rule-123' });
    expect(input.ConditionExpression).toBe('attribute_exists(ruleId) AND lastCrossoverState = :previousState');
    expect(input.ExpressionAttributeValues).toEqual({
      ':newState': 'PRICE_ABOVE_MA',
      ':triggeredAt': '2026-10-23T04:05:00Z',
      ':previousState': 'PRICE_BELOW_MA',
    });
  });

  it('requires no stored state when the rule has never been evaluated', async () => {
    send.mockResolvedValue({} as never);

    await claimRuleTrigger('rule-123', undefined, 'PRICE_ABOVE_MA', '2026-10-23T04:05:00Z');

    const input = (send.mock.calls[0][0] as any).input;
    expect(input.ConditionExpression).toBe('attribute_exists(ruleId) AND attribute_not_exists(lastCrossoverState)');
    expect(input.ExpressionAttributeValues).not.toHaveProperty(':previousState');
  });

  it('returns false when another checker changed the rule first', async () => {
    send.mockRejectedValue(Object.assign(new Error('changed'), { name: 'ConditionalCheckFailedException' }) as never);

    await expect(
      claimRuleTrigger('rule-123', 'PRICE_BELOW_MA', 'PRICE_ABOVE_MA', '2026-10-23T04:05:00Z')
    ).resolves.toBe(false);
  });

  it('rethrows other errors', async () => {
    send.mockRejectedValue(new Error('throttled') as never);

    await expect(
      claimRuleTrigger('rule-123', 'PRICE_BELOW_MA', 'PRICE_ABOVE_MA', '2026-10-23T04:05:00Z')
    ).rejects.toThrow('throttled');
  });
});
