-- supabase/tests/database/review_requests.test.sql
-- Doctor review requests (issue #498): the state machine — who may move a request, which
-- moves are legal, the note a rejection owes the patient, the frozen text, and the audit
-- row every move writes. Run with: supabase test db
-- Owner: Vaibhav Parmar

begin;
create extension if not exists pgtap with schema extensions;

select plan(36);

insert into auth.users (id, email, raw_user_meta_data) values
  ('10000000-0000-0000-0000-000000000001', 'a@vyana.test', '{"full_name":"Patient A"}'),
  ('10000000-0000-0000-0000-000000000002', 'b@vyana.test', '{"full_name":"Patient B"}'),
  ('10000000-0000-0000-0000-000000000003', 'd1@vyana.test', '{"full_name":"Dr One","role":"doctor"}'),
  ('10000000-0000-0000-0000-000000000004', 'd2@vyana.test', '{"full_name":"Dr Two","role":"doctor"}');
-- The link #498 requires: Dr One treats Patient A (an appointment), Dr Two does not.
-- Plus the subjects the requests point at: A's lab report and care plan, and B's own
-- lab report (which A must not be able to name).
insert into public.hospitals (id, name, kind) values ('20000000-0000-0000-0000-000000000001', 'Test Hospital', 'government');
insert into public.departments (id, hospital_id, name) values ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'General Medicine');
insert into public.doctors (id, specialization, reg_no, state_council, department_id) values
  ('10000000-0000-0000-0000-000000000003', 'General Medicine', 'TEST-REG-1', 'Delhi Medical Council', '30000000-0000-0000-0000-000000000001');
insert into public.appointments (patient_id, doctor_id, hospital_id, department_id, appointment_date, token_no, status) values
  ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '2026-10-01', 991, 'confirmed');
insert into public.lab_reports (id, patient_id, file_path) values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'a/report.pdf'),
  ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'b/report.pdf');
insert into public.conditions (id, patient_id, name) values
  ('42000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Type 2 Diabetes');
insert into public.care_plans (id, patient_id, condition_id, status, plan_json) values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '42000000-0000-0000-0000-000000000001', 'draft', '{}');
-- Supabase grants table access to authenticated by default and lets the policies decide;
-- this local harness does not, so grant what the platform would.
grant select, insert, update on public.review_requests to authenticated;
grant select on public.review_events to authenticated;

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

-- The patient creates a draft; nobody can create one in someone else's name or pre-sent
select public.tap_login('10000000-0000-0000-0000-000000000001'); set local role authenticated;
select lives_ok(
  $$ insert into public.review_requests (id, patient_id, doctor_id, subject_type, subject_id, ai_text, sources)
     values ('51000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
             '10000000-0000-0000-0000-000000000003', 'lab_summary', '40000000-0000-0000-0000-000000000001',
             'Your sugar is high.', '[]') $$,
  'the patient creates a draft of their own AI text');
select throws_ok(
  $$ insert into public.review_requests (patient_id, doctor_id, subject_type, subject_id, ai_text, status)
     values ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003',
             'lab_summary', '40000000-0000-0000-0000-000000000001', 'x', 'pending') $$,
  '42501', null, 'a request cannot be created already sent');
select public.tap_login('10000000-0000-0000-0000-000000000002'); set local role authenticated;
select throws_ok(
  $$ insert into public.review_requests (patient_id, doctor_id, subject_type, subject_id, ai_text)
     values ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003',
             'lab_summary', '40000000-0000-0000-0000-000000000001', 'x') $$,
  '42501', null, 'and nobody creates one in another patient''s name');
-- The draft must be addressed to a linked doctor, born undecided, about the patient's own subject
select public.tap_login('10000000-0000-0000-0000-000000000001'); set local role authenticated;
select throws_ok(
  $$ insert into public.review_requests (patient_id, doctor_id, subject_type, subject_id, ai_text)
     values ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004',
             'lab_summary', '40000000-0000-0000-0000-000000000001', 'x') $$,
  '42501', null, 'a doctor with no link to the patient cannot be addressed');
