const REQUIRED_ENV_VARS = ["NEXTAUTH_SECRET", "DATABASE_URL"] as const;

export async function register() {
  // サーバ環境でのみ実行（Edge/クライアントでは実行しない）
  if (typeof window !== "undefined") {
    return;
  }

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

