-- supabase/tests/database/care_agent_cron.test.sql
-- The care agent's daily switch (issue #449): the two functions exist with the right
-- privileges, and the migration alone schedules nothing. Run with: supabase test db
-- It does not call schedule_care_agent(): that would write a real cron job.
-- Owner: Vaibhav Parmar

begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

select has_function('public', 'schedule_care_agent', 'schedule_care_agent exists');
select has_function('public', 'unschedule_care_agent', 'unschedule_care_agent exists');
select has_function('public', 'run_care_agent', 'the job runner exists');

select ok(
  (select prosecdef from pg_proc where oid = 'public.schedule_care_agent()'::regprocedure),
  'schedule_care_agent is security definer');
select ok(
  (select prosecdef from pg_proc where oid = 'public.unschedule_care_agent()'::regprocedure),
  'unschedule_care_agent is security definer');
select ok(
  exists (select 1 from pg_proc p, unnest(p.proconfig) c where p.oid = 'public.schedule_care_agent()'::regprocedure and c like 'search_path=%'),
  'schedule_care_agent sets its search_path');
select ok(
  exists (select 1 from pg_proc p, unnest(p.proconfig) c where p.oid = 'public.unschedule_care_agent()'::regprocedure and c like 'search_path=%'),
  'unschedule_care_agent sets its search_path');

select is(
  has_function_privilege('anon', 'public.schedule_care_agent()', 'execute'),
  false, 'anon cannot schedule the care agent');
select is(
  has_function_privilege('authenticated', 'public.schedule_care_agent()', 'execute'),
  false, 'a signed-in user cannot schedule the care agent');
select is(
  has_function_privilege('service_role', 'public.schedule_care_agent()', 'execute'),
  true, 'the service role can schedule the care agent');
select is(
  has_function_privilege('anon', 'public.unschedule_care_agent()', 'execute'),
  false, 'anon cannot unschedule the care agent');
select is(
  has_function_privilege('authenticated', 'public.unschedule_care_agent()', 'execute'),
  false, 'a signed-in user cannot unschedule the care agent');
select is(
  has_function_privilege('service_role', 'public.unschedule_care_agent()', 'execute'),
  true, 'the service role can unschedule the care agent');

select is(
  (select count(*)::int from cron.job where jobname = 'care-agent-daily'),
  0, 'the migration alone schedules nothing: no care-agent-daily job exists');

select ok(
  (select prosrc from pg_proc where oid = 'public.schedule_care_agent()'::regprocedure) like '%care-agent-daily%'
    and (select prosrc from pg_proc where oid = 'public.schedule_care_agent()'::regprocedure) like '%30 0 * * *%',
  'scheduling names the care-agent-daily job at 00:30 UTC');
select ok(
  (select prosrc from pg_proc where oid = 'public.run_care_agent()'::regprocedure) ~ 'vault.decrypted_secrets'
    and (select prosrc from pg_proc where oid = 'public.run_care_agent()'::regprocedure) like '%/api/cron/care-agent%',
  'the runner reads the Vault and posts to the care-agent route');

select * from finish();
rollback;
