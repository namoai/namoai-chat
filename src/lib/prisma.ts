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
 * - GOOGLE_APPLICATION_CREDENTIALS_JSON（平文） or GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64（Base64）をサポート
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
 * GSMのシークレット名を解決
 * 優先順:
 *  1) GSM_DATABASE_URL_NAME（フルリソース名）
 *  2) GSM_SECRET_NAMES（カンマ区切り）から `/secrets/DATABASE_URL/` を含むもの or 先頭を採用
 *  3) GOOGLE_PROJECT_ID と GSM_DATABASE_URL_ID（省略時 'DATABASE_URL'）から組み立て
 */
function resolveSecretResourceName(): string | undefined {
  if (process.env.GSM_DATABASE_URL_NAME) {
    return process.env.GSM_DATABASE_URL_NAME;
  }

  const list = process.env.GSM_SECRET_NAMES?.split(",").map(s => s.trim()).filter(Boolean);
  if (list && list.length > 0) {
    const preferred = list.find(s => /\/secrets\/DATABASE_URL\//.test(s));
    return preferred ?? list[0];
  }

  if (process.env.GOOGLE_PROJECT_ID) {
    const id = process.env.GSM_DATABASE_URL_ID || "DATABASE_URL";
    return `projects/${process.env.GOOGLE_PROJECT_ID}/secrets/${id}/versions/latest`;
  }

  return undefined;
}

/**
 * 実行時またはビルド時に DB URL を取得
 * 1) ENV: DATABASE_URL
 * 2) GSM: resolveSecretResourceName() で求めた名前から取得
 */
async function resolveDatabaseUrl(): Promise<string> {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (global.__dbUrl) return global.__dbUrl;

  await ensureGcpCredsFile();

  const name = resolveSecretResourceName();
  if (!name) {
    throw new Error(
      "DATABASE_URL も GSM の指定も未設定です。次のいずれかを設定してください：DATABASE_URL / GSM_DATABASE_URL_NAME / GSM_SECRET_NAMES / (GOOGLE_PROJECT_ID + GSM_DATABASE_URL_ID)"
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
 * PrismaClient を生成（開発はグローバルにキャッシュ）
 * ※ ここはビルド時にも呼ばれ得るため、GSM対応済み
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