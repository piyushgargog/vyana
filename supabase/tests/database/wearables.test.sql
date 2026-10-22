-- supabase/tests/database/wearables.test.sql
-- Device data (issue #325, ADR-073): who may read and write daily activity, device
-- connections and device-sourced vitals, the dedupe keys, and delete_my_device_data.
-- Run with: supabase test db
-- Owner: Vaibhav Parmar

begin;
create extension if not exists pgtap with schema extensions;

select plan(22);

-- 1 patient A · 2 patient B · 3 doctor D (Medicine, has an appointment with A) · 4 doctor E (Skin, no patient)
insert into auth.users (id, email, raw_user_meta_data) values
  ('10000000-0000-0000-0000-000000000001', 'a@vyana.test', '{}'),
  ('10000000-0000-0000-0000-000000000002', 'b@vyana.test', '{}'),
  ('10000000-0000-0000-0000-000000000003', 'd@vyana.test', '{"role":"doctor"}'),
  ('10000000-0000-0000-0000-000000000004', 'e@vyana.test', '{"role":"doctor"}');

insert into public.hospitals (id, name, kind) values ('20000000-0000-0000-0000-000000000001', 'Test Hospital', 'government');
insert into public.departments (id, hospital_id, name) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Medicine'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Skin');
insert into public.doctors (id, specialization, reg_no, state_council, verification_status, hospital_id, department_id) values
  ('10000000-0000-0000-0000-000000000003', 'Physician', 'T-1', 'Delhi', 'verified', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000004', 'Physician', 'T-2', 'Delhi', 'verified', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002');
insert into public.appointments (patient_id, doctor_id, hospital_id, department_id, appointment_date, token_no, status)
  values ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', current_date, 1, 'confirmed');

create function public.tap_login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- A's rows before anyone signs in: one manual and one device vital, one day of activity, one connection.
insert into public.vitals (patient_id, type, value, value2, unit) values
  ('10000000-0000-0000-0000-000000000001', 'bp', 120, 80, 'mmHg');
insert into public.vitals (patient_id, type, value, unit, source, device_name, external_id) values
  ('10000000-0000-0000-0000-000000000001', 'spo2', 98, '%', 'health_connect', 'Watch', 'ext-1');
insert into public.daily_activity (patient_id, day, steps, sleep_minutes, source, device_name) values
  ('10000000-0000-0000-0000-000000000001', current_date - 1, 5000, 400, 'health_connect', 'Watch');
insert into public.device_connections (patient_id, provider, status, permissions) values
  ('10000000-0000-0000-0000-000000000001', 'health_connect', 'connected', '{steps,sleep}');

-- ----------------------------------------------------------------------------
-- Patient A writes and reads their own activity
-- ----------------------------------------------------------------------------
select public.tap_login('10000000-0000-0000-0000-000000000001'); set local role authenticated;

select lives_ok(
  $$ insert into public.daily_activity (patient_id, day, steps, source) values ('10000000-0000-0000-0000-000000000001', current_date, 7000, 'health_connect') $$,
  'a patient stores a day of their own activity');
select throws_ok(
  $$ insert into public.daily_activity (patient_id, day, steps, source) values ('10000000-0000-0000-0000-000000000002', current_date, 7000, 'health_connect') $$,
  '42501', null, 'a patient cannot store activity for somebody else');
select throws_ok(
  $$ insert into public.daily_activity (patient_id, day, steps, source) values ('10000000-0000-0000-0000-000000000001', current_date, 7100, 'health_connect') $$,
  '23505', null, 'one row per patient, day and source: a second insert for the same day is refused (the sync upserts)');
select throws_ok(
  $$ insert into public.daily_activity (patient_id, day, steps, source) values ('10000000-0000-0000-0000-000000000001', current_date - 2, 200001, 'health_connect') $$,
  '23514', null, 'steps over 200000 are refused');
select is(
  (select count(*)::int from public.daily_activity),
  2, 'the patient reads their own two days');

