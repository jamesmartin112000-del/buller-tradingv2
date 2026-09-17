import React, { useEffect, useMemo, useState, Fragment } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import {
  LockIcon,
  ShieldAlertIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  Loader2Icon,
  CheckIcon,
  PhoneIcon,
  AlertTriangleIcon,
  ZapIcon,
  ClockIcon,
  CheckCircle2Icon,
  CreditCardIcon,
  WalletIcon } from
'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useUserAccount } from '../context/UserAccountContext';
import { HeroLogoWatermark } from '../components/common/HeroLogoWatermark';
import { Logo } from '../components/common/Logo';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { motion } from 'framer-motion';
import { db, subscribe, type PaymentProof } from '../lib/db/store';
import { useContent } from '../lib/db/hooks';
import { useMembershipPlans } from '../hooks/useMembershipPlans';
import { activateMasterKey } from '../lib/backend/gateService';
import { CryptoPaymentScreen } from '../components/signup/CryptoPaymentScreen';
import { SHARED_PLAN_FEATURES } from '../lib/data/plans';
// Plans are read from the live Firestore-backed collection, with canonical
// records used only as an offline/first-load fallback.
/** Returns the latest payment proof for the given email (or undefined). */
function latestProofFor(email: string): PaymentProof | undefined {
  const norm = email.trim().toLowerCase();
  return (db.list('paymentProofs') as PaymentProof[]).
  filter((p) => (p.email || '').toLowerCase() === norm).
  sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
}
export function Gate() {
  const { user, loading, gatePassed, setGatePassed } = useAuth();
  const { isExpired, isBanned, isLocked } = useUserAccount();
  const restricted = isExpired || isBanned || isLocked;
  useEffect(() => {
    if (user && (user.role === 'super_admin' || user.role === 'admin')) {
      setGatePassed(true);
    } else if (user && restricted && gatePassed) {
      // Never honor a persisted unlock after the account deadline/status changes.
      setGatePassed(false);
    }
  }, [user, restricted, gatePassed, setGatePassed]);
  if (loading) {
    return (
      <div className="min-h-screen w-full bg-bg flex items-center justify-center">
        <Loader2Icon className="w-7 h-7 text-brand animate-spin" />
      </div>);

  }
  if (!user) return <Navigate to="/login" replace />;
  if (isBanned || user.status === 'banned') return <Navigate to="/access-denied" replace />;
  if (gatePassed && !restricted) return <Navigate to="/app/dashboard" replace />;
  if (user.role === 'super_admin' || user.role === 'admin') {
    return (
      <div className="min-h-screen w-full bg-bg flex items-center justify-center">
        <Loader2Icon className="w-7 h-7 text-brand animate-spin" />
      </div>);

  }
  return <GateForUser />;
}
// ============================================================
// Regular-user gate — a small stage machine driven by payment state.
//   not_paid  → choose a plan, then pay (CryptoPaymentScreen)
//   pending   → payment submitted, awaiting admin verification
//   approved  → enter the Master Gate Key delivered after approval
// ============================================================
type Stage = 'not_paid' | 'choose_plan' | 'pay' | 'pending' | 'approved';
function GateForUser() {
  const { user, setGatePassed } = useAuth();
  const nav = useNavigate();
  const availablePlans = useMembershipPlans();
  // Live mirror of this user's latest payment proof (Firestore-synced).
  const [proof, setProof] = useState<PaymentProof | undefined>(() =>
  user ? latestProofFor(user.email) : undefined
  );
  useEffect(() => {
    if (!user) return;
    const refresh = () => setProof(latestProofFor(user.email));
    refresh();
    const unsub = subscribe('paymentProofs', refresh);
    return unsub;
  }, [user]);
  const subscriptionCurrent = !user?.expiresAt || user.expiresAt > Date.now();
  const paid =
  !!(user?.paymentApproved || user?.subscriptionActive) && subscriptionCurrent;
  const hasPending = proof?.status === 'pending';
  // If the user just came from signup (a stashed plan exists) and has no
  // pending payment yet, take them straight into the payment flow.
  let stashedPlan: string | null = null;
  try {
    stashedPlan = sessionStorage.getItem('te.signupPlan');
  } catch {}
  const initialStage: Stage = paid ?
  'approved' :
  hasPending ?
  'pending' :
  stashedPlan ?
  'pay' :
  'not_paid';
  const [stage, setStage] = useState<Stage>(initialStage);
  const [selectedPlan, setSelectedPlan] = useState(() => {
    try {
      const stashed = sessionStorage.getItem('te.signupPlan');
      if (stashed) return stashed;
    } catch {}
    return 'monthly';
  });
  // Keep the stage in sync with live backend changes (e.g. admin approves
  // while the user is sitting on this screen, or the proof lands).
  useEffect(() => {
    if (paid) {
      // Admin payment approval is the authorization decision. Restore the
      // persisted gate only after the live user profile carries a future expiry.
      setGatePassed(true);
      nav('/app/dashboard', { replace: true });
    } else if (hasPending) {
      setStage((s) => s === 'pay' || s === 'choose_plan' ? s : 'pending');
    }
  }, [paid, hasPending, nav, setGatePassed]);
  if (!user) return null;
  const plan =
  availablePlans.find((candidate) => candidate.id === selectedPlan) ||
  availablePlans[0];
  // ---------- PAY: reuse the existing crypto payment screen ----------
  if (stage === 'pay' && !plan) {
    return (
      <div className="min-h-screen w-full bg-bg flex items-center justify-center p-4">
        <div className="max-w-md rounded-md border border-line bg-bg-700 p-6 text-center">
          <p className="text-sm text-ink-muted">This plan is no longer available.</p>
          <Button className="mt-4" variant="secondary" onClick={() => setStage('choose_plan')}>
            <ArrowLeftIcon className="h-4 w-4" /> Back to plans
          </Button>
        </div>
      </div>);

  }
  if (stage === 'pay' && plan) {
    return (
      <CryptoPaymentScreen
        email={user.email}
        userId={user.uid}
        userName={user.name}
        plan={{
          id: plan.id,
          name: plan.name,
          amount: plan.amount,
          duration: plan.duration
        }}
        onBack={() => {
          try {
            sessionStorage.removeItem('te.signupPlan');
          } catch {}
          setStage('choose_plan');
        }}
        onSubmitted={() => {
          try {
            sessionStorage.removeItem('te.signupPlan');
          } catch {}
          setProof(latestProofFor(user.email));
          setStage('pending');
        }} />);


  }
  return (
    <div className="relative min-h-screen w-full hero-gradient flex flex-col items-center px-4 py-8 sm:py-10">
      <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />
      <HeroLogoWatermark />

      <motion.div
        initial={{
          opacity: 0,
          y: 12
        }}
        animate={{
          opacity: 1,
          y: 0
        }}
        className="relative w-full max-w-3xl space-y-4">
        
        {/* Header */}
        <div className="text-center mb-2">
          <div className="flex justify-center mb-3">
            <Logo size="lg" showText={false} />
          </div>
          <div className="inline-flex items-center gap-2 bg-brand/10 border border-brand/30 rounded-full px-3 py-1 mb-2">
            <ShieldAlertIcon className="w-3.5 h-3.5 text-brand" />
            <span className="text-2xs uppercase tracking-[0.18em] text-brand font-bold">
              Restricted Engine
            </span>
          </div>
          <h1 className="text-2xl font-bold">Activate Access</h1>
          <p className="text-sm text-ink-muted mt-1">
            Hi <span className="text-ink font-semibold">{user.name}</span> —
            complete the steps below to unlock the engine.
          </p>
        </div>

        {/* Progress stepper */}
        <GateStepper stage={stage} />

        {stage === 'not_paid' &&
        <PaymentRequiredPanel onStart={() => setStage('choose_plan')} />
        }

        {stage === 'choose_plan' &&
        <PlanSelectPanel
          plans={availablePlans}
          selectedPlan={selectedPlan}
          onSelect={(id) => {
            setSelectedPlan(id);
            setStage('pay');
          }}
          onBack={() => setStage('not_paid')} />

        }

        {stage === 'pending' && <PendingPanel proof={proof} />}

        {stage === 'approved' &&
        <ApprovedKeyPanel
          onUnlocked={() => {
            setGatePassed(true);
            nav('/app/dashboard');
          }} />

        }

        {/* Admin contact (always visible) */}
        <AdminContactPanel />
      </motion.div>
    </div>);

}
// ============================================================
// Progress stepper
// ============================================================
function GateStepper({ stage }: {stage: Stage;}) {
  const steps = [
  {
    key: 'pay',
    label: 'Select plan & pay',
    ur: 'Plan & payment'
  },
  {
    key: 'pending',
    label: 'Admin review',
    ur: 'Admin verify'
  },
  {
    key: 'approved',
    label: 'Unlock engine',
    ur: 'Access'
  }] as
  const;
  const order: Record<string, number> = {
    not_paid: 0,
    choose_plan: 0,
    pay: 0,
    pending: 1,
    approved: 2
  };
  const current = order[stage] ?? 0;
  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <Fragment key={s.key}>
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-2xs font-bold border ${done ? 'bg-buy/20 border-buy/50 text-buy' : active ? 'bg-brand/20 border-brand/60 text-brand' : 'bg-bg-800 border-line text-ink-dim'}`}>
                
                {done ? <CheckIcon className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <div className="hidden sm:block">
                <p
                  className={`text-2xs font-semibold ${active ? 'text-ink' : 'text-ink-muted'}`}>
                  
                  {s.label}
                </p>
                <p className="text-2xs text-ink-dim italic leading-none">
                  {s.ur}
                </p>
              </div>
            </div>
            {i < steps.length - 1 &&
            <div
              className={`h-px w-6 sm:w-10 ${i < current ? 'bg-buy/50' : 'bg-line'}`} />

            }
          </Fragment>);

      })}
    </div>);

}
// ============================================================
// Stage: not_paid — payment is required to continue
// ============================================================
function PaymentRequiredPanel({ onStart }: {onStart: () => void;}) {
  return (
    <div className="bg-bg-700/80 backdrop-blur-md border border-brand/30 rounded-md p-6 brand-glow">
      <div className="flex items-center gap-2 mb-3">
        <CreditCardIcon className="w-4 h-4 text-brand" />
        <h2 className="font-bold">Payment required to activate</h2>
      </div>
      <p className="text-2xs text-ink-muted leading-relaxed mb-1">
        Your account is created. To unlock the engine, choose a plan and pay
        with USDT (crypto). Submit your transaction screenshot and the admin
        will verify it.
      </p>
      <p className="text-2xs text-ink-dim italic leading-relaxed mb-4">
        Aap ka account ban gaya hai. Engine unlock karne ke liye plan chunein
        aur USDT (crypto) se payment karein. Screenshot bhejein, admin verify
        kare ga.
      </p>
      <div className="grid sm:grid-cols-3 gap-2.5 mb-5">
        {[
        {
          icon: WalletIcon,
          en: 'Crypto wallet',
          ur: 'Wallet + QR'
        },
        {
          icon: CheckCircle2Icon,
          en: 'Upload proof',
          ur: 'Screenshot'
        },
        {
          icon: ShieldAlertIcon,
          en: 'Admin verifies',
          ur: 'Verify'
        }].
        map((f) =>
        <div
          key={f.en}
          className="bg-bg-800 border border-line rounded p-3 flex items-center gap-2">
          
            <f.icon className="w-4 h-4 text-brand shrink-0" />
            <div className="min-w-0">
              <p className="text-2xs font-semibold text-ink truncate">{f.en}</p>
              <p className="text-2xs text-ink-dim italic truncate">{f.ur}</p>
            </div>
          </div>
        )}
      </div>
      <Button variant="primary" size="lg" className="w-full" onClick={onStart}>
        Choose a plan & pay <ArrowRightIcon className="w-4 h-4" />
      </Button>
    </div>);

}
// ============================================================
// Stage: choose_plan — pick a plan, then go to payment
// ============================================================
function PlanSelectPanel({
  plans,
  selectedPlan,
  onSelect,
  onBack





}: {plans: ReturnType<typeof useMembershipPlans>;selectedPlan: string;onSelect: (id: string) => void;onBack: () => void;}) {
  return (
    <div className="bg-bg-700/80 backdrop-blur-md border border-brand/30 rounded-md p-6 brand-glow">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <ZapIcon className="w-4 h-4 text-brand" />
          <h2 className="font-bold">Choose your plan · Apna plan chunein</h2>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="text-2xs text-brand hover:underline inline-flex items-center gap-1">
          
          <ArrowLeftIcon className="w-3 h-3" /> Back
        </button>
      </div>
      <p className="text-2xs text-ink-dim mb-4 leading-relaxed">
        Every plan unlocks the complete BULLER TRADING workspace; only validity and price differ.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {plans.length === 0 &&
        <div className="sm:col-span-2 lg:col-span-4 rounded-md border border-line bg-bg-800 p-6 text-center text-xs text-ink-muted">
            Plans are temporarily unavailable. Please contact the admin before making a payment.
          </div>
        }
        {plans.map((p) =>
        <button
          key={p.id}
          type="button"
          onClick={() => onSelect(p.id)}
          className={`text-left p-4 rounded-md border bg-bg-800 transition-all hover:border-brand/60 hover:-translate-y-0.5 ${p.id === selectedPlan || p.popular || p.bestValue ? 'border-brand/60 brand-glow' : 'border-line'}`}>
          
            {(p.popular || p.bestValue) &&
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand/15 text-brand text-2xs font-bold rounded-full mb-2 uppercase tracking-wider">
                <ZapIcon className="w-3 h-3" />
                {p.popular ? 'Popular' : 'Best value'}
              </span>
          }
            <h3 className="text-base font-bold">{p.name}</h3>
            <p className="mt-1">
              <span className="text-2xl font-bold">{p.price}</span>
              <span className="text-xs text-ink-muted"> / {p.duration}</span>
            </p>
            <ul className="mt-3 space-y-1.5 text-2xs text-ink-muted">
              {(p.features.length ? p.features : SHARED_PLAN_FEATURES).
            slice(0, 4).
            map((f) =>
            <li key={f} className="flex items-start gap-1.5">
                  <CheckIcon className="w-3 h-3 text-buy mt-0.5 shrink-0" />
                  <span>{f}</span>
                </li>
            )}
            </ul>
            <span className="block w-full text-center mt-4 py-2 rounded font-bold text-xs bg-brand text-bg-900">
              Select {p.name}
            </span>
          </button>
        )}
      </div>
      <p className="text-2xs text-ink-dim mt-3 text-center">
        Same premium features in every plan.
      </p>
    </div>);

}
// ============================================================
// Stage: pending — payment submitted, awaiting admin verification
// ============================================================
function PendingPanel({ proof }: {proof?: PaymentProof;}) {
  return (
    <div className="bg-warn/5 border border-warn/30 rounded-md p-6">
      <div className="flex items-center gap-2 mb-3">
        <ClockIcon className="w-5 h-5 text-warn" />
        <h2 className="font-bold text-warn">
          Payment under review · Payment verify ho rahi hai
        </h2>
      </div>
      <p className="text-2xs text-ink-muted leading-relaxed mb-1">
        Your payment proof has been submitted to the admin. Once verified, your
        Master Gate Key will be delivered on WhatsApp and access will be granted
        — usually within 24 hours.
      </p>
      <p className="text-2xs text-ink-dim italic leading-relaxed mb-4">
        Aap ka payment proof admin ko bhej diya gaya hai. Verify hone ke baad
        gate key WhatsApp pe aayegi aur access mil jaye ga — aam tor par 24
        ghante ke andar.
      </p>

      {proof &&
      <div className="grid sm:grid-cols-3 gap-2.5">
          <Detail label="Plan" value={proof.plan} />
          <Detail
          label="Amount"
          value={`${proof.amount} ${proof.currency || 'USDT'}`} />
        
          <Detail
          label="Status"
          value={proof.status === 'verified' ? 'Verified' : 'Pending'} />
        
          {proof.network && <Detail label="Network" value={proof.network} />}
          {proof.txid && <Detail label="TXID" value={proof.txid} mono />}
          <Detail
          label="Submitted"
          value={new Date(proof.createdAt).toLocaleString()} />
        
        </div>
      }

      {proof?.proofUrl &&
      <div className="mt-3">
          <p className="text-2xs uppercase tracking-wider text-ink-dim mb-1.5">
            Your submitted screenshot
          </p>
          <a
          href={proof.proofUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded border border-line overflow-hidden">
          
            <img
            src={proof.proofUrl}
            alt="Your payment proof"
            className="w-full max-h-44 object-contain bg-bg-900" />
          
          </a>
        </div>
      }

      <p className="text-2xs text-ink-dim mt-4 text-center">
        This screen updates automatically once the admin approves your payment.
      </p>
    </div>);

}
function Detail({
  label,
  value,
  mono




}: {label: string;value: string;mono?: boolean;}) {
  return (
    <div className="bg-bg-800 border border-line rounded p-3">
      <p className="text-2xs uppercase tracking-wider text-ink-dim">{label}</p>
      <p
        className={`text-xs font-semibold mt-0.5 truncate ${mono ? 'font-mono' : ''}`}>
        
        {value}
      </p>
    </div>);

}
// ============================================================
// Stage: approved — enter the Master Gate Key
// ============================================================
function ApprovedKeyPanel({ onUnlocked }: {onUnlocked: () => void;}) {
  const { user } = useAuth();
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [denied, setDenied] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || submitting) return;
    if (!agreed) {
      setError('You must accept the rules first.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await activateMasterKey(pw);
      onUnlocked();
    } catch (activationError) {
      const a = attempts + 1;
      setAttempts(a);
      setError(
        activationError instanceof Error ?
        activationError.message :
        'Invalid or expired master key. Contact admin for a new key.'
      );
      if (a >= 3) setDenied(true);
    } finally {
      setSubmitting(false);
    }
  };
  const nav = useNavigate();
  useEffect(() => {
    if (denied) {
      const t = setTimeout(() => nav('/access-denied'), 1200);
      return () => clearTimeout(t);
    }
  }, [denied, nav]);
  return (
    <>
      {/* Payment verified banner */}
      <div className="bg-buy/5 border border-buy/30 rounded-md p-4 flex items-center gap-3">
        <CheckCircle2Icon className="w-6 h-6 text-buy shrink-0" />
        <div>
          <p className="font-bold text-buy text-sm">
            Payment verified · Payment approved
          </p>
          <p className="text-2xs text-ink-muted">
            Enter the Master Gate Key from your WhatsApp to unlock the engine.
          </p>
        </div>
      </div>

      <RulesPanel agreed={agreed} onAgree={setAgreed} />

      <div className="bg-bg-700/80 backdrop-blur-md border border-brand/30 rounded-md p-6 brand-glow">
        <div className="flex items-center gap-2 mb-3">
          <LockIcon className="w-4 h-4 text-brand" />
          <h2 className="font-bold">Master Gate Key</h2>
        </div>
        <p className="text-2xs text-ink-muted mb-3 leading-relaxed">
          Enter the Master Gate Key delivered to your WhatsApp after admin
          approval.
          <span className="block text-ink-dim mt-0.5">
            Apni Master Gate Key dalein jo admin ne WhatsApp pe bheji hai.
          </span>
        </p>
        <form onSubmit={onSubmit} className="space-y-3">
          <Input
            label="Master Gate Key"
            type="text"
            icon={<LockIcon className="w-4 h-4" />}
            placeholder="AZH-TRD-XXXX-XXXX"
            value={pw}
            onChange={(e) => {
              setPw(e.target.value.toUpperCase());
              setError('');
            }}
            error={error}
            autoFocus
            required />
          
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            disabled={denied || !agreed || submitting}
            icon={submitting ? <Loader2Icon className="w-4 h-4 animate-spin" /> : undefined}>
            
            {denied ? 'Access denied' : 'Unlock engine'}{' '}
            <ArrowRightIcon className="w-4 h-4" />
          </Button>
          <div className="text-2xs text-ink-dim text-center uppercase tracking-wider">
            Attempts remaining: {Math.max(0, 3 - attempts)}
          </div>
        </form>
      </div>
    </>);

}
// ============================================================
// Rules & Regulations panel (bilingual)
// ============================================================
function RulesPanel({
  agreed,
  onAgree



}: {agreed: boolean;onAgree: (v: boolean) => void;}) {
  const RULES: Array<{
    en: string;
    ur: string;
  }> = [
  {
    en: 'One device per account only.',
    ur: 'Ek account ke liye sirf ek device.'
  },
  {
    en: 'Payment confirmation is required to activate access.',
    ur: 'Access activate karne ke liye payment confirm karna zaruri hai.'
  },
  {
    en: 'Your master key is non-transferable. Never share it.',
    ur: 'Master key kisi ke saath share na karein.'
  },
  {
    en: 'KYC verification is required after payment.',
    ur: 'Payment ke baad KYC verify karwana zaruri hai.'
  },
  {
    en: 'Account validity depends on the plan you choose.',
    ur: 'Account ki validity aap ke chosen plan par depend karti hai.'
  },
  {
    en: 'Any suspicious activity = permanent ban without refund.',
    ur: 'Mashkook (suspicious) activity par account permanently ban hoga.'
  }];

  return (
    <div className="bg-warn/5 border border-warn/30 rounded-md p-5">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangleIcon className="w-4 h-4 text-warn" />
        <h2 className="font-bold text-warn">Rules & Regulations · Qawaaneen</h2>
      </div>
      <ul className="space-y-2.5 mb-4">
        {RULES.map((r, i) =>
        <li
          key={i}
          className="text-xs leading-relaxed pl-4 border-l-2 border-warn/30">
          
            <div className="text-ink">{r.en}</div>
            <div className="text-ink-dim italic">{r.ur}</div>
          </li>
        )}
      </ul>
      <label className="flex items-start gap-2 text-2xs text-ink-muted leading-relaxed cursor-pointer">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => onAgree(e.target.checked)}
          className="accent-brand mt-0.5" />
        
        <span>
          <span className="text-ink font-semibold">
            I have read and accept the rules
          </span>
          <span className="block text-ink-dim">
            Maine parh liye hain aur manzoor hain.
          </span>
        </span>
      </label>
    </div>);

}
// ============================================================
// Admin contact panel
// ============================================================
function AdminContactPanel() {
  const adminName = useContent('admin.contact.name', '(R.D.H;~$)');
  const whatsapp = useContent('admin.contact.whatsapp', '+92 300 0000000');
  const responseTime = useContent(
    'admin.contact.responseTime',
    'Typically within 24 hours'
  );
  const waLink = `https://wa.me/${whatsapp.replace(/[^\d]/g, '')}`;
  return (
    <div className="bg-bg-700/60 border border-line rounded-md p-5">
      <div className="flex items-center gap-2 mb-3">
        <PhoneIcon className="w-4 h-4 text-buy" />
        <h2 className="font-bold">Need help? Admin contact</h2>
      </div>
      <div className="grid sm:grid-cols-2 gap-3 text-xs">
        <div>
          <div className="text-2xs uppercase tracking-wider text-ink-dim font-bold">
            Admin
          </div>
          <div className="font-mono text-ink">{adminName}</div>
        </div>
        <div>
          <div className="text-2xs uppercase tracking-wider text-ink-dim font-bold">
            Response time
          </div>
          <div className="text-ink-muted">{responseTime}</div>
        </div>
        <div className="sm:col-span-2">
          <div className="text-2xs uppercase tracking-wider text-ink-dim font-bold">
            WhatsApp
          </div>
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-brand hover:underline font-mono">
            
            <CheckIcon className="w-3.5 h-3.5" />
            {whatsapp}
          </a>
        </div>
      </div>
    </div>);

}