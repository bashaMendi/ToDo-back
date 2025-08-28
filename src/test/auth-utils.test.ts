import {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  createSession,
  getSession,
  deleteSession,
  generatePasswordResetToken,
  storePasswordResetToken,
  getPasswordResetToken,
  deletePasswordResetToken,
  checkRateLimit,
  generateCSRFToken,
  validateCSRFToken,
  storeCSRFToken,
} from '../utils/auth';
import { User } from '../types';

// Mock Redis
jest.mock('../config/redis', () => ({
  redis: {
    setex: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
  },
}));

// Mock logger
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Auth Utils', () => {
  const mockUser: User = {
    id: '507f1f77bcf86cd799439011',
    email: 'test@example.com',
    name: 'Test User',
    provider: 'credentials',
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('hashPassword', () => {
    it('should hash password successfully', async () => {
      const password = 'TestPass123';
      const hashedPassword = await hashPassword(password);

      expect(hashedPassword).toBeDefined();
      expect(typeof hashedPassword).toBe('string');
      expect(hashedPassword.length).toBeGreaterThan(0);
      expect(hashedPassword).not.toBe(password);
    });

    it('should throw error on hashing failure', async () => {
      // Mock argon2 to throw error
      jest.doMock('argon2', () => ({
        hash: jest.fn().mockRejectedValue(new Error('Hashing failed')),
        verify: jest.fn(),
      }));

      const password = 'TestPass123';
      await expect(hashPassword(password)).rejects.toThrow('Failed to hash password');
    });
  });

  describe('verifyPassword', () => {
    it('should verify password successfully', async () => {
      const password = 'TestPass123';
      const hashedPassword = await hashPassword(password);

      const isValid = await verifyPassword(password, hashedPassword);
      expect(isValid).toBe(true);
    });

    it('should reject invalid password', async () => {
      const password = 'TestPass123';
      const hashedPassword = await hashPassword(password);

      const isValid = await verifyPassword('WrongPassword', hashedPassword);
      expect(isValid).toBe(false);
    });

    it('should return false on verification error', async () => {
      // Mock argon2 to throw error
      jest.doMock('argon2', () => ({
        hash: jest.fn(),
        verify: jest.fn().mockRejectedValue(new Error('Verification failed')),
      }));

      const isValid = await verifyPassword('password', 'hash');
      expect(isValid).toBe(false);
    });
  });

  describe('generateSessionToken', () => {
    it('should generate unique session tokens', () => {
      const token1 = generateSessionToken();
      const token2 = generateSessionToken();

      expect(token1).toBeDefined();
      expect(token2).toBeDefined();
      expect(typeof token1).toBe('string');
      expect(typeof token2).toBe('string');
      expect(token1).not.toBe(token2);
    });
  });

  describe('createSession', () => {
    it('should create session successfully', async () => {
      const { redis } = require('../config/redis');
      redis.setex.mockResolvedValue('OK');

      const sessionToken = await createSession(mockUser);

      expect(sessionToken).toBeDefined();
      expect(typeof sessionToken).toBe('string');
      expect(redis.setex).toHaveBeenCalled();
    });

    it('should throw error on session creation failure', async () => {
      const { redis } = require('../config/redis');
      redis.setex.mockRejectedValue(new Error('Redis error'));

      await expect(createSession(mockUser)).rejects.toThrow();
    });
  });

  describe('getSession', () => {
    it('should get session successfully', async () => {
      const { redis } = require('../config/redis');
      const sessionData = {
        user: mockUser,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
      redis.get.mockResolvedValue(JSON.stringify(sessionData));

      const user = await getSession('session-token');

      expect(user).toEqual(mockUser);
      expect(redis.get).toHaveBeenCalledWith('session:session-token');
    });

    it('should return null for non-existent session', async () => {
      const { redis } = require('../config/redis');
      redis.get.mockResolvedValue(null);

      const user = await getSession('non-existent-token');

      expect(user).toBeNull();
    });

    it('should return null for expired session', async () => {
      const { redis } = require('../config/redis');
      const sessionData = {
        user: mockUser,
        expiresAt: new Date(Date.now() - 1000).toISOString(), // Expired
      };
      redis.get.mockResolvedValue(JSON.stringify(sessionData));
      redis.del.mockResolvedValue(1);

      const user = await getSession('expired-token');

      expect(user).toBeNull();
      expect(redis.del).toHaveBeenCalledWith('session:expired-token');
    });

    it('should return null on error', async () => {
      const { redis } = require('../config/redis');
      redis.get.mockRejectedValue(new Error('Redis error'));

      const user = await getSession('session-token');

      expect(user).toBeNull();
    });
  });

  describe('deleteSession', () => {
    it('should delete session successfully', async () => {
      const { redis } = require('../config/redis');
      redis.del.mockResolvedValue(1);

      await deleteSession('session-token');

      expect(redis.del).toHaveBeenCalledWith('session:session-token');
    });

    it('should handle deletion error gracefully', async () => {
      const { redis } = require('../config/redis');
      redis.del.mockRejectedValue(new Error('Redis error'));

      await expect(deleteSession('session-token')).resolves.toBeUndefined();
    });
  });

  describe('generatePasswordResetToken', () => {
    it('should generate unique reset tokens', () => {
      const token1 = generatePasswordResetToken();
      const token2 = generatePasswordResetToken();

      expect(token1).toBeDefined();
      expect(token2).toBeDefined();
      expect(typeof token1).toBe('string');
      expect(typeof token2).toBe('string');
      expect(token1).not.toBe(token2);
    });
  });

  describe('storePasswordResetToken', () => {
    it('should store reset token successfully', async () => {
      const { redis } = require('../config/redis');
      redis.setex.mockResolvedValue('OK');

      const token = 'reset-token';
      const email = 'test@example.com';

      await storePasswordResetToken(email, token);

      expect(redis.setex).toHaveBeenCalledWith(
        'password-reset:reset-token',
        3600,
        expect.stringContaining(email)
      );
    });
  });

  describe('getPasswordResetToken', () => {
    it('should get reset token successfully', async () => {
      const { redis } = require('../config/redis');
      const tokenData = {
        email: 'test@example.com',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      };
      redis.get.mockResolvedValue(JSON.stringify(tokenData));

      const result = await getPasswordResetToken('reset-token');

      expect(result).toEqual(tokenData);
    });

    it('should return null for non-existent token', async () => {
      const { redis } = require('../config/redis');
      redis.get.mockResolvedValue(null);

      const result = await getPasswordResetToken('non-existent-token');

      expect(result).toBeNull();
    });

    it('should return null for expired token', async () => {
      const { redis } = require('../config/redis');
      const tokenData = {
        email: 'test@example.com',
        expiresAt: new Date(Date.now() - 1000).toISOString(), // Expired
      };
      redis.get.mockResolvedValue(JSON.stringify(tokenData));
      redis.del.mockResolvedValue(1);

      const result = await getPasswordResetToken('expired-token');

      expect(result).toBeNull();
      expect(redis.del).toHaveBeenCalledWith('password-reset:expired-token');
    });
  });

  describe('deletePasswordResetToken', () => {
    it('should delete reset token successfully', async () => {
      const { redis } = require('../config/redis');
      redis.del.mockResolvedValue(1);

      await deletePasswordResetToken('reset-token');

      expect(redis.del).toHaveBeenCalledWith('password-reset:reset-token');
    });
  });

  describe('checkRateLimit', () => {
    it('should allow request within limit', async () => {
      const { redis } = require('../config/redis');
      redis.incr.mockResolvedValue(5);
      redis.expire.mockResolvedValue(1);

      const allowed = await checkRateLimit('test-key', 10, 60000);

      expect(allowed).toBe(true);
      expect(redis.incr).toHaveBeenCalledWith('rate-limit:test-key');
    });

    it('should block request over limit', async () => {
      const { redis } = require('../config/redis');
      redis.incr.mockResolvedValue(11);

      const allowed = await checkRateLimit('test-key', 10, 60000);

      expect(allowed).toBe(false);
    });

    it('should allow request on error', async () => {
      const { redis } = require('../config/redis');
      redis.incr.mockRejectedValue(new Error('Redis error'));

      const allowed = await checkRateLimit('test-key', 10, 60000);

      expect(allowed).toBe(true);
    });
  });

  describe('generateCSRFToken', () => {
    it('should generate unique CSRF tokens', () => {
      const token1 = generateCSRFToken();
      const token2 = generateCSRFToken();

      expect(token1).toBeDefined();
      expect(token2).toBeDefined();
      expect(typeof token1).toBe('string');
      expect(typeof token2).toBe('string');
      expect(token1).not.toBe(token2);
    });
  });

  describe('validateCSRFToken', () => {
    it('should validate correct CSRF token', async () => {
      const { redis } = require('../config/redis');
      redis.get.mockResolvedValue('csrf-token');

      const isValid = await validateCSRFToken('csrf-token', 'session-token');

      expect(isValid).toBe(true);
      expect(redis.get).toHaveBeenCalledWith('csrf:session-token');
    });

    it('should reject incorrect CSRF token', async () => {
      const { redis } = require('../config/redis');
      redis.get.mockResolvedValue('different-token');

      const isValid = await validateCSRFToken('csrf-token', 'session-token');

      expect(isValid).toBe(false);
    });

    it('should return false on error', async () => {
      const { redis } = require('../config/redis');
      redis.get.mockRejectedValue(new Error('Redis error'));

      const isValid = await validateCSRFToken('csrf-token', 'session-token');

      expect(isValid).toBe(false);
    });
  });

  describe('storeCSRFToken', () => {
    it('should store CSRF token successfully', async () => {
      const { redis } = require('../config/redis');
      redis.setex.mockResolvedValue('OK');

      await storeCSRFToken('csrf-token', 'session-token');

      expect(redis.setex).toHaveBeenCalledWith('csrf:session-token', 3600, 'csrf-token');
    });

    it('should handle storage error gracefully', async () => {
      const { redis } = require('../config/redis');
      redis.setex.mockRejectedValue(new Error('Redis error'));

      await expect(storeCSRFToken('csrf-token', 'session-token')).resolves.toBeUndefined();
    });
  });
});
