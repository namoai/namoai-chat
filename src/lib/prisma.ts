// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

/**
 * グローバルキャッシュ（開発環境のHot Reload対策）
 */
declare global {
  // 開発時のみ使用。プロダクションでは毎コールドスタートで生成される想定
  var __prisma: PrismaClient | undefined;
  var __dbUrl: string | undefined;
}

/**
 * サービスアカウントJSONがENVに入っている場合、/tmp に展開してADCパスを設定
 */
async function ensureGcpCredsFile() {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const credPath = path.join("/tmp", "gcp-sa.json");
    await fs.writeFile(credPath, process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON, "utf8");
    process.env.GOOGLE_APPLICATION_CREDENTIALS = credPath;
  }
}

/**
 * 実行時にDB URLを解決
 * 1) ENV: DATABASE_URL
 * 2) GSM: GSM_DATABASE_URL_NAME（フル名）または GSM_PROJECT_ID + GSM_DATABASE_URL_ID
 */
async function resolveDatabaseUrl(): Promise<string> {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (global.__dbUrl) return global.__dbUrl;

  await ensureGcpCredsFile();

  const name =
    process.env.GSM_DATABASE_URL_NAME ||
    (process.env.GSM_PROJECT_ID && process.env.GSM_DATABASE_URL_ID
      ? `projects/${process.env.GSM_PROJECT_ID}/secrets/${process.env.GSM_DATABASE_URL_ID}/versions/latest`
      : undefined);

  if (!name) {
    throw new Error(
      "DATABASE_URL も GSM シークレット名も未設定です。DATABASE_URL または GSM_DATABASE_URL_NAME（もしくは GSM_PROJECT_ID + GSM_DATABASE_URL_ID）を設定してください。"
    );
  }

  const client = new SecretManagerServiceClient();
  const [version] = await client.accessSecretVersion({ name });
  const payload = version.payload?.data?.toString();
  if (!payload) throw new Error("GSM: DATABASE_URL のpayloadが空です。");

  global.__dbUrl = payload;
  return payload;
}

/**
 * PrismaClient を作成（開発はグローバルにキャッシュ）
 */
async function createPrisma(): Promise<PrismaClient> {
  if (global.__prisma) return global.__prisma;

  const url = await resolveDatabaseUrl();

  const instance = new PrismaClient({
    datasources: { db: { url } },
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

  if (process.env.NODE_ENV !== "production") {
    global.__prisma = instance;
  }
  return instance;
}

/**
 * 互換性維持のため：
 * - 既存コードの `import { prisma } from "@/lib/prisma"` をそのまま使えるよう、
 *   トップレベルawaitで PrismaClient インスタンスをエクスポート
 * - 併せて getPrisma も提供
 */
export const prisma: PrismaClient = await createPrisma();
export async function getPrisma(): Promise<PrismaClient> {
  return prisma;
}