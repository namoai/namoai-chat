import { NextRequest, NextResponse } from 'next/server';

/**
 * ビルド時の実行を防ぐためのチェック
 */
export function isBuildTime(): boolean {
  return process.env.NEXT_PHASE === 'phase-production-build';
}

/**
 * ビルド時のレスポンスを返す
 */
export function buildTimeResponse() {
  return NextResponse.json({ error: 'Not available during build' }, { status: 503 });
}

/**
 * リクエストボディから安全にJSONをパースする
 */
export async function safeJsonParse<T = unknown>(request: NextRequest): Promise<{ success: true; data: T } | { success: false; error: NextResponse }> {
  try {
    const text = await request.text();
    if (!text || text.trim() === '') {
      return {
        success: false,
        error: NextResponse.json({ error: 'リクエストボディが空です。' }, { status: 400 })
      };
    }
    const data = JSON.parse(text) as T;
    return { success: true, data };
  } catch (parseError) {
    console.error("JSON解析エラー:", parseError);
    return {
      success: false,
      error: NextResponse.json({ error: '無効なJSON形式です。' }, { status: 400 })
    };
  }
}

/**
 * APIルートの共通設定
 */
export const routeConfig = {
  runtime: 'nodejs' as const,
  dynamic: 'force-dynamic' as const,
};

