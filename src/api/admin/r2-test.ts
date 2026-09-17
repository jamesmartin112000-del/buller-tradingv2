import { randomUUID } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sanitizeError, verifyAuthenticatedRequest } from '../_lib/firebaseAdmin';
import { putObject, removeObject, verifyUploadedObject } from '../_lib/r2';

const ONE_PIXEL_PNG = Uint8Array.from(Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
));

export default async function testR2(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed.' });
  }
  let key = '';
  try {
    await verifyAuthenticatedRequest(request.headers.authorization, true);
    key = `uploads/diagnostics/admin/${Date.now()}-${randomUUID()}-test.png`;
    const publicUrl = await putObject({ key, body: ONE_PIXEL_PNG, contentType: 'image/png' });
    const verified = await verifyUploadedObject(key, ONE_PIXEL_PNG.byteLength);
    await removeObject(key);
    return response.status(200).json({
      ok: true,
      message: 'R2 write, HEAD verification, and delete all passed.',
      publicUrl,
      contentType: verified.contentType,
      bytes: verified.size,
      cleanedUp: true
    });
  } catch (error) {
    if (key) await removeObject(key).catch(() => undefined);
    const safe = sanitizeError(error);
    console.error('[admin/r2-test] connectivity test failed', {
      status: safe.status,
      code: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : String(error)
    });
    return response.status(safe.status).json({ error: safe.message });
  }
}