/**
 * Supabase has been REMOVED from this project (migrated to Convex — see
 * convex/ and index.tsx's ConvexProvider). The real `@supabase/supabase-js`
 * SDK is no longer imported or bundled.
 *
 * This module remains only as a graceful-degradation shim so the dozen-odd
 * legacy call sites that still import `supabase` / `supabaseHelpers` keep
 * compiling and simply no-op. Every one of those call sites already guards on
 * `isSupabaseReady()`, which now permanently returns false — so they fall back
 * to their localStorage / Convex paths instead of hitting Supabase.
 */

export const SUPABASE_URL = '';
export const SUPABASE_ANON_KEY = '';

const REMOVED_ERROR = new Error(
  'Supabase has been removed from this project (migrated to Convex).'
);

/** Awaitable, infinitely-chainable no-op used for every query-builder call. */
function makeChain(): any {
  const result = { data: null, error: REMOVED_ERROR, count: 0, status: 0 };
  const handler: ProxyHandler<any> = {
    get(_target, prop) {
      if (prop === 'then') {
        // Make the chain awaitable → resolves to a Supabase-shaped result.
        return (resolve: (v: any) => any) => resolve(result);
      }
      if (prop === 'subscribe') {
        return (cb?: (status: string) => void) => {
          try {
            cb?.('CLOSED');
          } catch {}
          return chain;
        };
      }
      // Any other property access returns a function that returns the chain,
      // supporting `.from().select().eq().order()…` style fluent calls.
      return () => chain;
    }
  };
  const chain: any = new Proxy(function () {}, handler);
  return chain;
}

const auth = {
  async getSession() {
    return { data: { session: null }, error: null };
  },
  async signOut() {
    return { error: null };
  },
  async signInWithPassword() {
    return { data: { user: null, session: null }, error: REMOVED_ERROR };
  },
  async signUp() {
    return { data: { user: null, session: null }, error: REMOVED_ERROR };
  },
  async resetPasswordForEmail() {
    return { data: {}, error: REMOVED_ERROR };
  },
  onAuthStateChange() {
    return { data: { subscription: { unsubscribe() {} } } };
  }
};

const stubClient: any = {
  auth,
  from() {
    return makeChain();
  },
  channel() {
    return makeChain();
  },
  removeChannel() {},
  rpc() {
    return makeChain();
  }
};

/** The (removed) Supabase client — now a graceful no-op stub. */
export const supabase = stubClient;

/** Back-compat alias — same no-op stub. */
export const supabaseAdmin = stubClient;

/** Always false now that Supabase is removed. */
export function isSupabaseReady(): boolean {
  return false;
}

export function getSupabaseInitError(): Error | null {
  return REMOVED_ERROR;
}