# Shared Tasks Backend

באק-אנד למערכת ניהול משימות משותפת עם Node.js, Express ו-TypeScript.

## 🌟 תכונות עיקריות

### 🔐 אימות ואבטחה
- **Session-based Authentication** - אימות מבוסס סשן (מוכן ל-Redis עתידי)
- **Password Hashing** - הצפנת סיסמאות עם Argon2id
- **CSRF Protection** - הגנה מפני CSRF attacks
- **Rate Limiting** - הגבלת בקשות לפי IP ומשתמש
- **Security Headers** - כותרות אבטחה עם Helmet

### 📋 ניהול משימות
- **CRUD Operations** - יצירה, קריאה, עדכון ומחיקה של משימות
- **Soft Delete** - מחיקה רכה עם אפשרות שחזור
- **Optimistic Concurrency** - מניעת קונפליקטים בעדכון
- **Audit Trail** - מעקב אחר שינויים במשימות
- **Task Duplication** - שכפול משימות
- **Task Assignment** - הקצאת משימות למשתמשים

### ⭐ כוכבים אישיים
- **Personal Stars** - סימון מועדפים אישי לכל משתמש
- **Star Management** - הוספה והסרה של כוכבים

### 📤 ייצוא נתונים
- **CSV Export** - ייצוא לקובץ CSV
- **JSON Export** - ייצוא לקובץ JSON
- **Personal Tasks** - ייצוא המשימות האישיות בלבד

### 🔄 זמן אמת
- **WebSocket Support** - עדכונים בזמן אמת עם Socket.io
- **Real-time Events** - אירועים לפעולות על משימות
- **Personal Notifications** - התראות אישיות
- **Multi-server Support** - תמיכה בשרתים מרובים (מוכן לשימוש עתידי)

### 📧 התראות
- **Email Notifications** - התראות במייל עם SendGrid
- **Password Reset** - איפוס סיסמה במייל
- **Welcome Emails** - מיילי ברוכים הבאים
- **Task Assignment Notifications** - התראות הקצאת משימות

## 🛠️ מחסנית טכנולוגית

### Core
- **Node.js 18+** - Runtime environment
- **Express 4.18+** - Web framework
- **TypeScript 5+** - Type-safe JavaScript

### Database & ORM
- **MongoDB** - NoSQL database
- **Prisma 5+** - Type-safe ORM
- **Redis** - Session storage & caching (מוכן לשימוש עתידי)

### Authentication & Security
- **Argon2id** - Password hashing
- **Session Cookies** - HttpOnly, Secure
- **CSRF Tokens** - Cross-site request forgery protection
- **Google OAuth** - OAuth 2.0 עם Google (מוכן לשימוש עתידי)

### Real-time
- **Socket.io 4+** - WebSocket library
- **Redis Adapter** - Multi-server support (מוכן לשימוש עתידי)

### Validation & Serialization
- **Zod** - Schema validation
- **Express Validator** - Request validation

### Logging & Monitoring
- **Pino** - Fast JSON logger
- **Request Logging** - HTTP request logging

### Email
- **Nodemailer** - Email sending
- **SendGrid** - Email service provider

## 🚀 התקנה והרצה

### דרישות מקדימות
- Node.js 18+
- MongoDB Atlas (או MongoDB מקומי)
- Redis (Cloud או מקומי) - אופציונלי, מוכן לשימוש עתידי

### התקנה מקומית

1. **Clone הפרויקט**
```bash
git clone <repository-url>
cd to-do-list-back
```

2. **התקנת תלויות**
```bash
npm install
```

3. **הגדרת משתני סביבה**
```bash
cp env.example .env
# ערוך את הקובץ .env עם הפרטים שלך
```

4. **הגדרת מסד נתונים**
```bash
# דחוף את הסכמה למסד הנתונים
npm run prisma:push

# צור את Prisma Client
npm run prisma:generate
```

5. **הרצת השרת**
```bash
# פיתוח
npm run dev

# ייצור
npm run build
npm start
```

### התקנה עם Docker

1. **הרצת כל השירותים**
```bash
docker-compose up -d
```

2. **גישה לשירותים**
- Backend API: `http://localhost:3001`
- MongoDB Express: `http://localhost:8081` (admin/admin123)
- Redis Commander: `http://localhost:8082`

### פריסה בייצור


#### Docker Production
```bash
# Build image
docker build -t shared-tasks-backend .

# Run container
docker run -d \
  -p 3001:3001 \
  -e DATABASE_URL="your-mongodb-url" \
  -e SESSION_SECRET="your-session-secret" \
  -e PEPPER="your-pepper-key" \
  shared-tasks-backend
```

## ⚙️ משתני סביבה

### חובה
```env
DATABASE_URL="mongodb+srv://username:password@cluster.mongodb.net/shared-tasks"
SESSION_SECRET="your-super-secret-session-key-64-chars-long"
PEPPER="your-pepper-key-32-chars-long"
FRONTEND_URL="http://localhost:3000"
```

