/**
 * LocalDB — a typed, reactive, localStorage-backed "database" for the engine.
 *
 * Why localStorage?
 *   • Zero cost, zero setup, zero API keys (true "free database")
 *   • Persists across sessions
 *   • Cross-tab sync via the `storage` event
 *   • Sufficient for the data volumes we handle (users, access requests,
 *     chat messages, notifications, content blocks, signals history)
 *
 * Each collection is a keyed list of records. Mutations broadcast to all
 * subscribers (same-tab AND cross-tab) so the admin panel updates the
 * moment a user sends a chat message or requests access.
 */

const PREFIX = 'te.db.';

// ---------- Types ----------

export interface DBUser {
  id: string;
  /** Firebase Auth UID (equals `id`). Stored explicitly per KYC spec. */
  uid?: string;
  email: string;
  name: string;
  role: 'super_admin' | 'admin' | 'user';
  status: 'active' | 'banned' | 'pending' | 'locked';
  createdAt: number;
  lastSeen: number;

  // RBAC & Subscription flags
  approved?: boolean;
  kycApproved?: boolean;
  paymentApproved?: boolean;
  paymentPending?: boolean;
  subscriptionActive?: boolean;
  expiresAt?: number;
  maxDevices?: number;
  activeDevices?: number;
  /** Canonical and legacy plan identifiers kept for admin/reporting joins. */
  plan?: string;
  requestedPlan?: string;
  subscriptionPlan?: string;
  planName?: string;
  planAmount?: number;
  paymentStatus?: 'pending' | 'approved' | 'rejected';
  approvedAt?: number;

  // Account validity — admin sets validity in days; account auto-locks
  // when validityExpiresAt < now until next payment is approved.
  validityDays?: number;
  validityHours?: number;
  validityStartedAt?: number;
  validityExpiresAt?: number;
  // KYC
  kyc?: {
    status: 'none' | 'pending' | 'approved' | 'rejected';
    docType?: 'id_card' | 'passport';
    fullName?: string;
    docNumber?: string;
    // Canonical R2 public URL fields
    selfieUrl?: string | null;
    idFrontUrl?: string | null;
    idBackUrl?: string | null;
    passportUrl?: string | null;
    // Legacy *DataUrl fields kept in sync until the migration job completes.
    selfieDataUrl?: string | null;
    idFrontDataUrl?: string | null;
    idBackDataUrl?: string | null;
    passportDataUrl?: string | null;
    // R2 object keys so replaced uploads can be securely deleted.
    kycStoragePaths?: Record<string, string>;
    submittedAt?: number;
    reviewedAt?: number | null;
    reviewedBy?: string;
    rejectReason?: string | null;
  };
  // Device binding — one device per user
  primaryDeviceId?: string;
  deviceWarnings?: number;
  // Master gate pass (admin issues manually)
  gateKey?: string;

  // Contact + identity (collected at signup)
  whatsapp?: string;
  username?: string;
}

export interface AccessRequest {
  id: string;
  email: string;
  name: string;
  reason: string;
  /** Backward-compatible discriminator; absent records are standard access requests. */
  requestType?: 'access' | 'demo';
  // --- New onboarding fields (Master Gate Key flow) ---
  whatsapp?: string;
  country?: string;
  tradingExperience?: 'beginner' | 'intermediate' | 'advanced' | 'professional';
  preferredMarket?: 'forex' | 'crypto' | 'gold' | 'indices' | 'stocks' | 'mixed';
  telegramUsername?: string;
  referralCode?: string;
  agreedToRules?: boolean;
  /** Confirms strength validation happened; the password itself is never persisted. */
  passwordValidated?: boolean;
  status: 'pending' | 'approved' | 'denied';
  createdAt: number;
  decidedAt?: number;
  decidedBy?: string;
  approvedBy?: string;
  adminNote?: string;
  // Master Gate Key issued on approval
  masterGateKey?: string;
  keySent?: boolean;
  keySentAt?: number;
}

export interface ChatMessage {
  id: string;
  threadId: string; // user email (one thread per user)
  from: 'user' | 'admin';
  authorName: string;
  text: string;
  createdAt: number;
  read: boolean;
  /** Optional attachment (picture / video / document) sent in chat. */
  attachmentUrl?: string;
  attachmentType?: 'image' | 'video' | 'file';
  attachmentName?: string;
}

