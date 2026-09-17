import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckIcon,
  XIcon,
  KeyRoundIcon,
  CopyIcon,
  PlusIcon,
  MonitorIcon,
  CreditCardIcon,
  IdCardIcon,
  CalendarIcon,
  Trash2Icon,
  ShieldCheckIcon,
  ShieldOffIcon,
  SearchIcon } from
'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useCollection } from '../../lib/db/hooks';
import {
  cacheLocalRecord,
  db,
  generateMasterKey,
  uid,
  type PaymentSubmission,
  type DBUser,
  type MasterKey,
  persistRecord,
  deletePersistentRecord } from
'../../lib/db/store';
import {
  grantManagedUserValidity,
  reviewUserKyc } from
'../../lib/admin/accountManagement';
import {
  durationToHours,
  formatValidityHours,
  MAX_VALIDITY_HOURS,
  MIN_VALIDITY_HOURS,
  type ValidityUnit } from
'../../utils/validity';
import {
  subscribePendingRequests,
  listAllRequests,
  approveRequest,
  rejectRequest,
  adminUnlockAccount,
  type DeviceChangeRequest } from
'../../lib/backend/deviceLockService';
/** Format the stored hour duration, including minute and month precision. */
function formatHours(hours: number): string {
  return formatValidityHours(hours);
}
/** Validity presets shown as quick-set buttons in the admin payment review. */
const VALIDITY_PRESETS: {
  hours: number;
  label: string;
}[] = [
{ hours: 0.25, label: '15 minutes' },
{ hours: 0.5, label: '30 minutes' },
{
  hours: 1,
  label: '1 hour'
},
{
  hours: 5,
  label: '5 hours'
},
{
  hours: 12,
  label: '12 hours'
},
{
  hours: 24,
  label: '1 day'
},
{
  hours: 48,
  label: '2 days'
},
{
  hours: 168,
  label: '7 days'
},
{
  hours: 720,
  label: '1 month'
},
{
  hours: 2160,
  label: '3 months'
}];

