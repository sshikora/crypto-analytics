import { Request, Response, NextFunction } from 'express';

/**
 * API Key Authentication Middleware
 * Validates that requests include a valid API key
 * This prevents unauthorized third parties from using your API
 */
export const apiKeyAuth = (req: Request, res: Response, next: NextFunction) => {
  // Skip API key check for health endpoint
  if (req.path === '/health') {
    return next();
  }

  // Allow GraphiQL UI in development (GET requests only serve the HTML interface)
  if (process.env.NODE_ENV !== 'production' && req.path === '/graphql' && req.method === 'GET') {
    return next();
  }

  const apiKey = req.headers['x-api-key'] as string;
  const validApiKey = process.env.API_KEY;

  if (!validApiKey) {
    console.warn('WARNING: API_KEY environment variable not set. API is unprotected!');
    return next(); // Allow in dev if not configured
  }

  if (!apiKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'API key is required. Include X-API-Key header.',
    });
  }

  if (apiKey !== validApiKey) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid API key',
    });
  }

  next();
};
