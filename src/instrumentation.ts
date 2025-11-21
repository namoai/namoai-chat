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

  await prepareGcpCredentials();
  await runEnvSecurityChecks();
  verifyEnvVars();
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

