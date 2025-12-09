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

  const hasDb = !!process.env.DATABASE_URL;
  const hasSecret = !!process.env.NEXTAUTH_SECRET;

  if (!hasDb || !hasSecret) {
    // ランタイムのみ node 組み込みを動的 import
    const fs = await import('fs');

    // 簡易 .env パーサ（依存を増やさない）
    const parseEnv = (content: string): Record<string, string> => {
      const vars: Record<string, string> = {};
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq <= 0) continue;
        const key = trimmed.slice(0, eq).trim();
        const value = trimmed.slice(eq + 1).trim();
        if (key) vars[key] = value;
      }
      return vars;
    };

    const join = (...parts: Array<string | undefined>) =>
      parts.filter(Boolean).join('/');

    const candidates = [
      process.env.LAMBDA_TASK_ROOT && join(process.env.LAMBDA_TASK_ROOT, '.env'),
      process.env.LAMBDA_TASK_ROOT && join(process.env.LAMBDA_TASK_ROOT, '.env.production'),
      join(process.cwd(), '.env.lambda'),
      join(process.cwd(), '.env.production'),
      join(process.cwd(), '.env.local'),
      join(process.cwd(), '.env'),
    ].filter(Boolean) as string[];

    for (const filePath of candidates) {
      try {
        if (!fs.existsSync(filePath)) continue;
        const parsed = parseEnv(fs.readFileSync(filePath, 'utf8'));
        for (const [k, v] of Object.entries(parsed)) {
          if (!process.env[k]) {
            process.env[k] = v;
          }
        }
        if (process.env.DATABASE_URL && process.env.NEXTAUTH_SECRET) {
          loaded = true;
          return;
        }
      } catch (err) {
        console.warn(`[load-env-vars] .env 読み込み失敗 (${filePath}):`, err);
      }
    }
  }

  if (!process.env.DATABASE_URL || !process.env.NEXTAUTH_SECRET) {
    console.warn('[load-env-vars] DATABASE_URL または NEXTAUTH_SECRET が未設定です (runtime)');
  }

  loaded = true;
}

