import React, { useEffect, useState, type ReactNode } from 'react';
import {
  BanIcon,
  AlertTriangleIcon,
  MonitorIcon,
  LaptopIcon,
  GlobeIcon,
  KeyIcon } from
'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDeviceLock } from '../hooks/useDeviceLock';
import { RegisterDeviceModal } from './account/RegisterDeviceModal';
interface DeviceLockGuardProps {
  children: ReactNode;
}
/**
 * Firestore-backed single-device guard.
 *
 * - ADMIN / SUPER_ADMIN bypass entirely (unlimited devices, never locked).
 * - Regular users get exactly ONE active device, enforced in Firestore.
 * - Real-time: if an admin locks the account, the user is signed out
 *   instantly; if an admin approves this device, access is granted instantly.
 */
export default function DeviceLockGuard({ children }: DeviceLockGuardProps) {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  // Admins never mount the lock logic.
  if (isAdmin) return <>{children}</>;
  return (
    <GuardedContent uid={user?.uid} email={user?.email} logout={logout}>
      {children}
    </GuardedContent>);

}
function GuardedContent({
  uid,
  email,
  logout,
  children





}: {uid?: string;email?: string;logout: () => Promise<void>;children: ReactNode;}) {
  const {
    isLoading,
    isAllowed,
    isLocked,
    needsRequest,
    warning,
    warnings,
    maxWarnings,
    currentDevice,
    isUnlimited,
    pendingRequestId,
    refresh,
    recheckPending
  } = useDeviceLock(uid, email);
  const [showModal, setShowModal] = useState(false);
  const closeModal = () => {
    setShowModal(false);
    // Pick up a freshly-submitted request without re-triggering a warning.
    recheckPending();
  };
  // Instant logout when an admin (or the 3rd warning) locks the account.
  useEffect(() => {
    if (isLocked) {
      console.warn('[deviceLock] account locked → signing out');
      const t = setTimeout(() => {
        logout().catch(() => {});
      }, 4000);
      return () => clearTimeout(t);
    }
  }, [isLocked, logout]);
  // Loading / fingerprinting
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Verifying your device…</p>
          <p className="text-xs text-slate-600 mt-2">
            Secure device fingerprinting in progress
          </p>
        </div>
      </div>);

  }
  // Unlimited devices → no rules apply. Render the app immediately.
  if (isUnlimited) {
    return (
      <div className="relative">
        <div className="fixed bottom-4 right-4 z-50">
          <div className="bg-slate-900/90 backdrop-blur-sm border border-amber-500/20 rounded-lg px-3 py-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
              <span className="text-amber-400 font-medium">
                Unlimited Devices
              </span>
            </div>
          </div>
        </div>
        {children}
      </div>);

  }
  // Locked
  if (isLocked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900/50 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900/80 rounded-2xl border border-red-500/30 p-8 text-center">
          <BanIcon className="w-14 h-14 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-red-400 mb-2">
            ACCOUNT LOCKED
          </h1>
          <div className="w-16 h-1 bg-red-500/50 mx-auto mb-4" />
          <p className="text-slate-300 mb-4 text-sm">
            Your account has been temporarily locked due to repeated
            unauthorized device access attempts.
          </p>
          <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-3 mb-4">
            <p className="inline-flex items-center gap-1.5 text-xs text-red-300">
              <AlertTriangleIcon className="w-3.5 h-3.5" />
              {Math.min(warnings, maxWarnings)}/{maxWarnings} warning limit
              reached
            </p>
          </div>
          {pendingRequestId &&
          <div className="bg-amber-900/20 border border-amber-700/30 rounded-lg p-3 mb-4 text-left">
              <p className="text-2xs uppercase tracking-wider text-amber-400 font-semibold mb-0.5">
                Unlock request pending
              </p>
              <p className="text-xs font-mono text-amber-200 break-all">
                {pendingRequestId}
              </p>
            </div>
          }
          <p className="text-slate-400 text-xs mb-6">
            Submit an unlock request to the administrator. They will review your
            account and remove the old device so you can log in again. You will
            be signed out shortly.
          </p>
          <div className="flex flex-col gap-3">
            {!pendingRequestId &&
            <button
              onClick={() => setShowModal(true)}
              className="w-full px-6 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-all text-sm font-medium">
              
                Request Account Unlock / New Device
              </button>
            }
            <button
              onClick={() => logout()}
              className="w-full px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-all text-sm font-medium">
              
              Sign Out
            </button>
          </div>
        </div>
        <RegisterDeviceModal
          open={showModal}
          onClose={closeModal}
          defaultEmail={email}
          lockEmail
          fallbackUid={uid}
          requestType="unlock" />
        
      </div>);

  }
  // Unauthorized device with an ALREADY-PENDING request → pending state.
  if (!isAllowed && needsRequest && pendingRequestId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-900/30 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900/80 rounded-2xl border border-amber-500/30 p-8 text-center">
          <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
            <div className="w-7 h-7 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          </div>
          <h1 className="text-xl font-bold text-amber-400 mb-2">
            Device Request Pending
          </h1>
          <div className="w-16 h-0.5 bg-amber-500/50 mx-auto mb-4" />
          <p className="text-slate-300 text-sm mb-4">
            Your request to register this device has been submitted and is
            waiting for admin approval. You'll get access here automatically the
            moment it's approved — no refresh needed.
          </p>
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2.5 mb-4 text-left">
            <p className="text-2xs uppercase tracking-wider text-slate-500 font-semibold mb-0.5">
              Request ID
            </p>
            <p className="text-xs font-mono text-amber-300 break-all">
              {pendingRequestId}
            </p>
          </div>
          <p className="text-slate-500 text-xs mb-6">
            Admin will review your request. You will receive an update within 24
            hours via WhatsApp.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => recheckPending()}
              className="w-full px-4 py-2.5 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-all text-sm">
              
              Check Status
            </button>
            <button
              onClick={() => logout()}
              className="w-full px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm">
              
              Sign Out
            </button>
          </div>
        </div>
      </div>);

  }
  // Unauthorized device → warning + request CTA
  if (!isAllowed && needsRequest) {
    return (
      <>
        <div className="min-h-screen bg-gradient-to-br from-yellow-900/30 to-slate-900 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900/80 rounded-2xl border border-yellow-500/30 p-8">
            <div className="text-center mb-6">
              <AlertTriangleIcon className="w-12 h-12 text-yellow-400 mx-auto mb-3" />
              <h1 className="text-xl font-bold text-yellow-400 mb-2">
                Unauthorized Device
              </h1>
              <div className="w-16 h-0.5 bg-yellow-500/50 mx-auto mb-4" />
              <p className="text-slate-300 text-sm">
                This device is not your registered device. Only one device can
                be active at a time.
              </p>
            </div>

            <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-lg p-3 mb-4">
              <p className="inline-flex items-center gap-1.5 text-xs text-yellow-300">
                <AlertTriangleIcon className="w-3.5 h-3.5" />
                Warning {Math.min(warnings, maxWarnings)}/{maxWarnings}
              </p>
              {warning &&
              <p className="text-xs text-slate-300 mt-1">{warning}</p>
              }
            </div>

            {currentDevice &&
            <div className="bg-slate-800/50 rounded-lg p-3 mb-4">
                <p className="text-xs text-slate-400 mb-2">Your Device Info:</p>
                <div className="space-y-1 text-xs text-slate-500">
                  <p className="inline-flex items-center gap-1.5">
                    <MonitorIcon className="w-3.5 h-3.5" />
                    {currentDevice.screen}
                  </p>
                  <p className="inline-flex items-center gap-1.5">
                    <LaptopIcon className="w-3.5 h-3.5" />
                    {currentDevice.platform}
                  </p>
                  <p className="inline-flex items-center gap-1.5">
                    <GlobeIcon className="w-3.5 h-3.5" />
                    {currentDevice.language}
                  </p>
                  <p className="inline-flex items-center gap-1.5">
                    <KeyIcon className="w-3.5 h-3.5" />
                    Device ID:{' '}
                    <span className="font-mono text-yellow-500/70">
                      {currentDevice.id.slice(0, 16)}…
                    </span>
                  </p>
                </div>
              </div>
            }

            <div className="flex flex-col gap-3">
              <button
                onClick={() => setShowModal(true)}
                className="w-full px-4 py-2.5 bg-yellow-600 text-white rounded-lg hover:bg-yellow-500 transition-all text-sm font-medium">
                
                Register New Device
              </button>
              <button
                onClick={() => refresh()}
                className="w-full px-4 py-2.5 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-all text-sm">
                
                Retry Detection
              </button>
            </div>
          </div>
        </div>
        <RegisterDeviceModal
          open={showModal}
          onClose={closeModal}
          defaultEmail={email}
          lockEmail
          fallbackUid={uid}
          requestType="device_change" />
        
      </>);

  }
  // Allowed → render the app with a verified badge.
  if (isAllowed) {
    return (
      <div className="relative">
        <div className="fixed bottom-4 right-4 z-50">
          <div className="bg-slate-900/90 backdrop-blur-sm border border-emerald-500/20 rounded-lg px-3 py-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-emerald-400 font-medium">
                Device Verified
              </span>
            </div>
          </div>
        </div>
        {children}
      </div>);

  }
  // Fallback (transient)
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <button
        onClick={() => refresh()}
        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-all">
        
        Verify Device
      </button>
    </div>);

}