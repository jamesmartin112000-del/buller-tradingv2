import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XIcon,
  ShieldCheckIcon,
  Loader2Icon,
  CheckCircle2Icon } from
'lucide-react';
import {
  verifyPasswordAndGetUid,
  generateFingerprint,
  submitDeviceChangeRequest } from
'../../lib/backend/deviceLockService';
interface RegisterDeviceModalProps {
  open: boolean;
  onClose: () => void;
  /** Optionally prefill + lock the email field (when already signed in). */
  defaultEmail?: string;
  lockEmail?: boolean;
  /**
   * uid of the already-authenticated/locked session. Used as a fallback to
   * file the request even when live password re-verification can't complete
   * (e.g. Firebase unavailable), so the request always reaches the admin.
   */
  fallbackUid?: string;
  /** Whether this is an account-unlock request or a device-change request. */
  requestType?: 'unlock' | 'device_change';
}
/**
 * Self-contained "Register New Device" / Device Change Request modal.
 *
 * Validates the account password via Firebase Auth (no password is ever
 * stored), generates this device's fingerprint, and writes a pending
 * request to Firestore (deviceChangeRequests).
 *
 * Works both inside the app (signed-in, on the warning screen) and from the
 * public landing page (signed-out) — verifyPasswordAndGetUid handles both.
 */
export function RegisterDeviceModal({
  open,
  onClose,
  defaultEmail = '',
  lockEmail = true,
  fallbackUid,
  requestType = 'device_change'
}: RegisterDeviceModalProps) {
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setEmail(defaultEmail);
      setPassword('');
      setReason('');
      setError(null);
      setDone(false);
      setRequestId(null);
      setSubmitting(false);
    }
  }, [open, defaultEmail]);
  if (!open) return null;
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password || !reason.trim()) {
      setError('Please fill in your email, password and a reason.');
      return;
    }
    setSubmitting(true);
    try {
      console.log('[deviceLock] modal: verifying password…');
      const uid = await verifyPasswordAndGetUid(email, password);
      const fp = await generateFingerprint();
      const result = await submitDeviceChangeRequest({
        uid,
        email,
        newFingerprint: fp,
        reason
      });
      if (!result.success) {
        // A request for this device may already be pending — treat that as
        // a "submitted" state so the user sees their existing request id.
        if (result.requestId) {
          setRequestId(result.requestId);
          setDone(true);
        } else {
          setError(result.message);
        }
        setSubmitting(false);
        return;
      }
      setRequestId(result.requestId || null);
      setDone(true);
    } catch (err: any) {
      setError(err?.message || 'Could not submit request.');
    } finally {
      setSubmitting(false);
    }
  };
  return createPortal(
    <AnimatePresence>
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
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="register-device-title">
        
        <motion.div
          initial={{
            opacity: 0,
            scale: 0.96,
            y: 12
          }}
          animate={{
            opacity: 1,
            scale: 1,
            y: 0
          }}
          exit={{
            opacity: 0,
            scale: 0.96,
            y: 12
          }}
          transition={{
            type: 'spring',
            stiffness: 320,
            damping: 28
          }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden">
          
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/60">
            <div className="flex items-center gap-2">
              <ShieldCheckIcon className="w-5 h-5 text-emerald-400" />
              <h2
                id="register-device-title"
                className="text-base font-semibold text-white">
                
                Register New Device
              </h2>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="text-slate-400 hover:text-white transition-colors">
              
              <XIcon className="w-5 h-5" />
            </button>
          </div>

          {done ?
          <div className="p-8 text-center">
              <CheckCircle2Icon className="w-14 h-14 text-emerald-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">
                Request Submitted
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Your request has been submitted. Admin will review your request.
                You will receive an update within 24 hours via WhatsApp.
              </p>
              {requestId &&
            <div className="mt-4 bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2.5">
                  <p className="text-2xs uppercase tracking-wider text-slate-500 font-semibold mb-0.5">
                    Request ID
                  </p>
                  <p className="text-xs font-mono text-emerald-300 break-all">
                    {requestId}
                  </p>
                </div>
            }
              <button
              onClick={onClose}
              className="mt-6 w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors">
              
                Done
              </button>
            </div> :

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                Verify your account and tell us why you need to switch devices.
                An admin will review and approve your request.
              </p>

              <div>
                <label
                htmlFor="rd-email"
                className="block text-xs font-medium text-slate-300 mb-1.5">
                
                  Email
                </label>
                <input
                id="rd-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                placeholder="you@example.com" />
              
              </div>

              <div>
                <label
                htmlFor="rd-password"
                className="block text-xs font-medium text-slate-300 mb-1.5">
                
                  Password
                </label>
                <input
                id="rd-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                placeholder="Your account password" />
              
                <p className="mt-1 text-2xs text-slate-500">
                  Your password is verified securely and never stored.
                </p>
              </div>

              <div>
                <label
                htmlFor="rd-reason"
                className="block text-xs font-medium text-slate-300 mb-1.5">
                
                  Reason
                </label>
                <textarea
                id="rd-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
                placeholder="e.g. Old laptop broken, new device purchased, travelling…" />
              
              </div>

              {error &&
            <div className="bg-red-900/20 border border-red-700/30 text-red-300 text-xs rounded-lg px-3 py-2">
                  {error}
                </div>
            }

              <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
              
                {submitting && <Loader2Icon className="w-4 h-4 animate-spin" />}
                {submitting ? 'Submitting…' : 'Submit Request'}
              </button>
            </form>
          }
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}