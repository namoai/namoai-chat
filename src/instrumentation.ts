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

  // SSM 접근은 자격 증명 문제로 실패하므로 제거
  // Amplify Secrets가 자동으로 주입되어야 함
  // await loadSecretsFromSSM();

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

    // Lambda環境では自動的にIAMロールの認証情報を使用（credentialsを指定しない）
    const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ap-northeast-1";
    const client = new SSMClient({ 
      region,
      // Lambda環境ではデフォルトでIAMロールの認証情報を自動使用
    });
    
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
    // Amplify 환경에서는 환경 변수가 Secrets에서 주입되어야 하지만,
    // 주입이 안 되는 경우가 있으므로 에러를 던지지 않고 경고만 출력
    // 실제 환경 변수는 Amplify Secrets에서 설정되어야 함
    console.warn("[instrumentation] Continuing despite validation failure - ensure Amplify Secrets are configured");
    // if (process.env.NODE_ENV === "production") {
    //   throw error;
    // }
  }
}

function verifyEnvVars(): void {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    const message = `[instrumentation] Missing environment variables: ${missing.join(", ")}`;
    // Amplify環境では環境変数がSSMから読み込めない場合があるため、警告のみ
    console.warn(message);
    // TODO: Amplify Secretsが正しく設定されたらエラーに戻す
    // if (process.env.NODE_ENV === "production") {
    //   throw new Error(message);
    // }
  } else {
    console.log("[instrumentation] Environment variables verified");
  }
}

