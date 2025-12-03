#!/usr/bin/env node

/**
 * 벡터 인덱스 생성 스크립트
 * 벡터 컬럼의 차원을 확인하고 ivfflat 인덱스를 생성합니다.
 */

import { Pool } from 'pg';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

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
        const value = match[2].trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

loadEnvLocal();

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

function getPoolConfig(url) {
  const config = { connectionString: url };
  if (url.includes('rds.amazonaws.com')) {
    config.ssl = { rejectUnauthorized: false };
  }
  return config;
}

async function fixVectorIndexes(url, name) {
  log(`\n🔧 ${name} 환경 벡터 인덱스 생성 중...`, colors.blue);
  
  const pool = new Pool(getPoolConfig(url));
  
  try {
    // 벡터 컬럼 목록
    const vectorColumns = [
      { table: 'chat_message', column: 'embedding', lists: 100 },
      { table: 'chat', column: 'backMemoryEmbedding', lists: 10 },
      { table: 'detailed_memories', column: 'embedding', lists: 10 },
      { table: 'lorebooks', column: 'embedding', lists: 10 },
      { table: 'embeddings', column: 'embedding', lists: 10 },
    ];
    
    for (const { table, column, lists } of vectorColumns) {
      try {
        // 데이터 개수 확인
        const countResult = await pool.query(`
          SELECT COUNT(*) as count 
          FROM "${table}" 
          WHERE "${column}" IS NOT NULL;
        `);
        const count = parseInt(countResult.rows[0].count);
        
        if (count === 0) {
          log(`  ⚠️  ${table}.${column}: 데이터가 없어 건너뜁니다.`, colors.yellow);
          continue;
        }
        
        // 벡터 차원 확인
        let dimensions = 1536; // 기본값
        
        try {
          // 샘플 데이터에서 차원 추출
          const sampleResult = await pool.query(`
            SELECT "${column}"
            FROM "${table}"
            WHERE "${column}" IS NOT NULL
            LIMIT 1;
          `);
          
          if (sampleResult.rows.length > 0) {
            const vectorValue = sampleResult.rows[0][column];
            
            // 벡터가 배열 형식인 경우
            if (Array.isArray(vectorValue)) {
              dimensions = vectorValue.length;
            } 
            // 벡터가 문자열 형식인 경우 [1,2,3,...]
            else if (typeof vectorValue === 'string') {
              const match = vectorValue.match(/\[(.*?)\]/);
              if (match) {
                dimensions = match[1].split(',').length;
              }
            }
            // pgvector 타입인 경우
            else {
              // PostgreSQL에서 벡터 차원 확인
              const dimResult = await pool.query(`
                SELECT array_length("${column}"::float[], 1) as dim
                FROM "${table}"
                WHERE "${column}" IS NOT NULL
                LIMIT 1;
              `);
              
              if (dimResult.rows.length > 0 && dimResult.rows[0].dim) {
                dimensions = dimResult.rows[0].dim;
              }
            }
          }
        } catch (e) {
          log(`  ⚠️  ${table}.${column}: 차원 확인 실패, 기본값 사용: ${e.message}`, colors.yellow);
        }
        
        log(`  📊 ${table}.${column}: ${count}개 데이터, ${dimensions}차원`, colors.cyan);
        
        // 기존 인덱스 삭제
        try {
          await pool.query(`DROP INDEX IF EXISTS "${table}_${column}_idx";`);
          await pool.query(`DROP INDEX IF EXISTS "${table}_${column}_idx1";`);
          await pool.query(`DROP INDEX IF EXISTS "${column}_idx";`);
        } catch (e) {
          // 무시
        }
        
        // 벡터 컬럼 타입 확인 및 수정
        try {
          const typeResult = await pool.query(`
            SELECT 
              data_type,
              udt_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = $1
            AND column_name = $2;
          `, [table, column]);
          
          if (typeResult.rows.length > 0) {
            const udtName = typeResult.rows[0].udt_name;
            
            // 벡터 타입이 차원 없이 정의된 경우 차원 추가
            if (udtName === 'vector') {
              log(`  🔧 ${table}.${column} 컬럼 타입을 vector(${dimensions})로 설정 중...`, colors.cyan);
              
              // ALTER COLUMN으로 차원 명시
              try {
                await pool.query(`
                  ALTER TABLE "${table}" 
                  ALTER COLUMN "${column}" TYPE vector(${dimensions}) 
                  USING "${column}"::vector(${dimensions});
                `);
                log(`  ✅ ${table}.${column} 컬럼 타입 설정 완료`, colors.green);
              } catch (alterError) {
                // 이미 차원이 설정되어 있거나 다른 오류
                if (alterError.message.includes('already')) {
                  log(`  ℹ️  ${table}.${column} 컬럼 타입은 이미 올바르게 설정되어 있습니다.`, colors.cyan);
                } else {
                  log(`  ⚠️  ${table}.${column} 컬럼 타입 설정 실패: ${alterError.message}`, colors.yellow);
                }
              }
            }
          }
        } catch (e) {
          log(`  ⚠️  ${table}.${column} 타입 확인 실패: ${e.message}`, colors.yellow);
        }
        
        // ivfflat 인덱스 생성
        log(`  🔧 ${table}.${column} ivfflat 인덱스 생성 중...`, colors.cyan);
        
        try {
          await pool.query(`
            CREATE INDEX IF NOT EXISTS "${table}_${column}_idx" 
            ON "${table}" USING ivfflat ("${column}" vector_cosine_ops)
            WITH (lists = ${lists});
          `);
          log(`  ✅ ${table}.${column} 인덱스 생성 완료!`, colors.green);
        } catch (idxError) {
          if (idxError.message.includes('exceeds btree') || idxError.message.includes('too large')) {
            log(`  ⚠️  ${table}.${column} 인덱스 생성 실패: 벡터 데이터가 너무 큽니다.`, colors.yellow);
            log(`  ℹ️  인덱스 없이도 벡터 검색은 가능하지만 성능이 느릴 수 있습니다.`, colors.yellow);
          } else if (idxError.message.includes('dimensions') || idxError.message.includes('does not have')) {
            log(`  ⚠️  ${table}.${column} 인덱스 생성 실패: 차원 정보가 없습니다.`, colors.yellow);
            log(`  🔄 차원을 명시적으로 설정 후 재시도...`, colors.cyan);
            
            // 차원을 명시적으로 설정하고 재시도
            try {
              await pool.query(`
                ALTER TABLE "${table}" 
                ALTER COLUMN "${column}" TYPE vector(${dimensions}) 
                USING "${column}"::vector(${dimensions});
              `);
              
              await pool.query(`
                CREATE INDEX IF NOT EXISTS "${table}_${column}_idx" 
                ON "${table}" USING ivfflat ("${column}" vector_cosine_ops)
                WITH (lists = ${lists});
              `);
              log(`  ✅ ${table}.${column} 인덱스 생성 완료! (재시도 성공)`, colors.green);
            } catch (retryError) {
              log(`  ❌ ${table}.${column} 인덱스 생성 실패: ${retryError.message}`, colors.red);
            }
          } else {
            log(`  ❌ ${table}.${column} 인덱스 생성 실패: ${idxError.message}`, colors.red);
          }
        }
      } catch (error) {
        log(`  ❌ ${table}.${column} 처리 실패: ${error.message}`, colors.red);
      }
    }
    
    await pool.end();
    log(`\n✅ ${name} 환경 벡터 인덱스 생성 완료!`, colors.green);
  } catch (error) {
    log(`\n❌ 오류 발생: ${error.message}`, colors.red);
    console.error(error);
    await pool.end();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const target = args[0] || 'both'; // 'staging', 'it', 'both'
  
  const STAGING_DATABASE_URL = process.env.STAGING_DATABASE_URL;
  const IT_DATABASE_URL = process.env.IT_DATABASE_URL || 
    'postgresql://postgres:namoai20250701@namoai-it.cluwk88i28od.ap-northeast-1.rds.amazonaws.com:5432/postgres';
  
  if ((target === 'staging' || target === 'both') && STAGING_DATABASE_URL) {
    await fixVectorIndexes(STAGING_DATABASE_URL, '스테이징');
  }
  
  if ((target === 'it' || target === 'both') && IT_DATABASE_URL) {
    await fixVectorIndexes(IT_DATABASE_URL, 'IT');
  }
}

main().catch(console.error);
