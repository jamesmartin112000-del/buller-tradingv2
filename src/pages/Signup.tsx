import React, { useEffect, useState, Component } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  LockIcon,
  MailIcon,
  UserIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  AlertCircleIcon,
  Loader2Icon,
  CheckIcon,
  CheckCircle2Icon,
  PhoneIcon,
  RefreshCwIcon,
  AtSignIcon,
  ZapIcon,
  MessageCircleIcon } from
'lucide-react';
import { useAuth } from '../context/AuthContext';
import { HeroLogoWatermark } from '../components/common/HeroLogoWatermark';
import { Logo } from '../components/common/Logo';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { BackHomeLink } from '../components/common/BackHomeLink';
import { motion, AnimatePresence } from 'framer-motion';
import { fsSet, fsUpdate } from '../lib/backend/docStore';
import { cacheLocalRecord, db } from '../lib/db/store';
import { useMembershipPlans } from '../hooks/useMembershipPlans';
import { useScreenInit } from '../useScreenInit.js';
import { CryptoPaymentScreen } from '../components/signup/CryptoPaymentScreen';
import { SHARED_PLAN_FEATURES } from '../lib/data/plans';
// WhatsApp number the admin receives payment messages on. Replace with the
// real admin number in production.
const ADMIN_WHATSAPP = '92XXXXXXXXXX';
/** Generates a unique username from an email + random suffix.
 *  Falls back to "trader_xxxx" if email is empty. */
