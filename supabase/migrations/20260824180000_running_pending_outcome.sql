-- Add Running/Pending as the initial trade outcome.
-- Running trades are excluded from settled performance metrics.
ALTER TABLE public.trade_logs
  DROP CONSTRAINT IF EXISTS trade_logs_result_check;

ALTER TABLE public.trade_logs
  ADD CONSTRAINT trade_logs_result_check
  CHECK (result IN ('Running', 'Win', 'Loss', 'BE'));

ALTER TABLE public.trade_logs
  DROP CONSTRAINT IF EXISTS trade_logs_reward_r_check;

ALTER TABLE public.trade_logs
  ADD CONSTRAINT trade_logs_reward_r_check CHECK (
    (result = 'Running' AND reward_r = 0) OR
    (result = 'Loss' AND reward_r = -1) OR
    (result = 'BE' AND reward_r = 0) OR
    (result = 'Win' AND reward_r > 0)
  );

CREATE OR REPLACE FUNCTION public.normalize_trade_reward_r()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.result = 'Running' THEN
    NEW.reward_r := 0;
  ELSIF NEW.result = 'Loss' THEN
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

-- Existing trades remain settled; only newly created trades default to Running in the UI.

ALTER TABLE public.trade_logs ALTER COLUMN result SET DEFAULT 'Running';
ALTER TABLE public.trade_logs ALTER COLUMN reward_r SET DEFAULT 0;
