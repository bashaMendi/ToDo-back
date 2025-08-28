import pino from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';

const loggerConfig: any = {
  level: process.env.LOG_LEVEL || 'info',
  serializers: {
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
    err: pino.stdSerializers.err,
  },
  formatters: {
    level: (label: string) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    env: process.env.NODE_ENV,
    version: process.env.npm_package_version,
  },
};

if (isDevelopment) {
  loggerConfig.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  };
}

export const logger = pino(loggerConfig);

// Request logger middleware
export const requestLogger = (req: any, res: any, next: any) => {
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
      userId: req.user?.id,
    });
  });

  next();
};

// Error logger
export const errorLogger = (error: Error, req?: any) => {
  logger.error({
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name,
    },
    request: req ? {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userId: req.user?.id,
    } : undefined,
  });
};

export default logger;
