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
  // ▼▼▼【重要】環境変数が既に設定されている場合はSecret Managerをスキップ ▼▼▼
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.log('✅ NEXT_PUBLIC_*環境変数が既に設定されています。Secret Managerをスキップします。');
    return;
  }
  // ▲▲▲

  try {
    // 1. GCP認証を設定
    await setupGcpCredentials();

    // ▼▼▼【デバッグ】サービスアカウント情報を確認 ▼▼▼
    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(process.cwd(), 'gcp', 'sa.json');
    if (fs.existsSync(credPath)) {
      const saJson = JSON.parse(fs.readFileSync(credPath, 'utf8'));
      console.log('📋 サービスアカウント情報:');
      console.log(`   - project_id: ${saJson.project_id || 'N/A'}`);
      console.log(`   - client_email: ${saJson.client_email || 'N/A'}`);
      console.log(`   - type: ${saJson.type || 'N/A'}`);
      
      // ▼▼▼【重要】서비스 계정 이메일 확인 ▼▼▼
      const expectedServiceAccount = 'netlify-builder@namoai-chat.iam.gserviceaccount.com';
      if (saJson.client_email !== expectedServiceAccount) {
        console.error('❌ ⚠️ ⚠️ ⚠️ 서비스 계정 불일치 ⚠️ ⚠️ ⚠️');
        console.error(`   현재 사용 중: ${saJson.client_email}`);
        console.error(`   예상 계정: ${expectedServiceAccount}`);
        console.error('❌ Netlify 환경 변수 GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64에');
        console.error(`   ${expectedServiceAccount} 서비스 계정의 JSON을 설정해야 합니다.`);
        console.error('❌ GCP Console에서 netlify-builder 서비스 계정을 찾아 키를 생성하고');
        console.error('   Netlify 환경 변수에 설정하세요.');
      } else {
        console.log(`✅ 올바른 서비스 계정 사용 중: ${saJson.client_email}`);
      }
      // ▲▲▲
    }
    // ▲▲▲

    const client = new SecretManagerServiceClient({ fallback: true });
    
    // ▼▼▼【重要】プロジェクトID解決: 環境変数 → サービスアカウントJSON ▼▼▼
    let projectId = process.env.GOOGLE_PROJECT_ID || process.env.GCP_PROJECT_ID;
    
    if (!projectId && fs.existsSync(credPath)) {
      try {
        const saJson = JSON.parse(fs.readFileSync(credPath, 'utf8'));
        if (saJson.project_id) {
          projectId = saJson.project_id;
          console.log(`📦 プロジェクトIDをサービスアカウントJSONから取得: ${projectId}`);
        }
      } catch (e) {
        console.warn('⚠️ サービスアカウントJSONの読み込みに失敗:', e.message);
      }
    }
    // ▲▲▲

    if (!projectId) {
      console.error('❌ GOOGLE_PROJECT_ID環境変数が設定されていません。');
      console.error('❌ サービスアカウントJSONにもproject_idがありません。');
      throw new Error('GOOGLE_PROJECT_ID is required');
    }

    console.log('🔐 Loading secrets from Google Secret Manager...');
    console.log(`📦 Project ID: ${projectId}`);
    console.log(`📦 Service Account: ${fs.existsSync(credPath) ? JSON.parse(fs.readFileSync(credPath, 'utf8')).client_email : 'N/A'}`);

    let url = null;
    let key = null;

    // 2. SUPABASE_URLを読み込み
    try {
      const secretName = `projects/${projectId}/secrets/SUPABASE_URL/versions/latest`;
      console.log(`🔍 Attempting to access: ${secretName}`);
      const [urlSecret] = await client.accessSecretVersion({
        name: secretName
      });
      url = Buffer.from(urlSecret.payload.data).toString('utf8').trim();
      console.log('✅ SUPABASE_URL loaded from Secret Manager');
    } catch (error) {
      console.error('❌ SUPABASE_URLの読み込みに失敗しました:');
      console.error(`   - Error code: ${error.code || 'N/A'}`);
      console.error(`   - Error message: ${error.message || 'N/A'}`);
      console.error(`   - Project ID used: ${projectId}`);
      console.error(`   - Service Account: ${fs.existsSync(credPath) ? JSON.parse(fs.readFileSync(credPath, 'utf8')).client_email : 'N/A'}`);
      
      // 권한 오류인 경우 자세한 정보 출력
      if (error.message && error.message.includes('Permission')) {
        console.error('❌ 권한 오류: 서비스 계정에 Secret Manager 접근 권한이 없습니다.');
        console.error('❌ 해결 방법:');
        console.error('   1. GCP Console에서 서비스 계정에 "Secret Manager Secret Accessor" 역할 부여');
        console.error('   2. 또는 서비스 계정이 올바른 프로젝트에 속해 있는지 확인');
        console.error(`   3. 현재 프로젝트 ID: ${projectId}`);
        throw error; // 권한 오류는 빌드를 중단해야 함
      }
      
      if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
        console.log('✅ 環境変数NEXT_PUBLIC_SUPABASE_URLを使用します');
        url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      } else {
        throw error; // 환경 변수도 없으면 에러
      }
    }

    // 3. SUPABASE_ANON_KEYを読み込み
    try {
      const secretName = `projects/${projectId}/secrets/SUPABASE_ANON_KEY/versions/latest`;
      console.log(`🔍 Attempting to access: ${secretName}`);
      const [keySecret] = await client.accessSecretVersion({
        name: secretName
      });
      key = Buffer.from(keySecret.payload.data).toString('utf8').trim();
      console.log('✅ SUPABASE_ANON_KEY loaded from Secret Manager');
    } catch (error) {
      console.error('❌ SUPABASE_ANON_KEYの読み込みに失敗しました:');
      console.error(`   - Error code: ${error.code || 'N/A'}`);
      console.error(`   - Error message: ${error.message || 'N/A'}`);
      console.error(`   - Project ID used: ${projectId}`);
      
      // 권한 오류인 경우 자세한 정보 출력
      if (error.message && error.message.includes('Permission')) {
        console.error('❌ 권한 오류: 서비스 계정에 Secret Manager 접근 권한이 없습니다.');
        console.error('❌ 해결 방법:');
        console.error('   1. GCP Console에서 서비스 계정에 "Secret Manager Secret Accessor" 역할 부여');
        console.error('   2. 또는 서비스 계정이 올바른 프로젝트에 속해 있는지 확인');
        console.error(`   3. 현재 프로젝트 ID: ${projectId}`);
        throw error; // 권한 오류는 빌드를 중단해야 함
      }
      
      if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        console.log('✅ 環境変数NEXT_PUBLIC_SUPABASE_ANON_KEYを使用します');
        key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      } else {
        throw error; // 환경 변수도 없으면 에러
      }
    }

    // 4. 両方の値が取得できた場合のみ.env.localに書き込み
    if (url && key) {
      const envContent = `NEXT_PUBLIC_SUPABASE_URL=${url}\nNEXT_PUBLIC_SUPABASE_ANON_KEY=${key}\n`;
      fs.writeFileSync('.env.local', envContent);
      console.log('✅ GSMから環境変数をロードしました');
      console.log('✅ NEXT_PUBLIC_SUPABASE_URL:', url.substring(0, 30) + '...');
      console.log('✅ NEXT_PUBLIC_SUPABASE_ANON_KEY:', key.substring(0, 30) + '...');
    } else {
      console.error('❌ Secret Managerから必要なシークレットを取得できませんでした。');
      console.error('❌ 環境変数NEXT_PUBLIC_SUPABASE_URLとNEXT_PUBLIC_SUPABASE_ANON_KEYを直接設定してください。');
      throw new Error('Required secrets not available from Secret Manager or environment variables');
    }
  } catch (error) {
    console.error('❌ GSMロード中にエラーが発生しました:', error.message);
    console.error('❌ 詳細:', error);
    
    // 권한 오류는 빌드를 중단해야 함
    if (error.message && error.message.includes('Permission')) {
      console.error('❌ 권한 오류로 인해 빌드를 중단합니다.');
      process.exit(1);
    }
    
    // 다른 오류도 빌드를 중단
    console.error('❌ 빌드를 중단합니다.');
    process.exit(1);
  }
}

loadSecrets();

