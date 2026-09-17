import {
  getApp,
  getApps,
  initializeApp,
  type FirebaseApp } from
'@firebase/app';
import { getAnalytics, isSupported } from '@firebase/analytics';
import { getAuth, type Auth } from '@firebase/auth';
import { getFirestore, type Firestore } from '@firebase/firestore';

export const firebaseConfig = {
  apiKey: 'AIzaSyBKOxJ7RDXtcsXBzfpWwo-Buf7xEjFq4VM',
  authDomain: 'buller-trading.firebaseapp.com',
  projectId: 'buller-trading',
  messagingSenderId: '527607012639',
  appId: '1:527607012639:web:4b37b035e5fae497a5a42a',
  measurementId: 'G-P97ZRRL7YB'
};

let firebaseAppInstance: FirebaseApp | null = null;
let firebaseAuthInstance: Auth | null = null;
let firestoreInstance: Firestore | null = null;
let initializationError: Error | null = null;

try {
  firebaseAppInstance = getApps().length ? getApp() : initializeApp(firebaseConfig);
  firebaseAuthInstance = getAuth(firebaseAppInstance);
  firestoreInstance = getFirestore(firebaseAppInstance);

  if (typeof window !== 'undefined') {
    void isSupported().
    then((supported) => {
      if (supported && firebaseAppInstance) getAnalytics(firebaseAppInstance);
    }).
    catch((error) => console.warn('[firebase] Analytics unavailable', error));
  }
} catch (error) {
  initializationError =
  error instanceof Error ? error : new Error(String(error));
  console.error('[firebase] initialization failed', error);
}

export const firebaseAuth = firebaseAuthInstance as Auth;
export const firestore = firestoreInstance as Firestore;
export const app = firebaseAppInstance as FirebaseApp;

export function isFirebaseReady(): boolean {
  return Boolean(firebaseAuthInstance && firestoreInstance);
}

export function getFirebaseInitError(): Error | null {
  return initializationError;
}

export const auth = firebaseAuth;
export const db = firestore;
export const firebaseApp = app;

export default app;