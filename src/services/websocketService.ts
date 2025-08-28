import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { logger } from '../utils/logger';
import { Task, User } from '../types';
import { getSession } from '../utils/auth';

export class WebSocketService {
  private static io: SocketIOServer | null = null;
  private static authenticatedUsers = new Map<string, User>(); // socketId -> User
  private static connectionStats = {
    totalConnections: 0,
    currentConnections: 0,
    totalAuthentications: 0,
    failedAuthentications: 0,
    totalDisconnections: 0
  };

  // Initialize WebSocket server
  static initialize(server: HTTPServer): void {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.WS_CORS_ORIGIN?.split(',') || process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
        methods: ['GET', 'POST'],
        credentials: process.env.CORS_CREDENTIALS === 'true' || true,
      },
      transports: ['websocket', 'polling'],
      pingTimeout: parseInt(process.env.WS_PING_TIMEOUT || '60000'),
      pingInterval: parseInt(process.env.WS_PING_INTERVAL || '25000'),
      // Add connection monitoring
      allowEIO3: true,
      maxHttpBufferSize: 1e6, // 1MB
    });

    this.io.on('connection', (socket) => {
      this.connectionStats.totalConnections++;
      this.connectionStats.currentConnections = this.io!.engine.clientsCount;
      
      logger.info(`WebSocket connected: ${socket.id} (Total clients: ${this.io!.engine.clientsCount})`);

      // Join default rooms
      socket.join('board:all');
      logger.info(`Socket ${socket.id} joined room: board:all`);

      // Handle user authentication
      socket.on('authenticate', async (data: { sessionToken: string }) => {
        try {
          if (!data.sessionToken) {
            this.connectionStats.failedAuthentications++;
            logger.warn(`Socket ${socket.id} attempted authentication without session token`);
            socket.emit('auth_error', { message: 'Session token required' });
            return;
          }

          const user = await getSession(data.sessionToken);
          if (!user) {
            this.connectionStats.failedAuthentications++;
            logger.warn(`Socket ${socket.id} attempted authentication with invalid session token`);
            socket.emit('auth_error', { message: 'Invalid session token' });
            return;
          }

          // Store authenticated user
          this.authenticatedUsers.set(socket.id, user);
          this.connectionStats.totalAuthentications++;
          
          // Join user-specific room
          socket.join(`user:${user.id}`);
          logger.info(`User ${user.id} (${user.email}) authenticated on socket ${socket.id}`);
          
          // Send authentication success
          socket.emit('authenticated', { 
            user: { id: user.id, email: user.email, name: user.name },
            message: 'Successfully authenticated'
          });
          
        } catch (error) {
          this.connectionStats.failedAuthentications++;
          logger.error(`Authentication error for socket ${socket.id}:`, error);
          socket.emit('auth_error', { message: 'Authentication failed' });
        }
      });

      // Handle authentication status check
      socket.on('auth_status', () => {
        const user = this.authenticatedUsers.get(socket.id);
        if (user) {
          socket.emit('auth_status', { 
            authenticated: true, 
            user: { id: user.id, email: user.email, name: user.name }
          });
        } else {
          socket.emit('auth_status', { authenticated: false });
        }
      });

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        this.connectionStats.totalDisconnections++;
        this.connectionStats.currentConnections = this.io!.engine.clientsCount;
        
        const user = this.authenticatedUsers.get(socket.id);
        
        if (user) {
          logger.info(`User ${user.id} (${user.email}) disconnected: ${socket.id}, reason: ${reason}`);
          this.authenticatedUsers.delete(socket.id);
        } else {
          logger.info(`WebSocket disconnected: ${socket.id}, reason: ${reason} (Remaining clients: ${this.io!.engine.clientsCount})`);
        }
      });

      // Handle errors
      socket.on('error', (error) => {
        logger.error(`WebSocket error on socket ${socket.id}:`, error);
      });
    });

    logger.info('WebSocket server initialized');
  }

  // Get WebSocket server instance
  static getIO(): SocketIOServer {
    if (!this.io) {
      throw new Error('WebSocket server not initialized');
    }
    return this.io;
  }

  // Emit task created event
  static emitTaskCreated(task: Task): void {
    if (!this.io) return;

    const event = {
      eventId: `task-created-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      emittedAt: new Date().toISOString(),
      type: 'task.created' as const,
      task,
    };

    const connectedClients = this.io.engine.clientsCount;
    const roomMembers = this.getRoomMembersCount('board:all');
    
    logger.info(`WebSocket Debug - Task Created:`);
    logger.info(`  - Connected clients: ${connectedClients}`);
    logger.info(`  - Room 'board:all' members: ${roomMembers}`);
    logger.info(`  - Emitting to room: board:all`);
    logger.info(`  - Task ID: ${task.id}`);

    this.io.to('board:all').emit('task.created', event);
    logger.info(`Task created event emitted: ${task.id}`);
  }

  // Emit task updated event
  static emitTaskUpdated(taskId: string, patch: any): void {
    if (!this.io) {
      logger.warn('WebSocket not initialized, cannot emit task.updated event');
      return;
    }

    const event = {
      eventId: `task-updated-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      emittedAt: new Date().toISOString(),
      type: 'task.updated' as const,
      taskId,
      patch,
    };

    const connectedClients = this.io.engine.clientsCount;
    const roomMembers = this.getRoomMembersCount('board:all');
    
    logger.info(`WebSocket Debug - Task Updated:`);
    logger.info(`  - Connected clients: ${connectedClients}`);
    logger.info(`  - Room 'board:all' members: ${roomMembers}`);
    logger.info(`  - Emitting to room: board:all`);
    logger.info(`  - Task ID: ${taskId}`);
    logger.info(`  - Patch data:`, patch);

    this.io.to('board:all').emit('task.updated', event);
    logger.info(`Task updated event emitted: ${taskId}`);
  }

  // Emit task deleted event
  static emitTaskDeleted(taskId: string): void {
    if (!this.io) return;

    const event = {
      eventId: `task-deleted-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      emittedAt: new Date().toISOString(),
      type: 'task.deleted' as const,
      taskId,
    };

    this.io.to('board:all').emit('task.deleted', event);
    logger.info(`Task deleted event emitted: ${taskId}`);
  }

  // Emit task duplicated event
  static emitTaskDuplicated(sourceTaskId: string, newTask: Task): void {
    if (!this.io) return;

    const event = {
      eventId: `task-duplicated-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      emittedAt: new Date().toISOString(),
      type: 'task.duplicated' as const,
      sourceTaskId,
      newTask,
    };

    this.io.to('board:all').emit('task.duplicated', event);
    logger.info(`Task duplicated event emitted: ${sourceTaskId} -> ${newTask.id}`);
  }

  // Emit task assigned event
  static emitTaskAssigned(taskId: string, assigneeId: string): void {
    if (!this.io) return;

    const event = {
      eventId: `task-assigned-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      emittedAt: new Date().toISOString(),
      type: 'task.assigned' as const,
      taskId,
      assigneeId,
    };

    this.io.to('board:all').emit('task.assigned', event);
    logger.info(`Task assigned event emitted: ${taskId} -> ${assigneeId}`);
  }

  // Emit star added event
  static emitStarAdded(taskId: string, userId: string): void {
    if (!this.io) return;

    const event = {
      eventId: `star-added-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      emittedAt: new Date().toISOString(),
      type: 'star.added' as const,
      taskId,
    };

    // Emit to board and personal room
    this.io.to('board:all').emit('star.added', event);
    this.io.to(`user:${userId}`).emit('star.added', event);
    logger.info(`Star added event emitted: ${taskId} by ${userId}`);
  }

  // Emit star removed event
  static emitStarRemoved(taskId: string, userId: string): void {
    if (!this.io) return;

    const event = {
      eventId: `star-removed-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      emittedAt: new Date().toISOString(),
      type: 'star.removed' as const,
      taskId,
    };

    // Emit to board and personal room
    this.io.to('board:all').emit('star.removed', event);
    this.io.to(`user:${userId}`).emit('star.removed', event);
    logger.info(`Star removed event emitted: ${taskId} by ${userId}`);
  }

  // Send personal notification
  static sendPersonalNotification(userId: string, event: string, data: any): void {
    if (!this.io) return;

    const notification = {
      eventId: `${event}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      emittedAt: new Date().toISOString(),
      type: event,
      ...data,
    };

    this.io.to(`user:${userId}`).emit(event, notification);
    logger.info(`Personal notification sent: ${event} to ${userId}`);
  }

  // Get connected users count
  static getConnectedUsersCount(): number {
    if (!this.io) return 0;
    return this.io.engine.clientsCount;
  }

  // Get authenticated users count
  static getAuthenticatedUsersCount(): number {
    return this.authenticatedUsers.size;
  }

  // Get connection statistics
  static getConnectionStats() {
    return {
      ...this.connectionStats,
      currentConnections: this.io ? this.io.engine.clientsCount : 0,
      authenticatedUsers: this.authenticatedUsers.size,
      authenticationSuccessRate: this.connectionStats.totalAuthentications > 0 
        ? ((this.connectionStats.totalAuthentications - this.connectionStats.failedAuthentications) / this.connectionStats.totalAuthentications * 100).toFixed(2)
        : '0.00'
    };
  }

  // Get user by socket ID
  static getUserBySocketId(socketId: string): User | undefined {
    return this.authenticatedUsers.get(socketId);
  }

  // Get socket ID by user ID
  static getSocketIdByUserId(userId: string): string | undefined {
    for (const [socketId, user] of this.authenticatedUsers.entries()) {
      if (user.id === userId) {
        return socketId;
      }
    }
    return undefined;
  }

  // Check if user is authenticated
  static isUserAuthenticated(socketId: string): boolean {
    return this.authenticatedUsers.has(socketId);
  }

  // Helper method to validate authentication for events
  private static validateAuthentication(socketId: string, eventType: string): boolean {
    if (!this.isUserAuthenticated(socketId)) {
      logger.warn(`Unauthenticated socket ${socketId} attempted to trigger ${eventType}`);
      return false;
    }
    return true;
  }

  // Get room members count
  static getRoomMembersCount(room: string): number {
    if (!this.io) return 0;
    const roomSockets = this.io.sockets.adapter.rooms.get(room);
    return roomSockets ? roomSockets.size : 0;
  }

  // Broadcast to all connected clients
  static broadcast(event: string, data: any): void {
    if (!this.io) return;

    this.io.emit(event, {
      eventId: `${event}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      emittedAt: new Date().toISOString(),
      type: event,
      ...data,
    });

    logger.info(`Broadcast event sent: ${event}`);
  }

  // Graceful shutdown
  static async shutdown(): Promise<void> {
    if (!this.io) return;

    try {
      logger.info('Shutting down WebSocket server...');
      
      // Disconnect all clients gracefully
      const sockets = await this.io.fetchSockets();
      for (const socket of sockets) {
        socket.disconnect(true);
      }
      
      // Close the server
      this.io.close();
      
      // Clear authenticated users
      this.authenticatedUsers.clear();
      
      logger.info('WebSocket server shutdown complete');
    } catch (error) {
      logger.error('Error during WebSocket shutdown:', error);
    }
  }
}