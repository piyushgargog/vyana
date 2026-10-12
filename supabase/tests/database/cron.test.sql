-- supabase/tests/database/cron.test.sql
-- The schedule of the missed-dose check. Run with: supabase test db
-- It does not call run_missed_dose_check(): with secrets in the Vault that would make a real HTTP call.
-- Owner: Vaibhav Parmar

begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

select is(
  (select count(*)::int from cron.job where jobname = 'missed-dose-check'),
  1, 'the missed-dose job is scheduled once');
select is(
  (select schedule from cron.job where jobname = 'missed-dose-check'),
  '*/15 * * * *', 'every 15 minutes');
select ok(
  (select command from cron.job where jobname = 'missed-dose-check') like '%public.run_missed_dose_check()%',
  'and it calls run_missed_dose_check()');
select ok(
  (select command from cron.job where jobname = 'missed-dose-check') !~* '(http|secret|vyana\.test|bearer)',
  'the job command holds no URL and no secret (cron.job is readable by admins)');

select ok(
  (select prosecdef from pg_proc where oid = 'public.run_missed_dose_check()'::regprocedure),
  'run_missed_dose_check is security definer');
select ok(
  exists (select 1 from pg_proc p, unnest(p.proconfig) c where p.oid = 'public.run_missed_dose_check()'::regprocedure and c like 'search_path=%'),
  'and sets its search_path');
select ok(
  (select prosrc from pg_proc where oid = 'public.run_missed_dose_check()'::regprocedure) ~ 'vault.decrypted_secrets',
  'it reads the address and the secret from the Vault');

select is(
  has_function_privilege('authenticated', 'public.run_missed_dose_check()', 'execute'),
  false, 'a signed-in user cannot run it');
select is(
  has_function_privilege('anon', 'public.run_missed_dose_check()', 'execute'),
  false, 'and neither can a visitor');

select * from finish();
rollback;
