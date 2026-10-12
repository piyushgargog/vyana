-- supabase/tests/database/directory.test.sql
-- Doctor names for patients and caregiver names for the patient. Run with: supabase test db
-- Owner: Vaibhav Parmar

begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

insert into auth.users (id, email, raw_user_meta_data) values
  ('10000000-0000-0000-0000-000000000001', 'a@vyana.test', '{"full_name":"Patient A"}'),
  ('10000000-0000-0000-0000-000000000002', 'b@vyana.test', '{"full_name":"Patient B"}'),
  ('10000000-0000-0000-0000-000000000003', 'd1@vyana.test', '{"full_name":"Dr Verified","role":"doctor"}'),
  ('10000000-0000-0000-0000-000000000004', 'd2@vyana.test', '{"full_name":"Dr Pending","role":"doctor"}'),
  ('10000000-0000-0000-0000-000000000005', 'c@vyana.test', '{"full_name":"Caregiver C"}');
update public.profiles set phone = '+91 00000 00099' where id = '10000000-0000-0000-0000-000000000003';

insert into public.hospitals (id, name, kind) values ('20000000-0000-0000-0000-000000000001', 'Test Hospital', 'government');
insert into public.departments (id, hospital_id, name) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Medicine');
insert into public.doctors (id, specialization, reg_no, state_council, verification_status, verification_json, hospital_id, department_id) values
  ('10000000-0000-0000-0000-000000000003', 'Physician', 'T-1', 'Delhi', 'verified', '{"secret":"evidence"}',
   '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000004', 'Dermatologist', 'T-2', 'Delhi', 'pending', null, null, null);
insert into public.care_links (patient_id, caregiver_id, relation) values
  ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', 'Daughter');

create function public.tap_login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select public.tap_login('10000000-0000-0000-0000-000000000001'); set local role authenticated;

select is(
  (select full_name from public.doctor_directory() where specialization = 'Physician'),
  'Dr Verified', 'a patient lists verified doctors with their name');
select is(
  (select count(*)::int from public.doctor_directory()),
  1, 'an unverified doctor is not listed');
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

select is(
  (select full_name from public.profiles where id = '10000000-0000-0000-0000-000000000005'),
  'Caregiver C', 'a patient reads the profile of their caregiver');

select public.tap_login('10000000-0000-0000-0000-000000000002');
select is(
  (select count(*)::int from public.profiles where id = '10000000-0000-0000-0000-000000000005'),
  0, 'another patient does not');

reset role;
set local role anon;
select throws_ok(
  $$ select * from public.doctor_directory() $$,
  '42501', null, 'a signed-out visitor cannot list doctors');

select * from finish();
rollback;
