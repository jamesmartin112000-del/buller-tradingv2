import {
  fsCommitBatch,
  fsGet,
  fsList,
  where } from
'./docStore';
import { firebaseAuth } from '../firebase';
import type { DBUser, MasterKey } from '../db/store';
import { MAX_VALIDITY_HOURS, MIN_VALIDITY_HOURS } from '../../utils/validity';

const HOUR_MS = 3_600_000;
const KEY_PATTERN = /^AZH-TRD-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

export async function activateMasterKey(rawKey: string) {
  const current = firebaseAuth.currentUser;
  if (!current?.email) throw new Error('Please sign in again before activating access.');
  const enteredKey = rawKey.trim().toUpperCase();
  if (!KEY_PATTERN.test(enteredKey)) throw new Error('Invalid master key format.');

  const matches = await fsList<MasterKey>('master_keys', [
  where('key', '==', enteredKey),
  where('email', '==', current.email.trim().toLowerCase())]
  );
  const key = matches[0];
  if (!key) throw new Error('Invalid or expired master key.');

  const profile = await fsGet<DBUser>('users', current.uid);
  if (!profile) throw new Error('User profile not found.');
  const now = Date.now();
  const validityHours = Math.max(
    MIN_VALIDITY_HOURS,
    Math.min(MAX_VALIDITY_HOURS, Number(key.validityHours) || (Number(key.validityDays) || 30) * 24)
  );
  const validityDays = Math.max(1, Math.ceil(validityHours / 24));
  const usedAt = key.usedAt || now;
  const expiresAt = key.usedAt ?
  Number(key.validityExpiresAt || 0) :
  now + validityHours * HOUR_MS;
  const clockToleranceMs = 30 * 60_000;
  const isFreshActivation = !key.usedAt;
  if (
  isFreshActivation && (
  usedAt < now - clockToleranceMs || usedAt > now + clockToleranceMs))
  {
    throw new Error('Your device clock is out of sync. Correct it and request a fresh key.');
  }
  if (!expiresAt || expiresAt <= now) throw new Error('This master key has expired.');

  // The client path stays available when Vercel Functions are unavailable.
  // Production deployments may prefer /api/gate/activate: server-side
  // activation uses a trusted clock and eliminates client clock-skew issues.
  // Both writes are merge-delta operations so stored document fields,
  // including legacy `id` fields, remain untouched by strict rule diffs.
  await fsCommitBatch([
  {
    type: 'set',
    path: 'master_keys',
    id: key.id,
    data: {
      used: true,
      usedAt,
      validityExpiresAt: expiresAt
    },
    merge: true
  },
  {
    type: 'set',
    path: 'users',
    id: current.uid,
    data: {
      gateKeyId: key.id,
      approved: true,
      paymentApproved: true,
      paymentPending: false,
      subscriptionActive: true,
      status: 'active',
      validityDays,
      validityHours,
      validityStartedAt: usedAt,
      validityExpiresAt: expiresAt,
      expiresAt
    },
    merge: true
  }]
  );
  return { expiresAt, validityDays, validityHours };
}