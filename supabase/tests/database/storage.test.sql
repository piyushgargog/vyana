-- supabase/tests/database/storage.test.sql
-- Storage buckets: private, and a user only reaches their own folder. Run with: supabase test db
-- Owner: Vaibhav Parmar

begin;
create extension if not exists pgtap with schema extensions;

select plan(10);

insert into auth.users (id, email) values
  ('10000000-0000-0000-0000-000000000001', 'a@vyana.test'),
  ('10000000-0000-0000-0000-000000000002', 'b@vyana.test');

create function public.tap_login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- number of rows a DELETE touched under RLS (a blocked row is skipped silently, not an error)
create function public.tap_deleted(q text) returns int language plpgsql as $$
declare n int;
begin
  execute 'with d as (' || q || ' returning 1) select count(*) from d' into n;
  return n;
exception when others then
  return 0; -- real Supabase blocks a direct delete from the storage tables with an error (storage.protect_delete)
end;
$$;

select is(
  (select count(*)::int from storage.buckets where id in ('prescriptions', 'lab-reports') and not public),
  2, 'both buckets exist and are private');
select is(
  (select count(*)::int from storage.buckets
   where id in ('prescriptions', 'lab-reports')
     and allowed_mime_types = array['image/jpeg', 'image/png', 'application/pdf']
     and file_size_limit = 10485760),
  2, 'both buckets accept only jpg, png and pdf up to 10 MB');

select public.tap_login('10000000-0000-0000-0000-000000000001'); set local role authenticated;

select lives_ok(
  $$ insert into storage.objects (bucket_id, name) values ('prescriptions', '10000000-0000-0000-0000-000000000001/rx.pdf') $$,
  'a patient uploads a prescription into their own folder');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name) values ('lab-reports', '10000000-0000-0000-0000-000000000001/lab.png') $$,
  'a patient uploads a lab report into their own folder');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('prescriptions', '10000000-0000-0000-0000-000000000002/rx.pdf') $$,
  '42501', null, 'a patient cannot upload into another patient''s folder');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('prescriptions', 'rx.pdf') $$,
  '42501', null, 'a patient cannot upload outside a user folder');
select is(
  (select count(*)::int from storage.objects where bucket_id = 'prescriptions'),
  1, 'a patient lists their own files');

select public.tap_login('10000000-0000-0000-0000-000000000002');
select is(
  (select count(*)::int from storage.objects),
  0, 'another patient sees none of those files');
select is(
  public.tap_deleted($$ delete from storage.objects where bucket_id = 'prescriptions' $$),
  0, 'another patient cannot delete those files');

reset role;
set local role anon;
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('prescriptions', '10000000-0000-0000-0000-000000000001/x.pdf') $$,
  '42501', null, 'a signed-out visitor cannot upload');

select * from finish();
rollback;
