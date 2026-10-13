-- supabase/tests/database/share_links.test.sql
-- A share link expires within 30 days of its creation. Run with: supabase test db
-- Owner: Vaibhav Parmar

begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

insert into auth.users (id, email, raw_user_meta_data) values
  ('10000000-0000-0000-0000-000000000001', 'a@vyana.test', '{"full_name":"Patient A"}'),
  ('10000000-0000-0000-0000-000000000002', 'b@vyana.test', '{"full_name":"Patient B"}');

create function public.tap_login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select public.tap_login('10000000-0000-0000-0000-000000000001'); set local role authenticated;

select lives_ok(
  $$ insert into public.share_links (patient_id, kind, expires_at)
     values ('10000000-0000-0000-0000-000000000001', 'medical_id', now() + interval '1 day') $$,
  'a one day link is created');
select lives_ok(
  $$ insert into public.share_links (patient_id, kind, expires_at)
     values ('10000000-0000-0000-0000-000000000001', 'timeline', now() + interval '30 days') $$,
  'a 30 day link is created');
select lives_ok(
  $$ insert into public.share_links (patient_id, kind, expires_at)
     values ('10000000-0000-0000-0000-000000000001', 'timeline', now() + interval '30 days 30 minutes') $$,
  'a phone clock a few minutes ahead does not break a 30 day link');
select throws_ok(
  $$ insert into public.share_links (patient_id, kind, expires_at)
     values ('10000000-0000-0000-0000-000000000001', 'medical_id', now() + interval '31 days') $$,
  '23514', null, 'a 31 day link is refused');
select throws_ok(
  $$ insert into public.share_links (patient_id, kind, expires_at)
     values ('10000000-0000-0000-0000-000000000001', 'medical_id', now() + interval '10 years') $$,
  '23514', null, 'and so is one that lasts for years');
select lives_ok(
  $$ insert into public.share_links (patient_id, kind, expires_at)
     values ('10000000-0000-0000-0000-000000000001', 'medical_id', now() - interval '1 day') $$,
  'a link that is already over does no harm');

select throws_ok(
  $$ update public.share_links set expires_at = now() + interval '90 days' where kind = 'medical_id' and expires_at > now() $$,
  '23514', null, 'extending an existing link past 30 days from its creation is refused');
select lives_ok(
  $$ update public.share_links set expires_at = now() + interval '2 days' where kind = 'medical_id' and expires_at > now() $$,
  'extending it within the 30 days works');
select lives_ok(
  $$ update public.share_links set revoked = true where kind = 'timeline' $$,
  'turning a link off works');

select public.tap_login('10000000-0000-0000-0000-000000000002');
select is(
  (select count(*)::int from public.share_links), 0, 'another patient sees none of those links');

reset role;
select is(
  (select count(*)::int from pg_constraint where conname = 'chk_share_links_max_30_days'), 1, 'the cap is a constraint of the table');
select throws_ok(
  $$ insert into public.share_links (patient_id, kind, expires_at, created_at)
     values ('10000000-0000-0000-0000-000000000001', 'medical_id', '2030-01-01', now()) $$,
  '23514', null, 'even the table owner cannot write a link past the cap');

select * from finish();
rollback;
