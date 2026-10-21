import { Request, Response, NextFunction } from 'express';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

export interface AuthenticatedRequest extends Request {
  user?: {
    sub: string; // User ID from Cognito
    email?: string;
    [key: string]: any;
  };
}

function createVerifier(userPoolId: string, clientId: string) {
  return CognitoJwtVerifier.create({ userPoolId, clientId, tokenUse: 'id' });
}

let verifier: ReturnType<typeof createVerifier> | undefined;

// Read from process.env at call time so dotenv has loaded first
function getVerifier() {
  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  const clientId = process.env.COGNITO_CLIENT_ID;

  if (!userPoolId || !clientId) {
    return undefined;
  }

  verifier ??= createVerifier(userPoolId, clientId);
  return verifier;
}

/**
 * Optional JWT Authentication
 * Attaches the user when a valid Cognito ID token for this app client is present, but doesn't require one
 */
export const optionalJwtAuth = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const jwtVerifier = getVerifier();

  if (!jwtVerifier) {
    console.warn('[JWT] COGNITO_USER_POOL_ID or COGNITO_CLIENT_ID not configured, skipping JWT verification');
    return next();
  }

  try {
    const payload = await jwtVerifier.verify(authHeader.substring(7));

    req.user = {
      ...payload,
      sub: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : undefined,
    };
  } catch (error) {
    console.warn('[JWT] Invalid JWT token:', error instanceof Error ? error.message : error);
  }

  next();
};
