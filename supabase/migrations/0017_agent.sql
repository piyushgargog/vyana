-- 0017_agent.sql
-- The care agent's tables (issue #302): proposals, actions, and the two
-- functions that move a proposal. Owner: Vaibhav Parmar
--
-- The care agent never changes anything on its own. A rule (later, the server
-- loop) writes a proposal; the patient approves or rejects it; only then does
-- a whitelisted action run, and the action is logged here. These tables are
-- that paper trail:
--
--   agent_proposals  one suggestion: what kind, why, the words for the card,
--                    the evidence rows the rule used, and where it stands.
--   agent_actions    one row per action that ran for a proposal, with its
--                    result — the audit log the patient can read back.
--
-- Users never write either table directly. The server (service role) inserts
-- proposals and actions; a patient moves a proposal only through
-- decide_proposal(), and only their own, only while it is pending and
-- unexpired. Statuses are words, checked by the tables, so no code can invent
-- a state the app does not understand.

create table public.agent_proposals (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('refill_due', 'lab_recheck', 'missed_dose_pattern', 'visit_summary', 'care_plan_draft', 'follow_up_message')),
  title text not null,
  reason text not null,
  payload jsonb not null default '{}',
  evidence jsonb not null default '[]',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'expired', 'done', 'failed')),
  rule_id text,
  dedupe_key text,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  decided_at timestamptz
);

-- The agent cannot stack the same suggestion twice: while one is pending, a
-- second with the same dedupe key for the same patient is refused. A decided
-- or expired row frees the key, so the rule may propose again later. A null
-- key opts out (nulls never collide).
create unique index uq_agent_proposals_pending_dedupe
  on public.agent_proposals (patient_id, dedupe_key)
  where status = 'pending';

create index idx_agent_proposals_patient on public.agent_proposals (patient_id, created_at);
create index idx_agent_proposals_expiry on public.agent_proposals (expires_at) where status = 'pending';

create table public.agent_actions (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.agent_proposals(id) on delete cascade,
  patient_id uuid not null references public.profiles(id) on delete cascade,
  action text not null check (action in ('create_reminder', 'create_lab_recheck_reminder', 'notify_caregiver', 'draft_appointment_request', 'open_refill_links')),
  status text not null check (status in ('ok', 'failed')),
  result jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index idx_agent_actions_proposal on public.agent_actions (proposal_id);
create index idx_agent_actions_patient on public.agent_actions (patient_id, created_at);

-- Reading: the patient reads their own; a doctor reads their patients'
-- (is_doctor_of, 0002). Writing: nobody but the service role — the grants
-- below give select only, and there are no write policies.
alter table public.agent_proposals enable row level security;
create policy "agent_proposals_select" on public.agent_proposals
  for select to authenticated
  using ((select auth.uid()) = patient_id or public.is_doctor_of(patient_id));

alter table public.agent_actions enable row level security;
create policy "agent_actions_select" on public.agent_actions
  for select to authenticated
  using ((select auth.uid()) = patient_id or public.is_doctor_of(patient_id));

-- An audit trail holds no write privileges at all for user roles (the same
-- shape as 0016): everything is revoked first, then select alone is granted.
revoke all on public.agent_proposals, public.agent_actions from anon, authenticated;
grant select on public.agent_proposals, public.agent_actions to authenticated, service_role;

-- Decide a proposal: approve or reject. Only the patient it belongs to, only
-- while it is pending, and only before it expires — past its expiry the call
-- is refused and the row is left for expire_proposals() to close, so a late
-- tap never approves a stale suggestion. Sets decided_at and hands the row back.
-- The decision is a single guarded update: the row is claimed only while it
-- is the caller's, pending and unexpired, so two calls at the same time
-- cannot both win (the loser updates nothing and gets the "already decided"
-- error from the read that follows) and a call racing expire_proposals()
-- can never flip an expired row back.
-- search_path is empty on purpose (the issue asks for it): every name below
-- is fully qualified.
create or replace function public.decide_proposal(p_proposal_id uuid, p_approve boolean)
returns public.agent_proposals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.agent_proposals;
  v_uid uuid := (select auth.uid());
begin
  -- The caller must be a signed-in user. auth.uid() is null for the anon key
  -- and would make the ownership comparison below quietly not-true rather
  -- than false, so the null case is refused here by name.
  if v_uid is null then
    raise exception 'decide_proposal: sign-in required' using errcode = '42501';
  end if;

  update public.agent_proposals
  set status = case when p_approve then 'approved' else 'rejected' end,
      decided_at = now()
  where id = p_proposal_id
    and patient_id = v_uid
    and status = 'pending'
    and (expires_at is null or expires_at > now())
  returning * into v_row;

  if not found then
    -- Nothing was claimed. Read the row once to answer with the right error;
    -- a proposal can never move back to pending, so this classification
    -- cannot be raced into a wrong success.
    select * into v_row from public.agent_proposals where id = p_proposal_id;
    if not found then
      raise exception 'decide_proposal: proposal not found' using errcode = 'P0002';
    end if;
    if v_row.patient_id <> v_uid then
      raise exception 'decide_proposal: not your proposal' using errcode = '42501';
    end if;
    if v_row.status <> 'pending' then
      raise exception 'decide_proposal: proposal already decided' using errcode = 'P0001';
    end if;
    raise exception 'decide_proposal: proposal expired' using errcode = 'P0001';
  end if;

  return v_row;
end;
$$;

revoke all on function public.decide_proposal(uuid, boolean) from public, anon;
grant execute on function public.decide_proposal(uuid, boolean) to authenticated, service_role;

-- Close every pending proposal whose expiry has passed, and say how many.
-- Runs from its own cron job below (the same quarter hour as the missed-dose
-- check); the service role may also call it directly.
create or replace function public.expire_proposals()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  update public.agent_proposals
  set status = 'expired'
  where status = 'pending' and expires_at is not null and expires_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.expire_proposals() from public, anon, authenticated;
grant execute on function public.expire_proposals() to service_role;

select cron.schedule('expire-proposals', '*/15 * * * *', $job$select public.expire_proposals()$job$);
