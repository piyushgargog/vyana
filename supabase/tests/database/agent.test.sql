-- supabase/tests/database/agent.test.sql
-- The care agent's tables (issue #302): proposals, actions, decide and expire.
-- Run with: supabase test db
-- Owner: Vaibhav Parmar

begin;
create extension if not exists pgtap with schema extensions;

select plan(22);

insert into auth.users (id, email, raw_user_meta_data) values
  ('10000000-0000-0000-0000-000000000021', 'p1@vyana.test', '{"full_name":"Patient One"}'),
  ('10000000-0000-0000-0000-000000000022', 'p2@vyana.test', '{"full_name":"Patient Two"}'),
  ('10000000-0000-0000-0000-000000000023', 'doc@vyana.test', '{"full_name":"Doctor"}');

create function public.tap_login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- A doctor with an appointment to patient one, and to nobody else.
insert into public.hospitals (id, name, kind) values ('20000000-0000-0000-0000-000000000021', 'Test Hospital', 'government');
insert into public.departments (id, hospital_id, name) values ('30000000-0000-0000-0000-000000000021', '20000000-0000-0000-0000-000000000021', 'Medicine');
insert into public.doctors (id, specialization, reg_no, state_council, verification_status, hospital_id, department_id) values
  ('10000000-0000-0000-0000-000000000023', 'Physician', 'T-21', 'Delhi', 'verified',
   '20000000-0000-0000-0000-000000000021', '30000000-0000-0000-0000-000000000021');
insert into public.appointments (patient_id, doctor_id, hospital_id, department_id, appointment_date, token_no) values
  ('10000000-0000-0000-0000-000000000021', '10000000-0000-0000-0000-000000000023',
   '20000000-0000-0000-0000-000000000021', '30000000-0000-0000-0000-000000000021', current_date, 1);

-- Proposals and actions, written the way the server writes them (as the owner).
insert into public.agent_proposals (id, patient_id, kind, title, reason, rule_id, dedupe_key, expires_at) values
  ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000021', 'refill_due', 'Metformin is running out', 'Four tablets left at the logged doses.', 'refill-v1', 'refill-metformin', now() + interval '1 day'),
  ('50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000021', 'lab_recheck', 'HbA1c is due again', 'The last HbA1c was three months ago.', 'lab-v1', 'lab-hba1c', now() - interval '1 hour'),
  ('50000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000022', 'refill_due', 'Inhaler is running out', 'Two doses left.', 'refill-v1', 'refill-inhaler', now() + interval '1 day');
insert into public.agent_actions (proposal_id, patient_id, action, status) values
  ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000021', 'notify_caregiver', 'ok'),
  ('50000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000022', 'create_reminder', 'ok');

select has_table('public', 'agent_proposals', 'the proposals table exists');
select has_table('public', 'agent_actions', 'the actions table exists');

-- The same suggestion cannot be open twice for one patient.
select throws_ok(
  $$ insert into public.agent_proposals (patient_id, kind, title, reason, dedupe_key)
     values ('10000000-0000-0000-0000-000000000021', 'refill_due', 'Again', 'Again.', 'refill-metformin') $$,
  '23505', null, 'a second pending proposal with the same dedupe key is refused');

-- As patient one: their own rows are readable, patient two's are not, and
-- nothing can be written directly.
select public.tap_login('10000000-0000-0000-0000-000000000021'); set local role authenticated;

select is((select count(*)::int from public.agent_proposals), 2, 'a patient reads their own proposals');
select is(
  (select count(*)::int from public.agent_proposals where patient_id = '10000000-0000-0000-0000-000000000022'),
  0, 'another patient''s proposals are invisible');
select is((select count(*)::int from public.agent_actions), 1, 'a patient reads their own actions');
select throws_ok(
  $$ insert into public.agent_proposals (patient_id, kind, title, reason) values ('10000000-0000-0000-0000-000000000021', 'refill_due', 'Mine', 'Mine.') $$,
  '42501', null, 'a patient cannot insert a proposal');
select throws_ok(
  $$ update public.agent_proposals set status = 'approved' where id = '50000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'a patient cannot decide by writing the table');

reset role;

-- Deciding someone else's proposal, and one that does not exist.
select public.tap_login('10000000-0000-0000-0000-000000000022'); set local role authenticated;

select throws_ok(
  $$ select * from public.decide_proposal('50000000-0000-0000-0000-000000000001', true) $$,
  '42501', null, 'a patient cannot decide another patient''s proposal');
select throws_ok(
  $$ select * from public.decide_proposal('50000000-0000-0000-0000-000000000099', true) $$,
  'P0002', null, 'an unknown proposal is refused');

reset role;

-- The owner decides: approve the refill, and the row comes back decided.
select public.tap_login('10000000-0000-0000-0000-000000000021'); set local role authenticated;

select results_eq(
  $$ select status from public.decide_proposal('50000000-0000-0000-0000-000000000001', true) $$,
  $$ values ('approved') $$,
  'approving sets the status');
select ok(
  (select decided_at from public.agent_proposals where id = '50000000-0000-0000-0000-000000000001') is not null,
  'approving stamps decided_at');
select throws_ok(
  $$ select * from public.decide_proposal('50000000-0000-0000-0000-000000000001', false) $$,
  'P0001', null, 'a decided proposal cannot be decided again');

reset role;

-- The dedupe key is free again once the proposal is decided.
select lives_ok(
  $$ insert into public.agent_proposals (patient_id, kind, title, reason, dedupe_key)
     values ('10000000-0000-0000-0000-000000000021', 'refill_due', 'Metformin again', 'Four tablets left.', 'refill-metformin') $$,
  'the same suggestion may be proposed again after a decision');

-- The lab proposal is past its expiry: deciding is refused, the sweep closes it.
select public.tap_login('10000000-0000-0000-0000-000000000021'); set local role authenticated;

select throws_ok(
  $$ select * from public.decide_proposal('50000000-0000-0000-0000-000000000002', true) $$,
  'P0001', null, 'an expired proposal cannot be decided');

reset role;
set local role service_role;

select is((select public.expire_proposals()), 1, 'the sweep expires exactly the overdue proposal');
select is(
  (select status from public.agent_proposals where id = '50000000-0000-0000-0000-000000000002'),
  'expired', 'the overdue proposal is expired');

reset role;

-- And its key is free again too.
select lives_ok(
  $$ insert into public.agent_proposals (patient_id, kind, title, reason, dedupe_key)
     values ('10000000-0000-0000-0000-000000000021', 'lab_recheck', 'HbA1c again', 'Due again.', 'lab-hba1c') $$,
  'the same suggestion may be proposed again after expiry');

-- The doctor of patient one reads their proposals and actions; patient two,
-- who has no appointment with this doctor, stays invisible.
select public.tap_login('10000000-0000-0000-0000-000000000023'); set local role authenticated;

select is(
  (select count(*)::int from public.agent_proposals where patient_id = '10000000-0000-0000-0000-000000000021'),
  4, 'the doctor reads their patient''s proposals');
select is((select count(*)::int from public.agent_actions), 1, 'the doctor reads their patient''s actions');
select is(
  (select count(*)::int from public.agent_proposals where patient_id = '10000000-0000-0000-0000-000000000022'),
  0, 'a patient with no appointment to this doctor stays invisible');
select throws_ok(
  $$ select * from public.expire_proposals() $$,
  '42501', null, 'the sweep is not a user function');

reset role;

select * from finish();
rollback;
