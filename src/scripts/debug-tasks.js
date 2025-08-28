const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugTasks() {
  try {
    console.log('בדיקת משימות בדאטה בייס...\n');

    // בדוק את כל המשימות
    const allTasks = await prisma.task.findMany();
    console.log(` סה"כ משימות בדאטה בייס: ${allTasks.length}`);

    if (allTasks.length > 0) {
      console.log('\nפרטי המשימות:');
      allTasks.forEach((task, index) => {
        console.log(`\n${index + 1}. משימה ID: ${task.id}`);
        console.log(`   כותרת: ${task.title}`);
        console.log(`   isDeleted: ${task.isDeleted} (טיפוס: ${typeof task.isDeleted})`);
        console.log(`   נוצרה על ידי: ${task.createdBy}`);
      });
    }

    // בדוק משימות לא נמחקות
    const nonDeletedTasks = await prisma.task.findMany({
      where: { isDeleted: false }
    });
    console.log(`\nמשימות לא נמחקות (isDeleted: false): ${nonDeletedTasks.length}`);

    // בדוק משימות נמחקות
    const deletedTasks = await prisma.task.findMany({
      where: { isDeleted: true }
    });
    console.log(`\nמשימות נמחקות (isDeleted: true): ${deletedTasks.length}`);

    // בדוק משימות ללא isDeleted (null/undefined)
    const tasksWithoutIsDeleted = allTasks.filter(task => task.isDeleted === null || task.isDeleted === undefined);
    console.log(`\n משימות ללא isDeleted: ${tasksWithoutIsDeleted.length}`);

    // בדוק את כל המשימות שוב ללא פילטר
    console.log('\nבדיקה נוספת - כל המשימות ללא פילטר:');
    const allTasksAgain = await prisma.task.findMany();
    console.log(`סה"כ: ${allTasksAgain.length}`);
    allTasksAgain.forEach(task => {
      console.log(`- ${task.id}: isDeleted = ${task.isDeleted} (${typeof task.isDeleted})`);
    });

  } catch (error) {
    console.error(' שגיאה:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugTasks();
