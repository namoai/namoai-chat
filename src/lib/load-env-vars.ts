'use server';
import 'server-only';

let loaded = false;

/**
 * Lambda/Amplify 런타임で環境変数を遅延ロードする。
 * - Amplify 環境変数が既に設定されていれば何もしない
 * - ランタイムのみ .env 系ファイルを同期読み込み（ビルド時/edgeはスキップ）
 */
export async function ensureEnvVarsLoaded(): Promise<void> {
  if (loaded) return;

  // Edge/ブラウザではスキップ
  const runtime = (process as any)?.env?.NEXT_RUNTIME;
  if (runtime === 'edge' || typeof process === 'undefined' || !process.versions?.node) {
    loaded = true;
    return;
  }
  // ビルド時は .env 読み込みをスキップ（Amplify はランタイムで環境変数を注入）
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    loaded = true;
    return;
  }

  const hasDatabaseUrl = !!process.env.DATABASE_URL;
  const hasNextAuthSecret = !!process.env.NEXTAUTH_SECRET;
  if (hasDatabaseUrl && hasNextAuthSecret) {
    loaded = true;
    return;
  }

  // ラン타임で만 node built-ins를 동적 import
  const fs = await import('fs');
  const path = await import('path');
  const dotenv = await import('dotenv');

  const candidates = [
    process.env.LAMBDA_TASK_ROOT && path.join(process.env.LAMBDA_TASK_ROOT, '.env'),
    process.env.LAMBDA_TASK_ROOT && path.join(process.env.LAMBDA_TASK_ROOT, '.env.production'),
    path.join(process.cwd(), '.env.lambda'),
    path.join(process.cwd(), '.env.production'),
    path.join(process.cwd(), '.env.local'),
    path.join(process.cwd(), '.env'),
  ].filter(Boolean) as string[];

  for (const filePath of candidates) {
    try {
      if (!fs.existsSync(filePath)) continue;
      const parsed = dotenv.parse(fs.readFileSync(filePath));
      for (const [key, value] of Object.entries(parsed)) {
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
      if (process.env.DATABASE_URL && process.env.NEXTAUTH_SECRET) {
        loaded = true;
        return;
      }
    } catch (err) {
      console.warn(`[load-env-vars] Failed to read ${filePath}:`, err);
    }
  }

  if (!process.env.DATABASE_URL || !process.env.NEXTAUTH_SECRET) {
    console.warn('[load-env-vars] Environment variables remain missing after loading .env files', {
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
      cwd: process.cwd(),
      lambdaTaskRoot: process.env.LAMBDA_TASK_ROOT,
    });
  }

  loaded = true;
}

