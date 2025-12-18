export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

/**
 * Internal endpoint used by middleware to load admin IP allowlist patterns.
 */
export async function GET() {
  try {
    const prisma = await getPrisma();

    await prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "admin_ip_allowlist" (
        "id" SERIAL PRIMARY KEY,
        "ip" TEXT NOT NULL UNIQUE,
        "label" TEXT,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`
    );
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "admin_ip_allowlist_createdAt_idx" ON "admin_ip_allowlist" ("createdAt")`);

    const rows: Array<{ ip: string }> = await prisma.$queryRawUnsafe(
      `SELECT "ip" FROM "admin_ip_allowlist" ORDER BY "createdAt" DESC`
    );

    return NextResponse.json({ ips: rows.map((r) => r.ip) }, { status: 200 });
  } catch (e: unknown) {
    console.error('[internal/admin-ip-allowlist] error:', e);
    return NextResponse.json({ ips: [] }, { status: 200 });
  }
}



