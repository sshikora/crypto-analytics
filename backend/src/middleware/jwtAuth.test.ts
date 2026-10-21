import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Response } from 'express';
import type { AuthenticatedRequest } from './jwtAuth';

const verify = vi.fn();
const create = vi.fn(() => ({ verify }));

vi.mock('aws-jwt-verify', () => ({
  CognitoJwtVerifier: { create },
}));

async function loadMiddleware() {
  vi.resetModules();
  return (await import('./jwtAuth')).optionalJwtAuth;
}

describe('optionalJwtAuth Middleware', () => {
  const originalEnv = { ...process.env };
  let req: Partial<AuthenticatedRequest>;
  const res = {} as Response;
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env.COGNITO_USER_POOL_ID = 'us-east-1_pool';
    process.env.COGNITO_CLIENT_ID = 'client-123';
    req = { headers: {} };
    next = vi.fn();
    verify.mockReset();
    create.mockClear();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('continues anonymously when no token is sent', async () => {
    const optionalJwtAuth = await loadMiddleware();

    await optionalJwtAuth(req as AuthenticatedRequest, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toBeUndefined();
    expect(verify).not.toHaveBeenCalled();
  });

  it('verifies ID tokens for the configured pool and app client', async () => {
    verify.mockResolvedValue({ sub: 'user-1', email: 'a@example.com', token_use: 'id' });
    req.headers = { authorization: 'Bearer good-token' };
    const optionalJwtAuth = await loadMiddleware();

    await optionalJwtAuth(req as AuthenticatedRequest, res, next);

    expect(create).toHaveBeenCalledWith({ userPoolId: 'us-east-1_pool', clientId: 'client-123', tokenUse: 'id' });
    expect(verify).toHaveBeenCalledWith('good-token');
    expect(req.user).toMatchObject({ sub: 'user-1', email: 'a@example.com' });
    expect(next).toHaveBeenCalledOnce();
  });

  it('continues anonymously when the token fails verification', async () => {
    verify.mockRejectedValue(new Error('Token expired'));
    req.headers = { authorization: 'Bearer bad-token' };
    const optionalJwtAuth = await loadMiddleware();

    await optionalJwtAuth(req as AuthenticatedRequest, res, next);

    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
  });

  it('does not trust tokens when the app client ID is not configured', async () => {
    delete process.env.COGNITO_CLIENT_ID;
    req.headers = { authorization: 'Bearer some-token' };
    const optionalJwtAuth = await loadMiddleware();

    await optionalJwtAuth(req as AuthenticatedRequest, res, next);

    expect(create).not.toHaveBeenCalled();
    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
  });

  it('ignores authorization headers that are not bearer tokens', async () => {
    req.headers = { authorization: 'Basic dXNlcjpwYXNz' };
    const optionalJwtAuth = await loadMiddleware();

    await optionalJwtAuth(req as AuthenticatedRequest, res, next);

    expect(verify).not.toHaveBeenCalled();
    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
  });
});
