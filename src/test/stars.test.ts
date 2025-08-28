import request from 'supertest';
import express from 'express';
import starRoutes from '../routes/stars';

const app = express();
app.use(express.json());
app.use('/tasks', starRoutes);

// Mock authentication middleware
app.use((req, res, next) => {
  req.user = {
    id: '507f1f77bcf86cd799439011',
    email: 'test@example.com',
    name: 'Test User',
    provider: 'credentials' as const,
    createdAt: new Date().toISOString(),
  };
  req.sessionToken = 'mock-session-token';
  next();
});

describe('Star Routes', () => {
  describe('PUT /tasks/:taskId/star', () => {
    it('should return 400 for invalid task ID', async () => {
      const response = await request(app)
        .put('/tasks/invalid-id/star')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error.message).toBe('מזהה משימה לא תקין');
    });

    it('should return 404 for non-existent task', async () => {
      const response = await request(app)
        .put('/tasks/507f1f77bcf86cd799439012/star')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error.message).toBe('המשימה לא נמצאה');
    });
  });

  describe('DELETE /tasks/:taskId/star', () => {
    it('should return 400 for invalid task ID', async () => {
      const response = await request(app)
        .delete('/tasks/invalid-id/star')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error.message).toBe('מזהה משימה לא תקין');
    });

    it('should return 204 for successful star removal', async () => {
      const response = await request(app)
        .delete('/tasks/507f1f77bcf86cd799439012/star')
        .expect(204);

      // Should return no content
      expect(response.body).toEqual({});
    });
  });
});
