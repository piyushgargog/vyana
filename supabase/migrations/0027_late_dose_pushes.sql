-- supabase/migrations/0027_late_dose_pushes.sql
-- Late-dose nudges (issue #495 step 3): one row per dose slot the patient was nudged
-- about, so the nudge never repeats; caregiver_sent_at marks the later escalation on the
-- same row. Written only by the server (the cron), like missed_dose_alerts — no policies.
-- The patient's switch is a plain column on profiles, on by default.
-- Owner: Vaibhav Parmar

alter table public.profiles
  add column late_dose_nudge boolean not null default true;

create table public.late_dose_pushes (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  item_id uuid not null references public.prescription_items(id) on delete cascade,
  scheduled_for timestamptz not null,
  sent_at timestamptz not null default now(),
  caregiver_sent_at timestamptz,
  unique (item_id, scheduled_for)
);
alter table public.late_dose_pushes enable row level security;
