import React, {
  useEffect,
  useMemo,
  useState,
  createContext,
  useContext } from
'react';
import { useAuth } from './AuthContext';
import { db, type DBUser } from '../lib/db/store';
import { subscribe } from '../lib/db/store';
/**
 * UserAccountContext — single source of truth for the current user's
 * account state (validity, KYC, device binding, lock status).
 *
 * Reactive: subscribes to the underlying users collection so admin
 * actions in another tab (or even in the same tab) reflect instantly.
 */
interface UserAccountState {
  dbUser: DBUser | null;
  // Derived flags
  isLocked: boolean;
  isExpired: boolean;
  isBanned: boolean;
  needsKyc: boolean;
  daysRemaining: number | null;
  hoursRemaining: number | null;
  // Device binding
  currentDeviceId: string;
  isDeviceMatched: boolean;
  deviceWarnings: number;
  // Actions
  refresh: () => void;
}
const Ctx = createContext<UserAccountState | null>(null);
const DEVICE_KEY = 'te.deviceId';
function getOrCreateDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id =
      'dev_' +
      Date.now().toString(36) +
      '_' +
      Math.random().toString(36).slice(2, 10);
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return 'dev_anon';
  }
}
export function UserAccountProvider({
  children


}: {children: React.ReactNode;}) {
  const { user } = useAuth();
  const [tick, setTick] = useState(0);
  const [now, setNow] = useState(Date.now());
  // Reactive: refresh whenever users OR devices collections change.
  // Subscribing to 'devices' is critical — device approvals by admin flip
  // a devices record to 'allowed', and isDeviceMatched is derived from
  // that collection. Without this, the warning screen lingered until the
  // 60s tick even after admin approved the device.
  useEffect(() => {
    const unsubUsers = subscribe('users', () => setTick((t) => t + 1));
    const unsubDevices = subscribe('devices', () => setTick((t) => t + 1));
    return () => {
      unsubUsers();
      unsubDevices();
    };
  }, []);
  // Tick every 60s for time-based expiry checks
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(id);
  }, []);
  const currentDeviceId = useMemo(() => getOrCreateDeviceId(), []);
  const dbUser = useMemo<DBUser | null>(() => {
    if (!user) return null;
    return db.list('users').find((u) => u.email === user.email) || null;
    // eslint-disable-next-line
  }, [user, tick]);
  // Recompute at the exact server-managed deadline. The minute interval above
  // remains a fallback for very long durations that exceed browser timer limits.
  useEffect(() => {
    const expiresAt = dbUser?.validityExpiresAt || dbUser?.expiresAt;
    if (!expiresAt) return;
    const delay = expiresAt - Date.now() + 50;
    if (delay <= 0) {
      setNow(Date.now());
      return;
    }
    if (delay > 2_147_000_000) return;
    const timeout = window.setTimeout(() => setNow(Date.now()), delay);
    return () => window.clearTimeout(timeout);
  }, [dbUser?.id, dbUser?.validityExpiresAt, dbUser?.expiresAt]);
  // Expiry is derived from the server-managed timestamp. Do not persist a
  // client-side lock: payment approval may extend expiry while status remains
  // active, and access-control fields are intentionally admin-only in rules.
  // Bind device on first login
  useEffect(() => {
    if (
    !dbUser ||
    !user ||
    user.role === 'admin' ||
    user.role === 'super_admin')

    return;
    // Get all devices for this user
    const userDevices = db.
    list('devices').
    filter((d) => d.userEmail === user.email && d.status === 'allowed').
    map((d) => d.deviceId);
    const uniqueDevices = Array.from(new Set(userDevices));
    const maxDevices = user.maxDevices || 1;
    // If this device isn't known yet
    if (!uniqueDevices.includes(currentDeviceId)) {
      if (uniqueDevices.length < maxDevices) {
        // We have room for this device
        db.insert('devices', {
          id: 'dlog_' + Date.now().toString(36),
          userEmail: user.email,
          deviceId: currentDeviceId,
          userAgent: navigator.userAgent,
          status: 'allowed',
          createdAt: Date.now()
        });
        db.log('info', 'device', `New device bound for ${user.email}`);
        // Update primary device if not set (for backwards compatibility)
        if (!dbUser.primaryDeviceId) {
          db.update('users', dbUser.id, {
            primaryDeviceId: currentDeviceId,
            activeDevices: uniqueDevices.length + 1
          });
        } else {
          db.update('users', dbUser.id, {
            activeDevices: uniqueDevices.length + 1
          });
        }
      } else {
        // Limit exceeded - log it as denied
        db.insert('devices', {
          id: 'dlog_' + Date.now().toString(36),
          userEmail: user.email,
          deviceId: currentDeviceId,
          userAgent: navigator.userAgent,
          status: 'denied',
          createdAt: Date.now()
        });
        db.log('warn', 'device', `Device limit exceeded for ${user.email}`);
      }
    }
  }, [dbUser, user, currentDeviceId]);
  const value = useMemo<UserAccountState>(() => {
    const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
    const isBanned = dbUser?.status === 'banned' || user?.status === 'banned';
    // The live Firestore profile is authoritative; AuthContext is a fallback
    // only while its listener is still hydrating.
    const expiresAt = dbUser?.validityExpiresAt || dbUser?.expiresAt || user?.expiresAt;
    const isExpired = !isAdmin && !!expiresAt && expiresAt <= now;
    // Lock ONLY when:
    //  1. Admin has explicitly locked the account (status === 'locked'), OR
    //  2. The user has a validity timestamp AND it has actually passed.
    //
    // We deliberately do NOT lock on missing approval/payment/subscription
    // flags here — those represent onboarding state, not "your account has
    // expired". The previous logic caused fresh-keyed users to see the red
    // "ACCOUNT LOCKED — validity expired" screen the moment they entered
    // the dashboard, because the master-key flow sets subscriptionActive
    // but the legacy flags (approved / paymentApproved) stayed false.
    const isLocked = !isAdmin && (dbUser?.status === 'locked' || isExpired);
    // Needs KYC unless verification is approved.
    //
    // Source of truth: kyc.status === 'approved' (admin decision) OR the
    // kycApproved flag on the user doc. Either being true grants access.
    // While 'pending' or 'rejected', the KYC modal stays up (the modal
    // itself shows "Under Review" vs the resubmission form based on status).
    const kycStatus = dbUser?.kyc?.status;
    const kycApproved = user?.kycApproved === true || kycStatus === 'approved';
    const needsKyc = !isAdmin && !!user && !kycApproved;
    const daysRemaining = expiresAt ?
    Math.max(0, Math.ceil((expiresAt - now) / 86400000)) :
    null;
    const hoursRemaining = expiresAt ?
    Math.max(0, Math.ceil((expiresAt - now) / 3600000)) :
    null;
    // Device matching logic - check if current device is in the allowed list
    let isDeviceMatched = true;
    if (!isAdmin && user) {
      const allowedDevices = db.
      list('devices').
      filter((d) => d.userEmail === user.email && d.status === 'allowed').
      map((d) => d.deviceId);
      if (allowedDevices.length > 0) {
        isDeviceMatched = allowedDevices.includes(currentDeviceId);
      } else {
        // Fallback to legacy primaryDeviceId if no device logs exist
        isDeviceMatched =
        !dbUser?.primaryDeviceId || dbUser.primaryDeviceId === currentDeviceId;
      }
    }
    return {
      dbUser,
      isLocked,
      isExpired,
      isBanned,
      needsKyc,
      daysRemaining,
      hoursRemaining,
      currentDeviceId,
      isDeviceMatched,
      deviceWarnings: dbUser?.deviceWarnings || 0,
      refresh: () => setTick((t) => t + 1)
    };
  }, [dbUser, user, now, currentDeviceId]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
function isExpiredNow(u: DBUser | null, now: number): boolean {
  if (!u) return false;
  if (u.role === 'admin' || u.role === 'super_admin') return false;
  if (!u.validityExpiresAt) return false;
  return u.validityExpiresAt < now;
}
export function useUserAccount() {
  const ctx = useContext(Ctx);
  if (!ctx)
  throw new Error('useUserAccount must be used within UserAccountProvider');
  return ctx;
}
/** Admin helpers — granting validity, approving payments etc. */
export function grantValidity(
userId: string,
days: number,
adminEmail: string)
{
  // Back-compat shim: preserve fractional days down to minute precision.
  return grantValidityHours(userId, days * 24, adminEmail);
}
/**
 * Preferred admin grant — accepts hours so 1h / 5h / 12h presets are
 * first-class. `grantValidity` above remains for back-compat.
 */
export function grantValidityHours(
userId: string,
hours: number,
adminEmail: string)
{
  const now = Date.now();
  const expiresAt = now + hours * 3600000;
  // Mark the user as fully approved + active in addition to the validity
  // window. Without these flags the previous lock logic (and any future
  // approval-driven gating) would consider the account "not yet approved"
  // even though admin/Gate just granted them paid time.
  db.update('users', userId, {
    validityDays: Math.max(1, Math.ceil(hours / 24)),
    validityHours: hours,
    validityStartedAt: now,
    validityExpiresAt: expiresAt,
    expiresAt: expiresAt,
    approved: true,
    paymentApproved: true,
    paymentPending: false,
    subscriptionActive: true,
    status: 'active'
  });
  const u = db.get('users', userId);
  db.log(
    'info',
    'validity',
    `Granted ${hours}h to ${u?.email} by ${adminEmail}`
  );
  if (u) {
    db.insert('notifications', {
      id: 'nt_' + Date.now().toString(36),
      target: 'user',
      targetEmail: u.email,
      title: 'Account activated',
      body: formatGrantMessage(hours),
      kind: 'success',
      read: false,
      createdAt: Date.now()
    });
  }
}
function formatGrantMessage(hours: number): string {
  if (hours < 24) {
    return `Your account has been activated for ${hours} hour${hours === 1 ? '' : 's'}. Happy trading!`;
  }
  const days = Math.round(hours / 24);
  return `Your account has been activated for ${days} day${days === 1 ? '' : 's'}. Happy trading!`;
}
export function lockUser(userId: string, reason: string) {
  db.update('users', userId, {
    status: 'locked'
  });
  const u = db.get('users', userId);
  db.log('warn', 'account', `Locked ${u?.email}: ${reason}`);
}
export function unlockUser(userId: string) {
  db.update('users', userId, {
    status: 'active'
  });
  const u = db.get('users', userId);
  db.log('info', 'account', `Unlocked ${u?.email}`);
}