export interface ChatThread {
  id: string; // user email
  userName: string;
  userEmail: string;
  lastMessage: string;
  lastAt: number;
  unreadForAdmin: number;
  unreadForUser: number;
  status: 'open' | 'closed';
}

export interface Notification {
  id: string;
  target: 'admin' | 'user' | 'broadcast';
  targetEmail?: string; // for user-targeted
  title: string;
  body: string;
  kind: 'info' | 'success' | 'warn' | 'error' | 'access_request' | 'chat';
  read: boolean;
  createdAt: number;
  link?: string;
}

export interface ContentBlock {
  id: string; // e.g. "landing.hero.title"
  value: string;
  updatedAt: number;
  updatedBy?: string;
}

export interface SystemLog {
  id: string;
  level: 'info' | 'warn' | 'error';
  source: string;
  message: string;
  createdAt: number;
}

export interface PaymentSubmission {
  id: string;
  userEmail: string;
  userName: string;
  walletAddress: string;
  transactionId: string;
  /** @deprecated text-only crypto payments now — kept for legacy records. */
  screenshotDataUrl?: string;
  amount?: string;
  network?: string;
  notes?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
  reviewedAt?: number;
  reviewedBy?: string;
  adminNote?: string;
  validityDaysGranted?: number;
  validityHoursGranted?: number;
}

/**
 * Payment proof submitted from the signup crypto-payment screen.
 * Synced to Firestore so the admin sees it from any device.
 */
export interface PaymentProof {
  id: string;
  /** Firebase Auth UID of the submitting user, when known. */
  userId?: string | null;
  email: string;
  userName?: string | null;
  whatsapp?: string | null;
  /** Plan identifier (e.g. 'pro') when known, plus the display name. */
  planId?: string | null;
  plan: string;
  amount: number;
  currency?: string;
  /** e.g. 'crypto' / 'bank'. Defaults to 'crypto' for the signup flow. */
  paymentMethod?: string;
  network: string;
  walletAddress: string;
  proofUrl: string;
  txid?: string;
  status: 'pending' | 'verified' | 'rejected';
  /** Free-text admin note captured on approve/reject. */
  adminNotes?: string | null;
  /** Validity (days) granted to the user when this payment is approved. */
  validityDaysGranted?: number;
  createdAt: number;
  updatedAt?: number;
  reviewedAt?: number;
  reviewedBy?: string;
}

/**
 * Admin-managed crypto wallet address shown to users on the /gate payment
 * screen. Synced to Firestore so an admin edit on one device is reflected
 * for every user instantly — no stale local cache.
 */
export interface WalletAddress {
  id: string;
  network: string;
  address: string;
  createdAt: number;
}

export interface DeviceLog {
  id: string;
  userEmail: string;
  deviceId: string;
  userAgent: string;
  ip?: string;
  /**
   * allowed       — device is bound and may sign in.
   * denied        — device was rejected (limit exceeded, admin rejection, etc).
   * warned        — device mismatch warning shown to user.
   * requested     — user has requested admin to approve this NEW device
   *                 (replaces old one). Admin reviews in Devices tab.
   * unlock_request— user (account locked from too many warnings) is asking
   *                 admin to unlock & rebind to this device.
   */
  status: 'allowed' | 'denied' | 'warned' | 'requested' | 'unlock_request';
  createdAt: number;
  reviewedAt?: number;
  reviewedBy?: string;
  reviewNote?: string;
  /** Human-friendly label so admin can tell devices apart at a glance. */
  label?: string;
}

export interface MasterKey {
  id: string;
  key: string;
  email: string;
  /** Backward-compatible whole-day representation used by legacy keys. */
  validityDays: number;
  /** Precise validity duration. New keys use this as the source of truth. */
  validityHours?: number;
  /**
   * @deprecated Kept for back-compat. The new model uses `validityExpiresAt`
   * to determine if a key is still usable. `used: true` is set once the key
   * has been activated by the user at least once.
   */
  used: boolean;
  /** First time the key was successfully used at /gate. */
  usedAt?: number;
  /**
   * Expiry timestamp computed at first use as
   *   usedAt + validityDays * 24h
   * The same key remains usable on subsequent logins until this timestamp
   * passes — at which point the user must request a new key.
   */
  validityExpiresAt?: number;
  createdAt: number;
  createdBy: string;
}

