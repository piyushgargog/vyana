-- supabase/tests/database/doctor_council_unique.test.sql
-- The database guard of 0016: one council registration, one verified doctor.
-- Run with: supabase test db
-- Owner: Vaibhav Parmar

begin;
create extension if not exists pgtap with schema extensions;

select plan(15);

-- ----------------------------------------------------------------------------
-- Fixtures: four doctor accounts (the sign-up trigger makes their profiles)
-- ----------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('10000000-0000-0000-0000-000000000001', 'da@vyana.test', '{"full_name":"Dr A","role":"doctor"}'),
  ('10000000-0000-0000-0000-000000000002', 'db@vyana.test', '{"full_name":"Dr B","role":"doctor"}'),
  ('10000000-0000-0000-0000-000000000003', 'dc@vyana.test', '{"full_name":"Dr C","role":"doctor"}'),
  ('10000000-0000-0000-0000-000000000004', 'dd@vyana.test', '{"full_name":"Dr D","role":"doctor"}');

-- ----------------------------------------------------------------------------
-- The normalisation is the app's (normalizeRegNo / councilKey in
-- apps/web/lib/server/tinyfish/nmc.ts), spelling for spelling
-- ----------------------------------------------------------------------------
select is(public.doctor_reg_no_key('MCI/12-345'), 'mci12345', 'the number key lower-cases and drops separators');
select is(public.doctor_reg_no_key('mci 12345'), 'mci12345', 'the same number, spelled the other way, keys the same');
select is(public.doctor_reg_no_key('DMC\77.01'), 'dmc7701', 'backslashes and dots are dropped too');
select is(public.doctor_council_key('Delhi Medical Council'), 'delhi', 'the council key drops the filler words');
select is(public.doctor_council_key('Medical Council of Delhi'), 'delhi', 'the same council, words reordered, keys the same');
select is(public.doctor_council_key('The State Medical Council of Maharashtra'), 'maharashtra', 'every filler word is dropped');

-- ----------------------------------------------------------------------------
-- The guard itself
-- ----------------------------------------------------------------------------
select ok(
  exists(select 1 from pg_indexes where schemaname = 'public' and indexname = 'idx_doctors_verified_registration'),
  'the partial unique index exists');

select lives_ok(
  $$ insert into public.doctors (id, specialization, reg_no, state_council, verification_status) values
     ('10000000-0000-0000-0000-000000000001', 'Physician', 'MCI/12-345', 'Delhi Medical Council', 'verified') $$,
  'the first verified doctor with a number is saved');

select throws_ok(
  $$ insert into public.doctors (id, specialization, reg_no, state_council, verification_status) values
     ('10000000-0000-0000-0000-000000000002', 'Physician', 'mci 12345', 'Medical Council of Delhi', 'verified') $$,
  '23505', null,
  'a second verified doctor with the same number and council is refused by the database');

select lives_ok(
  $$ insert into public.doctors (id, specialization, reg_no, state_council, verification_status) values
     ('10000000-0000-0000-0000-000000000002', 'Physician', 'MCI 12345', 'Karnataka Medical Council', 'verified') $$,
  'the same number under another council is a different registration');

select lives_ok(
  $$ insert into public.doctors (id, specialization, reg_no, state_council, verification_status) values
     ('10000000-0000-0000-0000-000000000003', 'Physician', 'MCI-12345', 'Delhi Medical Council', 'pending') $$,
  'a pending application may still claim the number');

select lives_ok(
  $$ insert into public.doctors (id, specialization, reg_no, state_council, verification_status) values
     ('10000000-0000-0000-0000-000000000004', 'Physician', 'MCI.12345', 'Delhi Medical Council', 'failed') $$,
  'a failed application may still hold the number');

-- The race the index exists for is an update, not an insert: two approvals read
-- "nobody has this number" and then both save. The second save must fail here.
select throws_ok(
  $$ update public.doctors set verification_status = 'verified'
     where id = '10000000-0000-0000-0000-000000000003' $$,
  '23505', null,
  'approving the pending claim after the number was verified elsewhere fails at the database');

select lives_ok(
  $$ update public.doctors set clinic_name = 'A Clinic'
     where id = '10000000-0000-0000-0000-000000000001' $$,
  'the verified doctor can still update their own row');

select is(
  (select count(*)::int from public.doctors
   where verification_status = 'verified'
     and public.doctor_reg_no_key(reg_no) = 'mci12345'
     and public.doctor_council_key(state_council) = 'delhi'),
  1, 'exactly one verified doctor holds the number in the end');

select * from finish();
rollback;
