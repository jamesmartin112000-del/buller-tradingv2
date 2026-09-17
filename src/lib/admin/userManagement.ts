import { getApps, initializeApp } from '@firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  signOut,
  updateProfile } from
'@firebase/auth';
import { firebaseAuth, firebaseConfig } from '../firebase';
import { fsCommitBatch, fsGet, fsSet } from '../backend/docStore';
import type { DBUser } from '../db/store';

interface ManagedUserInput {
  id?: string;
  email: string;
  name: string;
  password?: string;
  role: 'user' | 'admin';
  status: DBUser['status'];
}

interface DeletedUserRecord {
  id: string;
  email: string;
  deletedAt: number;
  deletedBy: string;
}

const SECONDARY_APP_NAME = 'Secondary';

function secondaryAuth() {
  const app = getApps().find((candidate) => candidate.name === SECONDARY_APP_NAME) ??
  initializeApp(firebaseConfig, SECONDARY_APP_NAME);
  return getAuth(app);
}

function toManagedRecord(
input: ManagedUserInput,
uid: string,
previous?: DBUser | null)
: DBUser {
  const now = Date.now();
  const active = input.status === 'active';
  return {
    ...(previous || {}),
    id: uid,
    uid,
    email: input.email.trim().toLowerCase(),
    name: input.name.trim(),
    role: previous?.role === 'super_admin' ? 'super_admin' : input.role,
    status: previous?.role === 'super_admin' ? 'active' : input.status,
    createdAt: previous?.createdAt || now,
    lastSeen: previous?.lastSeen || now,
    approved: previous?.role === 'super_admin' ? true : active,
    kycApproved: previous?.role === 'super_admin' ?
    true :
    active ?
    previous?.kycApproved ?? true :
    previous?.kycApproved ?? false,
    paymentApproved: previous?.role === 'super_admin' ?
    true :
    active ?
    previous?.paymentApproved ?? true :
    false,
    paymentPending: false,
    subscriptionActive: previous?.role === 'super_admin' ?
    true :
    active ?
    previous?.subscriptionActive ?? true :
    false,
    maxDevices:
    previous?.role === 'super_admin' || input.role === 'admin' ?
    999 :
    previous?.maxDevices ?? 1,
    activeDevices: previous?.activeDevices ?? 0
  };
}

export async function saveManagedUser(input: ManagedUserInput): Promise<DBUser> {
  if (!input.email.trim() || !input.name.trim()) {
    throw new Error('Name and email are required.');
  }

  if (input.id) {
    const previous = await fsGet<DBUser>('users', input.id);
    if (!previous) throw new Error('User profile not found.');
    const record = toManagedRecord(input, input.id, previous);
    await fsSet('users', record, false);
    return record;
  }

  if (!input.password || input.password.length < 8) {
    throw new Error('A secure password of at least 8 characters is required.');
  }
  const auth = secondaryAuth();
  try {
    const credential = await createUserWithEmailAndPassword(
      auth,
      input.email.trim().toLowerCase(),
      input.password
    );
    await updateProfile(credential.user, { displayName: input.name.trim() });
    const record = toManagedRecord(input, credential.user.uid);
    await fsSet('users', record, false);
    return record;
  } finally {
    await signOut(auth).catch(() => {});
  }
}

export async function deleteManagedUser(user: Pick<DBUser, 'id' | 'email'>) {
  if (firebaseAuth.currentUser?.uid === user.id) {
    throw new Error('You cannot delete your own admin account.');
  }
  const profile = await fsGet<DBUser>('users', user.id);
  if (profile?.role === 'super_admin') {
    throw new Error('Super-admin accounts are protected.');
  }

  const tombstone: DeletedUserRecord = {
    id: user.id,
    email: user.email.trim().toLowerCase(),
    deletedAt: Date.now(),
    deletedBy: firebaseAuth.currentUser?.email || 'admin'
  };
  await fsCommitBatch([
  {
    type: 'set',
    path: 'deleted_users',
    id: user.id,
    data: tombstone as unknown as Record<string, unknown>,
    merge: false
  },
  { type: 'delete', path: 'users', id: user.id }]
  );
}