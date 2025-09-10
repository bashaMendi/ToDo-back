import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import dotenv from 'dotenv';
import { logger } from './utils/logger';
import { connectRedis } from './config/redis';
import { WebSocketService } from './services/websocketService';
import { prisma } from './config/database';

// Import routes
import authRoutes from './routes/auth';
import taskRoutes from './routes/tasks';
import starRoutes from './routes/stars';
import meRoutes from './routes/me';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);

// Environment detection
const isDevelopment = process.env.NODE_ENV !== 'production';

// Initialize WebSocket
WebSocketService.initialize(server);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "http://localhost:3000", "http://localhost:3001", "wss://localhost:3001"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      frameAncestors: ["'none'"],
    },
  },
  hsts: false, // Disable HSTS in development
  crossOriginEmbedderPolicy: false, // Disable in development
}));

// CORS configuration
const defaultOrigins = isDevelopment 
  ? ['http://localhost:3000', 'http://localhost:3001']
  : []; // In production, must be set via ALLOWED_ORIGINS env var

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || defaultOrigins;

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Request-ID', 'If-Match', 'ETag'],
  exposedHeaders: ['X-CSRF-Token', 'X-Session-Expires-At', 'X-Session-Token', 'ETag'],
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));



// Cookie parser
app.use(cookieParser());

// Additional CORS handling for preflight requests
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-CSRF-Token, X-Request-ID, If-Match, ETag');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Expose-Headers', 'X-CSRF-Token, X-Session-Expires-At, X-Session-Token, ETag');
  
  if (req.method === 'OPTIONS') {
    logger.info('CORS preflight request handled');
    res.sendStatus(200);
  } else {
    next();
  }
});

// Request logging
app.use((req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info({
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    });
  });
  
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
  });
});

// WebSocket status endpoint
app.get('/ws-status', (req, res) => {
  const { WebSocketService } = require('./services/websocketService');
  const connectedClients = WebSocketService.getConnectedUsersCount();
  const authenticatedUsers = WebSocketService.getAuthenticatedUsersCount();
  const roomMembers = WebSocketService.getRoomMembersCount('board:all');
  const connectionStats = WebSocketService.getConnectionStats();
  
  res.status(200).json({
    websocket: {
      connected: true,
      connectedClients,
      authenticatedUsers,
      roomMembers,
      room: 'board:all',
      timestamp: new Date().toISOString(),
      stats: connectionStats
    }
  });
});

// Reset rate limit endpoint (development only)
app.post('/reset-rate-limit', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Not available in production' });
  }
  
  try {
    const { resetRateLimit } = require('./utils/auth');
    const { ip } = req;
    
    // Reset rate limit for login endpoint
    await resetRateLimit(`${ip}:/auth/login`);
    
    return res.status(200).json({
      message: 'Rate limit reset successfully',
      ip,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to reset rate limit',
      timestamp: new Date().toISOString()
    });
  }
});

// Rate limiting statistics endpoint
app.get('/rate-limit-stats', (req, res) => {
  if (process.env.NODE_ENV === 'production' && !req.headers['x-admin-key']) {
    return res.status(403).json({ error: 'Admin access required in production' });
  }
  
  try {
    const { getRateLimitStats } = require('./utils/auth');
    const stats = getRateLimitStats();
    
    return res.status(200).json({
      rateLimiting: {
        ...stats,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
      }
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to get rate limit stats',
      timestamp: new Date().toISOString()
    });
  }
});

