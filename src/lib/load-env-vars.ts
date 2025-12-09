'use server';
import 'server-only';

let loaded = false;

/**
 * ランタイム専用の環境変数ローダー（ビルド/Edgeでは何もしない）。
 * Amplify/Lambda が環境変数を注入する前提。欠損時は警告のみ出力。
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

