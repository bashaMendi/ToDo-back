import { Router, Request, Response } from 'express';
import { StarService } from '../services/starService';
import { authenticate, rateLimit, requestId } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

// Apply middleware
router.use(requestId);
router.use(authenticate);

// Rate limiting for star operations
const starRateLimit = rateLimit(30, 60 * 1000); // 30 requests per minute

// Add star to task
router.put('/:taskId/star', starRateLimit, async (req: Request, res: Response) => {
  try {
    const taskId = req.params.taskId;
    
    if (!taskId || !/^[0-9a-fA-F]{24}$/.test(taskId)) {
      return res.status(400).json({
        error: {
          code: 400,
          message: 'מזהה משימה לא תקין',
          requestId: req.headers['x-request-id'] as string,
        },
      });
    }

    // Add star
    await StarService.addStar(taskId, req.user!);

    return res.status(204).send();
  } catch (error: any) {
    logger.error('Add star error:', error);
    
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
          message: 'שגיאה בהוספת כוכב',
          requestId: req.headers['x-request-id'] as string,
        },
      });
    }
  }
});

// Remove star from task
router.delete('/:taskId/star', starRateLimit, async (req: Request, res: Response) => {
  try {
    const taskId = req.params.taskId;
    
    if (!taskId || !/^[0-9a-fA-F]{24}$/.test(taskId)) {
      return res.status(400).json({
        error: {
          code: 400,
          message: 'מזהה משימה לא תקין',
          requestId: req.headers['x-request-id'] as string,
        },
      });
    }

    // Remove star
    await StarService.removeStar(taskId, req.user!);

    return res.status(204).send();
  } catch (error: any) {
    logger.error('Remove star error:', error);
    
    return res.status(500).json({
      error: {
        code: 500,
        message: 'שגיאה בהסרת כוכב',
        requestId: req.headers['x-request-id'] as string,
      },
    });
  }
});

export default router;
