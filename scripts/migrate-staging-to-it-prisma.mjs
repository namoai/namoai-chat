#!/usr/bin/env node

/**
 * 스테이징(혼방) 환경 데이터베이스를 IT 환경으로 복사하는 스크립트 (Prisma 사용)
 * 
 * 사용법:
 *   node scripts/migrate-staging-to-it-prisma.mjs
 * 
 * 환경 변수 (.env.local):
 *   STAGING_DATABASE_URL - 스테이징 환경 DB URL
 *   IT_DATABASE_URL - IT 환경 DB URL
 */

import { Pool } from 'pg';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// .env.local 파일 로드
function loadEnvLocal() {
  const envLocalPath = join(rootDir, '.env.local');
  if (existsSync(envLocalPath)) {
    const content = readFileSync(envLocalPath, 'utf-8');
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, ''); // 따옴표 제거
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

// .env.local 로드
loadEnvLocal();

// 색상 출력
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

// 환경 변수 확인
const STAGING_DATABASE_URL = process.env.STAGING_DATABASE_URL;
const IT_DATABASE_URL = process.env.IT_DATABASE_URL || 
  'postgresql://postgres:namoai20250701@namoai-it.cluwk88i28od.ap-northeast-1.rds.amazonaws.com:5432/postgres';

if (!STAGING_DATABASE_URL) {
  log('❌ STAGING_DATABASE_URL 환경 변수가 설정되지 않았습니다.', colors.red);
  log('   .env.local 파일에 STAGING_DATABASE_URL을 추가하세요.', colors.yellow);
  process.exit(1);
}

if (!IT_DATABASE_URL) {
  log('❌ IT_DATABASE_URL 환경 변수가 설정되지 않았습니다.', colors.red);
  process.exit(1);
}

// 데이터베이스 연결 설정 (SSL 옵션 추가)
function getPoolConfig(url) {
  const config = { connectionString: url };
  
  // RDS 연결인 경우 SSL 옵션 추가
  if (url.includes('rds.amazonaws.com')) {
    config.ssl = {
      rejectUnauthorized: false, // RDS 인증서 검증 비활성화 (개발 환경)
    };
  }
  
  return config;
}

// 데이터베이스 연결 테스트
async function testConnection(url, name) {
  log(`\n🔍 ${name} 연결 테스트 중...`, colors.blue);
  
  const pool = new Pool(getPoolConfig(url));
  try {
    const result = await pool.query('SELECT 1 as test');
    if (result.rows[0].test === 1) {
      log(`✅ ${name} 연결 성공!`, colors.green);
      await pool.end();
      return true;
    }
  } catch (error) {
    log(`❌ ${name} 연결 실패: ${error.message}`, colors.red);
    log(`   연결 URL: ${url.substring(0, 50)}...`, colors.yellow);
    await pool.end();
    return false;
  }
}

// pgvector 확장 설치
async function installPgvector(url) {
  log(`\n🔧 pgvector 확장 설치 중...`, colors.blue);
  
  const pool = new Pool(getPoolConfig(url));
  try {
    await pool.query('CREATE EXTENSION IF NOT EXISTS vector;');
    log('✅ pgvector 확장 설치 완료!', colors.green);
    await pool.end();
    return true;
  } catch (error) {
    log(`⚠️  pgvector 확장 설치 실패 (이미 설치되어 있을 수 있습니다): ${error.message}`, colors.yellow);
    await pool.end();
    return true; // 계속 진행
  }
}

// Prisma 스키마 적용
async function applyPrismaSchema(url) {
  log(`\n📋 Prisma 스키마 적용 중...`, colors.blue);
  
  try {
    // DATABASE_URL을 임시로 변경하여 Prisma db push 실행
    const originalUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = url;
    
    log('Prisma db push 실행 중... (스키마를 데이터베이스에 직접 적용)', colors.cyan);
    execSync('npx prisma db push --accept-data-loss', {
      stdio: 'inherit',
      cwd: rootDir,
      env: process.env,
    });
    
    log('Prisma generate 실행 중...', colors.cyan);
    execSync('npx prisma generate', {
      stdio: 'inherit',
      cwd: rootDir,
      env: process.env,
    });
    
    // 원래 URL 복원
    if (originalUrl) {
      process.env.DATABASE_URL = originalUrl;
    }
    
    log('✅ Prisma 스키마 적용 완료!', colors.green);
    return true;
  } catch (error) {
    log(`❌ Prisma 스키마 적용 실패: ${error.message}`, colors.red);
    return false;
  }
}

// 벡터 인덱스 재생성
async function recreateVectorIndexes(url) {
  log(`\n🔧 벡터 인덱스 재생성 중...`, colors.blue);
  
  const pool = new Pool(getPoolConfig(url));
  try {
    // 기존 btree 인덱스 삭제
    log('  기존 인덱스 삭제 중...', colors.cyan);
    await pool.query('DROP INDEX IF EXISTS "chat_message_embedding_idx";');
    await pool.query('DROP INDEX IF EXISTS "chat_backMemoryEmbedding_idx";');
    await pool.query('DROP INDEX IF EXISTS "detailed_memories_embedding_idx";');
    await pool.query('DROP INDEX IF EXISTS "lorebooks_embedding_idx";');
    await pool.query('DROP INDEX IF EXISTS "embeddings_embedding_idx";');
    await pool.query('DROP INDEX IF EXISTS "embeddings_embedding_idx1";');
    
    // 각 테이블에 데이터가 있는지 확인하고 인덱스 생성
    const indexes = [
      {
        name: 'chat_message_embedding_idx',
        table: 'chat_message',
        column: 'embedding',
        lists: 100,
      },
      {
        name: 'chat_backMemoryEmbedding_idx',
        table: 'chat',
        column: 'backMemoryEmbedding',
        lists: 10,
      },
      {
        name: 'detailed_memories_embedding_idx',
        table: 'detailed_memories',
        column: 'embedding',
        lists: 10,
      },
      {
        name: 'lorebooks_embedding_idx',
        table: 'lorebooks',
        column: 'embedding',
        lists: 10,
      },
      {
        name: 'embeddings_embedding_idx',
        table: 'embeddings',
        column: 'embedding',
        lists: 10,
      },
    ];
    
    for (const idx of indexes) {
      try {
        // 테이블에 데이터가 있는지 확인
        const countResult = await pool.query(`SELECT COUNT(*) as count FROM "${idx.table}" WHERE "${idx.column}" IS NOT NULL;`);
        const count = parseInt(countResult.rows[0].count);
        
        if (count > 0) {
          // 벡터 컬럼의 타입과 차원 확인
          let dimensions = 1536; // 기본값 (일반적인 embedding 차원)
          try {
            // 컬럼 타입 확인
            const typeResult = await pool.query(`
              SELECT data_type, udt_name 
              FROM information_schema.columns 
              WHERE table_schema = 'public' 
              AND table_name = $1 
              AND column_name = $2;
            `, [idx.table, idx.column]);
            
            if (typeResult.rows.length > 0) {
              const dataType = typeResult.rows[0].data_type;
              const udtName = typeResult.rows[0].udt_name;
              
              // 벡터 타입이 아니면 벡터로 변환
              if (udtName !== 'vector') {
                log(`  🔧 ${idx.table}.${idx.column} 컬럼을 vector 타입으로 변환 중...`, colors.cyan);
                // 샘플 데이터로 차원 확인
                const sampleResult = await pool.query(`SELECT "${idx.column}" FROM "${idx.table}" WHERE "${idx.column}" IS NOT NULL LIMIT 1;`);
                if (sampleResult.rows.length > 0) {
                  const vectorValue = sampleResult.rows[0][idx.column];
                  if (typeof vectorValue === 'string' && vectorValue.startsWith('[')) {
                    dimensions = vectorValue.match(/\[(.*?)\]/)?.[1]?.split(',').length || 1536;
                  }
                }
                
                // 컬럼 타입을 vector로 변경
                await pool.query(`ALTER TABLE "${idx.table}" ALTER COLUMN "${idx.column}" TYPE vector(${dimensions}) USING "${idx.column}"::vector;`);
                log(`  ✅ ${idx.table}.${idx.column} 컬럼을 vector(${dimensions})로 변환 완료`, colors.green);
              } else {
                // 벡터 타입이면 차원 확인
                const sampleResult = await pool.query(`SELECT "${idx.column}" FROM "${idx.table}" WHERE "${idx.column}" IS NOT NULL LIMIT 1;`);
                if (sampleResult.rows.length > 0) {
                  const vectorValue = sampleResult.rows[0][idx.column];
                  if (typeof vectorValue === 'string' && vectorValue.startsWith('[')) {
                    dimensions = vectorValue.match(/\[(.*?)\]/)?.[1]?.split(',').length || 1536;
                  }
                }
              }
            }
          } catch (e) {
            log(`  ⚠️  벡터 타입 확인 실패, 기본값 사용: ${e.message}`, colors.yellow);
          }
          
          log(`  ${idx.name} 인덱스 생성 중... (${count}개 벡터 데이터, ${dimensions}차원)`, colors.cyan);
          
          // ivfflat 인덱스 생성 시도
          try {
            await pool.query(`
              CREATE INDEX IF NOT EXISTS "${idx.name}" 
              ON "${idx.table}" USING ivfflat ("${idx.column}" vector_cosine_ops)
              WITH (lists = ${idx.lists});
            `);
            log(`  ✅ ${idx.name} 인덱스 생성 완료`, colors.green);
          } catch (idxError) {
            // ivfflat 실패 시, 데이터가 너무 큰 경우를 대비해 인덱스 없이 진행
            if (idxError.message.includes('exceeds btree') || idxError.message.includes('dimensions') || idxError.message.includes('does not have')) {
              log(`  ⚠️  ${idx.name} 인덱스 생성 실패: ${idxError.message}`, colors.yellow);
              log(`  ℹ️  벡터 데이터가 너무 크거나 차원이 지정되지 않아 인덱스를 건너뜁니다.`, colors.yellow);
              log(`  ℹ️  벡터 검색은 인덱스 없이도 작동하지만 성능이 느릴 수 있습니다.`, colors.yellow);
            } else {
              throw idxError;
            }
          }
        } else {
          log(`  ⚠️  ${idx.table}.${idx.column}에 데이터가 없어 인덱스를 건너뜁니다.`, colors.yellow);
        }
      } catch (error) {
        log(`  ⚠️  ${idx.name} 인덱스 생성 실패: ${error.message}`, colors.yellow);
        // 계속 진행
      }
    }
    
    log('✅ 벡터 인덱스 재생성 완료!', colors.green);
    await pool.end();
    return true;
  } catch (error) {
    log(`⚠️  벡터 인덱스 재생성 실패: ${error.message}`, colors.yellow);
    log('   수동으로 실행해주세요.', colors.yellow);
    await pool.end();
    return true; // 계속 진행
  }
}

// 테이블 목록 가져오기
async function getTableNames(url) {
  const pool = new Pool(getPoolConfig(url));
  try {
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    await pool.end();
    return result.rows.map(row => row.table_name);
  } catch (error) {
    await pool.end();
    throw error;
  }
}

// 데이터 복사 (테이블별)
async function copyTableData(sourceUrl, targetUrl, tableName) {
  const sourcePool = new Pool(getPoolConfig(sourceUrl));
  const targetPool = new Pool(getPoolConfig(targetUrl));
  
  try {
    // 소스에서 데이터 가져오기
    log(`  📥 ${tableName} 테이블 데이터 복사 중...`, colors.cyan);
    const sourceData = await sourcePool.query(`SELECT * FROM "${tableName}";`);
    
    if (sourceData.rows.length === 0) {
      log(`  ⚠️  ${tableName} 테이블에 데이터가 없습니다.`, colors.yellow);
      await sourcePool.end();
      await targetPool.end();
      return true;
    }
    
    // 타겟 테이블의 컬럼 정보 가져오기
    const columnResult = await targetPool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = $1
      ORDER BY ordinal_position;
    `, [tableName]);
    
    const columns = columnResult.rows.map(row => row.column_name);
    
    // 벡터 인덱스가 있는 테이블의 경우 인덱스 삭제
    if (tableName === 'lorebooks' || tableName === 'embeddings' || tableName === 'chat_message' || tableName === 'chat' || tableName === 'detailed_memories') {
      try {
        log(`  🔧 ${tableName} 테이블의 벡터 인덱스 삭제 중...`, colors.cyan);
        await targetPool.query(`DROP INDEX IF EXISTS "${tableName}_embedding_idx";`);
        await targetPool.query(`DROP INDEX IF EXISTS "${tableName}_embedding_idx1";`);
        await targetPool.query(`DROP INDEX IF EXISTS "chat_backMemoryEmbedding_idx";`);
        await targetPool.query(`DROP INDEX IF EXISTS "chat_message_embedding_idx";`);
        await targetPool.query(`DROP INDEX IF EXISTS "detailed_memories_embedding_idx";`);
      } catch (idxError) {
        log(`  ⚠️  인덱스 삭제 중 오류 (무시하고 계속): ${idxError.message}`, colors.yellow);
      }
    }
    
    // 기존 데이터 삭제 (외래키 제약조건 때문에 순서가 중요)
    await targetPool.query(`TRUNCATE TABLE "${tableName}" CASCADE;`);
    
    // 데이터 삽입
    if (sourceData.rows.length > 0) {
      // 배치 크기로 나누어 삽입 (큰 테이블의 경우)
      const batchSize = 100;
      let inserted = 0;
      
      for (let i = 0; i < sourceData.rows.length; i += batchSize) {
        const batch = sourceData.rows.slice(i, i + batchSize);
        
        const placeholders = batch.map((_, idx) => {
          const rowPlaceholders = columns.map((_, j) => `$${idx * columns.length + j + 1}`).join(', ');
          return `(${rowPlaceholders})`;
        }).join(', ');
        
        const values = batch.flatMap(row => 
          columns.map(col => {
            const value = row[col];
            // vector 타입은 그대로 전달
            return value !== undefined ? value : null;
          })
        );
        
        const insertQuery = `INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES ${placeholders};`;
        
        await targetPool.query(insertQuery, values);
        inserted += batch.length;
      }
      
      log(`  ✅ ${tableName} 테이블: ${inserted}개 행 복사 완료`, colors.green);
    }
    
    await sourcePool.end();
    await targetPool.end();
    return true;
  } catch (error) {
    log(`  ❌ ${tableName} 테이블 복사 실패: ${error.message}`, colors.red);
    log(`  🔄 재시도 중... (인덱스 제거 후)`, colors.yellow);
    
    // 재시도: 인덱스 완전히 제거 후 다시 시도
    try {
      // 모든 관련 인덱스 삭제
      const indexResult = await targetPool.query(`
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = $1;
      `, [tableName]);
      
      for (const idx of indexResult.rows) {
        try {
          await targetPool.query(`DROP INDEX IF EXISTS "${idx.indexname}" CASCADE;`);
        } catch (e) {
          // 무시
        }
      }
      
      // 데이터 다시 복사 시도
      const sourceData = await sourcePool.query(`SELECT * FROM "${tableName}";`);
      if (sourceData.rows.length > 0) {
        const columns = Object.keys(sourceData.rows[0]);
        await targetPool.query(`TRUNCATE TABLE "${tableName}" CASCADE;`);
        
        // 배치로 삽입
        const batchSize = 50;
        for (let i = 0; i < sourceData.rows.length; i += batchSize) {
          const batch = sourceData.rows.slice(i, i + batchSize);
          const placeholders = batch.map((_, idx) => {
            const rowPlaceholders = columns.map((_, j) => `$${idx * columns.length + j + 1}`).join(', ');
            return `(${rowPlaceholders})`;
          }).join(', ');
          
          const values = batch.flatMap(row => 
            columns.map(col => row[col] !== undefined ? row[col] : null)
          );
          
          const insertQuery = `INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES ${placeholders};`;
          await targetPool.query(insertQuery, values);
        }
        
        log(`  ✅ ${tableName} 테이블: ${sourceData.rows.length}개 행 복사 완료 (재시도 성공)`, colors.green);
        await sourcePool.end();
        await targetPool.end();
        return true;
      }
    } catch (retryError) {
      log(`  ❌ 재시도도 실패: ${retryError.message}`, colors.red);
    }
    
    await sourcePool.end();
    await targetPool.end();
    return false;
  }
}

// 모든 데이터 복사
async function copyAllData(sourceUrl, targetUrl) {
  log(`\n📦 스테이징 환경 데이터 복사 중...`, colors.blue);
  
  try {
    // 테이블 목록 가져오기
    const sourceTables = await getTableNames(sourceUrl);
    const targetTables = await getTableNames(targetUrl);
    
    // 공통 테이블만 복사
    const commonTables = sourceTables.filter(table => targetTables.includes(table));
    
    log(`총 ${commonTables.length}개 테이블 복사 예정`, colors.cyan);
    
    // 외래키 제약조건을 고려한 순서로 복사
    // 일반적으로 users, characters 같은 기본 테이블을 먼저 복사
    const orderedTables = [
      'users',
      'characters',
      'personas',
      'points',
      'favorites',
      'interactions',
      'follows',
      'Block',
      'Account',
      'Session',
      'VerificationToken',
      'character_images',
      'chat',
      'chat_message',
      'comments',
      'embeddings',
      'lorebooks',
      'detailed_memories',
      'notices',
      'guides',
      'reports',
      'notifications',
    ];
    
    // 순서대로 복사
    for (const table of orderedTables) {
      if (commonTables.includes(table)) {
        await copyTableData(sourceUrl, targetUrl, table);
      }
    }
    
    // 나머지 테이블 복사
    for (const table of commonTables) {
      if (!orderedTables.includes(table)) {
        await copyTableData(sourceUrl, targetUrl, table);
      }
    }
    
    log('\n✅ 모든 데이터 복사 완료!', colors.green);
    return true;
  } catch (error) {
    log(`\n❌ 데이터 복사 실패: ${error.message}`, colors.red);
    return false;
  }
}

// 메인 함수
async function main() {
  log('\n🚀 스테이징 환경 → IT 환경 데이터베이스 마이그레이션 시작\n', colors.cyan);
  
  // 1. 연결 테스트
  if (!(await testConnection(STAGING_DATABASE_URL, '스테이징 환경'))) {
    log('\n❌ 스테이징 환경에 연결할 수 없습니다.', colors.red);
    process.exit(1);
  }
  
  if (!(await testConnection(IT_DATABASE_URL, 'IT 환경'))) {
    log('\n❌ IT 환경에 연결할 수 없습니다.', colors.red);
    process.exit(1);
  }
  
  // 2. pgvector 확장 설치
  await installPgvector(IT_DATABASE_URL);
  
  // 3. Prisma 스키마 적용
  if (!(await applyPrismaSchema(IT_DATABASE_URL))) {
    log('\n⚠️  Prisma 스키마 적용에 실패했지만 계속 진행합니다...', colors.yellow);
  }
  
  // 4. 벡터 인덱스 재생성
  await recreateVectorIndexes(IT_DATABASE_URL);
  
  // 5. 데이터 복사
  log('\n⚠️  데이터 복사를 시작합니다. IT 환경의 기존 데이터는 삭제됩니다.', colors.yellow);
  if (!(await copyAllData(STAGING_DATABASE_URL, IT_DATABASE_URL))) {
    log('\n⚠️  데이터 복사에 일부 실패가 있었지만 계속 진행합니다...', colors.yellow);
  }
  
  // 6. 벡터 인덱스 재생성 (데이터 복사 후)
  log('\n🔧 벡터 인덱스 재생성 중 (데이터 복사 후)...', colors.blue);
  await recreateVectorIndexes(IT_DATABASE_URL);
  
  log('\n✅ 마이그레이션 완료!', colors.green);
  log('\n다음 단계:', colors.cyan);
  log('1. IT 환경 애플리케이션에서 연결 테스트', colors.cyan);
  log('2. 관리 패널에서 IT 환경 상태 확인', colors.cyan);
}

main().catch((error) => {
  log(`\n❌ 오류 발생: ${error.message}`, colors.red);
  console.error(error);
  process.exit(1);
});

