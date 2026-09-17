import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircle2Icon,
  EyeIcon,
  EyeOffIcon,
  MailIcon,
  MessageCircleIcon,
  PhoneIcon,
  ShieldCheckIcon,
  UserIcon,
  XIcon } from
'lucide-react';
import { toast } from 'sonner';
import { validatePassword } from '../../lib/backend/auth';
import { fsSet } from '../../lib/backend/docStore';
import { cacheLocalRecord, db, uid, type AccessRequest } from '../../lib/db/store';
import { useContent } from '../../lib/db/hooks';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface DemoForm {
  fullName: string;
  email: string;
  password: string;
  whatsapp: string;
}

const EMPTY: DemoForm = { fullName: '', email: '', password: '', whatsapp: '' };

export function AccessRequestModal({ open, onClose }: Props) {
  const [form, setForm] = useState<DemoForm>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof DemoForm, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const adminWhatsapp = useContent('admin.contact.whatsapp', '+92 300 0000000');

  const update = (key: keyof DemoForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const close = () => {
    onClose();
    window.setTimeout(() => {
      setForm(EMPTY);
      setErrors({});
      setSubmitted(false);
      setShowPassword(false);
    }, 250);
  };

  const validate = () => {
    const next: Partial<Record<keyof DemoForm, string>> = {};
    if (form.fullName.trim().length < 2) next.fullName = 'Enter your full name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'Enter a valid email address.';
    const password = validatePassword(form.password);
    if (!password.ok) next.password = password.reason || 'Enter a secure password.';
    const digits = form.whatsapp.replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 15) next.whatsapp = 'Enter a valid WhatsApp number with country code.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    const email = form.email.trim().toLowerCase();
    try {
      const existing = db.list('accessRequests').find(
        (request) => request.email === email && request.status === 'pending' && request.requestType === 'demo'
      );
      if (!existing) {
        const request: AccessRequest = {
          id: uid('demo'),
          requestType: 'demo',
          email,
          name: form.fullName.trim(),
          whatsapp: form.whatsapp.trim(),
          reason: 'Free Demo request',
          passwordValidated: true,
          status: 'pending',
          createdAt: Date.now()
        };
        // Password is intentionally validated in memory and never included here.
        await fsSet('access_requests', request, false);
        cacheLocalRecord('accessRequests', request);
      }
      setForm((current) => ({ ...current, password: '' }));
      setSubmitted(true);
      toast.success('Free Demo request submitted');
    } catch (error) {
      console.warn('[demo] request failed', error);
      toast.error('Your request could not be submitted. Please check your connection and retry.');
    } finally {
      setSubmitting(false);
    }
  };

  const contactAdmin = () => {
    const digits = adminWhatsapp.replace(/\D/g, '');
    if (!digits) return toast.error('Admin contact is temporarily unavailable.');
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent('Hello, I submitted a BULLER TRADING Free Demo request and would like to follow up.')}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <AnimatePresence>
      {open &&
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-3 backdrop-blur-sm sm:p-4"
        onClick={close}>
        
          <motion.div
          initial={{ opacity: 0, y: 14, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.97 }}
          role="dialog" aria-modal="true" aria-labelledby="demo-title"
          onClick={(event) => event.stopPropagation()}
          className="relative my-4 w-full max-w-lg rounded-lg border border-brand/35 bg-bg-700 p-5 shadow-2xl sm:p-7">
          
            <button type="button" onClick={close} aria-label="Close Free Demo form" className="absolute right-3 top-3 rounded p-1.5 text-ink-dim hover:bg-bg-600 hover:text-ink">
              <XIcon className="h-4 w-4" />
            </button>

            {submitted ?
          <div className="py-3 text-center">
                <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full border border-buy/40 bg-buy/10">
                  <CheckCircle2Icon className="h-7 w-7 text-buy" />
                </div>
                <h2 id="demo-title" className="text-xl font-bold">Welcome! Request submitted</h2>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-muted">
                  Your Free Demo request was submitted successfully. Please contact the Admin for approval; requests are usually reviewed within 24 hours.
                </p>
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  <Button variant="secondary" onClick={close}>Close</Button>
                  <Button variant="primary" icon={<MessageCircleIcon className="h-4 w-4" />} onClick={contactAdmin}>Contact Admin</Button>
                </div>
              </div> :

          <>
                <div className="mb-5 flex items-start gap-3 pr-7">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-brand/30 bg-brand/10">
                    <ShieldCheckIcon className="h-5 w-5 text-brand" />
                  </div>
                  <div>
                    <div className="text-2xs font-bold uppercase tracking-[0.16em] text-brand">Approval-based access</div>
                    <h2 id="demo-title" className="mt-1 text-xl font-bold">Request a Free Demo</h2>
                    <p className="mt-1 text-xs leading-relaxed text-ink-muted">Submit your details for manual Admin review. This request does not automatically create or approve an account.</p>
                  </div>
                </div>
                <form onSubmit={submit} className="space-y-3">
                  <Input label="Full Name" value={form.fullName} onChange={(event) => update('fullName', event.target.value)} icon={<UserIcon className="h-4 w-4" />} error={errors.fullName} autoComplete="name" />
                  <Input label="Email Address" type="email" value={form.email} onChange={(event) => update('email', event.target.value)} icon={<MailIcon className="h-4 w-4" />} error={errors.email} autoComplete="email" />
                  <div className="relative">
                    <Input label="Password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={(event) => update('password', event.target.value)} error={errors.password} autoComplete="new-password" />
                    <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-2 top-7 rounded p-1 text-ink-dim hover:text-ink">
                      {showPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                    </button>
                    <p className="mt-1 text-[10px] leading-relaxed text-ink-dim">Used only for security validation in this form. It is never stored or sent to Admin.</p>
                  </div>
                  <Input label="WhatsApp Number" value={form.whatsapp} onChange={(event) => update('whatsapp', event.target.value)} icon={<PhoneIcon className="h-4 w-4" />} error={errors.whatsapp} placeholder="+92XXXXXXXXXX" autoComplete="tel" />
                  <Button type="submit" variant="primary" size="lg" className="mt-2 w-full" disabled={submitting}>
                    {submitting ? 'Submitting…' : 'Submit Free Demo Request'}
                  </Button>
                </form>
              </>
          }
          </motion.div>
        </motion.div>
      }
    </AnimatePresence>);

}