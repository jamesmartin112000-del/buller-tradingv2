import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  S3Client,
  DeleteObjectCommand,
  HeadObjectCommand,
  PutBucketCorsCommand,
  PutObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// ---------------------------------------------------------------------------
// Cloudflare R2 upload endpoint — matches the frontend contract in
// src/lib/r2Upload.ts (actions: sign -> presigned PUT -> verify, plus delete).
// Self-contained: no Firebase / Firestore required.
// ---------------------------------------------------------------------------

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
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]);
const MAX_BYTES = 10 * 1024 * 1024;
const FOLDERS = new Set([
  'kyc',
  'payments',
  'profiles',
  'admin',
  'chat',
  'trade-screenshots'
]);

function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw httpError(503, `Storage is not configured: ${name} is missing.`);
  return value;
}

function r2Config() {
  const accountId = required('R2_ACCOUNT_ID');
  const endpoint = required('R2_ENDPOINT').replace(/\/+$/, '');
  const publicUrl = required('R2_PUBLIC_URL').replace(/\/+$/, '');
  let endpointUrl;
  let publicBaseUrl;
  try {
    endpointUrl = new URL(endpoint);
    publicBaseUrl = new URL(publicUrl);
  } catch {
    throw httpError(503, 'R2_ENDPOINT and R2_PUBLIC_URL must be valid HTTPS URLs.');
  }
  if (endpointUrl.protocol !== 'https:' || publicBaseUrl.protocol !== 'https:') {
    throw httpError(503, 'R2 endpoints must use HTTPS.');
  }
  if (!endpointUrl.hostname.startsWith(`${accountId}.`)) {
    throw httpError(503, 'R2_ENDPOINT does not match R2_ACCOUNT_ID.');
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

function r2Client() {
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

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function sanitizeSegment(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96) || 'unknown';
}

function sanitizeFileName(value) {
  const cleaned = String(value || '')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return (cleaned || 'upload').slice(-140);
}

function createVerificationToken(key, size, secret) {
  return createHmac('sha256', secret).update(`${key}:${size}`).digest('hex');
}

function assertVerificationToken(key, size, token, secret) {
  const expected = createVerificationToken(key, size, secret);
  const received = Buffer.from(String(token || ''), 'hex');
  const wanted = Buffer.from(expected, 'hex');
  if (received.length !== wanted.length || !timingSafeEqual(received, wanted)) {
    throw httpError(403, 'Upload verification token is invalid.');
  }
}

function createObjectKey(folder, ownerId, fileName) {
  const owner = sanitizeSegment(ownerId || 'guest');
  const safeName = sanitizeFileName(fileName);
  return `uploads/${folder}/${owner}/${Date.now()}-${randomUUID()}-${safeName}`;
}

function validateUpload(contentType, size, folder) {
  const allowed = folder === 'chat' ? CHAT_TYPES : IMAGE_TYPES;
  if (!allowed.has(contentType)) throw httpError(400, 'This file type is not allowed.');
  if (!Number.isFinite(size) || size <= 0 || size > MAX_BYTES) {
    throw httpError(400, 'File must be between 1 byte and 10 MB.');
  }
}

function keyFromPublicValue(value) {
  const config = r2Config();
  if (String(value).startsWith('uploads/')) return String(value);
  const prefix = `${config.publicUrl}/`;
  const raw = String(value || '');
  if (!raw.startsWith(prefix)) throw httpError(400, 'This file is not stored in the configured R2 bucket.');
  const key = decodeURIComponent(raw.slice(prefix.length));
  if (!key.startsWith('uploads/')) throw httpError(400, 'Invalid storage key.');
  return key;
}

function folderFromKey(key) {
  const folder = key.split('/')[1];
  return FOLDERS.has(folder) ? folder : null;
}

function ownerFromKey(key) {
  const parts = key.split('/');
  return parts.length >= 4 ? parts[2] : '';
}

// In-memory guest rate limit (per instance). Restrictively keyed by IP + email.
const guestBuckets = new Map();
function enforceGuestRateLimit(request, ownerId) {
  const forwarded = String(request.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const fingerprint = `${forwarded || 'unknown'}:${String(ownerId).toLowerCase()}`;
  const windowStart = Math.floor(Date.now() / 3600_000);
  const key = `${windowStart}:${fingerprint}`;
  const count = guestBuckets.get(key) || 0;
  if (count >= 10) throw httpError(429, 'Too many attachment uploads. Please try again later.');
  guestBuckets.set(key, count + 1);
}

async function createUploadTarget(folder, ownerId, fileName, contentType, size) {
  validateUpload(contentType, size, folder);
  const config = r2Config();
  const key = createObjectKey(folder, ownerId, fileName);
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    ContentType: contentType,
    ContentLength: size,
    CacheControl: 'public, max-age=31536000, immutable'
  });
  const uploadUrl = await getSignedUrl(r2Client(), command, { expiresIn: 300 });
  return {
    uploadUrl,
    key,
    publicUrl: `${config.publicUrl}/${key}`,
    verificationToken: createVerificationToken(key, size, config.secretAccessKey)
  };
}

async function verifyUploadedObject(key, size) {
  const config = r2Config();
  const object = await r2Client().send(
    new HeadObjectCommand({ Bucket: config.bucket, Key: key })
  );
  const actualSize = Number(object.ContentLength || 0);
  if (actualSize !== size || actualSize > MAX_BYTES) {
    await r2Client()
      .send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }))
      .catch(() => undefined);
    throw httpError(400, 'Uploaded file size could not be verified.');
  }
  return { size: actualSize, contentType: object.ContentType || '' };
}

