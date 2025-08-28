import { createClient } from 'redis';
import { logger } from '../utils/logger';

// Function to get Redis configuration
const getRedisConfig = () => {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const isRedisAvailable = !!process.env.REDIS_URL;
  
  return { redisUrl, isRedisAvailable };
};

const { redisUrl, isRedisAvailable } = getRedisConfig();

// Debug logging


export const redis = createClient({
  url: redisUrl,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        logger.error('Redis connection failed after 10 retries');
        return new Error('Redis connection failed');
      }
      return Math.min(retries * 100, 3000);
    },
  },
});

redis.on('error', (err) => {
  logger.error('Redis Client Error:', err);
});

redis.on('connect', () => {
  logger.info('Redis connected successfully');
});

redis.on('ready', () => {
  logger.info('Redis client ready');
});

redis.on('end', () => {
  logger.info('Redis client disconnected');
});

// Connect to Redis
export const connectRedis = async () => {
  // Skip Redis if explicitly disabled
  if (process.env.REDIS_DISABLED === 'true') {
  
    return;
  }
  
  const { isRedisAvailable } = getRedisConfig();

  
  if (!isRedisAvailable) {

    return;
  }
  
  try {
    await redis.connect();
    logger.info('Connected to Redis');
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    
    // In production, you can choose to fail or continue with in-memory
    if (process.env.NODE_ENV === 'production' && process.env.REDIS_REQUIRED === 'true') {
      throw error;
    } else {
      logger.warn('Continuing without Redis - using in-memory fallback');
    }
  }
};

// Disconnect from Redis
export const disconnectRedis = async () => {
  if (!isRedisAvailable) {
    return;
  }
  
  try {
    await redis.disconnect();
  } catch (error) {
    logger.error('Failed to disconnect from Redis:', error);
  }
};

// Graceful shutdown
process.on('beforeExit', async () => {
  await disconnectRedis();
});

export default redis;
