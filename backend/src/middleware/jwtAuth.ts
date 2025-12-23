import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

// Don't use constants - read from process.env at runtime to ensure dotenv is loaded
function getCognitoConfig() {
  return {
    userPoolId: process.env.COGNITO_USER_POOL_ID || '',
    region: process.env.AWS_REGION || 'us-east-1',
  };
}

// JWKS client factory - creates client on demand
function getJwksClient() {
  const config = getCognitoConfig();
  return jwksClient({
    jwksUri: `https://cognito-idp.${config.region}.amazonaws.com/${config.userPoolId}/.well-known/jwks.json`,
    cache: true,
    cacheMaxAge: 600000, // 10 minutes
  });
}

function getKey(header: any, callback: any) {
  const client = getJwksClient();
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err, null);
      return;
    }
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

export interface AuthenticatedRequest extends Request {
  user?: {
    sub: string; // User ID from Cognito
    email?: string;
    [key: string]: any;
  };
}

/**
 * JWT Authentication Middleware
 * Verifies Cognito JWT tokens for authenticated endpoints
 */
export const jwtAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'JWT token is required. Include Authorization: Bearer <token> header.',
    });
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  const config = getCognitoConfig();

  if (!config.userPoolId) {
    console.warn('WARNING: COGNITO_USER_POOL_ID not set. JWT validation disabled!');
    return next();
  }

  try {
    // Verify JWT token
    const decoded = await new Promise<any>((resolve, reject) => {
      jwt.verify(
        token,
        getKey,
        {
          algorithms: ['RS256'],
          issuer: `https://cognito-idp.${config.region}.amazonaws.com/${config.userPoolId}`,
        },
        (err, decoded) => {
          if (err) reject(err);
          else resolve(decoded);
        }
      );
    });

    // Attach user info to request
    req.user = {
      sub: decoded.sub,
      email: decoded.email,
      ...decoded,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired JWT token',
    });
  }
};

/**
 * Optional JWT Authentication
 * Extracts user info if token present, but doesn't require it
 */
export const optionalJwtAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // No token provided, continue as anonymous
    return next();
  }

  const token = authHeader.substring(7);
  const config = getCognitoConfig();

  if (!config.userPoolId) {
    console.warn('[JWT] COGNITO_USER_POOL_ID not configured, skipping JWT verification');
    return next();
  }

  try {
    const decoded = await new Promise<any>((resolve, reject) => {
      jwt.verify(
        token,
        getKey,
        {
          algorithms: ['RS256'],
          issuer: `https://cognito-idp.${config.region}.amazonaws.com/${config.userPoolId}`,
        },
        (err, decoded) => {
          if (err) reject(err);
          else resolve(decoded);
        }
      );
    });

    req.user = {
      sub: decoded.sub,
      email: decoded.email,
      ...decoded,
    };
  } catch (error) {
    // Invalid token, continue as anonymous
    console.warn('[JWT] Invalid JWT token:', error instanceof Error ? error.message : error);
  }

  next();
};
