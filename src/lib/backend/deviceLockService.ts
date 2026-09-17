/**
 * Device Lock Service (V2) — Supabase-backed single-device enforcement.
 *
 * ALL security-critical state lives in the Supabase document store.
 * localStorage is NEVER used for device-lock state.
 *
 * Document layout:
 *   users/{uid}.deviceLock = {
 *     activeDeviceId, warnings, isLocked, lockedAt, lastLoginAt
 *   }
 *   users/{uid}/devices/{deviceId} = {
 *     deviceId, platform, browser, fingerprint, isActive,
 *     registeredAt, lastActive
 *   }
 *   deviceChangeRequests/{requestId} = {
 *     userId, email, currentDeviceId, newDeviceId, newFingerprint,
 *     reason, status, createdAt, resolvedAt, adminNote
 *   }
 *
 * NOTE: We store timestamps as millisecond numbers (Date.now()). The shared
 * docStore write layer deep-strips `undefined`, and numbers are the safe,
 * consistent convention here.
 */
import {
  fsGet,
  fsSet,
  fsUpdate,
  fsList,
  fsSubscribe,
  fsSubscribeDoc,
  where,
  orderBy } from
'./docStore';
import { firebaseAuth, isFirebaseReady } from '../firebase';
import {
  signInWithEmailAndPassword,
  signOut as fbSignOut } from
'@firebase/auth';
import {
  getDeviceFingerprint,
  type DeviceFingerprint } from
'../deviceFingerprint';

const USERS = 'users';
const REQUESTS = 'deviceChangeRequests';
const devicesPath = (uid: string) => `${USERS}/${uid}/devices`;

// ─── TYPES ───────────────────────────────────────────────────────────
export interface DeviceLock {
  activeDeviceId: string | null;
  warnings: number;
  isLocked: boolean;
  lockedAt: number | null;
  lastLoginAt: number | null;
  /** When true, NO device rules apply to this user — unlimited devices.
   *  Only their account validity (expiry) is enforced elsewhere. */
  unlimitedDevices?: boolean;
}

export interface DeviceRecord {
  id: string;
  deviceId: string;
  platform: string;
  browser: string;
  fingerprint: DeviceFingerprint;
  isActive: boolean;
  registeredAt: number;
  lastActive: number;
}

export interface DeviceChangeRequest {
  id: string;
  userId: string;
  email: string;
  currentDeviceId: string;
  newDeviceId: string;
  newFingerprint: DeviceFingerprint;
  reason: string;
  /** Distinguishes an account-unlock request from a device-change request. */
  requestType: 'unlock' | 'device_change';
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
  resolvedAt: number | null;
  adminNote: string;
}

export type DeviceEvalState = 'allowed' | 'blocked' | 'locked' | 'error';

export interface DeviceEvalResult {
  state: DeviceEvalState;
  warnings: number;
  maxWarnings: number;
  isLocked: boolean;
  needsRequest: boolean;
  warning: string | null;
  fingerprint: DeviceFingerprint | null;
}

export const MAX_WARNINGS = 3;

const DEFAULT_LOCK: DeviceLock = {
  activeDeviceId: null,
  warnings: 0,
  isLocked: false,
  lockedAt: null,
  lastLoginAt: null,
  unlimitedDevices: false
};

// ─── DEVICE METADATA HELPERS ─────────────────────────────────────────
export function deriveBrowser(ua: string = navigator.userAgent): string {
  if (ua.includes('Edg')) return 'Edge';
  if (ua.includes('OPR') || ua.includes('Opera')) return 'Opera';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari')) return 'Safari';
  return 'Unknown';
}

export function derivePlatform(
ua: string = navigator.userAgent,
fallback = 'Unknown')
: string {
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Mac OS X|Macintosh/i.test(ua)) return 'macOS';
  if (/Android/i.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Linux/i.test(ua)) return 'Linux';
  return fallback;
}

export async function generateFingerprint(): Promise<DeviceFingerprint> {
  console.log('[deviceLock] generating fingerprint…');
  const fp = await getDeviceFingerprint();
  console.log('[deviceLock] fingerprint generated', {
    id: fp.id.slice(0, 16) + '…',
    platform: fp.platform
  });
  return fp;
}

