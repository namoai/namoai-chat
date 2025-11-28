// src/lib/db.ts
import { Pool } from 'pg';
export { prisma as db } from '@/lib/prisma';

// RDS 연결 설정
// SSL이 필요한 경우 DATABASE_URL에 ?sslmode=require를 추가하세요
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // RDS SSL 연결이 필요한 경우 아래 옵션을 사용할 수 있습니다
  // ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

export default pool;