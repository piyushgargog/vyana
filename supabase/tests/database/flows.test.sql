-- supabase/tests/database/flows.test.sql
-- The doctor, admin and caregiver flows of plan 5.2 and 5.6 end to end. Run with: supabase test db
-- Owner: Vaibhav Parmar

begin;
create extension if not exists pgtap with schema extensions;

select plan(33);

-- ----------------------------------------------------------------------------
-- Fixtures (as the table owner)
-- ----------------------------------------------------------------------------
-- 1 patient A · 2 patient B · 3 verified doctor D1 (Medicine) · 4 verified doctor D2 (Skin)
-- 5 caregiver C · 6 admin

insert into auth.users (id, email, raw_user_meta_data) values
  ('10000000-0000-0000-0000-000000000001', 'a@vyana.test', '{}'),
  ('10000000-0000-0000-0000-000000000002', 'b@vyana.test', '{}'),
  ('10000000-0000-0000-0000-000000000003', 'd1@vyana.test', '{"role":"doctor"}'),
  ('10000000-0000-0000-0000-000000000004', 'd2@vyana.test', '{"role":"doctor"}'),
  ('10000000-0000-0000-0000-000000000005', 'c@vyana.test', '{}'),
  ('10000000-0000-0000-0000-000000000006', 'admin@vyana.test', '{}');
update public.profiles set role = 'admin' where id = '10000000-0000-0000-0000-000000000006';

insert into public.hospitals (id, name, kind) values ('20000000-0000-0000-0000-000000000001', 'Test Hospital', 'government');
insert into public.departments (id, hospital_id, name) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Medicine'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Skin');
insert into public.doctors (id, specialization, reg_no, state_council, verification_status, hospital_id, department_id) values
  ('10000000-0000-0000-0000-000000000003', 'Physician', 'T-1', 'Delhi', 'verified',
   '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000004', 'Dermatologist', 'T-2', 'Delhi', 'verified',
   '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002');

insert into public.conditions (id, patient_id, name) values
  ('42000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Type 2 Diabetes');
insert into public.care_plans (id, patient_id, condition_id, status, plan_json) values
  ('44000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '42000000-0000-0000-0000-000000000001', 'draft', '{"v":1}');
insert into public.prescriptions (id, patient_id, source) values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'upload');
insert into public.care_links (id, patient_id, caregiver_id, relation) values
  ('48000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', 'Daughter');

create function public.tap_login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function public.tap_affected(q text) returns int language plpgsql as $$
declare n int;
begin
  execute 'with u as (' || q || ' returning 1) select count(*) from u' into n;
  return n;
end;
$$;

-- both patients book an OPD token: A in Medicine, B in Skin
select public.tap_login('10000000-0000-0000-0000-000000000001'); set local role authenticated;
select is(
  (select (public.book_appointment('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', null, current_date + 1, 'sugar check')).token_no),
  1, 'patient A books Medicine');
select public.tap_login('10000000-0000-0000-0000-000000000002');
select is(
  (select (public.book_appointment('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', null, current_date + 1, 'rash')).token_no),
  1, 'patient B books Skin');

-- ----------------------------------------------------------------------------
-- Appointments from the doctor's side
-- ----------------------------------------------------------------------------
select public.tap_login('10000000-0000-0000-0000-000000000003');
select is(
  public.tap_affected($$ update public.appointments set status = 'confirmed', doctor_notes = 'come fasting' where patient_id = '10000000-0000-0000-0000-000000000001' $$),
  1, 'a doctor of the department confirms an appointment and adds notes');
select is(
  public.tap_affected($$ update public.appointments set status = 'confirmed' where patient_id = '10000000-0000-0000-0000-000000000002' $$),
  0, 'a doctor cannot touch the queue of another department');
