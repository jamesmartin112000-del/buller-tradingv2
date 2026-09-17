/**
 * Supabase helpers — typed database operations for the Trading Engine.
 *
 * CLIENT-SIDE VERSION: every call uses the shared anon-key client, so all
 * access control is enforced by Row Level Security policies in Supabase
 * (see docs/supabase-setup.md). The original server-only `supabaseAdmin`
 * calls have been mapped to the same client — RLS decides what's allowed.
 *
 * Tables: users, devices, device_requests, signals, news, ban_history
 * (created by the SQL migration in docs/supabase-setup.md).
 */
import { supabase, supabaseAdmin, SUPABASE_ANON_KEY } from './supabaseClient';

// ============================================
// USERS
// ============================================
export const userHelpers = {
  async getById(userId: string) {
    const { data, error } = await supabase.
    from('users').
    select('*').
    eq('id', userId).
    maybeSingle();
    if (error) throw error;
    return data;
  },

  async getByEmail(email: string) {
    const { data, error } = await supabase.
    from('users').
    select('*').
    eq('email', email).
    maybeSingle();
    if (error) throw error;
    return data;
  },

  async create(userData: any) {
    const { data, error } = await supabaseAdmin.
    from('users').
    insert([
    {
      id: userData.id,
      email: userData.email,
      name: userData.name || '',
      photo_url: userData.photoURL || null,
      is_admin: userData.isAdmin || false,
      is_banned: false,
      max_devices: 3,
      plan: 'free',
      total_devices: 0
    }]
    ).
    select().
    single();
    if (error) throw error;
    return data;
  },

  async update(userId: string, updates: Record<string, any>) {
    const { data, error } = await supabaseAdmin.
    from('users').
    update({ ...updates, updated_at: new Date().toISOString() }).
    eq('id', userId).
    select().
    single();
    if (error) throw error;
    return data;
  },

  async checkBanned(email: string) {
    const { data, error } = await supabase.
    from('users').
    select('id, is_banned, ban_reason, banned_at').
    eq('email', email).
    maybeSingle();
    if (error || !data) return { banned: false };
    return {
      banned: data.is_banned,
      banReason: data.ban_reason,
      bannedAt: data.banned_at,
      userId: data.id
    };
  },

  async checkBannedById(userId: string) {
    const { data, error } = await supabase.
    from('users').
    select('id, is_banned, ban_reason, banned_at').
    eq('id', userId).
    maybeSingle();
    if (error || !data) return { banned: false };
    return {
      banned: data.is_banned,
      banReason: data.ban_reason,
      bannedAt: data.banned_at,
      userId: data.id
    };
  },

  async getAllAdmins() {
    const { data, error } = await supabaseAdmin.
    from('users').
    select('*').
    eq('is_admin', true);
    if (error) throw error;
    return data || [];
  }
};