### אופציונלי
```env
NODE_ENV=development
PORT=3001
ALLOWED_ORIGINS=http://localhost:3000
LOG_LEVEL=info

# Redis Configuration (מוכן לשימוש עתידי)
REDIS_URL="redis://username:password@redis-host:port"
REDIS_DISABLED=false
REDIS_REQUIRED=false

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Email Configuration
MAIL_HOST=smtp.sendgrid.net
MAIL_USER=apikey
MAIL_PASS=your-sendgrid-api-key
MAIL_FROM=noreply@shared-tasks.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_AUTH_WINDOW_MS=900000
RATE_LIMIT_AUTH_MAX_REQUESTS=20

# WebSocket
WS_CORS_ORIGIN=http://localhost:3000
WS_PING_TIMEOUT=60000
WS_PING_INTERVAL=25000
```

## 📚 API Endpoints

### אימות (Authentication)
```
POST   /auth/signup          # יצירת משתמש חדש
POST   /auth/login           # כניסה למערכת
POST   /auth/logout          # התנתקות
GET    /auth/me              # פרטי משתמש נוכחי
POST   /auth/forgot          # שכחתי סיסמה
POST   /auth/reset           # איפוס סיסמה
```

### משימות (Tasks)
```
GET    /tasks                # קבלת משימות (עם סינון)
POST   /tasks                # יצירת משימה חדשה
GET    /tasks/:id            # קבלת משימה ספציפית
PATCH  /tasks/:id            # עדכון משימה
DELETE /tasks/:id            # מחיקת משימה
POST   /tasks/:id/duplicate  # שכפול משימה
```

### כוכבים (Stars)
```
PUT    /tasks/:taskId/star   # הוספת כוכב
DELETE /tasks/:taskId/star   # הסרת כוכב
```

### אישי (Personal)
```
GET    /me/tasks             # המשימות שלי
GET    /me/starred           # משימות מסומנות בכוכב
GET    /me/tasks/export      # ייצוא המשימות שלי
```

### מערכת (System)
```
GET    /health               # בדיקת בריאות השרת
GET    /sync                 # סנכרון WebSocket
GET    /rate-limit-stats     # סטטיסטיקות הגבלת בקשות
GET    /ws-status            # סטטוס WebSocket
POST   /reset-rate-limit     # איפוס הגבלת בקשות (פיתוח בלבד)
```

## 🔌 WebSocket Events

### Client to Server Events

#### `authenticate`
Authenticate WebSocket connection with session token.
```typescript
socket.emit('authenticate', { sessionToken: 'your-session-token' });
```

#### `auth_status`
Check authentication status.
```typescript
socket.emit('auth_status');
```

### Server to Client Events

#### `authenticated`
Authentication successful.
```typescript
{
  user: { id: string, email: string, name: string },
  message: 'Successfully authenticated'
}
```

#### `auth_error`
Authentication failed.
```typescript
{
  message: 'Error message'
}
```

#### `auth_status`
Authentication status response.
```typescript
{
  authenticated: boolean,
  user?: { id: string, email: string, name: string }
}
```

#### `task.created`
New task created.
```typescript
{
  eventId: string,
  emittedAt: string,
  type: 'task.created',
  task: Task
}
```

#### `task.updated`
Task updated.
```typescript
{
  eventId: string,
  emittedAt: string,
  type: 'task.updated',
  taskId: string,
  patch: Partial<Task>
}
```

#### `task.deleted`
Task deleted.
```typescript
{
  eventId: string,
  emittedAt: string,
  type: 'task.deleted',
  taskId: string
}
```

#### `task.duplicated`
Task duplicated.
```typescript
{
  eventId: string,
  emittedAt: string,
  type: 'task.duplicated',
  sourceTaskId: string,
  newTask: Task
}
```

#### `task.assigned`
Task assigned to user.
```typescript
{
  eventId: string,
  emittedAt: string,
  type: 'task.assigned',
  taskId: string,
  assigneeId: string
}
```

#### `star.added`
Star added to task.
```typescript
{
  eventId: string,
  emittedAt: string,
  type: 'star.added',
  taskId: string
}
```

#### `star.removed`
Star removed from task.
```typescript
{
  eventId: string,
  emittedAt: string,
  type: 'star.removed',
  taskId: string
}
```

### Rooms

- `board:all` - All authenticated users
- `user:${userId}` - Specific user's personal room

### Usage Example

```typescript
// Frontend WebSocket connection
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001', {
  withCredentials: true
});

// Authenticate with session token
socket.emit('authenticate', { sessionToken: 'your-session-token' });

// Listen for authentication success
socket.on('authenticated', (data) => {
  console.log('Authenticated:', data.user);
});

// Listen for task updates
socket.on('task.created', (event) => {
  console.log('New task:', event.task);
});

socket.on('task.updated', (event) => {
  console.log('Task updated:', event.taskId, event.patch);
});
```

## 🗄️ מבנה נתונים

### User
```typescript
{
  id: string;
  email: string;
  name: string;
  passwordHash?: string;
  provider: 'credentials' | 'google';
  createdAt: string;
  updatedAt: string;
}
```

