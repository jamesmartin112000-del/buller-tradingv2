import { useState, useEffect, useCallback, useRef } from 'react';
import {
  generateFingerprint,
  evaluateDevice,
  subscribeDeviceLock,
  submitDeviceChangeRequest as submitReq,
  verifyPasswordAndGetUid,
  findPendingRequestForDevice,
  MAX_WARNINGS,
  type DeviceFingerprint,
  type DeviceLock } from
'../lib/backend/deviceLockService';

export interface UseDeviceLockReturn {
  isLoading: boolean;
  isAllowed: boolean;
  isLocked: boolean;
  needsRequest: boolean;
  warning: string | null;
  warnings: number;
  maxWarnings: number;
  currentDevice: DeviceFingerprint | null;
  /** True when admin granted this user unlimited devices (no rules apply). */
  isUnlimited: boolean;
  /** Id of an already-pending device-change request for THIS device, if any. */
  pendingRequestId: string | null;
  // Actions
  refresh: () => Promise<void>;
  /** Re-checks (read-only) whether a pending request exists for this device. */
  recheckPending: () => Promise<void>;
  submitRequest: (
  email: string,
  password: string,
  reason: string)
  => Promise<{success: boolean;message: string;requestId?: string;}>;
}

/**
 * Firestore-backed single-device enforcement for the CURRENT signed-in user.
 *
 * - Evaluates this device on mount (CASE 1/2/3).
 * - Subscribes to users/{uid}.deviceLock in real-time so an admin approval
 *   or lock takes effect instantly (no refresh).
 *
 * Admins should NOT mount this hook (they bypass the guard entirely).
 */
export function useDeviceLock(
uid: string | undefined,
email: string | undefined)
: UseDeviceLockReturn {
  const [isLoading, setIsLoading] = useState(true);
  const [currentDevice, setCurrentDevice] = useState<DeviceFingerprint | null>(
    null
  );
  const [lock, setLock] = useState<DeviceLock | null>(null);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [evalState, setEvalState] = useState<{
    isAllowed: boolean;
    needsRequest: boolean;
    warning: string | null;
    warnings: number;
  }>({ isAllowed: false, needsRequest: false, warning: null, warnings: 0 });

  const fpRef = useRef<DeviceFingerprint | null>(null);

  const recheckPending = useCallback(async () => {
    if (!uid) return;
    const fp = fpRef.current;
    if (!fp) return;
    try {
      const req = await findPendingRequestForDevice(uid, fp.id);
      setPendingRequestId(req ? req.id : null);
    } catch {

      // read-only check — never block the guard on failure
    }}, [uid]);

  const runEvaluation = useCallback(async () => {
    if (!uid || !email) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const fp = fpRef.current || (await generateFingerprint());
      fpRef.current = fp;
      setCurrentDevice(fp);

      const result = await evaluateDevice(uid, email, fp);
      setEvalState({
        isAllowed: result.state === 'allowed',
        needsRequest: result.needsRequest,
        warning: result.warning,
        warnings: result.warnings
      });

      // If this device is not allowed, surface any already-pending request
      // so the UI can show "request pending" instead of asking again.
      if (result.state !== 'allowed') {
        const req = await findPendingRequestForDevice(uid, fp.id);
        setPendingRequestId(req ? req.id : null);
      } else {
        setPendingRequestId(null);
      }
    } catch (err) {
      console.error('[deviceLock] evaluation failed', err);
      setEvalState({
        isAllowed: false,
        needsRequest: false,
        warning: 'Device verification failed. Please retry.',
        warnings: 0
      });
    } finally {
      setIsLoading(false);
    }
  }, [uid, email]);

  // Initial evaluation.
  useEffect(() => {
    runEvaluation();
  }, [runEvaluation]);

  // Real-time lock subscription — reflects admin approve / lock instantly.
  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeDeviceLock(uid, (next) => {
      console.log('[deviceLock] live lock update', next);
      setLock(next);
      const fp = fpRef.current;
      if (!fp) return;
      // Unlimited devices → always allowed, instantly.
      if (next.unlimitedDevices) {
        setEvalState((s) => ({
          ...s,
          isAllowed: true,
          needsRequest: false,
          warning: null
        }));
        setPendingRequestId(null);
        return;
      }
      // Re-derive allow/deny purely from the live snapshot.
      if (next.isLocked) {
        setEvalState((s) => ({
          ...s,
          isAllowed: false,
          needsRequest: false
        }));
      } else if (next.activeDeviceId === fp.id) {
        setEvalState((s) => ({
          ...s,
          isAllowed: true,
          needsRequest: false,
          warning: null
        }));
        setPendingRequestId(null);
      } else if (next.activeDeviceId && next.activeDeviceId !== fp.id) {
        setEvalState((s) => ({
          ...s,
          isAllowed: false,
          needsRequest: true
        }));
      }
    });
    return unsub;
  }, [uid]);

  const submitRequest = useCallback(
    async (reqEmail: string, password: string, reason: string) => {
      try {
        const verifiedUid = await verifyPasswordAndGetUid(reqEmail, password);
        const fp = fpRef.current || (await generateFingerprint());
        fpRef.current = fp;
        const res = await submitReq({
          uid: verifiedUid,
          email: reqEmail,
          newFingerprint: fp,
          reason
        });
        if (res.requestId) setPendingRequestId(res.requestId);
        return res;
      } catch (err: any) {
        return {
          success: false,
          message: err?.message || 'Could not submit request.'
        };
      }
    },
    []
  );

  return {
    isLoading,
    isAllowed: evalState.isAllowed,
    isLocked: !!lock?.isLocked && !lock?.unlimitedDevices,
    needsRequest: evalState.needsRequest,
    warning: evalState.warning,
    warnings: evalState.warnings,
    maxWarnings: MAX_WARNINGS,
    currentDevice,
    isUnlimited: !!lock?.unlimitedDevices,
    pendingRequestId,
    refresh: runEvaluation,
    recheckPending,
    submitRequest
  };
}