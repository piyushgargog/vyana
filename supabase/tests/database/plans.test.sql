-- supabase/tests/database/plans.test.sql
-- Plans, limits and the waitlist (issue #301). Run with: supabase test db
-- Owner: Vaibhav Parmar

begin;
create extension if not exists pgtap with schema extensions;

select plan(39);

insert into auth.users (id, email, raw_user_meta_data) values
  ('10000000-0000-0000-0000-000000000011', 'd@vyana.test', '{"full_name":"Patient D"}'),
  ('10000000-0000-0000-0000-000000000012', 'e@vyana.test', '{"full_name":"Patient E"}'),
  ('10000000-0000-0000-0000-000000000013', 'f@vyana.test', '{"full_name":"Patient F"}');

create function public.tap_login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select has_table('public', 'plans', 'the plans table exists');
select has_table('public', 'user_plans', 'the user_plans table exists');
select has_table('public', 'waitlist', 'the waitlist table exists');

-- The seeded plans and their placeholder limits.
select is((select count(*)::int from public.plans), 3, 'three plans are seeded');
select is((select daily_ai_calls from public.plans where id = 'free'), 30, 'free allows 30 AI calls a day');
select is((select max_profiles from public.plans where id = 'family'), 5, 'family allows 5 profiles');
select ok((select daily_ai_calls from public.plans where id = 'clinic') is null, 'clinic limits are null');

-- A profile that arrives by sign-up (auth user -> profile trigger) starts on free,
-- with exactly one plan row.
select is(
  (select plan_id from public.user_plans where user_id = '10000000-0000-0000-0000-000000000011'),
  'free', 'a new profile starts on free');
select is(
  (select count(*)::int from public.user_plans where user_id = '10000000-0000-0000-0000-000000000011'),
  1, 'a new profile gets exactly one plan row');
select ok(
  (select count(*) from public.user_plans) = (select count(*) from public.profiles),
  'every profile has a plan row (the backfill and the trigger agree)');

-- As patient D: current_plan() hands back the free plan with its limits.
select public.tap_login('10000000-0000-0000-0000-000000000011'); set local role authenticated;

select results_eq(
  $$ select plan_id, name, daily_ai_calls, max_profiles from public.current_plan() $$,
  $$ values ('free', 'Free', 30, 1) $$,
  'current_plan returns the free plan and its limits');
select is((select count(*)::int from public.user_plans), 1, 'a user reads exactly their own plan row');
select is(
  (select count(*)::int from public.user_plans where user_id = '10000000-0000-0000-0000-000000000012'),
  0, 'another user''s plan row is invisible');
select throws_ok(
  $$ insert into public.user_plans (user_id, plan_id) values ('10000000-0000-0000-0000-000000000011', 'family') $$,
  '42501', null, 'a user cannot give themselves a plan');
select throws_ok(
  $$ update public.user_plans set plan_id = 'family' where user_id = '10000000-0000-0000-0000-000000000011' $$,
  '42501', null, 'a user cannot change their plan');

reset role;

-- Signed out: the plans are public reading, and still not writable.
select set_config('request.jwt.claims', '', true); set local role anon;

select is((select count(*)::int from public.plans), 3, 'plans are readable signed out');
select throws_ok(
  $$ insert into public.plans (id, name) values ('gold', 'Gold') $$,
  '42501', null, 'nobody signed out can add a plan');

reset role;

-- The waitlist table itself is closed to a signed-in user; the function is the only door.
select public.tap_login('10000000-0000-0000-0000-000000000011'); set local role authenticated;

select throws_ok(
  $$ select * from public.waitlist $$,
  '42501', null, 'the waitlist cannot be read directly');

reset role;

-- Joining signed out. The whole file shares one transaction, so the claims an
-- earlier tap_login set would otherwise still be present and these calls would
-- take the signed-in path; clear them and drop to anon so the anonymous path
-- (the attempts counter) is the one under test.
select set_config('request.jwt.claims', '', true); set local role anon;

select is(
  (select public.join_waitlist('Person@Example.com', 'family', 'for my parents')),
  true, 'a first join answers true');
select is(
  (select public.join_waitlist('person@example.com', 'family')),
  false, 'joining twice answers false and adds no row');
select is(
  (select public.join_waitlist('person@example.com', 'clinic')),
  true, 'the same address may wait for a second plan');
-- A second caller with somebody else's address learns nothing: the answer is
-- the boolean again, never the stored row.
select is(
  (select public.join_waitlist('person@example.com', 'family', 'a stranger''s note')),
  false, 'a repeat join by anyone answers false');

-- Bad input is refused with a clear code, before anything is stored.
select throws_ok(
  $$ select * from public.join_waitlist('not-an-email', 'family') $$,
  '22023', null, 'an address without an @ is refused');
select throws_ok(
  $$ select * from public.join_waitlist('x@y.co', 'gold') $$,
  '22023', null, 'an unknown plan is refused');
select throws_ok(
  $$ select * from public.join_waitlist('x@y.co', 'family', repeat('a', 201)) $$,
  '22023', null, 'a note over 200 characters is refused');
select throws_ok(
  $$ select * from public.join_waitlist(repeat('a', 243) || '@example.com', 'family') $$,
  '22023', null, 'an address over 254 characters is refused');

reset role;

-- What was stored, read back with the session's own rights.
select is(
  (select email from public.waitlist where plan_id = 'family' and email = 'person@example.com'),
  'person@example.com', 'joining stores the address lower-cased');
select is(
  (select count(*)::int from public.waitlist where email = 'person@example.com'),
  2, 'the address holds one row per plan, never two for one plan');
select is(
  (select note from public.waitlist where email = 'person@example.com' and plan_id = 'family'),
  'for my parents', 'the stored note is never handed back or overwritten');
select throws_ok(
  $$ insert into public.waitlist (email, plan_id) values (repeat('a', 243) || '@example.com', 'family') $$,
  '23514', null, 'the table itself refuses an address over 254 characters');

-- The hardening lines: anon holds nothing on user_plans, and the trigger
-- function is not callable by the public.
select ok(
  not has_table_privilege('anon', 'public.user_plans', 'SELECT'),
  'anon has no privilege at all on user_plans');
select ok(
  not has_function_privilege('public', 'public.give_default_plan()', 'EXECUTE'),
  'give_default_plan is not executable by public');

-- Anonymous joins as a whole are capped (30 an hour) through the attempts
-- counter, so the form cannot be flooded by varying the address.
insert into public.waitlist_attempts (attempted_at)
select now() from generate_series(1, 30);
select set_config('request.jwt.claims', '', true); set local role anon;
select throws_ok(
  $$ select * from public.join_waitlist('someone-new@x.co', 'family') $$,
  'P0001', null, 'the thirty-first anonymous join in an hour is refused');
reset role;
delete from public.waitlist_attempts;

-- The rate limit: patient F may join 5 times in an hour, the sixth is refused.
select public.tap_login('10000000-0000-0000-0000-000000000013'); set local role authenticated;

select lives_ok($$ select public.join_waitlist('f1@x.co', 'family') $$, 'join 1 of 5');
select lives_ok($$ select public.join_waitlist('f2@x.co', 'family') $$, 'join 2 of 5');
select lives_ok($$ select public.join_waitlist('f3@x.co', 'family') $$, 'join 3 of 5');
select lives_ok($$ select public.join_waitlist('f4@x.co', 'family') $$, 'join 4 of 5');
select lives_ok($$ select public.join_waitlist('f5@x.co', 'family') $$, 'join 5 of 5');
select throws_ok(
  $$ select public.join_waitlist('f6@x.co', 'family') $$,
  'P0001', null, 'the sixth join in an hour is refused');

reset role;

select * from finish();
rollback;
