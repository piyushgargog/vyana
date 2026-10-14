-- supabase/tests/database/rate_limits.test.sql
-- The counters behind the per-user API limits. Run with: supabase test db
-- Owner: Vaibhav Parmar

begin;
create extension if not exists pgtap with schema extensions;

select plan(33);

insert into auth.users (id, email, raw_user_meta_data) values
  ('10000000-0000-0000-0000-000000000001', 'a@vyana.test', '{}'),
  ('10000000-0000-0000-0000-000000000002', 'b@vyana.test', '{}');

-- One call as text: "allowed,remaining". It does not use security definer, so it runs with the rights of the caller.
create function public.tap_hit(uid uuid, b text, w int, m int) returns text language sql as $$
  select allowed || ',' || remaining from public.hit_rate_limit(uid, b, w, m)
$$;
grant execute on function public.tap_hit(uuid, text, int, int) to service_role, authenticated, anon;

-- ----------------------------------------------------------------------------
-- The count, as the server (service role) makes it: 3 calls with a maximum of 2
-- ----------------------------------------------------------------------------
set local role service_role;

select is(public.tap_hit('10000000-0000-0000-0000-000000000001', 'ai_chat', 600, 2), 'true,1', 'the first call is allowed, one is left');
select is(public.tap_hit('10000000-0000-0000-0000-000000000001', 'ai_chat', 600, 2), 'true,0', 'the second call is allowed, none is left');
select is(public.tap_hit('10000000-0000-0000-0000-000000000001', 'ai_chat', 600, 2), 'false,0', 'the third call is refused');
select is(public.tap_hit('10000000-0000-0000-0000-000000000001', 'ai_chat', 600, 2), 'false,0', 'and so is the fourth');

-- separate counters for other users and other buckets
select is(public.tap_hit('10000000-0000-0000-0000-000000000002', 'ai_chat', 600, 2), 'true,1', 'another user has a counter of their own');
select is(public.tap_hit('10000000-0000-0000-0000-000000000001', 'agent', 600, 2), 'true,1', 'another bucket of the same user has a counter of its own');
select is(public.tap_hit('10000000-0000-0000-0000-000000000001', 'public', 600, 0), 'false,0', 'a maximum of 0 refuses at once');

-- the answer carries the end of the window
select ok(
  (select reset_at > now() and reset_at <= now() + make_interval(secs => 600) from public.hit_rate_limit('10000000-0000-0000-0000-000000000001', 'reset_probe', 600, 5)),
  'reset_at is the end of the current 10 minute window');

-- ----------------------------------------------------------------------------
-- What was stored (as the table owner)
-- ----------------------------------------------------------------------------
reset role;
select is((select hits from public.rate_limits where user_id = '10000000-0000-0000-0000-000000000001' and bucket = 'ai_chat'), 4,
  'every call is counted, refused ones too');
select is(
  (select window_start = to_timestamp(floor(extract(epoch from now()) / 600) * 600) from public.rate_limits where user_id = '10000000-0000-0000-0000-000000000001' and bucket = 'ai_chat'),
  true, 'the window starts on a multiple of its length, the same for every caller');

-- a new window allows again: move the counter back by one window, as the clock would
update public.rate_limits set window_start = window_start - make_interval(secs => 600)
  where user_id = '10000000-0000-0000-0000-000000000001' and bucket = 'ai_chat';
set local role service_role;
select is(public.tap_hit('10000000-0000-0000-0000-000000000001', 'ai_chat', 600, 2), 'true,1', 'a new window allows again');
reset role;
select is((select count(*)::int from public.rate_limits where user_id = '10000000-0000-0000-0000-000000000001' and bucket = 'ai_chat'), 2,
  'the old window keeps its own row');

