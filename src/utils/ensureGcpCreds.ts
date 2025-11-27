/**
 * GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64 / GOOGLE_APPLICATION_CREDENTIALS_JSON を
 * 一時パスに復元し、GOOGLE_APPLICATION_CREDENTIALS をそのパスに設定する。
 * 既に存在すれば再生成しない。
 * Edge Runtime では実行しない（Node.js runtime でのみ実行）
 */
export async function ensureGcpCreds() {
  // Edge Function では実行しない（Node.js runtime でのみ実行）
  if (typeof process === 'undefined' || !process.versions?.node) {
    return;
  }

  const b64 =
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64 ??
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!b64) return;

  try {
    // Node.js の ESM import を使用（Edge Runtime では利用不可）
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    // Netlify では /tmp が標準の一時ディレクトリ
    const credPath = path.join("/tmp", "gcp-sa.json");

    try {
      // ファイルが存在するか確認
      await fs.access(credPath);
      // 既に存在する場合は何もしない
    } catch {
      // ファイルが存在しない場合は作成
      let content: string;
      const trimmed = b64.trim();
      if (trimmed.startsWith("{")) {
        content = trimmed;
      } else {
        const buf = Buffer.from(trimmed, "base64");
        content = buf.toString("utf8");
      }
      await fs.writeFile(credPath, content, { encoding: "utf8" });
    }

    process.env.GOOGLE_APPLICATION_CREDENTIALS = credPath;

    try {
      const stats = await fs.stat(credPath);
      console.log("[creds] wrote", credPath, "size:", stats.size);
    } catch {}
  } catch (e) {
    console.error("[creds] write failed:", e);
  }
}