select throws_ok(
  $$ insert into public.review_requests (patient_id, doctor_id, subject_type, subject_id, ai_text, edited_text)
     values ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003',
             'lab_summary', '40000000-0000-0000-0000-000000000001', 'x', 'pre-written answer') $$,
  '42501', null, 'a draft cannot be born with an edited text');
select throws_ok(
  $$ insert into public.review_requests (patient_id, doctor_id, subject_type, subject_id, ai_text, decided_at)
     values ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003',
             'lab_summary', '40000000-0000-0000-0000-000000000001', 'x', now()) $$,
  '42501', null, 'or with a decision already made');
select throws_ok(
  $$ insert into public.review_requests (patient_id, doctor_id, subject_type, subject_id, ai_text, sources)
     values ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003',
             'lab_summary', '40000000-0000-0000-0000-000000000001', 'x', '{"not":"an array"}') $$,
  '23514', null, 'the sources must be a JSON array');
select throws_ok(
  $$ insert into public.review_requests (patient_id, doctor_id, subject_type, subject_id, ai_text)
     values ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003',
             'lab_summary', '40000000-0000-0000-0000-000000000002', 'x') $$,
  '22023', null, 'the subject must be the patient''s own report, not another patient''s');
select public.tap_login('10000000-0000-0000-0000-000000000002'); set local role authenticated;
select is(
  (select count(*)::int from public.review_requests),
  0, 'an unrelated patient reads no requests');
select public.tap_login('10000000-0000-0000-0000-000000000003'); set local role authenticated;
select is(
  (select count(*)::int from public.review_requests),
  1, 'the addressed doctor reads it');

-- No plain update moves a request
select public.tap_login('10000000-0000-0000-0000-000000000001'); set local role authenticated;
select is(
  public.tap_affected($$ update public.review_requests set status = 'pending' where id = '51000000-0000-0000-0000-000000000001' $$),
  0, 'a plain update cannot move a request');

-- The moves, legal and not
select throws_ok(
  $$ select public.transition_review('51000000-0000-0000-0000-000000000001', 'confirmed') $$,
  '22023', null, 'a draft cannot jump to confirmed');
select public.tap_login('10000000-0000-0000-0000-000000000003'); set local role authenticated;
select throws_ok(
  $$ select public.transition_review('51000000-0000-0000-0000-000000000001', 'pending') $$,
  '42501', null, 'the doctor cannot send the patient''s request');
select public.tap_login('10000000-0000-0000-0000-000000000001'); set local role authenticated;
select is(
  (select status from public.transition_review('51000000-0000-0000-0000-000000000001', 'pending')),
  'pending', 'the patient sends it');
select ok(
  (select expires_at > now() + interval '6 days' from public.review_requests where id = '51000000-0000-0000-0000-000000000001'),
  'sending sets the 7-day expiry');
select is(
  (select from_status || '>' || to_status || '>' || actor_id::text from public.review_events
    where request_id = '51000000-0000-0000-0000-000000000001'),
  'draft>pending>10000000-0000-0000-0000-000000000001', 'and the move is in the audit trail');

select throws_ok(
  $$ select public.transition_review('51000000-0000-0000-0000-000000000001', 'rejected') $$,
  '42501', null, 'the patient cannot reject their own request');
select public.tap_login('10000000-0000-0000-0000-000000000004'); set local role authenticated;
select throws_ok(
  $$ select public.transition_review('51000000-0000-0000-0000-000000000001', 'confirmed') $$,
  '42501', null, 'another doctor cannot confirm it');
select public.tap_login('10000000-0000-0000-0000-000000000003'); set local role authenticated;
select throws_ok(
  $$ select public.transition_review('51000000-0000-0000-0000-000000000001', 'rejected') $$,
  '22023', null, 'a rejection without a note is refused');
select is(
  (select status || '|' || edited_text from public.transition_review(
     '51000000-0000-0000-0000-000000000001', 'confirmed', null, 'Your sugar is high; recheck in a month.')),
  'confirmed|Your sugar is high; recheck in a month.', 'the addressed doctor confirms with an edited text');
