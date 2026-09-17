import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  adminAuth,
  adminDb,
  HttpError,
  sanitizeError,
  verifyAuthenticatedRequest } from
'../_lib/firebaseAdmin';

type ManagedRole = 'user' | 'admin';
type ManagedStatus = 'active' | 'pending' | 'locked' | 'banned';

export default async function adminUsersHandler(
request: VercelRequest,
response: VercelResponse)
{
  if (!['POST', 'PATCH', 'DELETE'].includes(request.method || '')) {
    response.setHeader('Allow', 'POST, PATCH, DELETE');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    const caller = await verifyAuthenticatedRequest(request.headers.authorization, true);
    const email = normalizeEmail(request.body?.email);
    const requestedId = String(request.body?.id || '').trim();
    const name = String(request.body?.name || '').trim();
    const role = normalizeRole(request.body?.role);
    const status = normalizeStatus(request.body?.status);

    let authUser = requestedId ? await getAuthUser(requestedId, email) : await findByEmail(email);

    if (request.method === 'DELETE') {
      if (!authUser && !requestedId) throw new HttpError(404, 'User not found.');
      const uid = authUser?.uid || requestedId;
      if (uid === caller.uid) throw new HttpError(400, 'You cannot delete your own admin account.');
      const targetProfile = await adminDb.collection('users').doc(uid).get();
      if (targetProfile.data()?.role === 'super_admin') {
        throw new HttpError(403, 'Super-admin accounts are protected.');
      }
      if (authUser) await adminAuth.deleteUser(authUser.uid);
      const batch = adminDb.batch();
      batch.delete(adminDb.collection('users').doc(uid));
      if (requestedId && requestedId !== uid) {
        batch.delete(adminDb.collection('users').doc(requestedId));
      }
      await batch.commit();
      return response.status(200).json({ ok: true });
    }

    if (!email || !name) throw new HttpError(400, 'Name and email are required.');
    if (!authUser) {
      authUser = await adminAuth.createUser({ email, displayName: name, emailVerified: false });
    } else if (authUser.email !== email || authUser.displayName !== name) {
      authUser = await adminAuth.updateUser(authUser.uid, { email, displayName: name });
    }

    const now = Date.now();
    const active = status === 'active';
    const userRef = adminDb.collection('users').doc(authUser.uid);
    const existing = await userRef.get();
    const previous = existing.data() || {};
    const protectedRole = previous.role === 'super_admin' ? 'super_admin' : role;
    const record = {
      ...previous,
      id: authUser.uid,
      uid: authUser.uid,
      email,
      name,
      role: protectedRole,
      status: protectedRole === 'super_admin' ? 'active' : status,
      verified: authUser.emailVerified,
      createdAt: Number(previous.createdAt || now),
      updatedAt: now,
      lastSeen: Number(previous.lastSeen || now),
      lastLoginAt: previous.lastLoginAt || null,
      approved: protectedRole === 'super_admin' ? true : active,
      kycApproved:
      protectedRole === 'super_admin' ?
      true :
      active ?
      previous.kycApproved ?? true :
      previous.kycApproved ?? false,
      paymentApproved: protectedRole === 'super_admin' ? true : active ? previous.paymentApproved ?? true : false,
      paymentPending: false,
      subscriptionActive: protectedRole === 'super_admin' ? true : active ? previous.subscriptionActive ?? true : false,
      maxDevices: protectedRole === 'super_admin' || role === 'admin' ? 999 : Number(previous.maxDevices || 1),
      activeDevices: Number(previous.activeDevices || 0),
      createdByAdmin: previous.createdByAdmin ?? caller.email
    };
    await userRef.set(record, { merge: false });

    // Keep Auth custom claims in sync with the doc role so Firestore rules'
    // isAdminToken() (request.auth.token.role) immediately honors the new role
    // after the target user refreshes its ID token. Without this, a doc-role
    // admin without claims fails every collection LIST query.
    try {
      await adminAuth.setCustomUserClaims(authUser.uid, { role: protectedRole });
    } catch (error) {
      console.warn('[admin/users] custom-claims sync failed (non-fatal)', error);
    }

    if (requestedId && requestedId !== authUser.uid) {
      await adminDb.collection('users').doc(requestedId).delete();
    }

    return response.status(request.method === 'POST' ? 201 : 200).json({ ok: true, user: record });
  } catch (error) {
    const safe = sanitizeError(error);
    return response.status(safe.status).json({ error: safe.message });
  }
}

function normalizeEmail(value: unknown) {
  const email = String(value || '').trim().toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, 'Enter a valid email address.');
  }
  return email;
}

function normalizeRole(value: unknown): ManagedRole {
  return value === 'admin' ? 'admin' : 'user';
}

function normalizeStatus(value: unknown): ManagedStatus {
  return value === 'pending' || value === 'locked' || value === 'banned' ? value : 'active';
}

async function findByEmail(email: string) {
  if (!email) return null;
  try {
    return await adminAuth.getUserByEmail(email);
  } catch (error) {
    const code = (error as {code?: string;}).code;
    if (code === 'auth/user-not-found') return null;
    throw error;
  }
}

async function getAuthUser(uid: string, email: string) {
  try {
    return await adminAuth.getUser(uid);
  } catch (error) {
    const code = (error as {code?: string;}).code;
    if (code !== 'auth/user-not-found') throw error;
    return findByEmail(email);
  }
}