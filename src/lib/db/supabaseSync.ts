/**
 * Supabase sync layer for the LocalDB (lib/db/store.ts).
 *
 * Persistence model:
 *   • Every admin collection (users, accessRequests, payments, plans,
 *     masterKeys, devices, chat, content, notifications, logs) is stored
 *     in ONE generic JSONB table: public.app_records
 *     — see supabase/migrations/002_admin_collections.sql.
 *   • Writes made through db.insert/upsert/update/remove are mirrored to
 *     Supabase (fire-and-forget, console.warn on failure).
 *   • On boot, startSupabaseSync() fetches all rows and hydrates the local
 *     cache, then a realtime channel keeps it live across tabs/browsers.
 *   • First run: if Supabase is empty for a collection but local data
 *     exists, the local rows are pushed UP (automatic migration of
 *     existing localStorage data).
 *
 * Graceful degradation: if Supabase is unreachable, the app keeps working
 * on localStorage exactly as before — the status reports 'error'.
 */
import { supabase, isSupabaseReady } from '../supabaseClient';
import { db, hydrateExternal, type Collection } from './store';

const TABLE = 'app_records';

/** Every collection the admin panel uses is synced. */
const SYNCED: Collection[] = [
'users',
'accessRequests',
'chatMessages',
'chatThreads',
'notifications',
'content',
'logs',
'payments',
'devices',
'masterKeys',
'plans'];


// ---------- Sync status (consumed by the Admin Overview indicator) ----------

export type SupabaseSyncStatus = 'idle' | 'connecting' | 'connected' | 'error';

let _status: SupabaseSyncStatus = 'idle';
const _statusListeners = new Set<(s: SupabaseSyncStatus) => void>();

function setStatus(s: SupabaseSyncStatus) {
  _status = s;
  _statusListeners.forEach((fn) => {
    try {
      fn(s);
    } catch {}
  });
}

export function getSupabaseSyncStatus(): SupabaseSyncStatus {
  return _status;
}

export function subscribeSupabaseSyncStatus(
fn: (s: SupabaseSyncStatus) => void)
: () => void {
  _statusListeners.add(fn);
  return () => _statusListeners.delete(fn);
}

// ---------- Outbound mirror (db.* → Supabase) ----------

let _started = false;

function mirrorSet(col: Collection, record: any) {
  if (!_started || !isSupabaseReady()) return;
  (async () => {
    try {
      const { error } = await supabase.from(TABLE).upsert(
        {
          collection: col,
          id: String(record.id),
          data: record
        },
        { onConflict: 'collection,id' }
      );
      if (error) throw error;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[supabase-sync] write failed', col, record?.id, err);
      setStatus('error');
    }
  })();
}

function mirrorDelete(col: Collection, id: string) {
  if (!_started || !isSupabaseReady()) return;
  (async () => {
    try {
      const { error } = await supabase.
      from(TABLE).
      delete().
      eq('collection', col).
      eq('id', id);
      if (error) throw error;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[supabase-sync] delete failed', col, id, err);
      setStatus('error');
    }
  })();
}

// Patch the shared db object IN PLACE (same pattern as the Firestore
// mirror in store.ts) so every existing call site persists to Supabase
// without any changes.
const _origInsert = db.insert.bind(db);
const _origUpsert = db.upsert.bind(db);
const _origUpdate = db.update.bind(db);
const _origRemove = db.remove.bind(db);

db.insert = function (col: any, record: any) {
  const r = _origInsert(col, record);
  if (SYNCED.includes(col)) mirrorSet(col, r);
  return r;
} as typeof db.insert;

db.upsert = function (col: any, record: any) {
  const r = _origUpsert(col, record);
  if (SYNCED.includes(col)) mirrorSet(col, r);
  return r;
} as typeof db.upsert;

db.update = function (col: any, id: string, patch: any) {
  const r = _origUpdate(col, id, patch);
  if (r && SYNCED.includes(col)) mirrorSet(col, r);
  return r;
} as typeof db.update;

