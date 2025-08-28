import { Router, Request, Response } from 'express';
import { AuthService } from '../services/authService';
import { authenticate, rateLimit, requestId, authRateLimit } from '../middleware/auth';
import { loginSchema, signupSchema, forgotPasswordSchema, resetPasswordSchema } from '../validation/schemas';
import { logger } from '../utils/logger';
import { generateCSRFToken, storeCSRFToken } from '../utils/auth';

const router = Router();

// Apply middleware
router.use(requestId);

// Rate limiting for auth endpoints
const authLimiter = authRateLimit(); // default auth limiter
const loginLimiter = authRateLimit(20, 15 * 60 * 1000); // 20 login attempts per 15 minutes

// Signup
router.post('/signup', authLimiter, async (req: Request, res: Response) => {
  try {
    // Log request headers and environment variables
    

    // Validate input
    const validatedData = signupSchema.parse(req.body) as import('../types').SignupCredentials;

    // Create user and session
    const result = await AuthService.signup(validatedData);

    // Set session cookie
    res.cookie('session', result.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' || process.env.FORCE_SECURE_COOKIES === 'true',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    // Set session headers for frontend
    const sessionExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    res.setHeader('X-Session-Expires-At', sessionExpiresAt.toISOString());
    if (result.sessionToken) {
      res.setHeader('X-Session-Token', result.sessionToken);
    }

    // Generate CSRF token
    const csrfToken = generateCSRFToken();
    if (result.sessionToken) {
      await storeCSRFToken(csrfToken, result.sessionToken);
    }

    return res.status(201).json({
      data: result,
      csrfToken,
    });
  } catch (error: any) {
    logger.error('Signup error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: {
          code: 400,
          message: 'נתונים לא תקינים',
          requestId: req.headers['x-request-id'] as string,
          field: error.errors[0]?.path?.join('.'),
        },
      });
    } else {
      return res.status(400).json({
        error: {
          code: 400,
          message: error.message || 'שגיאה ביצירת משתמש',
          requestId: req.headers['x-request-id'] as string,
        },
      });
    }
  }
});

// Login
router.post('/login', loginLimiter, async (req: Request, res: Response) => {
  try {


    // Validate input
    const validatedData = loginSchema.parse(req.body) as import('../types').LoginCredentials;

    // Authenticate user
    const result = await AuthService.login(validatedData);

    // Set session cookie
    res.cookie('session', result.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' || process.env.FORCE_SECURE_COOKIES === 'true',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    // Set session headers for frontend
    const sessionExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    res.setHeader('X-Session-Expires-At', sessionExpiresAt.toISOString());
    if (result.sessionToken) {
      res.setHeader('X-Session-Token', result.sessionToken);
    }

    // Generate CSRF token
    const csrfToken = generateCSRFToken();
    if (result.sessionToken) {
      await storeCSRFToken(csrfToken, result.sessionToken);
    }

    return res.status(200).json({
      data: result,
      csrfToken,
    });
  } catch (error: any) {
    logger.error('Login error:', error);
    
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: {
          code: 400,
          message: 'נתונים לא תקינים',
          requestId: req.headers['x-request-id'] as string,
          field: error.errors[0]?.path?.join('.'),
        },
      });
    } else {
      return res.status(401).json({
        error: {
          code: 401,
          message: error.message || 'אימייל או סיסמה שגויים',
          requestId: req.headers['x-request-id'] as string,
        },
      });
    }
  }
});

// Logout
router.post('/logout', authenticate, async (req: Request, res: Response) => {
  try {
    if (req.sessionToken) {
      await AuthService.logout(req.sessionToken);
    }

    // Clear session cookie
    res.clearCookie('session');

    res.status(204).send();
  } catch (error: any) {
    logger.error('Logout error:', error);
    res.status(500).json({
      error: {
        code: 500,
        message: 'שגיאה בהתנתקות',
        requestId: req.headers['x-request-id'] as string,
      },
    });
  }
});

// Refresh session
router.post('/refresh', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.sessionToken || !req.user) {
      return res.status(401).json({
        error: {
          code: 401,
          message: 'סשן לא תקין',
          requestId: req.headers['x-request-id'] as string,
        },
      });
    }

    // Create new session with extended expiry
    const { createSession, deleteSession } = require('../utils/auth');
    const newSessionToken = await createSession(req.user);
    const sessionExpiresAt = new Date(Date.now() + parseInt(process.env.SESSION_MAX_AGE || '86400000'));

    // Set new session cookie
    res.cookie('session', newSessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' || process.env.FORCE_SECURE_COOKIES === 'true',
      sameSite: 'lax',
      maxAge: parseInt(process.env.SESSION_MAX_AGE || '86400000'),
    });

    // Set session headers
    res.setHeader('X-Session-Expires-At', sessionExpiresAt.toISOString());
    res.setHeader('X-Session-Token', newSessionToken);
    res.setHeader('X-Session-Refreshed', 'true');

    // Delete old session
    await deleteSession(req.sessionToken);

    return res.status(200).json({
      data: {
        message: 'סשן חודש בהצלחה',
        sessionExpiresAt: sessionExpiresAt.toISOString(),
        refreshed: true,
      },
    });
  } catch (error: any) {
    logger.error('Session refresh error:', error);
    return res.status(500).json({
      error: {
        code: 500,
        message: 'שגיאה ברענון הסשן',
        requestId: req.headers['x-request-id'] as string,
      },
    });
  }
});

