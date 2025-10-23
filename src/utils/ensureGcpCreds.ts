import fs from "node:fs";
import path from "node:path";

export function ensureGcpCreds() {
  const b64 =
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64 ??
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!b64) return;

  const credPath = path.join("/tmp", "gcp-sa.json");
  try {
    if (!fs.existsSync(credPath)) {
      const buf = Buffer.from(b64.trim(), "base64");
      // raw JSON이 들어온 경우도 대비
      const text = buf.toString("utf8");
      const content = text.startsWith("{") ? text : Buffer.from(b64.trim(), "base64").toString("utf8");
      fs.writeFileSync(credPath, content);
    }
    process.env.GOOGLE_APPLICATION_CREDENTIALS = credPath;
    // 디버그(문제 해결되면 삭제 가능)
    const size = fs.statSync(credPath).size;
    console.log("[creds] wrote", credPath, "size:", size);
  } catch (e) {
    console.error("[creds] write failed:", e);
  }
}