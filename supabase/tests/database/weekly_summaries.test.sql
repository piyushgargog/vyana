-- supabase/tests/database/weekly_summaries.test.sql
-- Weekly summaries (issue #495 step 4): the nightly fill computes both weeks from the
-- medicines, dose logs and device days; the patient reads their own rows, and a caregiver
-- reads one only while the patient shares the adherence scope.
-- Run with: supabase test db
-- Owner: Vaibhav Parmar

begin;
create extension if not exists pgtap with schema extensions;

select plan(15);

-- Fixtures, all dated from the current IST Monday so the fill's two weeks are exercised
create temporary table fx on commit drop as
  select (now() at time zone 'Asia/Kolkata')::date
    - ((extract(isodow from (now() at time zone 'Asia/Kolkata')::date)::int - 1)) as monday;

insert into auth.users (id, email, raw_user_meta_data) values
  ('10000000-0000-0000-0000-000000000001', 'a@vyana.test', '{"full_name":"Patient A"}'),
  ('10000000-0000-0000-0000-000000000002', 'b@vyana.test', '{"full_name":"Patient B"}'),
  ('10000000-0000-0000-0000-000000000005', 'c@vyana.test', '{"full_name":"Caregiver C"}');
insert into public.care_links (patient_id, caregiver_id, relation) values
  ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', 'Daughter');
insert into public.prescriptions (id, patient_id, source) values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'upload');
insert into public.prescription_items (id, prescription_id, patient_id, medicine_name, frequency, times, start_date, active)
select '41000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001', 'Metformin', 'BD', '{08:00,20:00}', monday - 14, true from fx;
insert into public.dose_logs (patient_id, item_id, scheduled_for, status)
select '10000000-0000-0000-0000-000000000001'::uuid, '41000000-0000-0000-0000-000000000001'::uuid,
  ((monday + interval '8 hours') at time zone 'Asia/Kolkata'), 'taken' from fx
union all
select '10000000-0000-0000-0000-000000000001'::uuid, '41000000-0000-0000-0000-000000000001'::uuid,
  ((monday + interval '20 hours') at time zone 'Asia/Kolkata'), 'taken' from fx
union all
select '10000000-0000-0000-0000-000000000001'::uuid, '41000000-0000-0000-0000-000000000001'::uuid,
  ((monday + interval '1 day 8 hours') at time zone 'Asia/Kolkata'), 'taken' from fx
union all
select '10000000-0000-0000-0000-000000000001'::uuid, '41000000-0000-0000-0000-000000000001'::uuid,
  ((monday + interval '1 day 20 hours') at time zone 'Asia/Kolkata'), 'missed' from fx;
insert into public.daily_activity (patient_id, day, source, steps, sleep_minutes)
select '10000000-0000-0000-0000-000000000001'::uuid, monday, 'health_connect', 6000, 420 from fx
union all
select '10000000-0000-0000-0000-000000000001'::uuid, monday + 1, 'health_connect', 9000, 480 from fx;

create function public.tap_login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select lives_ok($$ select public.fill_weekly_summaries() $$, 'the nightly fill runs');
select is(
  (select doses_due from public.weekly_summaries, fx where patient_id = '10000000-0000-0000-0000-000000000001' and week_start = fx.monday),
  14, 'current week: two doses a day for seven days are due');
select is(
  (select doses_taken from public.weekly_summaries, fx where patient_id = '10000000-0000-0000-0000-000000000001' and week_start = fx.monday),
  3, 'three were taken');
select is(
  (select days_covered from public.weekly_summaries, fx where patient_id = '10000000-0000-0000-0000-000000000001' and week_start = fx.monday),
  2, 'on two days');
select is(
  (select steps_avg from public.weekly_summaries, fx where patient_id = '10000000-0000-0000-0000-000000000001' and week_start = fx.monday),
  7500::numeric, 'steps average over the days that have them');
select is(
  (select sleep_avg_minutes from public.weekly_summaries, fx where patient_id = '10000000-0000-0000-0000-000000000001' and week_start = fx.monday),
  450::numeric, 'sleep average likewise');
select is(
  (select doses_due || '/' || doses_taken from public.weekly_summaries, fx where patient_id = '10000000-0000-0000-0000-000000000001' and week_start = fx.monday - 7),
  '14/0', 'the previous week is filled too');
select public.fill_weekly_summaries();
select is(
  (select count(*)::int from public.weekly_summaries where patient_id = '10000000-0000-0000-0000-000000000001'),
  2, 'filling again recomputes the same two rows, no duplicates');

-- Who can read
select public.tap_login('10000000-0000-0000-0000-000000000001'); set local role authenticated;
select is(
  (select count(*)::int from public.weekly_summaries),
  2, 'the patient reads their own summaries (both filled weeks)');
select public.tap_login('10000000-0000-0000-0000-000000000005'); set local role authenticated;
select is(
  (select count(*)::int from public.weekly_summaries where patient_id = '10000000-0000-0000-0000-000000000001'),
  0, 'a caregiver with no shared scope reads nothing');
reset role;
insert into public.share_links (patient_id, kind, scopes, expires_at) values
  ('10000000-0000-0000-0000-000000000001', 'timeline', '{adherence}', now() + interval '1 day');
select public.tap_login('10000000-0000-0000-0000-000000000005'); set local role authenticated;
select is(
  (select count(*)::int from public.weekly_summaries where patient_id = '10000000-0000-0000-0000-000000000001'),
  2, 'with the adherence scope shared, the caregiver reads them');
reset role;
update public.share_links set revoked = true where patient_id = '10000000-0000-0000-0000-000000000001';
select public.tap_login('10000000-0000-0000-0000-000000000005'); set local role authenticated;
select is(
  (select count(*)::int from public.weekly_summaries where patient_id = '10000000-0000-0000-0000-000000000001'),
  0, 'revoking the link ends the caregiver read');
select public.tap_login('10000000-0000-0000-0000-000000000002'); set local role authenticated;
select is(
  (select count(*)::int from public.weekly_summaries where patient_id = '10000000-0000-0000-0000-000000000001'),
  0, 'an unrelated patient reads nothing');

-- The switch-on functions, as the service role
reset role;
set local role service_role;
select public.schedule_weekly_summaries();
select is(
  (select schedule || '|' || command from cron.job where jobname = 'weekly-summaries-nightly'),
  '30 20 * * *|select public.fill_weekly_summaries()',
  'scheduling creates the nightly job');
select public.unschedule_weekly_summaries();
select is(
  (select count(*)::int from cron.job where jobname = 'weekly-summaries-nightly'),
  0, 'unscheduling removes it');

select * from finish();
rollback;
