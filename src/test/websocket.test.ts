import { WebSocketService } from '../services/websocketService';
import { Task, User } from '../types';

// Mock Socket.io
jest.mock('socket.io', () => {
  const mockSocket = {
    id: 'test-socket-id',
    join: jest.fn(),
    on: jest.fn(),
  };

  const mockIO = {
    on: jest.fn(),
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
    engine: {
      clientsCount: 5,
    },
    sockets: {
      adapter: {
        rooms: {
          get: jest.fn().mockReturnValue(new Set(['socket1', 'socket2'])),
        },
      },
    },
  };

  return {
    Server: jest.fn().mockImplementation(() => mockIO),
  };
});

// Mock logger
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('WebSocketService', () => {
  const mockTask: Task = {
    id: '507f1f77bcf86cd799439012',
    title: 'Test Task',
    description: 'Test Description',
    createdBy: {
      id: '507f1f77bcf86cd799439011',
      email: 'test@example.com',
      name: 'Test User',
      provider: 'credentials',
      createdAt: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    assignees: [],
    version: 1,
    isStarred: false,
  };

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

  describe('initialize', () => {
    it('should initialize WebSocket server', () => {
      const mockServer = {} as any;
      
      expect(() => WebSocketService.initialize(mockServer)).not.toThrow();
    });
  });

  describe('getIO', () => {
    it('should throw error if not initialized', () => {
      expect(() => WebSocketService.getIO()).toThrow('WebSocket server not initialized');
    });
  });

  describe('emitTaskCreated', () => {
    it('should emit task created event', () => {
      const mockServer = {} as any;
      WebSocketService.initialize(mockServer);
      
      expect(() => WebSocketService.emitTaskCreated(mockTask)).not.toThrow();
    });
  });

  describe('emitTaskUpdated', () => {
    it('should emit task updated event', () => {
      const mockServer = {} as any;
      WebSocketService.initialize(mockServer);
      
      const patch = { title: 'Updated Title' };
      expect(() => WebSocketService.emitTaskUpdated('task-id', patch)).not.toThrow();
    });
  });

  describe('emitTaskDeleted', () => {
    it('should emit task deleted event', () => {
      const mockServer = {} as any;
      WebSocketService.initialize(mockServer);
      
      expect(() => WebSocketService.emitTaskDeleted('task-id')).not.toThrow();
    });
  });

  describe('emitTaskDuplicated', () => {
    it('should emit task duplicated event', () => {
      const mockServer = {} as any;
      WebSocketService.initialize(mockServer);
      
      expect(() => WebSocketService.emitTaskDuplicated('source-task-id', mockTask)).not.toThrow();
    });
  });

  describe('emitTaskAssigned', () => {
    it('should emit task assigned event', () => {
      const mockServer = {} as any;
      WebSocketService.initialize(mockServer);
      
      expect(() => WebSocketService.emitTaskAssigned('task-id', 'assignee-id')).not.toThrow();
    });
  });

  describe('emitStarAdded', () => {
    it('should emit star added event', () => {
      const mockServer = {} as any;
      WebSocketService.initialize(mockServer);
      
      expect(() => WebSocketService.emitStarAdded('task-id', 'user-id')).not.toThrow();
    });
  });

  describe('emitStarRemoved', () => {
    it('should emit star removed event', () => {
      const mockServer = {} as any;
      WebSocketService.initialize(mockServer);
      
      expect(() => WebSocketService.emitStarRemoved('task-id', 'user-id')).not.toThrow();
    });
  });

  describe('sendPersonalNotification', () => {
    it('should send personal notification', () => {
      const mockServer = {} as any;
      WebSocketService.initialize(mockServer);
      
      const data = { message: 'Test notification' };
      expect(() => WebSocketService.sendPersonalNotification('user-id', 'test.event', data)).not.toThrow();
    });
  });

  describe('getConnectedUsersCount', () => {
    it('should return connected users count', () => {
      const mockServer = {} as any;
      WebSocketService.initialize(mockServer);
      
      const count = WebSocketService.getConnectedUsersCount();
      expect(count).toBe(5);
    });

    it('should return 0 if not initialized', () => {
      // Reset the service
      (WebSocketService as any).io = null;
      
      const count = WebSocketService.getConnectedUsersCount();
      expect(count).toBe(0);
    });
  });

  describe('getRoomMembersCount', () => {
    it('should return room members count', () => {
      const mockServer = {} as any;
      WebSocketService.initialize(mockServer);
      
      const count = WebSocketService.getRoomMembersCount('test-room');
      expect(count).toBe(2);
    });

    it('should return 0 if not initialized', () => {
      // Reset the service
      (WebSocketService as any).io = null;
      
      const count = WebSocketService.getRoomMembersCount('test-room');
      expect(count).toBe(0);
    });
  });

  describe('broadcast', () => {
    it('should broadcast event to all clients', () => {
      const mockServer = {} as any;
      WebSocketService.initialize(mockServer);
      
      const data = { message: 'Broadcast message' };
      expect(() => WebSocketService.broadcast('test.event', data)).not.toThrow();
    });
  });
});
