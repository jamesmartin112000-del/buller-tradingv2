import { fsGet, fsUpdate } from '../backend/docStore';
import type { DBUser } from '../db/store';
import { MAX_VALIDITY_HOURS, MIN_VALIDITY_HOURS } from '../../utils/validity';

type AccountAction =
{action: 'kyc-review';userId: string;decision: 'approved' | 'rejected';note: string;} |
{action: 'status';userId: string;status: DBUser['status'];} |
{
  action: 'validity';
  userId: string;
  hours: number;
  mode: 'replace' | 'extend';
  expiresAt?: number;
};

interface ValidityOptions {
  mode?: 'replace' | 'extend';
  /** Exact timestamp used by the Admin "Specific expiry" control. */
  expiresAt?: number;
}

async function performAccountAction(input: AccountAction): Promise<DBUser> {
  const current = await fsGet<DBUser>('users', input.userId);
  if (!current) throw new Error('User profile not found.');
  if (current.role === 'super_admin') throw new Error('Super-admin accounts are protected.');

  const now = Date.now();
  let patch: Partial<DBUser>;
  if (input.action === 'kyc-review') {
    patch = {
      kycApproved: input.decision === 'approved',
      kyc: {
        ...(current.kyc || { status: 'none' }),
        status: input.decision,
        reviewedAt: now,
        reviewedBy: 'admin',
        rejectReason: input.decision === 'approved' ? null : input.note
      }
    };
  } else if (input.action === 'status') {
    patch = {
      status: input.status,
      ...(input.status === 'active' ? { deviceWarnings: 0 } : {})
    };
  } else {
    if (!Number.isFinite(input.hours) || input.hours < MIN_VALIDITY_HOURS || input.hours > MAX_VALIDITY_HOURS) {
      throw new Error('Validity must be between 1 minute and 10 years.');
    }
    const exactExpiry = Number(input.expiresAt || 0);
    if (exactExpiry && (!Number.isFinite(exactExpiry) || exactExpiry <= now)) {
      throw new Error('Specific expiry must be in the future.');
    }
    const base = input.mode === 'extend' ?
    Math.max(now, Number(current.expiresAt || current.validityExpiresAt || 0)) :
    now;
    const expiresAt = exactExpiry || base + input.hours * 3_600_000;
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
      status: 'active'
    };
  }

  await fsUpdate('users', input.userId, { ...patch, updatedAt: now });
  return { ...current, ...patch, updatedAt: now };
}

export function reviewUserKyc(
userId: string,
decision: 'approved' | 'rejected',
note: string)
{
  return performAccountAction({ action: 'kyc-review', userId, decision, note });
}

export function setManagedUserStatus(userId: string, status: DBUser['status']) {
  return performAccountAction({ action: 'status', userId, status });
}

export function grantManagedUserValidity(
userId: string,
hours: number,
options: ValidityOptions = {})
{
  return performAccountAction({
    action: 'validity',
    userId,
    hours,
    mode: options.mode || 'replace',
    expiresAt: options.expiresAt
  });
}