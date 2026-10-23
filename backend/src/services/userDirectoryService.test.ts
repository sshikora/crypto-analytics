import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { getVerifiedEmail } from './userDirectoryService';

const send = vi.spyOn(CognitoIdentityProviderClient.prototype, 'send');

function cognitoUser(attributes: Record<string, string>, enabled = true) {
  return {
    Enabled: enabled,
    UserAttributes: Object.entries(attributes).map(([Name, Value]) => ({ Name, Value })),
  };
}

describe('getVerifiedEmail', () => {
  beforeEach(() => {
    send.mockReset();
    process.env.COGNITO_USER_POOL_ID = 'us-east-1_test';
  });

  it('looks the user up by sub and returns a verified email', async () => {
    send.mockResolvedValue(cognitoUser({ sub: 'user-123', email: 'user@example.com', email_verified: 'true' }) as never);

    await expect(getVerifiedEmail('user-123')).resolves.toBe('user@example.com');

    const input = (send.mock.calls[0][0] as any).input;
    expect(input).toEqual({ UserPoolId: 'us-east-1_test', Username: 'user-123' });
  });

  it('ignores an unverified email', async () => {
    send.mockResolvedValue(cognitoUser({ email: 'user@example.com', email_verified: 'false' }) as never);
    await expect(getVerifiedEmail('user-123')).resolves.toBeNull();
  });

  it('ignores a disabled user', async () => {
    send.mockResolvedValue(cognitoUser({ email: 'user@example.com', email_verified: 'true' }, false) as never);
    await expect(getVerifiedEmail('user-123')).resolves.toBeNull();
  });

  it('returns null for a deleted user', async () => {
    send.mockRejectedValue(Object.assign(new Error('gone'), { name: 'UserNotFoundException' }) as never);
    await expect(getVerifiedEmail('user-123')).resolves.toBeNull();
  });

  it('rethrows other errors', async () => {
    send.mockRejectedValue(Object.assign(new Error('denied'), { name: 'AccessDeniedException' }) as never);
    await expect(getVerifiedEmail('user-123')).rejects.toThrow('denied');
  });
});
