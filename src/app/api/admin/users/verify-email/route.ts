export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/nextauth';
import { getPrisma } from '@/lib/prisma';
import { isBuildTime, buildTimeResponse, safeJsonParse } from '@/lib/api-helpers';
import { Role } from '@prisma/client';

export async function POST(request: NextRequest) {
  if (isBuildTime()) return buildTimeResponse();

  const session = await getServerSession(authOptions);
  if (session?.user?.role !== Role.SUPER_ADMIN) {
    return NextResponse.json({ error: '権限がありません。' }, { status: 403 });
  }

  const parseResult = await safeJsonParse<{ userId: number; verified: boolean }>(request);
  if (!parseResult.success) return parseResult.error;

  const { userId, verified } = parseResult.data;
  if (!userId || typeof verified !== 'boolean') {
    return NextResponse.json({ error: '無効なデータです。' }, { status: 400 });
  }

  try {
    const prisma = await getPrisma();
    const updated = await prisma.users.update({
      where: { id: userId },
      data: { emailVerified: verified ? new Date() : null },
      select: { id: true, emailVerified: true },
    });
    return NextResponse.json({ success: true, user: updated }, { status: 200 });
  } catch (error) {
    console.error('[admin/users/verify-email] error:', error);
    return NextResponse.json({ error: 'メール認証状態の更新に失敗しました。' }, { status: 500 });
  }
}



