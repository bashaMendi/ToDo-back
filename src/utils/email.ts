import nodemailer from 'nodemailer';
import { logger } from './logger';
import { EmailData } from '../types';

// Create transporter
const createTransporter = () => {
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (isDevelopment) {
    // Use Ethereal for development
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: process.env.MAIL_USER || 'test@example.com',
        pass: process.env.MAIL_PASS || 'testpass',
      },
    });
  }

  // Use SendGrid for production
  return nodemailer.createTransport({
    host: process.env.MAIL_HOST || 'smtp.sendgrid.net',
    port: 587,
    secure: false,
    auth: {
      user: process.env.MAIL_USER || 'apikey',
      pass: process.env.MAIL_PASS,
    },
  });
};

// Send email
export const sendEmail = async (emailData: EmailData): Promise<void> => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: process.env.MAIL_FROM || 'noreply@shared-tasks.com',
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text || emailData.html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
    };

    const info = await transporter.sendMail(mailOptions);

    if (process.env.NODE_ENV === 'development') {
      logger.info('Email sent (development):', {
        messageId: info.messageId,
        previewUrl: nodemailer.getTestMessageUrl(info),
      });
    } else {
      logger.info('Email sent:', {
        messageId: info.messageId,
        to: emailData.to,
        subject: emailData.subject,
      });
    }
  } catch (error) {
    logger.error('Email sending error:', error);
    throw new Error('Failed to send email');
  }
};

// Send welcome email
export const sendWelcomeEmail = async (email: string, name: string): Promise<void> => {
  const welcomeEmail: EmailData = {
    to: email,
    subject: 'ברוכים הבאים למערכת ניהול משימות',
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>ברוכים הבאים!</h2>
        <p>שלום ${name},</p>
        <p>תודה שנרשמת למערכת ניהול המשימות המשותפת שלנו.</p>
        <p>כעת תוכל:</p>
        <ul>
          <li>ליצור משימות חדשות</li>
          <li>לערוך משימות קיימות</li>
          <li>לסמן משימות בכוכב</li>
          <li>לייצא את המשימות שלך</li>
        </ul>
        <p>בברכה,<br>צוות מערכת ניהול משימות</p>
      </div>
    `,
  };

  await sendEmail(welcomeEmail);
};

// Send password reset email
export const sendPasswordResetEmail = async (email: string, name: string, resetUrl: string): Promise<void> => {
  const resetEmail: EmailData = {
    to: email,
    subject: 'איפוס סיסמה - מערכת ניהול משימות',
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>איפוס סיסמה</h2>
        <p>שלום ${name},</p>
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
  };

  await sendEmail(resetEmail);
};

// Send task assignment notification
export const sendTaskAssignmentEmail = async (email: string, name: string, taskTitle: string, assignedBy: string): Promise<void> => {
  const assignmentEmail: EmailData = {
    to: email,
    subject: 'הוקצתה לך משימה חדשה',
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>משימה חדשה</h2>
        <p>שלום ${name},</p>
        <p>הוקצתה לך משימה חדשה: <strong>${taskTitle}</strong></p>
        <p>הוקצתה על ידי: ${assignedBy}</p>
        <p>כנס למערכת כדי לצפות במשימה ולעדכן את הסטטוס שלה.</p>
        <p>בברכה,<br>צוות מערכת ניהול משימות</p>
      </div>
    `,
  };

  await sendEmail(assignmentEmail);
};
