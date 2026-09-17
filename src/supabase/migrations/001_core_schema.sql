
-- ============================================================================
-- TRADING ENGINE — CORE SCHEMA MIGRATION (001)
-- Run this ONCE in: supabase.com → your project → SQL Editor → New Query → Run
-- Project: kwziwevtmwcpiiuhgtbm
-- Idempotent: safe to re-run (IF NOT EXISTS / OR REPLACE / drop-then-create).
-- ============================================================================

-- ============================================================================
-- 1. TABLES
-- ============================================================================

-- ---------- users (mirrors auth.users, app profile + admin/ban flags) ----------
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT DEFAULT '',
  photo_url TEXT,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  is_banned BOOLEAN NOT NULL DEFAULT false,
  ban_reason TEXT,
  banned_at TIMESTAMPTZ,
  max_devices INTEGER NOT NULL DEFAULT 3,
  plan TEXT NOT NULL DEFAULT 'free',
  plan_expires_at TIMESTAMPTZ,
  total_devices INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- devices (registered/approved devices per user) ----------
CREATE TABLE IF NOT EXISTS public.devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL,
  device_name TEXT DEFAULT 'Unknown Device',
  browser TEXT DEFAULT '',
  os TEXT DEFAULT '',
  ip_address TEXT DEFAULT '',
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_approved BOOLEAN NOT NULL DEFAULT true,
  is_current_device BOOLEAN NOT NULL DEFAULT true,
  first_registered TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, fingerprint)
);

-- ---------- device_requests (new-device approval workflow) ----------
CREATE TABLE IF NOT EXISTS public.device_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  user_name TEXT DEFAULT '',
  new_device_fingerprint TEXT NOT NULL,
  new_device_name TEXT DEFAULT '',
  new_device_browser TEXT DEFAULT '',
  new_device_os TEXT DEFAULT '',
  new_device_ip TEXT DEFAULT '',
  old_device_fingerprint TEXT DEFAULT '',
  old_device_name TEXT DEFAULT '',
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  auto_login_used BOOLEAN NOT NULL DEFAULT false,
  auto_login_token_expires TIMESTAMPTZ,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- signals (engine-generated trade signals) ----------
CREATE TABLE IF NOT EXISTS public.signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('BUY', 'SELL', 'NEUTRAL')),
  entry_price NUMERIC,
  stop_loss NUMERIC,
  take_profit NUMERIC,
  take_profit2 NUMERIC,
  confidence NUMERIC DEFAULT 0,
  strategy_count INTEGER DEFAULT 0,
  total_strategies INTEGER DEFAULT 0,
  strategies_used JSONB DEFAULT '[]',
  confirmation_signals JSONB DEFAULT '[]',
  strength NUMERIC DEFAULT 0,
  risk_reward NUMERIC,
  timeframe TEXT NOT NULL DEFAULT '1h',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- news (aggregated market news; TEXT id for source-side dedupe) ----------
