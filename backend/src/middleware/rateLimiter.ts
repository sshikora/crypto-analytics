import rateLimit from 'express-rate-limit';

/**
 * Rate Limiter for GraphQL API
 * Prevents abuse by limiting requests per IP address
 */
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too Many Requests',
    message: 'You have exceeded the rate limit. Please try again later.',
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  // Skip rate limiting for health checks
  skip: (req) => req.path === '/health',
});

/**
 * Stricter rate limiter for mutation operations
 * Prevents spam/abuse of write operations
 */
export const mutationRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // Limit to 20 mutations per minute per IP
  message: {
    error: 'Too Many Requests',
    message: 'Too many write operations. Please slow down.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
