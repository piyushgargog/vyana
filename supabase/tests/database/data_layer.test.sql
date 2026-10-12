-- supabase/tests/database/data_layer.test.sql
-- The functions of 0005_data_layer.sql: names, tokens left, the e-Rx in one transaction, the AI mistake
-- note and the dose log check. Run with: supabase test db
-- Owner: Vaibhav Parmar

begin;
create extension if not exists pgtap with schema extensions;

select plan(47);

-- ----------------------------------------------------------------------------
-- Fixtures (as the table owner)
-- ----------------------------------------------------------------------------
-- 1 patient A · 2 patient B · 3 verified doctor D1 (Medicine) · 4 pending doctor D2 (Medicine) · 5 caregiver C

insert into auth.users (id, email, raw_user_meta_data) values
  ('10000000-0000-0000-0000-000000000001', 'a@vyana.test', '{"full_name":"Patient A"}'),
  ('10000000-0000-0000-0000-000000000002', 'b@vyana.test', '{"full_name":"Patient B"}'),
  ('10000000-0000-0000-0000-000000000003', 'd1@vyana.test', '{"full_name":"Dr Verified","role":"doctor"}'),
  ('10000000-0000-0000-0000-000000000004', 'd2@vyana.test', '{"full_name":"Dr Pending","role":"doctor"}'),
  ('10000000-0000-0000-0000-000000000005', 'c@vyana.test', '{"full_name":"Caregiver C"}');
update public.profiles
  set phone = '+91 00000 00099', dob = '1995-03-22', allergies = '{Sulfa}'
  where id = '10000000-0000-0000-0000-000000000005';

insert into public.hospitals (id, name, kind) values ('20000000-0000-0000-0000-000000000001', 'Test Hospital', 'government');
insert into public.departments (id, hospital_id, name, opd_days, daily_token_limit) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Medicine', '{1,2,3,4,5,6,7}', 3),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Skin', '{1}', 50);
insert into public.doctors (id, specialization, reg_no, state_council, verification_status, verification_json, hospital_id, department_id) values
  ('10000000-0000-0000-0000-000000000003', 'Physician', 'T-1', 'Delhi', 'verified', '{"secret":"evidence"}',
   '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000004', 'Dermatologist', 'T-2', 'Delhi', 'pending', null,
   '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001');
insert into public.care_links (patient_id, caregiver_id, relation) values
  ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', 'Daughter');

insert into public.prescriptions (id, patient_id, source) values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'upload'),
  ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'upload');
insert into public.prescription_items (id, prescription_id, patient_id, medicine_name, frequency) values
  ('41000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Metformin', 'BD'),
  ('41000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Amlodipine', 'OD');
insert into public.dose_logs (id, patient_id, item_id, scheduled_for, status) values
  ('42000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', now(), 'taken');