/** Membership plan offered to users at the payment step on /gate. */
export interface Plan {
  id: string;
  name: string;
  /** Period unit + count, e.g. { unit: 'days', count: 30 } */
  durationUnit: 'days' | 'months' | 'years';
  durationCount: number;
  /** Display price string (e.g. "$49" / "PKR 12,000"). Free-text so admin can use any currency. */
  price: string;
  /** Per-plan device cap (defaults to 1 — strict single-device per the engine's policy). */
  maxDevices: number;
  /** Short marketing line. */
  description: string;
  /** Bullet features shown on the pricing card. */
  features: string[];
  /** Highlighted on landing as the recommended plan. */
  featured: boolean;
  /** Soft-deleted / hidden plans aren't shown to users but remain in admin for audit. */
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

// ---------- Collections registry ----------

export type Collection =
'users' |
'accessRequests' |
'chatMessages' |
'chatThreads' |
'notifications' |
'content' |
'logs' |
'payments' |
'paymentProofs' |
'walletAddresses' |
'devices' |
'masterKeys' |
'plans';

type Schema = {
  users: DBUser;
  accessRequests: AccessRequest;
  chatMessages: ChatMessage;
  chatThreads: ChatThread;
  notifications: Notification;
  content: ContentBlock;
  logs: SystemLog;
  payments: PaymentSubmission;
  paymentProofs: PaymentProof;
  walletAddresses: WalletAddress;
  devices: DeviceLog;
  masterKeys: MasterKey;
  plans: Plan;
};

// ---------- Low-level I/O ----------

function k(col: Collection) {
  return PREFIX + col;
}

function readRaw<C extends Collection>(col: C): Schema[C][] {
  try {
    const raw = localStorage.getItem(k(col));
    if (!raw) return [];
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function writeRaw<C extends Collection>(col: C, list: Schema[C][]) {
  try {
    localStorage.setItem(k(col), JSON.stringify(list));
    notify(col);
  } catch (e) {
    // quota exceeded — trim logs/chat if needed
    if (col === 'logs' && list.length > 100) {
      localStorage.setItem(k(col), JSON.stringify(list.slice(-100)));
    }
  }
}

// ---------- Pub/sub ----------

const listeners = new Map<Collection, Set<() => void>>();

function notify(col: Collection) {
  listeners.get(col)?.forEach((fn) => {
    try {
      fn();
    } catch {}
  });
}

export function subscribe(col: Collection, fn: () => void): () => void {
  if (!listeners.has(col)) listeners.set(col, new Set());
  listeners.get(col)!.add(fn);
  return () => listeners.get(col)?.delete(fn);
}

// Cross-tab sync
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (!e.key || !e.key.startsWith(PREFIX)) return;
    const col = e.key.slice(PREFIX.length) as Collection;
    notify(col);
  });
}

// ---------- Public API ----------

export function uid(prefix = 'id'): string {
  return (
    prefix +
    '_' +
    Date.now().toString(36) +
    '_' +
    Math.random().toString(36).slice(2, 8));

}

/**
 * Generate a Master Gate Key in the format AZH-TRD-XXXX-XXXX
 * using cryptographically secure randomness and an unambiguous alphabet.
 */
export function generateMasterKey(): string {
  const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const block = (length: number) => {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (value) => ALPHABET[value & 31]).join('');
  };
  return `AZH-TRD-${block(4)}-${block(4)}`;
}