// ============================================
// DEVICES
// ============================================
export const deviceHelpers = {
  async findByUserAndFingerprint(userId: string, fingerprint: string) {
    const { data, error } = await supabase.
    from('devices').
    select('*').
    eq('user_id', userId).
    eq('fingerprint', fingerprint).
    maybeSingle();
    if (error) throw error;
    return data;
  },

  async findByFingerprint(fingerprint: string) {
    const { data, error } = await supabase.
    from('devices').
    select('*').
    eq('fingerprint', fingerprint).
    maybeSingle();
    if (error) throw error;
    return data;
  },

  async getUserDevices(userId: string) {
    const { data, error } = await supabase.
    from('devices').
    select('*').
    eq('user_id', userId).
    order('last_seen', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getUserApprovedDevices(userId: string) {
    const { data, error } = await supabase.
    from('devices').
    select('*').
    eq('user_id', userId).
    eq('is_approved', true).
    order('last_seen', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getDeviceCount(userId: string) {
    const { count, error } = await supabase.
    from('devices').
    select('*', { count: 'exact', head: true }).
    eq('user_id', userId).
    eq('is_approved', true);
    if (error) throw error;
    return count || 0;
  },

  async create(deviceData: any) {
    const { data, error } = await supabaseAdmin.
    from('devices').
    insert([
    {
      user_id: deviceData.userId,
      fingerprint: deviceData.fingerprint,
      device_name: deviceData.deviceName || 'Unknown Device',
      browser: deviceData.browser || '',
      os: deviceData.os || '',
      ip_address: deviceData.ipAddress || '',
      last_seen: new Date().toISOString(),
      is_approved: deviceData.isApproved ?? true,
      is_current_device: deviceData.isCurrentDevice ?? true,
      first_registered: new Date().toISOString()
    }]
    ).
    select().
    single();
    if (error) throw error;
    return data;
  },

  async updateLastSeen(deviceId: string) {
    const { error } = await supabaseAdmin.
    from('devices').
    update({ last_seen: new Date().toISOString() }).
    eq('id', deviceId);
    if (error) throw error;
  },

  async revoke(deviceId: string) {
    const { error } = await supabaseAdmin.
    from('devices').
    delete().
    eq('id', deviceId);
    if (error) throw error;
  },

  async getDeviceLocation(
  ipAddress: string)
  : Promise<{city: string;country: string;} | null> {
    try {
      const res = await fetch(`https://ip-api.com/json/${ipAddress}`);
      const data = await res.json();
      if (data.status === 'success') {
        return { city: data.city, country: data.country };
      }
    } catch {

      // Silent fail
    }return null;
  }
};

// ============================================
// DEVICE REQUESTS
// ============================================
export const deviceRequestHelpers = {
  async findPending(userId: string, fingerprint: string) {
    const { data, error } = await supabase.
    from('device_requests').
    select('*').
    eq('user_id', userId).
    eq('new_device_fingerprint', fingerprint).
    eq('status', 'pending').
    maybeSingle();
    if (error) throw error;
    return data;
  },

  async findApprovedUnused(userId: string, fingerprint: string) {
    const now = new Date().toISOString();
    const { data, error } = await supabase.
    from('device_requests').
    select('*').
    eq('user_id', userId).
    eq('new_device_fingerprint', fingerprint).
    eq('status', 'approved').
    eq('auto_login_used', false).
    gt('auto_login_token_expires', now).
    maybeSingle();
    if (error) throw error;
    return data;
  },

  async findPendingByFingerprint(fingerprint: string) {
    const { data, error } = await supabase.
    from('device_requests').
    select('*').
    eq('new_device_fingerprint', fingerprint).
    eq('status', 'pending').
    maybeSingle();
    if (error) throw error;
    return data;
  },

  async create(requestData: any) {
    const { data, error } = await supabaseAdmin.
    from('device_requests').
    insert([
    {
      user_id: requestData.userId,
      user_email: requestData.userEmail,
      user_name: requestData.userName || '',
      new_device_fingerprint: requestData.newDeviceFingerprint,
      new_device_name: requestData.newDeviceName || '',
      new_device_browser: requestData.newDeviceBrowser || '',
      new_device_os: requestData.newDeviceOS || '',
      new_device_ip: requestData.newDeviceIP || '',
      old_device_fingerprint: requestData.oldDeviceFingerprint || '',
      old_device_name: requestData.oldDeviceName || '',
      reason: requestData.reason,
      status: 'pending',
      auto_login_used: false
    }]
    ).
    select().
    single();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Record<string, any>) {
    const { data, error } = await supabaseAdmin.
    from('device_requests').
    update({ ...updates, updated_at: new Date().toISOString() }).
    eq('id', id).
    select().
    single();
    if (error) throw error;
    return data;
  },

  async listAll(filters?: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { status, search, page = 1, limit = 20 } = filters || {};
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabaseAdmin.
    from('device_requests').
    select('*', { count: 'exact' });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(
        `user_email.ilike.%${search}%,user_name.ilike.%${search}%,new_device_name.ilike.%${search}%`
      );
    }

    query = query.order('created_at', { ascending: false }).range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;
    return { requests: data || [], total: count || 0, page, limit };
  },

  async getCounts() {
    const [pending, approved, rejected] = await Promise.all([
    supabaseAdmin.
    from('device_requests').
    select('*', { count: 'exact', head: true }).
    eq('status', 'pending'),
    supabaseAdmin.
    from('device_requests').
    select('*', { count: 'exact', head: true }).
    eq('status', 'approved'),
    supabaseAdmin.
    from('device_requests').
    select('*', { count: 'exact', head: true }).
    eq('status', 'rejected')]
    );
    return {
      pending: pending.count || 0,
      approved: approved.count || 0,
      rejected: rejected.count || 0
    };
  }
};

// ============================================
// SIGNALS
// ============================================
export const signalHelpers = {
  async getLatest(symbol: string, limit = 20) {
    const { data, error } = await supabase.
    from('signals').
    select('*').
    eq('symbol', symbol).
    order('created_at', { ascending: false }).
    limit(limit);
    if (error) throw error;
    return data || [];
  },

  async getSignalsByTimeframe(symbol: string, timeframe: string, limit = 10) {
    const { data, error } = await supabase.
    from('signals').
    select('*').
    eq('symbol', symbol).
    eq('timeframe', timeframe).
    order('created_at', { ascending: false }).
    limit(limit);
    if (error) throw error;
    return data || [];
  },

  async create(signalData: any) {
    const { data, error } = await supabaseAdmin.
    from('signals').
    insert([
    {
      symbol: signalData.symbol,
      direction: signalData.direction,
      entry_price: signalData.entryPrice,
      stop_loss: signalData.stopLoss,
      take_profit: signalData.takeProfit,
      take_profit2: signalData.takeProfit2,
      confidence: signalData.confidence,
      strategy_count: signalData.strategyCount,
      total_strategies: signalData.totalStrategies,
      strategies_used: signalData.strategiesUsed,
      confirmation_signals: signalData.confirmationSignals,
      strength: signalData.strength,
      risk_reward: signalData.riskReward,
      timeframe: signalData.timeframe || '1h'
    }]
    ).
    select().
    single();
    if (error) throw error;
    return data;
  },

  async getLatestSignal(symbol: string) {
    const { data, error } = await supabase.
    from('signals').
    select('*').
    eq('symbol', symbol).
    order('created_at', { ascending: false }).
    limit(1).
    maybeSingle();
    if (error) throw error;
    return data;
  },

  subscribeToNew(symbol: string, callback: (signal: any) => void) {
    return supabase.
    channel(`signals-${symbol}`).
    on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'signals',
        filter: `symbol=eq.${symbol}`
      },
      (payload) => callback(payload.new)
    ).
    subscribe();
  }
};

// ============================================
// NEWS
// ============================================
export const newsHelpers = {
  async getAll(filters?: {type?: string;coin?: string;limit?: number;}) {
    const { type, coin, limit = 30 } = filters || {};

    let query = supabase.
    from('news').
    select('*').
    order('timestamp', { ascending: false }).
    limit(limit);

    if (type === 'breaking') {
      query = query.eq('category', 'breaking').eq('impact', 'high');
    } else if (type === 'hidden') {
      query = query.eq('is_hidden', true);
    }

    if (coin && coin !== 'all') {
      query = query.contains('coins', [coin]);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async create(newsItem: any) {
    const { data, error } = await supabaseAdmin.
    from('news').
    upsert(
      [
      {
        id: newsItem.id,
        title: newsItem.title,
        description: newsItem.description || '',
        content: newsItem.content || '',
        source: newsItem.source,
        source_type: newsItem.sourceType,
        category: newsItem.category,
        url: newsItem.url || '',
        image_url: newsItem.imageUrl || null,
        published_at: newsItem.publishedAt,
        timestamp: newsItem.timestamp || Date.now(),
        coins: newsItem.coins || [],
        sentiment: newsItem.sentiment || 'neutral',
        impact: newsItem.impact || 'medium',
        is_hidden: newsItem.isHidden || false,
        is_verified: newsItem.isVerified ?? true
      }],

      { onConflict: 'id' }
    ).
    select().
    single();
    if (error) throw error;
    return data;
  },

  async batchCreate(newsItems: any[]) {
    const { data, error } = await supabaseAdmin.from('news').upsert(
      newsItems.map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description || '',
        content: item.content || '',
        source: item.source,
        source_type: item.sourceType,
        category: item.category,
        url: item.url || '',
        image_url: item.imageUrl || null,
        published_at: item.publishedAt,
        timestamp: item.timestamp || Date.now(),
        coins: item.coins || [],
        sentiment: item.sentiment || 'neutral',
        impact: item.impact || 'medium',
        is_hidden: item.isHidden || false,
        is_verified: item.isVerified ?? true
      })),
      { onConflict: 'id' }
    );
    if (error) throw error;
    return data;
  },

  subscribeToNews(callback: (news: any) => void) {
    return supabase.
    channel('news-live').
    on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'news'
      },
      (payload) => callback(payload.new)
    ).
    subscribe();
  }
};

