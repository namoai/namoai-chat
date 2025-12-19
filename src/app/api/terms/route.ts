export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { isBuildTime, buildTimeResponse } from '@/lib/api-helpers';

// ── GET /api/terms ───────────────────────────────────────────────
// 公開用: ログイン不要で全約款を取得
export async function GET() {
  if (isBuildTime()) return buildTimeResponse();

  try {
    const prisma = await getPrisma();
    const terms = await prisma.terms.findMany({
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        slug: true,
        title: true,
        displayOrder: true,
        createdAt: true,
        updatedAt: true,
        // contentは含めない（個別取得用）
      },
    });
    return NextResponse.json(terms);
  } catch (error) {
    console.error("約款取得エラー:", error);
    return NextResponse.json({ message: '約款の取得に失敗しました。' }, { status: 500 });
  }
}

