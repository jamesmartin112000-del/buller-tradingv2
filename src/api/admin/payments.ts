import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  adminDb,
  HttpError,
  sanitizeError,
  verifyAuthenticatedRequest } from
'../_lib/firebaseAdmin';

const DAY_MS = 86_400_000;

export default async function adminPaymentsHandler(
request: VercelRequest,
response: VercelResponse)
{
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    const caller = await verifyAuthenticatedRequest(request.headers.authorization, true);
    const paymentId = String(request.body?.paymentId || '').trim();
    const action = String(request.body?.action || '');
    const adminNotes = String(request.body?.adminNotes || '').trim();
    if (!paymentId || action !== 'approve' && action !== 'reject') {
      throw new HttpError(400, 'Invalid payment action.');
    }

    const paymentRef = adminDb.collection('payment_proofs').doc(paymentId);
    const result = await adminDb.runTransaction(async (transaction) => {
      const paymentSnapshot = await transaction.get(paymentRef);
      if (!paymentSnapshot.exists) throw new HttpError(404, 'Payment not found.');
      const payment = paymentSnapshot.data() as {
        userId?: string | null;
        email?: string;
        plan?: string;
        planId?: string | null;
        amount?: number;
        status?: string;
        validityDaysGranted?: number;
      };
      if (payment.status !== 'pending') {
        throw new HttpError(409, `Payment is already ${payment.status || 'reviewed'}.`);
      }

      const now = Date.now();
      if (action === 'reject') {
        transaction.set(
          paymentRef,
          {
            status: 'rejected',
            adminNotes: adminNotes || null,
            reviewedAt: now,
            reviewedBy: caller.uid,
            updatedAt: now
          },
          { merge: true }
        );
        if (payment.userId) {
          transaction.set(
            adminDb.collection('users').doc(payment.userId),
            {
              paymentApproved: false,
              paymentPending: false,
              paymentStatus: 'rejected',
              updatedAt: now
            },
            { merge: true }
          );
        }
        return { status: 'rejected' as const, email: payment.email || '' };
      }

      if (!payment.userId) throw new HttpError(409, 'Payment is not linked to a Firebase user.');
      const userRef = adminDb.collection('users').doc(payment.userId);
      const userSnapshot = await transaction.get(userRef);
      if (!userSnapshot.exists) throw new HttpError(404, 'Linked user profile not found.');
      const user = userSnapshot.data() as {expiresAt?: number;validityExpiresAt?: number;};
      const days = Math.max(1, Math.min(3650, Number(payment.validityDaysGranted) || 30));
      const currentExpiry = Number(user.validityExpiresAt || user.expiresAt || 0);
      const validityStartedAt = Math.max(now, currentExpiry);
      const expiresAt = validityStartedAt + days * DAY_MS;

      transaction.set(
        paymentRef,
        {
          status: 'verified',
          adminNotes: adminNotes || null,
          reviewedAt: now,
          reviewedBy: caller.uid,
          updatedAt: now
        },
        { merge: true }
      );
      transaction.set(
        userRef,
        {
          paymentApproved: true,
          paymentPending: false,
          approved: true,
          subscriptionActive: true,
          status: 'active',
          plan: payment.planId || payment.plan || '',
          subscriptionPlan: payment.planId || payment.plan || '',
          planName: payment.plan || '',
          planAmount: Number(payment.amount || 0),
          paymentStatus: 'approved',
          validityDays: days,
          validityHours: days * 24,
          validityStartedAt,
          validityExpiresAt: expiresAt,
          expiresAt,
          approvedAt: now,
          updatedAt: now
        },
        { merge: true }
      );
      return {
        status: 'verified' as const,
        email: payment.email || '',
        expiresAt,
        days
      };
    });

    const now = Date.now();
    try {
      await adminDb.collection('notifications').add({
        target: 'user',
        targetEmail: result.email,
        title:
        result.status === 'verified' ?
        'Payment verified — account active' :
        'Payment could not be verified',
        body:
        result.status === 'verified' ?
        `Your payment was verified. Your account is active for ${result.days} day${result.days === 1 ? '' : 's'}.` :
        adminNotes ?
        `Your payment was not approved: ${adminNotes}` :
        'Your payment was not approved. Please submit a valid proof.',
        kind: result.status === 'verified' ? 'success' : 'warn',
        read: false,
        createdAt: now,
        link: result.status === 'verified' ? '/app/dashboard' : '/gate'
      });
    } catch (notificationError) {
      // Approval/rejection is already atomically committed. Never return a
      // false failure that could make an Admin process the same proof again.
      console.warn('[admin/payments] Review notification unavailable', notificationError);
    }

    return response.status(200).json({ ok: true, ...result });
  } catch (error) {
    const safe = sanitizeError(error);
    return response.status(safe.status).json({ error: safe.message });
  }
}