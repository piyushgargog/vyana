-- 0008_missed_dose_cron.sql
-- Every 15 minutes the database calls POST /api/cron/missed-doses (V6, plan F11). Owner: Vaibhav Parmar
--
-- The route finds doses that were due 60+ minutes ago and never logged, for patients with a caregiver, and
-- pushes the caregivers once each (missed_dose_alerts keeps it to once). Supabase's pg_cron runs the job and
-- pg_net makes the HTTP call.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Where to call and the shared secret live in the Vault, never in a migration or in cron.job (which any
-- admin can read). Set them once per project, see supabase/README.md:
--   select vault.create_secret('https://<your-app>.vercel.app', 'app_url');
--   select vault.create_secret('<the value of CRON_SECRET>', 'cron_secret');
create or replace function public.run_missed_dose_check()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'app_url' limit 1;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1;

  if v_url is null or v_secret is null then
    -- Not configured yet (a fresh local database): say so in the log and do nothing, instead of failing every 15 minutes.
    raise warning 'missed-dose check skipped: store app_url and cron_secret in the Vault (see supabase/README.md)';
    return;
  end if;

  perform net.http_post(
    url := rtrim(v_url, '/') || '/api/cron/missed-doses',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
end;
$$;

-- Only the scheduler (as the table owner) calls it.
revoke all on function public.run_missed_dose_check() from public, anon, authenticated;

-- Naming the job makes this safe to run again: the same name replaces the schedule.
select cron.schedule('missed-dose-check', '*/15 * * * *', $job$select public.run_missed_dose_check()$job$);
