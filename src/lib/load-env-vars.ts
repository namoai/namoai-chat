'use server';
import 'server-only';

import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';

let loaded = false;

/**
 * Lambda/Amplify 런타임で環境変数を遅延ロードする。
 * - Amplify 環境変数が既に設定されていれば何もしない
 * - 同期的に .env 系ファイルを順に読み込み、未設定のキーだけ埋める
 * - ビルド時にも読み込まれないよう「use server」+ server-only にしている
 */
export async function ensureEnvVarsLoaded(): Promise<void> {
  if (loaded) return;

  const hasDatabaseUrl = !!process.env.DATABASE_URL;
  const hasNextAuthSecret = !!process.env.NEXTAUTH_SECRET;

  // 既に主要な環境変数があるならスキップ
  if (hasDatabaseUrl && hasNextAuthSecret) {
    loaded = true;
    return;
  }

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
      // 主要なキーが揃ったら終了
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

