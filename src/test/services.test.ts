import { AuthService } from '../services/authService';
import { TaskService } from '../services/taskService';
import { StarService } from '../services/starService';
import { User, CreateTaskData, UpdateTaskData } from '../types';

// Mock Prisma
jest.mock('../config/database', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    task: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    taskStar: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
    taskAudit: {
      create: jest.fn(),
    },
    passwordReset: {
      create: jest.fn(),
    },
  },
}));

// Mock Redis
jest.mock('../config/redis', () => ({
  redis: {
    setex: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
  },
}));

// Mock WebSocket service
jest.mock('../services/websocketService', () => ({
  WebSocketService: {
    emitTaskCreated: jest.fn(),
    emitTaskUpdated: jest.fn(),
    emitTaskDeleted: jest.fn(),
    emitStarAdded: jest.fn(),
    emitStarRemoved: jest.fn(),
  },
}));

// Mock logger
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('AuthService', () => {
  const mockUser: User = {
    id: '507f1f77bcf86cd799439011',
    email: 'test@example.com',
    name: 'Test User',
    provider: 'credentials',
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('signup', () => {
    it('should create a new user successfully', async () => {
      const { prisma } = require('../config/database');
      const { redis } = require('../config/redis');

      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        ...mockUser,
        passwordHash: 'hashed-password',
        provider: 'credentials',
      });
      redis.setex.mockResolvedValue('OK');

      const credentials = {
        email: 'test@example.com',
        name: 'Test User',
        password: 'TestPass123',
      };

      const result = await AuthService.signup(credentials);

      expect(result).toHaveProperty('user');
      expect(result.user.email).toBe(credentials.email);
      expect(result.user.name).toBe(credentials.name);
      expect(prisma.user.create).toHaveBeenCalled();
    });

    it('should throw error if user already exists', async () => {
      const { prisma } = require('../config/database');

      prisma.user.findUnique.mockResolvedValue(mockUser);

      const credentials = {
        email: 'test@example.com',
        name: 'Test User',
        password: 'TestPass123',
      };

      await expect(AuthService.signup(credentials)).rejects.toThrow(
        'כתובת האימייל כבר קיימת במערכת'
      );
    });
  });

  describe('login', () => {
    it('should authenticate user successfully', async () => {
      const { prisma } = require('../config/database');
      const { redis } = require('../config/redis');

      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        passwordHash: 'hashed-password',
      });
      redis.setex.mockResolvedValue('OK');

      // Mock verifyPassword to return true
      jest.doMock('../utils/auth', () => ({
        verifyPassword: jest.fn().mockResolvedValue(true),
        createSession: jest.fn().mockResolvedValue('session-token'),
      }));

      const credentials = {
        email: 'test@example.com',
        password: 'TestPass123',
      };

      const result = await AuthService.login(credentials);

      expect(result).toHaveProperty('user');
      expect(result.user.email).toBe(credentials.email);
    });

    it('should throw error for invalid credentials', async () => {
      const { prisma } = require('../config/database');

      prisma.user.findUnique.mockResolvedValue(null);

      const credentials = {
        email: 'test@example.com',
        password: 'WrongPass123',
      };

      await expect(AuthService.login(credentials)).rejects.toThrow(
        'אימייל או סיסמה שגויים'
      );
    });
  });
});

describe('TaskService', () => {
  const mockUser: User = {
    id: '507f1f77bcf86cd799439011',
    email: 'test@example.com',
    name: 'Test User',
    provider: 'credentials',
    createdAt: new Date().toISOString(),
  };

  const mockTask = {
    id: '507f1f77bcf86cd799439012',
    title: 'Test Task',
    description: 'Test Description',
    createdBy: mockUser.id,
    createdAt: new Date(),
    updatedAt: new Date(),
    assignees: [],
    version: 1,
    deletedAt: null,
    creator: mockUser,
    assigneeUsers: [],
    stars: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createTask', () => {
    it('should create a new task successfully', async () => {
      const { prisma } = require('../config/database');

      prisma.task.create.mockResolvedValue(mockTask);
      prisma.taskAudit.create.mockResolvedValue({});

      const taskData: CreateTaskData = {
        title: 'Test Task',
        description: 'Test Description',
      };

      const result = await TaskService.createTask(taskData, mockUser);

      expect(result).toHaveProperty('id');
      expect(result.title).toBe(taskData.title);
      expect(result.description).toBe(taskData.description);
      expect(prisma.task.create).toHaveBeenCalled();
      expect(prisma.taskAudit.create).toHaveBeenCalled();
    });
  });

  describe('getTasks', () => {
    it('should return tasks with pagination', async () => {
      const { prisma } = require('../config/database');

      prisma.task.findMany.mockResolvedValue([mockTask]);
      prisma.task.count.mockResolvedValue(1);

      const filters = {
        page: 1,
        limit: 20,
        context: 'all' as const,
      };

      const result = await TaskService.getTasks(filters, mockUser);

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('page');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('hasMore');
      expect(Array.isArray(result.items)).toBe(true);
    });
  });
});

describe('StarService', () => {
  const mockUser: User = {
    id: '507f1f77bcf86cd799439011',
    email: 'test@example.com',
    name: 'Test User',
    provider: 'credentials',
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('addStar', () => {
    it('should add star to task successfully', async () => {
      const { prisma } = require('../config/database');

      prisma.task.findFirst.mockResolvedValue({
        id: '507f1f77bcf86cd799439012',
        deletedAt: null,
      });
      prisma.taskStar.findUnique.mockResolvedValue(null);
      prisma.taskStar.create.mockResolvedValue({});

      await StarService.addStar('507f1f77bcf86cd799439012', mockUser);

      expect(prisma.taskStar.create).toHaveBeenCalled();
    });

    it('should throw error if task not found', async () => {
      const { prisma } = require('../config/database');

      prisma.task.findFirst.mockResolvedValue(null);

      await expect(
        StarService.addStar('507f1f77bcf86cd799439012', mockUser)
      ).rejects.toThrow('המשימה לא נמצאה');
    });
  });

  describe('removeStar', () => {
    it('should remove star from task successfully', async () => {
      const { prisma } = require('../config/database');

      prisma.taskStar.deleteMany.mockResolvedValue({ count: 1 });

      await StarService.removeStar('507f1f77bcf86cd799439012', mockUser);

      expect(prisma.taskStar.deleteMany).toHaveBeenCalled();
    });
  });
});
