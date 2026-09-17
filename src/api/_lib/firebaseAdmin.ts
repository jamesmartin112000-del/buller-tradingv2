import { applicationDefault, cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

function getCredential() {
  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const base64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  // Accept both the deployed variable names and the FIREBASE_ADMIN_* names
  // documented by earlier releases. This avoids a credential outage during a
  // rolling deploy while keeping the credential server-only.
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.FIREBASE_ADMIN_PROJECT_ID;
  const individual =
  clientEmail && privateKey ?
  {
    project_id: projectId,
    client_email: clientEmail,
    private_key: privateKey
  } :
  null;

  if (!encoded && !base64 && !individual) return applicationDefault();

  try {
    const parsed = individual ||
    JSON.parse(
      base64 ? Buffer.from(base64, 'base64').toString('utf8') : encoded!
    ) as {
      project_id?: string;
      client_email?: string;
      private_key?: string;
    };
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
      throw new Error('project_id, client_email and private_key are required');
    }
    return cert({
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key.replace(/\\n/g, '\n')
    });
  } catch (error) {
    console.error('Firebase Admin credentials are invalid', error);
    throw new Error('Firebase Admin credentials are missing or malformed.');
  }
}

let app: App | null = null;

function getAdminApp(): App {
  if (app) return app;
  app =
  getApps()[0] ??
  initializeApp({
    credential: getCredential(),
    projectId:
    process.env.FIREBASE_PROJECT_ID ||
    process.env.FIREBASE_ADMIN_PROJECT_ID ||
    'buller-trading'
  });
  return app;
}

/**
 * Firebase Admin is deliberately lazy. A malformed deployment credential must
 * fail inside an API handler's try/catch, not while the module is importing;
 * otherwise Vercel returns an HTML 500 and the client cannot classify it.
 */
function lazyService<T extends object>(factory: () => T): T {
  return new Proxy({} as T, {
    get(_target, property) {
      const service = factory();
      const value = Reflect.get(service, property, service) as unknown;
      return typeof value === 'function' ? value.bind(service) : value;
    }
  });
}

export const adminAuth = lazyService<Auth>(() => getAuth(getAdminApp()));
export const adminDb = lazyService<Firestore>(() => getFirestore(getAdminApp()));

export interface VerifiedRequest {
  uid: string;
  email: string;
  role: 'user' | 'admin' | 'super_admin';
}

const DEFAULT_OWNER_EMAILS = [
'admin@buller.com',
'jamesmartin112000@gmail.com'];


function isOwnerEmail(value: unknown): boolean {
  const email = String(value || '').trim().toLowerCase();
  const configured = String(process.env.OWNER_EMAILS || process.env.VITE_OWNER_EMAILS || '').
  split(',').
  map((owner) => owner.trim().toLowerCase()).
  filter(Boolean);
  return new Set([...DEFAULT_OWNER_EMAILS, ...configured]).has(email);
}

