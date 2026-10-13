-- supabase/tests/database/meal_logs.test.sql
-- The meal log: who may read and write it, and its limits. Run with: supabase test db
-- Owner: Vaibhav Parmar

begin;
create extension if not exists pgtap with schema extensions;

select plan(18);

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
create function public.tap_affected(q text) returns int language plpgsql as $$
declare n int;
begin
  execute 'with u as (' || q || ' returning 1) select count(*) from u' into n;
  return n;
end;
$$;

-- ----------------------------------------------------------------------------
-- Patient A logs meals
-- ----------------------------------------------------------------------------
select public.tap_login('10000000-0000-0000-0000-000000000001'); set local role authenticated;

select lives_ok(
  $$ insert into public.meal_logs (patient_id, meal, description, calories) values ('10000000-0000-0000-0000-000000000001', 'breakfast', 'Poha and tea', 310) $$,
  'a patient logs a meal');
select lives_ok(
  $$ insert into public.meal_logs (patient_id, meal, description) values ('10000000-0000-0000-0000-000000000001', 'snack', 'A banana') $$,
  'calories are optional');
select lives_ok(
  $$ insert into public.meal_logs (patient_id, meal, description, calories) values ('10000000-0000-0000-0000-000000000001', 'lunch', 'Fasting day, only water', 0) $$,
  'and 0 is allowed');
select throws_ok(
  $$ insert into public.meal_logs (patient_id, meal, description) values ('10000000-0000-0000-0000-000000000002', 'lunch', 'For someone else') $$,
  '42501', null, 'a patient cannot log a meal for somebody else');
select throws_ok(
  $$ insert into public.meal_logs (patient_id, meal, description) values ('10000000-0000-0000-0000-000000000001', 'brunch', 'Not a meal type') $$,
  '23514', null, 'only breakfast, lunch, dinner and snack');

-- limits
select throws_ok(
  $$ insert into public.meal_logs (patient_id, meal, description, calories) values ('10000000-0000-0000-0000-000000000001', 'dinner', 'Typo', 3000000) $$,
  '23514', null, 'a typo of 3000000 calories is refused');
select throws_ok(
  $$ insert into public.meal_logs (patient_id, meal, description, calories) values ('10000000-0000-0000-0000-000000000001', 'dinner', 'Negative', -5) $$,
  '23514', null, 'negative calories are refused');
select throws_ok(
  $$ insert into public.meal_logs (patient_id, meal, description) values ('10000000-0000-0000-0000-000000000001', 'dinner', '   ') $$,
  '23514', null, 'a meal needs a description');
select throws_ok(
  $$ insert into public.meal_logs (patient_id, meal, description) values ('10000000-0000-0000-0000-000000000001', 'dinner', repeat('x', 201)) $$,
  '23514', null, 'and at most 200 characters');
select lives_ok(
  $$ insert into public.meal_logs (patient_id, meal, description, calories) values ('10000000-0000-0000-0000-000000000001', 'dinner', repeat('x', 200), 5000) $$,
  'the limits themselves are allowed');
select throws_ok(
  $$ update public.meal_logs set calories = 9000 where meal = 'breakfast' $$,
  '23514', null, 'an edit cannot go past the limit either');

-- ----------------------------------------------------------------------------
-- Who reads and removes them
-- ----------------------------------------------------------------------------
select is((select count(*)::int from public.meal_logs), 4, 'patient A reads their four meals');

select public.tap_login('10000000-0000-0000-0000-000000000002');
select is((select count(*)::int from public.meal_logs), 0, 'patient B reads none of them');
select is(public.tap_affected('delete from public.meal_logs'), 0, 'and cannot delete them');
select public.tap_login('10000000-0000-0000-0000-000000000003');
select is((select count(*)::int from public.meal_logs), 4, 'the doctor of patient A reads them');
select public.tap_login('10000000-0000-0000-0000-000000000004');
select is((select count(*)::int from public.meal_logs), 0, 'a doctor without that patient reads none');

select public.tap_login('10000000-0000-0000-0000-000000000001');
select lives_ok($$ delete from public.meal_logs where meal = 'snack' $$, 'patient A removes a wrong entry');
select is((select count(*)::int from public.meal_logs), 3, 'it is gone');

select * from finish();
rollback;
