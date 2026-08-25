-- Add Risk:Reward tracking. Win is user-defined R (default 2R), Loss=-1R, BE=0R.
ALTER TABLE public.trade_logs
  ADD COLUMN IF NOT EXISTS reward_r numeric NOT NULL DEFAULT 2;

UPDATE public.trade_logs
SET reward_r = CASE
  WHEN result = 'Win' THEN COALESCE(reward_r, 2)
  WHEN result = 'Loss' THEN -1
  WHEN result = 'BE' THEN 0
END;

CREATE OR REPLACE FUNCTION public.normalize_trade_reward_r()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.result = 'Loss' THEN
    NEW.reward_r := -1;
  ELSIF NEW.result = 'BE' THEN
    NEW.reward_r := 0;
  ELSIF NEW.result = 'Win' THEN
    NEW.reward_r := COALESCE(NEW.reward_r, 2);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trade_logs_normalize_reward_r ON public.trade_logs;
CREATE TRIGGER trade_logs_normalize_reward_r
BEFORE INSERT OR UPDATE OF result, reward_r ON public.trade_logs
FOR EACH ROW EXECUTE FUNCTION public.normalize_trade_reward_r();

ALTER TABLE public.trade_logs
  DROP CONSTRAINT IF EXISTS trade_logs_reward_r_check;
ALTER TABLE public.trade_logs
  ADD CONSTRAINT trade_logs_reward_r_check CHECK (
    (result = 'Loss' AND reward_r = -1) OR
    (result = 'BE' AND reward_r = 0) OR
    (result = 'Win' AND reward_r > 0)
  );
