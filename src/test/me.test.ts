import request from 'supertest';
import express from 'express';
import meRoutes from '../routes/me';

const app = express();
app.use(express.json());
app.use('/me', meRoutes);

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

describe('Me Routes', () => {
  describe('GET /me/tasks', () => {
    it('should return my tasks with default pagination', async () => {
      const response = await request(app)
        .get('/me/tasks')
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('items');
      expect(response.body.data).toHaveProperty('page');
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('hasMore');
    });

    it('should return my tasks with custom pagination', async () => {
      const response = await request(app)
        .get('/me/tasks?page=2&limit=10')
        .expect(200);

      expect(response.body.data.page).toBe(2);
      expect(response.body.data.items).toHaveLength(10);
    });

    it('should return my tasks with search query', async () => {
      const response = await request(app)
        .get('/me/tasks?query=test')
        .expect(200);

      expect(response.body).toHaveProperty('data');
    });

    it('should return my tasks with sorting', async () => {
      const response = await request(app)
        .get('/me/tasks?sort=createdAt:desc')
        .expect(200);

      expect(response.body).toHaveProperty('data');
    });
  });

  describe('GET /me/starred', () => {
    it('should return starred tasks', async () => {
      const response = await request(app)
        .get('/me/starred')
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('GET /me/tasks/export', () => {
    it('should export tasks as CSV', async () => {
      const response = await request(app)
        .get('/me/tasks/export?format=csv')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('.csv');
    });

    it('should export tasks as Excel', async () => {
      const response = await request(app)
        .get('/me/tasks/export?format=excel')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('.excel');
    });

    it('should export tasks as JSON', async () => {
      const response = await request(app)
        .get('/me/tasks/export?format=json')
        .expect(200);

      expect(response.headers['content-type']).toContain('application/json');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('.json');
    });

    it('should return 400 for invalid format', async () => {
      const response = await request(app)
        .get('/me/tasks/export?format=invalid')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error.message).toBe('נתונים לא תקינים');
    });

    it('should use CSV as default format', async () => {
      const response = await request(app)
        .get('/me/tasks/export')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('.csv');
    });
  });
});
