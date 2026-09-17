
-- ============================================================================
-- TRADING ENGINE — ADMIN COLLECTIONS MIGRATION (002)
-- Run this ONCE in: supabase.com → your project → SQL Editor → New Query → Run
-- Project: kwziwevtmwcpiiuhgtbm
-- Idempotent: safe to re-run (IF NOT EXISTS / DROP POLICY IF EXISTS).
--
-- PURPOSE
--   Backs the ENTIRE admin panel (all 12 tabs) with a single generic
--   key/value/JSONB table. The browser app maps every localStorage
--   "collection" (users, accessRequests, payments, plans, masterKeys,
--   devices, chatThreads, chatMessages, notifications, content, logs)
--   into rows here so arbitrary nested shapes (e.g. DBUser.kyc) persist
--   without per-table column mapping.
--
-- SECURITY NOTE (IMPORTANT — prototype tradeoff)
--   This app authenticates with FIREBASE, not Supabase Auth. That means
--   there is NO Supabase session and auth.uid() / auth.role() = 'authenticated'
--   will NOT be satisfied. To keep the client working we use PERMISSIVE
--   anon policies (USING true). Tighten these once a Supabase session or a
--   server/edge layer is introduced.
-- ============================================================================

-- ---------- app_records (generic JSONB store for all admin collections) ----------
CREATE TABLE IF NOT EXISTS public.app_records (
  collection TEXT NOT NULL,
  id         TEXT NOT NULL,
  data       JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (collection, id)
);

CREATE INDEX IF NOT EXISTS idx_app_records_collection
  ON public.app_records (collection);

CREATE INDEX IF NOT EXISTS idx_app_records_updated
  ON public.app_records (collection, updated_at DESC);

-- ---------- Row Level Security (permissive — see SECURITY NOTE above) ----------
ALTER TABLE public.app_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_records_select" ON public.app_records;
CREATE POLICY "app_records_select" ON public.app_records
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "app_records_insert" ON public.app_records;
CREATE POLICY "app_records_insert" ON public.app_records
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "app_records_update" ON public.app_records;
CREATE POLICY "app_records_update" ON public.app_records
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "app_records_delete" ON public.app_records;
CREATE POLICY "app_records_delete" ON public.app_records
  FOR DELETE USING (true);

-- ---------- updated_at auto-touch ----------
CREATE OR REPLACE FUNCTION public.touch_app_records_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_app_records_touch ON public.app_records;
CREATE TRIGGER trg_app_records_touch
  BEFORE UPDATE ON public.app_records
  FOR EACH ROW EXECUTE FUNCTION public.touch_app_records_updated_at();

-- ---------- Realtime — add to the supabase_realtime publication ----------
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.app_records;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- ============================================================================
-- DONE. Verify with:
--   SELECT collection, COUNT(*) FROM public.app_records GROUP BY collection;
--   SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
-- ============================================================================
