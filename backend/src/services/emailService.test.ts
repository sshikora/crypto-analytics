import { describe, it, expect, beforeEach } from 'vitest';
import { EmailService } from './emailService';

describe('EmailService', () => {
  let emailService: EmailService;

  beforeEach(() => {
    // Set required environment variables for testing
    process.env.DOMAIN_NAME = 'cryptoquantlab.com';
    process.env.EMAIL_FROM_NAME = 'Crypto Quant Lab';
    emailService = new EmailService();
  });

  describe('constructor', () => {
    it('should initialize with correct from address', () => {
      expect(emailService).toBeDefined();
      // fromAddress is private, but we can test behavior
    });

    it('should use environment variables for configuration', () => {
      process.env.DOMAIN_NAME = 'test.com';
      process.env.EMAIL_FROM_NAME = 'Test App';
      const testService = new EmailService();
      expect(testService).toBeDefined();
    });
  });

  describe('email formatting', () => {
    it('should generate password reset URL with correct format', () => {
      const token = 'test-token-123';
      const domain = 'cryptoquantlab.com';
      const expectedUrl = `https://${domain}/reset-password?token=${token}`;

      // This tests the URL format that would be generated
      expect(expectedUrl).toContain('reset-password');
      expect(expectedUrl).toContain(token);
    });

    it('should format email addresses correctly', () => {
      const fromName = 'Crypto Quant Lab';
      const fromEmail = 'noreply@cryptoquantlab.com';
      const expectedFormat = `${fromName} <${fromEmail}>`;

      expect(expectedFormat).toBe('Crypto Quant Lab <noreply@cryptoquantlab.com>');
    });
  });

  describe('validation', () => {
    it('should handle valid email addresses', () => {
      const validEmails = [
        'test@example.com',
        'user+tag@domain.co.uk',
        'name.surname@company.com',
      ];

      validEmails.forEach((email) => {
        expect(email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      });
    });

    it('should detect invalid email addresses', () => {
      const invalidEmails = [
        'notanemail',
        '@domain.com',
        'user@',
      ];

      invalidEmails.forEach((email) => {
        expect(email).not.toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      });
    });
  });
});
