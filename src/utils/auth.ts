import argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { redis } from '../config/redis';
import { logger } from './logger';
import { User } from '../types';
import { sendPasswordResetEmail } from './email';

// In-memory storage for development (fallback when Redis is not available)
const inMemoryStorage = new Map<string, { data: string; expiresAt: number }>();

// Rate limiting statistics
const rateLimitStats = {
  total: 0,
  blocked: 0,
  failures: 0
};

// Cleanup expired entries from in-memory storage
const cleanupExpiredEntries = () => {
  const now = Date.now();
  let cleaned = 0;
  for (const [key, item] of inMemoryStorage.entries()) {
    if (now > item.expiresAt) {
      inMemoryStorage.delete(key);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    logger.debug(`Cleaned up ${cleaned} expired rate limit entries`);
  }
};

// Start cleanup interval
const CLEANUP_INTERVAL = parseInt(process.env.RATE_LIMIT_CLEANUP_INTERVAL || '60000'); // 1 minute
setInterval(cleanupExpiredEntries, CLEANUP_INTERVAL);

// Helper function to get Redis or fallback
const getStorage = () => {
  // Force in-memory storage if REDIS_DISABLED is set
  if (process.env.REDIS_DISABLED === 'true') {
    return inMemoryStorage;
  }
  
  // Use Redis if available and not disabled
  const isRedisAvailable = process.env.NODE_ENV === 'production' || process.env.REDIS_URL;
  const storage = isRedisAvailable ? redis : inMemoryStorage;
  
  return storage;
};

// Helper function to set with expiration
const setWithExpiration = async (key: string, value: string, ttlSeconds: number) => {
  const storage = getStorage();
  
  if (storage === redis) {
    await redis.setEx(key, ttlSeconds, value);
  } else {
    const expiresAt = Date.now() + (ttlSeconds * 1000);
    inMemoryStorage.set(key, { data: value, expiresAt });
  }
};

// Helper function to get value
const getValue = async (key: string): Promise<string | null> => {
  try {
    const storage = getStorage();
    
    if (storage === redis) {
      const value = await redis.get(key);
      return value;
    } else {
      const item = inMemoryStorage.get(key);
      if (!item) return null;
      if (Date.now() > item.expiresAt) {
        inMemoryStorage.delete(key);
        return null;
      }
      return item.data;
    }
  } catch (error) {
    logger.error(`Error getting value for ${key}:`, error);
    throw error;
  }
};

// Helper function to delete value
const deleteValue = async (key: string) => {
  const storage = getStorage();
  if (storage === redis) {
    await redis.del(key);
  } else {
    inMemoryStorage.delete(key);
  }
};

const SESSION_DURATION = parseInt(process.env.SESSION_MAX_AGE || '86400000'); // 24 hours default

// Function to get PEPPER (to ensure it's loaded after dotenv)
const getPEPPER = () => {
  const pepper = process.env.PEPPER || 'default-pepper-key-32-chars-long';

  return pepper;
};

// Session configuration
export const SESSION_CONFIG = {
  name: process.env.SESSION_COOKIE_NAME || 'session',
  secure: process.env.NODE_ENV === 'production' ? (process.env.SESSION_COOKIE_SECURE === 'true') : false,
  httpOnly: process.env.SESSION_COOKIE_HTTPONLY !== 'false', // default true
  sameSite: (process.env.SESSION_COOKIE_SAMESITE as 'lax' | 'strict' | 'none') || 'lax',
  maxAge: SESSION_DURATION,
};

// Hash password with Argon2
export const hashPassword = async (password: string): Promise<string> => {
  try {
    const pepper = getPEPPER();
    const hashedPassword = await argon2.hash(password + pepper, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16, // 64MB
      timeCost: 3, // 3 iterations
      parallelism: 1,
    });
    return hashedPassword;
  } catch (error) {
    logger.error('Error hashing password:', error);
    throw new Error('Failed to hash password');
  }
};

// Verify password
export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  try {
    const pepper = getPEPPER();
    const result = await argon2.verify(hash, password + pepper);
    return result;
  } catch (error) {
    logger.error('Error verifying password:', error);
    return false;
  }
};

// Generate session token
export const generateSessionToken = (): string => {
  return uuidv4();
};

// Create session
export const createSession = async (user: User): Promise<string> => {
  const sessionToken = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION);
  
  const sessionData = {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      provider: user.provider,
    },
    expiresAt: expiresAt.toISOString(),
  };



  await setWithExpiration(
    `session:${sessionToken}`,
    JSON.stringify(sessionData),
    Math.floor(SESSION_DURATION / 1000)
  );

  return sessionToken;
};