// ============================================================
// KYC REVIEW TAB
// ============================================================
export function KycReviewTab({ adminEmail }: {adminEmail: string;}) {
  const users = useCollection('users');
  const pending = users.filter((u) => u.kyc?.status === 'pending');
  const reviewed = users.filter(
    (u) =>
    u.kyc && (u.kyc.status === 'approved' || u.kyc.status === 'rejected')
  );
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [q, setQ] = useState('');
  const [viewing, setViewing] = useState<DBUser | null>(null);
  const base = filter === 'pending' ? pending : [...pending, ...reviewed];
  const list = base.filter((u) => {
    if (!q.trim()) return true;
    const needle = q.trim().toLowerCase();
    return (
      u.email.toLowerCase().includes(needle) ||
      u.name.toLowerCase().includes(needle) ||
      (u.kyc?.fullName || '').toLowerCase().includes(needle) ||
      (u.kyc?.docNumber || '').toLowerCase().includes(needle));

  });
  const decide = async (
  u: DBUser,
  decision: 'approved' | 'rejected',
  note: string) =>
  {
    if (!u.kyc) return;
    try {
      const updated = await reviewUserKyc(u.id, decision, note);
      cacheLocalRecord('users', updated);
      db.insert('notifications', {
        id: uid('nt'),
        target: 'user',
        targetEmail: u.email,
        title: decision === 'approved' ? 'KYC approved' : 'KYC needs attention',
        body:
        decision === 'approved' ?
        'Your identity has been verified. You now have full access.' :
        `Your KYC was rejected. Reason: ${note || 'Please resubmit with clearer documents.'}`,
        kind: decision === 'approved' ? 'success' : 'warn',
        read: false,
        createdAt: Date.now()
      });
      db.log('info', 'kyc', `${decision} KYC for ${u.email}`);
      toast.success(
        decision === 'approved' ?
        `Approved KYC for ${u.email}` :
        `Rejected KYC for ${u.email}`
      );
      setViewing(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'KYC review failed.');
    }
  };
  return (
    <div className="bg-bg-600 border border-line rounded-md">
      <div className="p-3 border-b border-line flex items-center gap-2 flex-wrap">
        <div className="text-2xs uppercase tracking-wider text-ink-muted font-bold">
          Filter:
        </div>
        {(['pending', 'all'] as const).map((f) =>
        <button
          key={f}
          onClick={() => setFilter(f)}
          className={`px-2.5 py-1 rounded text-2xs uppercase font-bold tracking-wider transition-colors ${filter === f ? 'bg-brand text-white' : 'bg-bg-700 text-ink-muted hover:text-ink border border-line'}`}>
          
            {f}{' '}
            {f === 'pending' && pending.length > 0 ? `(${pending.length})` : ''}
          </button>
        )}
        <div className="ml-auto flex items-center gap-2 bg-bg-700 border border-line rounded px-3 py-1.5 min-w-[200px]">
          <SearchIcon className="w-3.5 h-3.5 text-ink-dim shrink-0" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, doc #..."
            className="bg-transparent text-xs outline-none flex-1" />
          
        </div>
      </div>

      <div className="divide-y divide-line">
        {list.map((u) =>
        <div key={u.id} className="p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-bg-700 border border-line overflow-hidden shrink-0">
              {u.kyc?.selfieUrl || u.kyc?.selfieDataUrl ?
            <img
              src={u.kyc?.selfieUrl || u.kyc?.selfieDataUrl}
              alt="selfie"
              className="w-full h-full object-cover" /> :


            <div className="w-full h-full flex items-center justify-center text-ink-muted">
                  <IdCardIcon className="w-5 h-5" />
                </div>
            }
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">
                  {u.kyc?.fullName || u.name}
                </span>
                <Badge
                tone={
                u.kyc?.status === 'approved' ?
                'green' :
                u.kyc?.status === 'rejected' ?
                'red' :
                'amber'
                }>
                
                  {u.kyc?.status || 'none'}
                </Badge>
                <Badge tone="neutral" size="sm">
                  {u.kyc?.docType === 'passport' ? 'Passport' : 'ID Card'}
                </Badge>
              </div>
              <div className="text-2xs text-ink-muted font-mono">{u.email}</div>
              {u.kyc?.submittedAt &&
            <div className="text-3xs text-ink-dim mt-0.5">
                  Submitted {new Date(u.kyc.submittedAt).toLocaleString()}
                </div>
            }
            </div>
            <Button variant="secondary" size="sm" onClick={() => setViewing(u)}>
              Review
            </Button>
          </div>
        )}
        {list.length === 0 &&
        <div className="p-10 text-center text-xs text-ink-dim">
            No KYC submissions {filter === 'pending' ? 'pending' : ''}.
          </div>
        }
      </div>

      <AnimatePresence>
        {viewing &&
        <KycDetailModal
          user={viewing}
          onClose={() => setViewing(null)}
          onDecide={decide} />

        }
      </AnimatePresence>
    </div>);

}
function KycDetailModal({
  user,
  onClose,
  onDecide




}: {user: DBUser;onClose: () => void;onDecide: (u: DBUser, decision: 'approved' | 'rejected', note: string) => void;}) {
  const [note, setNote] = useState('');
  if (!user.kyc) return null;
  const kyc = user.kyc;
  return (
    <motion.div
      initial={{
        opacity: 0
      }}
      animate={{
        opacity: 1
      }}
      exit={{
        opacity: 0
      }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      
      <motion.div
        initial={{
          scale: 0.95,
          opacity: 0
        }}
        animate={{
          scale: 1,
          opacity: 1
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="KYC review"
        className="bg-bg-700 border border-brand/30 rounded-md w-full max-w-2xl p-4 sm:p-5 my-8">
        
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-base">
            KYC Review · {kyc.fullName || user.name}
          </h3>
          <button
            onClick={onClose}
            className="text-ink-dim hover:text-ink p-1 rounded hover:bg-bg-600">
            
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <KycImage label="Selfie" src={kyc.selfieUrl || kyc.selfieDataUrl} />
          {kyc.docType === 'passport' ?
          <KycImage
            label="Passport"
            src={kyc.passportUrl || kyc.passportDataUrl} /> :


          <>
              <KycImage
              label="ID Front"
              src={kyc.idFrontUrl || kyc.idFrontDataUrl} />
            
              <KycImage
              label="ID Back"
              src={kyc.idBackUrl || kyc.idBackDataUrl} />
            
            </>
          }
        </div>

        <div className="bg-bg-600 border border-line rounded p-3 mb-3 text-xs">
          <div className="text-2xs uppercase tracking-wider text-ink-muted font-bold mb-1">
            User details
          </div>
          <div>
            <span className="text-ink-muted">Email:</span>{' '}
            <span className="font-mono">{user.email}</span>
          </div>
          <div>
            <span className="text-ink-muted">Account name:</span> {user.name}
          </div>
          <div>
            <span className="text-ink-muted">KYC name:</span> {kyc.fullName}
          </div>
          {kyc.docNumber && <div><span className="text-ink-muted">Document number:</span> <span className="font-mono">{kyc.docNumber}</span></div>}
        </div>

        <div className="mb-3">
          <label className="text-2xs uppercase tracking-wider text-ink-muted font-bold mb-1 block">
            Note (required if rejecting)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Reason for rejection / approval note…"
            className="w-full bg-bg-700 border border-line rounded px-3 py-2 text-sm outline-none focus:border-brand resize-none" />
          
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              if (!note.trim())
              return toast.error('Reason required for rejection');
              onDecide(user, 'rejected', note);
            }}>
            
            Reject
          </Button>
          <Button
            variant="primary"
            onClick={() => onDecide(user, 'approved', note)}>
            
            Approve
          </Button>
        </div>
      </motion.div>
    </motion.div>);

}
function KycImage({ label, src }: {label: string;src?: string;}) {
  return (
    <div className="bg-bg-600 border border-line rounded p-2">
      <div className="text-2xs uppercase tracking-wider text-ink-muted font-bold mb-1">
        {label}
      </div>
      {src ?
      <img
        src={src}
        alt={label}
        className="w-full max-h-48 object-contain rounded border border-line bg-bg-900" /> :


      <div className="w-full h-32 flex items-center justify-center text-ink-dim text-2xs">
          (not provided)
        </div>
      }
    </div>);

}
// ============================================================
// PAYMENTS REVIEW TAB
// ============================================================
type PaymentFilter = 'all' | 'pending' | 'approved' | 'rejected';
export function PaymentsTab({ adminEmail }: {adminEmail: string;}) {
  const payments = useCollection('payments');
  const [filter, setFilter] = useState<PaymentFilter>('pending');
  const [q, setQ] = useState('');
  const [viewing, setViewing] = useState<PaymentSubmission | null>(null);
  const sorted = useMemo(
    () => [...payments].sort((a, b) => b.createdAt - a.createdAt),
    [payments]
  );
  const counts = useMemo(
    () => ({
      all: payments.length,
      pending: payments.filter((p) => p.status === 'pending').length,
      approved: payments.filter((p) => p.status === 'approved').length,
      rejected: payments.filter((p) => p.status === 'rejected').length
    }),
    [payments]
  );
  const baseList =
  filter === 'all' ? sorted : sorted.filter((p) => p.status === filter);
  const list = baseList.filter((p) => {
    if (!q.trim()) return true;
    const needle = q.trim().toLowerCase();
    return (
      (p.userName || '').toLowerCase().includes(needle) ||
      (p.userEmail || '').toLowerCase().includes(needle) ||
      (p.transactionId || '').toLowerCase().includes(needle) ||
      (p.amount || '').toLowerCase().includes(needle) ||
      (p.network || '').toLowerCase().includes(needle));

  });
  const decide = async (
  p: PaymentSubmission,
  decision: 'approved' | 'rejected',
  note: string,
  hours: number) =>
  {
    const label = formatHours(hours);
    db.update('payments', p.id, {
      status: decision,
      reviewedAt: Date.now(),
      reviewedBy: adminEmail,
      adminNote: note,
      validityHoursGranted: decision === 'approved' ? hours : undefined,
      validityDaysGranted:
      decision === 'approved' ?
      Math.max(1, Math.round(hours / 24)) :
      undefined
    });
    const u = db.list('users').find((x) => x.email === p.userEmail);
    if (decision === 'approved' && u) {
      db.update('users', u.id, {
        paymentApproved: true,
        paymentPending: false,
        subscriptionActive: true
      });
      const updated = await grantManagedUserValidity(u.id, hours, { mode: 'extend' });
      cacheLocalRecord('users', updated);
    } else if (decision === 'rejected' && u) {
      db.update('users', u.id, {
        paymentApproved: false,
        paymentPending: false
      });
    }
    db.insert('notifications', {
      id: uid('nt'),
      target: 'user',
      targetEmail: p.userEmail,
      title:
      decision === 'approved' ?
      'Payment approved — account active' :
      'Payment rejected',
      body:
      decision === 'approved' ?
      `Your payment is verified. Account activated for ${label}. ${note}` :
      `Your payment was rejected. ${note || 'Please contact support.'}`,
      kind: decision === 'approved' ? 'success' : 'error',
      read: false,
      createdAt: Date.now()
    });
    db.log('info', 'payment', `${decision} payment for ${p.userEmail}`);
    toast.success(
      decision === 'approved' ?
      `Approved · granted ${label} to ${p.userEmail}` :
      `Rejected payment from ${p.userEmail}`
    );
    setViewing(null);
  };
  return (
    <div className="bg-bg-600 border border-line rounded-md">
      <div className="p-3 border-b border-line flex items-center gap-2 flex-wrap">
        <div className="text-2xs uppercase tracking-wider text-ink-muted font-bold">
          Filter:
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as PaymentFilter)}
          className="bg-bg-700 border border-line rounded px-2 py-1 text-2xs uppercase font-bold tracking-wider outline-none focus:border-brand">
          
          <option value="all">All ({counts.all})</option>
          <option value="pending">Pending ({counts.pending})</option>
          <option value="approved">Approved ({counts.approved})</option>
          <option value="rejected">Rejected ({counts.rejected})</option>
        </select>
        <div className="flex items-center gap-2 bg-bg-700 border border-line rounded px-3 py-1.5 flex-1 min-w-[200px] max-w-md">
          <SearchIcon className="w-3.5 h-3.5 text-ink-dim shrink-0" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, TX, amount..."
            className="bg-transparent text-xs outline-none flex-1" />
          
        </div>
        <div className="ml-auto text-3xs text-ink-dim">
          Total {counts.all} · {counts.pending} pending
        </div>
      </div>

      <div className="divide-y divide-line">
        {list.map((p) =>
        <div key={p.id} className="p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded bg-bg-700 border border-line flex items-center justify-center shrink-0">
              <CreditCardIcon className="w-5 h-5 text-brand" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm">{p.userName}</span>
                <Badge
                tone={
                p.status === 'approved' ?
                'green' :
                p.status === 'rejected' ?
                'red' :
                'amber'
                }>
                
                  {p.status}
                </Badge>
                <Badge tone="neutral" size="sm">
                  {p.network || 'crypto'}
                </Badge>
                {p.amount &&
              <Badge tone="neutral" size="sm">
                    {p.amount}
                  </Badge>
              }
              </div>
              <div className="text-2xs text-ink-muted font-mono">
                {p.userEmail}
              </div>
              <div className="text-3xs text-ink-dim mt-0.5 font-mono truncate">
                TX: {p.transactionId}
              </div>
              <div className="text-3xs text-ink-dim mt-0.5">
                Submitted {new Date(p.createdAt).toLocaleString()}
                {p.reviewedAt &&
              <span>
                    {' '}
                    · Reviewed {new Date(p.reviewedAt).toLocaleString()}
                  </span>
              }
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setViewing(p)}>
              Review
            </Button>
          </div>
        )}
        {list.length === 0 &&
        <div className="p-10 text-center text-xs text-ink-dim">
            No {filter === 'all' ? '' : filter} payment submissions.
          </div>
        }
      </div>

      <AnimatePresence>
        {viewing &&
        <PaymentDetailModal
          payment={viewing}
          onClose={() => setViewing(null)}
          onDecide={decide} />

        }
      </AnimatePresence>
    </div>);

}
function PaymentDetailModal({
  payment,
  onClose,
  onDecide









}: {payment: PaymentSubmission;onClose: () => void;onDecide: (p: PaymentSubmission, decision: 'approved' | 'rejected', note: string, hours: number) => void;}) {
  const [note, setNote] = useState(payment.adminNote || '');
  const [hours, setHours] = useState<number>(
    payment.validityHoursGranted || 168
  );
  const [customMode, setCustomMode] = useState<ValidityUnit>('hours');
  const [customValue, setCustomValue] = useState<string>('');
  const applyPreset = (h: number) => {
    setHours(h);
    setCustomValue('');
  };
  const applyCustom = (raw: string) => {
    setCustomValue(raw);
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return;
    setHours(durationToHours(n, customMode));
  };
  const isDecided = payment.status !== 'pending';
  return (
    <motion.div
      initial={{
        opacity: 0
      }}
      animate={{
        opacity: 1
      }}
      exit={{
        opacity: 0
      }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      
      <motion.div
        initial={{
          scale: 0.95,
          opacity: 0
        }}
        animate={{
          scale: 1,
          opacity: 1
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Payment review"
        className="bg-bg-700 border border-brand/30 rounded-md w-full max-w-2xl p-4 sm:p-5 my-8">
        
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-base">
              Payment Review · {payment.userName}
            </h3>
            <Badge
              tone={
              payment.status === 'approved' ?
              'green' :
              payment.status === 'rejected' ?
              'red' :
              'amber'
              }
              size="sm">
              
              {payment.status}
            </Badge>
          </div>
          <button
            onClick={onClose}
            className="text-ink-dim hover:text-ink p-1 rounded hover:bg-bg-600">
            
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-bg-600 border border-line rounded p-4 text-xs space-y-2 mb-4">
          <Row label="User" value={payment.userName} />
          <Row label="Email" value={payment.userEmail} mono />
          <Row label="Network" value={payment.network || '—'} />
          <Row label="Amount" value={payment.amount || '—'} />
          <Row label="Wallet" value={payment.walletAddress} mono />
          <Row label="TX ID" value={payment.transactionId} mono />
          {payment.notes && <Row label="Notes" value={payment.notes} />}
          <Row
            label="Submitted"
            value={new Date(payment.createdAt).toLocaleString()} />
          
          {payment.reviewedAt &&
          <Row
            label="Reviewed"
            value={`${new Date(payment.reviewedAt).toLocaleString()} by ${payment.reviewedBy || 'admin'}`} />

          }
          {payment.validityHoursGranted &&
          <Row
            label="Granted"
            value={`${formatHours(payment.validityHoursGranted)} validity`} />

          }
        </div>

        {!isDecided &&
        <>
            <div className="mb-3">
              <label className="text-2xs uppercase tracking-wider text-ink-muted font-bold mb-2 block">
                Grant validity
              </label>
              <div className="flex flex-wrap gap-1.5">
                {VALIDITY_PRESETS.map((p) =>
              <button
                key={p.hours}
                onClick={() => applyPreset(p.hours)}
                className={`px-2.5 py-1.5 rounded text-2xs uppercase font-bold tracking-wider transition-colors border ${hours === p.hours && !customValue ? 'bg-brand text-white border-brand' : 'bg-bg-600 text-ink-muted border-line hover:text-ink hover:border-brand/40'}`}>
                
                    {p.label}
                  </button>
              )}
              </div>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span className="text-2xs uppercase tracking-wider text-ink-muted font-bold">
                  Custom:
                </span>
                <input
                type="number"
                min={1}
                value={customValue}
                onChange={(e) => applyCustom(e.target.value)}
                placeholder="amount"
                className="w-24 bg-bg-700 border border-line rounded px-2 py-1 text-xs outline-none focus:border-brand" />
              
                <select
                value={customMode}
                onChange={(e) => {
                  const next = e.target.value as ValidityUnit;
                  setCustomMode(next);
                  if (customValue) {
                    const n = Number(customValue);
                    if (Number.isFinite(n) && n > 0) setHours(durationToHours(n, next));
                  }
                }}
                className="bg-bg-700 border border-line rounded px-2 py-1 text-xs outline-none focus:border-brand">
                
                  <option value="minutes">minutes</option>
                  <option value="hours">hours</option>
                  <option value="days">days</option>
                  <option value="months">months</option>
                </select>
                <span className="text-2xs text-ink-dim">
                  → {formatHours(hours)} total
                </span>
              </div>
            </div>

            <div className="mb-3">
              <label className="text-2xs uppercase tracking-wider text-ink-muted font-bold mb-1 block">
                Admin note
              </label>
              <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Optional note to user"
              className="w-full bg-bg-700 border border-line rounded px-3 py-2 text-sm outline-none focus:border-brand resize-none" />
            
            </div>
          </>
        }

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {!isDecided &&
          <>
              <Button
              variant="secondary"
              onClick={() => onDecide(payment, 'rejected', note, hours)}>
              
                Reject
              </Button>
              <Button
              variant="primary"
              onClick={() => onDecide(payment, 'approved', note, hours)}>
              
                Approve & grant {formatHours(hours)}
              </Button>
            </>
          }
        </div>
      </motion.div>
    </motion.div>);

}
function Row({
  label,
  value,
  mono




}: {label: string;value: string;mono?: boolean;}) {
  return (
    <div className="flex gap-2">
      <div className="text-ink-muted shrink-0 w-20">{label}:</div>
      <div className={`flex-1 break-all ${mono ? 'font-mono text-2xs' : ''}`}>
        {value}
      </div>
    </div>);

}
// ============================================================
// MASTER KEYS TAB
// ============================================================
export function MasterKeysTab({ adminEmail }: {adminEmail: string;}) {
  const keys = useCollection('masterKeys');
  const [email, setEmail] = useState('');
  const [duration, setDuration] = useState(7);
  const [durationUnit, setDurationUnit] = useState<ValidityUnit>('days');
  const [customKey, setCustomKey] = useState('');
  const [q, setQ] = useState('');
  const [saving, setSaving] = useState(false);
  const create = async () => {
    if (!email.trim()) return toast.error('Email required');
    const validityHours = durationToHours(duration, durationUnit);
    if (!Number.isFinite(validityHours) || validityHours < MIN_VALIDITY_HOURS || validityHours > MAX_VALIDITY_HOURS) {
      return toast.error('Validity must be between 1 minute and 10 years.');
    }
    const key = customKey.trim().toUpperCase() || generateMasterKey();
    if (!/^AZH-TRD-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(key)) {
      return toast.error('Use the format AZH-TRD-XXXX-XXXX');
    }
    setSaving(true);
    try {
      const record: MasterKey = {
        id: uid('mk'),
        key,
        email: email.trim().toLowerCase(),
        validityDays: Math.max(1, Math.ceil(validityHours / 24)),
        validityHours,
        used: false,
        createdAt: Date.now(),
        createdBy: adminEmail
      };
      await persistRecord('masterKeys', record);
      cacheLocalRecord('masterKeys', record);
      db.log('info', 'mkey', `Created master key for ${email}`);
      toast.success(`Master key created for ${formatHours(validityHours)}`);
      setEmail('');
      setCustomKey('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Master key could not be created.');
    } finally {
      setSaving(false);
    }
  };
  const filteredKeys = keys.filter((k) => {
    if (!q.trim()) return true;
    const needle = q.trim().toLowerCase();
    return (
      k.email.toLowerCase().includes(needle) ||
      k.key.toLowerCase().includes(needle));

  });
  return (
    <div className="grid lg:grid-cols-2 gap-3">
      <div className="bg-bg-600 border border-line rounded-md p-4">
        <div className="text-2xs uppercase tracking-[0.18em] text-ink-muted font-bold mb-3 flex items-center gap-2">
          <KeyRoundIcon className="w-3.5 h-3.5" />
          Create Master Gate Key
        </div>
        <div className="space-y-3">
          <Input
            label="Target user email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com" />
          
          <Input
            label="Custom key (optional — auto-generated if empty)"
            value={customKey}
            onChange={(e) => setCustomKey(e.target.value)}
            placeholder="MK-XXXX-XXXX-XXXX" />
          
          <div>
            <label className="text-2xs uppercase tracking-wider text-ink-muted font-bold mb-1 block">Validity</label>
            <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-2">
              <input type="number" min={1} value={duration} onChange={(e) => setDuration(Math.max(1, Number(e.target.value) || 1))} className="min-w-0 bg-bg-700 border border-line rounded px-3 py-2 text-sm outline-none focus:border-brand" />
              <select value={durationUnit} onChange={(e) => setDurationUnit(e.target.value as ValidityUnit)} className="bg-bg-700 border border-line rounded px-3 py-2 text-sm outline-none focus:border-brand">
                <option value="minutes">Minutes</option><option value="hours">Hours</option><option value="days">Days</option><option value="months">Months</option>
              </select>
            </div>
          </div>
          <Button variant="primary" disabled={saving} onClick={() => void create()} icon={<PlusIcon className="w-3.5 h-3.5" />}>
            {saving ? 'Generating…' : 'Generate Key'}
          </Button>
          <div className="text-3xs text-ink-dim leading-relaxed bg-bg-700 border border-line rounded p-2">
            Send this key to the user manually (email, message, etc). They enter
            it on the Gate page to activate access.
          </div>
        </div>
      </div>

      <div className="bg-bg-600 border border-line rounded-md p-4">
        <div className="text-2xs uppercase tracking-[0.18em] text-ink-muted font-bold mb-3 flex items-center justify-between gap-2">
          <span>
            Generated Keys ({filteredKeys.length}/{keys.length})
          </span>
        </div>
        <div className="flex items-center gap-2 bg-bg-700 border border-line rounded px-3 py-1.5 mb-3">
          <SearchIcon className="w-3.5 h-3.5 text-ink-dim shrink-0" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by email or key..."
            className="bg-transparent text-xs outline-none flex-1" />
          
        </div>
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {filteredKeys.map((k) =>
          <MasterKeyRow key={k.id} mk={k} />
          )}
          {filteredKeys.length === 0 &&
          <div className="text-center text-xs text-ink-dim py-6">
              {keys.length === 0 ?
            'No keys generated yet.' :
            'No keys match your search.'}
            </div>
          }
        </div>
      </div>
    </div>);

}
function MasterKeyRow({ mk }: {mk: MasterKey;}) {
  const copy = () => {
    navigator.clipboard.writeText(mk.key);
    toast.success('Key copied');
  };
  const remove = async () => {
    if (!confirm(`Delete master key ${mk.key}? The user (${mk.email}) will no longer be able to use this key.`)) return;
    try {
      await deletePersistentRecord('masterKeys', mk.id);
      db.log('warn', 'mkey', `Deleted master key ${mk.key} for ${mk.email}`);
      toast.success('Master key permanently deleted');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Master key could not be deleted.');
    }
  };
  const now = Date.now();
  // Three-state lifecycle:
  //   unused    — issued but never activated
  //   active    — activated, still within validity window (re-usable)
  //   expired   — past validityExpiresAt, can no longer be used
  let state: 'unused' | 'active' | 'expired' = 'unused';
  let tone: 'amber' | 'green' | 'red' = 'amber';
  let statusLabel = 'unused';
  if (mk.validityExpiresAt) {
    if (mk.validityExpiresAt > now) {
      state = 'active';
      tone = 'green';
      const hoursLeft = Math.ceil((mk.validityExpiresAt - now) / 3600000);
      statusLabel =
      hoursLeft < 24 ?
      `active · ${hoursLeft}h left` :
      `active · ${Math.ceil(hoursLeft / 24)}d left`;
    } else {
      state = 'expired';
      tone = 'red';
      statusLabel = 'expired';
    }
  } else if (mk.used) {
    // Legacy one-shot key (pre-validity-window era)
    state = 'expired';
    tone = 'red';
    statusLabel = 'used (legacy)';
  }
  return (
    <div className="bg-bg-700 border border-line rounded p-3">
      <div className="flex items-center justify-between mb-1 gap-2">
        <code className="text-xs text-brand font-mono break-all flex-1">
          {mk.key}
        </code>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={copy}
            className="text-ink-dim hover:text-brand p-1 rounded"
            title="Copy key">
            
            <CopyIcon className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => void remove()}
            className="text-ink-dim hover:text-sell p-1 rounded"
            title="Delete key">
            
            <Trash2Icon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2 text-2xs flex-wrap">
        <Badge tone={tone} size="sm">
          {statusLabel}
        </Badge>
        <span className="text-ink-muted font-mono">{mk.email}</span>
        <span className="text-ink-dim">· {formatHours(mk.validityHours || mk.validityDays * 24)} plan</span>
      </div>
      <div className="text-3xs text-ink-dim mt-1 font-mono">
        Created {new Date(mk.createdAt).toLocaleString()}
        {mk.usedAt &&
        <span> · Activated {new Date(mk.usedAt).toLocaleString()}</span>
        }
        {mk.validityExpiresAt &&
        <span>
            {' '}
            · Expires {new Date(mk.validityExpiresAt).toLocaleString()}
          </span>
        }
      </div>
    </div>);

}
// ============================================================
// DEVICES TAB — REAL Firestore device-change / unlock requests
// ============================================================
type DeviceTabFilter = 'pending' | 'history';
function shortId(id?: string | null, n = 12): string {
  if (!id) return '—';
  return id.length > n ? id.slice(0, n) + '…' : id;
}
function validityLabel(u?: DBUser): {
  text: string;
  expired: boolean;
} {
  if (!u?.validityExpiresAt)
  return {
    text: 'No validity',
    expired: false
  };
  const now = Date.now();
  if (u.validityExpiresAt < now)
  return {
    text: 'EXPIRED',
    expired: true
  };
  const h = Math.ceil((u.validityExpiresAt - now) / 3600000);
  return {
    text: h < 24 ? `${h}h left` : `${Math.ceil(h / 24)}d left`,
    expired: false
  };
}
export function DevicesTab() {
  const users = useCollection('users');
  const [pending, setPending] = useState<DeviceChangeRequest[]>([]);
  const [history, setHistory] = useState<DeviceChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<DeviceTabFilter>('pending');
  const [q, setQ] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  // Live pending requests from Firestore.
  useEffect(() => {
    const unsub = subscribePendingRequests((rows) => {
      setPending(rows);
      setLoading(false);
    });
    return unsub;
  }, []);
  // Request history (one-shot, reloaded after each action).
  const loadHistory = async () => {
    const all = await listAllRequests();
    setHistory(all.slice(0, 25));
  };
  useEffect(() => {
    loadHistory();
  }, []);
  const userForReq = (req: DeviceChangeRequest): DBUser | undefined =>
  users.find((u) => u.email.toLowerCase() === (req.email || '').toLowerCase());
  const handleApprove = async (req: DeviceChangeRequest) => {
    setBusyId(req.id);
    const res = await approveRequest(req);
    if (res.success) {
      // Mirror the approval into the LOCAL users/devices store — otherwise
      // the stale local warning counter keeps showing BANNED to the user.
      // Local device records use a localStorage 'dev_…' id (NOT the Firebase
      // fingerprint hash), so match the user's pending records by email.
      const pendingLocal = db.
      list('devices').
      filter(
        (d) =>
        d.userEmail === req.email && (
        d.status === 'requested' || d.status === 'unlock_request')
      );
      const newLocalDeviceId =
      pendingLocal.length > 0 ?
      pendingLocal[pendingLocal.length - 1].deviceId :
      null;
      // Drop old allowed local device records (single-device policy)
      db.list('devices').
      filter(
        (d) =>
        d.userEmail === req.email &&
        d.status === 'allowed' &&
        d.deviceId !== newLocalDeviceId
      ).
      forEach((d) => db.remove('devices', d.id));
      // Flip the pending local records to allowed
      pendingLocal.forEach((d) =>
      db.update('devices', d.id, {
        status: 'allowed'
      })
      );
      const u = userForReq(req);
      if (u) {
        db.update('users', u.id, {
          deviceWarnings: 0,
          activeDevices: 1,
          primaryDeviceId: newLocalDeviceId || undefined,
          ...(u.status === 'banned' ?
          {
            status: 'active' as const
          } :
          {})
        });
      }
      db.log(
        'info',
        'device',
        `Device approved & warnings reset for ${req.email}`
      );
      toast.success(res.message);
    } else toast.error(res.message);
    setBusyId(null);
    loadHistory();
  };
  const handleReject = async (req: DeviceChangeRequest) => {
    const note = rejectNotes[req.id]?.trim() || 'Rejected by admin.';
    setBusyId(req.id);
    const res = await rejectRequest(req.id, note);
    if (res.success) toast.success(res.message);else
    toast.error(res.message);
    setBusyId(null);
    loadHistory();
  };
  const handleUnlock = async (req: DeviceChangeRequest, u?: DBUser) => {
    setBusyId(req.id);
    // Flip the local user status active + clear warnings.
    if (u) {
      db.update('users', u.id, {
        status: 'active',
        deviceWarnings: 0,
        activeDevices: 1
      });
      db.log('info', 'device', `Unlocked & unbanned ${u.email}`);
    }
    // Clear the Firestore deviceLock.
    const res = await adminUnlockAccount(req.userId);
    if (res.success) toast.success(`Account unlocked for ${req.email}`);else
    toast.error(res.message);
    setBusyId(null);
    loadHistory();
  };
  const stats = useMemo(
    () => ({
      pending: pending.length,
      approved: history.filter((r) => r.status === 'approved').length,
      rejected: history.filter((r) => r.status === 'rejected').length
    }),
    [pending, history]
  );
  const source = filter === 'pending' ? pending : history;
  const list = useMemo(() => {
    if (!q.trim()) return source;
    const needle = q.trim().toLowerCase();
    return source.filter(
      (r) =>
      (r.email || '').toLowerCase().includes(needle) ||
      (r.userId || '').toLowerCase().includes(needle) ||
      (r.newDeviceId || '').toLowerCase().includes(needle) ||
      (r.currentDeviceId || '').toLowerCase().includes(needle) ||
      (r.reason || '').toLowerCase().includes(needle)
    );
  }, [source, q]);
  return (
    <div className="space-y-3">
      {/* Stat row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-bg-600 border border-line rounded-md p-3">
          <div className="text-2xs uppercase tracking-wider text-ink-muted font-bold mb-1">
            Pending Requests
          </div>
          <div className="text-2xl font-extrabold font-mono text-warn">
            {stats.pending}
          </div>
        </div>
        <div className="bg-bg-600 border border-line rounded-md p-3">
          <div className="text-2xs uppercase tracking-wider text-ink-muted font-bold mb-1">
            Approved (recent)
          </div>
          <div className="text-2xl font-extrabold font-mono text-buy">
            {stats.approved}
          </div>
        </div>
        <div className="bg-bg-600 border border-line rounded-md p-3">
          <div className="text-2xs uppercase tracking-wider text-ink-muted font-bold mb-1">
            Rejected (recent)
          </div>
          <div className="text-2xl font-extrabold font-mono text-sell">
            {stats.rejected}
          </div>
        </div>
      </div>

      <div className="bg-bg-600 border border-line rounded-md">
        <div className="p-3 border-b border-line flex items-center gap-2 flex-wrap">
          <div className="text-2xs uppercase tracking-wider text-ink-muted font-bold">
            Filter:
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as DeviceTabFilter)}
            className="bg-bg-700 border border-line rounded px-2 py-1 text-2xs uppercase font-bold tracking-wider outline-none focus:border-brand">
            
            <option value="pending">Pending Requests ({stats.pending})</option>
            <option value="history">History ({history.length})</option>
          </select>
          <div className="flex items-center gap-2 bg-bg-700 border border-line rounded px-3 py-1.5 flex-1 min-w-[200px] max-w-md">
            <SearchIcon className="w-3.5 h-3.5 text-ink-dim shrink-0" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search email, user id, device id, reason..."
              className="bg-transparent text-xs outline-none flex-1" />
            
          </div>
          <div className="ml-auto text-3xs text-ink-dim">
            One device per user · live device-change requests
          </div>
        </div>

        <div className="divide-y divide-line max-h-[640px] overflow-y-auto">
          {loading && filter === 'pending' &&
          <div className="p-10 text-center text-xs text-ink-dim">
              Loading live device requests…
            </div>
          }
          {!loading &&
          list.map((req) => {
            const u = userForReq(req);
            const isOpen = expanded === req.id;
            const isPending = req.status === 'pending';
            const vLabel = validityLabel(u);
            const locked = u?.status === 'locked' || u?.status === 'banned';
            return (
              <div key={req.id} className="p-3">
                  <div className="flex items-start gap-3">
                    <MonitorIcon className="w-4 h-4 text-ink-muted shrink-0 mt-1" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-xs">
                          {req.email}
                        </span>
                        <Badge
                        tone={
                        req.status === 'approved' ?
                        'green' :
                        req.status === 'rejected' ?
                        'red' :
                        'brand'
                        }
                        size="sm">
                        
                          {req.status === 'pending' ?
                        'device change request' :
                        req.status}
                        </Badge>
                        {u &&
                      <Badge
                        tone={
                        u.status === 'active' ?
                        'green' :
                        u.status === 'pending' ?
                        'amber' :
                        'red'
                        }
                        size="sm">
                        
                            {u.status}
                          </Badge>
                      }
                        {locked &&
                      <Badge tone="red" size="sm">
                            account locked
                          </Badge>
                      }
                      </div>
                      <div className="text-3xs text-ink-dim font-mono truncate mt-0.5">
                        user: {shortId(req.userId, 16)}
                      </div>
                      <div className="text-3xs text-ink-dim mt-0.5">
                        <span className="text-ink-muted">old:</span>{' '}
                        <span className="font-mono">
                          {shortId(req.currentDeviceId)}
                        </span>
                        <span className="mx-1.5 text-ink-dim">→</span>
                        <span className="text-ink-muted">new:</span>{' '}
                        <span className="font-mono">
                          {shortId(req.newDeviceId)}
                        </span>
                      </div>
                      {req.newFingerprint &&
                    <div className="text-3xs text-ink-dim mt-0.5">
                          {req.newFingerprint.platform || 'Unknown'}
                          {req.newFingerprint.screen ?
                      ` · ${req.newFingerprint.screen}` :
                      ''}
                          {req.newFingerprint.timezone ?
                      ` · ${req.newFingerprint.timezone}` :
                      ''}
                        </div>
                    }
                      {req.newFingerprint?.userAgent &&
                    <div className="text-3xs text-ink-dim truncate">
                          {req.newFingerprint.userAgent}
                        </div>
                    }
                      <div className="text-3xs text-ink-muted mt-0.5 break-words">
                        " {req.reason || 'No reason provided'}"
                      </div>
                      <div className="text-3xs text-ink-dim font-mono mt-0.5">
                        {new Date(req.createdAt).toLocaleString()}
                        {req.adminNote &&
                      <span className="ml-2 text-ink-muted">
                            · note: {req.adminNote}
                          </span>
                      }
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <button
                      onClick={() => setExpanded(isOpen ? null : req.id)}
                      className="text-3xs px-2 py-1 rounded text-ink-dim hover:text-brand uppercase tracking-wider font-bold">
                      
                        {isOpen ? 'Hide data' : 'View data'}
                      </button>
                      {isPending &&
                    <div className="flex gap-1">
                          <button
                        disabled={busyId === req.id}
                        onClick={() => handleApprove(req)}
                        className="text-3xs px-2 py-1 rounded bg-buy/10 border border-buy/30 text-buy hover:bg-buy/20 uppercase tracking-wider font-bold disabled:opacity-40">
                        
                            <CheckIcon className="w-3 h-3 inline" /> Approve
                          </button>
                          <button
                        disabled={busyId === req.id}
                        onClick={() => handleReject(req)}
                        className="text-3xs px-2 py-1 rounded bg-sell/10 border border-sell/30 text-sell hover:bg-sell/20 uppercase tracking-wider font-bold disabled:opacity-40">
                        
                            <XIcon className="w-3 h-3 inline" /> Reject
                          </button>
                        </div>
                    }
                    </div>
                  </div>

                  {/* Inline reject note + unlock for pending */}
                  {isPending &&
                <div className="mt-2 ml-7 flex flex-wrap items-center gap-2">
                      <input
                    value={rejectNotes[req.id] || ''}
                    onChange={(e) =>
                    setRejectNotes((prev) => ({
                      ...prev,
                      [req.id]: e.target.value
                    }))
                    }
                    placeholder="Rejection note (optional)…"
                    className="flex-1 min-w-[180px] bg-bg-700 border border-line rounded px-3 py-1.5 text-xs outline-none focus:border-brand" />
                  
                      {locked &&
                  <button
                    disabled={busyId === req.id}
                    onClick={() => handleUnlock(req, u)}
                    className="text-3xs px-2.5 py-1.5 rounded bg-warn/10 border border-warn/30 text-warn hover:bg-warn/20 uppercase tracking-wider font-bold disabled:opacity-40 inline-flex items-center gap-1">
                    
                          <ShieldCheckIcon className="w-3 h-3" /> Unlock & unban
                          account
                        </button>
                  }
                    </div>
                }

                  {/* Full user data panel */}
                  {isOpen &&
                <div className="mt-2 ml-7 bg-bg-700 border border-line rounded p-3 text-xs">
                      <div className="text-2xs uppercase tracking-wider text-ink-muted font-bold mb-2">
                        Full user data
                      </div>
                      {u ?
                  <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1.5">
                          <Row label="Name" value={u.name || '—'} />
                          <Row label="Email" value={u.email} mono />
                          <Row label="Role" value={u.role} />
                          <Row label="Status" value={u.status} />
                          <Row label="Validity" value={vLabel.text} />
                          <Row
                      label="Payment"
                      value={
                      u.paymentApproved ?
                      'approved' :
                      u.paymentPending ?
                      'pending' :
                      'none'
                      } />
                    
                          <Row
                      label="Subscription"
                      value={u.subscriptionActive ? 'active' : 'inactive'} />
                    
                          <Row label="KYC" value={u.kyc?.status || 'none'} />
                          <Row
                      label="WhatsApp"
                      value={u.whatsapp || '—'}
                      mono />
                    
                          <Row
                      label="Warnings"
                      value={String(u.deviceWarnings ?? 0)} />
                    
                          <Row
                      label="Primary device"
                      value={shortId(u.primaryDeviceId, 16)}
                      mono />
                    
                          <Row
                      label="Last seen"
                      value={
                      u.lastSeen ?
                      new Date(u.lastSeen).toLocaleString() :
                      '—'
                      } />
                    
                        </div> :

                  <div className="text-ink-dim text-3xs">
                          No matching user record found for{' '}
                          <span className="font-mono">{req.email}</span>. The
                          request data above is still actionable.
                        </div>
                  }
                    </div>
                }
                </div>);

          })}
          {!loading && list.length === 0 &&
          <div className="p-10 text-center text-xs text-ink-dim">
              {filter === 'pending' ?
            'No pending device-change requests.' :
            'No request history yet.'}
            </div>
          }
        </div>
      </div>
    </div>);

}
// ============================================================
// VALIDITY MANAGEMENT — quick-grant control for the Users tab
// ============================================================
export function ValidityControl({
  user,
  adminEmail



}: {user: DBUser;adminEmail: string;}) {
  const [currentUser, setCurrentUser] = useState(user);
  const [hours, setHours] = useState<number>(user.validityHours || 168);
  const [customMode, setCustomMode] = useState<ValidityUnit>('hours');
  const [customValue, setCustomValue] = useState<string>('');
  const [specificExpiry, setSpecificExpiry] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => setCurrentUser(user), [user]);
  const expires = currentUser.validityExpiresAt || currentUser.expiresAt;
  const now = Date.now();
  const selectedSpecificExpiry = specificExpiry ? new Date(specificExpiry).getTime() : 0;
  const previewExpiresAt = selectedSpecificExpiry > now ?
  selectedSpecificExpiry :
  now + hours * 3_600_000;
  const isExpired = !!expires && expires < now;
  const hoursLeft = expires ?
  Math.max(0, Math.ceil((expires - now) / 3600000)) :
  null;
  const applyCustom = (raw: string) => {
    setCustomValue(raw);
    setSpecificExpiry('');
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return;
    setHours(durationToHours(n, customMode));
  };
  return (
    <div className="bg-bg-600 border border-line rounded p-3">
      <div className="text-2xs uppercase tracking-wider text-ink-muted font-bold mb-2 flex items-center gap-1.5">
        <CalendarIcon className="w-3 h-3" />
        Account Validity
      </div>
      <div className="text-xs mb-3">
        {expires ?
        <>
            <span className={isExpired ? 'text-sell' : 'text-buy'}>
              {isExpired ?
            'EXPIRED' :
            hoursLeft! < 24 ?
            `${hoursLeft}h left` :
            `${Math.ceil(hoursLeft! / 24)} days left`}
            </span>
            <span className="text-ink-dim ml-2">
              · expires {new Date(expires).toLocaleString()}
            </span>
          </> :

        <span className="text-ink-dim">No validity set</span>
        }
      </div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {VALIDITY_PRESETS.map((p) =>
        <button
          key={p.hours}
          onClick={() => {
            setHours(p.hours);
            setCustomValue('');
            setSpecificExpiry('');
          }}
          className={`px-2 py-1 rounded text-2xs uppercase font-bold tracking-wider transition-colors border ${hours === p.hours && !customValue ? 'bg-brand text-white border-brand' : 'bg-bg-700 text-ink-muted border-line hover:text-ink hover:border-brand/40'}`}>
          
            {p.label}
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <span className="text-2xs uppercase tracking-wider text-ink-muted font-bold">
          Custom:
        </span>
        <input
          type="number"
          min={1}
          value={customValue}
          onChange={(e) => applyCustom(e.target.value)}
          placeholder="amount"
          className="w-20 bg-bg-700 border border-line rounded px-2 py-1 text-xs outline-none focus:border-brand" />
        
        <select
          value={customMode}
          onChange={(e) => {
            const next = e.target.value as ValidityUnit;
            setCustomMode(next);
            if (customValue) {
              const n = Number(customValue);
              if (Number.isFinite(n) && n > 0) setHours(durationToHours(n, next));
            }
          }}
          className="bg-bg-700 border border-line rounded px-2 py-1 text-xs outline-none focus:border-brand">
          
          <option value="minutes">minutes</option>
          <option value="hours">hours</option>
          <option value="days">days</option>
          <option value="months">months</option>
        </select>
        <span className="text-2xs text-ink-dim">→ {formatHours(hours)}</span>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-2xs font-bold uppercase tracking-wider text-ink-muted">Specific expiry:</span>
        <input
          type="datetime-local"
          value={specificExpiry}
          min={toLocalDateTimeValue(now + 60_000)}
          onChange={(event) => {
            setSpecificExpiry(event.target.value);
            setCustomValue('');
            const expiry = new Date(event.target.value).getTime();
            if (expiry > Date.now()) {
              setHours(Math.max(MIN_VALIDITY_HOURS, (expiry - Date.now()) / 3_600_000));
            }
          }}
          className="rounded border border-line bg-bg-700 px-2 py-1 text-xs outline-none focus:border-brand" />
        
      </div>
      <div className="mb-3 rounded border border-brand/25 bg-brand/5 p-2 text-xs text-ink-muted">
        This replaces the current validity. New exact expiry:{' '}
        <strong className="text-brand">{new Date(previewExpiresAt).toLocaleString()}</strong>
      </div>
      <Button
        variant="primary"
        size="sm"
        disabled={saving || !Number.isFinite(previewExpiresAt) || previewExpiresAt <= now}
        onClick={async () => {
          setSaving(true);
          try {
            const updated = await grantManagedUserValidity(currentUser.id, hours, {
              mode: 'replace',
              expiresAt: selectedSpecificExpiry > now ? selectedSpecificExpiry : undefined
            });
            cacheLocalRecord('users', updated);
            setCurrentUser(updated);
            setSpecificExpiry('');
            setHours(updated.validityHours || hours);
            const confirmedExpiry = updated.validityExpiresAt || updated.expiresAt || 0;
            db.log('info', 'validity', `${adminEmail} set ${updated.email} validity to expire ${new Date(confirmedExpiry).toISOString()}`);
            toast.success(`Validity updated. Expires ${new Date(confirmedExpiry).toLocaleString()}`);
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Validity update failed.');
          } finally {
            setSaving(false);
          }
        }}>
        
        {saving ? 'Updating…' : 'Grant validity'}
      </Button>
    </div>);

}

function toLocalDateTimeValue(timestamp: number): string {
  const date = new Date(timestamp);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(timestamp - offset).toISOString().slice(0, 16);
}