// Search Performance Endpoint
app.get('/search-performance', (req, res) => {
  if (process.env.NODE_ENV === 'production' && !req.headers['x-admin-key']) {
    return res.status(403).json({ error: 'Admin access required in production' });
  }
  
  try {
    const { getRateLimitStats } = require('./utils/auth');
    const rateLimitStats = getRateLimitStats();
    
    return res.status(200).json({
      search: {
        performance: {
          cacheHitRate: 'N/A', // Would need to implement cache hit tracking
          averageResponseTime: 'N/A', // Would need to implement timing
          totalSearches: rateLimitStats.total,
          blockedSearches: rateLimitStats.blocked,
          timestamp: new Date().toISOString(),
          environment: process.env.NODE_ENV || 'development'
        },
        rateLimiting: rateLimitStats
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to get search performance stats', timestamp: new Date().toISOString() });
  }
});

// Session Management Endpoint
app.get('/session-management', (req, res) => {
  if (process.env.NODE_ENV === 'production' && !req.headers['x-admin-key']) {
    return res.status(403).json({ error: 'Admin access required in production' });
  }
  
  try {
    const sessionConfig = {
      maxAge: parseInt(process.env.SESSION_MAX_AGE || '86400000'),
      maxAgeHours: Math.round(parseInt(process.env.SESSION_MAX_AGE || '86400000') / (1000 * 60 * 60)),
      cookieName: process.env.SESSION_COOKIE_NAME || 'session',
      secure: process.env.NODE_ENV === 'production' || process.env.FORCE_SECURE_COOKIES === 'true',
      httpOnly: process.env.SESSION_COOKIE_HTTPONLY !== 'false',
      sameSite: process.env.SESSION_COOKIE_SAMESITE || 'lax',
      autoRefreshThreshold: 30, // minutes
      warningThreshold: 5, // minutes
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    };
    
    // Check storage type
    const { getStorage } = require('./utils/auth');
    const storage = getStorage();
    const storageType = storage === require('./config/redis').redis ? 'Redis' : 'In-Memory';
    
    return res.status(200).json({
      sessionManagement: {
        config: sessionConfig,
        storage: {
          type: storageType,
          redisDisabled: process.env.REDIS_DISABLED === 'true',
          redisRequired: process.env.REDIS_REQUIRED === 'true',
          redisUrl: process.env.REDIS_URL ? 'configured' : 'not configured'
        },
        features: {
          autoRefresh: true,
          sessionWarning: true,
          sessionRefresh: true,
          sessionStatus: true,
          csrfProtection: true,
          rateLimiting: true
        },
        endpoints: {
          refresh: 'POST /auth/refresh',
          status: 'GET /auth/session-status',
          logout: 'POST /auth/logout'
        }
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to get session management info', timestamp: new Date().toISOString() });
  }
});

// API routes
app.use('/auth', authRoutes);
app.use('/tasks', taskRoutes);
app.use('/tasks', starRoutes); // Stars are nested under tasks
app.use('/me', meRoutes);

// Sync endpoint for WebSocket reconnection
app.get('/sync', async (req, res) => {
  try {
    const since = req.query.since as string;
    
    if (!since) {
      return res.status(400).json({
        error: {
          code: 400,
          message: 'Missing since parameter',
          requestId: req.headers['x-request-id'] as string || 'unknown',
        },
      });
    }

    // Validate timestamp format
    const sinceDate = new Date(since);
    if (isNaN(sinceDate.getTime())) {
      return res.status(400).json({
        error: {
          code: 400,
          message: 'Invalid timestamp format. Use ISO 8601 format (e.g., 2023-12-01T10:00:00.000Z)',
          requestId: req.headers['x-request-id'] as string || 'unknown',
        },
      });
    }

    // Get tasks updated since the given timestamp
    const updatedTasks = await prisma.task.findMany({
      where: {
        updatedAt: {
          gt: sinceDate
        },
        isDeleted: false
      },
      include: {
        creator: {
          select: { id: true, name: true, email: true },
        },
        updater: {
          select: { id: true, name: true, email: true },
        },
        stars: {
          select: { id: true, userId: true },
        },
      },
      orderBy: {
        updatedAt: 'desc'
      },
      take: 100 // Limit to prevent large responses
    });

    // Get deleted tasks since the timestamp (for soft deletes)
    const deletedTasks = await prisma.task.findMany({
      where: {
        updatedAt: {
          gt: sinceDate
        },
        isDeleted: true
      },
      select: {
        id: true,
        updatedAt: true,
        version: true
      },
      orderBy: {
        updatedAt: 'desc'
      },
      take: 50 // Limit deleted tasks
    });

    // Transform tasks to match API format
    const transformedTasks = await Promise.all(updatedTasks.map(async (task) => {
      const assigneeUsers = task.assignees.length
        ? await prisma.user.findMany({
            where: { id: { in: task.assignees } },
            select: { id: true, name: true, email: true, createdAt: true, provider: true },
          })
        : [] as any[];

      return {
        id: task.id,
        title: task.title,
        description: task.description || '',
        createdBy: {
          id: task.creator.id,
          name: task.creator.name,
          email: task.creator.email,
          provider: 'credentials' as const,
          createdAt: task.createdAt.toISOString(),
        },
        createdAt: task.createdAt.toISOString(),
        updatedBy: task.updater ? {
          id: task.updater.id,
          name: task.updater.name,
          email: task.updater.email,
          provider: 'credentials' as const,
          createdAt: task.createdAt.toISOString(),
        } : undefined,
        updatedAt: task.updatedAt.toISOString(),
        assignees: assigneeUsers.map(user => ({
          id: user.id,
          name: user.name,
          email: user.email,
          provider: (user as any).provider || 'credentials',
          createdAt: (user as any).createdAt.toISOString(),
        })),
        version: task.version,
        isStarred: task.stars.length > 0,
      };
    }));

    // Get current timestamp for next sync
    const currentTimestamp = new Date().toISOString();

    return res.status(200).json({
      data: {
        since,
        currentTimestamp,
        updatedTasks: transformedTasks,
        deletedTasks: deletedTasks.map(task => ({
          id: task.id,
          deletedAt: task.updatedAt.toISOString(),
          version: task.version
        })),
        summary: {
          totalUpdated: transformedTasks.length,
          totalDeleted: deletedTasks.length,
          hasMore: transformedTasks.length === 100 || deletedTasks.length === 50
        }
      },
    });
  } catch (error) {
    logger.error('Sync endpoint error:', error);
    return res.status(500).json({
      error: {
        code: 500,
        message: 'Internal server error during sync',
        requestId: req.headers['x-request-id'] as string || 'unknown',
      },
    });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: {
      code: 404,
      message: 'Endpoint not found',
      requestId: req.headers['x-request-id'] as string || 'unknown',
    },
  });
});

// Global error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Global error handler:', error);
  
  res.status(500).json({
    error: {
      code: 500,
      message: 'Internal server error',
      requestId: req.headers['x-request-id'] as string || 'unknown',
    },
  });
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  try {
    // Shutdown WebSocket server
    const { WebSocketService } = require('./services/websocketService');
    await WebSocketService.shutdown();
    
    // Close HTTP server
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
    
    // Force close after 30 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start server
const PORT = parseInt(process.env.PORT || '3001');
const HOST = isDevelopment ? 'localhost' : '0.0.0.0';

const startServer = async () => {
  try {
    // Test database connection
    await prisma.$connect();

    // Connect to Redis
    await connectRedis();

         // Start HTTP server
     server.listen(PORT, HOST, () => {
       const serverUrl = isDevelopment ? `http://localhost:${PORT}` : `http://0.0.0.0:${PORT}`;
       logger.info(`Server running on ${HOST}:${PORT}`);
       logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
       logger.info(`Health check: ${serverUrl}/health`);
     });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();