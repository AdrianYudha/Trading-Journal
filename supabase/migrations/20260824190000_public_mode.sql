-- Public/single-user mode: no login required.
-- This migration intentionally relaxes trade-log RLS for the anon role.
-- It is appropriate only for a personal/public journal where authentication is disabled.

DROP POLICY IF EXISTS "trade_logs_select_own" ON public.trade_logs;
DROP POLICY IF EXISTS "trade_logs_insert_own" ON public.trade_logs;
DROP POLICY IF EXISTS "trade_logs_update_own" ON public.trade_logs;
DROP POLICY IF EXISTS "trade_logs_delete_own" ON public.trade_logs;

CREATE POLICY "public_trade_logs_select" ON public.trade_logs
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "public_trade_logs_insert" ON public.trade_logs
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "public_trade_logs_update" ON public.trade_logs
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "public_trade_logs_delete" ON public.trade_logs
  FOR DELETE TO anon, authenticated USING (true);