-- ----------------------------------------------------------------------------
-- Wrong arguments are refused (not a division by zero)
-- ----------------------------------------------------------------------------
set local role service_role;
select throws_ok($$ select * from public.hit_rate_limit('10000000-0000-0000-0000-000000000001', 'x', 0, 5) $$, '22023', null, 'a window of 0 seconds is refused');
select throws_ok($$ select * from public.hit_rate_limit('10000000-0000-0000-0000-000000000001', 'x', -60, 5) $$, '22023', null, 'a negative window is refused');
select throws_ok($$ select * from public.hit_rate_limit('10000000-0000-0000-0000-000000000001', 'x', 60, -1) $$, '22023', null, 'a negative maximum is refused');
select throws_ok($$ select * from public.hit_rate_limit(null, 'x', 60, 5) $$, '22023', null, 'no user is refused');
select throws_ok($$ select * from public.hit_rate_limit('10000000-0000-0000-0000-000000000001', '', 60, 5) $$, '22023', null, 'an empty bucket is refused');
select throws_ok($$ select * from public.hit_rate_limit('10000000-0000-0000-0000-000000000001', repeat('b', 65), 60, 5) $$, '22023', null, 'a bucket name over 64 characters is refused');
reset role;

-- ----------------------------------------------------------------------------
-- Who may call it, and who may read the table
-- ----------------------------------------------------------------------------
select is(has_function_privilege('service_role', 'public.hit_rate_limit(uuid, text, int, int)', 'execute'), true, 'the server may call it');
select is(has_function_privilege('authenticated', 'public.hit_rate_limit(uuid, text, int, int)', 'execute'), false, 'a signed-in user may not');
select is(has_function_privilege('anon', 'public.hit_rate_limit(uuid, text, int, int)', 'execute'), false, 'a visitor may not');

select set_config('request.jwt.claims', json_build_object('sub', '10000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
set local role authenticated;
select throws_ok($$ select * from public.hit_rate_limit('10000000-0000-0000-0000-000000000002', 'ai_chat', 600, 2) $$, '42501', null, 'a signed-in user cannot spend another user''s allowance');
select throws_ok($$ select * from public.rate_limits $$, '42501', null, 'a signed-in user cannot read the counters');
select throws_ok($$ insert into public.rate_limits (user_id, bucket, window_start, hits) values ('10000000-0000-0000-0000-000000000001', 'ai_chat', now(), 0) $$, '42501', null, 'and cannot write them');
reset role;
set local role anon;
select throws_ok($$ select * from public.rate_limits $$, '42501', null, 'a visitor cannot read the counters');
reset role;

select is((select relrowsecurity from pg_class where oid = 'public.rate_limits'::regclass), true, 'row-level security is on');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'rate_limits'), 0, 'and there is no policy');

-- ----------------------------------------------------------------------------
-- The function itself
-- ----------------------------------------------------------------------------
select ok((select prosecdef from pg_proc where oid = 'public.hit_rate_limit(uuid, text, int, int)'::regprocedure), 'it is security definer');
select ok(
  exists (select 1 from pg_proc p, unnest(p.proconfig) c where p.oid = 'public.hit_rate_limit(uuid, text, int, int)'::regprocedure and c like 'search_path=%'),
  'and sets its search_path');
select ok((select prosrc from pg_proc where oid = 'public.hit_rate_limit(uuid, text, int, int)'::regprocedure) ~* 'on conflict.*do update',
  'the count is one insert ... on conflict do update, so two calls at once cannot read the same number');

-- ----------------------------------------------------------------------------
-- The account, and the clean-up job
-- ----------------------------------------------------------------------------
select is((select count(*)::int from cron.job where jobname = 'rate-limits-cleanup' and schedule = '17 * * * *'), 1, 'the clean-up runs every hour');

insert into public.rate_limits (user_id, bucket, window_start, hits) values
  ('10000000-0000-0000-0000-000000000002', 'old', now() - interval '2 days', 3),
  ('10000000-0000-0000-0000-000000000002', 'recent', now() - interval '2 hours', 3);
do $$
declare c text;
begin
  select command into c from cron.job where jobname = 'rate-limits-cleanup';
  execute c;
end;
$$;
select is((select array_agg(bucket order by bucket) from public.rate_limits where user_id = '10000000-0000-0000-0000-000000000002' and bucket in ('old', 'recent')),
  array['recent'], 'the job deletes the rows older than a day and keeps the newer ones');

delete from auth.users where id = '10000000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.rate_limits where user_id = '10000000-0000-0000-0000-000000000001'), 0, 'the counters of a deleted account go with it');

select * from finish();
rollback;
