// User types
export interface User {
  id: string;
  email: string;
  name: string;
  provider: 'credentials' | 'google';
  createdAt: string;
}

// Task types
export interface Task {
  id: string;
  title: string;
  description: string;
  createdBy: User;
  createdAt: string;
  updatedBy?: User | undefined;
  updatedAt: string;
  assignees: User[];
  version: number;
  isStarred: boolean; // for current user
}

// API Response types
export interface ApiResponse<T> {
  data?: T;
  error?: {
    code: number;
    message: string;
    requestId: string;
    field?: string;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  total: number;
  hasMore: boolean;
}

// Auth types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupCredentials {
  email: string;
  name: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  sessionToken?: string;
}

// Task creation/update types
export interface CreateTaskData {
  title: string;
  description?: string;
}

export interface UpdateTaskData {
  title?: string;
  description?: string;
  assignees?: string[];
}

// Search and filter types
export interface TaskFilters {
  search: string;
  page: number;
  limit: number;
  sortBy: 'createdAt' | 'updatedAt' | 'title' | 'createdBy';
  sortOrder: 'asc' | 'desc';
  assignedToMe?: boolean;
  starred?: boolean;
  context: 'all' | 'mine' | 'starred';
}

// WebSocket event types
export interface WebSocketEvent {
  eventId: string;
  emittedAt: string;
}

export interface TaskCreatedEvent extends WebSocketEvent {
  type: 'task.created';
  task: Task;
}

export interface TaskUpdatedEvent extends WebSocketEvent {
  type: 'task.updated';
  taskId: string;
  patch: Partial<Task>;
}

export interface TaskDeletedEvent extends WebSocketEvent {
  type: 'task.deleted';
  taskId: string;
}

export interface StarAddedEvent extends WebSocketEvent {
  type: 'star.added';
  taskId: string;
}

export interface StarRemovedEvent extends WebSocketEvent {
  type: 'star.removed';
  taskId: string;
}

export type WebSocketEvents =
  | TaskCreatedEvent
  | TaskUpdatedEvent
  | TaskDeletedEvent
  | StarAddedEvent
  | StarRemovedEvent;

// Session types
export interface Session {
  user: User;
  expiresAt: string;
}

// Database types
export interface DatabaseUser {
  id: string;
  email: string;
  name: string;
  passwordHash?: string;
  provider: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DatabaseTask {
  id: string;
  title: string;
  description?: string;
  createdBy: string;
  createdAt: Date;
  updatedBy?: string;
  updatedAt: Date;
  assignees: string[];
  version: number;
  deletedAt?: Date;
}

// Error types
export interface ApiError {
  code: number;
  message: string;
  requestId: string;
  field?: string;
}

// Validation types
export interface ValidationError {
  field: string;
  message: string;
}

// Rate limiting types
export interface RateLimitConfig {
  windowMs: number;
  max: number;
  message: string;
}

// Email types
export interface EmailData {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// Export types
export type ExportFormat = 'csv' | 'json' | 'excel';

// Constants
export const VALIDATION_RULES = {
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 50,
  EMAIL_MAX_LENGTH: 255,
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 128,
  TITLE_MIN_LENGTH: 1,
  TITLE_MAX_LENGTH: 120,
  DESCRIPTION_MAX_LENGTH: 5000,
  MAX_ASSIGNEES: 20,
  SEARCH_MIN_LENGTH: 1,
  SEARCH_MAX_LENGTH: 100,
  MAX_SEARCH_RESULTS: 100,
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  MIN_PAGE: 1,
} as const;

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;
