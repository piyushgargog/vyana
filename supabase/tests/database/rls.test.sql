-- supabase/tests/database/rls.test.sql
-- Executable access-control checks (pgTAP). Run with: supabase test db
-- Every access path is tried as the real signed-in role (authenticated) with a JWT subject.
-- Owner: Vaibhav Parmar

begin;
create extension if not exists pgtap with schema extensions;

select plan(105);

-- ----------------------------------------------------------------------------
-- Fixtures (as the table owner). Everything is rolled back at the end.
-- ----------------------------------------------------------------------------
-- 1 patient A · 2 patient B · 3 verified doctor D1 · 4 pending doctor D2 · 5 caregiver C
-- 6 patient E (rate limit) · 7 admin · 8 doctor D3 (signs up in the test)

insert into auth.users (id, email, raw_user_meta_data) values
  ('10000000-0000-0000-0000-000000000001', 'a@vyana.test', '{"full_name":"Patient A"}'),
  ('10000000-0000-0000-0000-000000000002', 'b@vyana.test', '{"full_name":"Patient B"}'),
  ('10000000-0000-0000-0000-000000000003', 'd1@vyana.test', '{"full_name":"Doctor One","role":"doctor"}'),
  ('10000000-0000-0000-0000-000000000004', 'd2@vyana.test', '{"full_name":"Doctor Two","role":"doctor"}'),
  ('10000000-0000-0000-0000-000000000005', 'c@vyana.test', '{"full_name":"Caregiver C"}'),
  ('10000000-0000-0000-0000-000000000006', 'e@vyana.test', '{"full_name":"Patient E"}'),
  ('10000000-0000-0000-0000-000000000007', 'admin@vyana.test', '{"full_name":"Admin"}');
update public.profiles set role = 'admin' where id = '10000000-0000-0000-0000-000000000007';

insert into public.hospitals (id, name, kind) values
  ('20000000-0000-0000-0000-000000000001', 'Test Hospital', 'government');
insert into public.departments (id, hospital_id, name, opd_days, daily_token_limit) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Medicine', '{1,2,3,4,5,6,7}', 100),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Skin', '{1}', 100),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'Tiny', '{1,2,3,4,5,6,7}', 1);

insert into public.doctors (id, specialization, reg_no, state_council, verification_status, hospital_id, department_id) values
  ('10000000-0000-0000-0000-000000000003', 'General Physician', 'T-1', 'Delhi', 'verified',
   '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000004', 'General Physician', 'T-2', 'Delhi', 'pending',
   '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001');

-- a Tuesday (department "Skin" is closed) and a Monday (open)
select set_config('t.tuesday', (select (current_date + g)::text from generate_series(1, 7) g where extract(isodow from current_date + g) = 2), true);
select set_config('t.monday', (select (current_date + g)::text from generate_series(1, 7) g where extract(isodow from current_date + g) = 1), true);

-- A: an uploaded prescription, a doctor's prescription, a condition, vitals, lab report, care plans
insert into public.prescriptions (id, patient_id, doctor_id, source, issued_on) values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', null, 'upload', current_date),
  ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'doctor', current_date),
  ('40000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', null, 'upload', current_date);
