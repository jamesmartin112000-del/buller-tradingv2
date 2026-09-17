import {
  cacheLocalRecord,
  db,
  uid as genId,
  type Notification,
  type PaymentProof } from
'../db/store';
import { fsSet } from '../backend/docStore';
import { planDaysFor } from '../data/plans';
import { firebaseAuth } from '../firebase';

export function planDays(planIdOrName?: string | null): number {
  if (!planIdOrName) return 30;
  const key = planIdOrName.trim().toLowerCase();
  const stored = db.list('plans').find((plan) => {
    const id = plan.id.replace(/^plan_/, '').toLowerCase();
    return id === key || plan.name.trim().toLowerCase() === key;
  });
  if (stored) {
    if (stored.durationUnit === 'years') return stored.durationCount * 365;
    if (stored.durationUnit === 'months') return stored.durationCount * 30;
    return stored.durationCount;
  }
  return planDaysFor(planIdOrName);
}

export interface CreatePaymentInput {
  userId?: string | null;
  email: string;
  userName?: string | null;
  whatsapp?: string | null;
  planId?: string | null;
  planName: string;
  amount: number;
  currency?: string;
  paymentMethod?: string;
  network?: string;
  walletAddress?: string;
  txid?: string;
  proofUrl: string;
}

export async function createPaymentRecord(
input: CreatePaymentInput)
: Promise<PaymentProof> {
  if (!input.userId) {
    throw new Error('Please sign in again before submitting your payment.');
  }
  const id = genId('pay');
  const now = Date.now();
  const email = input.email.trim().toLowerCase();
  const record: PaymentProof = {
    id,
    userId: input.userId,
    email,
    userName: input.userName ?? null,
    whatsapp: input.whatsapp ?? null,
    planId: input.planId ?? null,
    plan: input.planName,
    amount: input.amount,
    currency: input.currency || 'USDT',
    paymentMethod: input.paymentMethod || 'crypto',
    network: input.network || '',
    walletAddress: input.walletAddress || '',
    proofUrl: input.proofUrl,
    txid: (input.txid || '').trim(),
    status: 'pending',
    adminNotes: null,
    validityDaysGranted: planDays(input.planId || input.planName),
    createdAt: now,
    updatedAt: now
  };
  await fsSet('payment_proofs', record, false);
  cacheLocalRecord('paymentProofs', record);

  const notification: Notification = {
    id: genId('nt'),
    target: 'admin',
    title: '💰 New payment proof',
    body: `${email} submitted a ${input.planName} payment (${input.amount} ${record.currency} · ${record.network || 'crypto'}). Review in Payments.`,
    kind: 'info',
    read: false,
    createdAt: now,
    link: '/app/admin/payments'
  };
  try {
    await fsSet('notifications', notification, false);
    cacheLocalRecord('notifications', notification);
  } catch (error) {
    // The proof is already safely stored and visible in Admin Payments. Do not
    // report a false submission failure or encourage a duplicate proof.
    console.warn('[payments] Admin notification unavailable; proof remains recorded', error);
  }
  return record;
}

export function listPayments(
status?: 'pending' | 'verified' | 'rejected' | 'all')
: PaymentProof[] {
  const all = (db.list('paymentProofs') as PaymentProof[]).slice();
  all.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  if (!status || status === 'all') return all;
  return all.filter((payment) => payment.status === status);
}

export function getPaymentById(id: string): PaymentProof | undefined {
  return (db.list('paymentProofs') as PaymentProof[]).find((payment) => payment.id === id);
}

export interface AdminActionInput {
  adminId?: string;
  adminNotes?: string;
}

async function reviewPayment(
paymentId: string,
action: 'approve' | 'reject',
{ adminNotes }: AdminActionInput)
: Promise<{ok: boolean;message: string;}> {
  const current = firebaseAuth.currentUser;
  if (!current) throw new Error('Admin session expired. Please sign in again.');
  const token = await current.getIdToken();
  const response = await fetch('/api/admin/payments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ paymentId, action, adminNotes: adminNotes?.trim() || '' })
  });
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    email?: string;
    status?: 'verified' | 'rejected';
  };
  if (!response.ok) throw new Error(payload.error || 'Payment review could not be completed.');
  return {
    ok: true,
    message: payload.status === 'verified' ?
    `Verified & activated ${payload.email || 'user'}` :
    'Payment rejected.'
  };
}

export function approvePayment(paymentId: string, input: AdminActionInput = {}) {
  return reviewPayment(paymentId, 'approve', input);
}

export function rejectPayment(paymentId: string, input: AdminActionInput = {}) {
  return reviewPayment(paymentId, 'reject', input);
}