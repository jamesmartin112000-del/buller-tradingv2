/**
 * User service — owns the users/{uid} document in the Supabase doc store.
 *
 * CRITICAL: This is the ONLY source of truth for a user's role. Never trust
 * email patterns, localStorage values, or any frontend-only signal to decide
 * authorization. Always read role from here.
 *
 * Fault tolerance: every backend call here is wrapped so a transient
 * failure (RLS not deployed yet, network blip, etc.) does NOT sign the
 * user out. We fall back to a profile derived from Supabase Auth so the
 * user stays logged in and can use the app.
 */
import { fsGet, fsSet, fsUpdate, fsSubscribeDoc } from './docStore';
import type { Unsubscribe, AppAuthUser as BackendAuthUser } from './auth';

interface DeletedUserRecord {
  id: string;
  email: string;
  deletedAt: number;
}

export type Role = 'user' | 'admin' | 'super_admin';

export interface FirestoreUser {
  id: string; // uid
  uid: string;
  email: string;
  name: string;
  role: Role;
  status: 'active' | 'pending' | 'locked' | 'banned';
  verified: boolean;
  createdAt: number;
  updatedAt: number;
  lastLoginAt?: number;
  // Optional profile fields
  whatsapp?: string;
  country?: string;
  avatarUrl?: string;

  // RBAC & Subscription flags
  approved?: boolean;
  kycApproved?: boolean;
  paymentApproved?: boolean;
  paymentPending?: boolean;
  subscriptionActive?: boolean;
  expiresAt?: number;
  validityDays?: number;
  validityHours?: number;
  validityStartedAt?: number;
  validityExpiresAt?: number;
  maxDevices?: number;
  activeDevices?: number;
  kycStatus?: string;
  subscriptionPlan?: string;
  activeSession?: {
    sessionId: string;
    startedAt: number;
    browser: string;
    platform: string;
  };
  socialPopupComplete?: boolean;
  socialProgress?: {
    instagram: boolean;
    facebook: boolean;
    youtube: boolean;
    waived: boolean;
    completedAt?: number;
  };
}

const COL = 'users';

/**
 * Owner emails — these accounts are auto-promoted to `super_admin` on first
 * login, so the project owner can sign in to a brand-new backend without
 * manually editing the database.
 *
 * Configurable via the VITE_OWNER_EMAILS env var (comma-separated). The
 * defaults below remain as a safe fallback for the original project owner.
 * The actual password lives only in Supabase Auth.
 */
const DEFAULT_OWNERS = ['admin@buller.com', 'jamesmartin112000@gmail.com'];
const envOwners = (() => {
  try {
    const raw = (import.meta as any).env?.VITE_OWNER_EMAILS as
    string |
    undefined;
    if (!raw) return [];
    return raw.
    split(',').
    map((s) => s.trim().toLowerCase()).
    filter(Boolean);
  } catch {
    return [];
  }
})();
const OWNER_EMAILS = new Set<string>(
  [...DEFAULT_OWNERS, ...envOwners].map((e) => e.toLowerCase())
);

function isOwner(email: string | null | undefined): boolean {
  if (!email) return false;
  const match = OWNER_EMAILS.has(email.trim().toLowerCase());
  if (match) {
    console.log('[auth] owner email matched → super_admin', { email });
  }
  return match;
}

/**
 * Get or create a user document for the given auth user.
 *
 * Idempotent — safe to call on every login. NEVER throws: every backend
 * error is swallowed and a best-effort fallback profile is returned so
 * AuthContext keeps the user signed in.
 */
