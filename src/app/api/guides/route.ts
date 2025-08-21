export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const guides = await prisma.guides.findMany({
      orderBy: [
        { mainCategory: 'asc' },
        { displayOrder: 'asc' },
        { subCategory: 'asc' },
      ],
    });

    // データを階層構造に整理します。
    const structuredGuides: { [key: string]: { [key: string]: typeof guides } } = {};

    guides.forEach(guide => {
      if (!structuredGuides[guide.mainCategory]) {
        structuredGuides[guide.mainCategory] = {};
      }
      if (!structuredGuides[guide.mainCategory][guide.subCategory]) {
        structuredGuides[guide.mainCategory][guide.subCategory] = [];
      }
      structuredGuides[guide.mainCategory][guide.subCategory].push(guide);
    });

    return NextResponse.json(structuredGuides);
  } catch (error) {
    console.error("ガイドデータの取得エラー:", error);
    return NextResponse.json(
      { error: "データの取得に失敗しました。" },
      { status: 500 }
    );
  }
}
