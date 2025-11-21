export const runtime = "nodejs";

const REQUIRED_ENV_VARS = ["NEXTAUTH_SECRET", "DATABASE_URL"] as const;

const isEdgeRuntime = () =>
  typeof process !== "undefined" && process.env.NEXT_RUNTIME === "edge";

export async function register() {
  // サーバ環境でのみ実行（Edge/クライアントでは実行しない）
  if (typeof window !== "undefined") {
    return;
  }

  if (isEdgeRuntime()) {
    console.log("[instrumentation] Skipping server-only setup on Edge runtime");
    return;
  }

  // AWS SSM Parameter Storeから環境変数を読み込む（Amplify Secretsが自動注入されない場合のフォールバック）
  await loadSecretsFromSSM();

  await prepareGcpCredentials();
  await runEnvSecurityChecks();
  verifyEnvVars();
}

async function loadSecretsFromSSM() {
  // 既に環境変数が設定されている場合はスキップ
  if (process.env.NEXTAUTH_SECRET && process.env.DATABASE_URL) {
    return;
  }

  try {
    // AWS SDK v3を使用してSSMから読み込む
    const { SSMClient, GetParametersByPathCommand } = await import("@aws-sdk/client-ssm");
    
    const appId = process.env.AWS_APP_ID || "duvg1mvqbm4y4";
    const branch = process.env.AWS_BRANCH || "main";
    const path = `/amplify/${appId}/${branch}/`;

    const client = new SSMClient({ region: process.env.AWS_REGION || "ap-northeast-1" });
    const command = new GetParametersByPathCommand({
      Path: path,
      WithDecryption: true,
      Recursive: true,
    });

    const response = await client.send(command);
    
    if (response.Parameters) {
      for (const param of response.Parameters) {
        const key = param.Name?.replace(path, "").replace(/\/$/, "");
        if (key && param.Value && !process.env[key]) {
          process.env[key] = param.Value;
          console.log(`[instrumentation] Loaded ${key} from SSM`);
        }
      }
    }
  } catch (error) {
    console.warn("[instrumentation] Failed to load secrets from SSM:", error);
    // SSM読み込み失敗は警告のみ（環境変数があればOK）
  }
}

async function prepareGcpCredentials() {
  try {
    // ensureGcpCreds 自体も動的 import（クライアントバンドルから完全に除外）
    const mod = await import("./utils/ensureGcpCreds");
    await mod.ensureGcpCreds();
  } catch (error) {
    console.error("[instrumentation] Failed to prepare GCP credentials:", error);
    if (process.env.NODE_ENV === "production") {
      throw error;
    }
  }
}

async function runEnvSecurityChecks() {
  try {
    const { initializeEnvSecurity } = await import("./lib/env-security");
    await initializeEnvSecurity();
  } catch (error) {
    console.error("[instrumentation] Environment validation failed:", error);
    if (process.env.NODE_ENV === "production") {
      throw error;
    }
  }
}

function verifyEnvVars(): void {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    const message = `[instrumentation] Missing environment variables: ${missing.join(", ")}`;
    if (process.env.NODE_ENV === "production") {
      throw new Error(message);
    }
    console.warn(message);
  } else {
    console.log("[instrumentation] Environment variables verified");
  }
}

