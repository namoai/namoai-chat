// src/lib/db.ts
import { Pool } from 'pg';
export { prisma as db } from '@/lib/prisma';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default pool;