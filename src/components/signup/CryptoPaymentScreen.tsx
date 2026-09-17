import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { QRCodeCanvas } from 'qrcode.react';
import { toast } from 'sonner';
import {
  WalletIcon,
  CopyIcon,
  CheckIcon,
  CheckCircle2Icon,
  UploadIcon,
  Loader2Icon,
  ImageIcon,
  HashIcon,
  ShieldCheckIcon,
  XIcon } from
'lucide-react';
import { Logo } from '../common/Logo';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { ProgressBar } from '../ui/ProgressBar';
import { fsSubscribe } from '../../lib/backend/docStore';
import { cacheLocalRecord, db, subscribe, type WalletAddress } from '../../lib/db/store';
import { createPaymentRecord } from '../../lib/payments/paymentService';
import { DEFAULT_WALLET_ADDRESSES } from '../../lib/platformConfig';
import {
  validateImageFile,
  compressImage,
  deleteFile,
  uploadFile } from
'../../lib/r2Upload';
interface PlanInfo {
  /** Plan identifier (e.g. 'pro') — used to derive granted validity on approval. */
  id?: string;
  name: string;
  amount: number;
  duration: string;
}
interface CryptoPaymentScreenProps {
  email: string;
  plan: PlanInfo;
  /** Optional details to link the payment to the exact user account. */
  userId?: string | null;
  whatsapp?: string | null;
  userName?: string | null;
  /**
   * When provided, the screen renders an inline "submitted" confirmation
   * tailored to the embedding context (e.g. the Gate) instead of the default
   * standalone success screen that sends the user back to /login.
   */
  onSubmitted?: () => void;
  /** Optional "change plan" / back affordance shown above the card. */
  onBack?: () => void;
}
interface WalletRecord {
  id: string;
  network: string;
  address: string;
  createdAt: number;
}
// Loose store access — walletAddresses / paymentProofs are runtime collections
// keyed by name in localStorage (not part of the strict compile-time schema).
const store = db as any;
export function CryptoPaymentScreen({
  email,
  plan,
  userId,
  whatsapp,
  userName,
  onSubmitted,
  onBack
}: CryptoPaymentScreenProps) {
  const nav = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadControllerRef = useRef<AbortController | null>(null);
  const normalizedEmail = email.trim().toLowerCase();
  const [wallets, setWallets] = useState<WalletRecord[]>(DEFAULT_WALLET_ADDRESSES);
  const [selectedWalletId, setSelectedWalletId] = useState<string>(
    DEFAULT_WALLET_ADDRESSES[0].id
  );
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [txid, setTxid] = useState('');
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  // Load admin-managed wallets LIVE. Firestore values replace the published
  // platform defaults as soon as the first snapshot arrives, so admin changes
  // still propagate instantly while a brand-new project has valid deposit rails.
  useEffect(() => {
    const refresh = () => {
      let list: WalletRecord[] = [];
      try {
        list = store.list('walletAddresses') as WalletRecord[] || [];
      } catch {
        list = [];
      }
      // Newest wallet first so a freshly-added address is the default selection.
      const resolved = [...list].sort(
        (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
      );
      const available = resolved.length ? resolved : DEFAULT_WALLET_ADDRESSES;
      setWallets(available);
      // Keep the user's current selection if it still exists; otherwise
      // default to the most recently added wallet.
      setSelectedWalletId((prev) =>
      available.some((w) => w.id === prev) ? prev : available[0]?.id || ''
      );
    };
    refresh();
    const unsubLocal = subscribe('walletAddresses', refresh);
    const unsubCloud = fsSubscribe<WalletAddress>(
      'wallet_addresses',
      (rows) => {
        rows.forEach((wallet) => cacheLocalRecord('walletAddresses', wallet));
        const resolved = [...rows].sort(
          (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
        );
        const available = resolved.length ? resolved : DEFAULT_WALLET_ADDRESSES;
        setWallets(available);
        setSelectedWalletId((previous) =>
        available.some((wallet) => wallet.id === previous) ?
        previous :
        available[0]?.id || ''
        );
      },
      [],
      (error) => console.warn('[payments] Wallet list unavailable', error)
    );
    return () => {
      unsubLocal();
      unsubCloud();
    };
  }, []);
  const selectedWallet = useMemo(
    () => wallets.find((w) => w.id === selectedWalletId) || wallets[0],
    [wallets, selectedWalletId]
  );
  const selectedCurrency = selectedWallet?.network.toLowerCase().includes('bitcoin') ?
  'BTC equivalent' :
  'USDT';
  const copy = async (value: string, field: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopiedField((f) => f === field ? null : f), 1500);
    } catch {
      toast.error('Could not copy — please copy manually');
    }
  };
  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    const check = validateImageFile(file);
    if (!check.ok) {
      toast.error(check.reason || 'Invalid image file');
      return;
    }
    uploadControllerRef.current?.abort();
    const controller = new AbortController();
    uploadControllerRef.current = controller;
    setUploading(true);
    setProgress(0);
    setProofUrl(null);
    try {
      const objUrl = URL.createObjectURL(file);
      setPreviewUrl((previous) => {
        if (previous?.startsWith('blob:')) URL.revokeObjectURL(previous);
        return objUrl;
      });
      const compressed = await compressImage(file);
      if (controller.signal.aborted) return;
      if (!userId) throw new Error('Please sign in again before uploading payment proof.');
      const result = await uploadFile(
        'payments',
        userId,
        compressed,
        (p) => setProgress(p),
        controller.signal
      );
      if (controller.signal.aborted) return;
      if (!result.ok || !result.url) {
        toast.error(result.error || 'Upload failed. Please try again.');
        setPreviewUrl(null);
        return;
      }
      setProofUrl(result.url);
      setProgress(100);
      toast.success('Payment proof uploaded');
    } catch (err: any) {
      if (!controller.signal.aborted) {
        toast.error(err?.message || 'Upload failed. Please try again.');
        setPreviewUrl(null);
      }
    } finally {
      if (uploadControllerRef.current === controller) {
        uploadControllerRef.current = null;
        setUploading(false);
      }
    }
  };
  const removeProof = () => {
    uploadControllerRef.current?.abort();
    uploadControllerRef.current = null;
    setUploading(false);
    if (proofUrl) void deleteFile(proofUrl);
    setProofUrl(null);
    setPreviewUrl((previous) => {
      if (previous?.startsWith('blob:')) URL.revokeObjectURL(previous);
      return null;
    });
    setProgress(0);
  };
  useEffect(() => () => {
    uploadControllerRef.current?.abort();
  }, []);
  const submit = async () => {
    if (!proofUrl) {
      toast.error('Please upload your payment screenshot first.');
      return;
    }
    setSubmitting(true);
    try {
      // Persist through the unified payment service. It writes to the
      // `paymentProofs` collection (mirrored to Firestore → visible to the
      // admin on any device), notifies the admin, and throws if the write
      // didn't land — so we never show a false "submitted" state.
      await createPaymentRecord({
        userId: userId ?? null,
        email: normalizedEmail,
        userName: userName ?? null,
        whatsapp: whatsapp ?? null,
        planId: plan.id ?? null,
        planName: plan.name,
        amount: plan.amount,
        currency: selectedCurrency,
        paymentMethod: 'crypto',
        network: selectedWallet?.network || '',
        walletAddress: selectedWallet?.address || '',
        txid: txid.trim(),
        proofUrl
      });
      toast.success('Payment proof submitted');
      setSubmitted(true);
      onSubmitted?.();
    } catch (err: any) {
      toast.error(err?.message || 'Could not submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };
  // ---------- SUCCESS / SUBMITTED ----------
  // When embedded (onSubmitted provided), the host owns the post-submit UI.
  if (submitted && onSubmitted) return null;
  if (submitted) {
    return (
      <PageWrapper>
        <div className="bg-bg-700/80 backdrop-blur-md border border-line rounded-md p-8 brand-glow text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-buy/15 border border-buy/30 flex items-center justify-center mb-4">
            <CheckCircle2Icon className="w-7 h-7 text-buy" />
          </div>
          <h2 className="text-2xl font-bold">Payment proof submitted</h2>
          <p className="text-sm text-ink-muted mt-2 leading-relaxed">
            Shukriya! Aap ka payment proof admin ko bhej diya gaya hai. Admin
            verify kare ga aur aap ka account{' '}
            <span className="text-ink font-semibold">24 ghante</span> ke andar
            activate ho jaye ga.
          </p>
          <div className="bg-bg-800 border border-line rounded p-4 my-6 text-sm text-left">
            <p className="text-2xs uppercase tracking-wider text-ink-dim">
              Your email
            </p>
            <p className="font-mono font-semibold truncate">
              {normalizedEmail}
            </p>
            <p className="text-2xs uppercase tracking-wider text-ink-dim mt-3">
              Plan
            </p>
            <p className="font-bold text-brand">
              {plan.name} · ${plan.amount} plan value · {selectedCurrency} / {plan.duration}
            </p>
          </div>
          <Button
            variant="primary"
            className="w-full"
            onClick={() => nav('/login')}>
            
            Go to login
          </Button>
        </div>
      </PageWrapper>);

  }
  // ---------- PAYMENT ----------
  return (
    <PageWrapper wide>
      <div className="bg-bg-700/80 backdrop-blur-md border border-line rounded-md p-6 md:p-8 brand-glow">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <Logo size="lg" showText={false} />
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-buy/15 text-buy text-2xs font-bold rounded-full mb-3 uppercase tracking-wider">
            <CheckIcon className="w-3 h-3" /> Account created
          </div>
          <h2 className="text-2xl font-bold">Complete your payment</h2>
          <p className="text-sm text-ink-muted mt-1">
            Selected network par payment bhejein aur transaction ka screenshot upload karein.
          </p>
          {onBack &&
          <button
            type="button"
            onClick={onBack}
            className="text-2xs text-brand hover:underline mt-2 inline-flex items-center gap-1">
            
              ← Change plan · Plan badlein
            </button>
          }
        </div>

        {/* Summary */}
        <div className="grid sm:grid-cols-3 gap-3 mb-6">
          <SummaryCell label="Your email" value={normalizedEmail} mono />
          <SummaryCell
            label="Selected plan"
            value={`${plan.name} · ${plan.duration}`} />
          
          <div className="bg-bg-800 border border-line rounded p-3">
            <p className="text-2xs uppercase tracking-wider text-ink-dim">
              Amount to send
            </p>
            <div className="flex items-center justify-between gap-2 mt-0.5">
              <p className="font-bold text-brand text-lg">
                ${plan.amount} plan value · {selectedCurrency}
              </p>
              <button
                type="button"
                onClick={() => copy(String(plan.amount), 'amount')}
                className="text-ink-dim hover:text-brand transition-colors shrink-0"
                aria-label="Copy amount"
                title="Copy amount">
                
                {copiedField === 'amount' ?
                <CheckIcon className="w-4 h-4 text-buy" /> :

                <CopyIcon className="w-4 h-4" />
                }
              </button>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* LEFT: wallet + QR */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <WalletIcon className="w-4 h-4 text-brand" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-ink-muted">
                Send payment to
              </h3>
            </div>

            {/* Network selector */}
            {wallets.length > 1 &&
            <div className="flex flex-wrap gap-2 mb-4">
                {wallets.map((w) =>
              <button
                key={w.id}
                type="button"
                onClick={() => setSelectedWalletId(w.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors border ${w.id === selectedWallet?.id ? 'bg-brand text-bg-900 border-brand' : 'bg-bg-800 text-ink-muted border-line hover:text-ink hover:border-brand/40'}`}>
                
                    {w.network}
                  </button>
              )}
              </div>
            }

            {selectedWallet &&
            <>
                <div className="bg-[#0b0f1a] border border-brand/30 rounded-lg p-4 flex items-center justify-center mb-3">
                  <QRCodeCanvas
                  value={selectedWallet.address}
                  size={180}
                  level="M"
                  bgColor="#0b0f1a"
                  fgColor="#e6c56a"
                  includeMargin />
                
                </div>
                <p className="text-2xs uppercase tracking-wider text-ink-dim mb-1">
                  {selectedWallet.network} address
                </p>
                <div className="flex items-stretch gap-2">
                  <div className="flex-1 bg-bg-800 border border-line rounded px-3 py-2.5 text-xs font-mono text-ink break-all">
                    {selectedWallet.address}
                  </div>
                  <button
                  type="button"
                  onClick={() => copy(selectedWallet.address, 'address')}
                  className="px-3 rounded bg-bg-800 border border-line text-ink-muted hover:text-brand hover:border-brand/40 transition-colors shrink-0"
                  aria-label="Copy wallet address"
                  title="Copy wallet address">
                  
                    {copiedField === 'address' ?
                  <CheckIcon className="w-4 h-4 text-buy" /> :

                  <CopyIcon className="w-4 h-4" />
                  }
                  </button>
                </div>
                <p className="text-2xs text-warn mt-2 leading-relaxed">
                  Sirf selected network ka asset bhejein. Ghalat asset ya network par bheji
                  gayi rasi waapas nahi mil sakti.
                </p>
              </>
            }

            {wallets.length === 0 &&
            <div className="bg-bg-800 border border-line rounded-md p-4 text-center">
                <WalletIcon className="w-6 h-6 text-ink-dim mx-auto mb-2" />
                <p className="text-sm font-semibold text-ink">
                  No wallet available yet
                </p>
                <p className="text-2xs text-ink-muted mt-1 leading-relaxed">
                  Abhi koi payment wallet set nahi hai. Thori dair baad dobara
                  koshish karein ya admin se rabta karein.
                </p>
              </div>
            }
          </div>

          {/* RIGHT: proof upload */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ImageIcon className="w-4 h-4 text-brand" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-ink-muted">
                Upload payment proof
              </h3>
            </div>

            <Input
              label="Transaction hash / TXID (optional)"
              icon={<HashIcon className="w-4 h-4" />}
              placeholder="e.g. 0x9a8b…"
              value={txid}
              onChange={(e) => setTxid(e.target.value)} />
            

            <div className="mt-3">
              <label className="text-2xs uppercase tracking-wider text-ink-muted font-bold mb-1.5 block">
                Transaction screenshot
              </label>

              {proofUrl || previewUrl ?
              <div className="relative rounded-md border border-line overflow-hidden bg-bg-800">
                  <img
                  src={proofUrl || previewUrl || ''}
                  alt="Payment proof preview"
                  className="w-full max-h-56 object-contain" />
                
                  {proofUrl && !uploading &&
                <div className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 bg-buy/90 text-bg-900 text-2xs font-bold rounded">
                      <CheckIcon className="w-3 h-3" /> Uploaded
                    </div>
                }
                  {!uploading &&
                <button
                  type="button"
                  onClick={removeProof}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-bg-900/80 border border-line text-ink-muted hover:text-sell flex items-center justify-center transition-colors"
                  aria-label="Remove screenshot">
                  
                      <XIcon className="w-4 h-4" />
                    </button>
                }
                  {uploading &&
                <div className="absolute inset-x-0 bottom-0 p-3 bg-bg-900/90">
                      <div className="mb-1.5 flex items-center justify-between gap-3 text-2xs text-ink-muted">
                        <span className="inline-flex items-center gap-2 whitespace-nowrap">
                          <Loader2Icon className="w-3.5 h-3.5 animate-spin" />
                          Uploading… {progress}%
                        </span>
                        <button type="button" onClick={removeProof} className="font-bold text-sell hover:text-ink">Cancel</button>
                      </div>
                      <ProgressBar value={progress} tone="brand" height={5} />
                    </div>
                }
                </div> :

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-line rounded-md py-8 flex flex-col items-center justify-center gap-2 text-ink-muted hover:border-brand/50 hover:text-brand transition-colors">
                
                  <UploadIcon className="w-6 h-6" />
                  <span className="text-sm font-semibold">
                    Click to upload screenshot
                  </span>
                  <span className="text-2xs text-ink-dim">
                    JPEG, PNG or WebP · up to 5 MB
                  </span>
                </button>
              }

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={onPickFile} />
              
            </div>

            <Button
              variant="primary"
              size="lg"
              className="w-full mt-5"
              disabled={!proofUrl || uploading || submitting || !selectedWallet}
              onClick={submit}>
              
              {submitting ?
              <>
                  <Loader2Icon className="w-4 h-4 animate-spin" /> Submitting…
                </> :

              <>
                  <ShieldCheckIcon className="w-4 h-4" /> Submit payment proof
                </>
              }
            </Button>

            <button
              type="button"
              onClick={() => nav('/login')}
              className="w-full text-center text-2xs text-ink-muted hover:text-brand transition-colors mt-3">
              
              I'll do this later — go to login
            </button>
          </div>
        </div>
      </div>
    </PageWrapper>);

}
function PageWrapper({
  children,
  wide



}: {children: React.ReactNode;wide?: boolean;}) {
  return (
    <div className="min-h-screen w-full hero-gradient flex items-center justify-center px-4 py-10">
      <div className="absolute inset-0 grid-bg opacity-30" />
      <motion.div
        initial={{
          opacity: 0,
          y: 20
        }}
        animate={{
          opacity: 1,
          y: 0
        }}
        className={`relative w-full ${wide ? 'max-w-3xl' : 'max-w-md'}`}>
        
        {children}
      </motion.div>
    </div>);

}
function SummaryCell({
  label,
  value,
  mono




}: {label: string;value: string;mono?: boolean;}) {
  return (
    <div className="bg-bg-800 border border-line rounded p-3">
      <p className="text-2xs uppercase tracking-wider text-ink-dim">{label}</p>
      <p
        className={`font-semibold mt-0.5 truncate ${mono ? 'font-mono text-sm' : 'text-sm'}`}>
        
        {value}
      </p>
    </div>);

}