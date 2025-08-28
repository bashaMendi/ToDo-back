import { Router, Request, Response } from 'express';
import { TaskService } from '../services/taskService';
import { authenticate, rateLimit } from '../middleware/auth';
import { taskSchema, updateTaskSchema, searchSchema } from '../validation/schemas';
import { logger } from '../utils/logger';
import { checkRateLimit } from '../utils/auth';

const router = Router();

// Rate limiting for search endpoints
const searchRateLimit = async (req: Request, res: Response, next: Function) => {
  const key = `search:${req.ip}`;
  const allowed = await checkRateLimit(key, 30, 60 * 1000); // 30 requests per minute
  
  if (!allowed) {
    return res.status(429).json({ 
      error: 'Too many search requests. Please try again later.',
      retryAfter: 60 
    });
  }
  
  return next();
};

// Apply middleware
router.use(authenticate);

// Rate limiting for task operations
const taskRateLimit = rateLimit(60, 60 * 1000); // 60 requests per minute
const writeRateLimit = rateLimit(30, 60 * 1000); // 30 write operations per minute

// Get tasks (context-aware)
router.get('/', searchRateLimit, async (req: Request, res: Response) => {
  try {
    
    
    // Parse and validate query parameters
    const query = {
      search: req.query.query as string || '',
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      sortBy: (req.query.sort?.toString().split(':')[0] as 'createdAt' | 'updatedAt' | 'title' | 'createdBy') || 'updatedAt',
      sortOrder: (req.query.sort?.toString().split(':')[1] as 'asc' | 'desc') || 'desc',
      context: (req.query.context as 'all' | 'mine' | 'starred') || 'all',
    };

    const validatedQuery = searchSchema.parse(query);

    // Convert to TaskFilters format
    const taskFilters = {
      search: validatedQuery.query || '',
      page: validatedQuery.page,
      limit: validatedQuery.limit,
      sortBy: validatedQuery.sort.split(':')[0] as 'createdAt' | 'updatedAt' | 'title' | 'createdBy',
      sortOrder: validatedQuery.sort.split(':')[1] as 'asc' | 'desc',
      context: validatedQuery.context,
    };

    // Get tasks
    const result = await TaskService.getTasks(taskFilters, req.user!);

    return res.status(200).json({
      data: result,
    });
  } catch (error: any) {
    logger.error('Get tasks error:', error);
    
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: {
          code: 400,
          message: 'פרמטרים לא תקינים',
          requestId: req.headers['x-request-id'] as string,
          field: error.errors[0]?.path?.join('.'),
        },
      });
    } else {
      return res.status(500).json({
        error: {
          code: 500,
          message: 'שגיאה בקבלת משימות',
          requestId: req.headers['x-request-id'] as string,
        },
      });
    }
  }
});

// Get single task
router.get('/:id', taskRateLimit, async (req: Request, res: Response) => {
  try {
    const taskId = req.params.id;
    
    if (!taskId || !/^[0-9a-fA-F]{24}$/.test(taskId)) {
      return res.status(400).json({
        error: {
          code: 400,
          message: 'מזהה משימה לא תקין',
          requestId: req.headers['x-request-id'] as string,
        },
      });
    }

    const task = await TaskService.getTask(taskId, req.user!);

    // Set ETag for caching
    const etag = `"${task.version}-${task.updatedAt}"`;
    res.setHeader('ETag', etag);

    return res.status(200).json({
      data: task,
    });
  } catch (error: any) {
    logger.error('Get task error:', error);
    
    if (error.message === 'המשימה לא נמצאה') {
      return res.status(404).json({
        error: {
          code: 404,
          message: 'המשימה לא נמצאה',
          requestId: req.headers['x-request-id'] as string,
        },
      });
    } else {
      return res.status(500).json({
        error: {
          code: 500,
          message: 'שגיאה בקבלת משימה',
          requestId: req.headers['x-request-id'] as string,
        },
      });
    }
  }
});

// Create task
router.post('/', writeRateLimit, async (req: Request, res: Response) => {
  try {
    // Validate input
    const validatedData = taskSchema.parse(req.body) as import('../types').CreateTaskData;

    // Create task
    const task = await TaskService.createTask(validatedData, req.user!);

    return res.status(201).json({
      data: task,
    });
  } catch (error: any) {
    logger.error('Create task error:', error);
    
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: {
          code: 400,
          message: 'נתונים לא תקינים',
          requestId: req.headers['x-request-id'] as string,
          field: error.errors[0]?.path?.join('.'),
        },
      });
    } else {
      return res.status(500).json({
        error: {
          code: 500,
          message: 'שגיאה ביצירת משימה',
          requestId: req.headers['x-request-id'] as string,
        },
      });
    }
  }
});

