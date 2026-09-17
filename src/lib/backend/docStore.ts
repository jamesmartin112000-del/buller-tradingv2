/**
 * Document store — Cloud Firestore-backed schemaless collection/doc CRUD.
 *
 * Exported API: fsGet, fsList, fsSet, fsUpdate, fsDelete, fsSubscribe,
 * fsSubscribeDoc, where, orderBy, limit, serverTimestamp, stripUndefined,
 * normalizeFirestoreData — consumed by lib/db/store.ts sync layer,
 * userService, deviceLockService and Signup.tsx.
 *
 * `path` is always a COLLECTION path (may be nested, e.g. 'users/{uid}/devices')
 * and `id` is the document id within it. Collections are auto-created by
 * Firestore on first write — no manual setup needed.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  query,
  where as fbWhere,
  orderBy as fbOrderBy,
  limit as fbLimit,
  type QueryConstraint as FbQueryConstraint,
  type WhereFilterOp } from
'@firebase/firestore';
import { firestore, isFirebaseReady } from '../firebase';

// ---------- Query constraint compat (where / orderBy / limit) ----------

export interface QueryConstraint {
  type: 'where' | 'orderBy' | 'limit';
  field?: string;
  op?: string;
  value?: any;
  dir?: 'asc' | 'desc';
  n?: number;
}

export function where(field: string, op: string, value: any): QueryConstraint {
  return { type: 'where', field, op, value };
}

export function orderBy(
field: string,
dir: 'asc' | 'desc' = 'asc')
: QueryConstraint {
  return { type: 'orderBy', field, dir };
}

export function limit(n: number): QueryConstraint {
  return { type: 'limit', n };
}

/** Compat: server timestamp sentinel → millisecond number. */
export function serverTimestamp(): number {
  return Date.now();
}

// ---------- Value helpers ----------

export function stripUndefined<T = any>(input: T): T {
  if (input === undefined) return undefined as any;
  if (input === null) return input;
  if (Array.isArray(input)) {
    return input.
    filter((v) => v !== undefined).
    map((v) => stripUndefined(v)) as any;
  }
  if (typeof input === 'object') {
    const out: any = {};
    for (const k of Object.keys(input as any)) {
      const v = (input as any)[k];
      if (v === undefined) continue;
      out[k] = stripUndefined(v);
    }
    return out;
  }
  return input;
}

/** No legacy Timestamps to normalize — passthrough kept for compat. */
export function normalizeFirestoreData<T = any>(input: any): T {
  return input as T;
}

function setPath(obj: any, path: string, value: any) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) {
      cur[parts[i]] = {};
    }
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

function requireDb() {
  if (!isFirebaseReady()) throw new Error('Firebase is not initialized.');
  return firestore;
}

function docRef(path: string, id: string) {
  return doc(requireDb(), `${path}/${id}`);
}

function collRef(path: string) {
  return collection(requireDb(), path);
}

function toFbConstraints(constraints: QueryConstraint[]): FbQueryConstraint[] {
  const out: FbQueryConstraint[] = [];
  for (const c of constraints) {
    if (c.type === 'where' && c.field && c.op) {
      out.push(fbWhere(c.field, c.op as WhereFilterOp, c.value));
    } else if (c.type === 'orderBy' && c.field) {
      out.push(fbOrderBy(c.field, c.dir || 'asc'));
    } else if (c.type === 'limit' && c.n) {
      out.push(fbLimit(c.n));
    }
  }
  return out;
}

// ---------- CRUD ----------

export async function fsGet<T = any>(
path: string,
id: string)
: Promise<T | null> {
  const snap = await getDoc(docRef(path, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as any) } as T;
}

export async function fsList<T = any>(
path: string,
constraints: QueryConstraint[] = [])
: Promise<T[]> {
  const q = constraints.length ?
  query(collRef(path), ...toFbConstraints(constraints)) :
  collRef(path);
  const snap = await getDocs(q as any);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as T[];
}

export async function fsSet<T extends {id: string;}>(
path: string,
record: T,
merge = true)
: Promise<void> {
  const clean = stripUndefined(record) as Record<string, unknown>;
  const { id: _docId, ...data } = clean;
  await setDoc(docRef(path, record.id), data, { merge });
}

export async function fsUpdate(
path: string,
id: string,
patch: Record<string, any>)
: Promise<void> {
  const clean = stripUndefined(patch);
  const { id: _docId, ...data } = clean;
  const ref = docRef(path, id);
  try {
    // updateDoc understands dot-path field keys natively and merges nested.
    await updateDoc(ref, data as any);
  } catch (err) {
    // Doc may not exist yet (or first write) → fall back to a merging set,
    // expanding any dot-path keys into nested objects.
    const expanded: any = {};
    for (const key of Object.keys(data)) {
      if (key.includes('.')) setPath(expanded, key, (data as any)[key]);else
      expanded[key] = (data as any)[key];
    }
    await setDoc(ref, expanded, { merge: true });
  }
}

export async function fsDelete(path: string, id: string): Promise<void> {
  await deleteDoc(docRef(path, id));
}

export type BatchOperation =
{type: 'set';path: string;id: string;data: Record<string, unknown>;merge?: boolean;} |
{type: 'delete';path: string;id: string;};

/** Commit related writes atomically so partial journal/account state is impossible. */
export async function fsCommitBatch(operations: BatchOperation[]): Promise<void> {
  if (!operations.length) return;
  const batch = writeBatch(requireDb());
  operations.forEach((operation) => {
    const ref = docRef(operation.path, operation.id);
    if (operation.type === 'delete') {
      batch.delete(ref);
    } else {
      const clean = stripUndefined(operation.data);
      const { id: _docId, ...data } = clean;
      batch.set(ref, data, { merge: operation.merge ?? true });
    }
  });
  await batch.commit();
}

// ---------- Realtime subscriptions ----------

export type Unsubscribe = () => void;

/** Subscribe to a collection. Emits the full (filtered) list on any change. */
export function fsSubscribe<T = any>(
path: string,
cb: (rows: T[]) => void,
constraints: QueryConstraint[] = [],
onError?: (err: Error) => void)
: Unsubscribe {
  if (!isFirebaseReady()) return () => {};
  try {
    const q = constraints.length ?
    query(collRef(path), ...toFbConstraints(constraints)) :
    collRef(path);
    return onSnapshot(
      q as any,
      (snap: any) => {
        const rows = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
        cb(rows as T[]);
      },
      (err: any) => onError?.(err as Error)
    );
  } catch (err) {
    onError?.(err as Error);
    return () => {};
  }
}

/** Subscribe to a single document. */
export function fsSubscribeDoc<T = any>(
path: string,
id: string,
cb: (doc: T | null) => void,
onError?: (err: Error) => void)
: Unsubscribe {
  if (!isFirebaseReady()) return () => {};
  try {
    return onSnapshot(
      docRef(path, id),
      (snap: any) => {
        if (!snap.exists()) {
          cb(null);
          return;
        }
        cb({ id: snap.id, ...snap.data() } as T);
      },
      (err: any) => onError?.(err as Error)
    );
  } catch (err) {
    onError?.(err as Error);
    return () => {};
  }
}