/**
 * GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64 / GOOGLE_APPLICATION_CREDENTIALS_JSON を
 * 一時パスに復元し、GOOGLE_APPLICATION_CREDENTIALS をそのパスに設定する。
 * 既に存在すれば再生成しない。
 * Edge Runtime では実行しない（Node.js runtime でのみ実行）
 */
export async function ensureGcpCreds() {
  // Edge Function では実行しない（Node.js runtime でのみ実行）
  // Netlify Edge Runtime では fs モジュールが利用できない
  if (typeof process === 'undefined' || !process.versions?.node) {
    return;
  }

  // fs モジュールが利用可能かどうかを先にチェック
  try {
    // 動的 import を試みて、失敗した場合は Edge Runtime と判断
    await import("fs/promises");
  } catch (e) {
    // Edge Runtime では fs モジュールが利用できない
    const isModuleNotFoundError = 
      e instanceof Error && 
      (e.message.includes("Cannot find module") || 
       ('code' in e && e.code === "MODULE_NOT_FOUND"));
    
    if (isModuleNotFoundError) {
      return;
    }
    throw e;
  }

  const b64 =
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64 ??
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!b64) return;

  try {
    // Node.js の ESM import を使用（Edge Runtime では利用不可）
    // node: プレフィックスは webpack で問題を起こすため削除
    const fs = await import("fs/promises");
    const path = await import("path");
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
      
      // ▼▼▼【デバッグ】サービスアカウント情報をログ出力 ▼▼▼
      try {
        const saContent = await fs.readFile(credPath, 'utf8');
        const saJson = JSON.parse(saContent);
        console.log("[creds] 📋 サービスアカウント情報:");
        console.log(`[creds]    - project_id: ${saJson.project_id || 'N/A'}`);
        console.log(`[creds]    - client_email: ${saJson.client_email || 'N/A'}`);
        console.log(`[creds]    - type: ${saJson.type || 'N/A'}`);
        console.log(`[creds]    - GOOGLE_PROJECT_ID env: ${process.env.GOOGLE_PROJECT_ID || 'not set'}`);
      } catch (parseError) {
        console.warn("[creds] ⚠️ サービスアカウントJSONの解析に失敗:", parseError);
      }
      // ▲▲▲
    } catch {}
  } catch (e) {
    // Edge Runtime でのエラーは無視（既にチェック済みだが念のため）
    const isModuleNotFoundError = 
      e instanceof Error && 
      (e.message.includes("Cannot find module") || 
       ('code' in e && e.code === "MODULE_NOT_FOUND"));
    
    if (isModuleNotFoundError) {
      return;
    }
    console.error("[creds] write failed:", e);
  }
}