function generateUsername(email: string): string {
  const base = (email.split('@')[0] || 'trader').
  toLowerCase().
  replace(/[^a-z0-9]/g, '').
  slice(0, 10);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base || 'trader'}_${suffix}`;
}
export function Signup() {
  const { signUp, backendReady, validatePassword } = useAuth();
  const nav = useNavigate();
  const screenInit = useScreenInit();
  const availablePlans = useMembershipPlans();
  const [step, setStep] = useState<'plan' | 'form' | 'success'>(
    screenInit?.step as 'plan' | 'form' | 'success' || 'plan'
  );
  const [selectedPlan, setSelectedPlan] = useState('monthly');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [username, setUsername] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Captured at submit so the payment record can be linked to the exact user.
  const [createdUserId, setCreatedUserId] = useState<string | null>(null);
  const plan =
  availablePlans.find((candidate) => candidate.id === selectedPlan) ||
  availablePlans[0] || {
    id: 'monthly',
    name: 'Membership',
    price: '$0',
    amount: 0,
    duration: 'pending',
    days: 0,
    durationUnit: 'days' as const,
    durationCount: 0,
    devices: 1,
    description: '',
    features: []
  };
  const pwState = password ?
  validatePassword(password) :
  {
    ok: false
  };
  useEffect(() => {
    if (email) setUsername(generateUsername(email));
  }, [email]);
  const regenerateUsername = () => setUsername(generateUsername(email));
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name || !email || !password || !whatsapp) {
      setError('Please fill every required field. · Sab fields bharein.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match. · Password match nahi ho rahe.');
      return;
    }
    const pwCheck = validatePassword(password);
    if (!pwCheck.ok) {
      setError(pwCheck.reason || 'Password is too weak.');
      return;
    }
    const cleaned = whatsapp.replace(/[\s\-()]/g, '');
    if (!/^\+?\d{8,16}$/.test(cleaned)) {
      setError('Enter a valid WhatsApp number including country code.');
      return;
    }
    if (!agreed) {
      setError('You must accept the rules to continue.');
      return;
    }
    setLoading(true);
    if (!backendReady) {
      setError('Account service is temporarily unavailable. Please retry shortly.');
      setLoading(false);
      return;
    }
    const res = await signUp(email, password, name);
    if (!res.ok || !res.user) {
      setError(res.error || 'Account could not be created. Please try again.');
      setLoading(false);
      return;
    }
    const authUid = res.user.uid;
    setCreatedUserId(authUid);
    try {
      await fsUpdate('users', res.user.uid, {
        whatsapp: cleaned,
        username,
        plan: selectedPlan,
        updatedAt: Date.now()
      });
    } catch (err) {
      console.warn('[signup] profile extras will retry after login', err);
    }
    // AuthContext/userService owns users/{uid}. Do not perform a second full
    // profile write here: it can race profile creation and overwrite protected
    // access fields. The safe extras patch above is enough for Admin → Users.
    // Legacy access-request pipeline so the user shows up in the admin Access tab.
    try {
      const normEmail = email.trim().toLowerCase();
      const reqId =
      'req_' +
      Date.now().toString(36) +
      '_' +
      Math.random().toString(36).slice(2, 8);
      const alreadyPending = db.
      list('accessRequests').
      find((r) => r.email === normEmail && r.status === 'pending');
      if (!alreadyPending) {
        const accessRequest = {
          id: reqId,
          email: normEmail,
          name,
          reason: `Self-signup · ${plan.name} plan (${plan.amount})`,
          whatsapp: cleaned,
          requestedPlan: selectedPlan,
          agreedToRules: true,
          status: 'pending' as const,
          createdAt: Date.now()
        };
        await fsSet('access_requests', accessRequest, false);
        cacheLocalRecord('accessRequests', accessRequest as any);
        db.insert('notifications', {
          id: 'nt_' + Date.now().toString(36) + '_a',
          target: 'admin',
          title: 'New access request',
          body: `${name} (${normEmail}) signed up for ${plan.name} — WhatsApp ${cleaned}. Review in the Access tab.`,
          kind: 'access_request',
          read: false,
          createdAt: Date.now(),
          link: '/app/admin'
        });
        db.log('info', 'access', `Signup access request from ${normEmail}`);
      }
    } catch (err) {
      console.error('[signup] access request creation failed', err);
      setError(
        'Account created, but your access request could not be saved. Please retry from the Gate.'
      );
    }
    setLoading(false);
    try {
      sessionStorage.setItem('te.signupPlan', selectedPlan);
    } catch {}
    // Account created & authenticated → land on the gate, where the user
    // selects a plan and completes the crypto payment.
    nav('/gate');
  };
  // ---------- STEP 1: PLAN SELECTION ----------
  if (step === 'plan') {
    return (
      <div className="relative min-h-screen w-full hero-gradient flex items-center justify-center px-4 py-8 sm:py-10">
        <div className="absolute inset-0 grid-bg opacity-30" />
        <HeroLogoWatermark />
        <motion.div
          initial={{
            opacity: 0,
            y: 20
          }}
          animate={{
            opacity: 1,
            y: 0
          }}
          className="relative w-full max-w-5xl">
          
          <BackHomeLink className="mb-3" />
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <Logo size="lg" showText={false} />
            </div>
            <h1 className="text-2xl font-bold">Choose your plan</h1>
            <p className="text-sm text-ink-muted mt-1">
              Every plan unlocks the complete BULLER TRADING workspace — choose only how long you need it.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {availablePlans.length === 0 &&
            <div className="sm:col-span-2 lg:col-span-4 rounded-md border border-line bg-bg-700/80 p-8 text-center text-sm text-ink-muted">
                Plans are temporarily unavailable. Please return home or contact support.
              </div>
            }
            {availablePlans.map((p) =>
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setSelectedPlan(p.id);
                setStep('form');
              }}
              className={`relative text-left p-5 rounded-md border bg-bg-700/80 backdrop-blur-md transition-all hover:border-brand/60 hover:-translate-y-0.5 ${p.popular || p.bestValue ? 'border-brand/60 brand-glow' : 'border-line'}`}>
              
                {(p.popular || p.bestValue) &&
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-brand/15 text-brand text-2xs font-bold rounded-full mb-3 uppercase tracking-wider">
                    <ZapIcon className="w-3 h-3" />
                    {p.popular ? 'Most popular' : 'Best value'}
                  </span>
              }
                <h3 className="text-lg font-bold">{p.name}</h3>
                <p className="mt-1">
                  <span className="text-3xl font-bold">{p.price}</span>
                  <span className="text-sm text-ink-muted">
                    {' '}
                    / {p.duration}
                  </span>
                </p>
                <p className="text-2xs text-ink-dim mt-1 leading-relaxed">
                  {p.description}
                </p>
                <ul className="mt-4 space-y-2 text-2xs text-ink-muted">
                  {(p.features.length ? p.features : SHARED_PLAN_FEATURES).map((f) =>
                <li key={f} className="flex items-start gap-2">
                      <CheckIcon className="w-3.5 h-3.5 text-buy mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                )}
                </ul>
                <div className="mt-5">
                  <span
                  className={`block w-full text-center py-2.5 rounded font-bold text-sm ${p.popular || p.bestValue ? 'bg-brand text-bg-900' : 'bg-bg-800 border border-line text-ink'}`}>
                  
                    Select {p.name}
                  </span>
                </div>
              </button>
            )}
          </div>

          <p className="text-center text-2xs text-ink-dim mt-5">
            All plans include every premium feature — they differ only in
            validity and price.
          </p>

          <p className="text-center text-sm text-ink-muted mt-7">
            Already have an account?{' '}
            <Link
              to="/login"
              className="text-brand hover:underline font-semibold">
              
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>);

  }
  // ---------- STEP 3: SUCCESS → USDT crypto payment ----------
  if (step === 'success') {
    return (
      <CryptoPaymentScreen
        email={email}
        userId={createdUserId}
        whatsapp={whatsapp.replace(/[\s\-()]/g, '')}
        userName={name}
        plan={{
          id: plan.id,
          name: plan.name,
          amount: plan.amount,
          duration: plan.duration
        }}
        onBack={() => setStep('plan')} />);


  }
  // ---------- STEP 2: FORM ----------
  return (
    <div className="relative min-h-screen w-full hero-gradient flex items-center justify-center px-4 py-8 sm:py-10">
      <div className="absolute inset-0 grid-bg opacity-30" />
      <HeroLogoWatermark />
      <motion.div
        initial={{
          opacity: 0,
          y: 20
        }}
        animate={{
          opacity: 1,
          y: 0
        }}
        className="relative w-full max-w-md">
        
        <BackHomeLink className="mb-3" />
        <div className="bg-bg-700/85 backdrop-blur-md border border-line rounded-md p-5 sm:p-8 brand-glow">
          <div className="text-center mb-6">
            <div className="flex justify-center mb-4">
              <Logo size="lg" showText={false} />
            </div>
            <h1 className="text-2xl font-bold">Create account</h1>
            <p className="text-sm text-ink-muted mt-1">
              <span className="text-brand font-semibold">{plan.name}</span> plan
              · ${plan.amount} / {plan.duration} · {plan.devices} device
              {plan.devices > 1 ? 's' : ''}
            </p>
            <button
              type="button"
              onClick={() => setStep('plan')}
              className="text-2xs text-brand hover:underline mt-1 inline-flex items-center gap-1">
              
              <ArrowLeftIcon className="w-3 h-3" /> Change plan
            </button>
          </div>

          <form onSubmit={onSubmit} className="space-y-3.5">
            <Input
              label="Full name"
              icon={<UserIcon className="w-4 h-4" />}
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required />
            
            <Input
              label="Email"
              type="email"
              icon={<MailIcon className="w-4 h-4" />}
              placeholder="trader@institution.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required />
            
            <Input
              label="WhatsApp number (with country code)"
              type="tel"
              icon={<PhoneIcon className="w-4 h-4" />}
              placeholder="+92 300 1234567"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              autoComplete="tel"
              hint="The gate key will be delivered here after approval."
              required />
            

            <div>
              <label className="text-2xs uppercase tracking-wider text-ink-muted font-bold mb-1 block">
                Username (auto-generated · unique)
              </label>
              <div className="flex items-stretch gap-2">
                <div className="flex-1 flex items-center gap-2 bg-bg-800 border border-line rounded px-3 py-2 text-sm font-mono text-ink">
                  <AtSignIcon className="w-3.5 h-3.5 text-ink-dim" />
                  <span className="truncate">{username || 'auto-…'}</span>
                </div>
                <button
                  type="button"
                  onClick={regenerateUsername}
                  className="px-3 rounded bg-bg-800 border border-line text-ink-muted hover:text-brand hover:border-brand/40 transition-colors"
                  title="Regenerate username"
                  aria-label="Regenerate username">
                  
                  <RefreshCwIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <Input
              label="Password"
              type="password"
              icon={<LockIcon className="w-4 h-4" />}
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              hint="Use upper, lower and a number. 8+ characters."
              required />
            
            {password &&
            <PasswordChecklist pw={password} isValid={pwState.ok} />
            }
            <Input
              label="Confirm password"
              type="password"
              icon={<LockIcon className="w-4 h-4" />}
              placeholder="Repeat password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required />
            

            <label className="flex items-start gap-2 text-2xs text-ink-muted leading-relaxed pt-1">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="accent-brand mt-0.5" />
              
              <span>
                I agree to the rules — single-device policy, payment required
                for activation, gate key non-transferable.
                <span className="block text-ink-dim mt-0.5">
                  Maine rules parh liye — ek device, payment zaruri, key kisi ko
                  share nahi karna.
                </span>
              </span>
            </label>

            <AnimatePresence>
              {error &&
              <motion.div
                initial={{
                  opacity: 0,
                  y: -4
                }}
                animate={{
                  opacity: 1,
                  y: 0
                }}
                exit={{
                  opacity: 0
                }}
                className="flex items-start gap-2 bg-sell/10 border border-sell/30 rounded px-3 py-2 text-2xs text-sell">
                
                  <AlertCircleIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </motion.div>
              }
            </AnimatePresence>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              disabled={loading}>
              
              {loading ?
              <>
                  <Loader2Icon className="w-4 h-4 animate-spin" />
                  Creating account…
                </> :

              <>
                  Create account · {plan.name}{' '}
                  <ArrowRightIcon className="w-4 h-4" />
                </>
              }
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-ink-muted">
            Already have an account?{' '}
            <Link
              to="/login"
              className="text-brand hover:underline font-semibold">
              
              Sign in
            </Link>
          </div>
        </div>
      </motion.div>
    </div>);

}
function PasswordChecklist({ pw, isValid }: {pw: string;isValid: boolean;}) {
  const checks = [
  {
    label: '8+ characters',
    ok: pw.length >= 8
  },
  {
    label: 'Uppercase letter',
    ok: /[A-Z]/.test(pw)
  },
  {
    label: 'Lowercase letter',
    ok: /[a-z]/.test(pw)
  },
  {
    label: 'Number',
    ok: /[0-9]/.test(pw)
  }];

  return (
    <div className="grid grid-cols-2 gap-1.5 text-2xs">
      {checks.map((c) =>
      <div
        key={c.label}
        className={`flex items-center gap-1.5 ${c.ok ? 'text-buy' : 'text-ink-dim'}`}>
        
          <CheckIcon className={`w-3 h-3 ${c.ok ? '' : 'opacity-30'}`} />
          {c.label}
        </div>
      )}
      {isValid &&
      <div className="col-span-2 inline-flex items-center gap-1 text-2xs text-buy font-semibold">
          <CheckIcon className="w-3 h-3" /> Strong password
        </div>
      }
    </div>);

}