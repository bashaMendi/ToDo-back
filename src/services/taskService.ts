import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { Task, CreateTaskData, UpdateTaskData, TaskFilters, PaginatedResponse, User } from '../types';
import { WebSocketService } from './websocketService';
import { redis } from '../config/redis';

// Cache configuration
const CACHE_TTL = 5 * 60; // 5 minutes
const SEARCH_CACHE_PREFIX = 'tasks:search:';

// Helper function to generate cache key
const generateCacheKey = (filters: TaskFilters, currentUser: User): string => {
  const { search, page, limit, sortBy, sortOrder, context } = filters;
  const key = `${SEARCH_CACHE_PREFIX}${context}:${search || 'all'}:${page}:${limit}:${sortBy}:${sortOrder}:${currentUser.id}`;
  logger.debug(`Generated cache key: ${key}`);
  return key;
};

// Helper function to invalidate cache
const invalidateTaskCache = async (): Promise<void> => {
  try {
    const keys = await redis.keys(`${SEARCH_CACHE_PREFIX}*`);
    logger.info(`Found ${keys.length} cache keys to invalidate`);
    if (keys.length > 0) {
      // Delete keys one by one to avoid type issues
      for (const key of keys) {
        await redis.del(key);
        logger.debug(`Deleted cache key: ${key}`);
      }
      logger.info(`Invalidated ${keys.length} task cache entries`);
    }
  } catch (error) {
    logger.error('Error invalidating task cache:', error);
  }
};

export class TaskService {
  // Get tasks with pagination and filters
  static async getTasks(filters: TaskFilters, currentUser: User): Promise<PaginatedResponse<Task>> {
    try {
      const {
        search,
        page,
        limit,
        sortBy,
        sortOrder,
        context,
      } = filters;



      // Check cache first
      const cacheKey = generateCacheKey(filters, currentUser);
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          logger.info(`Cache hit for key: ${cacheKey}`);
          return JSON.parse(cached);
        }
        logger.info(`Cache miss for key: ${cacheKey}`);
      } catch (error) {
        logger.warn('Cache check failed, proceeding without cache:', error);
      }

      // Build where clause - optimized for MongoDB
      const where: any = {
        isDeleted: false // Always filter out deleted tasks at database level
      };

      // Context filtering
      if (context === 'mine') {
        // For mine context, we need to combine isDeleted filter with OR conditions
        where.AND = [
          { isDeleted: false },
          {
            OR: [
              { createdBy: currentUser.id },
              { assignees: { has: currentUser.id } },
            ]
          }
        ];
        delete where.isDeleted; // Remove the top-level isDeleted since it's now in AND
      } else if (context === 'starred') {
        // Get starred task IDs for current user
        const starredTasks = await prisma.taskStar.findMany({
          where: { userId: currentUser.id },
          select: { taskId: true },
        });
        where.AND = [
          { isDeleted: false },
          { id: { in: starredTasks.map(st => st.taskId) } }
        ];
        delete where.isDeleted; // Remove the top-level isDeleted since it's now in AND
      }

      // Enhanced search filtering with better performance
      if (search && search.trim()) {
        const searchTerm = search.trim();
        const searchConditions = [
          { title: { contains: searchTerm, mode: 'insensitive' } },
          { description: { contains: searchTerm, mode: 'insensitive' } },
        ];
        
        if (where.OR) {
          const existingOR = where.OR;
          where.AND = [
            { OR: existingOR },
            { OR: searchConditions }
          ];
          delete where.OR;
        } else if (where.AND) {
          // If we already have AND conditions, add search to them
          where.AND.push({ OR: searchConditions });
        } else {
          where.OR = searchConditions;
        }
      }



      // Build order by with fallback
      const orderBy: any = {};
      if (sortBy === 'createdBy') {
        orderBy.creator = { name: sortOrder };
      } else {
        orderBy[sortBy] = sortOrder;
      }

      // Optimized query with pagination at database level
      const startIndex = (page - 1) * limit;
      
      // Execute queries in parallel for better performance
      
      const [allTasks, totalCount] = await Promise.all([
        prisma.task.findMany({
          where,
          include: {
            creator: {
              select: { id: true, name: true, email: true },
            },
            updater: {
              select: { id: true, name: true, email: true },
            },
            stars: {
              where: { userId: currentUser.id },
              select: { id: true },
            },
          },
          orderBy,
          skip: startIndex,
          take: limit,
        }),
        prisma.task.count({ where })
      ]);