export async function verifyAuthenticatedRequest(
authorization: string | undefined,
requireAdmin = false,
allowRestricted = false)
: Promise<VerifiedRequest> {
  if (!authorization?.startsWith('Bearer ')) {
    throw new HttpError(401, 'Authentication required.');
  }
  const token = await adminAuth.verifyIdToken(authorization.slice(7), true);
  const userRef = adminDb.collection('users').doc(token.uid);
  let userSnapshot = await userRef.get();
  if (!userSnapshot.exists) {
    const deletedSnapshot = await adminDb.collection('deleted_users').doc(token.uid).get();
    if (deletedSnapshot.exists) {
      throw new HttpError(403, 'This account has been removed. Contact the administrator.');
    }
    // Client-side profile creation can be delayed by a cold/offline browser.
    // Provision the safest possible server-owned profile so authenticated API
    // data (especially journals) remains available and permanently scoped.
    const email = String(token.email || '').trim().toLowerCase();
    const owner = isOwnerEmail(email);
    const now = Date.now();
    await userRef.set({
      id: token.uid,
      uid: token.uid,
      email,
      name: String(token.name || email.split('@')[0] || 'User'),
      role: owner ? 'super_admin' : 'user',
      status: owner ? 'active' : 'pending',
      verified: token.email_verified === true,
      approved: owner,
      kycApproved: owner,
      paymentApproved: owner,
      paymentPending: false,
      subscriptionActive: owner,
      maxDevices: owner ? 999 : 1,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now
    });
    userSnapshot = await userRef.get();
  }
  let profile = userSnapshot.data() as {
    email?: string;
    role?: 'user' | 'admin' | 'super_admin';
    status?: string;
    expiresAt?: number;
    validityExpiresAt?: number;
  };
  // Owner allowlists are evaluated by the trusted server. This repairs stale
  // owner profiles before role enforcement and makes OWNER_EMAILS consistent
  // with the client bootstrap without granting access from client state alone.
  if (isOwnerEmail(token.email) && profile.role !== 'super_admin') {
    await userRef.set(
      {
        role: 'super_admin',
        status: 'active',
        approved: true,
        kycApproved: true,
        paymentApproved: true,
        paymentPending: false,
        subscriptionActive: true,
        maxDevices: 999,
        updatedAt: Date.now()
      },
      { merge: true }
    );
    profile = { ...profile, role: 'super_admin', status: 'active' };
  }
  const role = profile.role || 'user';
  const isAdmin = role === 'admin' || role === 'super_admin';
  const expiresAt = Number(profile.validityExpiresAt || profile.expiresAt || 0);
  if (
  !allowRestricted &&
  !isAdmin && (
  profile.status === 'banned' || profile.status === 'locked' || expiresAt > 0 && expiresAt <= Date.now()))
  {
    throw new HttpError(403, expiresAt > 0 && expiresAt <= Date.now() ?
    'Your subscription has expired. Renew your account to continue.' :
    'Account access is restricted.');
  }
  // Keep Auth custom claims in sync with the users/{uid} document role.
  // Firestore rules read request.auth.token.role (isAdminToken), so an admin
  // promoted only in the Firestore doc would still fail every collection
  // LIST/onSnapshot query. verifyIdToken already exposes the claims, so this
  // only fires when they actually differ. The client picks the new claims up
  // after its next token refresh (refreshIdToken in lib/backend/auth.ts).
  try {
    const currentRole = String((token as {role?: string;}).role || 'user');
    if (currentRole !== role) {
      await adminAuth.setCustomUserClaims(token.uid, { role });
    }
  } catch (error) {
    console.warn('[firebaseAdmin] custom-claims reconcile failed (non-fatal)', error);
  }
  if (requireAdmin && role !== 'admin' && role !== 'super_admin') {
    throw new HttpError(403, 'Admin access required.');
  }
  return { uid: token.uid, email: profile.email || token.email || '', role };
}

export class HttpError extends Error {
  constructor(
  public readonly status: number,
  message: string)
  {
    super(message);
  }
}

export function sanitizeError(error: unknown) {
  if (error instanceof HttpError) return { status: error.status, message: error.message };
  console.error('Server request failed', error);
  const debugMode = process.env.NODE_ENV !== 'production' || process.env.SESSION_DEBUG === '1';
  const detail = error instanceof Error ? error.message : String(error);
  const credentialFailure =
  /credential|private key|service account|default credentials|metadata server/i.test(detail);
  const storageAccessKeyFailure = /InvalidAccessKeyId|invalid access key/i.test(detail);
  const storageSignatureFailure = /SignatureDoesNotMatch|signature.*match/i.test(detail);
  const storagePermissionFailure = /AccessDenied|Forbidden|not authorized/i.test(detail);
  const storageEndpointFailure = /UnknownEndpoint|ENOTFOUND|ECONNREFUSED|endpoint/i.test(detail);
  const storageMessage = storageAccessKeyFailure ?
  'R2 rejected the configured access key. Replace the server-side R2 credentials and redeploy.' :
  storageSignatureFailure ?
  'R2 signature verification failed. Verify the access key, secret key, endpoint, and system time.' :
  storagePermissionFailure ?
  'R2 denied this operation. Verify that the API token has Object Read and Write permission for this bucket.' :
  storageEndpointFailure ?
  'The configured R2 endpoint could not be reached. Verify R2_ENDPOINT and redeploy.' :
  '';
  return {
    status: 500,
    message: storageMessage || (credentialFailure ?
    'Server authentication is not configured for this deployment.' :
    debugMode ?
    `The request could not be completed: ${detail}` :
    'The request could not be completed.')
  };
}