export const db = {
  list<C extends Collection>(col: C): Schema[C][] {
    return readRaw(col);
  },
  get<C extends Collection>(col: C, id: string): Schema[C] | undefined {
    return readRaw(col).find((r: any) => r.id === id);
  },
  insert<C extends Collection>(col: C, record: Schema[C]): Schema[C] {
    const list = readRaw(col);
    list.unshift(record);
    writeRaw(col, list);
    return record;
  },
  upsert<C extends Collection>(col: C, record: Schema[C]): Schema[C] {
    const list = readRaw(col);
    const idx = list.findIndex((r: any) => r.id === (record as any).id);
    if (idx >= 0) list[idx] = record;else
    list.unshift(record);
    writeRaw(col, list);
    return record;
  },
  update<C extends Collection>(
  col: C,
  id: string,
  patch: Partial<Schema[C]>)
  : Schema[C] | null {
    const list = readRaw(col);
    const idx = list.findIndex((r: any) => r.id === id);
    if (idx < 0) return null;
    list[idx] = { ...list[idx], ...patch } as Schema[C];
    writeRaw(col, list);
    return list[idx];
  },
  remove<C extends Collection>(col: C, id: string): boolean {
    const list = readRaw(col);
    const next = list.filter((r: any) => r.id !== id);
    if (next.length === list.length) return false;
    writeRaw(col, next);
    return true;
  },
  clear<C extends Collection>(col: C) {
    writeRaw(col, []);
  },
  /** Convenience: log a system event */
  log(level: SystemLog['level'], source: string, message: string) {
    const list = readRaw('logs');
    list.unshift({
      id: uid('log'),
      level,
      source,
      message,
      createdAt: Date.now()
    });
    writeRaw('logs', list.slice(0, 200));
  }
};

// ---------- Seed (idempotent) ----------

export function defaultContentBlocks(): ContentBlock[] {
  const updatedAt = Date.now();
  return [
  { id: 'landing.hero.eyebrow', value: 'BULLER TRADING', updatedAt },
  {
    id: 'landing.hero.title',
    value: 'Gold Intelligence. Disciplined Execution.',
    updatedAt
  },
  {
    id: 'landing.hero.subtitle',
    value:
    'SMC, ICT, AMD and order-flow analytics — wrapped in a clean, fast desk-grade UI.',
    updatedAt
  },
  { id: 'landing.cta.primary', value: 'Request Access', updatedAt },
  {
    id: 'support.welcome',
    value:
    'Hi! How can we help today? Our team typically replies within a few hours.',
    updatedAt
  },
  {
    id: 'access.email.template',
    value:
    "Thank you for requesting access to BULLER TRADING. Your request has been received and is under review by our team. You will receive a response at the email address provided within 24 hours. If approved, you'll receive your platform credentials and onboarding instructions.",
    updatedAt
  },
  { id: 'admin.contact.name', value: '(R.D.H;~$)', updatedAt },
  { id: 'admin.contact.whatsapp', value: '+92 300 0000000', updatedAt },
  {
    id: 'admin.contact.responseTime',
    value: 'Typically within 24 hours',
    updatedAt
  },
  {
    id: 'payment.wallet.address',
    value: 'TRX0000000000000000000000000000000000',
    updatedAt
  },
  { id: 'payment.wallet.network', value: 'USDT • TRC20', updatedAt },
  { id: 'site.name', value: 'BULLER TRADING', updatedAt },
  {
    id: 'brand.logoUrl',
    value: "/LOGO_PNG_FINAL.png",

    updatedAt
  },
  {
    id: 'brand.circleLogoUrl',
    value: "/FINAL-CIRCLE-LOGO.png",

    updatedAt
  },
  { id: 'brand.logoSize', value: '48', updatedAt },
  { id: 'brand.name', value: 'BULLER TRADING', updatedAt },
  { id: 'brand.version', value: '', updatedAt },
  { id: 'brand.subtitle', value: 'SYED AZHAAD HUSSAIN', updatedAt },
  { id: 'brand.initials', value: 'BT', updatedAt },
  { id: 'chat.position', value: 'bottom-right', updatedAt },
  { id: 'chat.size', value: 'md', updatedAt },
  { id: 'chat.offsetX', value: '20', updatedAt },
  { id: 'chat.offsetY', value: '20', updatedAt },
  { id: 'public.links', value: '[]', updatedAt },
  { id: 'social.instagramUrl', value: '', updatedAt },
  { id: 'social.facebookUrl', value: '', updatedAt },
  { id: 'social.youtubeUrl', value: '', updatedAt }];

}

