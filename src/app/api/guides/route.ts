export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { guides as GuideRow } from '@prisma/client';

/* ============================================================================
 *  /api/guides - ガイド一覧（階層構造）API
 *  - ビルド時の静的収集を回避するため dynamic を強制
 *  - Prisma で取得 → main/sub カテゴリでグルーピング
 *  - null/undefined のカテゴリはフォールバック名で分類
 * ==========================================================================*/

export async function GET() {
  try {
    // --- データ取得 ---
    const rows = await prisma.guides.findMany({
      orderBy: [
        { mainCategory: 'asc' },
        { displayOrder: 'asc' },
        { subCategory: 'asc' },
      ],
    });

    // --- 階層構造（mainCategory → subCategory → Guide[]）に整形 ---
    const structured: Record<string, Record<string, GuideRow[]>> = {};

    for (const g of rows) {
      // カテゴリのフォールバック（null/undefined を排除）
      const main = (g.mainCategory ?? '未分類').trim() || '未分類';
      const sub = (g.subCategory ?? 'その他').trim() || 'その他';

      if (!structured[main]) structured[main] = {};
      if (!structured[main][sub]) structured[main][sub] = [];
      structured[main][sub].push(g);
    }

    // --- JSON を返却 ---
    return NextResponse.json(structured, { status: 200 });
  } catch (error) {
    console.error('[api/guides] 取得エラー:', error);
    return NextResponse.json(
      { ok: false, error: 'ガイドデータの取得に失敗しました。' },
      { status: 500 }
    );
  }
}