// Get current user
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const user = await AuthService.getCurrentUser(req.user!.id);

    res.status(200).json({
      data: { user },
    });
  } catch (error: any) {
    logger.error('Get current user error:', error);
    res.status(500).json({
      error: {
        code: 500,
        message: 'שגיאה בקבלת פרטי משתמש',
        requestId: req.headers['x-request-id'] as string,
      },
    });
  }
});

// Google OAuth (placeholder)
router.get('/google', (req: Request, res: Response) => {
  res.status(501).json({
    error: {
      code: 501,
      message: 'Google OAuth לא נתמך כרגע',
      requestId: req.headers['x-request-id'] as string,
    },
  });
});

// Google OAuth callback (placeholder)
router.get('/google/callback', (req: Request, res: Response) => {
  res.status(501).json({
    error: {
      code: 501,
      message: 'Google OAuth לא נתמך כרגע',
      requestId: req.headers['x-request-id'] as string,
    },
  });
});

// Forgot password
router.post('/forgot', authLimiter, async (req: Request, res: Response) => {
  try {
    // Validate input
    const validatedData = forgotPasswordSchema.parse(req.body);

    // Send password reset email
    await AuthService.forgotPassword(validatedData.email);

    // Always return success (don't reveal if email exists)
    res.status(204).send();
  } catch (error: any) {
    logger.error('Forgot password error:', error);
    
    if (error.name === 'ZodError') {
      res.status(400).json({
        error: {
          code: 400,
          message: 'נתונים לא תקינים',
          requestId: req.headers['x-request-id'] as string,
          field: error.errors[0]?.path?.join('.'),
        },
      });
    } else {
      // Still return success to avoid email enumeration
      res.status(204).send();
    }
  }
});

// Reset password
router.post('/reset', authLimiter, async (req: Request, res: Response) => {
  try {
    // Validate input
    const validatedData = resetPasswordSchema.parse(req.body);

    // Reset password
    await AuthService.resetPassword(validatedData.token, validatedData.newPassword);

    res.status(204).send();
  } catch (error: any) {
    logger.error('Reset password error:', error);
    
    if (error.name === 'ZodError') {
      res.status(400).json({
        error: {
          code: 400,
          message: 'נתונים לא תקינים',
          requestId: req.headers['x-request-id'] as string,
          field: error.errors[0]?.path?.join('.'),
        },
      });
    } else {
      res.status(400).json({
        error: {
          code: 400,
          message: error.message || 'שגיאה באיפוס סיסמה',
          requestId: req.headers['x-request-id'] as string,
        },
      });
    }
  }
});

// Get session status
router.get('/session-status', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.sessionToken || !req.user) {
      return res.status(401).json({
        error: {
          code: 401,
          message: 'סשן לא תקין',
          requestId: req.headers['x-request-id'] as string,
        },
      });
    }

    // Get session expiry time
    const { getValue } = require('../utils/auth');
    const sessionData = await getValue(`session:${req.sessionToken}`);
    let sessionExpiry = Date.now() + parseInt(process.env.SESSION_MAX_AGE || '86400000');
    
    if (sessionData) {
      try {
        const parsedData = JSON.parse(sessionData);
        sessionExpiry = new Date(parsedData.expiresAt).getTime();
      } catch (error) {
    
      }
    }

    const timeUntilExpiry = sessionExpiry - Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    const thirtyMinutes = 30 * 60 * 1000;

    return res.status(200).json({
      data: {
        user: {
          id: req.user.id,
          email: req.user.email,
          name: req.user.name,
        },
        session: {
          token: req.sessionToken,
          expiresAt: new Date(sessionExpiry).toISOString(),
          timeUntilExpiry: Math.round(timeUntilExpiry / 1000), // seconds
          timeUntilExpiryMinutes: Math.round(timeUntilExpiry / 60000), // minutes
          needsRefresh: timeUntilExpiry < thirtyMinutes,
          warning: timeUntilExpiry < fiveMinutes,
          valid: true,
        },
      },
    });
  } catch (error: any) {
    logger.error('Session status error:', error);
    return res.status(500).json({
      error: {
        code: 500,
        message: 'שגיאה בבדיקת סטטוס הסשן',
        requestId: req.headers['x-request-id'] as string,
      },
    });
  }
});

export default router;
