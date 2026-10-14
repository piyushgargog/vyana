-- 0012_rate_limits.sql
-- Counters for the per-user limits on the AI and web-agent routes (V20, issue #137). Owner: Vaibhav Parmar
--
-- Real people sign up now, and one account calling an AI or web-agent route in a loop would use up the team's Groq and
-- TinyFish credits. The API (withRoute, issue #138) calls hit_rate_limit() with the service role before it starts
-- any of that work. Nobody else touches this table: not the app, not a signed-in user.

-- One row per user, bucket and window: `hits` counts the calls in that window. A window is a fixed slice of time
-- (for example every 10 minutes on the clock), so a counter is a single row that is updated in place.
create table public.rate_limits (
  user_id uuid not null references public.profiles(id) on delete cascade,
  bucket text not null check (char_length(bucket) between 1 and 64),
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (user_id, bucket, window_start)
);

-- For the hourly clean-up (rows older than a day are useless).
create index idx_rate_limits_window_start on public.rate_limits (window_start);

-- RLS on and no policy at all: a signed-in user can neither read nor write it. The privileges are removed as well,
-- so the rule does not rest on one setting only. The function below runs as its owner and is the only way in.
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from public, anon, authenticated;

-- Counts one call and says whether it is allowed.
--
--   allowed    false when this call is over `p_max` in the current window
--   remaining  how many more calls the window allows (0 when refused)
--   reset_at   when the current window ends and the counter starts again
--
-- The count is ONE statement (insert ... on conflict do update ... returning), so two requests at the same moment
-- cannot both read the old number: each gets its own number. Refused calls are counted too (they are calls).
-- The window is `p_window_seconds` long and starts on a multiple of it since 1970, so it is the same for every
-- caller and nothing has to be remembered between windows.
create or replace function public.hit_rate_limit(p_user uuid, p_bucket text, p_window_seconds int, p_max int)
returns table (allowed boolean, remaining int, reset_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user is null or p_bucket is null or char_length(p_bucket) not between 1 and 64
     or p_window_seconds is null or p_window_seconds <= 0 or p_max is null or p_max < 0 then
    raise exception 'hit_rate_limit: invalid arguments' using errcode = '22023';
  end if;

  return query
  with win as (
    select to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds) as started
  ),
  hit as (
    insert into public.rate_limits as r (user_id, bucket, window_start, hits)
    select p_user, p_bucket, win.started, 1 from win
    on conflict (user_id, bucket, window_start) do update set hits = r.hits + 1
    returning r.hits, r.window_start
  )
  select hit.hits <= p_max,
         greatest(p_max - hit.hits, 0),
         hit.window_start + make_interval(secs => p_window_seconds)
  from hit;
end;
$$;

-- Only the server (service role) may count: the API calls it with the admin client after it has checked who the
-- user is. A signed-in user calling it directly could burn another user's allowance.
revoke all on function public.hit_rate_limit(uuid, text, int, int) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(uuid, text, int, int) to service_role;

-- Clean-up every hour: windows are at most hours long, so a day is far more than any counter needs. Naming the job
-- makes this safe to run again (the same name replaces the schedule). Like 0008_missed_dose_cron.sql.
select cron.schedule('rate-limits-cleanup', '17 * * * *', $job$delete from public.rate_limits where window_start < now() - interval '1 day'$job$);
