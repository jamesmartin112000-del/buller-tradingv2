import type { VercelRequest, VercelResponse } from '@vercel/node';
import { adminDb, HttpError, sanitizeError, verifyAuthenticatedRequest } from '../_lib/firebaseAdmin';
import { createObjectKey, putObject, r2Config } from '../_lib/r2';

const FIELD_PATHS: Record<string, string[]> = {
  users: [
  'avatarUrl',
  'kyc.selfieUrl',
  'kyc.idFrontUrl',
  'kyc.idBackUrl',
  'kyc.passportUrl',
  'kyc.selfieDataUrl',
  'kyc.idFrontDataUrl',
  'kyc.idBackDataUrl',
  'kyc.passportDataUrl'],

  payment_proofs: ['proofUrl'],
  chat_messages: ['attachmentUrl'],
  trades: ['screenshotUrl'],
  content: ['value']
};

interface MigrationBody {
  collection?: unknown;
  afterId?: unknown;
  batchSize?: unknown;
  dryRun?: unknown;
}

export default async function migrateImages(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed.' });
  }
  try {
    await verifyAuthenticatedRequest(request.headers.authorization, true);
    const body = (request.body || {}) as MigrationBody;
    const collection = String(body.collection || '');
    if (!FIELD_PATHS[collection]) throw new HttpError(400, 'Unsupported migration collection.');
    const sourceHosts = String(process.env.LEGACY_IMAGE_HOSTS || '').
    split(',').
    map((host) => host.trim().toLowerCase()).
    filter(Boolean);
    if (!sourceHosts.length) throw new HttpError(503, 'LEGACY_IMAGE_HOSTS is not configured.');

    const batchSize = Math.max(1, Math.min(100, Number(body.batchSize) || 25));
    let query = adminDb.collection(collection).orderBy('__name__').limit(batchSize);
    const afterId = String(body.afterId || '').trim();
    if (afterId) query = query.startAfter(afterId);
    const snapshot = await query.get();
    const dryRun = body.dryRun === true;
    const failures: Array<{id: string;field: string;error: string;}> = [];
    let migrated = 0;

    for (const document of snapshot.docs) {
      const original = document.data() as Record<string, unknown>;
      const patch: Record<string, unknown> = {};
      for (const fieldPath of FIELD_PATHS[collection]) {
        const value = nestedString(original, fieldPath);
        if (!value || !isMigratable(value, sourceHosts)) continue;
        try {
          const converted = await migrateValue(value, collection, document.id, fieldPath, dryRun);
          patch[fieldPath] = converted.url;
          if (fieldPath === 'screenshotUrl') patch.screenshotPath = converted.key;
          migrated += 1;
        } catch (error) {
          failures.push({
            id: document.id,
            field: fieldPath,
            error: error instanceof Error ? error.message : 'Migration failed.'
          });
        }
      }
      if (!dryRun && Object.keys(patch).length) {
        patch.imageMigrationUpdatedAt = Date.now();
        await document.ref.update(patch);
      }
    }

    const lastId = snapshot.docs[snapshot.docs.length - 1]?.id || null;
    return response.status(200).json({
      ok: failures.length === 0,
      collection,
      scanned: snapshot.size,
      migrated,
      dryRun,
      failures,
      nextAfterId: snapshot.size === batchSize ? lastId : null,
      done: snapshot.size < batchSize
    });
  } catch (error) {
    const safe = sanitizeError(error);
    return response.status(safe.status).json({ error: safe.message });
  }
}

async function migrateValue(
value: string,
collection: string,
documentId: string,
fieldPath: string,
dryRun: boolean)
: Promise<{url: string;key: string;}> {
  const source = await readSource(value);
  if (!source.contentType.startsWith('image/')) throw new Error('Source is not an image.');
  if (source.bytes.byteLength > 10 * 1024 * 1024) throw new Error('Source exceeds 10 MB.');
  const fileName = source.fileName || `${fieldPath.replace(/\./g, '-')}.${extensionFor(source.contentType)}`;
  const key = createObjectKey('migrated', `${collection}-${documentId}`, fileName);
  const url = dryRun ?
  `${r2Config().publicUrl}/${key}` :
  await putObject({ key, body: source.bytes, contentType: source.contentType });
  return { url, key };
}

async function readSource(value: string) {
  if (value.startsWith('data:image/')) {
    const match = value.match(/^data:([^;,]+);base64,(.+)$/);
    if (!match) throw new Error('Invalid image data URL.');
    return {
      bytes: Uint8Array.from(Buffer.from(match[2], 'base64')),
      contentType: match[1],
      fileName: ''
    };
  }
  const sourceUrl = new URL(value);
  const upstream = await fetch(sourceUrl, { signal: AbortSignal.timeout(20_000) });
  if (!upstream.ok) throw new Error(`Source returned HTTP ${upstream.status}.`);
  const contentType = String(upstream.headers.get('content-type') || '').split(';')[0].toLowerCase();
  return {
    bytes: new Uint8Array(await upstream.arrayBuffer()),
    contentType,
    fileName: decodeURIComponent(sourceUrl.pathname.split('/').filter(Boolean).at(-1) || '')
  };
}

function nestedString(record: Record<string, unknown>, path: string): string {
  let value: unknown = record;
  for (const segment of path.split('.')) {
    if (!value || typeof value !== 'object') return '';
    value = (value as Record<string, unknown>)[segment];
  }
  return typeof value === 'string' ? value.trim() : '';
}

function isMigratable(value: string, hosts: string[]) {
  if (value.startsWith('data:image/')) return true;
  try {
    return hosts.includes(new URL(value).hostname.toLowerCase());
  } catch {
    return false;
  }
}

function extensionFor(contentType: string) {
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  return 'jpg';
}