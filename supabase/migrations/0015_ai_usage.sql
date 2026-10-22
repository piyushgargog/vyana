-- 0015_ai_usage.sql
-- Usage metering (issue #300): what every AI call costs, per user per day.
-- Owner: Vaibhav Parmar
--
-- ai_runs already records the model of every AI call, but not the size of the
-- call, so until now nobody could say what a user costs or how close a free
-- tier is. This adds the size (provider, tokens in and out, latency), a daily
-- roll-up for the service role, and one function a signed-in user can call to
-- see their own totals for today — the "AI uses left today" line reads it.
--
-- The new columns are all nullable with no default: rows written before this
-- migration have no size and stay that way; nothing is backfilled or guessed.

alter table public.ai_runs
  add column provider text,
  add column input_tokens int,
  add column output_tokens int,
  add column latency_ms int;

-- The daily roll-up groups by user and day, so it reads by (user_id, created_at).
create index idx_ai_runs_user_created on public.ai_runs (user_id, created_at);

-- Daily totals per user and feature, the day counted in Asia/Kolkata (the day
-- the patient lives in, not the server's). A row the server wrote without a
-- user (user_id is nullable on ai_runs) rolls up under a null user: the cost
-- is real even when it belongs to nobody.
--
-- Service role only: the view spans every user, so both app roles are revoked
-- outright. A view runs with its owner's rights, so a grant here would bypass
-- the row level security on ai_runs itself.
create view public.ai_usage_daily as
select
  user_id,
  (created_at at time zone 'Asia/Kolkata')::date as day,
  feature,
  count(*)::bigint as calls,
  coalesce(sum(input_tokens), 0)::bigint as input_tokens,
  coalesce(sum(output_tokens), 0)::bigint as output_tokens
from public.ai_runs
group by user_id, (created_at at time zone 'Asia/Kolkata')::date, feature;

revoke all on public.ai_usage_daily from anon, authenticated;
grant select on public.ai_usage_daily to service_role;

-- The caller's own totals for today (Asia/Kolkata). Security definer because
-- the daily view above is service-only and ai_runs itself is read through row
-- level security; the function filters by auth.uid() itself, so a caller can
-- only ever be handed their own numbers. With no runs today it returns one
-- row of zeros, so the app always has a total to show.
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
    and (created_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date;
$$;

revoke all on function public.my_ai_usage_today() from public, anon;
grant execute on function public.my_ai_usage_today() to authenticated, service_role;
