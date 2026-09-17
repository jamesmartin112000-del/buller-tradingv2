import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XIcon,
  CheckIcon,
  MonitorIcon,
  SmartphoneIcon,
  ShieldOffIcon,
  Loader2Icon,
  UserIcon,
  MailIcon,
  ClockIcon,
  AlertTriangleIcon } from
'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { useCollection } from '../../lib/db/hooks';
import { db, uid } from '../../lib/db/store';
import {
  subscribePendingRequests,
  listAllRequests,
  approveRequest,
  rejectRequest,
  adminRemoveDevice,
  adminResetAllDeviceLocks,
  adminSetUnlimitedDevices,
  getUserDevices,
  type DeviceChangeRequest,
  type DeviceRecord } from
'../../lib/backend/deviceLockService';
/**
 * Admin · Device & Account-Unlock Requests
 *
 * Surfaces the Firestore-backed `deviceChangeRequests` stream (filed by
 * locked users from the DeviceLockGuard, or by users on an unauthorized
 * device) directly inside the Access section.
 *
 * Clicking a request opens a detail drawer showing the FULL user profile,
 * the previously-registered device, and the new requested device — with
 * Approve / Reject / Remove-Device actions.
 */
export function DeviceAccessRequests({ adminEmail }: {adminEmail: string;}) {
  const [pending, setPending] = useState<DeviceChangeRequest[]>([]);
  const [history, setHistory] = useState<DeviceChangeRequest[]>([]);
  const [selected, setSelected] = useState<DeviceChangeRequest | null>(null);
  const [resetting, setResetting] = useState(false);
  useEffect(() => {
    const unsub = subscribePendingRequests((rows) => setPending(rows));
    return unsub;
  }, []);
  const loadHistory = async () => {
    const all = await listAllRequests();
    setHistory(all.slice(0, 20));
  };
  useEffect(() => {
    loadHistory();
  }, []);
  const handleResetAll = async () => {
    if (
    !confirm(
      'RESET ALL USERS?\n\nThis clears EVERY lock, warning and registered device for ALL users. Everyone logs in fresh — their next device is auto-registered. Rules re-apply only if someone breaks them again.\n\nContinue?'
    ))

    return;
    setResetting(true);
    const res = await adminResetAllDeviceLocks();
    if (res.success) {
      toast.success(res.message);
      db.log(
        'warn',
        'devicelock',
        `FULL RESET by ${adminEmail} — ${res.usersReset} users cleared`
      );
      loadHistory();
    } else {
      toast.error(res.message);
    }
    setResetting(false);
  };
  return (
    <div className="bg-bg-600 border border-line rounded-md">
      <div className="p-3 border-b border-line flex items-center gap-2">
        <ShieldOffIcon className="w-4 h-4 text-warn" />
        <h3 className="text-sm font-bold tracking-tight">
          Device & Account-Unlock Requests
        </h3>
        {pending.length > 0 &&
        <span className="bg-warn text-white text-2xs font-bold px-1.5 py-0.5 rounded-full">
            {pending.length} pending
          </span>
        }
        <button
          onClick={handleResetAll}
          disabled={resetting}
          className="ml-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded text-2xs font-bold text-sell border border-sell/40 hover:bg-sell/10 transition-colors disabled:opacity-50"
          title="Clear all locks, warnings & registered devices for every user">
          
          {resetting ?
          <Loader2Icon className="w-3 h-3 animate-spin" /> :

          <ShieldOffIcon className="w-3 h-3" />
          }
          Reset All Users
        </button>
      </div>

      {pending.length === 0 ?
      <div className="p-6 text-center text-xs text-ink-dim">
          No pending device or unlock requests.
        </div> :

      <div className="divide-y divide-line">
          {pending.map((req) =>
        <button
          key={req.id}
          onClick={() => setSelected(req)}
          className="w-full text-left p-3 hover:bg-bg-700/50 transition-colors flex items-center gap-3">
          
              <div className="w-8 h-8 rounded-full bg-warn/15 flex items-center justify-center shrink-0">
                <SmartphoneIcon className="w-4 h-4 text-warn" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <div className="text-xs font-semibold truncate">
                    {req.email || '—'}
                  </div>
                  <Badge
                tone={req.requestType === 'unlock' ? 'red' : 'blue'}
                size="sm">
                
                    {req.requestType === 'unlock' ? 'Unlock' : 'Device'}
                  </Badge>
                </div>
                <div className="text-3xs text-ink-dim truncate">
                  {req.reason || 'No reason provided'}
                </div>
              </div>
              <div className="text-3xs text-ink-dim font-mono shrink-0 text-right">
                <div>{new Date(req.createdAt).toLocaleDateString()}</div>
                <Badge tone="amber" size="sm">
                  Pending
                </Badge>
              </div>
            </button>
        )}
        </div>
      }

      {/* Recent resolved history */}
      {history.filter((h) => h.status !== 'pending').length > 0 &&
      <div className="border-t border-line p-3">
          <div className="text-3xs uppercase tracking-wider text-ink-muted font-bold mb-2">
            Recent decisions
          </div>
          <div className="space-y-1.5">
            {history.
          filter((h) => h.status !== 'pending').
          slice(0, 6).
          map((h) =>
          <div
            key={h.id}
            className="flex items-center justify-between gap-2 bg-bg-700 border border-line rounded px-2.5 py-1.5">
            
                  <span className="text-3xs truncate text-ink-muted">
                    {h.email}
                  </span>
                  <Badge
              tone={h.status === 'approved' ? 'green' : 'red'}
              size="sm">
              
                    {h.status}
                  </Badge>
                </div>
          )}
          </div>
        </div>
      }

      <AnimatePresence>
        {selected &&
        <RequestDetailDrawer
          req={selected}
          adminEmail={adminEmail}
          onClose={() => {
            setSelected(null);
            loadHistory();
          }} />

        }
      </AnimatePresence>
    </div>);

}
function InfoRow({
  label,
  value,
  mono




}: {label: string;value: React.ReactNode;mono?: boolean;}) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="text-2xs uppercase tracking-wider text-ink-muted font-bold shrink-0">
        {label}
      </span>
      <span
        className={`text-xs text-ink text-right break-all ${mono ? 'font-mono' : ''}`}>
        
        {value || '—'}
      </span>
    </div>);

}
function RequestDetailDrawer({
  req,
  adminEmail,
  onClose




}: {req: DeviceChangeRequest;adminEmail: string;onClose: () => void;}) {
  const allUsers = useCollection('users');
  const allRequests = useCollection('accessRequests');
  const profile = useMemo(
    () => allUsers.find((u) => u.email === req.email),
    [allUsers, req.email]
  );
  const accessReq = useMemo(
    () => allRequests.find((r) => r.email === req.email),
    [allRequests, req.email]
  );
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [busy, setBusy] = useState<
    null | 'approve' | 'reject' | 'remove' | 'unlimited'>(
    null);
  const [rejectNote, setRejectNote] = useState('');
  useEffect(() => {
    let live = true;
    setLoadingDevices(true);
    getUserDevices(req.userId).
    then((rows) => live && setDevices(rows)).
    finally(() => live && setLoadingDevices(false));
    return () => {
      live = false;
    };
  }, [req.userId]);
  const previousDevice =
  devices.find((d) => d.deviceId === req.currentDeviceId) ||
  devices.find((d) => d.isActive) ||
  null;
  const notifyUser = (title: string, body: string, kind: string) => {
    db.insert('notifications', {
      id: uid('nt'),
      target: 'user',
      targetEmail: req.email,
      title,
      body,
      kind: kind as any,
      read: false,
      createdAt: Date.now(),
      link: '/login'
    });
  };
  const handleApprove = async () => {
    setBusy('approve');
    const res = await approveRequest(req);
    if (res.success) {
      // Mirror the approval into the LOCAL users/devices store. Without this
      // the local deviceWarnings counter and device records stay stale and
      // the user keeps seeing the BANNED / warning screen even after approval.
      //
      // NOTE: local device records use a localStorage 'dev_…' id, NOT the
      // Firebase fingerprint hash in req.newDeviceId — so we match the
      // user's pending local records by email and flip those to allowed.
      const pendingLocal = db.
      list('devices').
      filter(
        (d) =>
        d.userEmail === req.email && (
        d.status === 'requested' || d.status === 'unlock_request')
      );
      const newLocalDeviceId =
      pendingLocal.length > 0 ?
      pendingLocal[pendingLocal.length - 1].deviceId :
      null;
      // Drop old allowed local device records (single-device policy)
      db.list('devices').
      filter(
        (d) =>
        d.userEmail === req.email &&
        d.status === 'allowed' &&
        d.deviceId !== newLocalDeviceId
      ).
      forEach((d) => db.remove('devices', d.id));
      // Flip the pending local records to allowed
      pendingLocal.forEach((d) =>
      db.update('devices', d.id, {
        status: 'allowed'
      })
      );
      if (profile) {
        db.update('users', profile.id, {
          deviceWarnings: 0,
          activeDevices: 1,
          // If we know the new local device, bind it as primary; otherwise
          // clear the binding so the next login auto-registers the device.
          primaryDeviceId: newLocalDeviceId || undefined,
          ...(profile.status === 'banned' ?
          {
            status: 'active' as const
          } :
          {})
        });
      }
      notifyUser(
        'Device approved',
        'Your new device has been approved and registered. You can now log in normally.',
        'success'
      );
      db.log('info', 'devicelock', `Approved device request for ${req.email}`);
      toast.success('Device approved & registered');
      onClose();
    } else {
      toast.error(res.message);
    }
    setBusy(null);
  };
  const handleReject = async () => {
    setBusy('reject');
    const res = await rejectRequest(req.id, rejectNote || 'Rejected by admin.');
    if (res.success) {
      notifyUser(
        'Device request rejected',
        `Your device change request was not approved.${rejectNote ? ' Reason: ' + rejectNote : ''}`,
        'access_request'
      );
      db.log('info', 'devicelock', `Rejected device request for ${req.email}`);
      toast.success('Request rejected');
      onClose();
    } else {
      toast.error(res.message);
    }
    setBusy(null);
  };
  const handleRemove = async () => {
    if (
    !confirm(
      `Remove ${req.email}'s registered device and unlock the account?\n\nThe next device they log in on will be AUTO-REGISTERED.`
    ))

    return;
    setBusy('remove');
    const res = await adminRemoveDevice(req.userId, req.currentDeviceId);
    if (res.success) {
      // Reflect unlock in the local users mirror if present — also clear the
      // warning counter and the old local device binding so the next login
      // auto-registers cleanly instead of showing a stale warning/ban screen.
      if (profile) {
        db.update('users', profile.id, {
          status: 'active',
          deviceWarnings: 0,
          primaryDeviceId: undefined,
          activeDevices: 0
        });
      }
      db.list('devices').
      filter((d) => d.userEmail === req.email && d.status === 'allowed').
      forEach((d) => db.remove('devices', d.id));
      notifyUser(
        'Device removed — please log in again',
        'Your old device has been removed and your account unlocked. Please log in now — the device you log in on will be automatically registered as your new device.',
        'success'
      );
      db.log(
        'warn',
        'devicelock',
        `Removed device & unlocked ${req.email} by ${adminEmail}`
      );
      toast.success(res.message);
      onClose();
    } else {
      toast.error(res.message);
    }
    setBusy(null);
  };
  const handleUnlimited = async () => {
    if (
    !confirm(
      `Grant UNLIMITED DEVICES to ${req.email}?\n\nNo device rules will apply to this user — any number of devices, no warnings, no locks. Only their account validity remains enforced.`
    ))

    return;
    setBusy('unlimited');
    const res = await adminSetUnlimitedDevices(req.userId, true);
    if (res.success) {
      notifyUser(
        'Unlimited devices enabled',
        'Your account has been upgraded to unlimited devices. You can log in from any device without restrictions while your account is valid.',
        'success'
      );
      db.log(
        'info',
        'devicelock',
        `Unlimited devices granted to ${req.email} by ${adminEmail}`
      );
      toast.success(res.message);
      onClose();
    } else {
      toast.error(res.message);
    }
    setBusy(null);
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
      className="fixed inset-0 z-[120] flex justify-end bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Request details">
      
      <motion.div
        initial={{
          x: 32,
          opacity: 0
        }}
        animate={{
          x: 0,
          opacity: 1
        }}
        exit={{
          x: 32,
          opacity: 0
        }}
        transition={{
          type: 'spring',
          stiffness: 320,
          damping: 30
        }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md h-full bg-bg-600 border-l border-line overflow-y-auto">
        
        {/* Header */}
        <div className="sticky top-0 z-10 bg-bg-600 border-b border-line p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldOffIcon className="w-4 h-4 text-warn" />
            <h2 className="text-sm font-bold">
              {req.requestType === 'unlock' ?
              'Account Unlock Request' :
              'Device Change Request'}
            </h2>
            <Badge
              tone={req.requestType === 'unlock' ? 'red' : 'blue'}
              size="sm">
              
              {req.requestType === 'unlock' ? 'Unlock' : 'Device'}
            </Badge>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-ink-muted hover:text-ink">
            
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Request reason */}
          <div className="bg-warn/10 border border-warn/30 rounded-md p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangleIcon className="w-3.5 h-3.5 text-warn" />
              <span className="text-2xs uppercase tracking-wider text-warn font-bold">
                User's reason
              </span>
            </div>
            <p className="text-xs text-ink">
              {req.reason || 'No reason provided.'}
            </p>
            <p className="text-3xs text-ink-dim font-mono mt-2 flex items-center gap-1">
              <ClockIcon className="w-3 h-3" />
              {new Date(req.createdAt).toLocaleString()}
            </p>
          </div>

          {/* Full user profile */}
          <div className="bg-bg-700 border border-line rounded-md p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand to-purple-trade flex items-center justify-center text-white text-xs font-bold uppercase">
                {(profile?.name || req.email)[0]}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">
                  {profile?.name || '—'}
                </div>
                <div className="text-2xs text-ink-dim font-mono truncate flex items-center gap-1">
                  <MailIcon className="w-3 h-3" /> {req.email}
                </div>
              </div>
            </div>
            <div className="divide-y divide-line/60">
              <InfoRow
                label="Status"
                value={
                profile ?
                <Badge
                  tone={
                  profile.status === 'active' ?
                  'green' :
                  profile.status === 'locked' ||
                  profile.status === 'banned' ?
                  'red' :
                  'amber'
                  }
                  size="sm">
                  
                      {profile.status}
                    </Badge> :

                'Not signed up locally'

                } />
              
              <InfoRow label="Role" value={profile?.role} />
              <InfoRow label="WhatsApp" value={accessReq?.whatsapp} mono />
              <InfoRow label="Country" value={accessReq?.country} />
              <InfoRow label="User ID" value={req.userId} mono />
              {profile?.validityExpiresAt &&
              <InfoRow
                label="Validity"
                value={new Date(profile.validityExpiresAt).toLocaleString()} />

              }
            </div>
          </div>

          {/* Previously registered device */}
          <div className="bg-bg-700 border border-line rounded-md p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <MonitorIcon className="w-3.5 h-3.5 text-ink-muted" />
              <span className="text-2xs uppercase tracking-wider text-ink-muted font-bold">
                Previous (registered) device
              </span>
            </div>
            {loadingDevices ?
            <div className="flex items-center gap-2 text-xs text-ink-dim py-2">
                <Loader2Icon className="w-3.5 h-3.5 animate-spin" /> Loading…
              </div> :
            previousDevice ?
            <div className="divide-y divide-line/60">
                <InfoRow label="Platform" value={previousDevice.platform} />
                <InfoRow label="Browser" value={previousDevice.browser} />
                <InfoRow
                label="Screen"
                value={previousDevice.fingerprint?.screen} />
              
                <InfoRow
                label="Device ID"
                value={previousDevice.deviceId.slice(0, 20) + '…'}
                mono />
              
                <InfoRow
                label="Registered"
                value={new Date(previousDevice.registeredAt).toLocaleString()} />
              
              </div> :

            <p className="text-xs text-ink-dim py-1">
                No registered device on record.
              </p>
            }
          </div>

          {/* New requested device */}
          <div className="bg-bg-700 border border-emerald-500/30 rounded-md p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <SmartphoneIcon className="w-3.5 h-3.5 text-buy" />
              <span className="text-2xs uppercase tracking-wider text-buy font-bold">
                New requested device
              </span>
            </div>
            <div className="divide-y divide-line/60">
              <InfoRow label="Platform" value={req.newFingerprint?.platform} />
              <InfoRow label="Screen" value={req.newFingerprint?.screen} />
              <InfoRow label="Language" value={req.newFingerprint?.language} />
              <InfoRow
                label="Device ID"
                value={req.newDeviceId.slice(0, 20) + '…'}
                mono />
              
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2 pt-1">
            <Button
              variant="primary"
              size="md"
              className="w-full justify-center"
              disabled={busy !== null}
              icon={
              busy === 'approve' ?
              <Loader2Icon className="w-4 h-4 animate-spin" /> :

              <CheckIcon className="w-4 h-4" />

              }
              onClick={handleApprove}>
              
              Approve new device
            </Button>

            <Button
              variant="secondary"
              size="md"
              className="w-full justify-center"
              disabled={busy !== null}
              icon={
              busy === 'remove' ?
              <Loader2Icon className="w-4 h-4 animate-spin" /> :

              <ShieldOffIcon className="w-4 h-4" />

              }
              onClick={handleRemove}>
              
              Remove device & unlock
            </Button>
            <p className="text-3xs text-ink-dim leading-relaxed">
              Removing the device unlocks the account and clears the registered
              device. The next device the user logs in on is auto-registered.
            </p>

            <button
              disabled={busy !== null}
              onClick={handleUnlimited}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-semibold text-warn border border-warn/40 hover:bg-warn/10 transition-colors disabled:opacity-50">
              
              {busy === 'unlimited' ?
              <Loader2Icon className="w-3.5 h-3.5 animate-spin" /> :

              <SmartphoneIcon className="w-3.5 h-3.5" />
              }
              Grant Unlimited Devices
            </button>
            <p className="text-3xs text-ink-dim leading-relaxed">
              Unlimited = no device rules at all for this user. Only their
              account validity (expiry) still applies.
            </p>

            <div className="pt-2 border-t border-line">
              <textarea
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                rows={2}
                placeholder="Rejection note (optional)…"
                className="w-full bg-bg-700 border border-line rounded px-2.5 py-2 text-xs outline-none focus:border-sell resize-none mb-2" />
              
              <button
                disabled={busy !== null}
                onClick={handleReject}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-semibold text-sell border border-sell/40 hover:bg-sell/10 transition-colors disabled:opacity-50">
                
                {busy === 'reject' ?
                <Loader2Icon className="w-3.5 h-3.5 animate-spin" /> :

                <XIcon className="w-3.5 h-3.5" />
                }
                Reject request
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>);

}