import { randomUUID } from "crypto";

const DEFAULT_MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const DEFAULT_ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

const MIME_EXTENSION_MAP: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

type ImageValidationOptions = {
  maxSizeBytes?: number;
  allowedMimeTypes?: string[];
};

export type ValidatedImage = {
  buffer: Buffer;
  mimeType: string;
  extension: string;
  safeFileName: string;
};

const startsWithSignature = (buffer: Buffer, signature: number[], offset = 0) => {
  return signature.every((byte, index) => buffer[offset + index] === byte);
};

const detectMimeType = (buffer: Buffer): string | null => {
  if (buffer.length < 12) {
    return null;
  }

  if (
    startsWithSignature(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  ) {
    return "image/png";
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[buffer.length - 2] === 0xff && buffer[buffer.length - 1] === 0xd9) {
    return "image/jpeg";
  }

  if (startsWithSignature(buffer, [0x47, 0x49, 0x46, 0x38])) {
    return "image/gif";
  }

  if (
    startsWithSignature(buffer, [0x52, 0x49, 0x46, 0x46]) &&
    startsWithSignature(buffer, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return "image/webp";
  }

  return null;
};

const sanitizeFileBaseName = (fileName: string) => {
  const base = fileName.replace(/\.[^.]+$/, "");
  return base.replace(/[^\w\-]/g, "") || "upload";
};

export async function validateImageFile(
  file: File,
  options?: ImageValidationOptions
): Promise<ValidatedImage> {
  if (!file || file.size === 0) {
    throw new Error("画像ファイルが見つかりません。");
  }

  const maxSize = options?.maxSizeBytes ?? DEFAULT_MAX_SIZE_BYTES;
  if (file.size > maxSize) {
    const limitMb = Math.floor(maxSize / (1024 * 1024));
    throw new Error(`画像サイズは${limitMb}MB以下にしてください。`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const detectedMime = detectMimeType(buffer);
  const mimeType =
    detectedMime ||
    (file.type?.startsWith("image/") ? file.type : null);

  if (!mimeType) {
    throw new Error("画像の種類を判別できませんでした。");
  }

  const allowed = options?.allowedMimeTypes ?? DEFAULT_ALLOWED_MIME_TYPES;
  if (!allowed.includes(mimeType)) {
    throw new Error("サポートされていない画像形式です。PNG / JPEG / WebP / GIF のみ利用できます。");
  }

  const extension = MIME_EXTENSION_MAP[mimeType] || file.name.split(".").pop()?.toLowerCase() || "bin";
  const safeBaseName = sanitizeFileBaseName(file.name);
  const safeFileName = `${safeBaseName}-${randomUUID()}.${extension}`;

  return {
    buffer,
    mimeType,
    extension,
    safeFileName,
  };
}


