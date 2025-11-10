import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyReportsTable() {
  try {
    console.log('Verifying reports table...');
    
    // Test if reports model is accessible
    const count = await prisma.reports.count();
    console.log(`✅ Reports model is accessible. Current count: ${count}`);
    
    // Test if we can query with relations
    const testQuery = await prisma.reports.findMany({
      take: 1,
      include: {
        characters: {
          select: { id: true, name: true }
        },
        reporter: {
          select: { id: true, nickname: true }
        }
      }
    });
    
    console.log('✅ Relations are working correctly');
    console.log('✅ All database setup is complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyReportsTable();

