import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  sanitizeError,
  verifyAuthenticatedRequest } from
'../_lib/firebaseAdmin';

/**
 * Best-effort role-claim bootstrap for Firestore collection listeners.
 * verifyAuthenticatedRequest reconciles the users/{uid} role into Firebase
 * Auth custom claims; the client force-refreshes its token after this returns.
 */
export default async function syncRoleClaims(
request: VercelRequest,
response: VercelResponse)
{
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    const caller = await verifyAuthenticatedRequest(
      request.headers.authorization,
      false,
      true
    );
    return response.status(200).json({ ok: true, role: caller.role });
  } catch (error) {
    const safe = sanitizeError(error);
    return response.status(safe.status).json({ error: safe.message });
  }
}