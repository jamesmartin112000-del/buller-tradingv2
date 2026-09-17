/**
 * Audit logging utility — SUPABASE VERSION. Fire-and-forget audit trail.
 *
 * Writes to the `app_documents` store under the `audit_logs` collection so
 * security events, admin actions, and client errors are persisted
 * server-side and queryable by admins. Falls back to console only when
 * Supabase isn't ready.
 *
 * Never throws. Never blocks the caller. Safe to await or not.
 */
import { supabase, isSupabaseReady } from '../supabaseClient';

export type AuditSeverity = 'info' | 'warn' | 'error' | 'security';

export interface AuditEntry {
  severity: AuditSeverity;
  category: string;
  message: string;
  meta?: Record<string, any>;
}

/**
 * Record an audit event. Returns a promise that resolves once the write
 * is queued — callers can `void auditLog(...)` to fire-and-forget.
 */
export async function auditLog(
severity: AuditSeverity,
category: string,
message: string,
meta: Record<string, any> = {})
: Promise<void> {
  // Always log to console for local debugging
  const tag = `[audit:${severity}:${category}]`;
  // eslint-disable-next-line no-console
  const logger =
  severity === 'error' || severity === 'security' ?
  console.error :
  severity === 'warn' ?
  console.warn :
  console.info;
  logger(tag, message, meta);

  if (!isSupabaseReady()) return;
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user || null;
    const id = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await supabase.from('app_documents').insert({
      collection: 'audit_logs',
      id,
      data: {
        severity,
        category,
        message: String(message).slice(0, 1000),
        meta: safeMeta(meta),
        uid: user?.id || null,
        email: user?.email || null,
        userAgent:
        typeof navigator !== 'undefined' ?
        navigator.userAgent.slice(0, 300) :
        null,
        url:
        typeof location !== 'undefined' ? location.href.slice(0, 500) : null,
        createdAtMs: Date.now()
      },
      updated_at: new Date().toISOString()
    });
  } catch (err) {
    // Never throw from audit logging
    // eslint-disable-next-line no-console
    console.warn('[audit] write failed', err);
  }
}

/** Strip non-serializable values + cap size so a giant meta payload never bricks the write. */
function safeMeta(meta: Record<string, any>): Record<string, any> {
  try {
    const json = JSON.stringify(meta, (_k, v) => {
      if (v instanceof Error)
      return {
        name: v.name,
        message: v.message,
        stack: v.stack?.slice(0, 2000)
      };
      if (typeof v === 'function') return undefined;
      if (typeof v === 'bigint') return v.toString();
      return v;
    });
    if (json.length > 8000)
    return { _truncated: true, preview: json.slice(0, 8000) };
    return JSON.parse(json);
  } catch {
    return { _unserializable: true };
  }
}