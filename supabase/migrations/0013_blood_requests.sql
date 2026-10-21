-- 0013_blood_requests.sql
-- The tracker behind RapidBlood (issue #235): one row is one request for blood that a patient is
-- following, from "searching" to "received". Owner: Vaibhav Parmar
--
-- The search itself (blood banks with listed stock) is the server's job (#234) and keeps no table
-- here. This table holds only what the patient typed in and the state they set while following up:
-- the screens (#236) read and write it through the hooks in packages/shared, and Arvind's UI is
-- built on those hooks. The Memory Graph columns for share links are NOT here: they have their own
-- migration (0014, issue #237) so RapidBlood can ship without them.
--
-- Blood groups and components use the words of the v1.1 contracts (#233). Units are capped at 10:
-- a single request for more than that is a hospital's blood bank talking to other blood banks, not
-- a patient asking for help.

create table public.blood_requests (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  blood_group text not null check (blood_group in ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  component text not null check (component in ('whole_blood', 'red_cells', 'platelets', 'plasma')),
  units int not null check (units between 1 and 10),
  hospital_name text not null,
  city text not null,
  contact_name text not null,
  contact_phone text not null,
  status text not null default 'searching'
    check (status in ('searching', 'contacted', 'confirmed', 'arranged', 'received', 'cancelled')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_blood_requests_patient_id on public.blood_requests(patient_id);

-- Owner-only, like the issue asks: the patient who made a request is the only signed-in user who
-- can see it or change it. Not the doctor-of and admin reads that vitals allows: a blood request
-- carries a family member's phone number and is nobody else's business.
alter table public.blood_requests enable row level security;

create policy "blood_requests_select" on public.blood_requests
  for select to authenticated using ((select auth.uid()) = patient_id);
create policy "blood_requests_insert" on public.blood_requests
  for insert to authenticated with check ((select auth.uid()) = patient_id);
create policy "blood_requests_update" on public.blood_requests
  for update to authenticated using ((select auth.uid()) = patient_id) with check ((select auth.uid()) = patient_id);
create policy "blood_requests_delete" on public.blood_requests
  for delete to authenticated using ((select auth.uid()) = patient_id);

-- Signed-out visitors get nothing (0002 already revokes future tables from anon; said again here
-- so this file stands on its own). Signed-in users write only the columns the app writes: the id
-- and both timestamps are the database's, and a request is created as "searching" — its later
-- states are set by an update, never by the insert.
revoke all on public.blood_requests from anon;
revoke insert, update on public.blood_requests from authenticated;
grant insert (patient_id, blood_group, component, units, hospital_name, city, contact_name, contact_phone, note)
  on public.blood_requests to authenticated;
grant update (blood_group, component, units, hospital_name, city, contact_name, contact_phone, status, note)
  on public.blood_requests to authenticated;

-- updated_at follows every change, by the same trigger function the care plans use (0002).
drop trigger if exists trg_blood_requests_touch on public.blood_requests;
create trigger trg_blood_requests_touch
  before update on public.blood_requests
  for each row execute function public.touch_updated_at();