// ─── READ DEVICE LOCK ────────────────────────────────────────────────
export async function getDeviceLock(uid: string): Promise<DeviceLock> {
  try {
    const doc = await fsGet<any>(USERS, uid);
    const lock = doc?.deviceLock as DeviceLock | undefined;
    return { ...DEFAULT_LOCK, ...(lock || {}) };
  } catch (err) {
    console.warn('[deviceLock] getDeviceLock failed', err);
    return { ...DEFAULT_LOCK };
  }
}

/** Real-time subscription to a user's deviceLock object. */
export function subscribeDeviceLock(
uid: string,
cb: (lock: DeviceLock) => void)
{
  return fsSubscribeDoc<any>(
    USERS,
    uid,
    (doc) => {
      const lock = doc?.deviceLock as DeviceLock || DEFAULT_LOCK;
      cb({ ...DEFAULT_LOCK, ...lock });
    },
    (err) => console.warn('[deviceLock] subscribeDeviceLock error', err)
  );
}

// ─── REGISTER A DEVICE DOC ───────────────────────────────────────────
async function writeDeviceDoc(
uid: string,
fp: DeviceFingerprint,
isActive: boolean)
{
  const record: DeviceRecord = {
    id: fp.id,
    deviceId: fp.id,
    platform: derivePlatform(fp.userAgent, fp.platform),
    browser: deriveBrowser(fp.userAgent),
    fingerprint: fp,
    isActive,
    registeredAt: Date.now(),
    lastActive: Date.now()
  };
  await fsSet(devicesPath(uid), record, true);
}

// ─── EVALUATE DEVICE ACCESS (CASE 1 / 2 / 3) ─────────────────────────
export async function evaluateDevice(
uid: string,
email: string,
fp: DeviceFingerprint)
: Promise<DeviceEvalResult> {
  console.log('[deviceLock] evaluateDevice', {
    uid,
    email,
    deviceId: fp.id.slice(0, 16) + '…'
  });

  const lock = await getDeviceLock(uid);
  console.log('[deviceLock] current lock state', lock);

  // UNLIMITED DEVICES — no rules apply. Always allow, never warn or lock.
  if (lock.unlimitedDevices) {
    console.log('[deviceLock] unlimitedDevices enabled → always allowed');
    await fsUpdate(USERS, uid, {
      'deviceLock.lastLoginAt': Date.now()
    }).catch(() => {});
    await writeDeviceDoc(uid, fp, true).catch(() => {});
    return ok(0, fp);
  }

  // Already locked → block immediately.
  if (lock.isLocked) {
    console.warn('[deviceLock] account is LOCKED');
    return {
      state: 'locked',
      warnings: lock.warnings,
      maxWarnings: MAX_WARNINGS,
      isLocked: true,
      needsRequest: false,
      warning:
      'Account temporarily locked due to repeated unauthorized device access.',
      fingerprint: fp
    };
  }

  // CASE 1 — no device registered → register this one.
  if (!lock.activeDeviceId) {
    console.log('[deviceLock] CASE 1: no active device → registering');
    await fsUpdate(USERS, uid, {
      'deviceLock.activeDeviceId': fp.id,
      'deviceLock.warnings': 0,
      'deviceLock.isLocked': false,
      'deviceLock.lockedAt': null,
      'deviceLock.lastLoginAt': Date.now()
    });
    await writeDeviceDoc(uid, fp, true);
    return ok(0, fp);
  }

  // CASE 2 — same device → allow, refresh lastActive.
  if (lock.activeDeviceId === fp.id) {
    console.log('[deviceLock] CASE 2: same device → allowed');
    await fsUpdate(USERS, uid, { 'deviceLock.lastLoginAt': Date.now() });
    await writeDeviceDoc(uid, fp, true).catch(() => {});
    return ok(lock.warnings, fp);
  }

  // CASE 3 — different device → DO NOT LOGIN, increment warnings.
  const warnings = (lock.warnings || 0) + 1;
  console.warn('[deviceLock] CASE 3: different device → warning', {
    warnings,
    max: MAX_WARNINGS
  });

  if (warnings >= MAX_WARNINGS) {
    await fsUpdate(USERS, uid, {
      'deviceLock.warnings': warnings,
      'deviceLock.isLocked': true,
      'deviceLock.lockedAt': Date.now()
    });
    console.warn('[deviceLock] max warnings reached → ACCOUNT LOCKED');
    return {
      state: 'locked',
      warnings,
      maxWarnings: MAX_WARNINGS,
      isLocked: true,
      needsRequest: false,
      warning: `Warning ${warnings}/${MAX_WARNINGS} — Account temporarily locked.`,
      fingerprint: fp
    };
  }

  await fsUpdate(USERS, uid, { 'deviceLock.warnings': warnings });
  return {
    state: 'blocked',
    warnings,
    maxWarnings: MAX_WARNINGS,
    isLocked: false,
    needsRequest: true,
    warning: `Warning ${warnings}/${MAX_WARNINGS} — Unauthorized device detected. Submit a Device Change Request.`,
    fingerprint: fp
  };
}

