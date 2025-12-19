export const runtime = 'nodejs';

import { NextResponse, NextRequest } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { isBuildTime, buildTimeResponse } from '@/lib/api-helpers';

// ── GET /api/terms/[slug] ───────────────────────────────────────────────
// 公開用: ログイン不要で特定の約款を取得
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (isBuildTime()) return buildTimeResponse();

  try {
    const { slug } = await params;
    const prisma = await getPrisma();
    const term = await prisma.terms.findUnique({
      where: { slug },
    });

    if (!term) {
      return NextResponse.json({ message: '約款が見つかりませんでした。' }, { status: 404 });
    }

    return NextResponse.json(term);
  } catch (error) {
    console.error("約款取得エラー:", error);
    return NextResponse.json({ message: '約款の取得に失敗しました。' }, { status: 500 });
  }
}

