-- supabase/tests/database/account_deletion.test.sql
-- Deleting an account (DELETE /api/me removes the auth user; the rest follows by cascade). Run with: supabase test db
-- Owner: Vaibhav Parmar

begin;
create extension if not exists pgtap with schema extensions;

select plan(23);

-- ----------------------------------------------------------------------------
-- Fixtures (as the table owner)
-- ----------------------------------------------------------------------------
-- 1 patient A · 2 patient B · 3 doctor D · 5 caregiver C

insert into auth.users (id, email, raw_user_meta_data) values
  ('10000000-0000-0000-0000-000000000001', 'a@vyana.test', '{}'),
  ('10000000-0000-0000-0000-000000000002', 'b@vyana.test', '{}'),
  ('10000000-0000-0000-0000-000000000003', 'd@vyana.test', '{"role":"doctor"}'),
  ('10000000-0000-0000-0000-000000000005', 'c@vyana.test', '{}');

insert into public.hospitals (id, name, kind) values ('20000000-0000-0000-0000-000000000001', 'Test Hospital', 'government');
insert into public.departments (id, hospital_id, name) values ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Medicine');
insert into public.doctors (id, specialization, reg_no, state_council, verification_status, hospital_id, department_id) values
  ('10000000-0000-0000-0000-000000000003', 'Physician', 'T-1', 'Delhi', 'verified',
   '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001');

-- Patient A and patient B each have a full record, written by doctor D where a doctor takes part.
do $$
declare
  p uuid;
  n int := 0;
begin
  foreach p in array array['10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002']::uuid[] loop
    n := n + 1;
    insert into public.appointments (patient_id, doctor_id, hospital_id, department_id, appointment_date, token_no)
      values (p, '10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', current_date, n);
    insert into public.prescriptions (id, patient_id, doctor_id, source)
      values (('40000000-0000-0000-0000-00000000000' || n)::uuid, p, '10000000-0000-0000-0000-000000000003', 'doctor');
    insert into public.conditions (id, patient_id, name, source, diagnosed_by, prescription_id)
      values (('42000000-0000-0000-0000-00000000000' || n)::uuid, p, 'Type 2 Diabetes', 'doctor', '10000000-0000-0000-0000-000000000003', ('40000000-0000-0000-0000-00000000000' || n)::uuid);
    insert into public.care_plans (patient_id, condition_id, status, plan_json, reviewed_by)
      values (p, ('42000000-0000-0000-0000-00000000000' || n)::uuid, 'approved', '{"v":1}', '10000000-0000-0000-0000-000000000003');
    insert into public.prescription_items (id, prescription_id, patient_id, medicine_name, frequency, times)
      values (('41000000-0000-0000-0000-00000000000' || n)::uuid, ('40000000-0000-0000-0000-00000000000' || n)::uuid, p, 'Metformin', 'BD', '{09:00,21:00}');
    insert into public.dose_logs (patient_id, item_id, scheduled_for, status)
      values (p, ('41000000-0000-0000-0000-00000000000' || n)::uuid, now(), 'taken');
    insert into public.missed_dose_alerts (item_id, scheduled_for)
      values (('41000000-0000-0000-0000-00000000000' || n)::uuid, now() - interval '2 hours');
    insert into public.vitals (patient_id, type, value, unit) values (p, 'weight', 70, 'kg');
    insert into public.emergency_contacts (patient_id, name, phone) values (p, 'Relative', '+91 00000 00000');
    insert into public.share_links (patient_id, kind, expires_at) values (p, 'medical_id', now() + interval '1 day');
    insert into public.consents (user_id, version) values (p, 'v1');
    insert into public.push_tokens (user_id, token, platform) values (p, 'ExponentPushToken[' || n || ']', 'android');
    insert into public.chat_sessions (id, user_id, title) values (('45000000-0000-0000-0000-00000000000' || n)::uuid, p, 'chat');
    insert into public.chat_messages (session_id, user_id, role, parts)
      values (('45000000-0000-0000-0000-00000000000' || n)::uuid, p, 'user', '[]');
    insert into public.ai_runs (user_id, feature, model, prompt_version) values (p, 'chat', 'm', 'v1');
  end loop;
end;
$$;

-- patient A is looked after by caregiver C, who joined with an invite code
insert into public.care_links (patient_id, caregiver_id, relation)
  values ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', 'Daughter');
insert into public.care_invites (code, patient_id, expires_at, used_by, used_at)
  values ('123456', '10000000-0000-0000-0000-000000000001', now() + interval '1 day', '10000000-0000-0000-0000-000000000005', now());

