import { logger, requestLogger, errorLogger } from '../utils/logger';

// Mock pino
jest.mock('pino', () => {
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  return jest.fn().mockReturnValue(mockLogger);
});

describe('Logger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('logger', () => {
    it('should log info message', () => {
      const message = 'Test info message';
      logger.info(message);

      expect(logger.info).toHaveBeenCalledWith(message);
    });

    it('should log error message', () => {
      const message = 'Test error message';
      logger.error(message);

      expect(logger.error).toHaveBeenCalledWith(message);
    });

    it('should log structured data', () => {
      const data = {
        userId: '123',
        action: 'login',
        timestamp: new Date().toISOString(),
      };

      logger.info(data);

      expect(logger.info).toHaveBeenCalledWith(data);
    });
  });

  describe('requestLogger', () => {
    it('should log request information', () => {
      const req = {
        method: 'GET',
        url: '/api/tasks',
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('Mozilla/5.0'),
        user: { id: '123' },
        headers: { 'x-request-id': 'req-123' },
      };

      const res = {
        statusCode: 200,
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'finish') {
            callback();
          }
        }),
      };

      const next = jest.fn();

      requestLogger(req as any, res as any, next);

      expect(next).toHaveBeenCalled();
      expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
    });

    it('should handle request without user', () => {
      const req = {
        method: 'POST',
        url: '/api/auth/login',
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('Mozilla/5.0'),
        headers: { 'x-request-id': 'req-456' },
      };

      const res = {
        statusCode: 401,
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'finish') {
            callback();
          }
        }),
      };

      const next = jest.fn();

      requestLogger(req as any, res as any, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('errorLogger', () => {
    it('should log error with request context', () => {
      const error = new Error('Test error');
      const req = {
        method: 'POST',
        url: '/api/tasks',
        ip: '127.0.0.1',
        user: { id: '123' },
      };

      errorLogger(error, req as any);

      expect(logger.error).toHaveBeenCalledWith({
        error: {
          message: 'Test error',
          stack: error.stack,
          name: 'Error',
        },
        request: {
          method: 'POST',
          url: '/api/tasks',
          ip: '127.0.0.1',
          userId: '123',
        },
      });
    });

    it('should log error without request context', () => {
      const error = new Error('Test error');

      errorLogger(error);

      expect(logger.error).toHaveBeenCalledWith({
        error: {
          message: 'Test error',
          stack: error.stack,
          name: 'Error',
        },
      });
    });

    it('should handle error without stack trace', () => {
      const error = new Error('Test error');
      delete error.stack;

      errorLogger(error);

      expect(logger.error).toHaveBeenCalledWith({
        error: {
          message: 'Test error',
          stack: undefined,
          name: 'Error',
        },
      });
    });
  });
});
