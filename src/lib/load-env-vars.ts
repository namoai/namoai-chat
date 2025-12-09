'use server';
import 'server-only';

let loaded = false;

/**
 * ランタイム専用の環境変数ローダー。
 * - Build/Edge では何もしない（node 組み込みをバンドルしないため）
 * - Lambda 実行時に .env 系ファイルがあれば最低限のパーサで取り込む
 * - DATABASE_URL / NEXTAUTH_SECRET が無ければ警告を出す
 */
export async function ensureEnvVarsLoaded(): Promise<void> {
  if (loaded) return;

  const runtime = (process as any)?.env?.NEXT_RUNTIME;
  // Edge やブラウザ、ビルド時はスキップ
  if (runtime === 'edge' || typeof process === 'undefined' || !process.versions?.node) {
    loaded = true;
    return;
  }
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    loaded = true;
    return;
  }

  if (!process.env.DATABASE_URL || !process.env.NEXTAUTH_SECRET) {
    console.warn('[load-env-vars] DATABASE_URL または NEXTAUTH_SECRET が未設定です (runtime)');
  }

  loaded = true;
}

