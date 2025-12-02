type UploadOptions = {
  filename?: string;
  contentType?: string;
};

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  endpoint: string;
  publicBaseUrl: string;
};

type S3Module = typeof import('@aws-sdk/client-s3');

let cachedClient: InstanceType<S3Module['S3Client']> | null = null;
let cachedConfig: R2Config | null = null;
let cachedS3Module: S3Module | null = null;

function getR2Config(): R2Config {
  if (cachedConfig) return cachedConfig;

  const accountId =
    process.env.CLOUDFLARE_R2_ACCOUNT_ID ||
    process.env.CLOUDFLARE_ACCOUNT_ID ||
    '';
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '';
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '';
  const bucketName =
    process.env.CLOUDFLARE_R2_BUCKET_NAME ||
    process.env.CLOUDFLARE_R2_BUCKET ||
    '';
  const endpoint =
    process.env.CLOUDFLARE_R2_ENDPOINT ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '');
  const publicBaseUrlRaw =
    process.env.CLOUDFLARE_R2_PUBLIC_URL ||
    (accountId && bucketName
      ? `https://${bucketName}.${accountId}.r2.cloudflarestorage.com`
      : '');
  const publicBaseUrl = publicBaseUrlRaw.replace(/\/+$/, '');

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !endpoint || !publicBaseUrl) {
    throw new Error(
      [
        '❌ Cloudflare R2環境変数が不足しています。',
        '必要な環境変数:',
        '  - CLOUDFLARE_R2_ACCESS_KEY_ID',
        '  - CLOUDFLARE_R2_SECRET_ACCESS_KEY',
        '  - CLOUDFLARE_R2_BUCKET_NAME',
        '  - CLOUDFLARE_ACCOUNT_ID (または CLOUDFLARE_R2_ACCOUNT_ID)',
        '  - CLOUDFLARE_R2_PUBLIC_URL (パブリックアクセスURL)',
      ].join('\n')
    );
  }

  cachedConfig = {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    endpoint,
    publicBaseUrl,
  };

  return cachedConfig;
}

async function loadS3Module(): Promise<S3Module> {
  if (cachedS3Module) return cachedS3Module;
  if (typeof window !== 'undefined') {
    throw new Error('R2クライアントはブラウザでは使用できません。');
  }
  cachedS3Module = await import('@aws-sdk/client-s3');
  return cachedS3Module;
}

async function getR2Client() {
  if (cachedClient) return cachedClient;
  const config = getR2Config();
  const { S3Client } = await loadS3Module();
  cachedClient = new S3Client({
    region: 'auto',
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: true,
  });
  return cachedClient;
}

