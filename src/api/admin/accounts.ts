import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  adminDb,
  HttpError,
  sanitizeError,
  verifyAuthenticatedRequest } from
'../_lib/firebaseAdmin';
import { MAX_VALIDITY_HOURS, MIN_VALIDITY_HOURS } from '../../utils/validity';

const VALID_STATUSES = new Set(['active', 'pending', 'locked', 'banned']);

export default async function adminAccountsHandler(
request: VercelRequest,
response: VercelResponse)
{
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    const caller = await verifyAuthenticatedRequest(request.headers.authorization, true);
    const action = String(request.body?.action || '');
    const userId = String(request.body?.userId || '').trim();
    if (!userId) throw new HttpError(400, 'User id is required.');
    if (userId === caller.uid && action === 'status') {
      throw new HttpError(400, 'You cannot change your own admin status.');
    }

    const userRef = adminDb.collection('users').doc(userId);
    const snapshot = await userRef.get();
    if (!snapshot.exists) throw new HttpError(404, 'User profile not found.');
    const current = snapshot.data() || {};
    if (current.role === 'super_admin' && caller.role !== 'super_admin') {
      throw new HttpError(403, 'Super-admin accounts are protected.');
    }

    const now = Date.now();
    let patch: Record<string, unknown>;

    if (action === 'kyc-review') {
      const decision = String(request.body?.decision || '');
      if (decision !== 'approved' && decision !== 'rejected') {
        throw new HttpError(400, 'Invalid KYC decision.');
      }
      const note = String(request.body?.note || '').trim();
      if (decision === 'rejected' && !note) {
        throw new HttpError(400, 'A rejection reason is required.');
      }
      patch = {
        kycApproved: decision === 'approved',
        kyc: {
          ...(current.kyc || {}),
          status: decision,
          reviewedAt: now,
          reviewedBy: caller.email,
          rejectReason: decision === 'approved' ? null : note
        },
        updatedAt: now
      };
    } else if (action === 'status') {
      const status = String(request.body?.status || '');
      if (!VALID_STATUSES.has(status)) throw new HttpError(400, 'Invalid account status.');
      patch = {
        status,
        ...(status === 'active' ?
        {
          deviceWarnings: 0,
          deviceLock: {
            ...(current.deviceLock || {}),
            warnings: 0,
            isLocked: false,
            lockedAt: null
          }
        } :
        {}),
        updatedAt: now
      };
    } else if (action === 'validity') {
      const hours = Number(request.body?.hours);
      if (!Number.isFinite(hours) || hours < MIN_VALIDITY_HOURS || hours > MAX_VALIDITY_HOURS) {
        throw new HttpError(400, 'Validity must be between 1 minute and 10 years.');
      }
      const mode = request.body?.mode === 'extend' ? 'extend' : 'replace';
      const requestedExpiry = Number(request.body?.expiresAt || 0);
      if (requestedExpiry && (!Number.isFinite(requestedExpiry) || requestedExpiry <= now)) {
        throw new HttpError(400, 'Specific expiry must be in the future.');
      }
      const base = mode === 'extend' ?
      Math.max(now, Number(current.expiresAt || current.validityExpiresAt || 0)) :
      now;
      const expiresAt = requestedExpiry || base + hours * 3_600_000;
      const grantedHours = (expiresAt - now) / 3_600_000;
      patch = {
        validityDays: Math.max(1, Math.ceil(grantedHours / 24)),
        validityHours: grantedHours,
        validityStartedAt: now,
        validityExpiresAt: expiresAt,
        expiresAt,
        approved: true,
        paymentApproved: true,
        paymentPending: false,
        subscriptionActive: true,
        status: 'active',
        updatedAt: now
      };
    } else {
      throw new HttpError(400, 'Unknown account action.');
    }

    await userRef.set(patch, { merge: true });
    const updated = { id: userId, uid: userId, ...current, ...patch };
    return response.status(200).json({ ok: true, user: updated });
  } catch (error) {
    const safe = sanitizeError(error);
    return response.status(safe.status).json({ error: safe.message });
  }
}