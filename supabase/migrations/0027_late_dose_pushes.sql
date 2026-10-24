-- supabase/migrations/0027_late_dose_pushes.sql
-- Late-dose nudges (issue #495 step 3): one row per dose slot, holding the two send
-- claims so neither send ever repeats: sent_at is stamped when the patient nudge is
-- claimed, caregiver_sent_at when the caregiver escalation is claimed — each before its
-- send goes out, each cleared again when nothing was delivered. A row the escalation
-- claimed first leaves sent_at null: the patient was never told, and the escalation does
-- not depend on the patient having a phone. Written only by the server (the cron), like
-- missed_dose_alerts — no policies. The patient's switch is a plain column on profiles,
-- on by default.
-- Owner: Vaibhav Parmar

alter table public.profiles
  add column late_dose_nudge boolean not null default true;

create table public.late_dose_pushes (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  item_id uuid not null references public.prescription_items(id) on delete cascade,
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  caregiver_sent_at timestamptz,
  unique (item_id, scheduled_for)
);
alter table public.late_dose_pushes enable row level security;