/**
 * Seed default content blocks only.
 *
 * NOTE: The legacy super-admin user seed has been REMOVED. It created a
 * users doc with a custom usr_xxx ID, which then got mirrored to
 * Firestore as an orphan doc that competed with the real
 * users/{firebase_uid} doc created by ensureUserDoc().
 *
 * The super-admin (admin@buller.com) is now auto-promoted by
 * ensureUserDoc() on first Firebase sign-in. The Firebase Auth UID is
 * the single source of truth for the doc ID — no custom IDs anywhere.
 */
export function ensureSeed() {
  const users = readRaw('users');

  // Cleanup: drop any legacy placeholders older builds may have seeded.
  const legacy = users.find((u) => u.email === 'admin@engine.local');
  if (legacy) {
    removeLocalRecord('users', legacy.id);
  }

  // Cleanup is deliberately local-only. Startup code must never delete a
  // cloud record before the authenticated Firestore snapshot has hydrated.
  const SUPER_ADMIN_EMAIL = 'admin@buller.com';
  const ghostSuper = users.find(
    (u) => u.email === SUPER_ADMIN_EMAIL && u.id.startsWith('usr_')
  );
  if (ghostSuper) {
    removeLocalRecord('users', ghostSuper.id);
  }

  // Seed local placeholders only. Firestore remains authoritative and its
  // snapshot replaces these values after authentication/hydration.
  const existingContentIds = new Set(readRaw('content').map((block) => block.id));
  defaultContentBlocks().forEach((block) => {
    if (!existingContentIds.has(block.id)) cacheLocalRecord('content', block);
  });

  // Migrate known legacy values in the local cache only. Admin-authored cloud
  // content is never changed by app startup.
  const brandMigrations: Record<string, {legacy: string[];next: string;}> = {
    'landing.hero.eyebrow': {
      legacy: ['Institutional Trading Engine', 'Institutional Trading Engine v4.0'],
      next: 'BULLER TRADING'
    },
    'access.email.template': {
      legacy: [
      "Thank you for requesting access to the Institutional Trading Engine. Your request has been received and is under review by our team. You will receive a response at the email address provided within 24 hours. If approved, you'll receive your engine credentials and onboarding instructions."],

      next: "Thank you for requesting access to BULLER TRADING. Your request has been received and is under review by our team. You will receive a response at the email address provided within 24 hours. If approved, you'll receive your platform credentials and onboarding instructions."
    },
    'site.name': { legacy: ['Trading Engine'], next: 'BULLER TRADING' },
    'brand.name': { legacy: ['TRADING ENGINE'], next: 'BULLER TRADING' },
    'brand.version': { legacy: ['v4.0'], next: '' },
    'brand.initials': { legacy: ['TE'], next: 'BT' },
    'brand.logoUrl': {
      legacy: [''],
      next: "/LOGO_PNG_FINAL.png"
    }
  };
  readRaw('content').forEach((block) => {
    const migration = brandMigrations[block.id];
    if (migration?.legacy.includes(block.value)) {
      cacheLocalRecord('content', {
        ...block,
        value: migration.next,
        updatedAt: Date.now()
      });
    }
  });

  // Populate canonical plans in the local startup cache only. Admin-created
  // cloud plans are authoritative and arrive during Firestore hydration; they
  // are never created, edited, or deleted by this startup routine.
  const now = Date.now();
  const canonicalPlans = toPlanRecords(now);
  const canonicalIds = new Set(canonicalPlans.map((p) => p.id));
  readRaw('plans').forEach((p) => {
    if (!canonicalIds.has(p.id)) removeLocalRecord('plans', p.id);
  });
  const existingPlanIds = new Set(readRaw('plans').map((p) => p.id));
  canonicalPlans.forEach((p) => {
    if (!existingPlanIds.has(p.id)) cacheLocalRecord('plans', p);
  });
}

// ============================================================
// FIRESTORE SYNC LAYER
// ============================================================
// When Firebase is initialized, mirror writes to Firestore and hydrate
// the in-memory localStorage cache from Firestore via real-time listeners.
// All existing sync consumers (db.list/insert/update/useCollection) keep
// working unchanged — they now read from a Firestore-backed cache.

import {
  fsSet as _fsSet,
  fsDelete as _fsDelete,
  fsSubscribe as _fsSubscribe,
  fsList as _fsList,
  fsGet as _fsGet,
  where as _where,
  type QueryConstraint as _QueryConstraint } from
