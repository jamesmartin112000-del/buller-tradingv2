import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ShieldAlertIcon,
  MonitorIcon,
  BanIcon,
  ClockIcon,
  CheckCircle2Icon } from
'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUserAccount } from '../../context/UserAccountContext';
import { fsUpdate } from '../../lib/backend/docStore';
import { cacheLocalRecord, db } from '../../lib/db/store';
import { Button } from '../ui/Button';
/**
 * DeviceWarningScreen — full-screen blinking warning when the user
 * logs in from a device that doesn't match their primary bound device.
 *
 * 3 warnings = permanent ban (admin can lift).
 *
 * Flow: user can request admin approval for this device. While the
 * request is pending the screen switches to a calm "waiting" state and
 * the user stays put — the moment admin approves (Activate / approve
 * device), the devices collection updates, isDeviceMatched flips true
 * and AppShell unmounts this screen automatically. No re-login needed.
 */
export function DeviceWarningScreen() {
  const { logout } = useAuth();
  const { dbUser, currentDeviceId, deviceWarnings } = useUserAccount();
  const isBanned = dbUser?.status === 'banned';
  const shownWarning = Math.min(deviceWarnings + 1, 3);
  // Reactive pending check — context re-renders on devices changes, so
  // this stays in sync without local state getting stale.
  const hasPendingRequest = useMemo(() => {
    if (!dbUser) return false;
    return db.
    list('devices').
    some(
      (d) =>
      d.userEmail === dbUser.email &&
      d.deviceId === currentDeviceId && (
      d.status === 'requested' || d.status === 'unlock_request')
    );
    // eslint-disable-next-line
  }, [dbUser, currentDeviceId, deviceWarnings, db.list('devices').length]);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const isPending = hasPendingRequest || justSubmitted;
  const submitRequest = () => {
    if (!dbUser) return;
    if (hasPendingRequest) {
      setJustSubmitted(true);
      return;
    }
    db.insert('devices', {
      id: 'dlog_' + Date.now().toString(36),
      userEmail: dbUser.email,
      deviceId: currentDeviceId,
      userAgent: navigator.userAgent,
      status: 'requested',
      createdAt: Date.now(),
      label: 'Requested from device-warning screen'
    });
    db.insert('notifications', {
      id: 'nt_' + Date.now().toString(36),
      target: 'admin',
      title: 'New device registration request',
      body: `${dbUser.email} is requesting to register a new device. Approve via Users → Activate or the device row. Old device will be removed if approved.`,
      kind: 'info',
      read: false,
      createdAt: Date.now(),
      link: '/app/admin'
    });
    db.log(
      'info',
      'device',
      `Device request submitted from warning screen by ${dbUser.email}`
    );
    setJustSubmitted(true);
  };
  const acknowledge = async () => {
    if (!dbUser) return;
    const next = deviceWarnings + 1;
    if (next >= 3) {
      await fsUpdate('users', dbUser.id, {
        deviceWarnings: next,
        'deviceLock.warnings': next,
        'deviceLock.isLocked': true,
        'deviceLock.lockedAt': Date.now()
      });
      cacheLocalRecord('users', { ...dbUser, deviceWarnings: next });
      db.insert('devices', {
        id: 'dlog_' + Date.now().toString(36),
        userEmail: dbUser.email,
        deviceId: currentDeviceId,
        userAgent: navigator.userAgent,
        status: 'denied',
        createdAt: Date.now()
      });
      db.insert('notifications', {
        id: 'nt_' + Date.now().toString(36),
        target: 'admin',
        title: 'Account device-locked',
        body: `${dbUser.email} reached 3 device-mismatch warnings and was device-locked pending admin review.`,
        kind: 'error',
        read: false,
        createdAt: Date.now()
      });
      db.log(
        'error',
        'device',
        `Device-locked ${dbUser.email} after 3 warnings`
      );
    } else {
      await fsUpdate('users', dbUser.id, { deviceWarnings: next });
      cacheLocalRecord('users', { ...dbUser, deviceWarnings: next });
      db.insert('devices', {
        id: 'dlog_' + Date.now().toString(36),
        userEmail: dbUser.email,
        deviceId: currentDeviceId,
        userAgent: navigator.userAgent,
        status: 'warned',
        createdAt: Date.now()
      });
      db.log('warn', 'device', `Device warning #${next} for ${dbUser.email}`);
    }
  };
  // ---- PENDING STATE — calm waiting screen, auto-dismisses on approval ----
  if (isPending && !isBanned) {
    return (
      <motion.div
        initial={{
          opacity: 0
        }}
        animate={{
          opacity: 1
        }}
        className="fixed inset-0 z-[9998] bg-black flex items-center justify-center p-4 overflow-y-auto">
        
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
            'radial-gradient(circle at 50% 50%, rgba(245,158,11,0.12) 0%, rgba(0,0,0,0.95) 70%)'
          }} />
        
        <div className="relative z-10 max-w-xl text-center">
          <div className="mb-6 flex justify-center">
            <motion.div
              animate={{
                rotate: 360
              }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: 'linear'
              }}>
              
              <ClockIcon className="w-16 h-16 text-warn" />
            </motion.div>
          </div>
          <h1 className="text-3xl lg:text-4xl font-black text-warn tracking-tight mb-3">
            REQUEST PENDING
          </h1>
          <div className="text-base lg:text-lg text-white font-bold mb-2">
            Admin approval ka intezar hai…
          </div>
          <div className="bg-bg-700/80 backdrop-blur border-2 border-warn/50 rounded-lg p-5 mt-4 text-left space-y-3 text-sm text-ink">
            <p>
              <strong className="text-warn">Roman-Urdu:</strong> Aap ki device
              registration request admin ko bhej di gayi hai. Jaise hi admin
              approve karega, yeh screen khud hat jayegi aur aap seedha app use
              kar sakenge — dobara login ki zaroorat nahi.
            </p>
            <p className="text-xs text-ink-muted">
              <strong className="text-warn">English:</strong> Your device
              registration request has been sent to the admin. The moment it's
              approved, this screen will disappear automatically and you'll be
              let in — no need to log in again.
            </p>
            <div className="bg-buy/10 border border-buy/30 rounded p-2.5 text-xs flex items-start gap-2">
              <CheckCircle2Icon className="w-4 h-4 text-buy shrink-0 mt-0.5" />
              <div className="text-ink-muted">
                Aap is page ko khula chhor sakte hain — approval live detect ho
                jayegi. You can also sign out and come back later.
              </div>
            </div>
          </div>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <Button variant="secondary" size="lg" onClick={logout}>
              Sign Out — I'll come back later
            </Button>
          </div>
          <div className="mt-6 text-3xs text-ink-dim font-mono flex items-center justify-center gap-2">
            <MonitorIcon className="w-3 h-3" />
            Device ID: {currentDeviceId.slice(0, 24)}…
          </div>
        </div>
      </motion.div>);

  }
  return (
    <motion.div
      initial={{
        opacity: 0
      }}
      animate={{
        opacity: 1
      }}
      className="fixed inset-0 z-[9998] bg-black flex items-center justify-center p-4 overflow-y-auto">
      
      <motion.div
        animate={{
          opacity: [0.4, 1, 0.4]
        }}
        transition={{
          duration: 1.8,
          repeat: Infinity
        }}
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
          'radial-gradient(circle at 50% 50%, rgba(239,68,68,0.3) 0%, rgba(0,0,0,0.95) 70%)'
        }} />
      

      <motion.div
        animate={{
          textShadow: [
          '0 0 20px rgba(239,68,68,0.6)',
          '0 0 60px rgba(239,68,68,1)',
          '0 0 20px rgba(239,68,68,0.6)']

        }}
        transition={{
          duration: 1.8,
          repeat: Infinity
        }}
        className="relative z-10 max-w-3xl text-center">
        
        <div className="mb-6 flex justify-center">
          {isBanned ?
          <BanIcon className="w-20 h-20 text-sell" /> :

          <ShieldAlertIcon className="w-20 h-20 text-sell" />
          }
        </div>

        <h1 className="text-4xl lg:text-6xl font-black text-sell tracking-tight mb-4">
          {isBanned ? 'ACCOUNT BANNED' : 'DEVICE WARNING'}
        </h1>

        <div className="text-lg lg:text-2xl text-white font-bold mb-2">
          {isBanned ?
          <>Aap ka account permanently banned hai.</> :

          <>Warning {shownWarning} / 3</>
          }
        </div>

        <div className="bg-bg-700/80 backdrop-blur border-2 border-sell rounded-lg p-5 mt-6 text-left max-w-2xl mx-auto">
          {isBanned ?
          <div className="space-y-3 text-sm text-ink">
              <p className="text-warn font-bold">
                Aap ne 3 dafa rules tor diye hain. Account ban kar diya gaya
                hai.
              </p>
              <p className="text-ink-muted text-xs">
                You have violated the single-device policy 3 times. This account
                is now permanently banned. Contact support if you believe this
                is a mistake.
              </p>
            </div> :

          <div className="space-y-3 text-sm text-ink">
              <p>
                <strong className="text-sell">Roman-Urdu:</strong> Aap ki login
                pehle kisi aur device se hui thi. Account ek device pe hi use
                hota hai. Account share karna, sell karna ya 2 devices pe login
                karna allowed nahi.
              </p>
              <p className="text-xs text-ink-muted">
                <strong className="text-sell">English:</strong> Your account is
                bound to a single device. Sharing or selling access, or signing
                in from multiple devices, is strictly prohibited.
              </p>
              <div className="bg-sell/10 border border-sell/30 rounded p-2.5 text-xs">
                <div className="text-sell font-bold mb-1">
                  3rd warning par account permanently banned ho jayega.
                </div>
                <div className="text-ink-muted text-2xs">
                  On the 3rd warning your account will be permanently banned
                  with no recovery.
                </div>
              </div>
            </div>
          }
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center flex-wrap">
          {!isBanned &&
          <>
              <Button variant="primary" size="lg" onClick={submitRequest}>
                Request New Device Registration
              </Button>
              <Button variant="secondary" size="lg" onClick={() => void acknowledge()}>
                I Understand — Continue
              </Button>
            </>
          }
          <Button variant="secondary" size="lg" onClick={logout}>
            Sign Out
          </Button>
        </div>
        {!isBanned &&
        <div className="mt-3 text-3xs text-ink-muted max-w-md mx-auto text-center">
            Tip: instead of risking a warning, request admin to register this
            device. Old device will be removed once approved, and you'll be let
            in automatically — no re-login needed.
          </div>
        }

        <div className="mt-6 text-3xs text-ink-dim font-mono flex items-center justify-center gap-2">
          <MonitorIcon className="w-3 h-3" />
          Device ID: {currentDeviceId.slice(0, 24)}…
        </div>
      </motion.div>
    </motion.div>);

}