function ok(warnings: number, fp: DeviceFingerprint): DeviceEvalResult {
  return {
    state: 'allowed',
    warnings,
    maxWarnings: MAX_WARNINGS,
    isLocked: false,
    needsRequest: false,
    warning: null,
    fingerprint: fp
  };
}

// ─── PASSWORD VERIFICATION (Supabase Auth) ───────────────────────────
/**
 * Validates the account password WITHOUT granting a session on an
 * unauthorized device.
 * - If the matching user is already signed in → signInWithPassword acts as
 *   a reauthentication for the same account (session refreshed, harmless).
 * - Otherwise → signInWithPassword to validate, capture the uid, then sign
 *   out again so no session is left on the unauthorized device.
 *
 * Returns the uid on success, or throws with a user-friendly message.
 */
export async function verifyPasswordAndGetUid(
email: string,
password: string)
: Promise<string> {
  if (!isFirebaseReady())
  throw new Error('Authentication is not available right now.');

  const normalized = email.trim().toLowerCase();
  const current = firebaseAuth.currentUser;
  const hadMatchingSession =
  !!current && (current.email || '').toLowerCase() === normalized;

  console.log('[deviceLock] verifying password via Firebase sign-in');
  try {
    const cred = await signInWithEmailAndPassword(
      firebaseAuth,
      normalized,
      password
    );
    const uid = cred.user?.uid;
    if (!uid) throw new Error('Could not verify password. Please try again.');

    // We only needed to validate credentials + capture uid. Do not leave a
    // session on this (unauthorized) device unless one already existed for
    // this same account.
    if (!hadMatchingSession) {
      await fbSignOut(firebaseAuth).catch(() => {});
    }
    return uid;
  } catch (err: any) {
    const code = (err?.code || '').toLowerCase();
    if (
    code.includes('wrong-password') ||
    code.includes('invalid-credential') ||
    code.includes('user-not-found'))
    {
      throw new Error('Incorrect password.');
    }
    if (code.includes('too-many-requests')) {
      throw new Error('Too many attempts. Please wait a minute and retry.');
    }
    throw new Error('Could not verify password. Please try again.');
  }
}

