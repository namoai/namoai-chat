// scripts/gsm-fetch.mjs
import 'dotenv/config';
import fs from "node:fs";
import path from "node:path";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

// --- SA 키 로드: JSON / BASE64 / FILE 경로 모두 지원 ---
const saDir = path.join(process.cwd(), "gcp");
const saPath = path.join(saDir, "sa.json");
fs.mkdirSync(saDir, { recursive: true });

let saJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || "";
const saB64  = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64 || "";
const saFile = process.env.GOOGLE_APPLICATION_CREDENTIALS_FILE || process.env.GOOGLE_APPLICATION_CREDENTIALS || "";

// 1) 파일 경로 우선
if (!saJson && saFile) {
  saJson = fs.readFileSync(saFile, "utf8");
}
// 2) Base64 다음
if (!saJson && saB64) {
  saJson = Buffer.from(saB64.trim(), "base64").toString("utf8");
}
if (!saJson) {
  console.error("❌ GOOGLE_APPLICATION_CREDENTIALS_JSON(_BASE64|_FILE) 없음");
  process.exit(1);
}

// JSON 유효성 검사
let parsed;
try {
  parsed = JSON.parse(saJson);
  if (parsed.type !== "service_account") throw new Error("type != service_account");
} catch (e) {
  console.error("❌ 서비스 계정 키 JSON 파싱 실패. 값이 JSON 혹은 Base64(또는 파일 경로)인지 확인하세요.");
  throw e;
}
fs.writeFileSync(saPath, saJson, "utf8");

// GSM 클라이언트(ADC)
process.env.GOOGLE_APPLICATION_CREDENTIALS = saPath;
const client = new SecretManagerServiceClient();

// 프로젝트 ID
const projectId = process.env.GOOGLE_PROJECT_ID || process.env.GCP_PROJECT_ID;
if (!projectId) {
  console.error("❌ GOOGLE_PROJECT_ID (또는 GCP_PROJECT_ID) 없음");
  process.exit(1);
}

// 가져올 비밀 이름들
const names = (process.env.GSM_SECRET_NAMES || "")
  .split(",").map(s => s.trim()).filter(Boolean);

// 결과 저장
const outDir = path.join(process.cwd(), "secrets");
fs.mkdirSync(outDir, { recursive: true });

const bag = {};
for (const name of names) {
  const [res] = await client.accessSecretVersion({
    name: `projects/${projectId}/secrets/${name}/versions/latest`,
  });
  bag[name] = res.payload?.data?.toString("utf8") ?? "";
  console.log(`✅ fetched: ${name}`);
}

fs.writeFileSync(path.join(outDir, "runtime.json"), JSON.stringify(bag, null, 2));
console.log("✅ wrote secrets/runtime.json");

// scripts/gsm-fetch.mjs 끝부분에
console.log("SA path:", saPath, "exists:", fs.existsSync(saPath));