-- ----------------------------------------------------------------------------
-- Patient B sees nothing of A's, and cannot write a vital for A
-- ----------------------------------------------------------------------------
select public.tap_login('10000000-0000-0000-0000-000000000002'); set local role authenticated;

select is(
  (select count(*)::int from public.daily_activity),
  0, 'another patient reads no activity rows');
select throws_ok(
  $$ insert into public.vitals (patient_id, type, value, unit, source, external_id) values ('10000000-0000-0000-0000-000000000001', 'spo2', 97, '%', 'health_connect', 'ext-2') $$,
  '42501', null, 'a patient cannot add a vital for somebody else');

-- ----------------------------------------------------------------------------
-- Doctors: A's doctor reads, an unrelated doctor does not, neither writes
-- ----------------------------------------------------------------------------
select public.tap_login('10000000-0000-0000-0000-000000000003'); set local role authenticated;

select is(
  (select count(*)::int from public.daily_activity),
  2, 'a doctor of the patient reads their activity');
select throws_ok(
  $$ insert into public.daily_activity (patient_id, day, steps, source) values ('10000000-0000-0000-0000-000000000001', current_date - 3, 100, 'health_connect') $$,
  '42501', null, 'a doctor cannot write activity for a patient');

select public.tap_login('10000000-0000-0000-0000-000000000004'); set local role authenticated;

select is(
  (select count(*)::int from public.daily_activity),
  0, 'a doctor who does not treat the patient reads nothing');

-- ----------------------------------------------------------------------------
-- The vitals dedupe: a device reading is stored once, a manual one always
-- ----------------------------------------------------------------------------
select public.tap_login('10000000-0000-0000-0000-000000000001'); set local role authenticated;

select throws_ok(
  $$ insert into public.vitals (patient_id, type, value, unit, source, external_id) values ('10000000-0000-0000-0000-000000000001', 'spo2', 98, '%', 'health_connect', 'ext-1') $$,
  '23505', null, 'the same device reading (source + external id) cannot be stored twice');
select lives_ok(
  $$ insert into public.vitals (patient_id, type, value, value2, unit) values ('10000000-0000-0000-0000-000000000001', 'bp', 118, 79, 'mmHg') $$,
  'a manual reading carries no external id');
select lives_ok(
  $$ insert into public.vitals (patient_id, type, value, value2, unit) values ('10000000-0000-0000-0000-000000000001', 'bp', 118, 79, 'mmHg') $$,
  'and the same manual reading may be entered again (the partial index does not cover it)');
select is(
  (select count(*)::int from public.vitals where source = 'manual'),
  3, 'manual rows are the default source: the seeded one and the two just added');

-- ----------------------------------------------------------------------------
-- delete_my_device_data: device rows go, manual rows stay, connections revoke
-- ----------------------------------------------------------------------------
select lives_ok(
  $$ select public.delete_my_device_data() $$,
  'the patient can delete their device data');
select is(
  (select count(*)::int from public.vitals where source <> 'manual'),
  0, 'every device-sourced vital is gone');
select is(
  (select count(*)::int from public.vitals where source = 'manual'),
  3, 'the manual vitals are untouched');
select is(
  (select count(*)::int from public.daily_activity),
  0, 'every daily activity row is gone');
select is(
  (select status from public.device_connections where patient_id = '10000000-0000-0000-0000-000000000001'),
  'revoked', 'the connection is left revoked, not deleted');

-- ----------------------------------------------------------------------------
-- Signed out: nothing at all
-- ----------------------------------------------------------------------------
select set_config('request.jwt.claims', '{}', true); set local role anon;

select throws_ok(
  $$ select * from public.daily_activity $$,
  '42501', null, 'anon reads no activity');
select throws_ok(
  $$ select * from public.device_connections $$,
  '42501', null, 'anon reads no connections');

set local role authenticated;

select throws_ok(
  $$ select public.delete_my_device_data() $$,
  '42501', null, 'with no signed-in user, delete_my_device_data refuses');

select * from finish();
rollback;
