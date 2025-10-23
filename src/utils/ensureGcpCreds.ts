/**
 * GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64 / GOOGLE_APPLICATION_CREDENTIALS_JSON を
 * 一時パスに復元し、GOOGLE_APPLICATION_CREDENTIALS をそのパスに設定する。
 * 既に存在すれば再生成しない。
 */
export async function ensureGcpCreds() {
  const b64 =
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64 ??
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!b64) return;

  // ✅ requireを直接書かず、eval経由でNodeコアモジュールを解決する
  const fs = eval("require")("fs");
  const path = eval("require")("path");
  const os = eval("require")("os");

  const credPath = path.join(os.tmpdir(), "gcp-sa.json");

  try {
    if (!fs.existsSync(credPath)) {
      let content: string;
      const trimmed = b64.trim();
      if (trimmed.startsWith("{")) {
        content = trimmed;
      } else {
        const buf = Buffer.from(trimmed, "base64");
        content = buf.toString("utf8");
      }
      fs.writeFileSync(credPath, content, { encoding: "utf8" });
    }

    process.env.GOOGLE_APPLICATION_CREDENTIALS = credPath;

    try {
      const size = fs.statSync(credPath).size;
      console.log("[creds] wrote", credPath, "size:", size);
    } catch {}
  } catch (e) {
    console.error("[creds] write failed:", e);
  }
}