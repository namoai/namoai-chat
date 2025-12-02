import { Pool } from 'pg';
import { resolveDatabaseUrlForPool } from '../resolve-database-url';

// RDS 연결 설정
// SSL이 필요한 경우 DATABASE_URL에 ?sslmode=require를 추가하세요
// 環境別のDATABASE_URLをサポート（後方互換性を維持）
// Supports environment-specific DATABASE_URL (maintains backward compatibility)
export const pool = new Pool({
  connectionString: resolveDatabaseUrlForPool(),
  // RDS SSL 연결이 필요한 경우 아래 옵션을 사용할 수 있습니다
  // ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});