CREATE TABLE IF NOT EXISTS public.news (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  content TEXT DEFAULT '',
  source TEXT NOT NULL,
  source_type TEXT DEFAULT '',
  category TEXT DEFAULT 'general',
  url TEXT DEFAULT '',
  image_url TEXT,
  published_at TEXT,
  timestamp BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  coins TEXT[] NOT NULL DEFAULT '{}',
  sentiment TEXT NOT NULL DEFAULT 'neutral',
  impact TEXT NOT NULL DEFAULT 'medium',
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  is_verified BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- ban_history (audit trail of ban/unban actions) ----------
CREATE TABLE IF NOT EXISTS public.ban_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  admin_id UUID,
  action TEXT NOT NULL CHECK (action IN ('ban', 'unban')),
  reason TEXT DEFAULT '',
  duration TEXT DEFAULT 'permanent',
  device_request_id UUID REFERENCES public.device_requests(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_users_email           ON public.users (email);
CREATE INDEX IF NOT EXISTS idx_users_is_admin        ON public.users (is_admin) WHERE is_admin = true;
CREATE INDEX IF NOT EXISTS idx_users_is_banned       ON public.users (is_banned) WHERE is_banned = true;

CREATE INDEX IF NOT EXISTS idx_devices_user_id       ON public.devices (user_id);
CREATE INDEX IF NOT EXISTS idx_devices_fingerprint   ON public.devices (fingerprint);
CREATE INDEX IF NOT EXISTS idx_devices_user_approved ON public.devices (user_id, is_approved);
CREATE INDEX IF NOT EXISTS idx_devices_last_seen     ON public.devices (last_seen DESC);

CREATE INDEX IF NOT EXISTS idx_device_requests_user        ON public.device_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_device_requests_status      ON public.device_requests (status);
CREATE INDEX IF NOT EXISTS idx_device_requests_fingerprint ON public.device_requests (new_device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_device_requests_created     ON public.device_requests (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_signals_symbol_created ON public.signals (symbol, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_symbol_tf      ON public.signals (symbol, timeframe, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_news_timestamp ON public.news (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_news_category  ON public.news (category, impact);
CREATE INDEX IF NOT EXISTS idx_news_coins     ON public.news USING GIN (coins);
CREATE INDEX IF NOT EXISTS idx_news_hidden    ON public.news (is_hidden) WHERE is_hidden = true;

CREATE INDEX IF NOT EXISTS idx_ban_history_user    ON public.ban_history (user_id, created_at DESC);

-- ============================================================================
-- 3. ADMIN HELPER FUNCTION (used by RLS policies)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT u.is_admin FROM public.users u WHERE u.id = auth.uid()),
    false
  );
$$;

-- ============================================================================
-- 4. ROW LEVEL SECURITY
-- NOTE: this app is browser-only (anon key). Write paths used by the client
-- (engine-generated signals, news ingestion, device self-registration) must
-- remain open to authenticated users; admin-only mutations are gated on
-- public.is_admin(). Tighten further once you add a server/edge layer.
-- ============================================================================

ALTER TABLE public.users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signals         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ban_history     ENABLE ROW LEVEL SECURITY;

-- ---------- users ----------
DROP POLICY IF EXISTS "users_select" ON public.users;
CREATE POLICY "users_select" ON public.users
  FOR SELECT USING (true);  -- ban-check by email happens pre-login (anon)

DROP POLICY IF EXISTS "users_insert_self" ON public.users;
CREATE POLICY "users_insert_self" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "users_update" ON public.users;
CREATE POLICY "users_update" ON public.users
  FOR UPDATE USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "users_delete_admin" ON public.users;
CREATE POLICY "users_delete_admin" ON public.users
  FOR DELETE USING (public.is_admin());

-- ---------- devices ----------
DROP POLICY IF EXISTS "devices_select" ON public.devices;
CREATE POLICY "devices_select" ON public.devices
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "devices_insert" ON public.devices;
CREATE POLICY "devices_insert" ON public.devices
  FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "devices_update" ON public.devices;
CREATE POLICY "devices_update" ON public.devices
  FOR UPDATE USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "devices_delete" ON public.devices;
CREATE POLICY "devices_delete" ON public.devices
  FOR DELETE USING (auth.uid() = user_id OR public.is_admin());

-- ---------- device_requests ----------
DROP POLICY IF EXISTS "device_requests_select" ON public.device_requests;
CREATE POLICY "device_requests_select" ON public.device_requests
  FOR SELECT USING (true);  -- pending-check by fingerprint happens pre-login

DROP POLICY IF EXISTS "device_requests_insert" ON public.device_requests;
CREATE POLICY "device_requests_insert" ON public.device_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "device_requests_update" ON public.device_requests;
CREATE POLICY "device_requests_update" ON public.device_requests
  FOR UPDATE USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "device_requests_delete_admin" ON public.device_requests;
CREATE POLICY "device_requests_delete_admin" ON public.device_requests
  FOR DELETE USING (public.is_admin());

-- ---------- signals (readable by all; written by the client-side engine) ----------
DROP POLICY IF EXISTS "signals_select" ON public.signals;
CREATE POLICY "signals_select" ON public.signals
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "signals_insert" ON public.signals;
CREATE POLICY "signals_insert" ON public.signals
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "signals_delete_admin" ON public.signals;
CREATE POLICY "signals_delete_admin" ON public.signals
  FOR DELETE USING (public.is_admin());

-- ---------- news (readable by all; upserted by the client-side aggregator) ----------
DROP POLICY IF EXISTS "news_select" ON public.news;
CREATE POLICY "news_select" ON public.news
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "news_insert" ON public.news;
CREATE POLICY "news_insert" ON public.news
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "news_update" ON public.news;
CREATE POLICY "news_update" ON public.news
  FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "news_delete_admin" ON public.news;
CREATE POLICY "news_delete_admin" ON public.news
  FOR DELETE USING (public.is_admin());

-- ---------- ban_history (admin writes; users may view their own history) ----------
DROP POLICY IF EXISTS "ban_history_select" ON public.ban_history;
CREATE POLICY "ban_history_select" ON public.ban_history
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "ban_history_insert_admin" ON public.ban_history;
CREATE POLICY "ban_history_insert_admin" ON public.ban_history
  FOR INSERT WITH CHECK (public.is_admin());

-- ============================================================================
-- 5. REALTIME — add tables to the supabase_realtime publication
-- (wrapped so re-runs don't fail on "already member of publication")
-- ============================================================================

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.signals;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.news;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.devices;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.device_requests;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- ============================================================================
-- 6. AUTH TRIGGER — auto-create public.users row on signup
--    + ADMIN BOOTSTRAP (MY_ADMIN_EMAIL = admin@buller.com)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_email CONSTANT TEXT := 'admin@buller.com';  -- MY_ADMIN_EMAIL
BEGIN
  INSERT INTO public.users (id, email, name, is_admin, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    LOWER(NEW.email) = LOWER(admin_email),
    COALESCE(NEW.created_at, NOW())
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        is_admin = public.users.is_admin OR EXCLUDED.is_admin;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill: promote the admin account if it already signed up before this
-- migration ran, and backfill profile rows for any pre-existing auth users.
INSERT INTO public.users (id, email, name, is_admin, created_at)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'name', ''),
  LOWER(au.email) = 'admin@buller.com',
  COALESCE(au.created_at, NOW())
FROM auth.users au
ON CONFLICT (id) DO NOTHING;

UPDATE public.users
SET is_admin = true
WHERE LOWER(email) = 'admin@buller.com';

-- ============================================================================
-- 7. updated_at AUTO-TOUCH TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_touch ON public.users;
CREATE TRIGGER trg_users_touch
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_device_requests_touch ON public.device_requests;
CREATE TRIGGER trg_device_requests_touch
  BEFORE UPDATE ON public.device_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================================
-- DONE. Verify with:
--   SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
--   SELECT * FROM pg_policies WHERE schemaname = 'public';
--   SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
-- ============================================================================
