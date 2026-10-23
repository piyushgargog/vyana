-- supabase/tests/database/ai_usage.test.sql
-- Usage metering (issue #300): the size columns, the service-only daily view and
-- the caller's own totals. Run with: supabase test db
-- Owner: Vaibhav Parmar

begin;
create extension if not exists pgtap with schema extensions;

select plan(18);

insert into auth.users (id, email, raw_user_meta_data) values
  ('10000000-0000-0000-0000-000000000001', 'a@vyana.test', '{"full_name":"Patient A"}'),
  ('10000000-0000-0000-0000-000000000002', 'b@vyana.test', '{"full_name":"Patient B"}'),
  ('10000000-0000-0000-0000-000000000003', 'c@vyana.test', '{"full_name":"Patient C"}');

-- (A profile row follows each auth user by trigger, as in the app.)

create function public.tap_login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- The shape the migration adds.
select has_column('public', 'ai_runs', 'provider', 'ai_runs has provider');
select has_column('public', 'ai_runs', 'input_tokens', 'ai_runs has input_tokens');
select has_column('public', 'ai_runs', 'output_tokens', 'ai_runs has output_tokens');
select has_column('public', 'ai_runs', 'latency_ms', 'ai_runs has latency_ms');
select has_view('public', 'ai_usage_daily', 'the daily view exists');
select has_function('public', 'my_ai_usage_today', 'the totals function exists');

-- Runs, written the way the server writes them (as the owner, before any role switch).
-- A: two runs today (India time), one yesterday. B: one today. One with no user at all.
insert into public.ai_runs (user_id, feature, provider, model, input_tokens, output_tokens, latency_ms, created_at) values
  ('10000000-0000-0000-0000-000000000001', 'assistant', 'groq', 'm1', 100, 50, 900, now()),
  ('10000000-0000-0000-0000-000000000001', 'care_plan', 'groq', 'm1', 200, 80, 1500, now()),
  ('10000000-0000-0000-0000-000000000001', 'assistant', 'groq', 'm1', 999, 999, 900,
    (((now() at time zone 'Asia/Kolkata')::date - 1)::timestamp + interval '1 hour') at time zone 'Asia/Kolkata'),
  ('10000000-0000-0000-0000-000000000002', 'assistant', 'groq', 'm1', 700, 600, 800, now()),
  (null, 'assistant', 'groq', 'm1', 5, 5, 100, now());

-- As patient A: their own runs are readable, B's are not, the daily view is refused.
select public.tap_login('10000000-0000-0000-0000-000000000001'); set local role authenticated;

select is(
  (select count(*)::int from public.ai_runs),
  3, 'a patient reads exactly their own runs');
select is(
  (select count(*)::int from public.ai_runs where user_id = '10000000-0000-0000-0000-000000000002'),
  0, 'a patient cannot read another user''s runs');
select throws_ok(
  $$ select * from public.ai_usage_daily $$,
  '42501', null, 'a patient cannot read the daily view');

-- As the same patient, the function hands back only their own totals for today:
-- yesterday's 999-token run and B's run are both outside it.
select results_eq(
  $$ select calls::int, input_tokens::int, output_tokens::int from public.my_ai_usage_today() $$,
  $$ values (2, 300, 130) $$,
  'my totals for today are mine alone');

reset role;

-- As patient B, the same function answers with B's numbers, not A's.
select public.tap_login('10000000-0000-0000-0000-000000000002'); set local role authenticated;

select results_eq(
  $$ select calls::int, input_tokens::int, output_tokens::int from public.my_ai_usage_today() $$,
  $$ values (1, 700, 600) $$,
  'the second patient gets their own totals');

reset role;

-- A patient with no runs still gets one row: zeros, so the app can show a total.
select public.tap_login('10000000-0000-0000-0000-000000000003'); set local role authenticated;

select results_eq(
  $$ select calls::int, input_tokens::int, output_tokens::int from public.my_ai_usage_today() $$,
  $$ values (0, 0, 0) $$,
  'no runs today reads as zeros');

reset role;

-- Nobody signed in: the daily view is refused for anon too.
select set_config('request.jwt.claims', '', true); set local role anon;

select throws_ok(
  $$ select * from public.ai_usage_daily $$,
  '42501', null, 'anon cannot read the daily view');

reset role;

-- The service role reads the roll-up: A's two calls today, and the user-less run
-- rolled up under a null user.
set local role service_role;

select is(
  (select sum(calls)::int from public.ai_usage_daily
    where user_id = '10000000-0000-0000-0000-000000000001'
      and day = (now() at time zone 'Asia/Kolkata')::date),
  2, 'the daily view counts A''s calls today');
select is(
  (select sum(input_tokens)::int from public.ai_usage_daily
    where user_id = '10000000-0000-0000-0000-000000000001'
      and day = (now() at time zone 'Asia/Kolkata')::date),
  300, 'the daily view sums A''s input tokens today');
select is(
  (select calls::int from public.ai_usage_daily
    where user_id is null and day = (now() at time zone 'Asia/Kolkata')::date),
  1, 'a run with no user rolls up under a null user');

reset role;

-- An audit row is not a model call (issue #424): the lab-value correction writes
-- one with model null. It is stored like any other row, but it must not count
-- towards the patient's totals — that number is what the daily limit reads.
-- (Added last: the daily view above still rolls every row up, audit included.)
insert into public.ai_runs (user_id, feature, provider, model, input_tokens, output_tokens, latency_ms, created_at) values
  ('10000000-0000-0000-0000-000000000001', 'lab_value_correction', null, null, null, null, null, now());

select public.tap_login('10000000-0000-0000-0000-000000000001'); set local role authenticated;

select is(
  (select count(*)::int from public.ai_runs where feature = 'lab_value_correction'),
  1, 'the audit row is stored and readable');
select results_eq(
  $$ select calls::int, input_tokens::int, output_tokens::int from public.my_ai_usage_today() $$,
  $$ values (2, 300, 130) $$,
  'an audit row with no model does not count towards the totals');

reset role;

select * from finish();
rollback;
