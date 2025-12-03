#!/usr/bin/env node

/**
 * 벡터 인덱스 상태 확인 스크립트
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

async function checkVectorIndexes(url, name) {
  log(`\n🔍 ${name} 환경 벡터 인덱스 상태 확인 중...`, colors.blue);
  
  const pool = new Pool(getPoolConfig(url));
  
  try {
    // 벡터 컬럼이 있는 테이블 확인
    const vectorTables = await pool.query(`
      SELECT 
        table_name,
        column_name,
        data_type,
        udt_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND (udt_name = 'vector' OR column_name LIKE '%embedding%' OR column_name LIKE '%Embedding%')
      ORDER BY table_name, column_name;
    `);
    
    log(`\n📊 벡터 컬럼 목록:`, colors.cyan);
    for (const col of vectorTables.rows) {
      log(`  - ${col.table_name}.${col.column_name} (${col.udt_name || col.data_type})`, colors.cyan);
    }
    
    // 각 벡터 컬럼의 인덱스 확인
    log(`\n📊 벡터 인덱스 상태:`, colors.cyan);
    
    for (const col of vectorTables.rows) {
      const tableName = col.table_name;
      const columnName = col.column_name;
      
      // 인덱스 확인
      const indexes = await pool.query(`
        SELECT 
          indexname,
          indexdef
        FROM pg_indexes
        WHERE tablename = $1
        AND indexdef LIKE '%${columnName}%';
      `, [tableName]);
      
      // 데이터 개수 확인
      const countResult = await pool.query(`
        SELECT COUNT(*) as count 
        FROM "${tableName}" 
        WHERE "${columnName}" IS NOT NULL;
      `);
      const count = parseInt(countResult.rows[0].count);
      
      // 벡터 타입 확인
      const typeResult = await pool.query(`
        SELECT 
          pg_typeof("${columnName}") as type
        FROM "${tableName}"
        WHERE "${columnName}" IS NOT NULL
        LIMIT 1;
      `);
      
      let vectorType = 'unknown';
      let dimensions = null;
      if (typeResult.rows.length > 0) {
        vectorType = typeResult.rows[0].type;
        // vector(1536) 형식에서 차원 추출
        const dimMatch = vectorType.match(/vector\((\d+)\)/);
        if (dimMatch) {
          dimensions = parseInt(dimMatch[1]);
        }
      }
      
      log(`\n  테이블: ${tableName}.${columnName}`, colors.yellow);
      log(`    - 데이터 개수: ${count}개`, colors.cyan);
      log(`    - 타입: ${vectorType}`, colors.cyan);
      if (dimensions) {
        log(`    - 차원: ${dimensions}차원`, colors.cyan);
      }
      
      if (indexes.rows.length > 0) {
        log(`    - 인덱스: ✅ ${indexes.rows.length}개 존재`, colors.green);
        for (const idx of indexes.rows) {
          log(`      • ${idx.indexname}`, colors.green);
          if (idx.indexdef.includes('ivfflat')) {
            log(`        (ivfflat 인덱스)`, colors.green);
          } else if (idx.indexdef.includes('btree')) {
            log(`        ⚠️  (btree 인덱스 - 벡터에는 부적합)`, colors.yellow);
          }
        }
      } else {
        log(`    - 인덱스: ❌ 없음`, colors.red);
      }
      
      // 샘플 데이터 확인
      if (count > 0) {
        try {
          const sampleResult = await pool.query(`
            SELECT "${columnName}"
            FROM "${tableName}"
            WHERE "${columnName}" IS NOT NULL
            LIMIT 1;
          `);
          
          if (sampleResult.rows.length > 0) {
            const sample = sampleResult.rows[0][columnName];
            const sampleStr = typeof sample === 'string' ? sample.substring(0, 100) : String(sample).substring(0, 100);
            log(`    - 샘플 데이터: ${sampleStr}...`, colors.cyan);
          }
        } catch (e) {
          log(`    - 샘플 데이터 확인 실패: ${e.message}`, colors.yellow);
        }
      }
    }
    
    // pgvector 확장 확인
    const extResult = await pool.query(`
      SELECT * FROM pg_extension WHERE extname = 'vector';
    `);
    
    if (extResult.rows.length > 0) {
      log(`\n✅ pgvector 확장 설치됨`, colors.green);
    } else {
      log(`\n❌ pgvector 확장 미설치`, colors.red);
    }
    
    await pool.end();
  } catch (error) {
    log(`\n❌ 오류 발생: ${error.message}`, colors.red);
    console.error(error);
    await pool.end();
  }
}

async function main() {
  const STAGING_DATABASE_URL = process.env.STAGING_DATABASE_URL;
  const IT_DATABASE_URL = process.env.IT_DATABASE_URL || 
    'postgresql://postgres:namoai20250701@namoai-it.cluwk88i28od.ap-northeast-1.rds.amazonaws.com:5432/postgres';
  
  if (STAGING_DATABASE_URL) {
    await checkVectorIndexes(STAGING_DATABASE_URL, '스테이징');
  }
  
  if (IT_DATABASE_URL) {
    await checkVectorIndexes(IT_DATABASE_URL, 'IT');
  }
}

main().catch(console.error);

