import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { Toaster, toast } from 'sonner';
import { Loader2Icon } from 'lucide-react';
import { AuthProvider } from './context/AuthContext';
import { EngineProvider } from './context/EngineContext';
import { ScannerProvider } from './context/ScannerContext';
import { UserAccountProvider } from './context/UserAccountContext';
import { SelectedSymbolProvider } from './context/SelectedSymbolContext';
import { AppShell } from './components/layout/AppShell';
import { AdminRoute, SubscriptionGuard } from './components/guards/RouteGuards';
import { ChatWidget } from './components/chat/ChatWidget';
import { Logo } from './components/common/Logo';
import { SeoMetadata } from './components/common/SeoMetadata';
// ---------------------------------------------------------------------------
// Route-level code splitting.
//
// Every page is loaded lazily so the initial bundle only contains the shell,
// providers, and whatever route the user first lands on. Heavy pages
// (terminals, charts, engine dashboard) are only fetched when navigated to.
//
// lazy requires a module with a `default` export, so named-export pages
// are mapped to `{ default }` inline. Pages that already export default
// (GodSignal, TrapDetector) are imported directly.
// ---------------------------------------------------------------------------
const Landing = lazy(() =>
import('./pages/Landing').then((m) => ({
  default: m.Landing
}))
);
const Login = lazy(() =>
import('./pages/Login').then((m) => ({
  default: m.Login
}))
);
const Signup = lazy(() =>
import('./pages/Signup').then((m) => ({
  default: m.Signup
}))
);
const Gate = lazy(() =>
import('./pages/Gate').then((m) => ({
  default: m.Gate
}))
);
const AccessDenied = lazy(() =>
import('./pages/AccessDenied').then((m) => ({
  default: m.AccessDenied
}))
);
const Dashboard = lazy(() =>
import('./pages/Dashboard').then((m) => ({
  default: m.Dashboard
}))
);
const Signals = lazy(() =>
import('./pages/Signals').then((m) => ({
  default: m.Signals
}))
);
const News = lazy(() =>
import('./pages/News').then((m) => ({
  default: m.News
}))
);
const Calendar = lazy(() =>
import('./pages/Calendar').then((m) => ({
  default: m.Calendar
}))
);
const Calculators = lazy(() =>
import('./pages/Calculators').then((m) => ({
  default: m.Calculators
}))
);
const Journal = lazy(() =>
import('./pages/Journal').then((m) => ({
  default: m.Journal
}))
);
const Settings = lazy(() =>
import('./pages/Settings').then((m) => ({
  default: m.Settings
}))
);
const Admin = lazy(() =>
import('./pages/Admin').then((m) => ({
  default: m.Admin
}))
);
const EngineDashboard = lazy(() =>
import('./pages/EngineDashboard').then((m) => ({
  default: m.EngineDashboard
}))
);
const GodSignal = lazy(() => import('./pages/GodSignal'));
const TrapDetector = lazy(() => import('./pages/TrapDetector'));
const AdminPayments = lazy(() =>
import('./pages/admin/AdminPayments').then((m) => ({
  default: m.AdminPayments
}))
);
const AdminDevicePanel = lazy(() => import('./components/AdminDevicePanel'));
/** Full-screen fallback shown while a lazily-loaded route chunk is fetched. */
function RouteFallback() {
  return (
    <div className="min-h-screen w-full bg-bg flex flex-col items-center justify-center gap-4">
      <Logo variant="circle" size={96} showText={false} />
      <Loader2Icon className="w-6 h-6 text-brand animate-spin" aria-label="Loading" />
    </div>);

}
/**
 * Authenticated app shell. Device-lock restrictions (single-device policy,
 * warnings, unauthorized-device blocks) have been fully removed — every
 * signed-in user can access the app from any device with no warnings.
 */
