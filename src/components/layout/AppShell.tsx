import React, { useEffect, useState } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useAuth } from '../../context/AuthContext';
import { useUserAccount } from '../../context/UserAccountContext';
import { XIcon, Loader2Icon } from 'lucide-react';
import { SecurityShell } from '../security/SecurityShell';
import { NewsAlertWatcher } from '../news/NewsAlertWatcher';
import { AccountLockedScreen } from '../account/AccountLockedScreen';
import { DeviceWarningScreen } from '../account/DeviceWarningScreen';
import { KycModal } from '../account/KycModal';
import { WelcomeDisclosureModal } from '../account/WelcomeDisclosureModal';
import { VerificationBanner } from '../common/VerificationBanner';

export function AppShell() {
  const { user, loading, gatePassed } = useAuth();
  const { dbUser, isBanned, isLocked, isDeviceMatched, needsKyc } = useUserAccount();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  // Two-phase close: `closing` plays the slide-out animation, then the drawer fully unmounts.
  const [closing, setClosing] = useState(false);

  const closeMobileMenu = () => {
    if (!mobileOpen) return;
    setClosing(true);
  };

  const openMobileMenu = () => {
    setClosing(false);
    setMobileOpen(true);
  };

  // Finish the close animation, then actually unmount the drawer.
  useEffect(() => {
    if (!closing) return;
    const t = setTimeout(() => {
      setMobileOpen(false);
      setClosing(false);
    }, 200);
    return () => clearTimeout(t);
  }, [closing]);

  // Force-close the drawer on ANY route change — the menu must never stay
  // open/stuck after navigating to another section.
  useEffect(() => {
    closeMobileMenu();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Close the drawer on Escape for keyboard/accessibility parity.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMobileMenu();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobileOpen]);

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-bg flex items-center justify-center">
        <Loader2Icon className="w-7 h-7 text-brand animate-spin" />
      </div>);

  }

  if (!user) return <Navigate to="/login" replace />;

  // Check BOTH the Firestore-synced dbUser role AND the live AuthContext
  // user role — admins must bypass account approval gates even if the
  // localStorage-mirrored dbUser hasn't synced yet.
  const isAdmin =
  user.role === 'admin' ||
  user.role === 'super_admin' ||
  dbUser?.role === 'admin' ||
  dbUser?.role === 'super_admin';

  if (isBanned) return <Navigate to="/access-denied" replace />;

  // Expiry/explicit lock takes priority so renewal is always reachable.
  const showLocked = !isAdmin && isLocked;
  const showDeviceWarn = !isAdmin && !showLocked && !isDeviceMatched;
  const showKyc = !isAdmin && needsKyc && !showLocked && !showDeviceWarn;

  // Security boundary: restricted accounts must not mount product routes at all.
  // A visual blur is not authorization; it leaves effects, data, and DOM content active.
  if (showLocked) return <AccountLockedScreen />;
  if (!gatePassed && !isAdmin) return <Navigate to="/gate" replace />;
  if (showDeviceWarn) return <DeviceWarningScreen />;
  if (showKyc) return <KycModal />;

  const drawerVisible = mobileOpen || closing;

  return (
    <div className="flex h-screen w-full bg-bg overflow-hidden">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {drawerVisible &&
      <>
          {/* Overlay */}
          <div
          onClick={closeMobileMenu}
          aria-hidden="true"
          className={`lg:hidden fixed inset-0 bg-black/70 backdrop-blur-sm z-40 transition-opacity duration-200 ${
          closing ? 'opacity-0' : 'opacity-100'}`
          } />
        

          {/* Drawer — plain CSS slide, no AnimatePresence, so it can never get stuck */}
          <div
          className={`lg:hidden fixed left-0 top-0 bottom-0 z-50 transition-transform duration-200 ${
          closing ? '-translate-x-full' : 'translate-x-0'}`
          }>
          
            <div className="relative h-full">
              <button
              type="button"
              onClick={closeMobileMenu}
              aria-label="Close navigation menu"
              className="absolute top-3 right-3 z-10 rounded-md p-2 text-ink-muted transition-colors hover:bg-brand/10 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60">
              
                <XIcon className="w-5 h-5" />
              </button>
              <Sidebar onNavigate={closeMobileMenu} />
            </div>
          </div>
        </>
      }

      <div className="flex-1 flex flex-col min-w-0">
        <VerificationBanner />
        <TopBar onMenu={openMobileMenu} />
        <main data-app-scroll-container className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      <SecurityShell />
      <NewsAlertWatcher />
      <WelcomeDisclosureModal />
    </div>);

}