select throws_ok(
  $$ update public.appointments set token_no = 99 where patient_id = '10000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'nobody changes a token number');
select throws_ok(
  $$ update public.appointments set department_id = '30000000-0000-0000-0000-000000000002' where patient_id = '10000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'a doctor cannot move an appointment to another department');

-- ----------------------------------------------------------------------------
-- e-Rx: a doctor writes a prescription for a patient of their department
-- ----------------------------------------------------------------------------
select lives_ok(
  $$ insert into public.prescriptions (id, patient_id, doctor_id, source, diagnosis)
     values ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'doctor', 'Type 2 Diabetes') $$,
  'a doctor writes an e-Rx for their patient');
select lives_ok(
  $$ insert into public.prescription_items (prescription_id, patient_id, medicine_name, frequency)
     values ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Metformin', 'BD') $$,
  'the doctor adds a medicine to it');
select throws_ok(
  $$ insert into public.prescriptions (patient_id, doctor_id, source)
     values ('10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003', 'doctor') $$,
  '42501', null, 'a doctor cannot prescribe for a patient of another department');
select throws_ok(
  $$ insert into public.prescriptions (patient_id, doctor_id, source)
     values ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', 'doctor') $$,
  '42501', null, 'a doctor cannot write a prescription in another doctor''s name');
select throws_ok(
  $$ insert into public.prescription_items (prescription_id, patient_id, medicine_name, frequency)
     values ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Junk', 'OD') $$,
  '42501', null, 'a doctor cannot add medicines to the patient''s own upload');
select is(
  public.tap_affected($$ update public.prescriptions set notes = 'x' where id = '40000000-0000-0000-0000-000000000001' $$),
  0, 'a doctor cannot edit the patient''s own upload');
select is(
  public.tap_affected($$ update public.prescriptions set notes = 'take after food' where id = '40000000-0000-0000-0000-000000000002' $$),
  1, 'a doctor edits their own prescription');

select public.tap_login('10000000-0000-0000-0000-000000000004');
select is(
  (select count(*)::int from public.prescriptions where patient_id = '10000000-0000-0000-0000-000000000001'),
  0, 'a doctor of another department does not see the e-Rx');

select public.tap_login('10000000-0000-0000-0000-000000000001');
select is(
  (select count(*)::int from public.prescription_items where medicine_name = 'Metformin'),
  1, 'the patient sees the medicine the doctor prescribed');

-- ----------------------------------------------------------------------------
-- Care plan review
-- ----------------------------------------------------------------------------
select public.tap_login('10000000-0000-0000-0000-000000000003');
select is(
  public.tap_affected($$ update public.care_plans set plan_json = '{"v":2}' where id = '44000000-0000-0000-0000-000000000001' $$),
  1, 'the doctor edits the draft plan');
select throws_ok(
  $$ update public.care_plans set patient_id = '10000000-0000-0000-0000-000000000002' where id = '44000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'the doctor cannot move a plan to another patient');
select throws_ok(
  $$ update public.care_plans set status = 'patient_generated' where id = '44000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'the doctor cannot mark a plan as patient generated');

select public.tap_login('10000000-0000-0000-0000-000000000004');
select is(
  public.tap_affected($$ update public.care_plans set plan_json = '{"v":3}' where id = '44000000-0000-0000-0000-000000000001' $$),
  0, 'a doctor of another department cannot edit it');

select public.tap_login('10000000-0000-0000-0000-000000000001');
select is((select count(*)::int from public.care_plans), 0, 'the patient sees nothing while it is a draft');

select public.tap_login('10000000-0000-0000-0000-000000000003');
select is(
  public.tap_affected($$ update public.care_plans set status = 'approved', reviewed_by = '10000000-0000-0000-0000-000000000003', reviewed_at = now()
                        where id = '44000000-0000-0000-0000-000000000001' $$),
  1, 'the doctor approves the plan');

select public.tap_login('10000000-0000-0000-0000-000000000001');
select is(
  (select plan_json ->> 'v' from public.care_plans where status = 'approved'),
  '2', 'the patient sees the approved plan with the doctor''s edits');

-- ----------------------------------------------------------------------------
-- Caregiver leaves
-- ----------------------------------------------------------------------------
select public.tap_login('10000000-0000-0000-0000-000000000005');
select is(
  (select count(*)::int from public.care_plans), 1, 'the caregiver sees the approved plan');
select is(
  public.tap_affected($$ delete from public.care_links where id = '48000000-0000-0000-0000-000000000001' $$),
  1, 'the caregiver leaves by deleting their link');
select is(
  (select count(*)::int from public.care_plans), 0, 'a caregiver who left sees nothing');

-- ----------------------------------------------------------------------------
-- Share links
-- ----------------------------------------------------------------------------
select public.tap_login('10000000-0000-0000-0000-000000000001');
select lives_ok(
  $$ insert into public.share_links (patient_id, kind, expires_at)
     values ('10000000-0000-0000-0000-000000000001', 'timeline', now() + interval '1 day') $$,
  'a patient creates a timeline link');
select is(
  public.tap_affected($$ update public.share_links set revoked = true $$),
  1, 'the patient revokes it');
select throws_ok(
  $$ update public.share_links set patient_id = '10000000-0000-0000-0000-000000000002' $$,
  '42501', null, 'a link cannot be handed to another patient');

-- ----------------------------------------------------------------------------
-- Admin
-- ----------------------------------------------------------------------------
select public.tap_login('10000000-0000-0000-0000-000000000006');
select ok(
  (select count(*) from public.profiles) >= 6, 'an admin reads every profile');
select ok(
  (select count(*) from public.care_plans) >= 1 and (select count(*) from public.prescriptions) >= 2,
  'an admin reads care plans and prescriptions');
select lives_ok(
  $$ update public.profiles set role = 'doctor' where id = '10000000-0000-0000-0000-000000000002' $$,
  'an admin changes a role');
select lives_ok(
  $$ insert into public.hospitals (name, kind) values ('Added By Admin', 'private') $$,
  'an admin adds a hospital');

select public.tap_login('10000000-0000-0000-0000-000000000001');
select throws_ok(
  $$ insert into public.hospitals (name, kind) values ('Fake Hospital', 'private') $$,
  '42501', null, 'a patient cannot add a hospital');

select * from finish();
rollback;