function GuardedShell() {
  return <AppShell />;
}
function RuntimeErrorMonitor() {
  useEffect(() => {
    document.title = 'BULLER TRADING — Professional Gold Market Intelligence';
  }, []);
  useEffect(() => {
    const notify = (message: string, error: unknown) => {
      console.error(message, error);
      toast.error('A runtime error was contained. You can continue using BULLER TRADING.');
    };
    const onError = (event: ErrorEvent) => notify('Unhandled runtime error', event.error);
    const onRejection = (event: PromiseRejectionEvent) =>
    notify('Unhandled promise rejection', event.reason);
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);
  return null;
}

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <AuthProvider>
        <RuntimeErrorMonitor />
        <EngineProvider>
          <SelectedSymbolProvider>
            <ScannerProvider>
              <UserAccountProvider>
                <BrowserRouter>
                  <Toaster
                    theme="dark"
                    position="top-right"
                    toastOptions={{
                      style: {
                        background: '#15130f',
                        border: '1px solid rgba(226,191,118,0.42)',
                        color: '#f7f2e8'
                      }
                    }} />
                  
                <SeoMetadata />
                <Suspense fallback={<RouteFallback />}>
                  <Routes>
                    <Route path="/" element={<Landing />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />
                    <Route path="/gate" element={<Gate />} />
                    <Route path="/enter-key" element={<Navigate to="/gate" replace />} />
                    <Route
                        path="/device-change"
                        element={<Navigate to="/app/dashboard" replace />} />
                      
                    <Route path="/access-denied" element={<AccessDenied />} />

                    {/* This tool used to be publicly reachable — it is now
                        locked behind auth inside the /app shell. Bare path
                        redirects to its guarded equivalent. */}
                    <Route
                        path="/engine"
                        element={<Navigate to="/app/engine" replace />} />
                      

                    <Route path="/app" element={<GuardedShell />}>
                      <Route
                          index
                          element={<Navigate to="/app/dashboard" replace />} />
                        
                      {/* AppShell is the hard account boundary; restricted users never mount this route. */}
                      <Route path="dashboard" element={<Dashboard />} />

                      {/* Premium tools wrapped in SubscriptionGuard */}
                      <Route element={<SubscriptionGuard />}>
                        <Route path="signals" element={<Signals />} />
                        <Route path="god-signal" element={<GodSignal />} />
                        <Route
                            path="trap-detector"
                            element={<TrapDetector />} />
                          
                        <Route path="engine" element={<EngineDashboard />} />
                        <Route path="news" element={<News />} />
                        <Route path="calendar" element={<Calendar />} />
                        <Route path="calculators" element={<Calculators />} />
                        <Route path="journal" element={<Journal />} />
                      </Route>

                      <Route path="settings" element={<Settings />} />
                      {/* Admin route now properly guarded by Firestore-backed role */}
                      <Route
                          path="admin"
                          element={
                          <AdminRoute>
                            <Admin />
                          </AdminRoute>
                          } />
                        
                      <Route
                          path="admin/devices"
                          element={
                          <AdminRoute>
                            <AdminDevicePanel />
                          </AdminRoute>
                          } />
                        
                      <Route
                          path="admin/payments"
                          element={
                          <AdminRoute>
                            <AdminPayments />
                          </AdminRoute>
                          } />
                        
                      <Route
                          path="admin/keys"
                          element={<Navigate to="/app/admin" replace />} />
                        
                      <Route
                          path="admin/device-requests"
                          element={<Navigate to="/app/admin/devices" replace />} />
                        
                      <Route
                          path="admin/system-status"
                          element={<Navigate to="/app/admin" replace />} />
                        
                    </Route>

                    {/* Convenience redirect for the bare /admin/system-status path */}
                    <Route
                        path="/admin/system-status"
                        element={
                        <Navigate to="/app/admin/system-status" replace />
                        } />
                      

                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Suspense>
                {/* Global support chat — mounted once here so it is present
                    on EVERY route (landing, login, gate, app, admin pages)
                    and can never be hidden by a page that forgets it. */}
                  <ChatWidget />
                </BrowserRouter>
              </UserAccountProvider>
            </ScannerProvider>
          </SelectedSymbolProvider>
        </EngineProvider>
      </AuthProvider>
    </MotionConfig>);

}