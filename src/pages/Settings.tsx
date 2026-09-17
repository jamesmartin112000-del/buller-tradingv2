import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUserAccount } from '../context/UserAccountContext';
import { useCollection } from '../lib/db/hooks';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import {
  SettingsIcon,
  UserIcon,
  KeyIcon,
  BellIcon,
  PaletteIcon,
  ShieldIcon,
  LogOutIcon,
  MonitorIcon,
  PlusIcon,
  Trash2Icon,
  CheckIcon,
  ClockIcon } from
'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { db, uid } from '../lib/db/store';
import { Badge } from '../components/ui/Badge';
interface Prefs {
  signalAlerts: boolean;
  newsAlerts: boolean;
  emailDigest: boolean;
  sound: boolean;
}
export function Settings() {
  const { user, logout, sendReset } = useAuth();
  const { currentDeviceId, dbUser } = useUserAccount();
  const allDevices = useCollection('devices');
  const nav = useNavigate();
  const [prefs, setPrefs] = useLocalStorage<Prefs>('te.prefs', {
    signalAlerts: true,
    newsAlerts: true,
    emailDigest: false,
    sound: true
  });
  const [resetSending, setResetSending] = useState(false);
  const [displayName, setDisplayName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);
  // Keep the input in sync if the upstream user changes
  useEffect(() => {
    if (user?.name) setDisplayName(user.name);
  }, [user?.name]);
  const hasUnsavedChanges = displayName.trim() !== (user?.name || '').trim();
  const handleSave = () => {
    if (!user || !displayName.trim()) {
      toast.error('Display name cannot be empty');
      return;
    }
    if (!hasUnsavedChanges) {
      toast.info('No changes to save');
      return;
    }
    setSaving(true);
    // Update the canonical users/{uid} doc — this propagates via Firestore
    // sync to every tab. The AuthContext's subscribeUser listener will
    // pick up the change on next snapshot.
    if (dbUser) {
      db.update('users', dbUser.id, {
        name: displayName.trim()
      });
    }
    db.log('info', 'users', `${user.email} updated profile name`);
    setTimeout(() => {
      setSaving(false);
      toast.success('Profile saved');
    }, 300);
  };
  const myDevices = user ?
  allDevices.
  filter((d) => d.userEmail === user.email).
  sort((a, b) => b.createdAt - a.createdAt) :
  [];
  const currentBound = myDevices.find(
    (d) => d.deviceId === currentDeviceId && d.status === 'allowed'
  );
  const pendingRequest = myDevices.find(
    (d) =>
    d.deviceId === currentDeviceId && (
    d.status === 'requested' || d.status === 'unlock_request')
  );
  const handleLogout = () => {
    logout();
    nav('/');
  };
  const handlePasswordReset = async () => {
    if (!user) return;
    setResetSending(true);
    const res = await sendReset(user.email);
    setResetSending(false);
    if (res.ok) {
      toast.success(`Password reset link sent to ${user.email}`);
    } else {
      toast.error(res.error || 'Failed to send reset email');
    }
  };
  const requestNewDevice = () => {
    if (!user) return;
    if (pendingRequest) {
      toast.info(
        'You already have a pending device request — wait for admin review.'
      );
      return;
    }
    db.insert('devices', {
      id: 'dlog_' + Date.now().toString(36),
      userEmail: user.email,
      deviceId: currentDeviceId,
      userAgent: navigator.userAgent,
      status: 'requested',
      createdAt: Date.now(),
      label: 'Requested via Settings'
    });
    db.insert('notifications', {
      id: uid('nt'),
      target: 'admin',
      title: 'New device registration request',
      body: `${user.name} (${user.email}) is requesting to register a new device.`,
      kind: 'info',
      read: false,
      createdAt: Date.now(),
      link: '/app/admin'
    });
    db.log('info', 'device', `Device request submitted by ${user.email}`);
    toast.success(
      'Device registration request submitted — admin will review shortly.'
    );
  };
  const removeDevice = (id: string) => {
    if (
    !confirm(
      'Remove this device? You will need admin approval to re-register.'
    ))

    return;
    db.remove('devices', id);
    toast.success('Device removed');
  };
  return (
    <div className="p-3 lg:p-4 max-w-3xl mx-auto w-full space-y-3">
      <div className="flex items-center gap-2">
        <SettingsIcon className="w-5 h-5 text-brand" />
        <h1 className="text-xl font-bold tracking-tight">Settings</h1>
      </div>

      {/* Profile */}
      <Section title="Profile" icon={<UserIcon className="w-3.5 h-3.5" />}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-brand to-purple-trade flex items-center justify-center text-white text-lg font-bold uppercase">
            {(user?.name || 'U')[0]}
          </div>
          <div>
            <div className="font-bold text-sm">{user?.name}</div>
            <div className="text-2xs text-ink-muted">{user?.email}</div>
            <div className="text-3xs uppercase tracking-wider text-brand font-bold mt-0.5">
              {user?.role} · ENGINE ACTIVE
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Display Name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)} />
          
          <Input label="Email" defaultValue={user?.email} disabled />
        </div>
      </Section>

      {/* Security */}
      <Section title="Security" icon={<ShieldIcon className="w-3.5 h-3.5" />}>
        <div className="space-y-3">
          <div className="bg-bg-700 border border-line rounded p-3">
            <div className="text-xs font-semibold mb-1">Password</div>
            <div className="text-3xs text-ink-muted mb-3 leading-relaxed">
              Passwords are managed by Firebase Authentication. Click below to
              receive a secure reset link by email.
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handlePasswordReset}
              disabled={resetSending}>
              
              {resetSending ? 'Sending…' : 'Send password reset link'}
            </Button>
          </div>
          <div className="flex items-center justify-between bg-bg-700 border border-line rounded p-3">
            <div>
              <div className="text-xs font-semibold">
                Two-Factor Authentication
              </div>
              <div className="text-3xs text-ink-muted">
                Add an extra layer of security to your account
              </div>
            </div>
            <Button variant="secondary" size="sm">
              Enable 2FA
            </Button>
          </div>
        </div>
      </Section>

      {/* Registered devices */}
      <Section
        title="Registered Devices"
        icon={<MonitorIcon className="w-3.5 h-3.5" />}>
        
        <div className="text-3xs text-ink-muted mb-3 leading-relaxed">
          Your account is bound to a single device for security. To switch
          devices, request admin approval below.
          <br />
          <span className="italic text-ink-dim">
            Aap ka account aik device ke saath linked hai. Dusri device pe
            switch karne ke liye admin se request karein.
          </span>
        </div>

        <div className="space-y-2 mb-3">
          {myDevices.length === 0 &&
          <div className="text-2xs text-ink-dim italic">
              No registered devices yet.
            </div>
          }
          {myDevices.map((d) => {
            const isCurrent = d.deviceId === currentDeviceId;
            return (
              <div
                key={d.id}
                className={`flex items-center gap-2 p-2.5 rounded border ${isCurrent ? 'bg-brand/5 border-brand/30' : 'bg-bg-700 border-line'}`}>
                
                <MonitorIcon className="w-4 h-4 text-ink-muted shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-2xs font-semibold">
                      {isCurrent ? 'This device' : 'Other device'}
                    </span>
                    <Badge
                      tone={
                      d.status === 'allowed' ?
                      'green' :
                      d.status === 'warned' ?
                      'amber' :
                      d.status === 'requested' ||
                      d.status === 'unlock_request' ?
                      'brand' :
                      'red'
                      }
                      size="sm">
                      
                      {d.status === 'unlock_request' ?
                      'unlock pending' :
                      d.status === 'requested' ?
                      'awaiting approval' :
                      d.status}
                    </Badge>
                  </div>
                  <div className="text-3xs text-ink-dim font-mono truncate">
                    {d.deviceId.slice(0, 28)}…
                  </div>
                  <div className="text-3xs text-ink-dim">
                    Registered {new Date(d.createdAt).toLocaleString()}
                  </div>
                </div>
                {!isCurrent && d.status === 'allowed' &&
                <button
                  onClick={() => removeDevice(d.id)}
                  className="text-3xs px-2 py-1 rounded text-ink-dim hover:text-sell uppercase tracking-wider font-bold"
                  title="Remove device">
                  
                    <Trash2Icon className="w-3 h-3" />
                  </button>
                }
              </div>);

          })}
        </div>

        {!currentBound && !pendingRequest &&
        <Button
          variant="primary"
          size="sm"
          icon={<PlusIcon className="w-3.5 h-3.5" />}
          onClick={requestNewDevice}>
          
            Request to register this device
          </Button>
        }
        {pendingRequest &&
        <div className="flex items-center gap-2 bg-warn/10 border border-warn/30 rounded p-2.5 text-2xs">
            <ClockIcon className="w-3.5 h-3.5 text-warn shrink-0" />
            <div>
              <span className="font-semibold text-warn">
                Request pending admin review
              </span>
              <div className="text-ink-muted">
                Submitted {new Date(pendingRequest.createdAt).toLocaleString()}
              </div>
            </div>
          </div>
        }
        {currentBound &&
        <div className="flex items-center gap-2 bg-buy/10 border border-buy/30 rounded p-2.5 text-2xs">
            <CheckIcon className="w-3.5 h-3.5 text-buy shrink-0" />
            <span className="font-semibold text-buy">
              This device is approved & bound to your account.
            </span>
          </div>
        }
      </Section>

      {/* API Keys */}
      <Section title="API Keys" icon={<KeyIcon className="w-3.5 h-3.5" />}>
        <p className="text-2xs text-ink-muted mb-3">
          Optional — connect premium data feeds. Engine works fully with free
          APIs out of the box.
        </p>
        <div className="space-y-2">
          <Input
            label="CoinGlass API Key"
            placeholder="cg_xxxxxxxxxx"
            suffix="paid" />
          
          <Input
            label="Finnhub API Key"
            placeholder="fh_xxxxxxxxxx"
            suffix="free tier" />
          
          <Input
            label="Alpha Vantage API Key"
            placeholder="av_xxxxxxxxxx"
            suffix="free tier" />
          
        </div>
      </Section>

      {/* Notifications */}
      <Section
        title="Notifications"
        icon={<BellIcon className="w-3.5 h-3.5" />}>
        
        <div className="space-y-2">
          {(
          [
          {
            key: 'signalAlerts',
            label: 'Signal Alerts',
            desc: 'New BUY/SELL signals from BULLER TRADING'
          },
          {
            key: 'newsAlerts',
            label: 'High-Impact News',
            desc: 'FOMC, CPI, NFP and other tier-1 events'
          },
          {
            key: 'emailDigest',
            label: 'Daily Email Digest',
            desc: 'Morning report with overnight signals'
          },
          {
            key: 'sound',
            label: 'Sound Effects',
            desc: 'Audio cue when signals trigger'
          }] as
          const).
          map((p) =>
          <label
            key={p.key}
            className="flex items-center justify-between bg-bg-700 border border-line rounded p-3 cursor-pointer hover:border-line-strong">
            
              <div>
                <div className="text-xs font-semibold">{p.label}</div>
                <div className="text-3xs text-ink-muted">{p.desc}</div>
              </div>
              <input
              type="checkbox"
              checked={prefs[p.key]}
              onChange={(e) =>
              setPrefs({
                ...prefs,
                [p.key]: e.target.checked
              })
              }
              className="w-4 h-4 accent-brand" />
            
            </label>
          )}
        </div>
      </Section>

      {/* Theme */}
      <Section
        title="Appearance"
        icon={<PaletteIcon className="w-3.5 h-3.5" />}>
        
        <div className="flex items-center justify-between bg-bg-700 border border-line rounded p-3">
          <div>
            <div className="text-xs font-semibold">Theme</div>
            <div className="text-3xs text-ink-muted">
              Institutional Red/Black is locked for v4.0
            </div>
          </div>
          <span className="text-2xs uppercase tracking-wider text-brand bg-brand/10 border border-brand/30 px-2 py-1 rounded font-bold">
            Red / Black
          </span>
        </div>
      </Section>

      <div className="flex justify-end gap-2">
        <Button
          variant="secondary"
          icon={<LogOutIcon className="w-3.5 h-3.5" />}
          onClick={handleLogout}>
          
          Sign out
        </Button>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={saving || !hasUnsavedChanges}>
          
          {saving ? 'Saving…' : hasUnsavedChanges ? 'Save changes' : 'Saved'}
        </Button>
      </div>
    </div>);

}
function Section({
  title,
  icon,
  children




}: {title: string;icon: React.ReactNode;children: React.ReactNode;}) {
  return (
    <div className="bg-bg-600 border border-line rounded-md p-4">
      <div className="flex items-center gap-1.5 text-2xs uppercase tracking-[0.18em] text-ink-dim mb-3 font-bold">
        {icon}
        {title}
      </div>
      {children}
    </div>);

}