-- ----------------------------------------------------------------------------
-- The schema: no link to a person may stop their deletion
-- ----------------------------------------------------------------------------
select is(
  (select count(*)::int from pg_constraint
    where contype = 'f' and confdeltype in ('a', 'r')
      and confrelid in ('public.profiles'::regclass, 'public.doctors'::regclass, 'auth.users'::regclass)),
  0, 'no foreign key to a profile, a doctor or a user blocks their deletion');

-- ----------------------------------------------------------------------------
-- A caregiver deletes their account
-- ----------------------------------------------------------------------------
select lives_ok($$ delete from auth.users where id = '10000000-0000-0000-0000-000000000005' $$,
  'a caregiver who joined with an invite code can delete their account');
select is((select count(*)::int from public.care_links where caregiver_id = '10000000-0000-0000-0000-000000000005'), 0,
  'their care link is gone');
select is((select used_by from public.care_invites where code = '123456'), null,
  'the invite of the patient stays, without the caregiver');
select is((select count(*)::int from public.prescriptions where patient_id = '10000000-0000-0000-0000-000000000001'), 1,
  'and the patient still has their record');

-- ----------------------------------------------------------------------------
-- A doctor deletes their account
-- ----------------------------------------------------------------------------
select lives_ok($$ delete from auth.users where id = '10000000-0000-0000-0000-000000000003' $$,
  'a doctor who saw patients can delete their account');
select is((select count(*)::int from public.doctors), 0, 'the doctor row is gone');
select is((select count(*)::int from public.appointments where doctor_id is not null), 0, 'appointments no longer point to the doctor');
select is((select count(*)::int from public.appointments), 2, 'but both appointments stay');
select is((select count(*)::int from public.prescriptions where doctor_id is null and source = 'doctor'), 2,
  'prescriptions stay, without the doctor');
select is((select count(*)::int from public.conditions where diagnosed_by is null), 2, 'conditions stay, without the doctor');
select is((select count(*)::int from public.care_plans where reviewed_by is null and status = 'approved'), 2, 'care plans stay, without the reviewer');

-- ----------------------------------------------------------------------------
-- A patient deletes their account
-- ----------------------------------------------------------------------------
create function public.tap_rows_of(uid uuid) returns int language plpgsql as $$
declare
  t record;
  n int;
  total int := 0;
begin
  for t in
    select c.relname as tbl, a.attname as col
    from pg_constraint k
    join pg_class c on c.oid = k.conrelid
    join pg_namespace s on s.oid = c.relnamespace and s.nspname = 'public'
    join pg_attribute a on a.attrelid = c.oid and a.attnum = k.conkey[1]
    where k.contype = 'f' and k.confrelid = 'public.profiles'::regclass and k.confdeltype = 'c'
  loop
    execute format('select count(*) from public.%I where %I = $1', t.tbl, t.col) into n using uid;
    total := total + n;
  end loop;
  return total;
end;
$$;

select is(public.tap_rows_of('10000000-0000-0000-0000-000000000001') > 10, true, 'before the deletion the patient has rows in many tables');
select lives_ok($$ delete from auth.users where id = '10000000-0000-0000-0000-000000000001' $$,
  'a patient can delete their account');
select is(public.tap_rows_of('10000000-0000-0000-0000-000000000001'), 0, 'not one row of the patient is left in any table that points to a profile');
select is((select count(*)::int from public.profiles where id = '10000000-0000-0000-0000-000000000001'), 0, 'the profile is gone');
select is((select count(*)::int from public.prescription_items where patient_id = '10000000-0000-0000-0000-000000000001'), 0, 'their medicines are gone');
select is((select count(*)::int from public.chat_messages where user_id = '10000000-0000-0000-0000-000000000001'), 0, 'their chat is gone');
select is((select count(*)::int from public.missed_dose_alerts where item_id = '41000000-0000-0000-0000-000000000001'), 0, 'and so are the alerts about their doses');
select is((select count(*)::int from public.care_invites where patient_id = '10000000-0000-0000-0000-000000000001'), 0, 'their invites are gone');

-- patient B is not touched
select is(public.tap_rows_of('10000000-0000-0000-0000-000000000002') > 10, true, 'the other patient keeps all their rows');
select is((select count(*)::int from public.dose_logs where patient_id = '10000000-0000-0000-0000-000000000002'), 1, 'including their dose log');
select is((select count(*)::int from public.share_links where patient_id = '10000000-0000-0000-0000-000000000002'), 1, 'and their share link');

select * from finish();
rollback;
