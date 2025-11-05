// GSMから環境変数をロードしてNEXT_PUBLIC_*として.env.localに書き込む
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const fs = require('fs');

async function loadSecrets() {
  try {
    const client = new SecretManagerServiceClient({ fallback: true });
    const projectId = process.env.GOOGLE_PROJECT_ID;

    if (!projectId) {
      throw new Error('GOOGLE_PROJECT_ID environment variable is not set');
    }

    console.log('🔐 Loading secrets from Google Secret Manager...');

    // 既存のSUPABASE_URLを読み込み
    const [urlSecret] = await client.accessSecretVersion({
      name: `projects/${projectId}/secrets/SUPABASE_URL/versions/latest`
    });
    const url = Buffer.from(urlSecret.payload.data).toString('utf8').trim();

    // 既存のSUPABASE_ANON_KEYを読み込み
    const [keySecret] = await client.accessSecretVersion({
      name: `projects/${projectId}/secrets/SUPABASE_ANON_KEY/versions/latest`
    });
    const key = Buffer.from(keySecret.payload.data).toString('utf8').trim();

    // NEXT_PUBLIC_*として.env.localに書き込み
    const envContent = `NEXT_PUBLIC_SUPABASE_URL=${url}\nNEXT_PUBLIC_SUPABASE_ANON_KEY=${key}\n`;
    fs.writeFileSync('.env.local', envContent);

    console.log('✅ GSMから環境変数をロードしました');
    console.log('✅ NEXT_PUBLIC_SUPABASE_URL:', url.substring(0, 30) + '...');
    console.log('✅ NEXT_PUBLIC_SUPABASE_ANON_KEY:', key.substring(0, 30) + '...');
  } catch (error) {
    console.error('❌ GSMロード失敗:', error.message);
    process.exit(1);
  }
}

loadSecrets();

