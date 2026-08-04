import { randomUUID } from "crypto";

import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;
const PRESIGNED_EXPIRATION_SECONDS = 300;

const allowedContentTypes = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
]);

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getAvatarLimits() {
  return {
    maxBytes: MAX_AVATAR_SIZE_BYTES,
    allowedContentTypes: [...allowedContentTypes],
  };
}

function extensionFromContentType(contentType: string) {
  switch (contentType) {
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/gif":
      return "gif";
    case "image/webp":
      return "webp";
    default:
      return "bin";
  }
}

function sanitizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function getR2Config() {
  const accountId = requiredEnv("R2_ACCOUNT_ID");
  const bucket = requiredEnv("R2_BUCKET");
  const accessKeyId = requiredEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = requiredEnv("R2_SECRET_ACCESS_KEY");

  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
  const publicBaseUrl = sanitizeBaseUrl(
    process.env.R2_PUBLIC_URL_BASE || `https://${bucket}.${accountId}.r2.cloudflarestorage.com`,
  );

  return {
    bucket,
    endpoint,
    publicBaseUrl,
    client: new S3Client({
      region: "auto",
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    }),
  };
}

export function isAllowedAvatarContentType(contentType: string) {
  return allowedContentTypes.has(contentType.toLowerCase());
}

export function getAvatarPublicUrl(key: string) {
  const { publicBaseUrl } = getR2Config();
  return `${publicBaseUrl}/${key}`;
}

export function makeAvatarObjectKey(userId: string, contentType: string) {
  const ext = extensionFromContentType(contentType.toLowerCase());
  return `users/${userId}/avatar/${Date.now()}-${randomUUID()}.${ext}`;
}

export async function createAvatarUploadUrl(params: {
  key: string;
  contentType: string;
  contentLength: number;
}) {
  const { client, bucket } = getR2Config();

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: params.key,
    ContentType: params.contentType,
    ContentLength: params.contentLength,
    CacheControl: "public, max-age=31536000, immutable",
  });

  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: PRESIGNED_EXPIRATION_SECONDS,
    signableHeaders: new Set(["content-type"]),
  });

  return {
    uploadUrl,
    expiresIn: PRESIGNED_EXPIRATION_SECONDS,
  };
}

export async function assertAvatarObject(params: {
  key: string;
  expectedContentType: string;
  maxBytes: number;
}) {
  const { client, bucket } = getR2Config();

  const object = await client.send(
    new HeadObjectCommand({
      Bucket: bucket,
      Key: params.key,
    }),
  );

  const objectSize = object.ContentLength ?? 0;
  const objectType = (object.ContentType ?? "").toLowerCase();

  if (objectSize <= 0 || objectSize > params.maxBytes) {
    throw new Error("Uploaded object is missing or exceeds maximum allowed size");
  }

  if (objectType !== params.expectedContentType.toLowerCase()) {
    throw new Error("Uploaded object content type does not match requested content type");
  }

  return {
    objectSize,
    objectType,
  };
}

export async function deleteAvatarObjectByUrl(url: string) {
  const { client, bucket, publicBaseUrl } = getR2Config();
  if (!url.startsWith(`${publicBaseUrl}/`)) {
    return;
  }

  const key = url.slice(publicBaseUrl.length + 1);
  if (!key) {
    return;
  }

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );
}
