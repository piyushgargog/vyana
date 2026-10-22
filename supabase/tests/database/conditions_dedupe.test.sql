-- supabase/tests/database/conditions_dedupe.test.sql
-- One condition, once (issue #333, migration 0020): the unique index refuses a second
-- row of a name for the same patient — case and edge spaces do not make a new one —
-- and another patient may use the same name freely.
-- Run with: supabase test db
-- Owner: Vaibhav Parmar

begin;
create extension if not exists pgtap with schema extensions;

select plan(6);

insert into auth.users (id, email, raw_user_meta_data) values
  ('10000000-0000-0000-0000-000000000001', 'a@vyana.test', '{}'),
  ('10000000-0000-0000-0000-000000000002', 'b@vyana.test', '{}');

create function public.tap_login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- ----------------------------------------------------------------------------
select public.tap_login('10000000-0000-0000-0000-000000000001'); set local role authenticated;

select lives_ok(
  $$ insert into public.conditions (patient_id, name, source) values ('10000000-0000-0000-0000-000000000001', 'Type 2 Diabetes', 'patient') $$,
  'a patient adds a condition');
select throws_ok(
  $$ insert into public.conditions (patient_id, name, source) values ('10000000-0000-0000-0000-000000000001', 'type 2 diabetes', 'patient') $$,
  '23505', null, 'the same name in another case is a duplicate');
select throws_ok(
  $$ insert into public.conditions (patient_id, name, source) values ('10000000-0000-0000-0000-000000000001', '  Type 2 Diabetes  ', 'patient') $$,
  '23505', null, 'and with spaces at the ends it is still a duplicate');
select lives_ok(
  $$ insert into public.conditions (patient_id, name, source) values ('10000000-0000-0000-0000-000000000001', 'Asthma', 'patient') $$,
  'a different name is fine');
select throws_ok(
  $$ update public.conditions set name = 'TYPE 2 DIABETES' where name = 'Asthma' $$,
  '23505', null, 'renaming a condition into an existing one is refused too');

-- ----------------------------------------------------------------------------
select public.tap_login('10000000-0000-0000-0000-000000000002'); set local role authenticated;

select lives_ok(
  $$ insert into public.conditions (patient_id, name, source) values ('10000000-0000-0000-0000-000000000002', 'Type 2 Diabetes', 'patient') $$,
  'another patient may have the same condition');

select * from finish();
rollback;
