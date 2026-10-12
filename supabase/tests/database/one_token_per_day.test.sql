-- supabase/tests/database/one_token_per_day.test.sql
-- V13: at most one active OPD token per patient, department and day. Run with: supabase test db
-- Owner: Vaibhav Parmar

begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

insert into auth.users (id, email, raw_user_meta_data) values
  ('10000000-0000-0000-0000-000000000001', 'a@vyana.test', '{"full_name":"Patient A"}'),
  ('10000000-0000-0000-0000-000000000002', 'b@vyana.test', '{"full_name":"Patient B"}'),
  ('10000000-0000-0000-0000-000000000003', 'd1@vyana.test', '{"full_name":"Dr One","role":"doctor"}');

insert into public.hospitals (id, name, kind) values ('20000000-0000-0000-0000-000000000001', 'Test Hospital', 'government');
insert into public.departments (id, hospital_id, name, opd_days, daily_token_limit) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Medicine', '{1,2,3,4,5,6,7}', 3),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Skin', '{1,2,3,4,5,6,7}', 3);
insert into public.doctors (id, specialization, reg_no, state_council, verification_status, hospital_id, department_id) values
  ('10000000-0000-0000-0000-000000000003', 'Physician', 'T-1', 'Delhi', 'verified',
   '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001');

create function public.tap_login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select set_config('t.day', (current_date + 2)::text, true);
select set_config('t.next', (current_date + 3)::text, true);

select public.tap_login('10000000-0000-0000-0000-000000000001'); set local role authenticated;

-- ----------------------------------------------------------------------------
-- book, book again, cancel, book again, another department
-- ----------------------------------------------------------------------------
select is(
  (select (public.book_appointment('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', null, current_setting('t.day')::date, 'first')).token_no),
  1, 'the first booking gets token 1');

select throws_ok(
  $$ select public.book_appointment('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', null, current_setting('t.day')::date, 'again') $$,
  'P0001', 'you already have a token for this department on that day', 'booking the same department and day again is refused');
select throws_ok(
  $$ select public.book_appointment('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001',
       '10000000-0000-0000-0000-000000000003', current_setting('t.day')::date, 'with a doctor this time') $$,
  'P0001', 'you already have a token for this department on that day', 'also with a doctor chosen this time');
select is(
  (select count(*)::int from public.appointments where patient_id = auth.uid()),
  1, 'and no second row was created');

select is(
  (select (public.book_appointment('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', null, current_setting('t.day')::date, 'skin')).token_no),
  1, 'another department the same day still works');
select is(
  (select (public.book_appointment('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', null, current_setting('t.next')::date, 'next day')).token_no),
  1, 'and the same department on another day');

select lives_ok(
  $$ update public.appointments set status = 'cancelled'
     where department_id = '30000000-0000-0000-0000-000000000001' and appointment_date = current_setting('t.day')::date $$,
  'cancelling the first token');
select is(
  (select (public.book_appointment('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', null, current_setting('t.day')::date, 'after cancel')).token_no),
  2, 'frees the slot: booking again works, with token 2 (token 1 is never given out twice)');
select throws_ok(
  $$ select public.book_appointment('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', null, current_setting('t.day')::date, 'and again') $$,
  'P0001', 'you already have a token for this department on that day', 'but the new token counts again');

-- ----------------------------------------------------------------------------
-- other patients are not affected, and the cancelled token does not use up the limit
-- ----------------------------------------------------------------------------
select public.tap_login('10000000-0000-0000-0000-000000000002');
select is(
  (select (public.book_appointment('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', null, current_setting('t.day')::date, 'b')).token_no),
  3, 'another patient books the same department and day (token 3)');
select is(
  (select tokens_left from public.department_tokens('30000000-0000-0000-0000-000000000001', current_setting('t.day')::date)),
  1, 'the cancelled token is not counted against the daily limit (2 active of 3)');

-- ----------------------------------------------------------------------------
-- the database keeps the rule even outside the function
-- ----------------------------------------------------------------------------
reset role;
select throws_ok(
  format($$ insert into public.appointments (patient_id, hospital_id, department_id, appointment_date, token_no)
           values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', %L, 90) $$,
         current_setting('t.day')),
  '23505', null, 'a second active row for the same patient, department and day is refused by an index');
select lives_ok(
  format($$ insert into public.appointments (patient_id, hospital_id, department_id, appointment_date, token_no, status)
           values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', %L, 91, 'cancelled') $$,
         current_setting('t.day')),
  'while a cancelled row is not limited');
select throws_ok(
  format($$ update public.appointments set status = 'confirmed' where token_no = 91 and department_id = '30000000-0000-0000-0000-000000000001' and appointment_date = %L $$,
         current_setting('t.day')),
  '23505', null, 'bringing a cancelled token back while another is active is refused too');

select public.tap_login('10000000-0000-0000-0000-000000000001'); set local role anon;
select throws_ok(
  $$ select public.book_appointment('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', null, current_date + 5, 'x') $$,
  '42501', null, 'a signed-out visitor still cannot book');
reset role;
select is(
  (select count(*)::int from pg_indexes where indexname = 'uq_appointments_one_active_token'),
  1, 'the rule is an index, so every way of writing a row obeys it');

select * from finish();
rollback;
