import { Request, Response, NextFunction } from 'express';
import { getSession } from '../utils/auth';
import { logger } from '../utils/logger';
import { User } from '../types';

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      user?: User;
      sessionToken?: string;
    }
  }
}

// Authentication middleware
export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sessionToken = req.cookies?.session || req.headers.authorization?.replace('Bearer ', '');

    if (!sessionToken) {
      res.status(401).json({
        error: {
          code: 401,
          message: 'לא מחובר למערכת',
          requestId: req.headers['x-request-id'] as string || 'unknown',
        },
      });
      return;
    }

    const user = await getSession(sessionToken);
    if (!user) {
      res.status(401).json({
        error: {
          code: 401,
          message: 'סשן פג תוקף או לא תקין',
          requestId: req.headers['x-request-id'] as string || 'unknown',
        },
      });
      return;
    }

    // Get session expiry time from the session we already retrieved
    let sessionExpiry = Date.now() + parseInt(process.env.SESSION_MAX_AGE || '86400000');
    
    // We already have the user, so we can calculate expiry from session duration
    if (user) {
      sessionExpiry = Date.now() + parseInt(process.env.SESSION_MAX_AGE || '86400000');
    }

    // Set session headers for frontend
    res.setHeader('X-Session-Expires-At', new Date(sessionExpiry).toISOString());
    res.setHeader('X-Session-Token', sessionToken);

    req.user = user;
    req.sessionToken = req.sessionToken || sessionToken;
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(500).json({
      error: {
        code: 500,
        message: 'שגיאה באימות המשתמש',
        requestId: req.headers['x-request-id'] as string || 'unknown',
      },
    });
  }
};

// Optional authentication middleware (doesn't fail if no session)
export const optionalAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sessionToken = req.cookies?.session || req.headers.authorization?.replace('Bearer ', '');

    if (sessionToken) {
      const user = await getSession(sessionToken);
      if (user) {
        req.user = user;
        req.sessionToken = sessionToken;
      }
    }

    next();
  } catch (error) {
    logger.error('Optional authentication error:', error);
    // Continue without authentication
    next();
  }
};

// CSRF protection middleware
export const csrfProtection = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Skip CSRF for GET requests
    if (req.method === 'GET') {
      return next();
    }

    const csrfToken = req.headers['x-csrf-token'] as string;
    const sessionToken = req.cookies?.session || req.headers.authorization?.replace('Bearer ', '');

    if (!csrfToken || !sessionToken) {
      res.status(403).json({
        error: {
          code: 403,
          message: 'CSRF token חסר',
          requestId: req.headers['x-request-id'] as string || 'unknown',
        },
      });
      return;
    }

    // Import here to avoid circular dependency
    const { validateCSRFToken } = await import('../utils/auth');
    const isValid = await validateCSRFToken(csrfToken, sessionToken);

    if (!isValid) {
      res.status(403).json({
        error: {
          code: 403,
          message: 'CSRF token לא תקין',
          requestId: req.headers['x-request-id'] as string || 'unknown',
        },
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('CSRF protection error:', error);
    res.status(500).json({
      error: {
        code: 500,
        message: 'שגיאה בבדיקת CSRF',
        requestId: req.headers['x-request-id'] as string || 'unknown',
      },
    });
  }
};

// Rate limiting middleware
export const rateLimit = (limit?: number, windowMs?: number, keyGenerator?: (req: Request) => string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const defaultLimit = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100');
      const defaultWindowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'); // 15 minutes
      
      const actualLimit = limit || defaultLimit;
      const actualWindowMs = windowMs || defaultWindowMs;
      
      const key = keyGenerator ? keyGenerator(req) : `${req.ip}:${req.path}`;
      
      // Import here to avoid circular dependency
      const { checkRateLimit } = await import('../utils/auth');
      const allowed = await checkRateLimit(key, actualLimit, actualWindowMs);

      if (!allowed) {
        res.status(429).json({
          error: {
            code: 429,
            message: 'יותר מדי בקשות, נסה שוב מאוחר יותר',
            requestId: req.headers['x-request-id'] as string || 'unknown',
          },
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('Rate limiting error:', error);
      // Continue if rate limiting fails
      next();
    }
  };
};

// Auth-specific rate limiting middleware
export const authRateLimit = (limit?: number, windowMs?: number) => {
  return rateLimit(
    limit || parseInt(process.env.RATE_LIMIT_AUTH_MAX_REQUESTS || '5'),
    windowMs || parseInt(process.env.RATE_LIMIT_AUTH_WINDOW_MS || '900000')
  );
};

// Request ID middleware
export const requestId = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = req.headers['x-request-id'] as string || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  req.headers['x-request-id'] = requestId;
  res.setHeader('x-request-id', requestId);
  next();
};