// ─── SUBMIT DEVICE CHANGE REQUEST ────────────────────────────────────
export async function submitDeviceChangeRequest(params: {
  uid: string;
  email: string;
  newFingerprint: DeviceFingerprint;
  reason: string;
  requestType?: 'unlock' | 'device_change';
}): Promise<{success: boolean;message: string;requestId?: string;}> {
  const {
    uid,
    email,
    newFingerprint,
    reason,
    requestType = 'device_change'
  } = params;
  console.log('[deviceLock] submitDeviceChangeRequest', {
    uid,
    newDeviceId: newFingerprint.id.slice(0, 16) + '…'
  });

  // Prevent duplicate pending requests for the same device.
  try {
    const existing = await fsList<DeviceChangeRequest>(REQUESTS, [
    where('userId', '==', uid),
    where('newDeviceId', '==', newFingerprint.id),
    where('status', '==', 'pending')]
    );
    if (existing.length > 0) {
      return {
        success: false,
        message:
        'A request for this device is already pending. Please wait for admin review.',
        requestId: existing[0].id
      };
    }
  } catch (err) {
    console.warn('[deviceLock] duplicate-check query failed (continuing)', err);
  }

  const lock = await getDeviceLock(uid);
  const id = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const request: DeviceChangeRequest = {
    id,
    userId: uid,
    email: email.trim().toLowerCase(),
    currentDeviceId: lock.activeDeviceId || '',
    newDeviceId: newFingerprint.id,
    newFingerprint,
    reason: reason.trim(),
    requestType,
    status: 'pending',
    createdAt: Date.now(),
    resolvedAt: null,
    adminNote: ''
  };

  try {
    await fsSet(REQUESTS, request, true);
    console.log('[deviceLock] request created', id);
    return {
      success: true,
      message:
      'Your request has been submitted. Admin will review your request. You will receive an update within 24 hours via WhatsApp.',
      requestId: id
    };
  } catch (err) {
    console.error('[deviceLock] failed to create request', err);
    return {
      success: false,
      message: 'Could not submit request. Please try again.'
    };
  }
}

// ─── FIND A PENDING REQUEST FOR THIS DEVICE (read-only, no warnings) ─
/**
 * Checks whether the user already has a PENDING device-change request for
 * the given device. Pure read — never mutates warnings or lock state, so
 * it is safe to call on every guard render.
 */
export async function findPendingRequestForDevice(
uid: string,
deviceId: string)
: Promise<DeviceChangeRequest | null> {
  try {
    const rows = await fsList<DeviceChangeRequest>(REQUESTS, [
    where('userId', '==', uid),
    where('newDeviceId', '==', deviceId),
    where('status', '==', 'pending')]
    );
    return rows[0] || null;
  } catch (err) {
    console.warn('[deviceLock] findPendingRequestForDevice failed', err);
    return null;
  }
}

// ─── ADMIN: SUBSCRIBE PENDING REQUESTS (REAL-TIME) ───────────────────
export function subscribePendingRequests(
cb: (rows: DeviceChangeRequest[]) => void)
{
  return fsSubscribe<DeviceChangeRequest>(
    REQUESTS,
    cb,
    [where('status', '==', 'pending'), orderBy('createdAt', 'desc')],
    (err) => console.warn('[deviceLock] pending requests stream error', err)
  );
}

// ─── ADMIN: APPROVE ──────────────────────────────────────────────────
export async function approveRequest(
req: DeviceChangeRequest)
: Promise<{success: boolean;message: string;}> {
  console.log('[deviceLock] approveRequest', req.id);
  try {
    // Activate the new device on the user's lock + reset warnings/lock.
    await fsUpdate(USERS, req.userId, {
      'deviceLock.activeDeviceId': req.newDeviceId,
      'deviceLock.warnings': 0,
      'deviceLock.isLocked': false,
      'deviceLock.lockedAt': null
    });

    // Deactivate the old device doc (best-effort).
    if (req.currentDeviceId) {
      await fsUpdate(devicesPath(req.userId), req.currentDeviceId, {
        isActive: false,
        lastActive: Date.now()
      }).catch(() => {});
    }

    // Activate / create the new device doc.
    await writeDeviceDoc(req.userId, req.newFingerprint, true);

    // Resolve the request.
    await fsUpdate(REQUESTS, req.id, {
      status: 'approved',
      resolvedAt: Date.now()
    });

    console.log('[deviceLock] request approved + device switched', req.id);
    return { success: true, message: 'Device change approved.' };
  } catch (err) {
    console.error('[deviceLock] approveRequest failed', err);
    return { success: false, message: 'Approval failed. Please retry.' };
  }
}

