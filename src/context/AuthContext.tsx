import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState } from
'react';
import {
  refreshIdToken,
  resetPassword,
  signInWithEmail,
  signOutUser,
  signUpWithEmail,
  subscribeAuth,
  syncRoleClaim,
  validatePassword,
  type AuthResult } from
'../lib/backend/auth';
import {
  ensureUserDoc,
  subscribeUser,
  type FirestoreUser,
  type Role } from
'../lib/backend/userService';
import { isBackendReady } from '../lib/backend/ready';
import { useLocalStorage } from '../hooks/useLocalStorage';
import {
  cacheLocalRecord,
  clearLocalSessionCache,
  ensureFirestoreSeed,
  startFirestoreSync,
  stopFirestoreSync } from
'../lib/db/store';

export interface User {
  uid: string;
  email: string;
  name: string;
  role: Role;
  verified: boolean;
  status: FirestoreUser['status'];
  approved: boolean;
  kycApproved: boolean;
  paymentApproved: boolean;
  subscriptionActive: boolean;
  expiresAt?: number;
  maxDevices: number;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  gatePassed: boolean;
  backendReady: boolean;
  authError: string | null;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string, name: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
  sendReset: (email: string) => Promise<AuthResult>;
  setGatePassed: (value: boolean) => void;
  clearAuthError: () => void;
  login: (email: string, name?: string) => void;
  signup: (email: string, name: string) => void;
  validatePassword: typeof validatePassword;
}

const AuthContext = createContext<AuthState | null>(null);
const DEFAULT_OWNER_EMAILS = ['admin@buller.com', 'jamesmartin112000@gmail.com'];
const CONFIGURED_OWNER_EMAILS = String(
  (import.meta as unknown as {env?: {VITE_OWNER_EMAILS?: string;};}).env?.
  VITE_OWNER_EMAILS || ''
).
split(',').
map((email) => email.trim().toLowerCase()).
filter(Boolean);
const OWNER_EMAILS = new Set([...DEFAULT_OWNER_EMAILS, ...CONFIGURED_OWNER_EMAILS]);
const SESSION_UID_KEY = 'te.auth.uid';

