import { createHash } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  adminDb,
  HttpError,
  sanitizeError,
  verifyAuthenticatedRequest } from
'./_lib/firebaseAdmin';
import {
  assertVerificationToken,
  createUploadTarget,
  folderFromKey,
  keyFromPublicValue,
  normalizeObjectOwner,
  ownerFromKey,
  removeObject,
  verifyUploadedObject,
  type R2Folder } from
'./_lib/r2';

interface UploadBody {
  action?: unknown;
  folder?: unknown;
  ownerId?: unknown;
  fileName?: unknown;
  contentType?: unknown;
  size?: unknown;
  key?: unknown;
  url?: unknown;
  verificationToken?: unknown;
}

type UploadAction = 'sign' | 'verify' | 'delete';
type UploadStage = 'routing' | 'validation' | 'authentication' | 'signing' | 'verification' | 'deletion';

const FOLDERS = new Set<R2Folder>([
'kyc',
'payments',
'profiles',
'admin',
'chat',
'trade-screenshots']
);

export default async function uploadController(request: VercelRequest, response: VercelResponse) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Allow', 'POST');
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed. Use POST.', stage: 'routing' });
  }

  let stage: UploadStage = 'routing';
  let action: UploadAction | '' = '';

  try {
    const body = parseBody(request.body);
    const queryAction = Array.isArray(request.query.action) ?
    request.query.action[0] :
    request.query.action;
    action = String(body.action || queryAction || '') as UploadAction;
    if (action === 'sign') {
      stage = 'validation';
      const result = await signUpload(request, body, () => {stage = 'authentication';}, () => {stage = 'signing';});
      return response.status(200).json(result);
    }
    if (action === 'verify') {
      stage = 'verification';
      const result = await verifyUpload(body);
      return response.status(200).json(result);
    }
    if (action === 'delete') {
      stage = 'deletion';
      const result = await deleteUpload(request, body);
      return response.status(200).json(result);
    }
    throw new HttpError(400, 'Invalid upload action. Use sign, verify, or delete.');
  } catch (error) {
    const safe = sanitizeError(error);
    console.error('[api/upload] request failed', {
      action: action || 'missing',
      stage,
      status: safe.status,
      code: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : String(error)
    });
    return response.status(safe.status).json({ error: safe.message, stage });
  }
}

async function signUpload(
request: VercelRequest,
body: UploadBody,
authenticationStage: () => void,
signingStage: () => void)
{
  const folder = String(body.folder || '') as R2Folder;
  const ownerId = String(body.ownerId || '').trim();
  const fileName = String(body.fileName || '').trim();
  const contentType = String(body.contentType || '').toLowerCase();
  const size = Number(body.size);
  if (!FOLDERS.has(folder)) throw new HttpError(400, 'Invalid upload destination.');
  if (!ownerId || !fileName) throw new HttpError(400, 'Upload owner and filename are required.');

  authenticationStage();
  const authorization = request.headers.authorization;
  if (folder === 'chat' && !authorization) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(ownerId) || ownerId.length > 160) {
      throw new HttpError(400, 'A valid support email is required.');
    }
    await enforceGuestRateLimit(request, ownerId);
  } else {
    const allowRestricted = folder === 'chat' || folder === 'payments';
    const caller = await verifyAuthenticatedRequest(authorization, false, allowRestricted);
    const isAdmin = caller.role === 'admin' || caller.role === 'super_admin';
    if (folder === 'admin' && !isAdmin) throw new HttpError(403, 'Admin access required.');
    if (!isAdmin && folder === 'chat' && normalizeObjectOwner(ownerId) !== normalizeObjectOwner(caller.email)) {
      throw new HttpError(403, 'Support attachment owner does not match your account.');
    }
    if (!isAdmin && folder !== 'admin' && folder !== 'chat' && caller.uid !== ownerId) {
      throw new HttpError(403, 'You cannot upload files for another account.');
    }
    if (!isAdmin && folder === 'payments') await assertPaymentUploadAllowed(caller.uid);
  }

  signingStage();
  return createUploadTarget({ folder, ownerId, fileName, contentType, size });
}

async function verifyUpload(body: UploadBody) {
  const key = keyFromPublicValue(String(body.key || '').trim());
  const size = Number(body.size);
  const token = String(body.verificationToken || '').trim();
  if (!key || !Number.isFinite(size) || size <= 0 || !token) {
    throw new HttpError(400, 'Upload verification details are incomplete.');
  }
  assertVerificationToken(key, size, token);
  const object = await verifyUploadedObject(key, size);
  return { ok: true, ...object };
}

async function deleteUpload(request: VercelRequest, body: UploadBody) {
  const value = String(body.key || body.url || '').trim();
  if (!value) throw new HttpError(400, 'Storage key is required.');
  const key = keyFromPublicValue(value);
  const folder = folderFromKey(key);
  if (!folder) throw new HttpError(400, 'Invalid storage key.');

  const allowRestricted = folder === 'chat' || folder === 'payments';
  const caller = await verifyAuthenticatedRequest(request.headers.authorization, false, allowRestricted);
  const isAdmin = caller.role === 'admin' || caller.role === 'super_admin';
  const expectedOwner = folder === 'chat' ?
  normalizeObjectOwner(caller.email) :
  normalizeObjectOwner(caller.uid);
  if (!isAdmin && (folder === 'admin' || folder === 'migrated' || ownerFromKey(key) !== expectedOwner)) {
    throw new HttpError(403, 'You cannot delete this file.');
  }
  if (!isAdmin && folder === 'payments') await assertPaymentUploadAllowed(caller.uid);
  await removeObject(key);
  return { ok: true };
}

async function assertPaymentUploadAllowed(uid: string) {
  const profile = await adminDb.collection('users').doc(uid).get();
  if (profile.data()?.status === 'banned') {
    throw new HttpError(403, 'Banned accounts cannot modify payment proofs.');
  }
}

async function enforceGuestRateLimit(request: VercelRequest, ownerId: string) {
  const forwarded = String(request.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const fingerprint = createHash('sha256').
  update(`${forwarded || 'unknown'}:${ownerId.toLowerCase()}`).
  digest('hex');
  const reference = adminDb.collection('upload_rate_limits').doc(`guest-${fingerprint}`);
  const now = Date.now();
  await adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const current = snapshot.data() as {count?: number;resetAt?: number;} | undefined;
    const resetAt = Number(current?.resetAt || 0);
    const count = resetAt > now ? Number(current?.count || 0) : 0;
    if (count >= 10) throw new HttpError(429, 'Too many attachment uploads. Please try again later.');
    transaction.set(reference, {
      count: count + 1,
      resetAt: resetAt > now ? resetAt : now + 60 * 60_000,
      updatedAt: now
    }, { merge: false });
  });
}

function parseBody(value: unknown): UploadBody {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as UploadBody;
    } catch {
      throw new HttpError(400, 'Request body must be valid JSON.');
    }
  }
  return typeof value === 'object' ? value as UploadBody : {};
}