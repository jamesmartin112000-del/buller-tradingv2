import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertTriangleIcon, ClockIcon, CreditCardIcon, LockIcon, MessageCircleIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../lib/db/store';
import { useContent } from '../../lib/db/hooks';
import { Button } from '../ui/Button';

/**
 * Expired-account gate. Renewals intentionally return to /gate so the same
 * admin-managed wallets, proof upload, validation, and approval transaction
 * are used for first payments and renewals.
 */
export function AccountLockedScreen() {
  const { user, logout, setGatePassed } = useAuth();
  const navigate = useNavigate();
  const adminWhatsapp = useContent('admin.contact.whatsapp', '+92 300 0000000');
  const pendingPayment = user ?
  db.
  list('paymentProofs').
  find(
    (payment) =>
    payment.email.toLowerCase() === user.email.toLowerCase() &&
    payment.status === 'pending'
  ) :
  undefined;

  const renew = () => {
    setGatePassed(false);
    navigate('/gate');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-bg-900/90 p-4 backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-locked-title">
      
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="relative w-full max-w-lg rounded-xl border-2 border-sell bg-bg-700/95 p-5 shadow-2xl sm:p-8"
        style={{ boxShadow: '0 0 64px rgba(239,68,68,0.3)' }}>
        
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-sell bg-sell/15">
            {pendingPayment ?
            <ClockIcon className="h-8 w-8 text-warn" /> :

            <LockIcon className="h-8 w-8 text-sell" />
            }
          </div>
          <h1
            id="account-locked-title"
            className={`text-2xl font-extrabold tracking-tight sm:text-3xl ${pendingPayment ? 'text-warn' : 'text-sell'}`}>
            
            {pendingPayment ? 'PAYMENT UNDER REVIEW' : 'SUBSCRIPTION EXPIRED'}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            {pendingPayment ?
            'Your renewal proof is safely recorded. Access will restore automatically after admin verification.' :
            'Your access period has ended. Renew through the secure payment flow to reactivate BULLER TRADING.'}
          </p>
          <p className="mt-1 text-xs text-ink-dim">
            {pendingPayment ?
            'Aap ka payment admin review kar raha hai.' :
            'Apna plan renew karke access dobara activate karein.'}
          </p>
          <p className="mt-2 text-xs text-ink-muted">
            Admin WhatsApp: <span className="whitespace-nowrap font-mono text-brand">{adminWhatsapp}</span>
          </p>
        </div>

        <div className="my-6 flex gap-3 rounded-lg border border-line bg-bg-800/70 p-4">
          {pendingPayment ?
          <ClockIcon className="mt-0.5 h-5 w-5 shrink-0 text-warn" /> :

          <AlertTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-warn" />
          }
          <div className="text-xs leading-relaxed text-ink-muted">
            {pendingPayment ?
            'Do not submit the same transaction again. You will receive a notification when review is complete.' :
            'Wallet addresses and plan timing are loaded directly from the admin-managed Firebase records.'}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {!pendingPayment &&
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            icon={<CreditCardIcon className="h-4 w-4" />}
            onClick={renew}>
            
              Renew subscription
            </Button>
          }
          <Button
            variant="secondary"
            size="lg"
            className="w-full"
            icon={<MessageCircleIcon className="h-4 w-4" />}
            onClick={() => {
              const digits = adminWhatsapp.replace(/\D/g, '');
              if (digits) window.open(`https://wa.me/${digits}?text=${encodeURIComponent('Hello, my BULLER TRADING account has expired. Please help me renew access.')}`, '_blank', 'noopener,noreferrer');
            }}>
            
            Contact Admin on WhatsApp
          </Button>
          <Button
            variant="secondary"
            size="lg"
            className="w-full sm:col-span-2"
            icon={<MessageCircleIcon className="h-4 w-4" />}
            onClick={() => window.dispatchEvent(new Event('buller-open-chat'))}>
            
            Open website support chat
          </Button>
        </div>
        <Button
          variant="secondary"
          className="mt-3 w-full"
          onClick={() => void logout()}>
          
          Sign out
        </Button>
      </motion.div>
    </motion.div>);

}