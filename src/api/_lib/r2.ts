import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutBucketCorsCommand,
  PutObjectCommand,
  S3Client } from
'@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { HttpError } from './firebaseAdmin';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const CHAT_TYPES = new Set([
...IMAGE_TYPES,
'video/mp4',
'video/webm',
'application/pdf',
'text/plain',
'application/zip',
'application/msword',
'application/vnd.ms-excel',
'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
);
const MAX_BYTES = 10 * 1024 * 1024;

export type R2Folder =
'kyc' |
'payments' |
'profiles' |
'admin' |
'chat' |
'trade-screenshots' |
'migrated';

function required(name: string): string {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new HttpError(503, `Storage is not configured: ${name} is missing.`);
  return value;
}

export function r2Config() {
  const accountId = required('R2_ACCOUNT_ID');
  const endpoint = required('R2_ENDPOINT').replace(/\/+$/, '');
  const publicUrl = required('R2_PUBLIC_URL').replace(/\/+$/, '');
  let endpointUrl: URL;
  let publicBaseUrl: URL;
  try {
    endpointUrl = new URL(endpoint);
    publicBaseUrl = new URL(publicUrl);
  } catch {
    throw new HttpError(503, 'R2_ENDPOINT and R2_PUBLIC_URL must be valid HTTPS URLs.');
  }
  if (endpointUrl.protocol !== 'https:' || publicBaseUrl.protocol !== 'https:') {
    throw new HttpError(503, 'R2 endpoints must use HTTPS.');
  }
  if (!endpointUrl.hostname.startsWith(`${accountId}.`)) {
    throw new HttpError(503, 'R2_ENDPOINT does not match R2_ACCOUNT_ID.');
  }
  return {
    accountId,
    accessKeyId: required('R2_ACCESS_KEY_ID'),
    secretAccessKey: required('R2_SECRET_ACCESS_KEY'),
    endpoint,
    bucket: required('R2_BUCKET'),
    publicUrl
  };
}

export function r2Client(): S3Client {
  const config = r2Config();
  return new S3Client({
    region: 'auto',
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    }
  });
}

export function validateUpload(contentType: string, size: number, folder: R2Folder) {
  const allowed = folder === 'chat' ? CHAT_TYPES : IMAGE_TYPES;
  if (!allowed.has(contentType)) throw new HttpError(400, 'This file type is not allowed.');
  if (!Number.isFinite(size) || size <= 0 || size > MAX_BYTES) {
    throw new HttpError(400, 'File must be between 1 byte and 10 MB.');
  }
}

export function createObjectKey(folder: R2Folder, ownerId: string, fileName: string): string {
  const owner = sanitizeSegment(ownerId || 'guest');
  const safeName = sanitizeFileName(fileName);
  return `uploads/${folder}/${owner}/${Date.now()}-${randomUUID()}-${safeName}`;
}

export async function createUploadTarget(input: {
  folder: R2Folder;
  ownerId: string;
  fileName: string;
  contentType: string;
  size: number;
}) {
  validateUpload(input.contentType, input.size, input.folder);
  const config = r2Config();
  const key = createObjectKey(input.folder, input.ownerId, input.fileName);
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    ContentType: input.contentType,
    ContentLength: input.size,
    CacheControl: 'public, max-age=31536000, immutable'
  });
  const uploadUrl = await getSignedUrl(r2Client(), command, { expiresIn: 300 });
  return {
    uploadUrl,
    key,
    publicUrl: `${config.publicUrl}/${key}`,
    verificationToken: createVerificationToken(key, input.size)
  };
}

export async function verifyUploadedObject(key: string, expectedSize: number) {
  const config = r2Config();
  const object = await r2Client().send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
  const actualSize = Number(object.ContentLength || 0);
  if (actualSize !== expectedSize || actualSize > MAX_BYTES) {
    await removeObject(key).catch(() => undefined);
    throw new HttpError(400, 'Uploaded file size could not be verified.');
  }
  return { size: actualSize, contentType: object.ContentType || '' };
}

export function assertVerificationToken(key: string, size: number, token: string) {
  const expected = createVerificationToken(key, size);
  const receivedBuffer = Buffer.from(token, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  if (receivedBuffer.length !== expectedBuffer.length || !timingSafeEqual(receivedBuffer, expectedBuffer)) {
    throw new HttpError(403, 'Upload verification token is invalid.');
  }
}

export async function putObject(input: {
  key: string;
  body: Uint8Array;
  contentType: string;
}) {
  const config = r2Config();
  await r2Client().send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: input.key,
    Body: input.body,
    ContentType: input.contentType,
    CacheControl: 'public, max-age=31536000, immutable'
  }));
  return `${config.publicUrl}/${input.key}`;
}

export async function removeObject(key: string) {
  const config = r2Config();
  await r2Client().send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
}

export async function configureR2Cors(origins: string[]) {
  const config = r2Config();
  await r2Client().send(new PutBucketCorsCommand({
    Bucket: config.bucket,
    CORSConfiguration: {
      CORSRules: [{
        AllowedHeaders: ['Content-Type', 'Cache-Control'],
        AllowedMethods: ['GET', 'HEAD', 'PUT'],
        AllowedOrigins: origins,
        ExposeHeaders: ['etag'],
        MaxAgeSeconds: 3600
      }]
    }
  }));
}

export function keyFromPublicValue(value: string): string {
  const config = r2Config();
  if (value.startsWith('uploads/')) return value;
  const prefix = `${config.publicUrl}/`;
  if (!value.startsWith(prefix)) throw new HttpError(400, 'This file is not stored in the configured R2 bucket.');
  const key = decodeURIComponent(value.slice(prefix.length));
  if (!key.startsWith('uploads/')) throw new HttpError(400, 'Invalid storage key.');
  return key;
}

export function ownerFromKey(key: string): string {
  const parts = key.split('/');
  return parts.length >= 4 ? parts[2] : '';
}

export function normalizeObjectOwner(value: string): string {
  return sanitizeSegment(value);
}

export function folderFromKey(key: string): R2Folder | null {
  const folder = key.split('/')[1] as R2Folder;
  return ['kyc', 'payments', 'profiles', 'admin', 'chat', 'trade-screenshots', 'migrated'].includes(folder) ?
  folder :
  null;
}

function sanitizeSegment(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 96) || 'unknown';
}

function sanitizeFileName(value: string): string {
  const cleaned = value.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return (cleaned || 'upload').slice(-140);
}

function createVerificationToken(key: string, size: number): string {
  return createHmac('sha256', r2Config().secretAccessKey).
  update(`${key}:${size}`).
  digest('hex');
}