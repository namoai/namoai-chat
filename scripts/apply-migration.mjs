import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const prisma = new PrismaClient();

async function main() {
  try {
    const sqlPath = join(__dirname, '..', 'prisma', 'migrations', 'add_email_login_security_2fa', 'migration.sql');
    const sql = readFileSync(sqlPath, 'utf8');
    
    // SQL을 세미콜론으로 분리하되, 블록 구문(DO $$)을 고려
    // 주석 제거
    let cleanedSql = sql.replace(/--.*$/gm, '').trim();
    
    // 세미콜론으로 분리하되, 빈 문자열 제거
    const statements = [];
    let currentStatement = '';
    let inBlock = false;
    
    for (let i = 0; i < cleanedSql.length; i++) {
      const char = cleanedSql[i];
      const nextChars = cleanedSql.substring(i, i + 2);
      
      if (nextChars === '$$') {
        inBlock = !inBlock;
        currentStatement += char;
        continue;
      }
      
      currentStatement += char;
      
      if (!inBlock && char === ';') {
        const stmt = currentStatement.trim();
        if (stmt && stmt.length > 0) {
          statements.push(stmt);
        }
        currentStatement = '';
      }
    }
    
    // 마지막 문장 처리
    if (currentStatement.trim()) {
      statements.push(currentStatement.trim());
    }
    
    console.log(`Executing ${statements.length} SQL statements...`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          await prisma.$executeRawUnsafe(statement);
          const preview = statement.replace(/\s+/g, ' ').substring(0, 60);
          console.log(`✓ [${i + 1}/${statements.length}] Executed: ${preview}...`);
        } catch (error) {
          // IF NOT EXISTS 등의 경우 이미 존재하면 에러가 날 수 있지만 무시
          if (error.message.includes('already exists') || 
              error.message.includes('duplicate') ||
              error.message.includes('does not exist') && statement.includes('IF NOT EXISTS')) {
            const preview = statement.replace(/\s+/g, ' ').substring(0, 60);
            console.log(`⚠ [${i + 1}/${statements.length}] Skipped (already exists): ${preview}...`);
          } else {
            console.error(`❌ Failed statement:`, statement.substring(0, 100));
            throw error;
          }
        }
      }
    }
    
    console.log('✅ Migration applied successfully!');
  } catch (error) {
    console.error('❌ Error applying migration:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

