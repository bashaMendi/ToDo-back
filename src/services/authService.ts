import { prisma } from '../config/database';
import { hashPassword, verifyPassword, createSession, deleteSession, generatePasswordResetToken, storePasswordResetToken, getPasswordResetToken, deletePasswordResetToken } from '../utils/auth';
import { logger } from '../utils/logger';
import { User, LoginCredentials, SignupCredentials, AuthResponse } from '../types';
import { sendEmail } from '../utils/email';

export class AuthService {
  // Sign up new user
  static async signup(credentials: SignupCredentials): Promise<AuthResponse> {
    try {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: credentials.email },
      });

      if (existingUser) {
        throw new Error('כתובת האימייל כבר קיימת במערכת');
      }

      // Hash password
      const hashedPassword = await hashPassword(credentials.password);

      // Create user
      const user = await prisma.user.create({
        data: {
          email: credentials.email,
          name: credentials.name,
          passwordHash: hashedPassword,
          provider: 'credentials',
        },
      });

      // Create session
      const sessionToken = await createSession({
        id: user.id,
        email: user.email,
        name: user.name,
        provider: user.provider as 'credentials' | 'google',
        createdAt: user.createdAt.toISOString(),
      });

      logger.info(`User signed up: ${user.email}`);

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          provider: user.provider as 'credentials' | 'google',
          createdAt: user.createdAt.toISOString(),
        },
        sessionToken,
      };
    } catch (error) {
      logger.error('Signup error:', error);
      throw error;
    }
  }

  // Login user
  static async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      
      
      // Find user
      const user = await prisma.user.findUnique({
        where: { email: credentials.email },
      });

      if (!user || !user.passwordHash) {
        throw new Error('אימייל או סיסמה שגויים');
      }

      // Verify password
      const isValidPassword = await verifyPassword(credentials.password, user.passwordHash);
      
      if (!isValidPassword) {
        throw new Error('אימייל או סיסמה שגויים');
      }

      // Create session
      const sessionToken = await createSession({
        id: user.id,
        email: user.email,
        name: user.name,
        provider: user.provider as 'credentials' | 'google',
        createdAt: user.createdAt.toISOString(),
      });



      logger.info(`User logged in: ${user.email}`);

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          provider: user.provider as 'credentials' | 'google',
          createdAt: user.createdAt.toISOString(),
        },
        sessionToken,
      };
    } catch (error) {
      logger.error('Login error:', error);
      throw error;
    }
  }

  // Logout user
  static async logout(sessionToken: string): Promise<void> {
    try {
      await deleteSession(sessionToken);
      logger.info('User logged out');
    } catch (error) {
      logger.error('Logout error:', error);
      throw error;
    }
  }

  // Get current user
  static async getCurrentUser(userId: string): Promise<User> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new Error('משתמש לא נמצא');
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        provider: user.provider as 'credentials' | 'google',
        createdAt: user.createdAt.toISOString(),
      };
    } catch (error) {
      logger.error('Get current user error:', error);
      throw error;
    }
  }

  // Forgot password
  static async forgotPassword(email: string): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        // Don't reveal if user exists or not
        logger.info(`Password reset requested for non-existent email: ${email}`);
        return;
      }

      // Generate reset token
      const resetToken = generatePasswordResetToken();
      await storePasswordResetToken(email, resetToken);

      // Send email
      const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
      
      await sendEmail({
        to: email,
        subject: 'איפוס סיסמה - מערכת ניהול משימות',
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>איפוס סיסמה</h2>
            <p>שלום ${user.name},</p>
            <p>קיבלנו בקשה לאיפוס הסיסמה שלך.</p>
            <p>לחץ על הקישור הבא כדי לאפס את הסיסמה:</p>
            <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px;">
              אפס סיסמה
            </a>
            <p>הקישור תקף למשך שעה אחת בלבד.</p>
            <p>אם לא ביקשת לאפס את הסיסמה, אנא התעלם מהודעה זו.</p>
            <p>בברכה,<br>צוות מערכת ניהול משימות</p>
          </div>
        `,
        text: `
          איפוס סיסמה - מערכת ניהול משימות
          
          שלום ${user.name},
          
          קיבלנו בקשה לאיפוס הסיסמה שלך.
          לחץ על הקישור הבא כדי לאפס את הסיסמה:
          ${resetUrl}
          
          הקישור תקף למשך שעה אחת בלבד.
          אם לא ביקשת לאפס את הסיסמה, אנא התעלם מהודעה זו.
          
          בברכה,
          צוות מערכת ניהול משימות
        `,
      });

      logger.info(`Password reset email sent to: ${email}`);
    } catch (error) {
      logger.error('Forgot password error:', error);
      throw error;
    }
  }

  // Reset password
  static async resetPassword(token: string, newPassword: string): Promise<void> {
    try {
      // Get token data
      const tokenData = await getPasswordResetToken(token);
      if (!tokenData) {
        throw new Error('טוקן לא תקין או פג תוקף');
      }

      // Find user
      const user = await prisma.user.findUnique({
        where: { email: tokenData.email },
      });

      if (!user) {
        throw new Error('משתמש לא נמצא');
      }

      // Hash new password
      const hashedPassword = await hashPassword(newPassword);

      // Update password
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: hashedPassword },
      });

      // Delete token
      await deletePasswordResetToken(token);

      logger.info(`Password reset successful for: ${user.email}`);
    } catch (error) {
      logger.error('Reset password error:', error);
      throw error;
    }
  }

  // Google OAuth (placeholder for future implementation)
  static async googleOAuth(profile: any): Promise<AuthResponse> {
    try {
      // Find or create user
      let user = await prisma.user.findUnique({
        where: { email: profile.emails[0].value },
      });

      if (!user) {
        // Create new user
        user = await prisma.user.create({
          data: {
            email: profile.emails[0].value,
            name: profile.displayName,
            provider: 'google',
          },
        });
      }

      // Create session
      const sessionToken = await createSession({
        id: user.id,
        email: user.email,
        name: user.name,
        provider: user.provider as 'credentials' | 'google',
        createdAt: user.createdAt.toISOString(),
      });

      logger.info(`Google OAuth login: ${user.email}`);

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          provider: user.provider as 'credentials' | 'google',
          createdAt: user.createdAt.toISOString(),
        },
      };
    } catch (error) {
      logger.error('Google OAuth error:', error);
      throw error;
    }
  }
}
