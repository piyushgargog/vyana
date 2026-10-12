-- supabase/tests/database/diagnosis_condition.test.sql
-- V12: a doctor's e-prescription with a diagnosis creates the patient's condition. Run with: supabase test db
-- Owner: Vaibhav Parmar

begin;
create extension if not exists pgtap with schema extensions;

select plan(24);

-- ----------------------------------------------------------------------------
-- Fixtures (as the table owner)
-- ----------------------------------------------------------------------------
-- 1 patient A · 2 patient B (other department) · 3 verified doctor D1 (Medicine)

insert into auth.users (id, email, raw_user_meta_data) values
  ('10000000-0000-0000-0000-000000000001', 'a@vyana.test', '{"full_name":"Patient A"}'),
  ('10000000-0000-0000-0000-000000000002', 'b@vyana.test', '{"full_name":"Patient B"}'),
  ('10000000-0000-0000-0000-000000000003', 'd1@vyana.test', '{"full_name":"Dr One","role":"doctor"}');

insert into public.hospitals (id, name, kind) values ('20000000-0000-0000-0000-000000000001', 'Test Hospital', 'government');
insert into public.departments (id, hospital_id, name) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Medicine'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Skin');
insert into public.doctors (id, specialization, reg_no, state_council, verification_status, hospital_id, department_id) values
  ('10000000-0000-0000-0000-000000000003', 'Physician', 'T-1', 'Delhi', 'verified',
   '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001');

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

-- patient A books the Medicine queue, so D1 treats them
select public.tap_login('10000000-0000-0000-0000-000000000001'); set local role authenticated;
select lives_ok(
  $$ select public.book_appointment('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', null, current_date + 1, 'sugar') $$,
  'patient A books the Medicine queue');

-- ----------------------------------------------------------------------------
-- An e-Rx with a diagnosis creates exactly one condition
-- ----------------------------------------------------------------------------
select public.tap_login('10000000-0000-0000-0000-000000000003');
select set_config('t.rx', public.create_doctor_prescription(
  '10000000-0000-0000-0000-000000000001', null, 'Type 2 Diabetes', null,
  '[{"medicine_name":"Metformin","frequency":"BD"}]'::jsonb)::text, true);

select is(
  (select count(*)::int from public.conditions where prescription_id = current_setting('t.rx')::uuid),
  1, 'an e-Rx with a diagnosis creates exactly one condition');
select is(
  (select name from public.conditions where prescription_id = current_setting('t.rx')::uuid),
  'Type 2 Diabetes', 'named after the diagnosis');
select is(
  (select source from public.conditions where prescription_id = current_setting('t.rx')::uuid),
  'doctor', 'with the source doctor');
select is(
  (select diagnosed_by from public.conditions where prescription_id = current_setting('t.rx')::uuid),
  '10000000-0000-0000-0000-000000000003'::uuid, 'diagnosed by the prescribing doctor');
select is(
  (select patient_id from public.conditions where prescription_id = current_setting('t.rx')::uuid),
  '10000000-0000-0000-0000-000000000001'::uuid, 'for the patient of the prescription');
select is(
  (select diagnosed_on from public.conditions where prescription_id = current_setting('t.rx')::uuid),
  current_date, 'on the day the prescription was issued');
select ok(
  (select count(*) from public.conditions where prescription_id = current_setting('t.rx')::uuid and active) = 1,
  'and it is active');

-- ----------------------------------------------------------------------------
-- Editing the diagnosis updates that row
-- ----------------------------------------------------------------------------
select is(
  public.tap_affected(format($$ update public.prescriptions set diagnosis = 'Type 2 Diabetes Mellitus' where id = %L $$, current_setting('t.rx'))),
  1, 'the doctor edits the diagnosis');
select is(
  (select count(*)::int from public.conditions where prescription_id = current_setting('t.rx')::uuid),
  1, 'there is still exactly one condition');
select is(
  (select name from public.conditions where prescription_id = current_setting('t.rx')::uuid),
  'Type 2 Diabetes Mellitus', 'and its name follows the edit');

select lives_ok(
  format($$ update public.prescriptions set diagnosis = null where id = %L $$, current_setting('t.rx')),
  'the doctor clears the diagnosis');
select is(
  (select name from public.conditions where prescription_id = current_setting('t.rx')::uuid),
  'Type 2 Diabetes Mellitus', 'the condition stays (a care plan may already depend on it)');

-- ----------------------------------------------------------------------------
-- No diagnosis, no condition; a patient's upload never creates one
-- ----------------------------------------------------------------------------
select set_config('t.rx2', public.create_doctor_prescription(
  '10000000-0000-0000-0000-000000000001', null, '   ', null,
  '[{"medicine_name":"Paracetamol","frequency":"SOS"}]'::jsonb)::text, true);
select is(
  (select count(*)::int from public.conditions where prescription_id = current_setting('t.rx2')::uuid),
  0, 'a blank diagnosis creates no condition');
select is(
  public.tap_affected(format($$ update public.prescriptions set diagnosis = '  Hypertension ' where id = %L $$, current_setting('t.rx2'))),
  1, 'a diagnosis added later');
select is(
  (select name from public.conditions where prescription_id = current_setting('t.rx2')::uuid),
  'Hypertension', 'creates the condition then, with the spaces trimmed');

select public.tap_login('10000000-0000-0000-0000-000000000001');
select lives_ok(
  $$ insert into public.prescriptions (id, patient_id, source, diagnosis)
     values ('40000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-000000000001', 'upload', 'Asthma') $$,
  'the patient uploads their own prescription that mentions a diagnosis');
select is(
  (select count(*)::int from public.conditions where prescription_id = '40000000-0000-0000-0000-0000000000a1'),
  0, 'an upload creates no condition');

-- ----------------------------------------------------------------------------
-- Who can see it, and what is still not allowed
-- ----------------------------------------------------------------------------
select is(
  (select count(*)::int from public.conditions where source = 'doctor'),
  2, 'the patient sees the conditions their doctor recorded');

select throws_ok(
  $$ insert into public.conditions (patient_id, name, source) values ('10000000-0000-0000-0000-000000000001', 'Forged', 'doctor') $$,
  '42501', null, 'a patient still cannot claim a doctor diagnosed them');

select public.tap_login('10000000-0000-0000-0000-000000000003');
select throws_ok(
  $$ insert into public.conditions (patient_id, name, source, diagnosed_by)
     values ('10000000-0000-0000-0000-000000000001', 'By hand', 'doctor', '10000000-0000-0000-0000-000000000003') $$,
  '42501', null, 'a doctor still cannot insert a condition directly');
select throws_ok(
  $$ select public.create_doctor_prescription('10000000-0000-0000-0000-000000000002', null, 'Depression', null, '[{"medicine_name":"x","frequency":"OD"}]'::jsonb) $$,
  '42501', null, 'a doctor cannot create one for a patient outside their department either');
select is(
  (select count(*)::int from public.conditions where name = 'Depression'),
  0, 'and the refused prescription left no condition behind');

-- ----------------------------------------------------------------------------
-- The database itself keeps it to one per prescription
-- ----------------------------------------------------------------------------
reset role;
select throws_ok(
  format($$ insert into public.conditions (patient_id, name, source, prescription_id)
           values ('10000000-0000-0000-0000-000000000001', 'Duplicate', 'doctor', %L) $$, current_setting('t.rx')),
  '23505', null, 'a second doctor condition for the same prescription is refused');

select * from finish();
rollback;
