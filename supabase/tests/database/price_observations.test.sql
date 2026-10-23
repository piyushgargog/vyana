-- supabase/tests/database/price_observations.test.sql
-- Price observations (issue #495 step 5): signed-in users read them, only the service role
-- writes, and no row can be changed or removed through the API (append-only).
-- Run with: supabase test db
-- Owner: Vaibhav Parmar

begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

insert into auth.users (id, email, raw_user_meta_data) values
  ('10000000-0000-0000-0000-000000000001', 'a@vyana.test', '{"full_name":"Patient A"}');
-- Supabase grants table access to anon/authenticated by default and lets the policies
-- decide the rows; this local harness does not, so grant what the platform would.
grant select on public.price_observations to anon, authenticated;

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

-- The service role's write (as the table owner here) lands
select is(
  public.tap_affected($$ insert into public.price_observations (medicine_key, source, url, price_inr, pack, status)
    values ('metformin-500', 'test-source', 'https://example.test/p', 42.50, 'strip of 10', 'ok') $$),
  1, 'an observation is recorded');
select ok(
  exists (select 1 from pg_indexes where tablename = 'price_observations' and indexname = 'price_observations_medicine_observed_idx'),
  'the (medicine_key, observed_at desc) index exists');

-- A signed-in user can read it but cannot write, change or remove it
select public.tap_login('10000000-0000-0000-0000-000000000001'); set local role authenticated;
select is(
  (select count(*)::int from public.price_observations),
  1, 'a signed-in user can read observations');
select throws_ok(
  $$ insert into public.price_observations (medicine_key, source, status) values ('x', 'y', 'ok') $$,
  '42501', null, 'a signed-in user cannot add an observation');
select is(
  public.tap_affected($$ update public.price_observations set price_inr = 1 $$),
  0, 'and cannot change one');
select is(
  public.tap_affected($$ delete from public.price_observations $$),
  0, 'and cannot remove one');
reset role;
select is(
  (select price_inr from public.price_observations where medicine_key = 'metformin-500'),
  42.50::numeric, 'the recorded price is untouched');

-- Signed out: nothing to read
select set_config('request.jwt.claims', '{}', true);
set local role anon;
select is(
  (select count(*)::int from public.price_observations),
  0, 'a signed-out visitor reads nothing');

select * from finish();
rollback;