// Get session
export const getSession = async (sessionToken: string): Promise<User | null> => {
  try {
    const sessionData = await getValue(`session:${sessionToken}`);
    
    if (!sessionData) {
      return null;
    }

    const session = JSON.parse(sessionData);
    const expiresAt = new Date(session.expiresAt);

    if (expiresAt < new Date()) {
      await deleteValue(`session:${sessionToken}`);
      return null;
    }

    return session.user;
  } catch (error) {
    logger.error('Error getting session:', error);
    return null;
  }
};

// Delete session
export const deleteSession = async (sessionToken: string): Promise<void> => {
  try {
    await deleteValue(`session:${sessionToken}`);
  } catch (error) {
    logger.error('Error deleting session:', error);
  }
};

// Generate password reset token
export const generatePasswordResetToken = (): string => {
  return uuidv4();
};

// Store password reset token
export const storePasswordResetToken = async (email: string, token: string): Promise<void> => {
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  
  await setWithExpiration(
    `password-reset:${token}`,
    JSON.stringify({ email, expiresAt: expiresAt.toISOString() }),
    3600
  );
};

// Get password reset token data
export const getPasswordResetToken = async (token: string): Promise<{ email: string; expiresAt: string } | null> => {
  try {
    const tokenData = await getValue(`password-reset:${token}`);
    if (!tokenData) {
      return null;
    }

    const data = JSON.parse(tokenData);
    const expiresAt = new Date(data.expiresAt);

    if (expiresAt < new Date()) {
      await deleteValue(`password-reset:${token}`);
      return null;
    }

    return data;
  } catch (error) {
    logger.error('Error getting password reset token:', error);
    return null;
  }
};

// Delete password reset token
export const deletePasswordResetToken = async (token: string): Promise<void> => {
  try {
    await deleteValue(`password-reset:${token}`);
  } catch (error) {
    logger.error('Error deleting password reset token:', error);
  }
};

// Check rate limit
export const checkRateLimit = async (key: string, limit: number, windowMs: number): Promise<boolean> => {
  rateLimitStats.total++;
  
  try {
    const storage = getStorage();
    
    if (storage === redis) {
      // Simple Redis-based rate limiting
      const current = await redis.incr(`rate-limit:${key}`);
      if (current === 1) {
        await redis.expire(`rate-limit:${key}`, Math.floor(windowMs / 1000));
      }
      
      const allowed = current <= limit;
      if (!allowed) {
        rateLimitStats.blocked++;
      }
      return allowed;
    } else {
      // Simple in-memory rate limiting
      const item = inMemoryStorage.get(key);
      const now = Date.now();
      
      if (!item || now > item.expiresAt) {
        inMemoryStorage.set(key, { data: '1', expiresAt: now + windowMs });
        return true;
      }
      
      const count = parseInt(item.data) + 1;
      inMemoryStorage.set(key, { data: count.toString(), expiresAt: item.expiresAt });
      
      const allowed = count <= limit;
      if (!allowed) {
        rateLimitStats.blocked++;
      }
      return allowed;
    }
  } catch (error) {
    rateLimitStats.failures++;
    logger.error('Rate limit check error:', error);
    
    // In production, be more strict about rate limiting failures
    const strictMode = process.env.RATE_LIMIT_STRICT_MODE === 'true';
    if (process.env.NODE_ENV === 'production' && strictMode) {
      rateLimitStats.blocked++;
      return false; // Block in production with strict mode
    }
    return true; // Allow in development or non-strict mode
  }
};

// Reset rate limit for a key
export const resetRateLimit = async (key: string): Promise<void> => {
  try {
    const storage = getStorage();
    if (storage === redis) {
      await redis.del(`rate-limit:${key}`);
    } else {
      inMemoryStorage.delete(key);
    }
    logger.info(`Rate limit reset for key: ${key}`);
  } catch (error) {
    logger.error('Rate limit reset error:', error);
  }
};

// Get rate limiting statistics
export const getRateLimitStats = () => ({
  total: rateLimitStats.total,
  blocked: rateLimitStats.blocked,
  failures: rateLimitStats.failures,
  blockedPercentage: rateLimitStats.total > 0 ? (rateLimitStats.blocked / rateLimitStats.total * 100).toFixed(2) : '0.00',
  failurePercentage: rateLimitStats.total > 0 ? (rateLimitStats.failures / rateLimitStats.total * 100).toFixed(2) : '0.00'
});

// Generate CSRF token
export const generateCSRFToken = (): string => {
  return uuidv4();
};

// Validate CSRF token
export const validateCSRFToken = async (token: string, sessionToken: string): Promise<boolean> => {
  try {
    const storedToken = await redis.get(`csrf:${sessionToken}`);
    return storedToken === token;
  } catch (error) {
    logger.error('Error validating CSRF token:', error);
    return false;
  }
};

// Store CSRF token
export const storeCSRFToken = async (token: string, sessionToken: string): Promise<void> => {
  try {
    await setWithExpiration(`csrf:${sessionToken}`, token, 3600); // 1 hour
  } catch (error) {
    logger.error('Error storing CSRF token:', error);
  }
};
