-- supabase/migrations/0028_review_requests.sql
-- "Ask my doctor to confirm" (issue #498, step 2 — the tables and the function Piyush
-- asked Vaibhav for; the API and contract are #498's own steps): a patient freezes an
-- AI-generated summary into a review request for their own doctor; the doctor confirms,
-- edits or rejects it. The status moves only through transition_review() — never by a
-- plain update — and every move writes one review_events row (who, when, from, to, note).
-- Owner: Vaibhav Parmar

create table public.review_requests (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  -- Nullable, and set null when the doctor's profile goes: the account-deletion policy
  -- (0010) converts doctor references to null rather than erasing the patient's records —
  -- a doctor deleting their account must not take the patient's requests, or the audit
  -- trail in review_events, with them.
  doctor_id uuid references public.profiles(id) on delete set null,
  subject_type text not null check (subject_type in ('lab_summary', 'care_plan')),
  -- The lab report or care plan this summary belongs to. No foreign key: the subject
  -- lives in one of two tables, and the frozen text below is what the doctor reviews.
  subject_id uuid not null,
  -- The frozen copy of the AI text at request time; a later regeneration cannot change
  -- what the doctor reviewed.
  ai_text text not null check (char_length(ai_text) <= 20000),
  -- The sources the AI cited: always a JSON array, never an arbitrary shape.
  sources jsonb not null default '[]'::jsonb check (jsonb_typeof(sources) = 'array'),
  status text not null default 'draft'
    check (status in ('draft', 'pending', 'confirmed', 'rejected', 'expired')),
  -- The doctor's replacement text, set only by a confirmation that carries one.
  edited_text text check (edited_text is null or char_length(edited_text) <= 20000),
  expires_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.review_requests enable row level security;

create index review_requests_doctor_status_idx on public.review_requests (doctor_id, status);
create index review_requests_patient_idx on public.review_requests (patient_id, created_at desc);

create table public.review_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.review_requests(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  from_status text,
  to_status text not null,
  note text check (note is null or char_length(note) <= 2000),
  created_at timestamptz not null default now()
);
alter table public.review_events enable row level security;

-- Is this doctor linked to this patient, as #498 requires — the same link is_doctor_of
-- uses (0002): a non-cancelled appointment with the doctor, or in the queue of the
-- doctor's verified department — and the addressee really is a doctor, not the patient
-- themself or any other profile. Security definer so the policy below can see the link
-- regardless of the caller's own row visibility.
create or replace function public.review_doctor_linked(p_patient uuid, p_doctor uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_doctor <> p_patient
    and exists (select 1 from public.profiles d where d.id = p_doctor and d.role = 'doctor')
    and exists (
      select 1 from public.appointments a
      where a.patient_id = p_patient and a.status <> 'cancelled'
        and (a.doctor_id = p_doctor or a.department_id = (
          select department_id from public.doctors
          where id = p_doctor and verification_status = 'verified'
        ))
    )
    -- Only the patient themself may probe their own links (the service role, with no
    -- user id, may too); nobody else can use this to map who sees which doctor.
    and ((select auth.uid()) is null or (select auth.uid()) = p_patient);
$$;
revoke all on function public.review_doctor_linked(uuid, uuid) from public, anon;
grant execute on function public.review_doctor_linked(uuid, uuid) to authenticated, service_role;

-- The subject must be the patient's own: a lab_summary points at their lab report, a
-- care_plan at their care plan. A trigger, because a check constraint cannot look across
-- tables — without it a request could point at another patient's records.
create or replace function public.review_request_subject_owned()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.subject_type = 'lab_summary' then
    if not exists (select 1 from public.lab_reports where id = new.subject_id and patient_id = new.patient_id) then
      raise exception 'a lab summary review must name the patient''s own lab report' using errcode = '22023';
    end if;
  elsif new.subject_type = 'care_plan' then
    if not exists (select 1 from public.care_plans where id = new.subject_id and patient_id = new.patient_id) then
      raise exception 'a care plan review must name the patient''s own care plan' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;
create trigger review_requests_subject_owned
  before insert on public.review_requests
  for each row execute function public.review_request_subject_owned();

-- Reads: the patient sees their requests, the doctor sees the ones addressed to them.
-- Writes: a patient creates their own draft, addressed to a doctor already linked to
-- them, born undecided (no edited text, no decision time, no expiry — those arrive only
-- through the transitions below); nobody updates or deletes a request through the API,
-- and events are written by the function alone.
-- The patient reads everything of theirs; the addressed doctor reads a request only
-- once the patient has sent it — a draft is the patient's unsent text, frozen ai_text
-- and all, and is invisible to the doctor until it leaves draft.
create policy "review_requests_select_party" on public.review_requests
  for select to authenticated
  using (
    (select auth.uid()) = patient_id
    or ((select auth.uid()) = doctor_id and status <> 'draft')
  );
create policy "review_requests_insert_own_draft" on public.review_requests
  for insert to authenticated
  with check (
    (select auth.uid()) = patient_id and status = 'draft'
    and edited_text is null and decided_at is null and expires_at is null
    and public.review_doctor_linked(patient_id, doctor_id)
  );
create policy "review_events_select_party" on public.review_events
  for select to authenticated
  using (exists (
    select 1 from public.review_requests r
    where r.id = request_id
      and ((select auth.uid()) = r.patient_id or (select auth.uid()) = r.doctor_id)
  ));

-- The only way a request changes state. Actor rules: the patient sends their own draft;
-- the addressed doctor confirms (an edited text may ride along) or rejects (a note is
-- required — the patient reads it). Everything else is refused, including any move out
-- of a finished state. Expiry is the cron's function below, and this function honours
-- it too: a decision attempted after the deadline expires the request instead.
create or replace function public.transition_review(
  p_id uuid,
  p_to text,
  p_note text default null,
  p_edited_text text default null
)
returns public.review_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.review_requests;
  old_status text;
  actor uuid := (select auth.uid());
begin
  select * into req from public.review_requests where id = p_id for update;
  if not found then
    raise exception 'review request % not found', p_id using errcode = 'P0002';
  end if;
  old_status := req.status;
  if p_edited_text is not null and p_to <> 'confirmed' then
    raise exception 'an edited text can only be set when confirming' using errcode = '22023';
  end if;

  -- A doctor decision on a request whose time has run out lands as an expiry instead:
  -- the request moves to expired with its audit event (the same shape the nightly
  -- expire_review_requests() writes), and the decision itself is refused. Expiry is
  -- not only the cron's business — a request past its deadline must not be decidable
  -- just because the job has not run yet.
  if req.status = 'pending' and p_to in ('confirmed', 'rejected')
     and req.expires_at is not null and req.expires_at <= now() then
    update public.review_requests
      set status = 'expired', updated_at = now()
      where id = p_id;
    insert into public.review_events (request_id, actor_id, from_status, to_status, note)
    values (p_id, null, 'pending', 'expired', null);
    raise exception 'this review request has expired' using errcode = '22023';
  end if;

  if req.status = 'draft' and p_to = 'pending' then
    if actor is distinct from req.patient_id then
      raise exception 'only the patient can send their review request' using errcode = '42501';
    end if;
    update public.review_requests
      set status = 'pending', expires_at = now() + interval '7 days', updated_at = now()
      where id = p_id returning * into req;
  elsif req.status = 'pending' and p_to = 'confirmed' then
    if actor is distinct from req.doctor_id then
      raise exception 'only the addressed doctor can confirm this request' using errcode = '42501';
    end if;
    update public.review_requests
      set status = 'confirmed', edited_text = p_edited_text, decided_at = now(), updated_at = now()
      where id = p_id returning * into req;
  elsif req.status = 'pending' and p_to = 'rejected' then
    if actor is distinct from req.doctor_id then
      raise exception 'only the addressed doctor can reject this request' using errcode = '42501';
    end if;
    if p_note is null or btrim(p_note) = '' then
      raise exception 'a rejection needs a note for the patient' using errcode = '22023';
    end if;
    update public.review_requests
      set status = 'rejected', decided_at = now(), updated_at = now()
      where id = p_id returning * into req;
  else
    raise exception 'a review request cannot move from % to %', req.status, p_to using errcode = '22023';
  end if;

  insert into public.review_events (request_id, actor_id, from_status, to_status, note)
  values (p_id, actor, old_status, p_to, p_note);
  return req;
end;
$$;
revoke all on function public.transition_review(uuid, text, text, text) from public, anon;
grant execute on function public.transition_review(uuid, text, text, text) to authenticated, service_role;

-- The cron's half: every pending request past its expiry becomes expired, with its event.
create or replace function public.expire_review_requests()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  with due as (
    update public.review_requests
      set status = 'expired', updated_at = now()
      where status = 'pending' and expires_at is not null and expires_at <= now()
      returning id
  ), logged as (
    insert into public.review_events (request_id, actor_id, from_status, to_status, note)
    select id, null, 'pending', 'expired', null from due
    returning 1
  )
  select count(*)::int into n from logged;
  return n;
end;
$$;
revoke all on function public.expire_review_requests() from public, anon, authenticated;
grant execute on function public.expire_review_requests() to service_role;

-- The nightly job (02:30 IST) that makes expiry real, created only when Piyush switches
-- it on, like the care agent's (0024) and the weekly summaries' (0026):
-- select public.schedule_review_expiry();
create or replace function public.schedule_review_expiry()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_id bigint;
begin
  select jobid into job_id from cron.job where jobname = 'review-requests-expiry';
  if job_id is not null then
    return job_id;
  end if;
  return cron.schedule(
    'review-requests-expiry',
    '0 21 * * *',
    $job$select public.expire_review_requests()$job$
  );
end;
$$;
revoke all on function public.schedule_review_expiry() from public, anon, authenticated;
grant execute on function public.schedule_review_expiry() to service_role;

create or replace function public.unschedule_review_expiry()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform cron.unschedule('review-requests-expiry');
end;
$$;
revoke all on function public.unschedule_review_expiry() from public, anon, authenticated;
grant execute on function public.unschedule_review_expiry() to service_role;
