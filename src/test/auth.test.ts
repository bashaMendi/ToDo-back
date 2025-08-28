import request from 'supertest';
import express from 'express';
import authRoutes from '../routes/auth';

const app = express();
app.use(express.json());
app.use('/auth', authRoutes);

describe('Auth Routes', () => {
  describe('POST /auth/signup', () => {
    it('should create a new user with valid data', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'TestPass123',
        confirmPassword: 'TestPass123',
      };

      const response = await request(app)
        .post('/auth/signup')
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.user.name).toBe(userData.name);
    });

    it('should return 400 for invalid email', async () => {
      const userData = {
        name: 'Test User',
        email: 'invalid-email',
        password: 'TestPass123',
        confirmPassword: 'TestPass123',
      };

      const response = await request(app)
        .post('/auth/signup')
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error.message).toBe('נתונים לא תקינים');
    });

    it('should return 400 for weak password', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'weak',
        confirmPassword: 'weak',
      };

      const response = await request(app)
        .post('/auth/signup')
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error.message).toBe('נתונים לא תקינים');
    });

    it('should return 400 for mismatched passwords', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'TestPass123',
        confirmPassword: 'DifferentPass123',
      };

      const response = await request(app)
        .post('/auth/signup')
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error.message).toBe('נתונים לא תקינים');
    });
  });

  describe('POST /auth/login', () => {
    it('should return 400 for invalid email format', async () => {
      const loginData = {
        email: 'invalid-email',
        password: 'TestPass123',
      };

      const response = await request(app)
        .post('/auth/login')
        .send(loginData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error.message).toBe('נתונים לא תקינים');
    });

    it('should return 400 for missing password', async () => {
      const loginData = {
        email: 'test@example.com',
        password: '',
      };

      const response = await request(app)
        .post('/auth/login')
        .send(loginData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error.message).toBe('נתונים לא תקינים');
    });
  });

  describe('POST /auth/forgot', () => {
    it('should return 400 for invalid email format', async () => {
      const forgotData = {
        email: 'invalid-email',
      };

      const response = await request(app)
        .post('/auth/forgot')
        .send(forgotData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error.message).toBe('נתונים לא תקינים');
    });
  });
});
