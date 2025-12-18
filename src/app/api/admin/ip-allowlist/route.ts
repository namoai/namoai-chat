export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { Role } from '@prisma/client';
import { safeJsonParse } from '@/lib/api-helpers';
import { isSupportedPattern } from '@/lib/security/ip-match';

type PrismaClientLike = Awaited<ReturnType<typeof getPrisma>>;

async function ensureTable(prisma: PrismaClientLike) {
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "admin_ip_allowlist" (
      "id" SERIAL PRIMARY KEY,
      "ip" TEXT NOT NULL UNIQUE,
      "label" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`
  );
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "admin_ip_allowlist_createdAt_idx" ON "admin_ip_allowlist" ("createdAt")`);
}

function validatePattern(pattern: string): boolean {
  return isSupportedPattern(pattern);
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== Role.SUPER_ADMIN) {
    return NextResponse.json({ error: '権限がありません。' }, { status: 403 });
  }

  const prisma = await getPrisma();
  await ensureTable(prisma);
  const rows: Array<{ ip: string; label: string | null; createdAt: string }> = await prisma.$queryRawUnsafe(
    `SELECT "ip","label","createdAt" FROM "admin_ip_allowlist" ORDER BY "createdAt" DESC`
  );
  return NextResponse.json({ allowlist: rows }, { status: 200 });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== Role.SUPER_ADMIN) {
    return NextResponse.json({ error: '権限がありません。' }, { status: 403 });
  }

  const parseResult = await safeJsonParse<{ ip: string; label?: string }>(request);
  if (!parseResult.success) return parseResult.error;

  const ip = (parseResult.data.ip || '').trim();
  const label = (parseResult.data.label || '').trim();
  if (!ip) return NextResponse.json({ error: 'IPアドレスが必要です。' }, { status: 400 });
  if (!validatePattern(ip)) {
    return NextResponse.json(
      { error: '無効なIP形式です。（例: 111.111.111.* / 111.111.111.0/24 / 111.111.111.111）' },
      { status: 400 }
    );
  }

  const prisma = await getPrisma();
  await ensureTable(prisma);

  try {
    await prisma.$executeRaw`INSERT INTO "admin_ip_allowlist" ("ip","label") VALUES (${ip}, ${label || null})`;
  } catch {
    return NextResponse.json({ error: '既に登録されています。' }, { status: 400 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== Role.SUPER_ADMIN) {
    return NextResponse.json({ error: '権限がありません。' }, { status: 403 });
  }

  const parseResult = await safeJsonParse<{ ip: string }>(request);
  if (!parseResult.success) return parseResult.error;
  const ip = (parseResult.data.ip || '').trim();
  if (!ip) return NextResponse.json({ error: 'IPアドレスが必要です。' }, { status: 400 });

  const prisma = await getPrisma();
  await ensureTable(prisma);
  await prisma.$executeRaw`DELETE FROM "admin_ip_allowlist" WHERE "ip" = ${ip}`;
  return NextResponse.json({ success: true }, { status: 200 });
}


