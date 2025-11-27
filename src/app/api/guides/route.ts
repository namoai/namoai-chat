// src/app/api/guides/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import type { guides as GuideRow } from '@prisma/client';
import { isBuildTime, buildTimeResponse } from '@/lib/api-helpers';

/* ============================================================================
 *  /api/guides - ガイド一覧（階層構造）API
 *  - ビルド時の静的収集を回避（dynamic）
 *  - どんな異常時でも必ず JSON を返却（空レスポンス禁止）
 * ==========================================================================*/
export async function GET() {
  if (isBuildTime()) return buildTimeResponse();
  
  try {
    const prisma = await getPrisma();
    const rows = await prisma.guides.findMany({
      orderBy: [
        { mainCategory: 'asc' },
        { displayOrder: 'asc' },
        { subCategory: 'asc' },
      ],
    });

    const structured: Record<string, Record<string, GuideRow[]>> = {};
    for (const g of rows) {
      const main = (g.mainCategory ?? '未分類').trim() || '未分類';
      const sub = (g.subCategory ?? 'その他').trim() || 'その他';
      if (!structured[main]) structured[main] = {};
      if (!structured[main][sub]) structured[main][sub] = [];
      structured[main][sub].push(g);
    }

    // 念のため Content-Type と no-store を明示
    return new NextResponse(JSON.stringify(structured), {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[api/guides] 取得エラー:', error);

    // 失敗時も必ず JSON ボディを返す（空レスポンス禁止）
    const fallback = { ok: false, error: 'ガイドデータの取得に失敗しました。', data: {} };
    return new NextResponse(JSON.stringify(fallback), {
      status: 500,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      },
    });
  }
}