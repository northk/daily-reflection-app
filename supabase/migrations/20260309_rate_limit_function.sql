-- Atomic rate-limit check and increment.
--
-- Uses SELECT FOR UPDATE to lock the row before reading, which forces concurrent
-- requests to queue rather than all reading the same call_count. After the first
-- transaction commits its UPDATE, the next waiting transaction re-reads the row
-- and sees the updated count (PostgreSQL READ COMMITTED re-reads after lock
-- acquisition). This prevents the TOCTOU race in the original read-then-write logic.
--
-- SET search_path = '' prevents search path injection attacks. All table references
-- are fully qualified with the public schema.
--
-- Returns TRUE if the call is allowed (and has been counted), FALSE if the daily
-- limit is already reached.
--
-- To deploy: paste into Supabase → SQL Editor → New query → Run.

CREATE OR REPLACE FUNCTION public.check_and_increment_ai_usage(
  p_user_id    uuid,
  p_usage_date date,
  p_daily_limit int
) RETURNS boolean
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_count int;
BEGIN
  -- Lock the existing row (if any) so concurrent calls queue here instead of
  -- all reading the same count simultaneously.
  SELECT call_count INTO v_count
  FROM public.ai_usage
  WHERE user_id = p_user_id AND usage_date = p_usage_date
  FOR UPDATE;

  IF NOT FOUND THEN
    -- First call today. Two concurrent requests could both reach this branch
    -- before either inserts, so use ON CONFLICT to handle that safely.
    INSERT INTO public.ai_usage (user_id, usage_date, call_count)
    VALUES (p_user_id, p_usage_date, 1)
    ON CONFLICT (user_id, usage_date) DO UPDATE
      SET call_count = public.ai_usage.call_count + 1;
    RETURN true;
  END IF;

  IF v_count >= p_daily_limit THEN
    RETURN false;
  END IF;

  UPDATE public.ai_usage
  SET call_count = call_count + 1
  WHERE user_id = p_user_id AND usage_date = p_usage_date;

  RETURN true;
END;
$$;