// ─── ADMIN: REJECT ───────────────────────────────────────────────────
export async function rejectRequest(
reqId: string,
adminNote: string)
: Promise<{success: boolean;message: string;}> {
  console.log('[deviceLock] rejectRequest', reqId);
  try {
    await fsUpdate(REQUESTS, reqId, {
      status: 'rejected',
      resolvedAt: Date.now(),
      adminNote: adminNote.trim() || 'Rejected by admin.'
    });
    return { success: true, message: 'Request rejected.' };
  } catch (err) {
    console.error('[deviceLock] rejectRequest failed', err);
    return { success: false, message: 'Rejection failed. Please retry.' };
  }
}

// ─── ADMIN: UNLOCK / UNBAN ACCOUNT (clears deviceLock) ────────────────
export async function adminUnlockAccount(
uid: string)
: Promise<{success: boolean;message: string;}> {
  console.log('[deviceLock] adminUnlockAccount', uid);
  try {
    await fsUpdate(USERS, uid, {
      'deviceLock.warnings': 0,
      'deviceLock.isLocked': false,
      'deviceLock.lockedAt': null
    });
    return { success: true, message: 'Account unlocked.' };
  } catch (err) {
    console.error('[deviceLock] adminUnlockAccount failed', err);
    return { success: false, message: 'Unlock failed. Please retry.' };
  }
}

// ─── ADMIN: REMOVE DEVICE (clears active device → next login auto-registers) ──
/**
 * Fully removes the user's registered device:
 *  - Clears deviceLock.activeDeviceId → the NEXT device the user logs in on
 *    hits CASE 1 in evaluateDevice() and is auto-registered.
 *  - Resets warnings and unlocks the account.
 *  - Deactivates the previously-registered device doc (best-effort).
 *  - Resolves any pending requests for this user as approved.
 */
export async function adminRemoveDevice(
uid: string,
previousDeviceId?: string)
: Promise<{success: boolean;message: string;}> {
  console.log('[deviceLock] adminRemoveDevice', uid, previousDeviceId);
  try {
    const lock = await getDeviceLock(uid);
    const oldId = previousDeviceId || lock.activeDeviceId || '';

    await fsUpdate(USERS, uid, {
      'deviceLock.activeDeviceId': null,
      'deviceLock.warnings': 0,
      'deviceLock.isLocked': false,
      'deviceLock.lockedAt': null
    });

    // Deactivate the old device doc (best-effort).
    if (oldId) {
      await fsUpdate(devicesPath(uid), oldId, {
        isActive: false,
        lastActive: Date.now()
      }).catch(() => {});
    }

    // Auto-resolve any pending requests for this user.
    try {
      const pending = await fsList<DeviceChangeRequest>(REQUESTS, [
      where('userId', '==', uid),
      where('status', '==', 'pending')]
      );
      await Promise.all(
        pending.map((r) =>
        fsUpdate(REQUESTS, r.id, {
          status: 'approved',
          resolvedAt: Date.now(),
          adminNote: 'Device removed — user may re-register on next login.'
        }).catch(() => {})
        )
      );
    } catch (err) {
      console.warn(
        '[deviceLock] adminRemoveDevice: resolve pending failed',
        err
      );
    }

    return {
      success: true,
      message:
      'Device removed & account unlocked. The next device the user logs in on will be auto-registered.'
    };
  } catch (err) {
    console.error('[deviceLock] adminRemoveDevice failed', err);
    return { success: false, message: 'Remove device failed. Please retry.' };
  }
}

// ─── ADMIN: TOGGLE UNLIMITED DEVICES ─────────────────────────────────
/**
 * When enabled, the user is exempt from ALL device rules: unlimited
 * devices, no warnings, never locked by the device system. Only their
 * account validity still applies. Enabling also clears any existing
 * warnings/lock so the user gets a clean slate immediately.
 */
