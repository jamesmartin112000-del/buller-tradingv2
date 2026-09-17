import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldXIcon,
  ArrowLeftIcon,
  UnlockIcon,
  CheckIcon,
  ClockIcon,
  MessageSquareIcon } from
'lucide-react';
import { Button } from '../components/ui/Button';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useUserAccount } from '../context/UserAccountContext';
import { useCollection } from '../lib/db/hooks';
import { db, uid } from '../lib/db/store';
import { toast } from 'sonner';
export function AccessDenied() {
  const { user, logout } = useAuth();
  const { currentDeviceId, dbUser } = useUserAccount();
  const allDevices = useCollection('devices');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Did this user already submit an unlock request from this device?
  const existingRequest = useMemo(() => {
    if (!user) return null;
    return allDevices.find(
      (d) =>
      d.userEmail === user.email &&
      d.status === 'unlock_request' &&
      !d.reviewedAt
    );
  }, [allDevices, user]);
  const submitUnlockRequest = () => {
    if (!user) return;
    setSubmitting(true);
    db.insert('devices', {
      id: 'dlog_' + Date.now().toString(36),
      userEmail: user.email,
      deviceId: currentDeviceId,
      userAgent: navigator.userAgent,
      status: 'unlock_request',
      createdAt: Date.now(),
      label: 'Account unlock request',
      reviewNote: reason.trim() || undefined
    });
    db.insert('notifications', {
      id: uid('nt'),
      target: 'admin',
      title: 'Account unlock request',
      body: `${user.name} (${user.email}) is requesting account unlock. ${reason.trim() ? `Reason: ${reason.trim()}` : 'No reason provided.'}`,
      kind: 'warn',
      read: false,
      createdAt: Date.now(),
      link: '/app/admin'
    });
    db.log('warn', 'account', `Unlock request submitted by ${user.email}`);
    setTimeout(() => {
      setSubmitting(false);
      toast.success('Unlock request submitted — admin will review.');
    }, 400);
  };
  return (
    <div className="min-h-screen w-full bg-bg flex items-center justify-center px-4 py-10">
      <div className="absolute inset-0 grid-bg opacity-30" />
      <motion.div
        initial={{
          opacity: 0,
          scale: 0.95
        }}
        animate={{
          opacity: 1,
          scale: 1
        }}
        className="relative text-center max-w-lg w-full">
        
        <div className="inline-flex w-20 h-20 items-center justify-center rounded-full bg-sell/10 border border-sell/30 mb-6 brand-glow">
          <ShieldXIcon className="w-10 h-10 text-sell" />
        </div>
        <h1 className="text-5xl font-extrabold text-sell text-glow-red mb-3">
          ACCESS DENIED
        </h1>
        <p className="text-ink-muted mb-2">
          {dbUser?.status === 'banned' ?
          'Aap ka account ban kar diya gaya hai. Unlock request bhejein ya admin se rabta karein.' :
          'Invalid attempts logged. Aap ka account temporarily locked hai.'}
        </p>
        <p className="text-2xs text-ink-dim uppercase tracking-wider mb-6">
          {dbUser?.status === 'banned' ?
          'Your account has been banned. Submit an unlock request below.' :
          'Your account is locked. Submit an unlock request or contact the admin.'}
        </p>

        {user &&
        <div className="bg-bg-700/80 backdrop-blur border border-sell/30 rounded-md p-5 mb-4 text-left">
            {existingRequest ?
          <div className="flex items-start gap-3">
                <ClockIcon className="w-5 h-5 text-warn shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-bold text-warn">
                    Unlock Request Pending
                  </div>
                  <div className="text-2xs text-ink-muted mt-1 leading-relaxed">
                    Aap ki request admin ko bhej di gayi hai. Review hone ke
                    baad aap ko notification milegi (usually within 24 hours).
                  </div>
                  <div className="text-3xs text-ink-dim mt-2 font-mono">
                    Submitted{' '}
                    {new Date(existingRequest.createdAt).toLocaleString()}
                  </div>
                </div>
              </div> :

          <>
                <div className="flex items-center gap-2 mb-3">
                  <UnlockIcon className="w-4 h-4 text-brand" />
                  <h2 className="font-bold text-sm">Request account unlock</h2>
                </div>
                <p className="text-2xs text-ink-muted mb-3 leading-relaxed">
                  Briefly tell the admin why your account should be unlocked.
                  <br />
                  <span className="italic text-ink-dim">
                    Admin ko batayein ke aap ka account kyun unlock kiya jaye.
                  </span>
                </p>
                <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="e.g. Switched to a new phone / lost old device / mistaken ban…"
              className="w-full bg-bg-700 border border-line rounded px-3 py-2 text-sm outline-none focus:border-brand resize-none mb-3" />
            
                <Button
              variant="primary"
              size="lg"
              className="w-full"
              icon={<MessageSquareIcon className="w-4 h-4" />}
              onClick={submitUnlockRequest}
              disabled={submitting}>
              
                  {submitting ? 'Submitting…' : 'Submit unlock request'}
                </Button>
              </>
          }
          </div>
        }

        <p className="text-2xs text-ink-dim uppercase tracking-wider mb-4">
          Contact author · (R.D.H;~$)
        </p>

        <div className="flex gap-2 justify-center flex-wrap">
          {user &&
          <Button variant="secondary" onClick={logout}>
              Sign out
            </Button>
          }
          <Link to="/">
            <Button
              variant="secondary"
              icon={<ArrowLeftIcon className="w-4 h-4" />}>
              
              Back to safety
            </Button>
          </Link>
        </div>
      </motion.div>
    </div>);

}