insert into public.prescription_items (id, prescription_id, patient_id, medicine_name, frequency) values
  ('41000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Metformin', 'BD'),
  ('41000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Telmisartan', 'OD'),
  ('41000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'Amlodipine', 'OD');
insert into public.conditions (id, patient_id, name) values
  ('42000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Type 2 Diabetes'),
  ('42000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Depression');
insert into public.vitals (patient_id, type, value, unit) values
  ('10000000-0000-0000-0000-000000000001', 'weight', 70, 'kg');
insert into public.lab_reports (id, patient_id, file_path, status) values
  ('43000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'x/y.pdf', 'done');
insert into public.care_plans (id, patient_id, condition_id, status, plan_json) values
  ('44000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '42000000-0000-0000-0000-000000000001', 'draft', '{}'),
  ('44000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '42000000-0000-0000-0000-000000000001', 'approved', '{}');
insert into public.ai_runs (id, user_id, feature, status) values
  ('45000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'care_plan', 'needs_review'),
  ('45000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'care_plan', 'ok');
insert into public.emergency_requests (id, patient_id, lat, lng) values
  ('46000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 28.6, 77.2);
insert into public.drug_alerts (id, patient_id, medicine_name, title, url) values
  ('47000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Metformin', 'Recall', 'https://example.test/a');

-- number of rows an UPDATE touched under RLS (a blocked row is skipped silently, not an error)
create function public.tap_affected(q text) returns int language plpgsql as $$
declare n int;
begin
  execute 'with u as (' || q || ' returning 1) select count(*) from u' into n;
  return n;
end;
$$;

create function public.tap_login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- ----------------------------------------------------------------------------
-- Sign-up and roles
-- ----------------------------------------------------------------------------
select is(
  (select role from public.profiles where id = '10000000-0000-0000-0000-000000000001'),
  'patient', 'sign-up creates a patient profile');
select is(
  (select role from public.profiles where id = '10000000-0000-0000-0000-000000000003'),
  'doctor', 'sign-up with the doctor role creates a doctor profile');

insert into auth.users (id, email, raw_user_meta_data)
values ('10000000-0000-0000-0000-0000000000a1', 'sneaky@vyana.test', '{"role":"admin"}');
select is(
  (select role from public.profiles where id = '10000000-0000-0000-0000-0000000000a1'),
  'patient', 'sign-up with { role: "admin" } in metadata gives a patient');

select public.tap_login('10000000-0000-0000-0000-000000000001'); set local role authenticated;

select throws_ok(
  $$ update public.profiles set role = 'doctor' where id = '10000000-0000-0000-0000-000000000001' $$,
  'P0001', 'role can only be changed by an admin', 'a patient cannot change their own role');
select throws_ok(
  $$ update public.profiles set role = 'admin' where id = '10000000-0000-0000-0000-000000000001' $$,
  'P0001', 'role can only be changed by an admin', 'a patient cannot make themselves admin');
select throws_ok(
  $$ insert into public.profiles (id, role) values ('10000000-0000-0000-0000-0000000000b1', 'patient') $$,
  '42501', null, 'a patient cannot insert a profile for someone else');
select lives_ok(
  $$ update public.profiles set city = 'Delhi' where id = '10000000-0000-0000-0000-000000000001' $$,
  'a patient updates their own profile');
select is(
  (select count(*)::int from public.profiles where id = '10000000-0000-0000-0000-000000000002'),
  0, 'a patient cannot read another patient''s profile');

-- ----------------------------------------------------------------------------
-- Doctors
-- ----------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.doctors (id, specialization, reg_no, state_council)
     values ('10000000-0000-0000-0000-000000000001', 'Medicine', 'X', 'Delhi') $$,
  '42501', null, 'a patient cannot create a doctors row for themselves');

reset role;
insert into auth.users (id, email, raw_user_meta_data)
values ('10000000-0000-0000-0000-000000000008', 'd3@vyana.test', '{"role":"doctor"}');
select public.tap_login('10000000-0000-0000-0000-000000000008'); set local role authenticated;

select throws_ok(
  $$ insert into public.doctors (id, specialization, reg_no, state_council, verification_status)
     values ('10000000-0000-0000-0000-000000000008', 'Medicine', 'X', 'Delhi', 'verified') $$,
  'P0001', null, 'a doctor cannot insert a row that is already verified');
select throws_ok(
  $$ insert into public.doctors (id, specialization, reg_no, state_council, department_id)
     values ('10000000-0000-0000-0000-000000000008', 'Medicine', 'X', 'Delhi', '30000000-0000-0000-0000-000000000001') $$,
  'P0001', null, 'a doctor cannot pick their own department on insert');
select lives_ok(
  $$ insert into public.doctors (id, specialization, reg_no, state_council)
     values ('10000000-0000-0000-0000-000000000008', 'Medicine', 'X', 'Delhi') $$,
  'a doctor creates their own pending row');
select throws_ok(
  $$ update public.doctors set verification_status = 'verified' where id = '10000000-0000-0000-0000-000000000008' $$,
  'P0001', null, 'a doctor cannot verify themselves');
select throws_ok(
  $$ update public.doctors set department_id = '30000000-0000-0000-0000-000000000001' where id = '10000000-0000-0000-0000-000000000008' $$,
  'P0001', null, 'an unverified doctor cannot move into a department');

select public.tap_login('10000000-0000-0000-0000-000000000003');
select throws_ok(
  $$ update public.doctors set department_id = '30000000-0000-0000-0000-000000000002' where id = '10000000-0000-0000-0000-000000000003' $$,
  'P0001', null, 'a verified doctor cannot change their department');
select lives_ok(
  $$ update public.doctors set clinic_name = 'My Clinic' where id = '10000000-0000-0000-0000-000000000003' $$,
  'a doctor edits their own clinic details');

select public.tap_login('10000000-0000-0000-0000-000000000001');
select is(
  (select count(*)::int from public.doctors),
  1, 'a patient sees only verified doctors');

-- ----------------------------------------------------------------------------
-- Appointments: only book_appointment() creates them
-- ----------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.appointments (patient_id, hospital_id, department_id, appointment_date, token_no)
     values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', current_date, 99) $$,
  '42501', null, 'a patient cannot insert an appointment directly');

select public.tap_login('10000000-0000-0000-0000-000000000003');
select throws_ok(
  $$ insert into public.appointments (patient_id, hospital_id, department_id, appointment_date, token_no)
     values ('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', current_date, 98) $$,
  '42501', null, 'a doctor cannot insert an appointment for any patient');

select public.tap_login('10000000-0000-0000-0000-000000000001');
select is(
  (select (public.book_appointment('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', null, current_date + 1, 'checkup')).token_no),
  1, 'the first booking of a department and day gets token 1');
select is(
  (select (public.book_appointment('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', null, current_date + 1, 'again')).token_no),
  2, 'the second booking gets token 2');
select throws_ok(
  $$ select public.book_appointment('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', null, current_date - 1, 'x') $$,
  'P0001', 'date is in the past', 'booking a past date fails');
select throws_ok(
  format($$ select public.book_appointment('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', null, %L, 'x') $$,
         current_setting('t.tuesday')),
  'P0001', 'OPD is closed on that day', 'booking a day the OPD is closed fails');
select throws_ok(
  $$ select public.book_appointment('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', current_date + 1, 'x') $$,
  'P0001', 'doctor is not in this department', 'booking with an unverified doctor fails');
select lives_ok(
  $$ select public.book_appointment('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', null, current_date + 1, 'x') $$,
  'the last token of a department is bookable');

select public.tap_login('10000000-0000-0000-0000-000000000002');
select throws_ok(
  $$ select public.book_appointment('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', null, current_date + 1, 'x') $$,
  'P0001', 'no tokens left for that day', 'a full department refuses more tokens');
select lives_ok(
  format($$ select public.book_appointment('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', null, %L, 'rash') $$,
         current_setting('t.monday')),
  'patient B books the Skin department');

select public.tap_login('10000000-0000-0000-0000-000000000001');
select throws_ok(
  $$ update public.appointments set doctor_notes = 'all fine' where patient_id = '10000000-0000-0000-0000-000000000001' $$,
  'P0001', 'only the doctor can write notes', 'a patient cannot write doctor notes');
select throws_ok(
  $$ update public.appointments set patient_id = '10000000-0000-0000-0000-000000000002' where patient_id = '10000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'nobody can re-assign an appointment to another patient');
select is(
  (select count(*)::int from public.appointments where patient_id = '10000000-0000-0000-0000-000000000002'),
  0, 'a patient cannot read another patient''s appointments');
select lives_ok(
  $$ update public.appointments set status = 'cancelled' where token_no = 2 and department_id = '30000000-0000-0000-0000-000000000001' $$,
  'a patient cancels their own appointment');
select throws_ok(
  $$ update public.appointments set status = 'completed' where token_no = 1 and department_id = '30000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'a patient cannot mark an appointment completed');

-- ----------------------------------------------------------------------------
-- Doctors only see patients of their own (verified) department
-- ----------------------------------------------------------------------------
select public.tap_login('10000000-0000-0000-0000-000000000003');
select ok(
  (select count(*) from public.prescriptions where patient_id = '10000000-0000-0000-0000-000000000001') > 0,
  'a verified doctor reads the prescriptions of a patient in their department');
select ok(
  (select count(*) from public.conditions where patient_id = '10000000-0000-0000-0000-000000000001') > 0,
  'a verified doctor reads that patient''s conditions');
select is(
  (select count(*)::int from public.prescriptions where patient_id = '10000000-0000-0000-0000-000000000002'),
  0, 'a doctor does not read a patient of another department');
select is(
  (select count(*)::int from public.conditions where patient_id = '10000000-0000-0000-0000-000000000002'),
  0, 'a doctor does not read the Depression condition of a patient of another department');
select ok(
  (select count(*) from public.appointments where department_id = '30000000-0000-0000-0000-000000000001') > 0,
  'a verified doctor sees the queue of their department');

select public.tap_login('10000000-0000-0000-0000-000000000004');
select is(
  (select count(*)::int from public.appointments),
  0, 'an unverified doctor in the same department sees no appointments');
select is(
  (select count(*)::int from public.prescriptions),
  0, 'an unverified doctor reads no prescriptions');
select is(
  (select count(*)::int from public.profiles where id = '10000000-0000-0000-0000-000000000001'),
  0, 'an unverified doctor reads no patient profile');

-- ----------------------------------------------------------------------------
-- Patient data is private
-- ----------------------------------------------------------------------------
select public.tap_login('10000000-0000-0000-0000-000000000002');
select is(
  (select count(*)::int from public.prescriptions where patient_id = '10000000-0000-0000-0000-000000000001'),
  0, 'patient B cannot read the prescriptions of patient A');
select is(
  (select count(*)::int from public.prescription_items where patient_id = '10000000-0000-0000-0000-000000000001'),
  0, 'patient B cannot read the medicines of patient A');
select is(
  (select count(*)::int from public.lab_reports where patient_id = '10000000-0000-0000-0000-000000000001'),
  0, 'patient B cannot read the lab reports of patient A');
select is(
  (select count(*)::int from public.ai_runs where user_id = '10000000-0000-0000-0000-000000000001'),
  0, 'patient B cannot read the AI runs of patient A');
select throws_ok(
  $$ insert into public.prescriptions (patient_id, source) values ('10000000-0000-0000-0000-000000000001', 'upload') $$,
  '42501', null, 'patient B cannot add a prescription to patient A');
select throws_ok(
  $$ insert into public.prescriptions (patient_id, source) values ('10000000-0000-0000-0000-000000000002', 'doctor') $$,
  '42501', null, 'a patient cannot create a prescription with the source "doctor"');
select throws_ok(
  $$ insert into public.prescription_items (prescription_id, patient_id, medicine_name, frequency)
     values ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'Junk', 'OD') $$,
  '42501', null, 'a medicine cannot be added to the prescription of another patient');
select throws_ok(
  $$ insert into public.dose_logs (patient_id, item_id, scheduled_for, status)
     values ('10000000-0000-0000-0000-000000000002', '41000000-0000-0000-0000-000000000001', now(), 'taken') $$,
  '42501', null, 'a dose of another patient''s medicine cannot be logged');
select throws_ok(
  $$ insert into public.conditions (patient_id, name, source) values ('10000000-0000-0000-0000-000000000002', 'Flu', 'doctor') $$,
  '42501', null, 'a patient cannot claim a condition was diagnosed by a doctor');
select throws_ok(
  $$ update public.conditions set diagnosed_by = '10000000-0000-0000-0000-000000000003' where patient_id = '10000000-0000-0000-0000-000000000002' $$,
  '42501', null, 'a patient cannot edit who diagnosed them');

select public.tap_login('10000000-0000-0000-0000-000000000001');
select throws_ok(
  $$ update public.prescription_items set medicine_name = 'Changed' where id = '41000000-0000-0000-0000-000000000002' $$,
  'P0001', null, 'a patient cannot edit a medicine from a doctor''s prescription');
select lives_ok(
  $$ update public.prescription_items set active = false where id = '41000000-0000-0000-0000-000000000002' $$,
  'a patient can switch a doctor-prescribed medicine off');
select lives_ok(
  $$ update public.prescription_items set strength = '500 mg' where id = '41000000-0000-0000-0000-000000000001' $$,
  'a patient edits a medicine from their own upload');

-- ----------------------------------------------------------------------------
-- Care plans: a patient sees only reviewed or self-generated plans
-- ----------------------------------------------------------------------------
select is(
  (select count(*)::int from public.care_plans where status = 'draft'),
  0, 'the patient does not see an unreviewed AI draft');
select is(
  (select count(*)::int from public.care_plans where status = 'approved'),
  1, 'the patient sees the approved plan');
select is(
  public.tap_affected($$ update public.care_plans set status = 'approved' where id = '44000000-0000-0000-0000-000000000001' $$),
  0, 'a patient cannot approve their own plan');
select throws_ok(
  $$ insert into public.care_plans (patient_id, condition_id, status, plan_json)
     values ('10000000-0000-0000-0000-000000000001', '42000000-0000-0000-0000-000000000001', 'approved', '{}') $$,
  '42501', null, 'a patient cannot insert a care plan');

select public.tap_login('10000000-0000-0000-0000-000000000004');
select is(
  public.tap_affected($$ update public.care_plans set status = 'approved' where id = '44000000-0000-0000-0000-000000000001' $$),
  0, 'an unverified doctor cannot approve a care plan');

select public.tap_login('10000000-0000-0000-0000-000000000003');
select throws_ok(
  $$ update public.care_plans set status = 'approved', reviewed_by = '10000000-0000-0000-0000-000000000004'
     where id = '44000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'a doctor cannot sign a review as another doctor');
select is(
  public.tap_affected($$ update public.care_plans set status = 'approved', reviewed_by = '10000000-0000-0000-0000-000000000003', reviewed_at = now()
              where id = '44000000-0000-0000-0000-000000000001' $$),
  1, 'a verified doctor of the patient approves the draft');

-- ----------------------------------------------------------------------------
-- Caregiver mode
-- ----------------------------------------------------------------------------
select public.tap_login('10000000-0000-0000-0000-000000000001');
select ok(
  (select public.create_care_invite()) ~ '^[0-9]{6}$',
  'create_care_invite returns a 6-digit code (pgcrypto resolves on hosted Supabase)');
select throws_ok(
  $$ insert into public.care_invites (code, patient_id, expires_at)
     values ('123456', '10000000-0000-0000-0000-000000000001', now() + interval '10 years') $$,
  '42501', null, 'a patient cannot insert an invite with their own code and expiry');
select throws_ok(
  $$ select public.accept_care_invite((select code from public.care_invites limit 1)) $$,
  'P0001', 'you cannot be your own caregiver', 'a patient cannot accept their own invite');

-- fixed invites for the next checks
reset role;
insert into public.care_invites (code, patient_id, expires_at) values
  ('111111', '10000000-0000-0000-0000-000000000001', now() + interval '1 hour'),
  ('222222', '10000000-0000-0000-0000-000000000001', now() - interval '1 hour');

select public.tap_login('10000000-0000-0000-0000-000000000006'); set local role authenticated;
select is(
  (select public.accept_care_invite('222222') is null),
  true, 'an expired code returns null');
select is(
  (select public.accept_care_invite('000000') is null),
  true, 'a wrong code returns null');
select lives_ok(
  $$ select public.accept_care_invite('000001'); select public.accept_care_invite('000002') $$,
  'wrong codes keep returning null');
select is(
  (select public.accept_care_invite('000004') is null),
  true, 'the fifth wrong code still returns null');
select throws_ok(
  $$ select public.accept_care_invite('000005') $$,
  'P0001', 'too many attempts, try again in 15 minutes', 'after 5 wrong codes the sixth try is blocked');
select throws_ok(
  $$ select public.accept_care_invite('111111') $$,
  'P0001', 'too many attempts, try again in 15 minutes', 'even the right code is blocked while rate limited');

select public.tap_login('10000000-0000-0000-0000-000000000005');
select is(
  (select (public.accept_care_invite('111111', 'Daughter')).status),
  'active', 'the caregiver accepts a valid code');
select is(
  (select public.accept_care_invite('111111') is null),
  true, 'a code can be used only once');

select ok(
  (select count(*) from public.prescriptions where patient_id = '10000000-0000-0000-0000-000000000001') > 0,
  'the caregiver reads the patient''s prescriptions');
select is(
  (select count(*)::int from public.care_plans where status = 'approved'),
  2, 'the caregiver reads the approved care plans, not drafts');
select is(
  (select count(*)::int from public.care_plans where status = 'draft'),
  0, 'the caregiver does not read a draft care plan');
select is(
  (select count(*)::int from public.vitals where patient_id = '10000000-0000-0000-0000-000000000001'),
  0, 'the caregiver does not read vitals (not part of caregiver access)');
select is(
  public.tap_affected($$ update public.prescriptions set notes = 'x' where patient_id = '10000000-0000-0000-0000-000000000001' $$),
  0, 'a caregiver can read but not update prescriptions');
select throws_ok(
  $$ insert into public.dose_logs (patient_id, item_id, scheduled_for, status)
     values ('10000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', now(), 'taken') $$,
  '42501', null, 'a caregiver cannot log doses for the patient');

select public.tap_login('10000000-0000-0000-0000-000000000001');
select lives_ok(
  $$ update public.care_links set status = 'revoked' where caregiver_id = '10000000-0000-0000-0000-000000000005' $$,
  'the patient revokes the caregiver');

select public.tap_login('10000000-0000-0000-0000-000000000005');
select is(
  public.tap_affected($$ update public.care_links set status = 'active' where caregiver_id = '10000000-0000-0000-0000-000000000005' $$),
  0, 'a revoked caregiver cannot switch their link back on');
select is(
  (select count(*)::int from public.prescriptions where patient_id = '10000000-0000-0000-0000-000000000001'),
  0, 'a revoked caregiver reads nothing');

-- ----------------------------------------------------------------------------
-- Share links, AI runs, consents, emergency, alerts
-- ----------------------------------------------------------------------------
select public.tap_login('10000000-0000-0000-0000-000000000001');
select lives_ok(
  $$ insert into public.share_links (patient_id, kind, expires_at)
     values ('10000000-0000-0000-0000-000000000001', 'medical_id', now() + interval '1 day') $$,
  'a patient creates a share link');
select ok(
  (select token ~ '^[0-9a-f]{48}$' from public.share_links limit 1),
  'the database generates a 48-character token');
select throws_ok(
  $$ insert into public.share_links (patient_id, kind, expires_at, token)
     values ('10000000-0000-0000-0000-000000000001', 'medical_id', now() + interval '1 day', 'guessable') $$,
  '42501', null, 'a patient cannot choose the token');

select public.tap_login('10000000-0000-0000-0000-000000000002');
select is(
  (select count(*)::int from public.share_links),
  0, 'another patient cannot list the share links');

select public.tap_login('10000000-0000-0000-0000-000000000001');
select is(
  (select count(*)::int from public.ai_runs),
  1, 'a patient reads only their own AI runs');
select lives_ok(
  $$ update public.ai_runs set status = 'reported' where id = '45000000-0000-0000-0000-000000000001' $$,
  'a patient reports a mistake on their own AI run');
select throws_ok(
  $$ update public.ai_runs set status = 'ok' where id = '45000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'a patient can only set the status to reported');
select throws_ok(
  $$ update public.ai_runs set output_json = '{}' where id = '45000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'a patient cannot edit the output of an AI run');
select throws_ok(
  $$ insert into public.ai_runs (user_id, feature) values ('10000000-0000-0000-0000-000000000001', 'x') $$,
  '42501', null, 'AI runs are written by the server only');

select lives_ok(
  $$ insert into public.consents (user_id, version) values ('10000000-0000-0000-0000-000000000001', '2026-10-11') $$,
  'a patient records their consent');
select throws_ok(
  $$ insert into public.consents (user_id, version) values ('10000000-0000-0000-0000-000000000001', '2026-10-11') $$,
  '23505', null, 'the same consent version is recorded once');
select throws_ok(
  $$ insert into public.consents (user_id, version) values ('10000000-0000-0000-0000-000000000002', '2026-10-11') $$,
  '42501', null, 'a patient cannot record consent for someone else');

select lives_ok(
  $$ update public.emergency_requests set status = 'cancelled' where id = '46000000-0000-0000-0000-000000000001' $$,
  'a patient cancels their emergency request');
select throws_ok(
  $$ update public.emergency_requests set lat = 1 where id = '46000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'a patient cannot edit the location of a request');
select lives_ok(
  $$ update public.drug_alerts set seen = true where id = '47000000-0000-0000-0000-000000000001' $$,
  'a patient marks a drug alert as seen');
select throws_ok(
  $$ update public.drug_alerts set url = 'https://evil.test' where id = '47000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'a patient cannot rewrite a drug alert link');

-- ----------------------------------------------------------------------------
-- Server-only tables and signed-out visitors
-- ----------------------------------------------------------------------------
select throws_ok($$ select * from public.web_cache $$, '42501', null, 'web_cache is server only');
select throws_ok($$ select * from public.tinyfish_monitors $$, '42501', null, 'tinyfish_monitors is server only');
select throws_ok($$ select * from public.missed_dose_alerts $$, '42501', null, 'missed_dose_alerts is server only');
select throws_ok($$ select * from public.care_invite_attempts $$, '42501', null, 'care_invite_attempts is server only');
select ok((select count(*) from public.hospitals) > 0, 'a signed-in user reads the hospital list');

reset role;
set local role anon;
select throws_ok($$ select * from public.hospitals $$, '42501', null, 'a signed-out visitor reads no hospitals');
select throws_ok($$ select * from public.profiles $$, '42501', null, 'a signed-out visitor reads no profiles');
select throws_ok(
  $$ select public.book_appointment('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', null, current_date + 1, 'x') $$,
  '42501', null, 'a signed-out visitor cannot book');
reset role;

insert into public.missed_dose_alerts (item_id, scheduled_for) values ('41000000-0000-0000-0000-000000000001', '2026-01-01 09:00+00');
select throws_ok(
  $$ insert into public.missed_dose_alerts (item_id, scheduled_for) values ('41000000-0000-0000-0000-000000000001', '2026-01-01 09:00+00') $$,
  '23505', null, 'the cron cannot alert twice for the same missed dose');

select * from finish();
rollback;
