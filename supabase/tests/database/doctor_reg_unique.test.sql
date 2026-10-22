-- supabase/tests/database/doctor_reg_unique.test.sql
-- One council number, one verified doctor account (issue #360, migration 0021): the
-- normalisation helpers agree with the app's normalizeRegNo / councilKey, and the
-- partial unique index stops the double-approve at the database, not just in app code.
-- Run with: supabase test db
-- Owner: Vaibhav Parmar

begin;
create extension if not exists pgtap with schema extensions;

select plan(20);

-- The helpers exist and the guard is in place.
select has_function('public', 'normalize_reg_no', 'the reg-no normaliser exists');
select has_function('public', 'council_key', 'the council key exists');
select has_index('public', 'doctors', 'idx_doctors_verified_reg_council', 'the verified reg/council index exists');

-- The normalisation agrees with the app (apps/web/lib/server/tinyfish/nmc.ts):
-- "MCI/12-345" and "mci 12345" are the same number; "Delhi Medical Council" is "delhi".
select is(public.normalize_reg_no('MCI/12-345'), 'mci12345', 'reg no: case and separators dropped');
select is(public.normalize_reg_no('mci 12345'), 'mci12345', 'reg no: spaces dropped');
select is(public.normalize_reg_no('A.B/C\D-1 2'), 'abcd12', 'reg no: dot, slash, backslash and dash dropped');
select is(public.normalize_reg_no('  98-76/54.32  '), '98765432', 'reg no: edge spaces dropped');
select is(public.council_key('Delhi Medical Council'), 'delhi', 'council: filler words dropped');
select is(public.council_key('The State Medical Council of Maharashtra'), 'maharashtra', 'council: long form reduces to the state');
select is(public.council_key('Medical Council of India'), 'india', 'council: the national council reduces to india');
select is(public.council_key('State Medical Council, Uttar Pradesh'), 'uttar pradesh', 'council: punctuation is a separator');

-- Fixtures: five doctor accounts (a profile row follows each auth user by trigger).
insert into auth.users (id, email, raw_user_meta_data) values
  ('10000000-0000-0000-0000-000000000101', 'd1@vyana.test', '{"full_name":"Dr One","role":"doctor"}'),
  ('10000000-0000-0000-0000-000000000102', 'd2@vyana.test', '{"full_name":"Dr Two","role":"doctor"}'),
  ('10000000-0000-0000-0000-000000000103', 'd3@vyana.test', '{"full_name":"Dr Three","role":"doctor"}'),
  ('10000000-0000-0000-0000-000000000104', 'd4@vyana.test', '{"full_name":"Dr Four","role":"doctor"}'),
  ('10000000-0000-0000-0000-000000000105', 'd5@vyana.test', '{"full_name":"Dr Five","role":"doctor"}');

-- The first verified doctor on a number is fine.
select lives_ok(
  $$insert into public.doctors (id, specialization, reg_no, state_council, verification_status)
    values ('10000000-0000-0000-0000-000000000101', 'Physician', 'MCI/12-345', 'Delhi Medical Council', 'verified')$$,
  'the first verified doctor on a number saves');

-- The same number spelled the way the app treats as identical, on a second
-- account, already verified: the database refuses (the double-approve race).
select throws_ok(
  $$insert into public.doctors (id, specialization, reg_no, state_council, verification_status)
    values ('10000000-0000-0000-0000-000000000102', 'Physician', 'mci 12345', 'delhi', 'verified')$$,
  '23505',
  'duplicate key value violates unique constraint "idx_doctors_verified_reg_council"',
  'a second verified account on the same normalised number + council fails at the database');

-- A failed row on the same number is outside the guard.
select lives_ok(
  $$insert into public.doctors (id, specialization, reg_no, state_council, verification_status)
    values ('10000000-0000-0000-0000-000000000102', 'Physician', 'mci 12345', 'delhi', 'failed')$$,
  'a failed row on the same number saves');

-- A pending claim on the same number is fine; approving it (the second half
-- of the double-approve) is what the database stops.
select lives_ok(
  $$insert into public.doctors (id, specialization, reg_no, state_council, verification_status)
    values ('10000000-0000-0000-0000-000000000103', 'Physician', 'MCI 12345', 'The Delhi Medical Council', 'pending')$$,
  'a pending claim on the same number saves');
select throws_ok(
  $$update public.doctors set verification_status = 'verified'
     where id = '10000000-0000-0000-0000-000000000103'$$,
  '23505',
  'duplicate key value violates unique constraint "idx_doctors_verified_reg_council"',
  'approving the second claim on the same number fails at the database');

-- The same number under a different council is a different registration.
select lives_ok(
  $$insert into public.doctors (id, specialization, reg_no, state_council, verification_status)
    values ('10000000-0000-0000-0000-000000000104', 'Physician', 'MCI/12-345', 'Maharashtra Medical Council', 'verified')$$,
  'the same number under another council saves');

-- A verified doctor can be re-saved (the approve flow writes its own row).
select lives_ok(
  $$insert into public.doctors (id, specialization, reg_no, state_council, verification_status)
    values ('10000000-0000-0000-0000-000000000105', 'Cardiologist', 'MH-999', 'Maharashtra Medical Council', 'verified')$$,
  'another verified doctor saves');
select lives_ok(
  $$update public.doctors set verified_at = now()
     where id = '10000000-0000-0000-0000-000000000105'$$,
  'a verified doctor re-saving its own row is fine');

-- Net effect: exactly one verified row carries the Delhi number.
select is(
  (select count(*)::int from public.doctors
    where verification_status = 'verified'
      and public.normalize_reg_no(reg_no) = 'mci12345'
      and public.council_key(state_council) = 'delhi'),
  1, 'exactly one verified account holds the number in the end');

select * from finish();
rollback;
