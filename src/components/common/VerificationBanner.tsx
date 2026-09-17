import React, { useState } from 'react';
import { MailWarningIcon, Loader2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { resendVerification } from '../../lib/backend/auth';
/**
 * VerificationBanner — slim warning strip shown when the signed-in user
 * has not confirmed their email address. Returns null otherwise so the
 * layout is unaffected for verified users.
 */
export function VerificationBanner() {
  const { user } = useAuth();
  const [sending, setSending] = useState(false);
  if (!user || user.verified) return null;
  const resend = async () => {
    if (sending) return;
    setSending(true);
    const res = await resendVerification();
    setSending(false);
    if (res.ok) {
      toast.success('Verification email sent — check your inbox.');
    } else {
      toast.error(res.error || 'Could not send verification email.');
    }
  };
  return (
    <div className="bg-warn/10 border-b border-warn/30 px-4 py-2 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <MailWarningIcon className="w-4 h-4 text-warn shrink-0" />
        <span className="text-2xs uppercase tracking-wider font-bold text-warn truncate">
          Email not verified
        </span>
        <span className="text-2xs text-ink-muted hidden sm:inline truncate">
          · Confirm your address to secure your account
        </span>
      </div>
      <button
        onClick={resend}
        disabled={sending}
        className="text-2xs uppercase tracking-wider font-bold text-warn hover:text-warn/80 disabled:opacity-50 flex items-center gap-1.5 shrink-0">
        
        {sending && <Loader2Icon className="w-3 h-3 animate-spin" />}
        {sending ? 'Sending…' : 'Resend email'}
      </button>
    </div>);

}