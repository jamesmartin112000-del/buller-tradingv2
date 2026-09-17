import React from 'react';
/**
 * Route guards — production-grade replacements for the inline `if (!user)`
 * checks scattered through the app. Each guard handles the loading state
 * properly so users never see a redirect-flicker on hard reload.
 */
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2Icon, ShieldAlertIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUserAccount } from '../../context/UserAccountContext';
function FullPageSpinner({ label = 'Loading…' }: {label?: string;}) {
  return (
    <div className="min-h-screen w-full bg-bg flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2Icon className="w-7 h-7 text-brand animate-spin" />
        <div className="text-2xs uppercase tracking-[0.18em] text-ink-muted font-bold">
          {label}
        </div>
      </div>
    </div>);

}
/** Require any signed-in user. */
export function ProtectedRoute({ children }: {children?: React.ReactNode;}) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <FullPageSpinner label="Authenticating" />;
  if (!user)
  return (
    <Navigate
      to="/login"
      replace
      state={{
        from: loc.pathname
      }} />);


  return <>{children ?? <Outlet />}</>;
}
/**
 * SubscriptionGuard — gates premium routes.
 *
 * Philosophy: this guard only blocks when the user is *fundamentally*
 * not allowed to use the app (banned / locked / expired validity). KYC
 * and payment-pending states are NOT blocked here — the AppShell renders
 * the KYC / payment-pending overlays on top of every premium page, so
 * the experience is consistent and the user never gets bounced into an
 * unexpected redirect.
 *
 * Previous behaviour required all of (approved + kycApproved +
 * paymentApproved + subscriptionActive). That silently kicked every
 * fresh Master-Key user back to /dashboard the moment they clicked
 * Signals / Scalping / Charts / etc — because grantValidity sets the
 * payment + subscription flags but NOT kycApproved.
 *
 * Super admins / admins bypass via AuthContext role projection.
 */
export function SubscriptionGuard({
  children


}: {children?: React.ReactNode;}) {
  const { user, loading } = useAuth();
  const account = useUserAccount();
  if (loading) return <FullPageSpinner label="Verifying access" />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'super_admin' || user.role === 'admin') {
    return <>{children ?? <Outlet />}</>;
  }
  // Use the same live Firestore-backed source as AppShell.
  if (account.isBanned || account.isLocked || account.isExpired) {
    // Bounce to dashboard where the AppShell overlays the appropriate
    // lock screen (AccountLockedScreen / AccessDenied flow).
    return <Navigate to="/app/dashboard" replace />;
  }
  return <>{children ?? <Outlet />}</>;
}
/** Require admin or super_admin role. */
export function AdminRoute({ children }: {children?: React.ReactNode;}) {
  const { user, loading } = useAuth();
  if (loading) return <FullPageSpinner label="Verifying access" />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin' && user.role !== 'super_admin') {
    return (
      <div className="min-h-screen w-full bg-bg flex items-center justify-center p-6">
        <div className="bg-bg-700 border border-sell/40 rounded-md p-8 max-w-md text-center">
          <ShieldAlertIcon className="w-10 h-10 text-sell mx-auto mb-3" />
          <h2 className="text-xl font-bold">Admin Access Required</h2>
          <p className="text-sm text-ink-muted mt-2">
            Your account does not have permission to access this area.
          </p>
        </div>
      </div>);

  }
  return <>{children ?? <Outlet />}</>;
}
/** Require super_admin role only. */
export function SuperAdminRoute({ children }: {children?: React.ReactNode;}) {
  const { user, loading } = useAuth();
  if (loading) return <FullPageSpinner label="Verifying access" />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'super_admin') {
    return <Navigate to="/app/dashboard" replace />;
  }
  return <>{children ?? <Outlet />}</>;
}
/** Inverse — only render to signed-OUT users (e.g. login page). */
export function GuestRoute({ children }: {children?: React.ReactNode;}) {
  const { user, loading } = useAuth();
  if (loading) return <FullPageSpinner label="Checking session" />;
  if (user) return <Navigate to="/app/dashboard" replace />;
  return <>{children ?? <Outlet />}</>;
}