select public.tap_login('10000000-0000-0000-0000-000000000001'); set local role authenticated;
select throws_ok(
  $$ select public.transition_review('51000000-0000-0000-0000-000000000001', 'pending') $$,
  '22023', null, 'a confirmed request is finished: no move out of it');

-- A second request: an edited text cannot ride on a rejection, and expiry is the cron's
reset role;
insert into public.review_requests (id, patient_id, doctor_id, subject_type, subject_id, ai_text, status, expires_at) values
  ('51000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000003', 'care_plan', '40000000-0000-0000-0000-000000000001',
   'Walk daily.', 'pending', now() - interval '1 hour');
select public.tap_login('10000000-0000-0000-0000-000000000003'); set local role authenticated;
select throws_ok(
  $$ select public.transition_review('51000000-0000-0000-0000-000000000002', 'rejected', 'Not safe', 'Walk weekly.') $$,
  '22023', null, 'an edited text can only ride on a confirmation');
reset role;
select is(public.expire_review_requests(), 1, 'the overdue request expires');
select is(
  (select status from public.review_requests where id = '51000000-0000-0000-0000-000000000002'),
  'expired', 'and is marked expired');
select is(
  (select count(*)::int from public.review_events where request_id = '51000000-0000-0000-0000-000000000002' and to_status = 'expired' and actor_id is null),
  1, 'with its own audit row, written by no user');

-- The happy paths the suite owed: a rejection that lands, and a plain confirmation
select public.tap_login('10000000-0000-0000-0000-000000000001'); set local role authenticated;
select lives_ok(
  $$ insert into public.review_requests (id, patient_id, doctor_id, subject_type, subject_id, ai_text, sources)
     values ('51000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001',
             '10000000-0000-0000-0000-000000000003', 'lab_summary', '40000000-0000-0000-0000-000000000001',
             'Your sugar is high.', '[]') $$,
  'a third request is created');
select is(
  (select status from public.transition_review('51000000-0000-0000-0000-000000000003', 'pending')),
  'pending', 'and sent');
select public.tap_login('10000000-0000-0000-0000-000000000003'); set local role authenticated;
select is(
  (select status from public.transition_review('51000000-0000-0000-0000-000000000003', 'rejected', 'Please recheck with a fasting sample first.')),
  'rejected', 'the addressed doctor rejects it, with the note');
select ok(
  (select decided_at is not null from public.review_requests where id = '51000000-0000-0000-0000-000000000003'),
  'the rejection stamps decided_at');
select is(
  (select note from public.review_events where request_id = '51000000-0000-0000-0000-000000000003' and to_status = 'rejected'),
  'Please recheck with a fasting sample first.', 'and the note the patient reads is in the audit row');

select public.tap_login('10000000-0000-0000-0000-000000000001'); set local role authenticated;
select lives_ok(
  $$ insert into public.review_requests (id, patient_id, doctor_id, subject_type, subject_id, ai_text, sources)
     values ('51000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001',
             '10000000-0000-0000-0000-000000000003', 'lab_summary', '40000000-0000-0000-0000-000000000001',
             'Your sugar is high.', '[]') $$,
  'a fourth request is created');
select is(
  (select status from public.transition_review('51000000-0000-0000-0000-000000000004', 'pending')),
  'pending', 'and sent');
select public.tap_login('10000000-0000-0000-0000-000000000003'); set local role authenticated;
select is(
  (select status from public.transition_review('51000000-0000-0000-0000-000000000004', 'confirmed')),
  'confirmed', 'the doctor confirms it as written, no edited text');
select ok(
  (select edited_text is null and decided_at is not null from public.review_requests where id = '51000000-0000-0000-0000-000000000004'),
  'with no edited text and a decision time');

-- The switch-on functions, as the service role
reset role;
set local role service_role;
select public.schedule_review_expiry();
select is(
  (select schedule || '|' || command from cron.job where jobname = 'review-requests-expiry'),
  '0 21 * * *|select public.expire_review_requests()',
  'scheduling creates the nightly expiry job');
select public.unschedule_review_expiry();
select is(
  (select count(*)::int from cron.job where jobname = 'review-requests-expiry'),
  0, 'unscheduling removes it');

select * from finish();
rollback;
