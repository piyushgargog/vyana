-- 0023_ai_usage_model_only.sql
-- Only model calls count towards a user's AI usage (issue #424).
-- Owner: Vaibhav Parmar
--
-- Not every ai_runs row is a model call: the lab-value correction writes an
-- audit row with model null (no model is called, and that route deliberately
-- skips the daily limit). Migration 0015's my_ai_usage_today() counted every
-- row, so a patient correcting lab values burned plan quota and could be
-- refused real AI calls early. The function now counts only rows that were
-- model calls; the audit rows stay stored and readable as before — they are
-- simply not usage.

create or replace function public.my_ai_usage_today()
returns table (calls bigint, input_tokens bigint, output_tokens bigint)
language sql
security definer
set search_path = public
stable
as $$
  select
    count(*)::bigint,
    coalesce(sum(input_tokens), 0)::bigint,
    coalesce(sum(output_tokens), 0)::bigint
  from public.ai_runs
  where user_id = auth.uid()
    and model is not null
    and (created_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date;
$$;

revoke all on function public.my_ai_usage_today() from public, anon;
grant execute on function public.my_ai_usage_today() to authenticated, service_role;