function generateUuid(): string {
  const cryptoLike = (globalThis as typeof globalThis & { crypto?: { randomUUID?: () => string } }).crypto;
  if (cryptoLike?.randomUUID) {
    return cryptoLike.randomUUID();
  }
  return `r2-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^\w.\-]/g, '_');
}

function ensureExtension(filename?: string, fallback = 'png'): string {
  if (!filename) return `${generateUuid()}.${fallback}`;
  if (filename.includes('.')) return filename;
  return `${filename}.${fallback}`;
}

function buildPublicUrl(key: string): string {
  const { publicBaseUrl } = getR2Config();
  const trimmedBase = publicBaseUrl.replace(/\/+$/, '');
  const normalizedKey = key.replace(/^\/+/, '');
  return `${trimmedBase}/${encodeURI(normalizedKey).replace(/%2F/g, '/')}`;
}

async function uploadBufferToR2(buffer: Buffer, options?: UploadOptions): Promise<string> {
  const { bucketName } = getR2Config();
  const client = await getR2Client();
  const { PutObjectCommand } = await loadS3Module();

  const originalName = options?.filename || `image-${Date.now()}-${generateUuid()}.png`;
  const safeFilename = sanitizeFilename(ensureExtension(originalName));
  const key = `uploads/${safeFilename}`;

  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: options?.contentType || 'application/octet-stream',
    })
  );

  return buildPublicUrl(key);
}

type Uploadable = Buffer | File | Blob;

function isFile(value: unknown): value is File {
  return typeof File !== 'undefined' && value instanceof File;
}

function isBlob(value: unknown): value is Blob {
  return typeof Blob !== 'undefined' && value instanceof Blob;
}

async function blobToBuffer(blob: Blob): Promise<Buffer> {
  const arrayBuffer = await blob.arrayBuffer();
  if (typeof Buffer === 'undefined') {
    throw new Error('Buffer is not available in this environment.');
  }
  return Buffer.from(arrayBuffer);
}

export async function uploadImageToCloudflare(
  file: Uploadable,
  metadata?: UploadOptions
): Promise<string> {
  const isNodeBuffer = typeof Buffer !== 'undefined' && Buffer.isBuffer(file);
  if (isNodeBuffer) {
    return uploadBufferToR2(file as Buffer, metadata);
  }

  if (isFile(file) || isBlob(file)) {
    const blob = file as Blob;
    const buffer = await blobToBuffer(blob);
    const fallbackName =
      (isFile(file) && (file as File).name) || `image-${Date.now()}-${generateUuid()}.png`;
    return uploadBufferToR2(buffer, {
      filename: metadata?.filename ?? fallbackName,
      contentType: metadata?.contentType ?? (blob.type || 'application/octet-stream'),
    });
  }

  throw new Error('Unsupported file type. Expected File, Blob, or Buffer.');
}

export async function uploadImageToStorage(file: File): Promise<string> {
  if (typeof window !== 'undefined') {
    const { fetchWithCsrf } = await import('@/lib/csrf-client');
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetchWithCsrf('/api/upload-image', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (typeof errorData.error === 'string') {
          errorMessage = errorData.error;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        } else {
          errorMessage = JSON.stringify(errorData);
        }
      } catch (error) {
        console.error('[Upload Image API] エラーレスポンスの解析に失敗:', error);
      }
      throw new Error(`画像アップロード失敗: ${errorMessage}`);
    }

    const data = await response.json();
    if (!data.imageUrl) {
      throw new Error('画像URLが取得できませんでした。API応答にimageUrlがありません。');
    }
    return data.imageUrl;
  }

  return uploadImageToCloudflare(file);
}

export async function uploadImageBufferToCloudflare(
  buffer: Buffer,
  options?: UploadOptions
): Promise<string> {
  return uploadBufferToR2(buffer, options);
}

function extractR2KeyFromUrl(imageUrl: string): string | null {
  const { publicBaseUrl } = getR2Config();
  const normalizedBase = publicBaseUrl.replace(/\/+$/, '');
  if (!imageUrl.startsWith(normalizedBase)) {
    return null;
  }
  const key = imageUrl.substring(normalizedBase.length).replace(/^\/+/, '');
  return decodeURI(key);
}

export async function deleteImageFromCloudflare(imageUrl: string): Promise<boolean> {
  const { bucketName } = getR2Config();
  const client = await getR2Client();
  const { DeleteObjectCommand } = await loadS3Module();
  const key = extractR2KeyFromUrl(imageUrl) || imageUrl.replace(/^\/+/, '');

  if (!key) {
    console.warn('[R2 Delete] 画像キーを特定できませんでした:', imageUrl);
    return false;
  }

  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key,
      })
    );
    console.log(`[R2 Delete] 成功: ${key}`);
    return true;
  } catch (error) {
    console.error('[R2 Delete] 例外発生:', error);
    return false;
  }
}

export function isCloudflareImageUrl(url: string): boolean {
  const { publicBaseUrl } = getR2Config();
  const normalizedBase = publicBaseUrl.replace(/\/+$/, '');
  return url.startsWith(normalizedBase);
}