### Task
```typescript
{
  id: string;
  title: string;
  description?: string;
  createdBy: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt: string;
  assignees: string[];
  version: number;
  isDeleted: boolean;
}
```

### TaskStar
```typescript
{
  id: string;
  taskId: string;
  userId: string;
  createdAt: string;
}
```

### TaskAudit
```typescript
{
  id: string;
  taskId: string;
  at: string;
  by: string;
  action: 'create' | 'update' | 'delete' | 'duplicate';
  diff: object;
  metadata?: object;
}
```

### PasswordReset
```typescript
{
  id: string;
  email: string;
  token: string;
  expiresAt: string;
  createdAt: string;
  used: boolean;
}
```

## 🧪 בדיקות

### הרצת בדיקות
```bash
# כל הבדיקות
npm test

# בדיקות עם צפייה
npm run test:watch

# בדיקות עם כיסוי
npm run test:coverage
```

### סוגי בדיקות
- **Unit Tests** - בדיקות יחידה לשירותים
- **Integration Tests** - בדיקות אינטגרציה ל-API
- **WebSocket Tests** - בדיקות WebSocket events
- **Authentication Tests** - בדיקות אימות
- **Validation Tests** - בדיקות ולידציה

## 📊 Monitoring & Statistics

### Rate Limiting Statistics
```bash
GET /rate-limit-stats
```
Returns rate limiting statistics including:
- Total requests
- Blocked requests
- Failure rate
- Blocked percentage

### WebSocket Statistics
```bash
GET /ws-status
```
Returns WebSocket server status including:
- Connected clients
- Authenticated users
- Room members
- Connection statistics
- Authentication success rate

### Reset Rate Limit (Development Only)
```bash
POST /reset-rate-limit
```
Resets rate limiting for your IP address (development only).

## 🔧 Scripts

### Development Scripts
```bash
npm run dev              # הרצת שרת פיתוח
npm run build            # בניית הפרויקט
npm run start            # הרצת שרת ייצור
npm run clean            # ניקוי תיקיית build
```

### Database Scripts
```bash
npm run prisma:generate  # יצירת Prisma Client
npm run prisma:push      # דחיפת סכמה למסד נתונים
npm run prisma:migrate   # הרצת מיגרציות
npm run prisma:studio    # פתיחת Prisma Studio
npm run db:seed          # הזרעת נתונים לדוגמה
```

### Testing Scripts
```bash
npm test                 # הרצת בדיקות
npm run test:watch       # בדיקות עם צפייה
npm run test:coverage    # בדיקות עם כיסוי
```

### Linting Scripts
```bash
npm run lint             # בדיקת קוד
npm run lint:fix         # תיקון אוטומטי של קוד
```

## 🚀 פריסה

### Environment Variables for Production
```env
NODE_ENV=production
DATABASE_URL="mongodb+srv://..."
SESSION_SECRET="..."
PEPPER="..."
FRONTEND_URL="https://yourdomain.com"
ALLOWED_ORIGINS="https://yourdomain.com"
WS_CORS_ORIGIN="https://yourdomain.com"
LOG_LEVEL=info

# Redis Configuration (אופציונלי)
REDIS_URL="redis://..."
REDIS_DISABLED=false
REDIS_REQUIRED=false
```

### Docker Production
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

## 🔒 אבטחה

### Security Features
- **Input Validation** - ולידציה של כל הקלט עם Zod
- **SQL Injection Protection** - הגנה מפני SQL injection עם Prisma
- **XSS Protection** - הגנה מפני XSS attacks
- **CSRF Protection** - הגנה מפני CSRF
- **Rate Limiting** - הגבלת בקשות
- **Security Headers** - כותרות אבטחה עם Helmet
- **Password Hashing** - הצפנת סיסמאות עם Argon2id
- **Session Security** - ניהול סשנים מאובטח

### Best Practices
- **Environment Variables** - משתני סביבה למידע רגיש
- **Error Handling** - טיפול בשגיאות ללא חשיפת מידע
- **Input Sanitization** - ניקוי קלט
- **Secure Cookies** - עוגיות מאובטחות
- **CORS Configuration** - הגדרת CORS מתאימה

## 📈 ביצועים

### Optimization
- **Database Indexing** - אינדקסים מתאימים למסד הנתונים
- **Connection Pooling** - Pooling חיבורים למסד הנתונים
- **Caching** - Caching עם Redis (מוכן לשימוש עתידי)
- **Rate Limiting** - הגבלת בקשות למניעת עומס
- **Compression** - דחיסת תגובות
- **Request Logging** - לוגים מפורטים לכל בקשה

### Monitoring
- **Health Checks** - בדיקות בריאות
- **Performance Metrics** - מדדי ביצועים
- **Error Tracking** - מעקב אחר שגיאות
- **WebSocket Statistics** - סטטיסטיקות WebSocket


---

**גרסה:** 1.0.0  
**תאריך:** 2025 
**Node.js:** 18+  
**TypeScript:** 5+  
**MongoDB:** 7.0+  
**Redis:** 7.2+ (אופציונלי)
