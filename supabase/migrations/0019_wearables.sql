-- 0019_wearables.sql
-- Where device readings live (issue #325, ADR-073): the phone's own health store (Health Connect
-- on Android, HealthKit on iOS) is the source; Vyana stores aggregates only — one row a day in
-- daily_activity, plus single spot readings in vitals, which learn where they came from. Never
-- raw per-second data. Owner: Vaibhav Parmar
--
-- A device reading is never a diagnosis and raises no alert of its own; nothing in this file
-- computes a trend or a threshold. The sync engine that fills these tables is #326; the native
-- build and the app.json plugins are Piyush's.

-- ---------------------------------------------------------------------------
-- vitals: where a reading came from
-- ---------------------------------------------------------------------------

alter table public.vitals
  add column source text not null default 'manual'
    check (source in ('manual', 'health_connect', 'healthkit', 'ble')),
  add column device_name text,
  add column external_id text;

-- A device reading is stored once: the source's own id for it (a Health Connect record id, a
-- HealthKit sample uuid) makes a second sync of the same reading a no-op. Manual rows carry no
-- external id and are never deduped against each other, so the index is partial.
create unique index idx_vitals_source_external_id
  on public.vitals (patient_id, source, external_id)
  where external_id is not null;

-- The vitals policies (0002) are unchanged: they key on patient_id, so manual entries keep
-- working exactly as before, and a doctor of the patient can read device rows like any other.

-- ---------------------------------------------------------------------------
-- daily_activity: one row per patient, day and source
-- ---------------------------------------------------------------------------

create table public.daily_activity (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  steps int check (steps is null or steps between 0 and 200000),
  active_minutes int check (active_minutes is null or active_minutes between 0 and 1440),
  distance_m int check (distance_m is null or distance_m >= 0),
  sleep_minutes int check (sleep_minutes is null or sleep_minutes between 0 and 1440),
  resting_hr int check (resting_hr is null or resting_hr between 20 and 250),
  source text not null check (source in ('manual', 'health_connect', 'healthkit', 'ble')),
  device_name text,
  updated_at timestamptz not null default now(),
  unique (patient_id, day, source)
);
create index idx_daily_activity_patient_day on public.daily_activity(patient_id, day);

alter table public.daily_activity enable row level security;

create policy "daily_activity_select" on public.daily_activity
  for select to authenticated using ((select auth.uid()) = patient_id or public.is_doctor_of(patient_id));
create policy "daily_activity_insert" on public.daily_activity
  for insert to authenticated with check ((select auth.uid()) = patient_id);
create policy "daily_activity_update" on public.daily_activity
  for update to authenticated using ((select auth.uid()) = patient_id) with check ((select auth.uid()) = patient_id);
create policy "daily_activity_delete" on public.daily_activity
  for delete to authenticated using ((select auth.uid()) = patient_id);

-- Signed-out visitors get nothing (0002 already revokes future tables from anon; said again here
-- so this file stands on its own). Signed-in users write only the columns the sync writes: the
-- key columns are in the update grant because an upsert names them when it updates.
revoke all on public.daily_activity from anon;
revoke insert, update on public.daily_activity from authenticated;
grant insert (patient_id, day, steps, active_minutes, distance_m, sleep_minutes, resting_hr, source, device_name)
  on public.daily_activity to authenticated;
grant update (patient_id, day, steps, active_minutes, distance_m, sleep_minutes, resting_hr, source, device_name)
  on public.daily_activity to authenticated;

drop trigger if exists trg_daily_activity_touch on public.daily_activity;
create trigger trg_daily_activity_touch
  before update on public.daily_activity
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- device_connections: one row per patient and provider
-- ---------------------------------------------------------------------------

create table public.device_connections (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('health_connect', 'healthkit', 'ble')),
  status text not null default 'connected' check (status in ('connected', 'paused', 'revoked')),
  permissions text[] not null default '{}',
  last_sync_at timestamptz,
  -- A short code only ('permission_denied', 'not_installed', ...), never a value or a message
  -- from the device: an error string can carry anything the platform puts in it.
  last_error text check (last_error is null or char_length(last_error) <= 60),
  created_at timestamptz not null default now(),
  unique (patient_id, provider)
);
create index idx_device_connections_patient on public.device_connections(patient_id);

alter table public.device_connections enable row level security;

create policy "device_connections_select" on public.device_connections
  for select to authenticated using ((select auth.uid()) = patient_id or public.is_doctor_of(patient_id));
create policy "device_connections_insert" on public.device_connections
  for insert to authenticated with check ((select auth.uid()) = patient_id);
create policy "device_connections_update" on public.device_connections
  for update to authenticated using ((select auth.uid()) = patient_id) with check ((select auth.uid()) = patient_id);
create policy "device_connections_delete" on public.device_connections
  for delete to authenticated using ((select auth.uid()) = patient_id);

revoke all on public.device_connections from anon;
revoke insert, update on public.device_connections from authenticated;
grant insert (patient_id, provider, status, permissions, last_sync_at, last_error)
  on public.device_connections to authenticated;
grant update (patient_id, provider, status, permissions, last_sync_at, last_error)
  on public.device_connections to authenticated;

-- ---------------------------------------------------------------------------
-- "Disconnect and delete my device data" (ADR-073): the caller's device rows go,
-- their manual entries stay, and every connection is left revoked, not deleted —
-- the app shows that a device was connected once and no longer is.
-- ---------------------------------------------------------------------------

create function public.delete_my_device_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'sign-in required' using errcode = '42501';
  end if;
  delete from public.vitals where patient_id = v_uid and source <> 'manual';
  delete from public.daily_activity where patient_id = v_uid;
  update public.device_connections set status = 'revoked' where patient_id = v_uid;
end;
$$;

revoke execute on function public.delete_my_device_data() from public, anon;
grant execute on function public.delete_my_device_data() to authenticated;
