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
  doctor_id uuid not null references public.profiles(id) on delete cascade,
  subject_type text not null check (subject_type in ('lab_summary', 'care_plan')),
  -- The lab report or care plan this summary belongs to. No foreign key: the subject
  -- lives in one of two tables, and the frozen text below is what the doctor reviews.
  subject_id uuid not null,
  -- The frozen copy of the AI text at request time; a later regeneration cannot change
  -- what the doctor reviewed.
  ai_text text not null,
  sources jsonb not null default '[]'::jsonb,
  status text not null default 'draft'
    check (status in ('draft', 'pending', 'confirmed', 'rejected', 'expired')),
  -- The doctor's replacement text, set only by a confirmation that carries one.
  edited_text text,
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
  note text,
  created_at timestamptz not null default now()
);
alter table public.review_events enable row level security;

-- Reads: the patient sees their requests, the doctor sees the ones addressed to them.
-- Writes: a patient creates their own draft; nobody updates or deletes a request through
-- the API (transitions are the function's below), and events are written by it alone.
create policy "review_requests_select_party" on public.review_requests
  for select to authenticated
  using ((select auth.uid()) = patient_id or (select auth.uid()) = doctor_id);
create policy "review_requests_insert_own_draft" on public.review_requests
  for insert to authenticated
  with check ((select auth.uid()) = patient_id and status = 'draft');
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
-- of a finished state. Expiry is the cron's own function below.
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
