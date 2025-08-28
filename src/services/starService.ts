import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { Task, User } from '../types';
import { WebSocketService } from './websocketService';

export class StarService {
  // Add star to task
  static async addStar(taskId: string, currentUser: User): Promise<void> {
    try {
      // Check if task exists
      const task = await prisma.task.findFirst({
        where: {
          id: taskId,
        },
      });

      if (!task || task.isDeleted) {
        throw new Error('המשימה לא נמצאה');
      }

      if (!task) {
        throw new Error('המשימה לא נמצאה');
      }

      // Check if already starred
      const existingStar = await prisma.taskStar.findUnique({
        where: {
          taskId_userId: {
            taskId,
            userId: currentUser.id,
          },
        },
      });

      if (existingStar) {
        return; // Already starred
      }

      // Add star
      await prisma.taskStar.create({
        data: {
          taskId,
          userId: currentUser.id,
        },
      });

      // Emit WebSocket event
      WebSocketService.emitStarAdded(taskId, currentUser.id);

      logger.info(`Star added: ${currentUser.email} -> ${taskId}`);
    } catch (error) {
      logger.error('Add star error:', error);
      throw error;
    }
  }

  // Remove star from task
  static async removeStar(taskId: string, currentUser: User): Promise<void> {
    try {
      // Remove star
      const result = await prisma.taskStar.deleteMany({
        where: {
          taskId,
          userId: currentUser.id,
        },
      });

      if (result.count === 0) {
        return; // No star to remove
      }

      // Emit WebSocket event
      WebSocketService.emitStarRemoved(taskId, currentUser.id);

      logger.info(`Star removed: ${currentUser.email} -> ${taskId}`);
    } catch (error) {
      logger.error('Remove star error:', error);
      throw error;
    }
  }

  // Get starred tasks for user
  static async getStarredTasks(currentUser: User): Promise<Task[]> {
    try {
      const starredTasks = await prisma.task.findMany({
        where: {
          stars: {
            some: {
              userId: currentUser.id,
            },
          },
        },
        include: {
          creator: { select: { id: true, name: true, email: true } },
          updater: { select: { id: true, name: true, email: true } },
          stars: { where: { userId: currentUser.id }, select: { id: true } },
        },
        orderBy: { updatedAt: 'desc' },
      });

      // Filter out deleted tasks
      const nonDeletedStarredTasks = starredTasks.filter(task => !task.isDeleted);
      
      const result = await Promise.all(nonDeletedStarredTasks.map(async task => {
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
      return result;
    } catch (error) {
      logger.error('Get starred tasks error:', error);
      throw error;
    }
  }

  // Check if task is starred by user
  static async isTaskStarred(taskId: string, currentUser: User): Promise<boolean> {
    try {
      const star = await prisma.taskStar.findUnique({
        where: {
          taskId_userId: {
            taskId,
            userId: currentUser.id,
          },
        },
      });

      return !!star;
    } catch (error) {
      logger.error('Check if task starred error:', error);
      return false;
    }
  }

  // Get star count for task
  static async getStarCount(taskId: string): Promise<number> {
    try {
      const count = await prisma.taskStar.count({
        where: { taskId },
      });

      return count;
    } catch (error) {
      logger.error('Get star count error:', error);
      return 0;
    }
  }
}
