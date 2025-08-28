import request from 'supertest';
import express from 'express';
import taskRoutes from '../routes/tasks';

const app = express();
app.use(express.json());
app.use('/tasks', taskRoutes);

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

describe('Task Routes', () => {
  describe('POST /tasks', () => {
    it('should create a new task with valid data', async () => {
      const taskData = {
        title: 'Test Task',
        description: 'This is a test task',
      };

      const response = await request(app)
        .post('/tasks')
        .send(taskData)
        .expect(201);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('title', taskData.title);
      expect(response.body.data).toHaveProperty('description', taskData.description);
    });

    it('should return 400 for missing title', async () => {
      const taskData = {
        description: 'This is a test task',
      };

      const response = await request(app)
        .post('/tasks')
        .send(taskData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error.message).toBe('נתונים לא תקינים');
    });

    it('should return 400 for empty title', async () => {
      const taskData = {
        title: '',
        description: 'This is a test task',
      };

      const response = await request(app)
        .post('/tasks')
        .send(taskData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error.message).toBe('נתונים לא תקינים');
    });

    it('should return 400 for title too long', async () => {
      const taskData = {
        title: 'a'.repeat(121), // 121 characters
        description: 'This is a test task',
      };

      const response = await request(app)
        .post('/tasks')
        .send(taskData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error.message).toBe('נתונים לא תקינים');
    });
  });

  describe('GET /tasks', () => {
    it('should return tasks with default pagination', async () => {
      const response = await request(app)
        .get('/tasks')
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('items');
      expect(response.body.data).toHaveProperty('page');
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('hasMore');
    });

    it('should return tasks with custom pagination', async () => {
      const response = await request(app)
        .get('/tasks?page=2&limit=10')
        .expect(200);

      expect(response.body.data.page).toBe(2);
      expect(response.body.data.items).toHaveLength(10);
    });

    it('should return tasks with search query', async () => {
      const response = await request(app)
        .get('/tasks?query=test')
        .expect(200);

      expect(response.body).toHaveProperty('data');
    });

    it('should return tasks with sorting', async () => {
      const response = await request(app)
        .get('/tasks?sort=createdAt:desc')
        .expect(200);

      expect(response.body).toHaveProperty('data');
    });
  });

  describe('GET /tasks/:id', () => {
    it('should return 400 for invalid task ID', async () => {
      const response = await request(app)
        .get('/tasks/invalid-id')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error.message).toBe('מזהה משימה לא תקין');
    });

    it('should return 404 for non-existent task', async () => {
      const response = await request(app)
        .get('/tasks/507f1f77bcf86cd799439012')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error.message).toBe('המשימה לא נמצאה');
    });
  });

  describe('PATCH /tasks/:id', () => {
    it('should return 400 for invalid task ID', async () => {
      const updateData = {
        title: 'Updated Task',
      };

      const response = await request(app)
        .patch('/tasks/invalid-id')
        .send(updateData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error.message).toBe('מזהה משימה לא תקין');
    });

    it('should return 400 for invalid update data', async () => {
      const updateData = {
        title: '', // Empty title
      };

      const response = await request(app)
        .patch('/tasks/507f1f77bcf86cd799439012')
        .send(updateData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error.message).toBe('נתונים לא תקינים');
    });
  });

  describe('DELETE /tasks/:id', () => {
    it('should return 400 for invalid task ID', async () => {
      const response = await request(app)
        .delete('/tasks/invalid-id')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error.message).toBe('מזהה משימה לא תקין');
    });
  });

  describe('POST /tasks/:id/duplicate', () => {
    it('should return 400 for invalid task ID', async () => {
      const response = await request(app)
        .post('/tasks/invalid-id/duplicate')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error.message).toBe('מזהה משימה לא תקין');
    });
  });

  describe('PUT /tasks/:id/assign/me', () => {
    it('should return 400 for invalid task ID', async () => {
      const response = await request(app)
        .put('/tasks/invalid-id/assign/me')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error.message).toBe('מזהה משימה לא תקין');
    });
  });
});
