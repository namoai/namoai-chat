// GSMから環境変数をロードしてNEXT_PUBLIC_*として.env.localに書き込む
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const fs = require('fs');
const path = require('path');

async function setupGcpCredentials() {
  // ▼▼▼【重要】ビルド時にGCP認証ファイルを準備 ▼▼▼
  const base64Creds = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64;
  const jsonCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

  if (!base64Creds && !jsonCreds) {
    console.log('⚠️  GCP credentials not found in environment, checking for file...');
    
    // gcp/sa.json ファイルが存在するか確認
    const credPath = path.join(process.cwd(), 'gcp', 'sa.json');
    if (fs.existsSync(credPath)) {
      console.log('✅ Using existing gcp/sa.json file');
      process.env.GOOGLE_APPLICATION_CREDENTIALS = credPath;
      return;
    }
    
    // ▼▼▼【AWS Amplify対応】GCP credentialsがなくても環境変数があれば続行可能 ▼▼▼
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.log('⚠️  GCP credentials not found, but environment variables are available. Skipping GSM.');
      return; // エラーを投げずに続行
    }
    // ▲▲▲
    
    throw new Error('GCP credentials not found. Set GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64 or GOOGLE_APPLICATION_CREDENTIALS_JSON');
  }

  // JSON文字列を取得（base64またはJSON）
  let credsJson;
  if (base64Creds) {
    credsJson = Buffer.from(base64Creds, 'base64').toString('utf8');
    console.log('✅ Decoded GCP credentials from base64');
  } else {
    credsJson = jsonCreds;
    console.log('✅ Using GCP credentials from JSON');
  }

  // gcp ディレクトリがなければ作成
  const gcpDir = path.join(process.cwd(), 'gcp');
  if (!fs.existsSync(gcpDir)) {
    fs.mkdirSync(gcpDir, { recursive: true });
  }

  // sa.json ファイルに書き込み
  const credPath = path.join(gcpDir, 'sa.json');
  fs.writeFileSync(credPath, credsJson);
  process.env.GOOGLE_APPLICATION_CREDENTIALS = credPath;
  console.log('✅ Created gcp/sa.json from environment variable');
  // ▲▲▲
}

async function loadSecrets() {
  try {
    // 1. GCP認証を設定
    await setupGcpCredentials();

    // ▼▼▼【AWS Amplify対応】環境変数があればGSMスキップ可能 ▼▼▼
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.log('✅ Environment variables already set, skipping GSM');
      console.log('✅ NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL.substring(0, 30) + '...');
      console.log('✅ NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 30) + '...');
      // .env.localにも書き込み（念のため）
      const envContent = `NEXT_PUBLIC_SUPABASE_URL=${process.env.NEXT_PUBLIC_SUPABASE_URL}\nNEXT_PUBLIC_SUPABASE_ANON_KEY=${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}\n`;
      fs.writeFileSync('.env.local', envContent);
      return; // GSMスキップして続行
    }
    // ▲▲▲

    const client = new SecretManagerServiceClient({ fallback: true });
    const projectId = process.env.GOOGLE_PROJECT_ID;

    if (!projectId) {
      throw new Error('GOOGLE_PROJECT_ID environment variable is not set');
    }

    console.log('🔐 Loading secrets from Google Secret Manager...');
    console.log(`📦 Project ID: ${projectId}`);

    // 2. SUPABASE_URLを読み込み
    const [urlSecret] = await client.accessSecretVersion({
      name: `projects/${projectId}/secrets/SUPABASE_URL/versions/latest`
    });
    const url = Buffer.from(urlSecret.payload.data).toString('utf8').trim();

    // 3. SUPABASE_ANON_KEYを読み込み
    const [keySecret] = await client.accessSecretVersion({
      name: `projects/${projectId}/secrets/SUPABASE_ANON_KEY/versions/latest`
    });
    const key = Buffer.from(keySecret.payload.data).toString('utf8').trim();

    // 4. NEXT_PUBLIC_*として.env.localに書き込み
    const envContent = `NEXT_PUBLIC_SUPABASE_URL=${url}\nNEXT_PUBLIC_SUPABASE_ANON_KEY=${key}\n`;
    fs.writeFileSync('.env.local', envContent);

    console.log('✅ GSMから環境変数をロードしました');
    console.log('✅ NEXT_PUBLIC_SUPABASE_URL:', url.substring(0, 30) + '...');
    console.log('✅ NEXT_PUBLIC_SUPABASE_ANON_KEY:', key.substring(0, 30) + '...');
  } catch (error) {
    console.error('❌ GSMロード失敗:', error.message);
    console.error('詳細:', error);
    // ▼▼▼【AWS Amplify対応】GSM失敗でも環境変数があれば続行 ▼▼▼
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.log('⚠️ GSM失敗しましたが、環境変数から直接読み込みます');
      console.log('✅ NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL.substring(0, 30) + '...');
      console.log('✅ NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 30) + '...');
      // .env.localにも書き込み（念のため）
      const envContent = `NEXT_PUBLIC_SUPABASE_URL=${process.env.NEXT_PUBLIC_SUPABASE_URL}\nNEXT_PUBLIC_SUPABASE_ANON_KEY=${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}\n`;
      fs.writeFileSync('.env.local', envContent);
      return; // エラー終了せずに続行
    }
    // ▲▲▲
    // 環境変数もない場合はエラー
    console.error('❌ GSM失敗かつ環境変数も設定されていません');
    process.exit(1);
  }
}

loadSecrets();

