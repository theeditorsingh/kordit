const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const boardId = 'test-board-id';
  try {
    const logs = await prisma.auditLog.findMany({
      where: {
        OR: [
          { target: boardId },
          {
            details: {
              path: ['boardId'],
              equals: boardId,
            }
          }
        ]
      }
    });
    console.log("Success:", logs.length);
  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}
main();
