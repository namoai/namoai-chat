// Next.js がサーバ起動時に実行されるフック
const REQUIRED_ENV_VARS = ["NEXTAUTH_SECRET", "DATABASE_URL"] as const;

export async function register() {
  // サーバ環境でのみ実行（Edge/クライアントでは実行しない）
  if (typeof window !== "undefined") {
    return;
  }

  try {
    // ensureGcpCreds 自体も動的 import（クライアントバンドルから完全に除外）
    const mod = await import("./utils/ensureGcpCreds");
    await mod.ensureGcpCreds();
  } catch (error) {
    console.error("GCP認証情報のセットアップに失敗しました:", error);
    if (process.env.NODE_ENV === "production") {
      throw error;
    }
  }

  verifyEnvVars();
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

