import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  ShieldIcon,
  ShieldCheckIcon,
  AlertTriangleIcon,
  LockIcon } from
'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SecurityManager,
  type SecurityEvent,
  getSecurityConfig } from
'../../lib/security/SecurityManager';
import { useAuth } from '../../context/AuthContext';
/**
 * SecurityShell — wraps the app in protective overlays:
 *   • Inactivity lock screen (after 15 min idle)
 *   • Floating security toast (top-right, slide-in)
 *   • Bottom security badge
 *
 * Mounted inside AppShell (after auth gate) so unauthenticated routes
 * (login/signup/gate) remain unaffected.
 */
export function SecurityShell() {
  const { user } = useAuth();
  const [locked, setLocked] = useState(false);
  const [toast, setToast] = useState<{
    msg: string;
    tone: 'warn' | 'fail';
    id: number;
  } | null>(null);
  const managerRef = useRef<SecurityManager | null>(null);
  const toastTimer = useRef<number | null>(null);
  const showToast = useCallback(
    (msg: string, tone: 'warn' | 'fail' = 'warn') => {
      setToast({
        msg,
        tone,
        id: Date.now()
      });
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
      toastTimer.current = window.setTimeout(() => setToast(null), 4500);
    },
    []
  );
  const handleLock = useCallback(() => {
    setLocked(true);
  }, []);
  // No-op event handler — manager already persists to localStorage.
  const handleEvent = useCallback((_event: SecurityEvent) => {

    /* future: push to backend audit log */}, []);
  useEffect(() => {
    // Skip security in dev on localhost — keeps F12 etc. working during build
    const isLocalDev =
    typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.endsWith('.local'));
    // Allow override via localStorage flag (set az_security_off=1 to disable)
    const forceOff =
    typeof window !== 'undefined' &&
    localStorage.getItem('az_security_off') === '1';
    if (isLocalDev || forceOff) return;
    const mgr = new SecurityManager({
      onToast: showToast,
      onLock: handleLock,
      onEvent: handleEvent
    });
    mgr.init();
    managerRef.current = mgr;
    return () => {
      mgr.destroy();
      managerRef.current = null;
    };
  }, [showToast, handleLock, handleEvent]);
  const handleUnlock = (e?: React.FormEvent) => {
    e?.preventDefault();
    setLocked(false);
    managerRef.current?.unlock();
  };
  return (
    <>
      {/* === Toast === */}
      <AnimatePresence>
        {toast &&
        <motion.div
          key={toast.id}
          initial={{
            opacity: 0,
            x: 60
          }}
          animate={{
            opacity: 1,
            x: 0
          }}
          exit={{
            opacity: 0,
            x: 60
          }}
          transition={{
            duration: 0.2
          }}
          className="fixed top-4 right-4 z-[100] max-w-xs">
          
            <div
            className={`flex items-start gap-2 rounded-md border px-3 py-2.5 shadow-2xl backdrop-blur-md ${toast.tone === 'fail' ? 'bg-sell/15 border-sell/40' : 'bg-warn/15 border-warn/40'}`}>
            
              <AlertTriangleIcon
              className={`w-4 h-4 shrink-0 mt-0.5 ${toast.tone === 'fail' ? 'text-sell' : 'text-warn'}`} />
            
              <div>
                <div
                className={`text-2xs font-bold uppercase tracking-wider ${toast.tone === 'fail' ? 'text-sell' : 'text-warn'}`}>
                
                  Security Notice
                </div>
                <div className="text-2xs text-ink mt-0.5 leading-snug">
                  {toast.msg}
                </div>
              </div>
            </div>
          </motion.div>
        }
      </AnimatePresence>

      {/* === Lock screen === */}
      <AnimatePresence>
        {locked &&
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
          className="fixed inset-0 z-[200] bg-bg-900/95 backdrop-blur-lg flex items-center justify-center p-4">
          
            <motion.div
            initial={{
              scale: 0.92,
              opacity: 0
            }}
            animate={{
              scale: 1,
              opacity: 1
            }}
            className="bg-bg-600 border border-line rounded-lg p-8 max-w-sm w-full text-center shadow-2xl">
            
              <div className="w-14 h-14 rounded-md bg-brand/10 border border-brand/30 flex items-center justify-center mx-auto mb-4">
                <LockIcon className="w-7 h-7 text-brand" />
              </div>
              <h2 className="text-xl font-bold text-ink mb-1">
                Session Locked
              </h2>
              <p className="text-2xs text-ink-muted leading-relaxed mb-5">
                You were inactive for 15 minutes. Confirm you&apos;re still here
                to resume the trading terminal.
              </p>
              <form onSubmit={handleUnlock}>
                <button
                type="submit"
                className="w-full px-4 py-2.5 bg-brand text-bg-900 text-xs font-bold rounded hover:bg-gold-deep flex items-center justify-center gap-1.5 uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-900">
                
                  <ShieldCheckIcon className="w-3.5 h-3.5" />
                  Resume Session
                </button>
              </form>
              {user &&
            <div className="text-3xs text-ink-dim mt-4 font-mono">
                  Signed in as {user.email}
                </div>
            }
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {/* === Footer badge === */}
      <SecurityFooter />
    </>);

}
function SecurityFooter() {
  const cfg = getSecurityConfig();
  const activeCount = [
  cfg.blockRightClick,
  cfg.blockKeyboardShortcuts,
  cfg.detectDevTools,
  cfg.fingerprintCheck,
  cfg.antiScraping].
  filter(Boolean).length;
  if (activeCount === 0) return null;
  return (
    <div className="fixed bottom-2 left-1/2 -translate-x-1/2 z-[80] pointer-events-none">
      <div className="bg-bg-800/80 backdrop-blur-sm border border-line rounded-full px-3 py-1 flex items-center gap-1.5 shadow-lg">
        <span className="w-1.5 h-1.5 bg-buy rounded-full animate-pulse" />
        <ShieldIcon className="w-2.5 h-2.5 text-buy" />
        <span className="text-3xs uppercase tracking-wider text-ink-dim font-bold">
          BULLER TRADING SECURITY · {activeCount}/5 Active
        </span>
      </div>
    </div>);

}