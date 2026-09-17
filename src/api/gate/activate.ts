import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  adminDb,
  HttpError,
  sanitizeError,
  verifyAuthenticatedRequest } from
'../_lib/firebaseAdmin';
import { MAX_VALIDITY_HOURS, MIN_VALIDITY_HOURS } from '../../utils/validity';

const HOUR_MS = 3_600_000;

export default async function activateGateKey(
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
    const enteredKey = String(request.body?.key || '').trim().toUpperCase();
    if (!/^AZH-TRD-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(enteredKey)) {
      throw new HttpError(400, 'Invalid master key format.');
    }

    // Recommended production path: Firebase Admin uses the trusted server
    // clock, eliminating client clock skew. The client merge-delta fallback
    // remains available so gate activation does not depend on Vercel.
    const result = await adminDb.runTransaction(async (transaction) => {
      const keyQuery = await transaction.get(
        adminDb.collection('master_keys').where('key', '==', enteredKey).limit(1)
      );
      if (keyQuery.empty) throw new HttpError(404, 'Invalid or expired master key.');

      const keyDoc = keyQuery.docs[0];
      const keyData = keyDoc.data() as {
        email?: string;
        validityDays?: number;
        validityHours?: number;
        usedAt?: number;
        validityExpiresAt?: number;
      };
      if ((keyData.email || '').trim().toLowerCase() !== caller.email.trim().toLowerCase()) {
        throw new HttpError(403, 'This key is not assigned to your account.');
      }

      const now = Date.now();
      const validityHours = Math.max(
        MIN_VALIDITY_HOURS,
        Math.min(MAX_VALIDITY_HOURS, Number(keyData.validityHours) || (Number(keyData.validityDays) || 30) * 24)
      );
      const validityDays = Math.max(1, Math.ceil(validityHours / 24));
      const expiresAt = keyData.usedAt ?
      Number(keyData.validityExpiresAt || 0) :
      now + validityHours * HOUR_MS;
      if (!expiresAt || expiresAt <= now) {
        throw new HttpError(410, 'This master key has expired.');
      }

      const userRef = adminDb.collection('users').doc(caller.uid);
      transaction.set(
        keyDoc.ref,
        {
          used: true,
          usedAt: keyData.usedAt || now,
          validityExpiresAt: expiresAt
        },
        { merge: true }
      );
      transaction.set(
        userRef,
        {
          approved: true,
          paymentApproved: true,
          paymentPending: false,
          subscriptionActive: true,
          status: 'active',
          validityDays,
          validityHours,
          validityStartedAt: keyData.usedAt || now,
          validityExpiresAt: expiresAt,
          expiresAt,
          updatedAt: now
        },
        { merge: true }
      );

      return { expiresAt, validityDays, validityHours };
    });

    return response.status(200).json({ ok: true, ...result });
  } catch (error) {
    const safe = sanitizeError(error);
    return response.status(safe.status).json({ error: safe.message });
  }
}