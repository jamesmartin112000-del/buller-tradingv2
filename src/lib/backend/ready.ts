/**
 * Backend readiness — Firebase is the live backend.
 *
 * NOTE: This is intentionally decoupled from the (removed) Supabase layer.
 * `isSupabaseReady()` permanently returns false so every legacy Supabase
 * call site gracefully no-ops, while the real data path (auth.ts +
 * docStore.ts) runs entirely on Firebase.
 */
import { isFirebaseReady, getFirebaseInitError } from '../firebase';

/** True when the backend (Firebase) initialized successfully. */
export function isBackendReady(): boolean {
  return isFirebaseReady();
}

/** Last init error, if any. */
export function getBackendInitError(): Error | null {
  return getFirebaseInitError();
}