export async function adminSetUnlimitedDevices(
uid: string,
enabled: boolean)
: Promise<{success: boolean;message: string;}> {
  console.log('[deviceLock] adminSetUnlimitedDevices', uid, enabled);
  try {
    if (enabled) {
      await fsUpdate(USERS, uid, {
        'deviceLock.unlimitedDevices': true,
        'deviceLock.warnings': 0,
        'deviceLock.isLocked': false,
        'deviceLock.lockedAt': null
      });
      // Resolve any pending requests — they're moot now.
      try {
        const pending = await fsList<DeviceChangeRequest>(REQUESTS, [
        where('userId', '==', uid),
        where('status', '==', 'pending')]
        );
        await Promise.all(
          pending.map((r) =>
          fsUpdate(REQUESTS, r.id, {
            status: 'approved',
            resolvedAt: Date.now(),
            adminNote: 'Unlimited devices granted — request auto-approved.'
          }).catch(() => {})
          )
        );
      } catch {}
      return {
        success: true,
        message:
        'Unlimited devices ENABLED. No device rules apply to this user — only account validity.'
      };
    }
    await fsUpdate(USERS, uid, {
      'deviceLock.unlimitedDevices': false
    });
    return {
      success: true,
      message:
      'Unlimited devices DISABLED. Standard single-device rules apply again from the next login.'
    };
  } catch (err) {
    console.error('[deviceLock] adminSetUnlimitedDevices failed', err);
    return { success: false, message: 'Could not update. Please retry.' };
  }
}

// ─── ADMIN: READ A USER'S CURRENT / REGISTERED DEVICE ────────────────
export async function getUserDevices(uid: string): Promise<DeviceRecord[]> {
  try {
    const rows = await fsList<DeviceRecord>(devicesPath(uid), [
    orderBy('lastActive', 'desc')]
    );
    return rows;
  } catch (err) {
    console.warn('[deviceLock] getUserDevices failed', err);
    return [];
  }
}

// ─── ADMIN: ALL REQUESTS (history, one-shot) ─────────────────────────
export async function listAllRequests(): Promise<DeviceChangeRequest[]> {
  try {
    return await fsList<DeviceChangeRequest>(REQUESTS, [
    orderBy('createdAt', 'desc')]
    );
  } catch (err) {
    console.warn('[deviceLock] listAllRequests failed', err);
    return [];
  }
}

// ─── ADMIN: RESET ALL USERS (clear every lock / warning / device) ────
/**
 * Full system reset:
 *  - Every user: warnings → 0, unlocked, active device cleared
 *    (next login auto-registers whatever device they use).
 *  - All pending device-change requests resolved as approved.
 *  - unlimitedDevices flags are preserved as-is.
 * Enforcement resumes normally AFTER the reset — rules only re-apply
 * when someone breaks them again.
 */
export async function adminResetAllDeviceLocks(): Promise<{
  success: boolean;
  message: string;
  usersReset: number;
}> {
  console.warn('[deviceLock] adminResetAllDeviceLocks — FULL RESET');
  try {
    const users = await fsList<any>(USERS, []);
    let count = 0;
    for (const u of users) {
      if (!u?.id) continue;
      try {
        await fsUpdate(USERS, u.id, {
          'deviceLock.activeDeviceId': null,
          'deviceLock.warnings': 0,
          'deviceLock.isLocked': false,
          'deviceLock.lockedAt': null
        });
        count++;
      } catch (err) {
        console.warn('[deviceLock] reset failed for user', u.id, err);
      }
    }
    // Resolve every pending request.
    try {
      const pending = await fsList<DeviceChangeRequest>(REQUESTS, [
      where('status', '==', 'pending')]
      );
      await Promise.all(
        pending.map((r) =>
        fsUpdate(REQUESTS, r.id, {
          status: 'approved',
          resolvedAt: Date.now(),
          adminNote: 'System reset — all locks cleared by admin.'
        }).catch(() => {})
        )
      );
    } catch {}
    return {
      success: true,
      message: `Reset complete. ${count} user(s) cleared — no locks, no warnings, no device errors. Next login auto-registers each user's device.`,
      usersReset: count
    };
  } catch (err) {
    console.error('[deviceLock] adminResetAllDeviceLocks failed', err);
    return {
      success: false,
      message: 'Reset failed. Please retry.',
      usersReset: 0
    };
  }
}