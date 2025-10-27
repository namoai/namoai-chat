// scripts/gsm-fetch.mjs
// =============================================================================
//  目的
//  - (Netlify/Vercel 等のビルド環境で)
//  - GOOGLE_APPLICATION_CREDENTIALS を削除しても、BASE64/RAW があれば
//    必ず SA JSON ファイルを生成し、GOOGLE_APPLICATION_CREDENTIALS を再設定
//  - 既存コードが 'gcp/sa.json' を open しても、ADC が絶対パスを参照しても動くよう二箇所へ出力
//  - GSM から取得したシークレットを process.env にも注入し、.env.production.local にも書き出して
//    次の `next build` プロセスで確実に読み込めるようにする
//  - project_id が未指定でも、SA JSON から自動補완
// =============================================================================

import 'dotenv/config';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const log  = (...a) => console.log('[gsm-fetch]', ...a);
const warn = (...a) => console.warn('[gsm-fetch]', ...a);
const err  = (...a) => console.error('[gsm-fetch]', ...a);

// ▼▼▼ 変更点 ▼▼▼
// このスクリプトは 'production' ビルド専用です。
// NODE_ENV が 'production' でない場合 (例: 'development')、
// .env.local が直接使用されるべきなので、このスクリプトは何もせずに終了します。
if (process.env.NODE_ENV !== 'production') {
  log('NODE_ENV is not "production". Skipping GSM fetch.');
  log('ローカル開発では .env.local が使用されます。');
  process.exit(0); // 正常終了
}
log('NODE_ENV=production. Running GSM fetch script...');
// ▲▲▲ 変更点 ▲▲▲


const repoRoot   = process.cwd();
const saDir      = path.join(repoRoot, 'gcp');
const saRepoPath = path.join(saDir, 'sa.json');     // 既存コード用 (相対パス open 対応)
const saTmpPath  = '/tmp/gcp-sa.json';              // ADC 推奨の絶対パス
const outDir     = path.join(repoRoot, 'secrets');  // ランタイム参照用 JSON
const envOutPath = path.join(repoRoot, '.env.production.local'); // Next が自動読み込み (本番専用)

// 小ユーティリティ -------------------------------------------------------------
async function ensureDir(p) {
  await fsp.mkdir(p, { recursive: true });
}
async function writeText(filePath, content) {
  await ensureDir(path.dirname(filePath));
  await fsp.writeFile(filePath, content, { encoding: 'utf8' });
  log('wrote:', filePath);
}
function appendEnvLines(filePath, kv) {
  // .env に追記（必要なら上書きでも良い）
  const lines = Object.entries(kv).map(([k, v]) => {
    // 改行や空白を含む場合はクオート。必要に応じてエスケープを強化可能。
    const val = typeof v === 'string' ? v.replace(/\n/g, '\\n') : String(v);
    return `${k}=${val}`;
  }).join('\n') + '\n';
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, lines, { encoding: 'utf8' });
  log('appended env:', filePath);
}
function requireJson(text, label) {
  try {
    return JSON.parse(text);
  } catch (e) {
    err(`❌ ${label} の JSON パースに失敗しました。`);
    throw e;
  }
}

// SA ロード (本番環境専用ロジック) -----------------------------------------------
await ensureDir(saDir);

let saJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || '';
const saB64  = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64 || '';
// 本番ビルドでは GOOGLE_APPLICATION_CREDENTIALS (ファイルパス) は通常使わない
const saFile = process.env.GOOGLE_APPLICATION_CREDENTIALS_FILE || ''; 

// 1) ファイルパス (CI/CD でファイルを使う場合)
if (!saJson && saFile) {
  try {
    saJson = fs.readFileSync(saFile, 'utf8');
    log('read SA from file:', saFile);
  } catch (e) {
    warn('SA file 読み込み失敗:', saFile, e?.message);
  }
}
// 2) BASE64 (Netlify/Vercel の標準的な方法)
if (!saJson && saB64) {
  try {
    saJson = Buffer.from(saB64.trim(), 'base64').toString('utf8');
    log('decoded SA from BASE64 env');
  } catch (e) {
    err('❌ BASE64 からの復元に失敗しました。');
    throw e;
  }
}
if (!saJson) {
  err('❌ [Production Build] サービスアカウント JSON 不足: GOOGLE_APPLICATION_CREDENTIALS_JSON(_BASE64|_FILE) いずれも未設定');
  process.exit(1);
}

// JSON 妥当性（type=service_account を要求）
const saParsed = requireJson(saJson, 'サービスアカウント');
if (saParsed.type !== 'service_account') {
  err('❌ SA JSON: type != "service_account"');
  process.exit(1);
}

// SA を二箇所に出力（相対/絶対 の両対応）
await writeText(saRepoPath, saJson);
await writeText(saTmpPath,  saJson);

// ADC 参照パスを絶対パスへ
process.env.GOOGLE_APPLICATION_CREDENTIALS = saTmpPath;
log('GOOGLE_APPLICATION_CREDENTIALS =', saTmpPath);

// projectId 決定（環境変数優先 → SA JSON の project_id）
let projectId = process.env.GOOGLE_PROJECT_ID || process.env.GCP_PROJECT_ID;
if (!projectId) {
  const pid = saParsed?.project_id;
  if (typeof pid === 'string' && pid) {
    projectId = pid;
    process.env.GOOGLE_PROJECT_ID = projectId;
    log('GOOGLE_PROJECT_ID (from SA) =', projectId);
  }
}
if (!projectId) {
  err('❌ GOOGLE_PROJECT_ID (または GCP_PROJECT_ID) が見つかりません。');
  process.exit(1);
}

// GSM でシークレット取得 --------------------------------------------------------
const names = (process.env.GSM_SECRET_NAMES || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

if (names.length === 0) {
  warn('⚠️ GSM_SECRET_NAMES が設定されていません。GSM から取得するシークレットがありません。');
}

await ensureDir(outDir);

const client = new SecretManagerServiceClient(); // ADC 使用
const bag = {};

for (const name of names) {
  try {
    const [res] = await client.accessSecretVersion({
      name: `projects/${projectId}/secrets/${name}/versions/latest`,
    });
    const val = res.payload?.data?.toString('utf8') ?? '';
    bag[name] = val;
    // すぐに process.env にも注入（このプロセス内での以降の処理用）
    process.env[name] = val;
    log(`✅ fetched: ${name}`);
  } catch (e) {
    warn(`⚠️ fetch failed: ${name} ->`, e?.message);
    bag[name] = '';
  }
}

// JSON と .env.production.local にも書き出し（次の "next build" が読む） -----
await writeText(path.join(outDir, 'runtime.json'), JSON.stringify(bag, null, 2));

// 既存内容を壊したくない場合 append。ビルド専用なら write でも可。
appendEnvLines(envOutPath, bag);

log('✅ wrote secrets/runtime.json');
log('✅ env injected to .env.production.local');
log('SA repo path:', saRepoPath, 'exists:', fs.existsSync(saRepoPath));
log('SA tmp  path:', saTmpPath,  'exists:', fs.existsSync(saTmpPath));