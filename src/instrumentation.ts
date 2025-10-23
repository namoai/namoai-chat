// Next.js가 서버 시작 시 자동 실행
export async function register() {
  // Edge 환경에서는 fs가 안 되므로 Node에서만 수행
  if (process.env.NEXT_RUNTIME === "nodejs" || typeof process === "object") {
    const { ensureGcpCreds } = await import("./utils/ensureGcpCreds");
    ensureGcpCreds();
  }
}