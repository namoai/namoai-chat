// src/lib/prisma.ts
import "@/lib/secrets-loader";
import { PrismaClient } from "@prisma/client";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

/**
 * グローバルキャッシュ宣言（開発環境でのHot Reload対策）
 */
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var __dbUrl: string | undefined;
}

/**
 * 実行時にDB URLを解決する
 * 1) ENV: DATABASE_URL
 * 2) GSM: projects/<PROJECT_ID>/secrets/<SECRET_ID>/versions/latest
 *    - GSM_DATABASE_URL_NAME（フルリソース名）
 *    - または GSM_PROJECT_ID + GSM_DATABASE_URL_ID の組み合わせ
 * 3) サービスアカウントJSONが環境変数（GOOGLE_APPLICATION_CREDENTIALS_JSON）に入っている場合は /tmp にファイル化
 */
async function resolveDatabaseUrl(): Promise<string> {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (global.__dbUrl) return global.__dbUrl;

  // NetlifyランタイムでサービスアカウントJSONを /tmp に保存し、ADCパスを設定
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const credPath = path.join("/tmp", "gcp-sa.json");
    await fs.writeFile(credPath, process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON, "utf8");
    process.env.GOOGLE_APPLICATION_CREDENTIALS = credPath;
  }

  const gsmName =
    process.env.GSM_DATABASE_URL_NAME ||
    (process.env.GSM_PROJECT_ID && process.env.GSM_DATABASE_URL_ID
      ? `projects/${process.env.GSM_PROJECT_ID}/secrets/${process.env.GSM_DATABASE_URL_ID}/versions/latest`
      : undefined);

  if (!gsmName) {
    throw new Error(
      "DATABASE_URLが存在せず、GSMのシークレット名も未設定です。DATABASE_URL または GSM_DATABASE_URL_NAME（もしくは GSM_PROJECT_ID + GSM_DATABASE_URL_ID）を設定してください。"
    );
  }

  const client = new SecretManagerServiceClient();
  const [version] = await client.accessSecretVersion({ name: gsmName });
  const payload = version.payload?.data?.toString();

  if (!payload) {
    throw new Error("GSM: DATABASE_URL シークレットのpayloadが空です。");
  }

  global.__dbUrl = payload;
  return payload;
}

/**
 * Prismaインスタンスをシングルトンとして取得
 * - 開発環境: global.prisma にキャッシュ
 * - 本番環境: サーバーレス特性により関数のコールドスタートごとに初期化
 */
export async function getPrisma(): Promise<PrismaClient> {
  if (global.prisma) return global.prisma;

  const datasourceUrl = await resolveDatabaseUrl();

  const client = new PrismaClient({
    datasources: { db: { url: datasourceUrl } },
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

  if (process.env.NODE_ENV !== "production") {
    global.prisma = client;
  }

  return client;
}