db.remove = function (col: any, id: string) {
  const ok = _origRemove(col, id);
  if (ok && SYNCED.includes(col)) mirrorDelete(col, id);
  return ok;
} as typeof db.remove;

// ---------- Inbound hydration (Supabase → local cache) ----------

function applyRealtimeChange(payload: any) {
  const eventType = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE';
  const row = eventType === 'DELETE' ? payload.old : payload.new;
  const col = row?.collection as Collection | undefined;
  if (!col || !SYNCED.includes(col)) return;

  const current = db.list(col) as any[];

  if (eventType === 'DELETE') {
    const id = String(row.id);
    hydrateExternal(col, current.filter((r) => String(r.id) !== id) as any);
    return;
  }

  const record = payload.new?.data;
  if (!record || record.id == null) return;
  const idx = current.findIndex((r) => String(r.id) === String(record.id));
  const next = [...current];
  if (idx >= 0) next[idx] = record;else
  next.unshift(record);
  hydrateExternal(col, next as any);
}

/**
 * Start Supabase sync ONCE (call from App.tsx alongside startFirestoreSync).
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export async function startSupabaseSync() {
  if (_started) return;
  if (!isSupabaseReady()) {
    // eslint-disable-next-line no-console
    console.info('[supabase-sync] client not ready — localStorage-only mode');
    setStatus('error');
    return;
  }
  _started = true;
  setStatus('connecting');

  // 1. Initial fetch + hydrate (or first-run push-up of local data)
  try {
    const { data, error } = await supabase.
    from(TABLE).
    select('collection,id,data').
    limit(5000);
    if (error) throw error;

    const byCol = new Map<Collection, any[]>();
    for (const row of data || []) {
      const col = row.collection as Collection;
      if (!SYNCED.includes(col)) continue;
      const rec = row.data;
      if (!rec || rec.id == null) continue;
      if (!byCol.has(col)) byCol.set(col, []);
      byCol.get(col)!.push(rec);
    }

    const pushUp: {collection: string;id: string;data: any;}[] = [];
    for (const col of SYNCED) {
      const remote = byCol.get(col);
      if (remote && remote.length > 0) {
        // Supabase is the source of truth — hydrate local cache.
        remote.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
        hydrateExternal(col, remote as any);
      } else {
        // First run: migrate any existing local rows up to Supabase.
        const local = db.list(col) as any[];
        for (const rec of local) {
          if (rec?.id == null) continue;
          pushUp.push({ collection: col, id: String(rec.id), data: rec });
        }
      }
    }
    if (pushUp.length > 0) {
      const { error: upErr } = await supabase.
      from(TABLE).
      upsert(pushUp, { onConflict: 'collection,id' });
      if (upErr) {
        // eslint-disable-next-line no-console
        console.warn('[supabase-sync] initial push-up failed', upErr);
      }
    }
    setStatus('connected');
    // eslint-disable-next-line no-console
    console.info(
      '[supabase-sync] hydrated',
      byCol.size,
      'collections; pushed up',
      pushUp.length,
      'local rows'
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      '[supabase-sync] initial fetch failed — run migration 002 in the Supabase SQL editor (see docs/supabase-setup.md)',
      err
    );
    setStatus('error');
  }

  // 2. Realtime — keep the cache live across tabs/browsers.
  try {
    supabase.
    channel('app-records-sync').
    on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE },
      (payload) => {
        try {
          applyRealtimeChange(payload);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('[supabase-sync] realtime apply failed', err);
        }
      }
    ).
    subscribe((status) => {
      if (status === 'SUBSCRIBED' && _status !== 'error') {
        setStatus('connected');
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        // eslint-disable-next-line no-console
        console.warn('[supabase-sync] realtime channel:', status);
      }
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[supabase-sync] realtime subscribe failed', err);
  }
}