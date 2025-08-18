// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

/**
 * グローバルキャッシュ（開発環境のHot Reload対策）
 */
declare global {
  var __prisma: PrismaClient | undefined;
  var __dbUrl: string | undefined;
}

/**
 * サービスアカウントJSONを /tmp に展開して ADC を設定
 * - GOOGLE_APPLICATION_CREDENTIALS が既にあれば何もしない
 * - GOOGLE_APPLICATION_CREDENTIALS_JSON（平文） or
 *   GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64（Base64）をサポート
 */
async function ensureGcpCredsFile() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return;

  const jsonRaw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  const jsonB64 = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64;

  if (!jsonRaw && !jsonB64) return;

  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const credPath = path.join("/tmp", "gcp-sa.json");
  const json = jsonRaw ?? Buffer.from(jsonB64!, "base64").toString("utf8");
  await fs.writeFile(credPath, json, "utf8");
  process.env.GOOGLE_APPLICATION_CREDENTIALS = credPath;
}

/**
 * Secret Manager のリソース名を構築
 * - 画面のシークレット命名に合わせて、IDは常に "DATABASE_URL" を使用
 * - projects/{GOOGLE_PROJECT_ID}/secrets/DATABASE_URL/versions/latest
 */
function buildDatabaseUrlSecretName(): string | undefined {
  const projectId = process.env.GOOGLE_PROJECT_ID;
  if (!projectId) return undefined;
  return `projects/${projectId}/secrets/DATABASE_URL/versions/latest`;
}

/**
 * 実行時またはビルド時に DB URL を取得
 * 1) ENV: DATABASE_URL（存在すれば最優先で使用）
 * 2) GSM: projects/{GOOGLE_PROJECT_ID}/secrets/DATABASE_URL/versions/latest から取得
 */
async function resolveDatabaseUrl(): Promise<string> {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (global.__dbUrl) return global.__dbUrl;

  // Secret Manager を使うためのADC設定
  await ensureGcpCredsFile();

  const name = buildDatabaseUrlSecretName();
  if (!name) {
    throw new Error(
      "GOOGLE_PROJECT_ID が未設定です。ENVの DATABASE_URL を直接設定するか、GOOGLE_PROJECT_ID とサービスアカウントJSONを設定してください。"
    );
  }

  const client = new SecretManagerServiceClient();
  const [version] = await client.accessSecretVersion({ name });
  const payload = version.payload?.data?.toString();
  if (!payload) throw new Error("GSM: DATABASE_URL シークレットのpayloadが空です。");

  global.__dbUrl = payload;
  return payload;
}

/**
 * PrismaClient を生成（開発はグローバルにキャッシュ）
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
 * 互換エクスポート:
 * - 既存コードの `import { prisma } from "@/lib/prisma"` をそのまま利用可能
 * - 併用用に getPrisma も提供
 */
export const prisma: PrismaClient = await createPrisma();
export async function getPrisma(): Promise<PrismaClient> {
  return prisma;
}