import { Router, Request, Response } from 'express';
import { TaskService } from '../services/taskService';
import { StarService } from '../services/starService';
import { authenticate, rateLimit, requestId } from '../middleware/auth';
import { searchSchema, exportSchema, exportSearchSchema } from '../validation/schemas';
import { logger } from '../utils/logger';
import { ExportFormat } from '../types';

const router = Router();

// Apply middleware
router.use(requestId);
router.use(authenticate);

// Rate limiting
const meRateLimit = rateLimit(60, 60 * 1000); // 60 requests per minute
const exportRateLimit = rateLimit(10, 60 * 1000); // 10 exports per minute

// Get current user info
router.get('/', meRateLimit, async (req: Request, res: Response) => {
  try {
    // Return current user info
    res.status(200).json({
      data: {
        id: req.user!.id,
        name: req.user!.name,
        email: req.user!.email,
        provider: req.user!.provider,
      },
    });
  } catch (error: any) {
    logger.error('Get current user error:', error);
    res.status(500).json({
      error: {
        code: 500,
        message: 'שגיאה בקבלת פרטי משתמש',
        requestId: req.headers['x-request-id'] as string,
      },
    });
  }
});

// Get my tasks
router.get('/tasks', meRateLimit, async (req: Request, res: Response) => {
  try {
    // Parse and validate query parameters
    const query = {
      search: req.query.query as string || '',
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      sortBy: req.query.sort?.toString().split(':')[0] as any || 'updatedAt',
      sortOrder: req.query.sort?.toString().split(':')[1] as any || 'desc',
      context: 'mine' as const, // Force context to 'mine'
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

    res.status(200).json({
      data: result,
    });
  } catch (error: any) {
    logger.error('Get my tasks error:', error);
    
    if (error.name === 'ZodError') {
      res.status(400).json({
        error: {
          code: 400,
          message: 'פרמטרים לא תקינים',
          requestId: req.headers['x-request-id'] as string,
          field: error.errors[0]?.path?.join('.'),
        },
      });
    } else {
      res.status(500).json({
        error: {
          code: 500,
          message: 'שגיאה בקבלת המשימות שלי',
          requestId: req.headers['x-request-id'] as string,
        },
      });
    }
  }
});

// Get starred tasks
router.get('/starred', meRateLimit, async (req: Request, res: Response) => {
  try {
    // Get starred tasks
    const tasks = await StarService.getStarredTasks(req.user!);

    res.status(200).json({
      data: tasks,
    });
  } catch (error: any) {
    logger.error('Get starred tasks error:', error);
    
    res.status(500).json({
      error: {
        code: 500,
        message: 'שגיאה בקבלת משימות מסומנות',
        requestId: req.headers['x-request-id'] as string,
      },
    });
  }
});

// Export my tasks
router.get('/tasks/export', exportRateLimit, async (req: Request, res: Response) => {
  try {

    
    // Parse and validate query parameters
    const query = {
      format: req.query.format as ExportFormat || 'csv',
    };

    const validatedQuery = exportSchema.parse(query);

    // Get all my tasks (no pagination for export)
    const allTasksQuery = {
      query: req.query.query as string,
      page: 1,
      limit: 1000, // Large limit for export
      sort: 'updatedAt:desc' as const,
      context: 'mine' as const,
    };

    const validatedAllTasksQuery = exportSearchSchema.parse(allTasksQuery);
    
    // Convert searchSchema format to TaskFilters format
    const taskFilters = {
      search: validatedAllTasksQuery.query || '',
      page: validatedAllTasksQuery.page,
      limit: validatedAllTasksQuery.limit,
      sortBy: validatedAllTasksQuery.sort.split(':')[0] as 'createdAt' | 'updatedAt' | 'title' | 'createdBy',
      sortOrder: validatedAllTasksQuery.sort.split(':')[1] as 'asc' | 'desc',
      context: validatedAllTasksQuery.context,
    };
    

    
    const result = await TaskService.getTasks(taskFilters, req.user!);


    // Generate filename
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `my-tasks-${timestamp}.${validatedQuery.format}`;

    // Set headers for file download
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Pragma', 'no-cache');

    if (validatedQuery.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      
      // Add BOM for UTF-8 encoding (helps with Hebrew in Excel)
      const BOM = '\uFEFF';
      
      // Generate CSV content
      const csvHeader = 'id,title,description,createdByName,createdAt,updatedByName,updatedAt,isStarred,isMine,isAssignedToMe\n';
      const csvRows = result.items.map(task => {
        const isMine = task.createdBy.id === req.user!.id;
        const isAssignedToMe = task.assignees.some(assignee => assignee.id === req.user!.id);
        
        return [
          task.id,
          `"${task.title.replace(/"/g, '""')}"`,
          `"${(task.description || '').replace(/"/g, '""')}"`,
          `"${task.createdBy.name}"`,
          task.createdAt,
          task.updatedBy ? `"${task.updatedBy.name}"` : '',
          task.updatedAt,
          task.isStarred ? 'true' : 'false',
          isMine ? 'true' : 'false',
          isAssignedToMe ? 'true' : 'false',
        ].join(',');
      }).join('\n');

      res.send(BOM + csvHeader + csvRows);
    } else if (validatedQuery.format === 'excel') {
      // Excel format (CSV with BOM for Excel compatibility)
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      
      // Add BOM for Excel UTF-8 compatibility
      const BOM = '\uFEFF';
      const csvHeader = 'id,title,description,createdByName,createdAt,updatedByName,updatedAt,isStarred,isMine,isAssignedToMe\n';
      const csvRows = result.items.map(task => {
        const isMine = task.createdBy.id === req.user!.id;
        const isAssignedToMe = task.assignees.some(assignee => assignee.id === req.user!.id);
        
        return [
          task.id,
          `"${task.title.replace(/"/g, '""')}"`,
          `"${(task.description || '').replace(/"/g, '""')}"`,
          `"${task.createdBy.name}"`,
          task.createdAt,
          task.updatedBy ? `"${task.updatedBy.name}"` : '',
          task.updatedAt,
          task.isStarred ? 'true' : 'false',
          isMine ? 'true' : 'false',
          isAssignedToMe ? 'true' : 'false',
        ].join(',');
      }).join('\n');

      res.send(BOM + csvHeader + csvRows);
    } else {
      // JSON format
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      
      const exportData = result.items.map(task => {
        const isMine = task.createdBy.id === req.user!.id;
        const isAssignedToMe = task.assignees.some(assignee => assignee.id === req.user!.id);
        
        return {
          id: task.id,
          title: task.title,
          description: task.description || '',
          createdByName: task.createdBy.name,
          createdAt: task.createdAt,
          updatedByName: task.updatedBy?.name || '',
          updatedAt: task.updatedAt,
          isStarred: task.isStarred,
          isMine,
          isAssignedToMe,
        };
      });

      // Send JSON with proper UTF-8 encoding
      res.send(JSON.stringify(exportData, null, 2));
    }

    logger.info(`Tasks exported: ${req.user!.email} -> ${validatedQuery.format}`);
  } catch (error: any) {
    logger.error('Export tasks error:', error);
    
    if (error.name === 'ZodError') {
      res.status(400).json({
        error: {
          code: 400,
          message: 'פרמטרים לא תקינים',
          requestId: req.headers['x-request-id'] as string,
          field: error.errors[0]?.path?.join('.'),
        },
      });
    } else {
      res.status(500).json({
        error: {
          code: 500,
          message: 'שגיאה בייצוא משימות',
          requestId: req.headers['x-request-id'] as string,
        },
      });
    }
  }
});

export default router;
