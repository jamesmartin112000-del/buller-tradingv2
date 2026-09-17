import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ShieldCheckIcon,
  CheckIcon,
  AlertTriangleIcon,
  IdCardIcon,
  CameraIcon,
  Loader2Icon } from
'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { useUserAccount } from '../../context/UserAccountContext';
import { fsUpdate } from '../../lib/backend/docStore';
import { cacheLocalRecord, db, uid } from '../../lib/db/store';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import {
  uploadFile,
  deleteFile,
  compressImage,
  validateImageFile } from
'../../lib/r2Upload';
import { auditLog } from '../../lib/security/auditLog';
/**
 * KycModal — full-screen KYC verification gate.
 *
 * Files are uploaded to authenticated Firebase Storage under kyc/{uid}/...
 * Only the resulting download URL + storage path is persisted to Firestore.
 * Images are compressed client-side before upload and validated for
 * type + size. Legacy CDN URLs remain readable for backward compatibility.
 */
type DocType = 'id_card' | 'passport';
type Field = 'selfie' | 'idFront' | 'idBack' | 'passport';
interface UploadState {
  url: string;
  path: string;
  progress: number;
  uploading: boolean;
  error?: string;
}
const EMPTY: UploadState = {
  url: '',
  path: '',
  progress: 0,
  uploading: false
};
export function KycModal() {
  const { user, logout } = useAuth();
  const { dbUser } = useUserAccount();
  const [docType, setDocType] = useState<DocType>('id_card');
  const [fullName, setFullName] = useState(user?.name || '');
  const [docNumber, setDocNumber] = useState('');
  const [selfie, setSelfie] = useState<UploadState>(EMPTY);
  const [idFront, setIdFront] = useState<UploadState>(EMPTY);
  const [idBack, setIdBack] = useState<UploadState>(EMPTY);
  const [passport, setPassport] = useState<UploadState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const isPending = dbUser?.kyc?.status === 'pending';
  const isRejected = dbUser?.kyc?.status === 'rejected';
  const setterFor = (field: Field) => {
    switch (field) {
      case 'selfie':
        return setSelfie;
      case 'idFront':
        return setIdFront;
      case 'idBack':
        return setIdBack;
      case 'passport':
        return setPassport;
    }
  };
  const handleFile = async (
  field: Field,
  e: React.ChangeEvent<HTMLInputElement>) =>
  {
    const file = e.target.files?.[0];
    // Reset input so the same file can be re-picked after failure
    e.target.value = '';
    if (!file || !user) return;
    // Quick local validation before we even compress
    const check = validateImageFile(file);
    if (!check.ok) {
      toast.error(check.reason || 'Invalid file');
      return;
    }
    const setter = setterFor(field);
    setter({
      url: '',
      path: '',
      progress: 0,
      uploading: true
    });
    try {
      const compressed = await compressImage(file);
      const res = await uploadFile('kyc', user.uid, compressed, (pct) => {
        setter((prev) => ({
          ...prev,
          progress: pct
        }));
      });
      if (!res.ok || !res.url || !res.path) {
        setter({
          url: '',
          path: '',
          progress: 0,
          uploading: false,
          error: res.error
        });
        toast.error(res.error || 'Upload failed');
        return;
      }
      setter({
        url: res.url,
        path: res.path,
        progress: 100,
        uploading: false
      });
    } catch (err: any) {
      setter({
        url: '',
        path: '',
        progress: 0,
        uploading: false,
        error: err?.message || 'Upload failed'
      });
      toast.error('Upload failed — please retry');
    }
  };
  const anyUploading =
  selfie.uploading ||
  idFront.uploading ||
  idBack.uploading ||
  passport.uploading;
  const canSubmit =
  fullName.trim().length >= 2 &&
  docNumber.trim().length >= 4 &&
  !!selfie.url &&
  !anyUploading && (
  docType === 'passport' ? !!passport.url : !!idFront.url && !!idBack.url);
  const submit = async () => {
    if (!user || !dbUser) return;
    if (!canSubmit) {
      toast.error('Please complete all required uploads');
      return;
    }
    setSubmitting(true);
    // Best-effort delete of previously uploaded KYC files (storage cleanup).
    const prevPaths: Record<string, string> | undefined =
    dbUser.kyc?.kycStoragePaths;
    if (prevPaths) {
      await Promise.all(
        Object.values(prevPaths).
        filter(Boolean).
        map((p) => deleteFile(p).catch(() => false))
      );
    }
    const newPaths: Record<string, string> = {};
    if (selfie.path) newPaths.selfie = selfie.path;
    if (docType === 'id_card') {
      if (idFront.path) newPaths.idFront = idFront.path;
      if (idBack.path) newPaths.idBack = idBack.path;
    } else {
      if (passport.path) newPaths.passport = passport.path;
    }
    // Build the KYC payload using `null` (never `undefined`) for the
    // document fields that don't apply to the chosen doc type. Firestore
    // accepts `null` but rejects `undefined`, which previously caused the
    // entire write to fail silently and KYC never persisted.
    const kyc = {
      status: 'pending' as const,
      docType,
      fullName: fullName.trim(),
      docNumber: docNumber.trim(),
      selfieUrl: selfie.url,
      idFrontUrl: docType === 'id_card' ? idFront.url : null,
      idBackUrl: docType === 'id_card' ? idBack.url : null,
      passportUrl: docType === 'passport' ? passport.url : null,
      // Legacy *DataUrl mirror (admin viewer reads these as fallback).
      selfieDataUrl: selfie.url,
      idFrontDataUrl: docType === 'id_card' ? idFront.url : null,
      idBackDataUrl: docType === 'id_card' ? idBack.url : null,
      passportDataUrl: docType === 'passport' ? passport.url : null,
      kycStoragePaths: newPaths,
      submittedAt: Date.now(),
      reviewedAt: null,
      rejectReason: null
    };
    const payload = { kyc };
    try {
      // Patch only the KYC object. Approval, role, status and subscription
      // fields are server/admin owned and must remain unchanged by self-writes.
      await fsUpdate('users', user.uid, payload);
      cacheLocalRecord('users', { ...dbUser, ...payload });
      db.insert('notifications', {
        id: uid('nt'),
        target: 'admin',
        title: 'New KYC submission',
        body: `${user.name} (${user.email}) submitted KYC for review.`,
        kind: 'info',
        read: false,
        createdAt: Date.now(),
        link: '/app/admin'
      });
      db.log('info', 'kyc', `KYC submitted by ${user.email}`);
      void auditLog('info', 'kyc-submit', `KYC submitted by ${user.email}`, {
        uid: user.uid,
        docType
      });
      toast.success('KYC submitted — admin will review shortly');
    } catch (err: any) {
      console.error('[KYC SUBMIT FAILED]', err);
      toast.error(err?.message || 'Could not submit KYC — please retry');
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <motion.div
      initial={{
        opacity: 0
      }}
      animate={{
        opacity: 1
      }}
      className="fixed inset-0 z-[9997] bg-bg-900/98 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto">
      
      <motion.div
        initial={{
          y: 20,
          opacity: 0
        }}
        animate={{
          y: 0,
          opacity: 1
        }}
        className="bg-bg-700 border border-brand/40 rounded-xl w-full max-w-2xl my-8 brand-glow">
        
        <div className="p-6 lg:p-8">
          {/* Header */}
          <div className="text-center mb-5">
            <div className="w-14 h-14 rounded-full bg-brand/15 border border-brand/40 flex items-center justify-center mx-auto mb-3">
              <ShieldCheckIcon className="w-7 h-7 text-brand" />
            </div>
            <h2 className="text-2xl font-bold">Identity Verification (KYC)</h2>
            <p className="text-xs text-ink-muted mt-2 leading-relaxed">
              Account use karne se pehle KYC zaroori hai. Documents submit
              karein — admin verify karega.
            </p>
          </div>

          {/* Notice */}
          <div className="bg-warn/10 border border-warn/30 rounded-lg p-3 mb-5 flex gap-2">
            <AlertTriangleIcon className="w-4 h-4 text-warn shrink-0 mt-0.5" />
            <div className="text-2xs text-ink leading-relaxed space-y-1">
              <p>
                <strong className="text-warn">Notice:</strong> Name, picture aur
                document <strong>same user</strong> ke honay chahiye. Fake ya
                kisi aur ke documents submit karne par account permanently
                banned ho jayega.
              </p>
              <p className="text-ink-muted">
                The name, photo and document must all belong to the same person.
                Submitting fake or someone else's documents will result in a
                permanent ban.
              </p>
            </div>
          </div>

          {isPending ?
          <div className="bg-warn/10 border border-warn/30 rounded-lg p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-warn/20 border border-warn flex items-center justify-center mx-auto mb-3">
                <ShieldCheckIcon className="w-6 h-6 text-warn" />
              </div>
              <div className="text-lg font-bold text-warn">
                KYC Under Review
              </div>
              <p className="text-xs text-ink-muted mt-2 leading-relaxed">
                Aap ka KYC submission admin ke paas hai. Verification ke baad
                aap ko notification milegi (usually within 24 hours).
              </p>
              <Button variant="secondary" onClick={logout} className="mt-5">
                Sign Out
              </Button>
            </div> :

          <>
              {isRejected && dbUser?.kyc?.rejectReason &&
            <div className="bg-sell/10 border border-sell/30 rounded-lg p-3 mb-4">
                  <div className="text-2xs uppercase tracking-wider text-sell font-bold mb-1">
                    Previous Submission Rejected
                  </div>
                  <div className="text-xs text-ink">
                    {dbUser.kyc.rejectReason}
                  </div>
                </div>
            }

              {/* Doc type selector */}
              <div className="mb-4">
                <label className="text-2xs uppercase tracking-wider text-ink-muted font-bold mb-2 block">
                  Document type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['id_card', 'passport'] as DocType[]).map((dt) =>
                <button
                  key={dt}
                  onClick={() => setDocType(dt)}
                  className={`p-3 rounded border text-xs font-bold transition-colors ${docType === dt ? 'bg-brand/15 border-brand text-brand' : 'bg-bg-700 border-line text-ink-muted hover:border-brand/30'}`}>
                  
                      <IdCardIcon className="w-4 h-4 mx-auto mb-1" />
                      {dt === 'id_card' ? 'ID Card' : 'Passport'}
                    </button>
                )}
                </div>
              </div>

              {/* Full name */}
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                label="Full name (as on document)"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Exactly as shown on your ID" />
              
                <Input
                label="Document number"
                value={docNumber}
                onChange={(e) => setDocNumber(e.target.value)}
                placeholder="ID or passport number" />
              
              </div>

              {/* Selfie */}
              <div className="mt-4">
                <FileUploadField
                label="Selfie (face clearly visible)"
                icon={<CameraIcon className="w-5 h-5" />}
                state={selfie}
                onChange={(e) => handleFile('selfie', e)} />
              
              </div>

              {/* ID Card front + back */}
              {docType === 'id_card' &&
            <div className="grid grid-cols-2 gap-3 mt-3">
                  <FileUploadField
                label="ID Card · Front"
                icon={<IdCardIcon className="w-5 h-5" />}
                state={idFront}
                onChange={(e) => handleFile('idFront', e)} />
              
                  <FileUploadField
                label="ID Card · Back"
                icon={<IdCardIcon className="w-5 h-5" />}
                state={idBack}
                onChange={(e) => handleFile('idBack', e)} />
              
                </div>
            }

              {/* Passport */}
              {docType === 'passport' &&
            <div className="mt-3">
                  <FileUploadField
                label="Passport · Photo page"
                icon={<IdCardIcon className="w-5 h-5" />}
                state={passport}
                onChange={(e) => handleFile('passport', e)} />
              
                </div>
            }

              <Button
              variant="primary"
              size="lg"
              className="w-full mt-5"
              onClick={submit}
              disabled={!canSubmit || submitting}>
              
                {submitting ?
              'Submitting…' :
              anyUploading ?
              'Uploading…' :
              'Submit for Verification'}
              </Button>

              <button
              onClick={logout}
              className="w-full text-2xs text-ink-dim hover:text-ink underline pt-3">
              
                Sign out
              </button>
            </>
          }
        </div>
      </motion.div>
    </motion.div>);

}
function FileUploadField({
  label,
  icon,
  state,
  onChange





}: {label: string;icon: React.ReactNode;state: UploadState;onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;}) {
  const { url, progress, uploading, error } = state;
  return (
    <div>
      <label className="text-2xs uppercase tracking-wider text-ink-muted font-bold mb-1 block">
        {label}
      </label>
      <label className="cursor-pointer block">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={onChange}
          disabled={uploading}
          className="hidden" />
        
        <div className="relative overflow-hidden bg-bg-700 border border-dashed border-line hover:border-brand/50 rounded p-3 text-center transition-colors min-h-[100px] flex flex-col items-center justify-center">
          {uploading ?
          <div className="space-y-2 w-full">
              <Loader2Icon className="w-5 h-5 text-brand animate-spin mx-auto" />
              <div className="text-2xs text-ink-muted">
                Uploading… {progress}%
              </div>
            </div> :
          url ?
          <div className="space-y-1">
              <img
              src={url}
              alt={label}
              className="max-h-20 mx-auto rounded border border-line" />
            
              <div className="text-2xs text-buy flex items-center justify-center gap-1">
                <CheckIcon className="w-3 h-3" />
                Uploaded
              </div>
            </div> :

          <div className="text-ink-muted">
              <div className="flex justify-center mb-1">{icon}</div>
              <div className="text-2xs">Click to upload</div>
              {error &&
            <div className="text-3xs text-sell mt-1 px-2">{error}</div>
            }
            </div>
          }
          {/* Progress bar overlay */}
          {uploading &&
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-bg-900">
              <div
              className="h-full bg-brand transition-all duration-150"
              style={{
                width: `${progress}%`
              }} />
            
            </div>
          }
        </div>
      </label>
    </div>);

}