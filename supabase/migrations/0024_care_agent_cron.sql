-- 0024_care_agent_cron.sql
-- The care agent's daily call, ready but NOT switched on (issue #449).
-- Owner: Vaibhav Parmar
--
-- The loop (PR #444) writes proposals from the rules when POST /api/cron/care-agent
-- is called. This migration only prepares the switch, the same shape as the
-- missed-dose job (0008): two functions Piyush runs by hand when the suggestion
-- cards use real proposals (#417) — schedule_care_agent() creates the daily job,
-- unschedule_care_agent() removes it. The migration itself schedules nothing.
--
-- The address and the secret live in the Vault, never in cron.job (which any
-- admin can read) — exactly as 0008 does.

-- What the job runs: read the address and the secret from the Vault and POST to
-- the route. With neither stored (a fresh local database) it warns and does
-- nothing instead of failing every day.
create or replace function public.run_care_agent()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'app_url' limit 1;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1;

  if v_url is null or v_secret is null then
    raise warning 'care agent skipped: store app_url and cron_secret in the Vault (see supabase/README.md)';
    return;
  end if;

  perform net.http_post(
    url := rtrim(v_url, '/') || '/api/cron/care-agent',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
end;
$$;

-- Only the scheduler (as the table owner) calls it, as with run_missed_dose_check().
revoke all on function public.run_care_agent() from public, anon, authenticated;

-- The switch, on: a daily job at 00:30 UTC (06:00 IST). Naming the job makes
-- this safe to run again: the same name replaces the schedule.
create or replace function public.schedule_care_agent()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform cron.schedule('care-agent-daily', '30 0 * * *', $job$select public.run_care_agent()$job$);
end;
$$;

-- The switch, off.
create or replace function public.unschedule_care_agent()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform cron.unschedule('care-agent-daily');
end;
$$;

revoke all on function public.schedule_care_agent() from public, anon, authenticated;
grant execute on function public.schedule_care_agent() to service_role;
revoke all on function public.unschedule_care_agent() from public, anon, authenticated;
grant execute on function public.unschedule_care_agent() to service_role;