// Update task
router.patch('/:id', writeRateLimit, async (req: Request, res: Response) => {
  try {
    const taskId = req.params.id;
    
    if (!taskId || !/^[0-9a-fA-F]{24}$/.test(taskId)) {
      return res.status(400).json({
        error: {
          code: 400,
          message: 'מזהה משימה לא תקין',
          requestId: req.headers['x-request-id'] as string,
        },
      });
    }

    // Validate input
    const validatedData = updateTaskSchema.parse(req.body);

    // Check version conflict
    const ifMatch = req.headers['if-match'] as string;
    let expectedVersion: number | undefined;
    
    if (ifMatch) {
      const match = ifMatch.match(/^"(\d+)-/);
      if (match && match[1]) {
        expectedVersion = parseInt(match[1]);
      }
    }
    

    // Update task
    const task = await TaskService.updateTask(taskId, validatedData as any, req.user!, expectedVersion);

    // Set new ETag
    const etag = `"${task.version}-${task.updatedAt}"`;
    res.setHeader('ETag', etag);



    return res.status(200).json({
      data: task,
    });
  } catch (error: any) {
    logger.error('Update task error:', error);
    
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: {
          code: 400,
          message: 'נתונים לא תקינים',
          requestId: req.headers['x-request-id'] as string,
          field: error.errors[0]?.path?.join('.'),
        },
      });
    } else if (error.message === 'המשימה לא נמצאה') {
      return res.status(404).json({
        error: {
          code: 404,
          message: 'המשימה לא נמצאה',
          requestId: req.headers['x-request-id'] as string,
        },
      });
    } else if (error.message === 'גרסת המשימה לא תואמת') {
      return res.status(409).json({
        error: {
          code: 409,
          message: 'גרסת המשימה לא תואמת',
          requestId: req.headers['x-request-id'] as string,
        },
      });
    } else {
      return res.status(500).json({
        error: {
          code: 500,
          message: 'שגיאה בעדכון משימה',
          requestId: req.headers['x-request-id'] as string,
        },
      });
    }
  }
});

// Delete task (soft delete)
router.delete('/:id', writeRateLimit, async (req: Request, res: Response) => {
  try {
    const taskId = req.params.id;
    
    if (!taskId || !/^[0-9a-fA-F]{24}$/.test(taskId)) {
      return res.status(400).json({
        error: {
          code: 400,
          message: 'מזהה משימה לא תקין',
          requestId: req.headers['x-request-id'] as string,
        },
      });
    }

    // Delete task
    const result = await TaskService.deleteTask(taskId, req.user!);

    return res.status(202).json({
      data: result,
    });
  } catch (error: any) {
    logger.error('Delete task error:', error);
    
    if (error.message === 'המשימה לא נמצאה') {
      return res.status(404).json({
        error: {
          code: 404,
          message: 'המשימה לא נמצאה',
          requestId: req.headers['x-request-id'] as string,
        },
      });
    } else {
      return res.status(500).json({
        error: {
          code: 500,
          message: 'שגיאה במחיקת משימה',
          requestId: req.headers['x-request-id'] as string,
        },
      });
    }
  }
});

// Duplicate task
router.post('/:id/duplicate', writeRateLimit, async (req: Request, res: Response) => {
  try {
    const taskId = req.params.id;
    
    if (!taskId || !/^[0-9a-fA-F]{24}$/.test(taskId)) {
      return res.status(400).json({
        error: {
          code: 400,
          message: 'מזהה משימה לא תקין',
          requestId: req.headers['x-request-id'] as string,
        },
      });
    }

    // Duplicate task
    const task = await TaskService.duplicateTask(taskId, req.user!);

    return res.status(201).json({
      data: task,
    });
  } catch (error: any) {
    logger.error('Duplicate task error:', error);
    
    if (error.message === 'המשימה לא נמצאה') {
      return res.status(404).json({
        error: {
          code: 404,
          message: 'המשימה לא נמצאה',
          requestId: req.headers['x-request-id'] as string,
        },
      });
    } else {
      return res.status(500).json({
        error: {
          code: 500,
          message: 'שגיאה בשכפול משימה',
          requestId: req.headers['x-request-id'] as string,
        },
      });
    }
  }
});

// Assign self to task
router.put('/:id/assign/me', writeRateLimit, async (req: Request, res: Response) => {
  try {
    const taskId = req.params.id;
    
    if (!taskId || !/^[0-9a-fA-F]{24}$/.test(taskId)) {
      return res.status(400).json({
        error: {
          code: 400,
          message: 'מזהה משימה לא תקין',
          requestId: req.headers['x-request-id'] as string,
        },
      });
    }

    // Assign self to task
    await TaskService.assignSelfToTask(taskId, req.user!);

    return res.status(204).send();
  } catch (error: any) {
    logger.error('Assign self to task error:', error);
    
    if (error.message === 'המשימה לא נמצאה') {
      return res.status(404).json({
        error: {
          code: 404,
          message: 'המשימה לא נמצאה',
          requestId: req.headers['x-request-id'] as string,
        },
      });
    } else {
      return res.status(500).json({
        error: {
          code: 500,
          message: 'שגיאה בהקצאת משימה',
          requestId: req.headers['x-request-id'] as string,
        },
      });
    }
  }
});

export default router;
