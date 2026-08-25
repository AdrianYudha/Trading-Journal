-- Complete no-email-verification multi-user setup.
-- The first account becomes admin automatically; later accounts become students.

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'student' CHECK (role IN ('admin', 'student')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_username text;
  assigned_role text;
BEGIN
  requested_username := lower(trim(COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))));
  assigned_role := CASE WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE role = 'admin') THEN 'admin' ELSE 'student' END;
  INSERT INTO public.profiles (id, username, role)
  VALUES (NEW.id, requested_username, assigned_role)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP POLICY IF EXISTS "profiles_self_select" ON public.profiles;
CREATE POLICY "profiles_self_select" ON public.profiles
FOR SELECT TO authenticated USING (id = auth.uid());

DROP POLICY IF EXISTS "profiles_self_insert" ON public.profiles;
CREATE POLICY "profiles_self_insert" ON public.profiles
FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

ALTER TABLE public.trade_logs ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS trade_logs_user_id_idx ON public.trade_logs(user_id);

-- Preserve legacy single-user journal data by assigning it to the oldest account.
UPDATE public.trade_logs
SET user_id = (SELECT id FROM public.profiles ORDER BY created_at ASC LIMIT 1)
WHERE user_id IS NULL
  AND EXISTS (SELECT 1 FROM public.profiles);

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

-- Repair existing accounts. If no admin exists, oldest existing account becomes admin.
INSERT INTO public.profiles (id, username, role)
SELECT u.id,
       lower(trim(COALESCE(u.raw_user_meta_data->>'username', split_part(u.email, '@', 1)))),
       CASE WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE role = 'admin') THEN 'admin' ELSE 'student' END
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL AND COALESCE(u.email, '') <> ''
ON CONFLICT (id) DO NOTHING;

UPDATE public.profiles
SET role = 'admin'
WHERE id = (
  SELECT id FROM public.profiles ORDER BY created_at ASC LIMIT 1
)
AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE role = 'admin');
