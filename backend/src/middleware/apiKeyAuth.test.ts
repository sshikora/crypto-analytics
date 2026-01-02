import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { apiKeyAuth } from './apiKeyAuth';

describe('apiKeyAuth Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let originalApiKey: string | undefined;

  beforeEach(() => {
    // Store original API_KEY value
    originalApiKey = process.env.API_KEY;

    mockRequest = {
      headers: {},
      path: '/graphql',
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn();
  });

  afterEach(() => {
    // Restore original API_KEY
    if (originalApiKey) {
      process.env.API_KEY = originalApiKey;
    } else {
      delete process.env.API_KEY;
    }
  });

  describe('health endpoint bypass', () => {
    it('should skip authentication for /health endpoint', () => {
      mockRequest.path = '/health';

      apiKeyAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });
  });

  describe('when API_KEY is not configured', () => {
    beforeEach(() => {
      delete process.env.API_KEY;
    });

    it('should allow request when API_KEY not set', () => {
      apiKeyAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should not require x-api-key header when API_KEY not set', () => {
      mockRequest.headers = {};

      apiKeyAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });

  describe('when API_KEY is configured', () => {
    const validApiKey = 'test-api-key-123';

    beforeEach(() => {
      process.env.API_KEY = validApiKey;
    });

    it('should return 401 when API key header is missing', () => {
      mockRequest.headers = {};

      apiKeyAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'API key is required. Include X-API-Key header.',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 when API key is invalid', () => {
      mockRequest.headers = { 'x-api-key': 'wrong-key' };

      apiKeyAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'Invalid API key',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call next() when API key is valid', () => {
      mockRequest.headers = { 'x-api-key': validApiKey };

      apiKeyAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it('should handle API key as string type', () => {
      mockRequest.headers = { 'x-api-key': validApiKey };

      apiKeyAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject empty string API key', () => {
      mockRequest.headers = { 'x-api-key': '' };

      apiKeyAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle x-api-key header name', () => {
      mockRequest.headers = { 'x-api-key': validApiKey };

      apiKeyAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('various paths', () => {
    const validApiKey = 'test-key';

    beforeEach(() => {
      process.env.API_KEY = validApiKey;
    });

    it('should protect /graphql endpoint', () => {
      mockRequest.path = '/graphql';
      mockRequest.headers = {};

      apiKeyAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should protect /api endpoint', () => {
      mockRequest.path = '/api/data';
      mockRequest.headers = {};

      apiKeyAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should bypass /health endpoint even with API_KEY configured', () => {
      mockRequest.path = '/health';
      mockRequest.headers = {}; // No API key

      apiKeyAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });

  describe('error responses', () => {
    beforeEach(() => {
      process.env.API_KEY = 'valid-key';
    });

    it('should return correct error structure for missing key', () => {
      mockRequest.headers = {};

      apiKeyAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(String),
          message: expect.any(String),
        })
      );
    });

    it('should return 401 status code for missing key', () => {
      mockRequest.headers = {};

      apiKeyAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });

    it('should return 403 status code for invalid key', () => {
      mockRequest.headers = { 'x-api-key': 'invalid' };

      apiKeyAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });

    it('should include helpful message in 401 response', () => {
      mockRequest.headers = {};

      apiKeyAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('X-API-Key'),
        })
      );
    });
  });

  describe('security', () => {
    const validApiKey = 'secret-key-abc123';

    beforeEach(() => {
      process.env.API_KEY = validApiKey;
    });

    it('should not accept similar but incorrect keys', () => {
      mockRequest.headers = { 'x-api-key': 'secret-key-abc12' }; // Missing one char

      apiKeyAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should not accept keys with extra characters', () => {
      mockRequest.headers = { 'x-api-key': `${validApiKey}extra` };

      apiKeyAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should perform exact match comparison', () => {
      mockRequest.headers = { 'x-api-key': validApiKey.toUpperCase() };

      apiKeyAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should not accept null as valid key', () => {
      mockRequest.headers = { 'x-api-key': null as any };

      apiKeyAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should not accept undefined as valid key', () => {
      mockRequest.headers = { 'x-api-key': undefined as any };

      apiKeyAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
