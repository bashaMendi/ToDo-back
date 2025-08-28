import { z } from 'zod';
import { VALIDATION_RULES } from '../types';

// Auth validation schemas
export const loginSchema = z.object({
  email: z.string().min(1, 'אימייל הוא שדה חובה').email('אימייל לא תקין'),
  password: z
    .string()
    .min(1, 'סיסמה היא שדה חובה')
    .min(VALIDATION_RULES.PASSWORD_MIN_LENGTH, 'סיסמה חייבת להכיל לפחות 8 תווים'),
});

export const signupSchema = z
  .object({
    name: z
      .string()
      .min(1, 'שם הוא שדה חובה')
      .min(VALIDATION_RULES.NAME_MIN_LENGTH, 'שם חייב להכיל לפחות 2 תווים')
      .max(VALIDATION_RULES.NAME_MAX_LENGTH, 'שם לא יכול להיות ארוך מ-50 תווים'),
    email: z.string().min(1, 'אימייל הוא שדה חובה').email('אימייל לא תקין'),
    password: z
      .string()
      .min(1, 'סיסמה היא שדה חובה')
      .min(VALIDATION_RULES.PASSWORD_MIN_LENGTH, 'סיסמה חייבת להכיל לפחות 8 תווים')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'סיסמה חייבת להכיל אות גדולה, אות קטנה ומספר'
      ),
    confirmPassword: z.string().min(1, 'אימות סיסמה הוא שדה חובה'),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: 'סיסמאות לא תואמות',
    path: ['confirmPassword'],
  });

export const forgotPasswordSchema = z.object({
  email: z.string().min(1, 'אימייל הוא שדה חובה').email('אימייל לא תקין'),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'טוקן הוא שדה חובה'),
    newPassword: z
      .string()
      .min(1, 'סיסמה חדשה היא שדה חובה')
      .min(VALIDATION_RULES.PASSWORD_MIN_LENGTH, 'סיסמה חייבת להכיל לפחות 8 תווים')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'סיסמה חייבת להכיל אות גדולה, אות קטנה ומספר'
      ),
    confirmPassword: z.string().min(1, 'אימות סיסמה הוא שדה חובה'),
  })
  .refine(data => data.newPassword === data.confirmPassword, {
    message: 'סיסמאות לא תואמות',
    path: ['confirmPassword'],
  });

// Task validation schemas
export const taskSchema = z.object({
  title: z
    .string()
    .min(1, 'כותרת היא שדה חובה')
    .max(VALIDATION_RULES.TITLE_MAX_LENGTH, 'כותרת לא יכולה להיות ארוכה מ-120 תווים')
    .trim(),
  description: z
    .string()
    .min(1, 'תיאור הוא שדה חובה')
    .max(VALIDATION_RULES.DESCRIPTION_MAX_LENGTH, 'תיאור לא יכול להיות ארוך מ-5000 תווים'),
});

export const updateTaskSchema = z.object({
  title: z
    .string()
    .min(1, 'כותרת היא שדה חובה')
    .max(VALIDATION_RULES.TITLE_MAX_LENGTH, 'כותרת לא יכולה להיות ארוכה מ-120 תווים')
    .trim()
    .optional(), // Optional for partial updates, but if provided must be valid
  description: z
    .string()
    .max(VALIDATION_RULES.DESCRIPTION_MAX_LENGTH, 'תיאור לא יכול להיות ארוך מ-5000 תווים')
    .optional(), // Optional for partial updates, but if provided must be valid
  assignees: z
    .array(z.string().regex(/^[0-9a-fA-F]{24}$/, 'מזהה משתמש לא תקין'))
    .max(VALIDATION_RULES.MAX_ASSIGNEES, 'לא ניתן להוסיף יותר מ-20 משויכים')
    .optional(),
}).refine((data) => {
  // At least one field must be provided for update
  return data.title !== undefined || data.description !== undefined || data.assignees !== undefined;
}, {
  message: 'חובה לספק לפחות שדה אחד לעדכון',
  path: ['title', 'description', 'assignees'],
});

// Search validation schema
export const searchSchema = z.object({
  query: z.string().optional(),
  page: z.number().min(VALIDATION_RULES.MIN_PAGE).default(1),
  limit: z.number().min(1).max(VALIDATION_RULES.MAX_PAGE_SIZE).default(VALIDATION_RULES.DEFAULT_PAGE_SIZE),
  sort: z
    .enum(['updatedAt:desc', 'createdAt:desc', 'title:asc'])
    .default('updatedAt:desc'),
  context: z.enum(['all', 'mine', 'starred']).default('all'),
});

// Export search schema (allows larger limits for export)
export const exportSearchSchema = z.object({
  query: z.string().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(10000).default(1000), // Allow up to 10,000 for export
  sort: z
    .enum(['updatedAt:desc', 'createdAt:desc', 'title:asc'])
    .default('updatedAt:desc'),
  context: z.enum(['all', 'mine', 'starred']).default('mine'),
});

// Export validation schema
export const exportSchema = z.object({
  format: z.enum(['csv', 'json', 'excel']).default('csv'),
});

// Type exports
export type LoginFormData = z.infer<typeof loginSchema>;
export type SignupFormData = z.infer<typeof signupSchema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
export type TaskFormData = z.infer<typeof taskSchema>;
export type UpdateTaskFormData = z.infer<typeof updateTaskSchema>;
export type SearchFormData = z.infer<typeof searchSchema>;
export type ExportSearchFormData = z.infer<typeof exportSearchSchema>;
export type ExportFormData = z.infer<typeof exportSchema>;