      // Since we're filtering at database level, we shouldn't need this filter anymore
      // But let's keep it as a safety check
      const nonDeletedTasks = allTasks.filter(task => !task.isDeleted);
      
      // Use the actual count from database since we're filtering at DB level
      const total = totalCount;

      // Transform to API format
      const transformedTasks: Task[] = await Promise.all(nonDeletedTasks.map(async task => {
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
      }; }));

      const result = {
        items: transformedTasks,
        page,
        total,
        hasMore: page * limit < total,
      };

      // Cache the result
      try {
        await redis.setEx(cacheKey, CACHE_TTL, JSON.stringify(result));
        logger.info(`Cached result for key: ${cacheKey} with TTL: ${CACHE_TTL} seconds`);
      } catch (error) {
        logger.warn('Failed to cache result:', error);
      }

      return result;
    } catch (error) {
      logger.error('Get tasks error:', error);
      throw error;
    }
  }

  // Get single task
  static async getTask(taskId: string, currentUser: User): Promise<Task> {
    try {
      const task = await prisma.task.findFirst({
        where: {
          id: taskId,
        },
        include: {
          creator: { select: { id: true, name: true, email: true } },
          updater: { select: { id: true, name: true, email: true } },
          stars: { where: { userId: currentUser.id }, select: { id: true } },
        },
      });

      if (!task || task.isDeleted) {
        throw new Error('המשימה לא נמצאה');
      }

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
    } catch (error) {
      logger.error('Get task error:', error);
      throw error;
    }
  }

  // Create new task
  static async createTask(taskData: CreateTaskData, currentUser: User): Promise<Task> {
    try {
      const task = await prisma.task.create({
        data: {
          title: taskData.title,
          description: taskData.description || null,
          createdBy: currentUser.id,
          version: 1,
        },
        include: {
          creator: { select: { id: true, name: true, email: true } },
          stars: { where: { userId: currentUser.id }, select: { id: true } },
        },
      });

      // Create audit log
      await prisma.taskAudit.create({
        data: {
          taskId: task.id,
          by: currentUser.id,
          action: 'create',
          diff: { title: task.title, description: task.description },
        },
      });

      const assigneeUsersCreate = task.assignees.length
        ? await prisma.user.findMany({
            where: { id: { in: task.assignees } },
            select: { id: true, name: true, email: true, createdAt: true, provider: true },
          })
        : [] as any[];

      const transformedTask: Task = {
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
        updatedAt: task.updatedAt.toISOString(),
        assignees: assigneeUsersCreate.map(user => ({
          id: user.id,
          name: user.name,
          email: user.email,
          provider: (user as any).provider || 'credentials',
          createdAt: (user as any).createdAt.toISOString(),
        })),
        version: task.version,
        isStarred: task.stars.length > 0,
      };

      // Emit WebSocket event
      WebSocketService.emitTaskCreated(transformedTask);

      // Invalidate cache
      await invalidateTaskCache();

      logger.info(`Task created: ${task.id} by ${currentUser.email}`);

      return transformedTask;
    } catch (error) {
      logger.error('Create task error:', error);
      throw error;
    }
  }

  // Update task
  static async updateTask(taskId: string, taskData: UpdateTaskData, currentUser: User, expectedVersion?: number): Promise<Task> {
    try {


      // Get current task
      const currentTask = await prisma.task.findFirst({
        where: {
          id: taskId,
          isDeleted: false, // Make sure we only get non-deleted tasks
        },
      });



      if (!currentTask || currentTask.isDeleted) {
        throw new Error('המשימה לא נמצאה');
      }

      // Check version conflict
      if (expectedVersion && currentTask.version !== expectedVersion) {
        logger.warn(`Version conflict: expected ${expectedVersion}, but current is ${currentTask.version}`);
        throw new Error('גרסת המשימה לא תואמת');
      }
      
      logger.info(`Version check passed: current version ${currentTask.version}, expected version ${expectedVersion}`);

      // Prepare update data
      const updateData: any = {
        updatedBy: currentUser.id,
        version: currentTask.version + 1,
      };

      if (taskData.title !== undefined) {
        updateData.title = taskData.title;
        logger.info(`Updating title to: ${taskData.title}`);
      }
      if (taskData.description !== undefined) {
        updateData.description = taskData.description;
        logger.info(`Updating description to: ${taskData.description}`);
      }
      if (taskData.assignees !== undefined) {
        updateData.assignees = taskData.assignees;
        logger.info(`Updating assignees to: ${JSON.stringify(taskData.assignees)}`);
      }

      logger.info(`Update data: ${JSON.stringify(updateData)}`);

      // Update task
      
      const updatedTask = await prisma.task.update({
        where: { 
          id: taskId,
          isDeleted: false, // Make sure we only update non-deleted tasks
        },
        data: updateData,
        include: {
          creator: { select: { id: true, name: true, email: true } },
          updater: { select: { id: true, name: true, email: true } },
          stars: { where: { userId: currentUser.id }, select: { id: true } },
        },
      });

      logger.info(`Task updated successfully. New title: ${updatedTask.title}, New description: ${updatedTask.description}`);

      // Verify the update actually happened
      const verifyTask = await prisma.task.findFirst({
        where: { id: taskId, isDeleted: false },
        select: { id: true, title: true, description: true, version: true, updatedAt: true }
      });
      
      logger.info(`Verification - Task in DB: ${JSON.stringify(verifyTask)}`);

      // Create audit log with the actual changes
      const auditDiff = {
        ...taskData, // Original data sent from frontend
        updatedBy: currentUser.id,
        version: updatedTask.version
      };
      

      
      await prisma.taskAudit.create({
        data: {
          taskId: taskId,
          by: currentUser.id,
          action: 'update',
          diff: auditDiff,
        },
      });

      const assigneeUsersUpdate = updatedTask.assignees.length
        ? await prisma.user.findMany({
            where: { id: { in: updatedTask.assignees } },
            select: { id: true, name: true, email: true, createdAt: true, provider: true },
          })
        : [] as any[];

      const transformedTask: Task = {
        id: updatedTask.id,
        title: updatedTask.title,
        description: updatedTask.description || '',
        createdBy: {
          id: updatedTask.creator.id,
          name: updatedTask.creator.name,
          email: updatedTask.creator.email,
          provider: 'credentials' as const,
          createdAt: updatedTask.createdAt.toISOString(),
        },
        createdAt: updatedTask.createdAt.toISOString(),
        updatedBy: updatedTask.updater ? {
          id: updatedTask.updater.id,
          name: updatedTask.updater.name,
          email: updatedTask.updater.email,
          provider: 'credentials' as const,
          createdAt: updatedTask.createdAt.toISOString(),
        } : undefined,
        updatedAt: updatedTask.updatedAt.toISOString(),
        assignees: assigneeUsersUpdate.map(user => ({
          id: user.id,
          name: user.name,
          email: user.email,
          provider: (user as any).provider || 'credentials',
          createdAt: (user as any).createdAt.toISOString(),
        })),
        version: updatedTask.version,
        isStarred: updatedTask.stars.length > 0,
      };

      // Emit WebSocket event with the original patch data
      // This includes the actual fields that were updated (title, description, etc.)
      const patchData = {
        ...taskData, // Original data sent from frontend
        updatedBy: currentUser.id,
        version: updatedTask.version,
        updatedAt: updatedTask.updatedAt.toISOString()
      };
      
      logger.info(`Emitting WebSocket event with patch data: ${JSON.stringify(patchData)}`);
      WebSocketService.emitTaskUpdated(taskId, patchData);

      // Invalidate cache
      await invalidateTaskCache();

      logger.info(`Task updated: ${taskId} by ${currentUser.email}`);

      return transformedTask;
    } catch (error) {
      logger.error('Update task error:', error);
      throw error;
    }
  }

  // Delete task (soft delete)
  static async deleteTask(taskId: string, currentUser: User): Promise<{ undoToken: string }> {
    try {
      const task = await prisma.task.findFirst({
        where: {
          id: taskId,
        },
      });

      if (!task || task.isDeleted) {
        throw new Error('המשימה לא נמצאה');
      }

      // Soft delete
      await prisma.task.update({
        where: { id: taskId },
        data: { isDeleted: true },
      });

      // Create audit log
      await prisma.taskAudit.create({
        data: {
          taskId: taskId,
          by: currentUser.id,
          action: 'delete',
          diff: { deletedAt: new Date() },
        },
      });

      // Generate undo token
      const undoToken = `undo-${taskId}-${Date.now()}`;
      await prisma.passwordReset.create({
        data: {
          email: undoToken, // Using email field for token storage
          token: undoToken,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
          used: false,
        },
      });

      // Emit WebSocket event
      WebSocketService.emitTaskDeleted(taskId);

      // Invalidate cache
      await invalidateTaskCache();

      logger.info(`Task deleted: ${taskId} by ${currentUser.email}`);

      return { undoToken };
    } catch (error) {
      logger.error('Delete task error:', error);
      throw error;
    }
  }

  // Duplicate task
  static async duplicateTask(taskId: string, currentUser: User): Promise<Task> {
    try {
      const originalTask = await prisma.task.findFirst({
        where: {
          id: taskId,
        },
        include: {
          creator: { select: { id: true, name: true, email: true } },
        },
      });

      if (!originalTask || originalTask.isDeleted) {
        throw new Error('המשימה לא נמצאה');
      }

      // Create duplicate
      const duplicatedTask = await prisma.task.create({
        data: {
          title: `${originalTask.title} (עותק)`,
          description: originalTask.description,
          createdBy: currentUser.id,
          assignees: originalTask.assignees,
          version: 1,
        },
        include: {
          creator: { select: { id: true, name: true, email: true } },
          stars: { where: { userId: currentUser.id }, select: { id: true } },
        },
      });

      // Create audit log
      await prisma.taskAudit.create({
        data: {
          taskId: duplicatedTask.id,
          by: currentUser.id,
          action: 'duplicate',
          diff: { sourceTaskId: taskId },
        },
      });

      const assigneeUsersDup = duplicatedTask.assignees.length
        ? await prisma.user.findMany({
            where: { id: { in: duplicatedTask.assignees } },
            select: { id: true, name: true, email: true, createdAt: true, provider: true },
          })
        : [] as any[];

      const transformedTask: Task = {
        id: duplicatedTask.id,
        title: duplicatedTask.title,
        description: duplicatedTask.description || '',
        createdBy: {
          id: duplicatedTask.creator.id,
          name: duplicatedTask.creator.name,
          email: duplicatedTask.creator.email,
          provider: 'credentials' as const,
          createdAt: duplicatedTask.createdAt.toISOString(),
        },
        createdAt: duplicatedTask.createdAt.toISOString(),
        updatedAt: duplicatedTask.updatedAt.toISOString(),
        assignees: assigneeUsersDup.map(user => ({
          id: user.id,
          name: user.name,
          email: user.email,
          provider: (user as any).provider || 'credentials',
          createdAt: (user as any).createdAt.toISOString(),
        })),
        version: duplicatedTask.version,
        isStarred: duplicatedTask.stars.length > 0,
      };

      // Emit WebSocket event
      WebSocketService.emitTaskCreated(transformedTask);

      logger.info(`Task duplicated: ${taskId} -> ${duplicatedTask.id} by ${currentUser.email}`);

      return transformedTask;
    } catch (error) {
      logger.error('Duplicate task error:', error);
      throw error;
    }
  }

  // Assign self to task
  static async assignSelfToTask(taskId: string, currentUser: User): Promise<void> {
    try {
      const task = await prisma.task.findFirst({
        where: {
          id: taskId,
        },
      });

      if (!task || task.isDeleted) {
        throw new Error('המשימה לא נמצאה');
      }

      // Check if already assigned
      if (task.assignees.includes(currentUser.id)) {
        return; // Already assigned
      }

      // Add to assignees
      await prisma.task.update({
        where: { id: taskId },
        data: {
          assignees: [...task.assignees, currentUser.id],
          updatedBy: currentUser.id,
          version: task.version + 1,
        },
      });

      // Create audit log
      await prisma.taskAudit.create({
        data: {
          taskId: taskId,
          by: currentUser.id,
          action: 'update',
          diff: { assignees: [...task.assignees, currentUser.id] },
        },
      });

      // Emit WebSocket event
      WebSocketService.emitTaskAssigned(taskId, currentUser.id);

      logger.info(`User assigned to task: ${currentUser.email} -> ${taskId}`);
    } catch (error) {
      logger.error('Assign self to task error:', error);
      throw error;
    }
  }
}