// ============================================
// PAYMENTS
// ============================================
const PLAN_AMOUNTS: Record<string, number> = {
  starter: 29,
  pro: 99,
  elite: 499
};

export const paymentHelpers = {
  async create(
  userId: string,
  email: string,
  planType: string,
  whatsapp: string)
  {
    const { data, error } = await supabase.
    from('payments').
    insert([
    {
      user_id: userId,
      user_email: email.toLowerCase(),
      plan_type: planType,
      amount: PLAN_AMOUNTS[planType] || 29,
      status: 'pending',
      whatsapp_number: whatsapp
    }]
    ).
    select().
    single();
    if (error) throw error;
    return data;
  },

  async listAll(status?: string) {
    let query = supabase.
    from('payments').
    select('*').
    order('created_at', { ascending: false });
    if (status && status !== 'all') query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getByUser(userId: string) {
    const { data, error } = await supabase.
    from('payments').
    select('*').
    eq('user_id', userId).
    order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }
};

// ============================================
// GATE KEYS
// ============================================
const KEY_DURATION_DAYS: Record<string, number> = {
  starter: 7,
  pro: 30,
  elite: 365
};

export const gateKeyHelpers = {
  generateKey(planType: string, email: string): string {
    const prefix =
    planType === 'starter' ? 'STR' : planType === 'pro' ? 'PRO' : 'ELT';
    const rand1 = Math.random().toString(36).substring(2, 8).toUpperCase();
    const rand2 = Math.random().toString(36).substring(2, 8).toUpperCase();
    const hash = btoa(email + rand1).
    replace(/[^a-zA-Z0-9]/g, '').
    substring(0, 6).
    toUpperCase();
    return `${prefix}-${rand1}-${rand2}-${hash}`;
  },

  async getByKey(keyValue: string) {
    const { data, error } = await supabase.
    from('gate_keys').
    select('*').
    eq('key_value', keyValue.trim()).
    maybeSingle();
    if (error) throw error;
    return data;
  },

  async getByUser(userId: string) {
    const { data, error } = await supabase.
    from('gate_keys').
    select('*').
    eq('user_id', userId).
    order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async markUsed(id: string, fingerprint: string) {
    const { data, error } = await supabaseAdmin.
    from('gate_keys').
    update({
      status: 'used',
      used_at: new Date().toISOString(),
      device_fingerprint: fingerprint
    }).
    eq('id', id).
    select().
    single();
    if (error) throw error;
    return data;
  },

  async listAll(status?: string) {
    let query = supabase.
    from('gate_keys').
    select('*').
    order('created_at', { ascending: false });
    if (status && status !== 'all') query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async revoke(id: string) {
    const { data, error } = await supabaseAdmin.
    from('gate_keys').
    update({ status: 'revoked' }).
    eq('id', id).
    select().
    single();
    if (error) throw error;
    return data;
  },

  durationFor(planType: string) {
    return KEY_DURATION_DAYS[planType] || 30;
  }
};

// ============================================
// DEVICE CHANGE REQUESTS (emergency device swap)
// ============================================
export const deviceChangeHelpers = {
  async create(
  userId: string,
  email: string,
  payload: {
    oldFingerprint: string;
    oldDeviceName?: string;
    newFingerprint: string;
    newDeviceName?: string;
    newBrowser?: string;
    newOs?: string;
    reason: string;
  })
  {
    const { data, error } = await supabase.
    from('device_change_requests').
    insert([
    {
      user_id: userId,
      user_email: email.toLowerCase(),
      old_device_fingerprint: payload.oldFingerprint,
      old_device_name: payload.oldDeviceName || 'Unknown',
      new_device_fingerprint: payload.newFingerprint,
      new_device_name: payload.newDeviceName || 'Unknown',
      new_device_browser: payload.newBrowser || '',
      new_device_os: payload.newOs || '',
      reason: payload.reason,
      status: 'pending'
    }]
    ).
    select().
    single();
    if (error) throw error;
    return data;
  },

  async getByUser(userId: string) {
    const { data, error } = await supabase.
    from('device_change_requests').
    select('*').
    eq('user_id', userId).
    order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async listAll(status?: string) {
    let query = supabase.
    from('device_change_requests').
    select('*').
    order('created_at', { ascending: false });
    if (status && status !== 'all') query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async findByToken(token: string) {
    const { data, error } = await supabase.
    from('device_change_requests').
    select('*').
    eq('auto_login_token', token).
    eq('status', 'approved').
    maybeSingle();
    if (error) throw error;
    return data;
  }
};

// ============================================
// ADMIN DASHBOARD STATS
// ============================================
export const adminStatsHelpers = {
  async getStats() {
    const [
    totalUsers,
    bannedUsers,
    totalDevices,
    pendingPayments,
    pendingDeviceChanges,
    activeKeys] =
    await Promise.all([
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase.
    from('users').
    select('*', { count: 'exact', head: true }).
    eq('is_banned', true),
    supabase.from('devices').select('*', { count: 'exact', head: true }),
    supabase.
    from('payments').
    select('*', { count: 'exact', head: true }).
    eq('status', 'pending'),
    supabase.
    from('device_change_requests').
    select('*', { count: 'exact', head: true }).
    eq('status', 'pending'),
    supabase.
    from('gate_keys').
    select('*', { count: 'exact', head: true }).
    eq('status', 'active')]
    );
    const total = totalUsers.count || 0;
    const banned = bannedUsers.count || 0;
    return {
      totalUsers: total,
      activeUsers: total - banned,
      bannedUsers: banned,
      totalDevices: totalDevices.count || 0,
      pendingPayments: pendingPayments.count || 0,
      pendingDeviceChanges: pendingDeviceChanges.count || 0,
      activeKeys: activeKeys.count || 0
    };
  }
};

// ============================================
// ADMIN EDGE FUNCTION CALLER
// ============================================
// Privileged operations (verify payment, generate gate key, approve device
// change, ban/unban) MUST run server-side with the service-role key. They are
// implemented in the Supabase Edge Function `admin-operations` — NEVER inline
// the service-role key in this browser bundle. This caller forwards the signed
// admin's access token so the function can authorize the request.
import { SUPABASE_URL } from './supabaseClient';

const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/admin-operations`;

export async function callAdminFunction(action: string, payload: any) {
  const {
    data: { session }
  } = await supabase.auth.getSession();
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token || SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify({ action, data: payload })
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.error) {
    throw new Error(json?.error || `Admin operation failed (${res.status})`);
  }
  return json;
}

// ============================================
// BAN HISTORY
// ============================================
export const banHelpers = {
  async log(banRecord: any) {
    const { error } = await supabaseAdmin.from('ban_history').insert([
    {
      user_id: banRecord.userId,
      admin_id: banRecord.adminId,
      action: banRecord.action,
      reason: banRecord.reason || '',
      duration: banRecord.duration || 'permanent',
      device_request_id: banRecord.deviceRequestId || null
    }]
    );
    if (error) throw error;
  },

  async getUserHistory(userId: string) {
    const { data, error } = await supabase.
    from('ban_history').
    select('*').
    eq('user_id', userId).
    order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }
};