'../backend/docStore';
import { isBackendReady as _isFirebaseReady } from '../backend/ready';
// Canonical membership plans (single source of truth for pricing/validity).
import { toPlanRecords } from '../data/plans';
import { DEFAULT_WALLET_ADDRESSES } from '../platformConfig';

// Collections that should be synced to Firestore. We mirror the ones that
// represent real data; transient UI logs stay local-only to avoid quota.
const SYNCED_COLLECTIONS: Collection[] = [
'users',
'accessRequests',
'notifications',
'masterKeys',
'payments',
'paymentProofs',
'walletAddresses',
'chatThreads',
'chatMessages',
'content',
'plans',
'devices'];


const FIRESTORE_PATHS: Partial<Record<Collection, string>> = {
  users: 'users',
  accessRequests: 'access_requests',
  notifications: 'notifications',
  masterKeys: 'master_keys',
  payments: 'payments',
  paymentProofs: 'payment_proofs',
  walletAddresses: 'wallet_addresses',
  chatThreads: 'chat_threads',
  chatMessages: 'chat_messages',
  content: 'content',
  plans: 'plans',
  devices: 'devices'
};

export type FirestoreSyncStatus = 'idle' | 'connecting' | 'connected' | 'error';
let _syncStarted = false;
let _syncStatus: FirestoreSyncStatus = 'idle';
const _syncStatusListeners = new Set<(status: FirestoreSyncStatus) => void>();
const _syncUnsubs: Array<() => void> = [];
// Track records currently being hydrated from Firestore, so we don't
// echo them back as a mirrored write and loop.
const _hydrating = new Set<string>();

// Collections hydrated by an EXTERNAL primary source (Supabase). When a
// collection is in this set, Firestore hydration is skipped so the
// Supabase-backed cache can't be overwritten by stale Firestore data.
const _externallyHydrated = new Set<Collection>();

/**
 * Hydrate a collection from an external source (e.g. Supabase realtime)
 * WITHOUT re-mirroring the rows back to Firestore or Supabase. Marks the
 * collection as externally owned so Firestore hydration won't clobber it.
 */
export function hydrateExternal<C extends Collection>(
col: C,
rows: Schema[C][])
{
  _externallyHydrated.add(col);
  writeRaw(col, rows);
}

export function isExternallyHydrated(col: Collection): boolean {
  return _externallyHydrated.has(col);
}

function _fsKey(col: Collection, id: string) {
  return col + ':' + id;
}

/** Apply a Firestore-side change to the in-memory cache without re-mirroring. */
function _hydrateFromFirestore<C extends Collection>(
col: C,
rows: Schema[C][])
{
  // Supabase is the primary persistence layer when active — don't let a
  // Firestore snapshot overwrite a Supabase-hydrated collection.
  if (_externallyHydrated.has(col)) return;
  // Mark all incoming rows so writeRaw doesn't echo them back
  rows.forEach((r: any) => _hydrating.add(_fsKey(col, r.id)));
  try {
    writeRaw(col, rows);
  } finally {
    // Clear after the microtask so any synchronous mirror attempt is skipped
    queueMicrotask(() => {
      rows.forEach((r: any) => _hydrating.delete(_fsKey(col, r.id)));
    });
  }
}