async function removeObject(key) {
  const config = r2Config();
  await r2Client().send(
    new DeleteObjectCommand({ Bucket: config.bucket, Key: key })
  );
}

async function configureCors(origins) {
  const config = r2Config();
  await r2Client().send(
    new PutBucketCorsCommand({
      Bucket: config.bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedHeaders: ['Content-Type', 'Cache-Control'],
            AllowedMethods: ['GET', 'HEAD', 'PUT'],
            AllowedOrigins: origins,
            ExposeHeaders: ['etag'],
            MaxAgeSeconds: 3600
          }
        ]
      }
    })
  );
}

export default async function handler(request, response) {
  // CORS preflight / headers
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Filename');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Allow', 'POST');

  if (request.method === 'OPTIONS') return response.status(204).end();
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed. Use POST.', stage: 'routing' });
  }

  let stage = 'routing';
  let action = '';

  try {
    const body = typeof request.body === 'object' && request.body !== null
      ? request.body
      : {};
    action = String(body.action || '');
    const queryAction = request.query && request.query.action;
    if (!action && queryAction) {
      action = String(Array.isArray(queryAction) ? queryAction[0] : queryAction);
    }

    if (action === 'sign') {
      stage = 'validation';
      const folder = String(body.folder || '');
      const ownerId = String(body.ownerId || '').trim();
      const fileName = String(body.fileName || '').trim();
      const contentType = String(body.contentType || '').toLowerCase();
      const size = Number(body.size);

      if (!FOLDERS.has(folder)) throw httpError(400, 'Invalid upload destination.');
      if (!ownerId || !fileName) throw httpError(400, 'Upload owner and filename are required.');

      stage = 'authentication';
      const authorization = request.headers.authorization;
      if (folder === 'chat' && !authorization) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(ownerId) || ownerId.length > 160) {
          throw httpError(400, 'A valid support email is required.');
        }
        enforceGuestRateLimit(request, ownerId);
      }

      stage = 'signing';
      const result = await createUploadTarget(folder, ownerId, fileName, contentType, size);
      return response.status(200).json(result);
    }

    if (action === 'verify') {
      stage = 'verification';
      const key = keyFromPublicValue(String(body.key || '').trim());
      const size = Number(body.size);
      const token = String(body.verificationToken || '').trim();
      if (!key || !Number.isFinite(size) || size <= 0 || !token) {
        throw httpError(400, 'Upload verification details are incomplete.');
      }
      assertVerificationToken(key, size, token, r2Config().secretAccessKey);
      const object = await verifyUploadedObject(key, size);
      return response.status(200).json({ ok: true, ...object });
    }

    if (action === 'delete') {
      stage = 'deletion';
      const value = String(body.key || body.url || '').trim();
      if (!value) throw httpError(400, 'Storage key is required.');
      const key = keyFromPublicValue(value);
      const folder = folderFromKey(key);
      if (!folder) throw httpError(400, 'Invalid storage key.');
      await removeObject(key);
      return response.status(200).json({ ok: true });
    }

    if (action === 'cors') {
      stage = 'signing';
      const origins = Array.isArray(body.origins) && body.origins.length
        ? body.origins.map(String)
        : ['*'];
      const result = await configureCors(origins);
      return response.status(200).json({ ok: true, result });
    }

    throw httpError(400, 'Invalid upload action. Use sign, verify, or delete.');
  } catch (error) {
    const status = Number(error && error.status) || 500;
    console.error('[api/upload] request failed', {
      action: action || 'missing',
      stage,
      status,
      code: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : String(error)
    });
    return response.status(status).json({ error: error instanceof Error ? error.message : 'Upload failed.', stage });
  }
}