export function AuthProvider({ children }: {children: React.ReactNode;}) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [gatePassed, setStoredGatePassed] = useLocalStorage<boolean>(
    'te.gate',
    false
  );
  const backendReady = isBackendReady();
  const userUnsubRef = useRef<(() => void) | null>(null);
  const currentUidRef = useRef<string | null>(null);
  const authGenerationRef = useRef(0);
  const mountedRef = useRef(true);
  const lastTokenRefreshRef = useRef(0);

  const setGatePassed = useCallback(
    (value: boolean) => {
      setStoredGatePassed(value);
      try {
        if (value && currentUidRef.current) {
          localStorage.setItem('te.gate.uid', currentUidRef.current);
        } else {
          localStorage.removeItem('te.gate.uid');
        }
      } catch {

        // State remains functional in privacy-restricted browsers.
      }},
    [setStoredGatePassed]
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!backendReady) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribeAuth = subscribeAuth(async (firebaseUser) => {
      const generation = authGenerationRef.current + 1;
      authGenerationRef.current = generation;
      const previousUid = currentUidRef.current;
      let persistedUid: string | null = null;
      try {
        persistedUid = localStorage.getItem(SESSION_UID_KEY);
      } catch {

        // Privacy-restricted browsers use the in-memory UID only.
      }userUnsubRef.current?.();
      userUnsubRef.current = null;
      stopFirestoreSync();

      if (!firebaseUser) {
        currentUidRef.current = null;
        clearLocalSessionCache();
        try {
          localStorage.removeItem(SESSION_UID_KEY);
        } catch {}
        setUser(null);
        setGatePassed(false);
        setLoading(false);
        return;
      }

      const knownUid = previousUid || persistedUid;
      if (knownUid && knownUid !== firebaseUser.uid) clearLocalSessionCache();
      currentUidRef.current = firebaseUser.uid;
      try {
        localStorage.setItem(SESSION_UID_KEY, firebaseUser.uid);
      } catch {}
      const isCurrent = () =>
      mountedRef.current &&
      generation === authGenerationRef.current &&
      currentUidRef.current === firebaseUser.uid;

      if (previousUid !== firebaseUser.uid) setUser(null);

      let gateUid: string | null = null;
      try {
        gateUid = localStorage.getItem('te.gate.uid');
      } catch {

        // Missing gate ownership is treated as a fresh account.
      }if (gateUid !== firebaseUser.uid) setGatePassed(false);

      // Pull fresh custom claims (role) at login / app load so Firestore
      // rules' isAdminToken() (request.auth.token.role) honors an admin
      // promotion without a manual re-login.
      try {
        if (Date.now() - lastTokenRefreshRef.current > 60_000) {
          lastTokenRefreshRef.current = Date.now();
          await refreshIdToken();
          if (!isCurrent()) return;
        }
      } catch {

        // Non-fatal — the session keeps working with the previous token.
      }
      try {
        const profile = await ensureUserDoc(firebaseUser);
        if (!isCurrent()) return;
        const projected = projectUser(profile, firebaseUser.email);
        cacheUserProfile(profile);
        setAuthError(null);
        setUser(projected);
        const syncIdentity = {
          uid: projected.uid,
          email: projected.email,
          role: projected.role
        };
        if (projected.role === 'admin' || projected.role === 'super_admin') {
          await syncRoleClaim();
          if (!isCurrent()) return;
        }
        startFirestoreSync(syncIdentity);
        void ensureFirestoreSeed(syncIdentity).catch((seedError) => {
          console.warn('[auth] Canonical Firestore seed unavailable', seedError);
        });
        userUnsubRef.current = subscribeUser(firebaseUser.uid, (next) => {
          if (!isCurrent()) return;
          if (!next) {
            const removed = fallbackUserFromAuth(
              firebaseUser.uid,
              firebaseUser.email,
              firebaseUser.displayName
            );
            setGatePassed(false);
            setUser({
              ...removed,
              status: 'banned',
              approved: false,
              kycApproved: false,
              paymentApproved: false,
              subscriptionActive: false
            });
            return;
          }
          cacheUserProfile(next);
          setUser(projectUser(next, firebaseUser.email));
        });
      } catch (error) {
        if (!isCurrent()) return;
        // ensureUserDoc is fault tolerant and returns a fallback profile, so
        // reaching here means something truly unexpected broke. Keep the
        // session usable by projecting the auth account itself rather than
        // ejecting the user out of a successful sign-in.
        console.error('[auth] User profile resolution failed', error);
        setAuthError(
          'Your profile is still syncing. Some details may appear shortly.'
        );
        setUser(
          fallbackUserFromAuth(
            firebaseUser.uid,
            firebaseUser.email,
            firebaseUser.displayName
          )
        );
      } finally {
        if (isCurrent()) setLoading(false);
      }
    });

    return () => {
      authGenerationRef.current += 1;
      unsubscribeAuth();
      userUnsubRef.current?.();
      userUnsubRef.current = null;
      stopFirestoreSync();
    };
  }, [backendReady, setGatePassed]);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      gatePassed,
      backendReady,
      authError,
      signIn: (email, password) => {
        setAuthError(null);
        return signInWithEmail(email, password);
      },
      signUp: async (email, password, name) => {
        setAuthError(null);
        const passwordCheck = validatePassword(password);
        if (!passwordCheck.ok) {
          return {
            ok: false,
            error: passwordCheck.reason || 'Weak password'
          };
        }
        const result = await signUpWithEmail(email, password, name);
        if (result.ok && result.user) {
          // Profile creation must never reject the signup call — the auth
          // account already exists and the doc self-heals on next sign-in.
          try {
            await ensureUserDoc(result.user, { name });
          } catch (error) {
            console.error('[auth] Signup profile write failed', error);
          }
        }
        return result;
      },
      logout: async () => {
        authGenerationRef.current += 1;
        userUnsubRef.current?.();
        userUnsubRef.current = null;
        currentUidRef.current = null;
        stopFirestoreSync();
        clearLocalSessionCache();
        try {
          localStorage.removeItem(SESSION_UID_KEY);
          if (user?.uid) {
            sessionStorage.removeItem(
              `buller.risk-disclosure.session.${user.uid}`
            );
          }
        } catch {}
        setAuthError(null);
        setUser(null);
        setGatePassed(false);
        try {
          await signOutUser();
        } catch (error) {
          console.error('[auth] Firebase sign-out failed', error);
        }
      },
      sendReset: (email) => resetPassword(email),
      setGatePassed,
      clearAuthError,
      validatePassword,
      login: (email, name) => {
        if (backendReady) return;
        setUser(createOfflineUser(email, name));
      },
      signup: (email, name) => {
        if (backendReady) return;
        setUser(createOfflineUser(email, name));
      }
    }),
    [
    authError,
    backendReady,
    clearAuthError,
    gatePassed,
    loading,
    setGatePassed,
    user]

  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function projectUser(profile: FirestoreUser, authEmail: string | null): User {
  const normalizedEmail = (authEmail || profile.email || '').trim().toLowerCase();
  const isOwner = OWNER_EMAILS.has(normalizedEmail);
  const isSuperAdmin = isOwner || profile.role === 'super_admin';

  if (isSuperAdmin) {
    return {
      uid: profile.uid,
      email: profile.email,
      name: profile.name,
      role: 'super_admin',
      verified: true,
      status: 'active',
      approved: true,
      kycApproved: true,
      paymentApproved: true,
      subscriptionActive: true,
      expiresAt: undefined,
      maxDevices: 999
    };
  }

  return {
    uid: profile.uid,
    email: profile.email,
    name: profile.name,
    role: profile.role,
    verified: profile.verified,
    status: profile.status,
    approved: profile.approved ?? false,
    kycApproved: profile.kycApproved ?? false,
    paymentApproved: profile.paymentApproved ?? false,
    subscriptionActive: profile.subscriptionActive ?? false,
    expiresAt: profile.validityExpiresAt || profile.expiresAt,
    maxDevices: profile.maxDevices ?? 1
  };
}

