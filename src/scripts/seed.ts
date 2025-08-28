import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../utils/auth';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

async function main() {
  logger.info('Starting database seeding...');

  try {
    // Create sample users
    const user1 = await prisma.user.upsert({
      where: { email: 'admin@example.com' },
      update: {},
      create: {
        email: 'admin@example.com',
        name: 'מנהל המערכת',
        passwordHash: await hashPassword('Admin123!'),
        provider: 'credentials',
      },
    });

    const user2 = await prisma.user.upsert({
      where: { email: 'user@example.com' },
      update: {},
      create: {
        email: 'user@example.com',
        name: 'משתמש לדוגמה',
        passwordHash: await hashPassword('User123!'),
        provider: 'credentials',
      },
    });

    const user3 = await prisma.user.upsert({
      where: { email: '770basha@gmail.com' },
      update: {},
      create: {
        email: '770basha@gmail.com',
        name: 'מנדי באשה',
        passwordHash: await hashPassword('770Basha'),
        provider: 'credentials',
      },
    });

    logger.info('Created users:', { user1: user1.email, user2: user2.email, user3: user3.email });

    // Create sample tasks
    const task1 = await prisma.task.create({
      data: {
        title: 'משימה לדוגמה 1',
        description: 'זוהי משימה לדוגמה עם תיאור מפורט',
        createdBy: user1.id,
        updatedBy: user1.id,
        assignees: [user1.id, user2.id],
      },
    });

    const task2 = await prisma.task.create({
      data: {
        title: 'משימה לדוגמה 2',
        description: 'משימה נוספת לדוגמה',
        createdBy: user2.id,
        updatedBy: user2.id,
        assignees: [user2.id],
      },
    });

    const task3 = await prisma.task.create({
      data: {
        title: 'משימה לדוגמה 3',
        createdBy: user1.id,
        updatedBy: user1.id,
        assignees: [],
      },
    });

    logger.info('Created tasks:', { 
      task1: task1.title, 
      task2: task2.title, 
      task3: task3.title 
    });

    // Create sample stars
    await prisma.taskStar.create({
      data: {
        taskId: task1.id,
        userId: user1.id,
      },
    });

    await prisma.taskStar.create({
      data: {
        taskId: task2.id,
        userId: user2.id,
      },
    });

    logger.info('Created task stars');

    // Create sample audit entries
    await prisma.taskAudit.create({
      data: {
        taskId: task1.id,
        by: user1.id,
        action: 'create',
        diff: { title: task1.title, description: task1.description },
      },
    });

    await prisma.taskAudit.create({
      data: {
        taskId: task2.id,
        by: user2.id,
        action: 'create',
        diff: { title: task2.title, description: task2.description },
      },
    });

    logger.info('Created audit entries');

    logger.info('Database seeding completed successfully!');
    logger.info('Sample credentials:');
    logger.info('Admin: admin@example.com / Admin123!');
    logger.info('User: user@example.com / User123!');

  } catch (error) {
    logger.error('Error seeding database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    logger.error('Failed to seed database:', e);
    process.exit(1);
  });
