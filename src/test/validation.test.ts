import {
  loginSchema,
  signupSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  taskSchema,
  updateTaskSchema,
  searchSchema,
  exportSchema,
} from '../validation/schemas';

describe('Validation Schemas', () => {
  describe('loginSchema', () => {
    it('should validate valid login data', () => {
      const validData = {
        email: 'test@example.com',
        password: 'TestPass123',
      };

      const result = loginSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const invalidData = {
        email: 'invalid-email',
        password: 'TestPass123',
      };

      const result = loginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('אימייל לא תקין');
      }
    });

    it('should reject empty password', () => {
      const invalidData = {
        email: 'test@example.com',
        password: '',
      };

      const result = loginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('סיסמה חייבת להכיל לפחות 8 תווים');
      }
    });

    it('should reject short password', () => {
      const invalidData = {
        email: 'test@example.com',
        password: '123',
      };

      const result = loginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('סיסמה חייבת להכיל לפחות 8 תווים');
      }
    });
  });

  describe('signupSchema', () => {
    it('should validate valid signup data', () => {
      const validData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'TestPass123',
        confirmPassword: 'TestPass123',
      };

      const result = signupSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject short name', () => {
      const invalidData = {
        name: 'A',
        email: 'test@example.com',
        password: 'TestPass123',
        confirmPassword: 'TestPass123',
      };

      const result = signupSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('שם חייב להכיל לפחות 2 תווים');
      }
    });

    it('should reject long name', () => {
      const invalidData = {
        name: 'A'.repeat(51),
        email: 'test@example.com',
        password: 'TestPass123',
        confirmPassword: 'TestPass123',
      };

      const result = signupSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('שם לא יכול להיות ארוך מ-50 תווים');
      }
    });

    it('should reject weak password', () => {
      const invalidData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'weakpassword',
        confirmPassword: 'weakpassword',
      };

      const result = signupSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('סיסמה חייבת להכיל אות גדולה, אות קטנה ומספר');
      }
    });

    it('should reject mismatched passwords', () => {
      const invalidData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'TestPass123',
        confirmPassword: 'DifferentPass123',
      };

      const result = signupSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('סיסמאות לא תואמות');
      }
    });
  });

  describe('forgotPasswordSchema', () => {
    it('should validate valid email', () => {
      const validData = {
        email: 'test@example.com',
      };

      const result = forgotPasswordSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const invalidData = {
        email: 'invalid-email',
      };

      const result = forgotPasswordSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('אימייל לא תקין');
      }
    });
  });

  describe('resetPasswordSchema', () => {
    it('should validate valid reset data', () => {
      const validData = {
        token: 'valid-token',
        newPassword: 'NewPass123',
        confirmPassword: 'NewPass123',
      };

      const result = resetPasswordSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject weak password', () => {
      const invalidData = {
        token: 'valid-token',
        newPassword: 'weak',
        confirmPassword: 'weak',
      };

      const result = resetPasswordSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('סיסמה חייבת להכיל אות גדולה, אות קטנה ומספר');
      }
    });

    it('should reject mismatched passwords', () => {
      const invalidData = {
        token: 'valid-token',
        newPassword: 'NewPass123',
        confirmPassword: 'DifferentPass123',
      };

      const result = resetPasswordSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('סיסמאות לא תואמות');
      }
    });
  });

  describe('taskSchema', () => {
    it('should validate valid task data', () => {
      const validData = {
        title: 'Test Task',
        description: 'This is a test task',
      };

      const result = taskSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate task without description', () => {
      const validData = {
        title: 'Test Task',
      };

      const result = taskSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject empty title', () => {
      const invalidData = {
        title: '',
        description: 'This is a test task',
      };

      const result = taskSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('כותרת היא שדה חובה');
      }
    });

    it('should reject long title', () => {
      const invalidData = {
        title: 'A'.repeat(121),
        description: 'This is a test task',
      };

      const result = taskSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('כותרת לא יכולה להיות ארוכה מ-120 תווים');
      }
    });

    it('should reject long description', () => {
      const invalidData = {
        title: 'Test Task',
        description: 'A'.repeat(5001),
      };

      const result = taskSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('תיאור לא יכול להיות ארוך מ-5000 תווים');
      }
    });
  });

  describe('updateTaskSchema', () => {
    it('should validate valid update data', () => {
      const validData = {
        title: 'Updated Task',
        description: 'Updated description',
        assignees: ['507f1f77bcf86cd799439011'],
      };

      const result = updateTaskSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate partial update data', () => {
      const validData = {
        title: 'Updated Task',
      };

      const result = updateTaskSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid assignee ID', () => {
      const invalidData = {
        title: 'Updated Task',
        assignees: ['invalid-id'],
      };

      const result = updateTaskSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('מזהה משתמש לא תקין');
      }
    });

    it('should reject too many assignees', () => {
      const invalidData = {
        title: 'Updated Task',
        assignees: Array(21).fill('507f1f77bcf86cd799439011'),
      };

      const result = updateTaskSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('לא ניתן להוסיף יותר מ-20 משויכים');
      }
    });
  });

  describe('searchSchema', () => {
    it('should validate valid search data', () => {
      const validData = {
        query: 'test',
        page: 1,
        limit: 20,
        sort: 'updatedAt:desc' as const,
        context: 'all' as const,
      };

      const result = searchSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should use default values', () => {
      const validData = {};

      const result = searchSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
        expect(result.data.sort).toBe('updatedAt:desc');
        expect(result.data.context).toBe('all');
      }
    });

    it('should reject invalid sort option', () => {
      const invalidData = {
        sort: 'invalid:sort',
      };

      const result = searchSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject invalid context', () => {
      const invalidData = {
        context: 'invalid',
      };

      const result = searchSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('exportSchema', () => {
    it('should validate valid export data', () => {
      const validData = {
        format: 'csv' as const,
      };

      const result = exportSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate excel format', () => {
      const validData = {
        format: 'excel' as const,
      };

      const result = exportSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate json format', () => {
      const validData = {
        format: 'json' as const,
      };

      const result = exportSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should use default format', () => {
      const validData = {};

      const result = exportSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.format).toBe('csv');
      }
    });

    it('should reject invalid format', () => {
      const invalidData = {
        format: 'invalid',
      };

      const result = exportSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});
