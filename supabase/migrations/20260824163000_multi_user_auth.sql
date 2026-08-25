-- Multi-user auth, profiles, per-user journal ownership, and RLS.

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'student' CHECK (role IN ('admin', 'student')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_username text;
BEGIN
  requested_username := lower(trim(COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))));
  INSERT INTO public.profiles (id, username, role)
  VALUES (NEW.id, requested_username, 'student')
  ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_self_select" ON public.profiles;
CREATE POLICY "profiles_self_select" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());

-- Allows the frontend to repair a profile for an already-authenticated
-- account created before the profile trigger was installed.
DROP POLICY IF EXISTS "profiles_self_insert" ON public.profiles;
CREATE POLICY "profiles_self_insert" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

ALTER TABLE public.trade_logs ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS trade_logs_user_id_idx ON public.trade_logs(user_id);

-- Old single-tenant policies are intentionally removed.
DROP POLICY IF EXISTS "anon_select_trade_logs" ON public.trade_logs;
DROP POLICY IF EXISTS "anon_insert_trade_logs" ON public.trade_logs;
DROP POLICY IF EXISTS "anon_update_trade_logs" ON public.trade_logs;
DROP POLICY IF EXISTS "anon_delete_trade_logs" ON public.trade_logs;
DROP POLICY IF EXISTS "trade_logs_select_own" ON public.trade_logs;
DROP POLICY IF EXISTS "trade_logs_insert_own" ON public.trade_logs;
DROP POLICY IF EXISTS "trade_logs_update_own" ON public.trade_logs;
DROP POLICY IF EXISTS "trade_logs_delete_own" ON public.trade_logs;

CREATE POLICY "trade_logs_select_own" ON public.trade_logs FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "trade_logs_insert_own" ON public.trade_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "trade_logs_update_own" ON public.trade_logs FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "trade_logs_delete_own" ON public.trade_logs FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Admin helper functions used only by the Edge Function/service role.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'); $$;

-- Run once after your first account is created to promote it:
-- UPDATE public.profiles SET role = 'admin' WHERE username = 'your_admin_username';


-- Repair accounts that existed before this migration was applied.
INSERT INTO public.profiles (id, username, role)
SELECT
  u.id,
  lower(trim(COALESCE(u.raw_user_meta_data->>'username', split_part(u.email, '@', 1)))),
  'student'
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
  AND COALESCE(u.email, '') <> ''
ON CONFLICT (id) DO NOTHING;
