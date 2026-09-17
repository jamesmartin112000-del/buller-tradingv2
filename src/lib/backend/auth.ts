/**
 * Auth service — Firebase Authentication wrappers used by AuthContext,
 * Login, Signup and VerificationBanner.
 */
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  onAuthStateChanged,
  type User as FirebaseUser } from
'@firebase/auth';
import { firebaseAuth, isFirebaseReady } from '../firebase';

/**
 * Compat user shape — mirrors the fields consumers actually use
 * (uid, email, displayName, emailVerified).
 */
export interface AppAuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  emailVerified: boolean;
}

// Back-compat type aliases (AuthContext/userService import these names).
export type User = AppAuthUser;
export type Unsubscribe = () => void;

export interface AuthResult {
  ok: boolean;
  user?: AppAuthUser;
  error?: string;
  code?: string;
}

function toAppUser(u: FirebaseUser | null): AppAuthUser | null {
  if (!u) return null;
  return {
    uid: u.uid,
    email: u.email ?? null,
    displayName: u.displayName ?? null,
    emailVerified: u.emailVerified
  };
}

function mapAuthError(code: string, message?: string): string {
  const c = (code || '').toLowerCase();
  if (c.includes('email-already-in-use'))
  return 'An account with that email already exists.';
  if (
  c.includes('invalid-credential') ||
  c.includes('wrong-password') ||
  c.includes('user-not-found'))

  return 'Incorrect email or password.';
  if (c.includes('invalid-email')) return 'That email address is not valid.';
  if (c.includes('weak-password'))
  return 'Password is too weak — use at least 8 characters with mixed case.';
  if (c.includes('too-many-requests'))
  return 'Too many attempts. Please wait a minute and try again.';
  if (c.includes('user-disabled'))
  return 'This account has been disabled. Contact the admin.';
  if (c.includes('network'))
  return 'Network error — check your connection and retry.';
  return message || 'Authentication failed. Please try again.';
}

function requireAuth() {
  if (!isFirebaseReady()) {
    throw new Error(
      'Firebase is not initialized. Check your environment configuration.'
    );
  }
  return firebaseAuth;
}

export async function signUpWithEmail(
email: string,
password: string,
displayName?: string)
: Promise<AuthResult> {
  try {
    const auth = requireAuth();
    const cred = await createUserWithEmailAndPassword(
      auth,
      email.trim().toLowerCase(),
      password
    );
    if (displayName) {
      try {
        await updateProfile(cred.user, { displayName });
      } catch {

        /* non-fatal */}
    }
    try {
      await sendEmailVerification(cred.user);
    } catch {

      /* non-fatal */}
    return { ok: true, user: toAppUser(cred.user)! };
  } catch (err: any) {
    return {
      ok: false,
      error: mapAuthError(err?.code, err?.message),
      code: err?.code
    };
  }
}

export async function signInWithEmail(
email: string,
password: string)
: Promise<AuthResult> {
  try {
    const auth = requireAuth();
    const cred = await signInWithEmailAndPassword(
      auth,
      email.trim().toLowerCase(),
      password
    );
    return { ok: true, user: toAppUser(cred.user)! };
  } catch (err: any) {
    return {
      ok: false,
      error: mapAuthError(err?.code, err?.message),
      code: err?.code
    };
  }
}

export async function signOutUser(): Promise<void> {
  if (!isFirebaseReady()) return;
  await fbSignOut(firebaseAuth);
}

/**
 * Force-refresh the current user's ID token so custom claims set by the
 * server (e.g. role after an admin promotion) are picked up immediately.
 * Firestore rules read request.auth.token.role, so a stale token keeps
 * collection LIST/onSnapshot queries in "permission denied" even after
 * claims were updated. Best-effort: the app stays usable on failure.
 */
export async function refreshIdToken(): Promise<void> {
  try {
    const auth = requireAuth();
    const current = auth.currentUser;
    if (current) await current.getIdToken(true);
  } catch (error) {
    console.warn('[auth] token refresh failed (non-fatal)', error);
  }
}

/**
 * Ask the optional server runtime to reconcile the Firestore profile role into
 * Auth custom claims before admin collection listeners start. Deployments
 * without Vercel continue normally; owner accounts still use the rules allowlist.
 */
export async function syncRoleClaim(): Promise<void> {
  try {
    const auth = requireAuth();
    const current = auth.currentUser;
    if (!current) return;
    const token = await current.getIdToken();
    const response = await fetch('/api/auth/claims', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) return;
    await current.getIdToken(true);
  } catch (error) {
    console.warn('[auth] role claim sync unavailable (non-fatal)', error);
  }
}

export async function resetPassword(email: string): Promise<AuthResult> {
  try {
    const auth = requireAuth();
    await sendPasswordResetEmail(auth, email.trim().toLowerCase());
    return { ok: true };
  } catch (err: any) {
    return {
      ok: false,
      error: mapAuthError(err?.code, err?.message),
      code: err?.code
    };
  }
}

export async function resendVerification(): Promise<AuthResult> {
  try {
    const auth = requireAuth();
    const current = auth.currentUser;
    if (!current) return { ok: false, error: 'Not signed in.' };
    await sendEmailVerification(current);
    return { ok: true };
  } catch (err: any) {
    return {
      ok: false,
      error: mapAuthError(err?.code, err?.message),
      code: err?.code
    };
  }
}

/**
 * Auth state listener — fires immediately with the current session user,
 * then on every sign-in / sign-out / token refresh.
 */
export function subscribeAuth(
cb: (user: AppAuthUser | null) => void)
: Unsubscribe {
  if (!isFirebaseReady()) {
    queueMicrotask(() => cb(null));
    return () => {};
  }
  return onAuthStateChanged(firebaseAuth, (u) => cb(toAppUser(u)));
}

/** Password strength validator — used by signup. */
export function validatePassword(pw: string): {ok: boolean;reason?: string;} {
  if (!pw || pw.length < 8)
  return { ok: false, reason: 'At least 8 characters.' };
  if (!/[A-Z]/.test(pw))
  return { ok: false, reason: 'Include an uppercase letter.' };
  if (!/[a-z]/.test(pw))
  return { ok: false, reason: 'Include a lowercase letter.' };
  if (!/[0-9]/.test(pw)) return { ok: false, reason: 'Include a number.' };
  return { ok: true };
}