function cacheUserProfile(profile: FirestoreUser) {
  cacheLocalRecord('users', {
    ...profile,
    id: profile.uid,
    role: profile.role,
    lastSeen: profile.lastLoginAt || profile.updatedAt || Date.now()
  } as any);
}

/**
 * Last-resort projection built purely from the auth account. Keeps the real
 * uid so writes still target the right document, and stays at the most
 * restricted role/approval shape so no access is ever granted by a failure.
 */
function fallbackUserFromAuth(
uid: string,
email: string | null,
displayName: string | null)
: User {
  const normalized = (email || '').trim().toLowerCase();
  const isOwner = OWNER_EMAILS.has(normalized);
  return {
    uid,
    email: normalized,
    name: displayName || normalized.split('@')[0] || 'User',
    role: isOwner ? 'super_admin' : 'user',
    verified: false,
    status: isOwner ? 'active' : 'pending',
    approved: isOwner,
    kycApproved: isOwner,
    paymentApproved: isOwner,
    subscriptionActive: isOwner,
    maxDevices: isOwner ? 999 : 1
  };
}

function createOfflineUser(email: string, name?: string): User {
  const normalized = email.trim().toLowerCase();
  const isOwner = OWNER_EMAILS.has(normalized);
  return {
    uid: `local-${normalized}`,
    email: normalized,
    name: name || normalized.split('@')[0],
    role: isOwner ? 'super_admin' : 'user',
    verified: false,
    status: 'active',
    approved: isOwner,
    kycApproved: isOwner,
    paymentApproved: isOwner,
    subscriptionActive: isOwner,
    maxDevices: isOwner ? 999 : 1
  };
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

export function useRole(): Role | null {
  return useAuth().user?.role || null;
}

export function useIsAdmin(): boolean {
  const role = useRole();
  return role === 'admin' || role === 'super_admin';
}

export function useIsSuperAdmin(): boolean {
  return useRole() === 'super_admin';
}