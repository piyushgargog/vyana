-- supabase/tests/database/late_dose.test.sql
-- Late-dose nudges (issue #495 step 3): the patient's switch defaults on, one row per
-- dose slot, and the record is the server's alone (no signed-in read or write).
-- Run with: supabase test db
-- Owner: Vaibhav Parmar

begin;
create extension if not exists pgtap with schema extensions;

select plan(6);

insert into auth.users (id, email, raw_user_meta_data) values
  ('10000000-0000-0000-0000-000000000001', 'a@vyana.test', '{"full_name":"Patient A"}');
insert into public.prescriptions (id, patient_id, source) values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'upload');
insert into public.prescription_items (id, prescription_id, patient_id, medicine_name, frequency) values
  ('41000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Metformin', 'BD');
-- Supabase grants table access to authenticated by default and lets the policies decide;
-- this local harness does not, so grant what the platform would.
grant select, insert on public.late_dose_pushes to authenticated;

create function public.tap_login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select is(
  (select late_dose_nudge from public.profiles where id = '10000000-0000-0000-0000-000000000001'),
  true, 'the Late dose nudge switch starts on');

-- The server's record of a nudge (as the table owner here)
insert into public.late_dose_pushes (patient_id, item_id, scheduled_for) values
  ('10000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', '2026-10-23T08:00:00+05:30');
select is(
  (select count(*)::int from public.late_dose_pushes),
  1, 'a nudge is recorded');
select throws_ok(
  $$ insert into public.late_dose_pushes (patient_id, item_id, scheduled_for) values
     ('10000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', '2026-10-23T08:00:00+05:30') $$,
  '23505', null, 'the same slot can never be recorded twice');

-- Signed in, the patient can neither read nor write the record
select public.tap_login('10000000-0000-0000-0000-000000000001'); set local role authenticated;
select is(
  (select count(*)::int from public.late_dose_pushes),
  0, 'a signed-in user reads no nudge records');
select throws_ok(
  $$ insert into public.late_dose_pushes (patient_id, item_id, scheduled_for) values
     ('10000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', '2026-10-23T20:00:00+05:30') $$,
  '42501', null, 'and cannot write one');

-- The record leaves with the account
reset role;
delete from auth.users where id = '10000000-0000-0000-0000-000000000001';
select is(
  (select count(*)::int from public.late_dose_pushes),
  0, 'deleting the account removes the records');

select * from finish();
rollback;