/** Mirror a single-record write to Firestore. Fire-and-forget. */
function _mirrorWrite<C extends Collection>(
col: C,
record: Schema[C] | null,
id: string,
op: 'set' | 'delete')
{
  if (!_isFirebaseReady()) return;
  const path = FIRESTORE_PATHS[col];
  if (!path) return;
  if (_hydrating.has(_fsKey(col, id))) return;
  (async () => {
    try {
      if (op === 'delete') {
        await _fsDelete(path, id);
      } else if (record) {
        const { id: _storedId, ...data } = record as Schema[C] & {id: string;};
        await _fsSet(path, { id, ...data } as any, true);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[store] firestore mirror failed', col, id, err);
    }
  })();
}

// Wrap public mutators to mirror writes. We patch the `db` object in place
// so existing imports keep working without touching call sites.
const _origInsert = db.insert.bind(db);
const _origUpsert = db.upsert.bind(db);
const _origUpdate = db.update.bind(db);
const _origRemove = db.remove.bind(db);

/** Update the reactive cache without echoing a backend-owned snapshot. */
export function cacheLocalRecord<C extends Collection>(
col: C,
record: Schema[C])
{
  return _origUpsert(col, record);
}

/** Remove from the browser cache without deleting backend-owned data. */
export function removeLocalRecord<C extends Collection>(col: C, id: string) {
  return _origRemove(col, id);
}

/**
 * Permanently save a record. The local UI is updated only after Firestore
 * confirms the write, so callers never show a false “saved” state.
 */
export async function persistRecord<C extends Collection>(
col: C,
record: Schema[C])
: Promise<Schema[C]> {
  const path = FIRESTORE_PATHS[col];
  if (!_isFirebaseReady() || !path) {
    throw new Error('Cloud storage is unavailable. Nothing was changed.');
  }
  const { id, ...data } = record as Schema[C] & {id: string;};
  await _fsSet(path, { id, ...data } as any, true);
  return _origUpsert(col, record);
}

/** Permanently delete a record, then remove it from the local cache. */
export async function deletePersistentRecord<C extends Collection>(
col: C,
id: string)
: Promise<boolean> {
  const path = FIRESTORE_PATHS[col];
  if (!_isFirebaseReady() || !path) {
    throw new Error('Cloud storage is unavailable. Nothing was changed.');
  }
  await _fsDelete(path, id);
  return _origRemove(col, id);
}

db.insert = function <C extends Collection>(col: C, record: Schema[C]) {
  const r = _origInsert(col, record);
  _mirrorWrite(col, r, (r as any).id, 'set');
  return r;
} as typeof db.insert;

db.upsert = function <C extends Collection>(col: C, record: Schema[C]) {
  const r = _origUpsert(col, record);
  _mirrorWrite(col, r, (r as any).id, 'set');
  return r;
} as typeof db.upsert;

db.update = function <C extends Collection>(
col: C,
id: string,
patch: Partial<Schema[C]>)
{
  const r = _origUpdate(col, id, patch);
  if (r) _mirrorWrite(col, r, id, 'set');
  return r;
} as typeof db.update;

db.remove = function <C extends Collection>(col: C, id: string) {
  const ok = _origRemove(col, id);
  if (ok) _mirrorWrite(col, null, id, 'delete');
  return ok;
} as typeof db.remove;

export interface FirestoreSyncIdentity {
  uid: string;
  email: string;
  role: 'user' | 'admin' | 'super_admin';
}

function constraintsFor(
col: Collection,
identity: FirestoreSyncIdentity)
: _QueryConstraint[] | null {
  const isAdmin = identity.role === 'admin' || identity.role === 'super_admin';
  if (isAdmin) return [];
  switch (col) {
    case 'users':
      // AuthContext maintains the current user's single document; admins
      // receive the full users collection below.
      return null;
    case 'accessRequests':
    case 'masterKeys':
      return [_where('email', '==', identity.email)];
    case 'notifications':
      return [_where('targetEmail', '==', identity.email)];
    case 'paymentProofs':
      return [_where('userId', '==', identity.uid)];
    case 'devices':
    case 'chatThreads':
      return [_where('userEmail', '==', identity.email)];
    case 'chatMessages':
      return [_where('threadId', '==', identity.email)];
    case 'walletAddresses':
    case 'content':
    case 'plans':
      return [];
    case 'payments':
      return null;
  }
}

function setFirestoreSyncStatus(status: FirestoreSyncStatus) {
  _syncStatus = status;
  _syncStatusListeners.forEach((listener) => listener(status));
}

export function getFirestoreSyncStatus() {
  return _syncStatus;
}

export function subscribeFirestoreSyncStatus(
listener: (status: FirestoreSyncStatus) => void)
{
  _syncStatusListeners.add(listener);
  listener(_syncStatus);
  return () => {
    _syncStatusListeners.delete(listener);
  };
}

/** Start role-scoped listeners after Firebase Auth and the user profile resolve. */
export function startFirestoreSync(identity: FirestoreSyncIdentity) {
  if (_syncStarted) return;
  if (!_isFirebaseReady()) {
    setFirestoreSyncStatus('error');
    return;
  }
  _syncStarted = true;
  setFirestoreSyncStatus('connecting');
  let receivedSnapshot = false;
  for (const col of SYNCED_COLLECTIONS) {
    const path = FIRESTORE_PATHS[col];
    const constraints = constraintsFor(col, identity);
    if (!path || constraints === null) continue;

    if (col === 'notifications' && identity.role === 'user') {
      let targeted: Notification[] = [];
      let broadcasts: Notification[] = [];
      const hydrateNotifications = () => {
        const merged = new Map<string, Notification>();
        [...targeted, ...broadcasts].forEach((notification) => merged.set(notification.id, notification));
        _hydrateFromFirestore('notifications', [...merged.values()]);
        if (!receivedSnapshot) {
          receivedSnapshot = true;
          setFirestoreSyncStatus('connected');
        }
      };
      const onError = (err: Error) => {
        setFirestoreSyncStatus('error');
        console.warn('[store] Notification sync failed -', err.message);
      };
      _syncUnsubs.push(
        _fsSubscribe<Notification>(path, (rows) => {targeted = rows;hydrateNotifications();}, [_where('targetEmail', '==', identity.email)], onError),
        _fsSubscribe<Notification>(path, (rows) => {broadcasts = rows;hydrateNotifications();}, [_where('target', '==', 'broadcast')], onError)
      );
      continue;
    }

    const unsub = _fsSubscribe<any>(
      path,
      (rows) => {
        _hydrateFromFirestore(col, rows as any);
        if (!receivedSnapshot) {
          receivedSnapshot = true;
          setFirestoreSyncStatus('connected');
        }
      },
      constraints,
      (err) => {
        setFirestoreSyncStatus('error');
        console.warn('[store] Firestore sync failed for', col, '-', err.message);
      }
    );
    _syncUnsubs.push(unsub);
  }
}

/**
 * Seed canonical data into Firestore for admins without overwriting edits.
 * Local startup defaults are otherwise replaced by empty cloud snapshots.
 */
export async function ensureFirestoreSeed(
identity: FirestoreSyncIdentity)
: Promise<void> {
  const isAdmin = identity.role === 'admin' || identity.role === 'super_admin';
  if (!isAdmin || !_isFirebaseReady()) return;

  const existingIds = async (path: string): Promise<Set<string>> => {
    const rows = await _fsList<{id: string;}>(path, []);
    return new Set(rows.map((row) => row.id));
  };

  const planIds = await existingIds('plans');
  for (const plan of toPlanRecords(Date.now())) {
    if (!planIds.has(plan.id)) await persistRecord('plans', plan);
  }

  const contentIds = await existingIds('content');
  for (const block of defaultContentBlocks()) {
    if (!contentIds.has(block.id)) await persistRecord('content', block);
  }

  const walletIds = await existingIds('wallet_addresses');
  const walletSeedState = await _fsGet<ContentBlock>('content', 'system.wallet.deletedDefaults');
  let deletedDefaultIds = new Set<string>();
  try {
    const parsed = JSON.parse(walletSeedState?.value || '[]');
    if (Array.isArray(parsed)) deletedDefaultIds = new Set(parsed.filter((id): id is string => typeof id === 'string'));
  } catch {}
  for (const wallet of DEFAULT_WALLET_ADDRESSES) {
    if (!walletIds.has(wallet.id) && !deletedDefaultIds.has(wallet.id)) {
      await persistRecord('walletAddresses', wallet);
    }
  }
}

/** Stop all listeners (e.g. for tests / HMR). */
export function stopFirestoreSync() {
  _syncUnsubs.splice(0).forEach((u) => {
    try {
      u();
    } catch {}
  });
  _syncStarted = false;
  setFirestoreSyncStatus('idle');
}

/** Remove private records left by a previous signed-in identity. */
export function clearLocalSessionCache() {
  const privateCollections: Collection[] = [
  'users',
  'accessRequests',
  'notifications',
  'masterKeys',
  'payments',
  'paymentProofs',
  'devices',
  'chatThreads',
  'chatMessages',
  'logs'];

  privateCollections.forEach((collection) => writeRaw(collection, [] as any));
}

export function isFirestoreSyncActive(): boolean {
  return _syncStarted;
}