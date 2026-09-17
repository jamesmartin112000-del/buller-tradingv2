import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  LockIcon,
  MailIcon,
  ArrowRightIcon,
  ShieldCheckIcon,
  AlertCircleIcon,
  Loader2Icon,
  XIcon,
  CheckCircle2Icon } from
'lucide-react';
import { useAuth } from '../context/AuthContext';
import { HeroLogoWatermark } from '../components/common/HeroLogoWatermark';
import { Logo } from '../components/common/Logo';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { BackHomeLink } from '../components/common/BackHomeLink';
import { motion, AnimatePresence } from 'framer-motion';
export function Login() {
  const {
    user,
    signIn,
    sendReset,
    backendReady,
    authError,
    clearAuthError
  } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [awaitingAuth, setAwaitingAuth] = useState(false);
  const [error, setError] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  useEffect(() => {
    if (!user) return;
    const dest =
    user.role === 'admin' || user.role === 'super_admin' ?
    '/app/dashboard' :
    '/gate';
    nav(dest, { replace: true });
  }, [user, nav]);
  useEffect(() => {
    if (!authError) return;
    setSubmitting(false);
    setAwaitingAuth(false);
    setError(authError);
    clearAuthError();
  }, [authError, clearAuthError]);
  useEffect(() => {
    if (!awaitingAuth || user) return;
    const timeout = window.setTimeout(() => {
      setAwaitingAuth(false);
      setError('Sign-in is taking longer than expected. Please try once more.');
    }, 12000);
    return () => window.clearTimeout(timeout);
  }, [awaitingAuth, user]);
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }
    if (!backendReady) {
      setError('Authentication service is unavailable. Please try again later.');
      return;
    }
    setSubmitting(true);
    const res = await signIn(email, password);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error || 'Sign-in failed.');
      return;
    }
    // Show the spinner until AuthContext.user becomes truthy and the
    // useEffect above navigates us away. This prevents the user from
    // mashing the button twice while auth is still hydrating.
    setAwaitingAuth(true);
  };
  const loading = submitting || awaitingAuth;
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
          <div className="text-center mb-6 sm:mb-7">
            <div className="flex justify-center mb-5">
              <Logo size="lg" showText={false} />
            </div>
            <h1 className="text-2xl font-bold">Welcome to BULLER TRADING</h1>
            <p className="text-sm text-ink-muted mt-1">
              Sign in to your gold trading workspace
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              icon={<MailIcon className="w-4 h-4" />}
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError('');
              }}
              autoComplete="email"
              required />
            
            <Input
              label="Password"
              type="password"
              icon={<LockIcon className="w-4 h-4" />}
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              autoComplete="current-password"
              required />
            

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

            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-1.5 text-ink-muted">
                <input
                  type="checkbox"
                  className="accent-brand"
                  defaultChecked />
                
                Keep me signed in
              </label>
              <button
                type="button"
                onClick={() => setResetOpen(true)}
                className="text-brand hover:underline">
                
                Forgot password?
              </button>
            </div>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              disabled={loading}>
              
              {loading ?
              <>
                  <Loader2Icon className="w-4 h-4 animate-spin" />
                  Signing in…
                </> :

              <>
                  Sign in <ArrowRightIcon className="w-4 h-4" />
                </>
              }
            </Button>
          </form>

          <div className="mt-6 flex items-center justify-center gap-2 text-2xs text-ink-dim">
            <ShieldCheckIcon className="w-3.5 h-3.5 text-brand" />
            Secured by Firebase Authentication
          </div>

          <div className="mt-6 text-center text-sm text-ink-muted">
            New here?{' '}
            <Link
              to="/signup"
              className="text-brand hover:underline font-semibold">
              
              Request access
            </Link>
          </div>
        </div>

        <div className="mt-5 text-center text-2xs text-ink-dim uppercase tracking-[0.18em]">
          Author · (R.D.H;~$)
        </div>
      </motion.div>

      <AnimatePresence>
        {resetOpen &&
        <ResetPasswordModal
          initialEmail={email}
          onClose={() => setResetOpen(false)}
          sendReset={sendReset} />

        }
      </AnimatePresence>
    </div>);

}
function ResetPasswordModal({
  initialEmail,
  onClose,
  sendReset







}: {initialEmail: string;onClose: () => void;sendReset: (email: string) => Promise<{ok: boolean;error?: string;}>;}) {
  const [email, setEmail] = useState(initialEmail);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const onSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Enter your email to receive a reset link.');
      return;
    }
    setSending(true);
    setError('');
    const res = await sendReset(email);
    setSending(false);
    if (!res.ok) {
      setError(res.error || 'Could not send reset email.');
      return;
    }
    setSent(true);
  };
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
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      
      <motion.div
        initial={{
          scale: 0.95,
          opacity: 0
        }}
        animate={{
          scale: 1,
          opacity: 1
        }}
        exit={{
          scale: 0.95,
          opacity: 0
        }}
        onClick={(e) => e.stopPropagation()}
        className="bg-bg-700 border border-brand/30 rounded-md w-full max-w-sm p-6 brand-glow relative">
        
        <button
          type="button"
          onClick={onClose}
          aria-label="Close password reset"
          className="absolute top-3 right-3 rounded-md p-2 text-ink-dim transition-colors hover:bg-brand/10 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60">
          
          <XIcon className="w-4 h-4" />
        </button>

        {sent ?
        <div className="text-center py-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-buy/15 border border-buy/30 flex items-center justify-center mb-3">
              <CheckCircle2Icon className="w-6 h-6 text-buy" />
            </div>
            <h3 className="text-lg font-bold mb-1">Check your inbox</h3>
            <p className="text-xs text-ink-muted mb-4">
              We sent a password reset link to{' '}
              <span className="font-mono text-ink">{email}</span>.
            </p>
            <Button variant="primary" className="w-full" onClick={onClose}>
              Done
            </Button>
          </div> :

        <form onSubmit={onSend}>
            <h3 className="text-lg font-bold mb-1">Reset your password</h3>
            <p className="text-xs text-ink-muted mb-4">
              Enter your account email and we'll send you a reset link.
            </p>
            <Input
            label="Email"
            type="email"
            icon={<MailIcon className="w-4 h-4" />}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError('');
            }}
            autoFocus
            required />
          
            {error &&
          <div className="mt-2 flex items-start gap-2 bg-sell/10 border border-sell/30 rounded px-3 py-2 text-2xs text-sell">
                <AlertCircleIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
          }
            <div className="flex gap-2 mt-4">
              <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={onClose}>
              
                Cancel
              </Button>
              <Button
              type="submit"
              variant="primary"
              className="flex-1"
              disabled={sending}>
              
                {sending ? 'Sending…' : 'Send reset link'}
              </Button>
            </div>
          </form>
        }
      </motion.div>
    </motion.div>);

}