insert into public.ai_runs (id, user_id, feature, status) values
  ('45000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'care_plan', 'needs_review');

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

select public.tap_login('10000000-0000-0000-0000-000000000001'); set local role authenticated;

-- ----------------------------------------------------------------------------
-- doctor_directory: verified doctors with names, public fields only
-- ----------------------------------------------------------------------------
select is(
  (select full_name from public.doctor_directory() where specialization = 'Physician'),
  'Dr Verified', 'a patient lists verified doctors with their name');
select is((select count(*)::int from public.doctor_directory()), 1, 'an unverified doctor is not listed');
select is(
  (select count(*)::int from public.doctor_directory(p_department => '30000000-0000-0000-0000-000000000001')),
  1, 'the list can be filtered by department');
select is(
  (select count(*)::int from public.doctor_directory(p_hospital => '20000000-0000-0000-0000-00000000dead')),
  0, 'and by hospital');
select is(
  (select count(*)::int from public.doctor_directory('10000000-0000-0000-0000-000000000004')),
  0, 'a pending doctor cannot be fetched by id either');
select ok(
  pg_get_function_result('public.doctor_directory(uuid,uuid,uuid)'::regprocedure) !~ 'verification_json|phone|dob',
  'the directory returns no evidence or contact columns');

-- ----------------------------------------------------------------------------
-- my_caregivers: who looks after me, and nothing else about them
-- ----------------------------------------------------------------------------
select is((select full_name from public.my_caregivers()), 'Caregiver C', 'a patient sees the name of their caregiver');
select is((select relation from public.my_caregivers()), 'Daughter', 'and the relation');
select is((select status from public.my_caregivers()), 'active', 'and whether the link is active');
select is(
  (select count(*)::int from public.profiles where id = '10000000-0000-0000-0000-000000000005'),
  0, 'but the caregiver''s profile (phone, dob, allergies) stays private');
select throws_ok(
  $$ select phone from public.my_caregivers() $$,
  '42703', null, 'my_caregivers has no phone column');
select ok(
  pg_get_function_result('public.my_caregivers()'::regprocedure) !~ 'phone|dob|allergies|blood_group',
  'my_caregivers returns no health or contact fields');

select public.tap_login('10000000-0000-0000-0000-000000000002');
select is((select count(*)::int from public.my_caregivers()), 0, 'another patient sees none of those links');

select public.tap_login('10000000-0000-0000-0000-000000000005');
select is((select count(*)::int from public.my_caregivers()), 0, 'a caregiver is not a patient of anyone, so the list is empty');

-- ----------------------------------------------------------------------------
-- department_tokens: a count, not other people's rows
-- ----------------------------------------------------------------------------
select public.tap_login('10000000-0000-0000-0000-000000000001');
select set_config('t.day', (current_date + 2)::text, true);

select is(
  (select tokens_left from public.department_tokens('30000000-0000-0000-0000-000000000001', current_setting('t.day')::date)),
  3, 'all tokens are free at first');
select is(
  (select opd_open from public.department_tokens('30000000-0000-0000-0000-000000000001', current_setting('t.day')::date)),
  true, 'the OPD is open on a future day');
select is(
  (select opd_open from public.department_tokens('30000000-0000-0000-0000-000000000001', current_date - 1)),
  false, 'but not for a day in the past');
select is(
  (select opd_open from public.department_tokens('30000000-0000-0000-0000-000000000002', (select (current_date + g) from generate_series(1, 7) g where extract(isodow from current_date + g) = 2)::date)),
  false, 'nor on a day the department is closed');

select lives_ok(
  $$ select public.book_appointment('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', null, current_setting('t.day')::date, 'checkup') $$,
  'patient A books a token');
select public.tap_login('10000000-0000-0000-0000-000000000002');
select is(
  (select tokens_left from public.department_tokens('30000000-0000-0000-0000-000000000001', current_setting('t.day')::date)),
  2, 'patient B sees one token less, without seeing the appointment');
select is((select count(*)::int from public.appointments), 0, 'B still cannot read A''s appointment');

select public.tap_login('10000000-0000-0000-0000-000000000001');
select lives_ok($$ update public.appointments set status = 'cancelled' where patient_id = '10000000-0000-0000-0000-000000000001' $$, 'A cancels it');
select is(
  (select tokens_left from public.department_tokens('30000000-0000-0000-0000-000000000001', current_setting('t.day')::date)),
  3, 'a cancelled token is free again');
select is(
  (select count(*)::int from public.department_tokens('30000000-0000-0000-0000-00000000dead', current_setting('t.day')::date)),
  0, 'an unknown department gives no row');

-- A needs an appointment in Medicine for D1 to prescribe: book one again
select lives_ok(
  $$ select public.book_appointment('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', null, current_setting('t.day')::date, 'again') $$,
  'A books again so the doctor can treat them');

-- ----------------------------------------------------------------------------
-- create_doctor_prescription: all or nothing, under the doctor's own rights
-- ----------------------------------------------------------------------------
select public.tap_login('10000000-0000-0000-0000-000000000003');
select ok(
  (select public.create_doctor_prescription(
     '10000000-0000-0000-0000-000000000001', null, 'Type 2 Diabetes', 'after food',
     '[{"medicine_name":"Metformin","frequency":"BD","times":["09:00","21:00"],"dose":"1 tablet","quantity_total":30},
       {"medicine_name":"Telmisartan","frequency":"OD","strength":"40 mg"}]'::jsonb)) is not null,
  'a doctor writes an e-Rx for a patient of their department and gets its id');
select is(
  (select count(*)::int from public.prescriptions where source = 'doctor' and doctor_id = auth.uid() and diagnosis = 'Type 2 Diabetes'),
  1, 'the prescription is in the doctor''s name');
select is(
  (select count(*)::int from public.prescription_items i join public.prescriptions p on p.id = i.prescription_id where p.source = 'doctor'),
  2, 'with both medicines');
select is(
  (select refill_alert_days from public.prescription_items where medicine_name = 'Telmisartan'),
  3, 'missing fields get the column defaults (refill alert 3 days)');
select is(
  (select quantity_total from public.prescription_items where medicine_name = 'Metformin' and prescription_id <> '40000000-0000-0000-0000-000000000001'),
  30::numeric, 'and the given quantity is kept');

select throws_ok(
  $$ select public.create_doctor_prescription('10000000-0000-0000-0000-000000000001', null, 'x', null,
       '[{"medicine_name":"Fine","frequency":"OD"},{"medicine_name":"Broken","frequency":"WEEKLY"}]'::jsonb) $$,
  '23514', null, 'a bad second medicine fails the whole call');
select is(
  (select count(*)::int from public.prescriptions where source = 'doctor'),
  1, 'and the prescription row it had started is gone (one transaction)');
select throws_ok(
  $$ select public.create_doctor_prescription('10000000-0000-0000-0000-000000000001', null, 'x', null, '[]'::jsonb) $$,
  'P0001', 'a prescription needs at least one medicine', 'an empty list is refused');
select throws_ok(
  $$ select public.create_doctor_prescription('10000000-0000-0000-0000-000000000002', null, 'x', null, '[{"medicine_name":"A","frequency":"OD"}]'::jsonb) $$,
  '42501', null, 'a doctor cannot prescribe for a patient outside their department');

select public.tap_login('10000000-0000-0000-0000-000000000004');
select throws_ok(
  $$ select public.create_doctor_prescription('10000000-0000-0000-0000-000000000001', null, 'x', null, '[{"medicine_name":"A","frequency":"OD"}]'::jsonb) $$,
  '42501', null, 'an unverified doctor cannot prescribe');

select public.tap_login('10000000-0000-0000-0000-000000000001');
select throws_ok(
  $$ select public.create_doctor_prescription('10000000-0000-0000-0000-000000000001', null, 'x', null, '[{"medicine_name":"A","frequency":"OD"}]'::jsonb) $$,
  '42501', null, 'a patient cannot write an e-Rx for themselves');
select is(
  (select count(*)::int from public.prescription_items where medicine_name = 'Metformin' and prescription_id <> '40000000-0000-0000-0000-000000000001'),
  1, 'the patient sees the medicines the doctor prescribed');

-- ----------------------------------------------------------------------------
-- The note on a reported AI mistake
-- ----------------------------------------------------------------------------
select lives_ok(
  $$ update public.ai_runs set status = 'reported', report_note = 'The dose looks wrong' where id = '45000000-0000-0000-0000-000000000001' $$,
  'a patient reports a mistake with a note');
select is(
  (select report_note from public.ai_runs where id = '45000000-0000-0000-0000-000000000001'),
  'The dose looks wrong', 'and the note is stored');
select throws_ok(
  $$ update public.ai_runs set report_note = repeat('x', 1001) where id = '45000000-0000-0000-0000-000000000001' $$,
  '23514', null, 'a note over 1000 characters is refused');
select throws_ok(
  $$ update public.ai_runs set output_json = '{}' where id = '45000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'the note does not open the rest of the run for editing');

select public.tap_login('10000000-0000-0000-0000-000000000002');
select is(
  public.tap_affected($$ update public.ai_runs set status = 'reported', report_note = 'x' where id = '45000000-0000-0000-0000-000000000001' $$),
  0, 'another patient cannot report or annotate that run');

-- ----------------------------------------------------------------------------
-- A dose log stays on the patient's own medicine
-- ----------------------------------------------------------------------------
select public.tap_login('10000000-0000-0000-0000-000000000001');
select lives_ok(
  $$ update public.dose_logs set status = 'skipped' where id = '42000000-0000-0000-0000-000000000001' $$,
  'a patient changes the status of their own dose log');
select throws_ok(
  $$ update public.dose_logs set item_id = '41000000-0000-0000-0000-000000000002' where id = '42000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'but cannot point it at someone else''s medicine');

reset role;
set local role anon;
select throws_ok($$ select * from public.doctor_directory() $$, '42501', null, 'a signed-out visitor cannot list doctors');
select throws_ok($$ select * from public.my_caregivers() $$, '42501', null, 'nor read caregivers');
select throws_ok(
  $$ select * from public.department_tokens('30000000-0000-0000-0000-000000000001', current_date) $$,
  '42501', null, 'nor see tokens');

select * from finish();
rollback;