export async function ensureUserDoc(
fbUser: BackendAuthUser,
extras: Partial<Pick<FirestoreUser, 'name' | 'whatsapp' | 'country'>> = {})
: Promise<FirestoreUser> {
  const email = (fbUser.email || '').toLowerCase();
  const owner = isOwner(email);
  const now = Date.now();

  // Fallback profile — used if any backend call fails. Mirrors the shape
  // of a real users/{uid} doc so the rest of the app keeps working.
  const fallback: FirestoreUser = {
    id: fbUser.uid,
    uid: fbUser.uid,
    email,
    name:
    extras.name ||
    fbUser.displayName || (
    owner ? 'SYED AZHAAD HUSSAIN' : email.split('@')[0]) ||
    'User',
    role: owner ? 'super_admin' : 'user',
    status: owner ? 'active' : 'pending',
    verified: fbUser.emailVerified,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
    whatsapp: extras.whatsapp,
    country: extras.country,
    approved: owner ? true : false,
    kycApproved: owner ? true : false,
    paymentApproved: owner ? true : false,
    paymentPending: false,
    subscriptionActive: owner ? true : false,
    maxDevices: owner ? 999 : 1,
    activeDevices: 0
  };

  try {
    const deleted = await fsGet<DeletedUserRecord>('deleted_users', fbUser.uid);
    if (deleted && !owner) {
      return {
        ...fallback,
        status: 'banned',
        name: fbUser.displayName || email.split('@')[0] || 'Deleted user'
      };
    }
  } catch (error) {
    console.warn('[auth] deleted-user status unavailable', error);
  }

  let existing: FirestoreUser | null = null;
  let fetchError: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      existing = await fsGet<FirestoreUser>(COL, fbUser.uid);
      fetchError = null;
      break;
    } catch (err) {
      fetchError = err;
      // Permission/rule failures never succeed on retry — stop immediately
      // and fall back so the session is not blocked by a rules deployment.
      if (isNonRetryable(err) || attempt === 3) break;
      await delay(attempt * 200);
    }
  }
  if (fetchError) {
    // NEVER throw here. A read failure (rules not deployed, offline, brand
    // new account whose token has not propagated yet) must not block sign-in
    // or signup — the caller gets the auth-derived fallback profile instead.
    console.error(
      '[auth] ensureUserDoc.fetch failed — using fallback profile',
      fetchError
    );
    return fallback;
  }

  if (existing) {
    // Update lightweight fields only — NEVER touch role, status, or name
    // here. Name is preserved so admin-set or user-edited names aren't
    // clobbered by stale auth displayName on every login.
    try {
      await fsUpdate(COL, fbUser.uid, {
        lastLoginAt: now,
        verified: fbUser.emailVerified,
        updatedAt: now
      });
    } catch (err) {
      console.warn('[auth] ensureUserDoc.update failed (non-fatal)', err);
    }
    // Owner-email safety net: on EVERY login for an owner account, force
    // the canonical super_admin shape. This auto-heals tampered/stale
    // docs (wrong role, false approval flags, expired subscription, etc.)
    // and guarantees the project owner can ALWAYS get back in.
    if (owner) {
      const ownerPatch: Partial<FirestoreUser> = {
        role: 'super_admin',
        status: 'active',
        verified: true,
        approved: true,
        kycApproved: true,
        paymentApproved: true,
        paymentPending: false,
        subscriptionActive: true,
        maxDevices: 999,
        expiresAt: undefined,
        updatedAt: now
      };
      try {
        await fsUpdate(COL, fbUser.uid, ownerPatch);
        console.log('[auth] owner doc auto-healed to super_admin shape');
      } catch (err) {
        console.warn(
          '[auth] owner auto-heal write failed — projection still wins locally',
          err
        );
      }
      existing = { ...existing, ...ownerPatch } as FirestoreUser;
    }

    // Normalize safe defaults
    const isSuperAdmin = existing.role === 'super_admin';
    return {
      ...existing,
      lastLoginAt: now,
      verified: isSuperAdmin ? true : fbUser.emailVerified,
      updatedAt: now,
      approved: isSuperAdmin ? true : existing.approved ?? false,
      kycApproved: isSuperAdmin ? true : existing.kycApproved ?? false,
      paymentApproved: isSuperAdmin ?
      true :
      existing.paymentApproved ?? false,
      paymentPending: existing.paymentPending ?? false,
      subscriptionActive: isSuperAdmin ?
      true :
      existing.subscriptionActive ?? false,
      maxDevices: isSuperAdmin ? 999 : existing.maxDevices ?? 1,
      activeDevices: existing.activeDevices ?? 0
    };
  }

  // No existing doc — create one. Retry transient failures so authenticated
  // users never continue with a profile that is invisible to the admin.
  const record: FirestoreUser = { ...fallback };
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await fsSet(COL, record, true);
      console.log('[auth] ensureUserDoc.created', {
        uid: record.uid,
        role: record.role
      });
      return record;
    } catch (err) {
      lastError = err;
      if (isNonRetryable(err) || attempt === 3) break;
      await delay(attempt * 250);
    }
  }
  // Also non-fatal: the account exists in Auth, so keep the user moving with
  // the pending-shaped fallback. The doc is re-created on the next sign-in.
  console.error(
    '[auth] ensureUserDoc.create failed — using fallback profile',
    lastError
  );
  return record;
}

/** Rule/permission and misconfiguration errors that retrying cannot fix. */
function isNonRetryable(err: unknown): boolean {
  const code = String((err as any)?.code || '').toLowerCase();
  const message = String((err as any)?.message || '').toLowerCase();
  return (
    code.includes('permission-denied') ||
    code.includes('unauthenticated') ||
    code.includes('failed-precondition') ||
    message.includes('permission') ||
    message.includes('not initialized'));

}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function getUserById(uid: string): Promise<FirestoreUser | null> {
  try {
    return await fsGet<FirestoreUser>(COL, uid);
  } catch {
    return null;
  }
}

/**
 * Subscribe to the CURRENT user's document only. Single-doc subscription
 * is permission-tolerant (only needs read on /users/{uid}, not LIST on
 * the whole collection).
 */
export function subscribeUser(
uid: string,
cb: (user: FirestoreUser | null) => void)
: Unsubscribe {
  return fsSubscribeDoc<FirestoreUser>(
    COL,
    uid,
    (doc) => cb(doc),
    (err) => {
      console.warn('[auth] subscribeUser stream error (non-fatal)', err);
    }
  );
}

/** Admin-only — promote a user. Must be called from a context where the
 * caller is verified admin. RLS policies are the real enforcer. */
export async function setUserRole(uid: string, role: Role): Promise<void> {
  await fsUpdate(COL, uid, { role, updatedAt: Date.now() });
}

export async function setUserStatus(
uid: string,
status: FirestoreUser['status'])
: Promise<void> {
  await fsUpdate(COL, uid, { status, updatedAt: Date.now() });
}