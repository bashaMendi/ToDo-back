// MongoDB initialization script
db = db.getSiblingDB('shared-tasks');

// Create collections
db.createCollection('users');
db.createCollection('tasks');
db.createCollection('taskStars');
db.createCollection('taskAudits');
db.createCollection('passwordResets');

// Create indexes
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ provider: 1 });

db.tasks.createIndex({ updatedAt: -1 });
db.tasks.createIndex({ createdAt: -1 });
db.tasks.createIndex({ createdBy: 1 });
db.tasks.createIndex({ assignees: 1 });
db.tasks.createIndex({ deletedAt: 1 });
db.tasks.createIndex({
  title: 'text',
  description: 'text',
});

db.taskStars.createIndex({ userId: 1 });
db.taskStars.createIndex({ taskId: 1 });
db.taskStars.createIndex(
  {
    taskId: 1,
    userId: 1,
  },
  { unique: true }
);

db.taskAudits.createIndex({ taskId: 1, at: -1 });
db.taskAudits.createIndex({ by: 1, at: -1 });

db.passwordResets.createIndex({ token: 1 }, { unique: true });
db.passwordResets.createIndex({ email: 1 });
db.passwordResets.createIndex({ expiresAt: 1 });

print('MongoDB initialization completed successfully!');
