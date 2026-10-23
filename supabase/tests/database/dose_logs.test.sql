-- supabase/tests/database/dose_logs.test.sql
-- The dose write path (issue #495): logging the same dose twice is one row (last write wins),
-- undo removes a dose the patient logged, and no one can touch another patient's rows.
-- Run with: supabase test db
-- Owner: Vaibhav Parmar

begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

-- ----------------------------------------------------------------------------
-- Fixtures (as the table owner): patients A and B, one medicine of A's
-- ----------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('10000000-0000-0000-0000-000000000001', 'a@vyana.test', '{"full_name":"Patient A"}'),
  ('10000000-0000-0000-0000-000000000002', 'b@vyana.test', '{"full_name":"Patient B"}');
insert into public.prescriptions (id, patient_id, source) values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'upload');
insert into public.prescription_items (id, prescription_id, patient_id, medicine_name, frequency) values
  ('41000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Metformin', 'BD');

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

-- A logs a dose as taken (the write logDose makes)
select public.tap_login('10000000-0000-0000-0000-000000000001'); set local role authenticated;
select is(
  public.tap_affected($$ insert into public.dose_logs (patient_id, item_id, scheduled_for, status)
    values ('10000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', '2026-10-23T08:00:00+05:30', 'taken') $$),
  1, 'the patient logs a dose');
-- Logging the same dose again updates the same row (the upsert logDose makes)
select is(
  public.tap_affected($$ insert into public.dose_logs (patient_id, item_id, scheduled_for, status)
    values ('10000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', '2026-10-23T08:00:00+05:30', 'skipped')
    on conflict (item_id, scheduled_for) do update set status = excluded.status $$),
  1, 'logging the same dose again writes');
select is(
  (select count(*)::int from public.dose_logs where item_id = '41000000-0000-0000-0000-000000000001'),
  1, 'and it is still one row');
select is(
  (select status from public.dose_logs where item_id = '41000000-0000-0000-0000-000000000001'),
  'skipped', 'the last write wins');
-- Undo (the delete undoDose makes) removes it
select is(
  public.tap_affected($$ delete from public.dose_logs
    where patient_id = '10000000-0000-0000-0000-000000000001'
      and item_id = '41000000-0000-0000-0000-000000000001'
      and scheduled_for = '2026-10-23T08:00:00+05:30'
      and status in ('taken', 'skipped') $$),
  1, 'undo removes the logged dose');

-- A missed row (the missed-dose check's record) is never removed by undo
reset role;
insert into public.dose_logs (patient_id, item_id, scheduled_for, status) values
  ('10000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', '2026-10-23T20:00:00+05:30', 'missed');
select public.tap_login('10000000-0000-0000-0000-000000000001'); set local role authenticated;
select is(
  public.tap_affected($$ delete from public.dose_logs
    where patient_id = '10000000-0000-0000-0000-000000000001'
      and item_id = '41000000-0000-0000-0000-000000000001'
      and scheduled_for = '2026-10-23T20:00:00+05:30'
      and status in ('taken', 'skipped') $$),
  0, 'undo never removes a missed row');

-- Another patient can neither see nor delete A's rows
select public.tap_login('10000000-0000-0000-0000-000000000002'); set local role authenticated;
select is(
  (select count(*)::int from public.dose_logs where patient_id = '10000000-0000-0000-0000-000000000001'),
  0, 'patient B cannot see patient A''s dose logs');
select is(
  public.tap_affected($$ delete from public.dose_logs where item_id = '41000000-0000-0000-0000-000000000001' $$),
  0, 'and cannot delete them');
reset role;
select is(
  (select count(*)::int from public.dose_logs where patient_id = '10000000-0000-0000-0000-000000000001'),
  1, 'the missed row is still there');

select * from finish();
rollback;
