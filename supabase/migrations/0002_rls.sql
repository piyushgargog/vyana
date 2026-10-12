-- 0002_rls.sql
-- Row level security, helper functions and RPCs for Vyana: plan sections 5.2 and 5.6
-- Owner: Vaibhav Parmar
--
-- Who is who (Supabase roles):
--   authenticated = a signed-in app user, service_role = our server, postgres / supabase_admin = migrations and seed.
-- Every table has RLS on. A table with no policy (web_cache, tinyfish_monitors, missed_dose_alerts,
-- care_invite_attempts) is reachable only through the service role.

-- ============================================================================
-- HELPER FUNCTIONS
-- Every security definer function pins search_path (Supabase security advisor).
-- ============================================================================

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- An active caregiver link: the signed-in user looks after patient p.
create or replace function public.is_caregiver_of(p uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.care_links
    where patient_id = p and caregiver_id = auth.uid() and status = 'active'
  );
$$;

-- The department of the signed-in user, only when they are a verified doctor (null otherwise).
create or replace function public.my_verified_department()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select department_id from public.doctors where id = auth.uid() and verification_status = 'verified';
$$;

-- The signed-in doctor treats patient p: an appointment with them, or in the queue of their
-- (verified) department. Cancelled appointments do not count.
create or replace function public.is_doctor_of(p uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.appointments a
    where a.patient_id = p and a.status <> 'cancelled'
      and (a.doctor_id = auth.uid() or a.department_id = public.my_verified_department())
  );
$$;

-- ============================================================================
-- TRIGGER GUARDS (security invoker: current_user is the real caller)
-- ============================================================================

-- Nobody but the server, the seed or an admin may change a role.
create or replace function public.prevent_role_change()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and current_user not in ('postgres', 'service_role', 'supabase_admin')
     and not public.is_admin() then
    raise exception 'role can only be changed by an admin';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_role_change on public.profiles;
create trigger trg_prevent_role_change
  before update on public.profiles
  for each row execute function public.prevent_role_change();

-- Verification, hospital and department of a doctor are set by the server or an admin only,
-- on insert and on update. Otherwise a doctor could self-verify or join any department queue.
create or replace function public.check_doctor_verification_update()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') or public.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.verification_status <> 'pending' or new.verification_json is not null or new.verified_at is not null
       or new.hospital_id is not null or new.department_id is not null then
      raise exception 'verification, hospital and department are set by the server only';
    end if;
  elsif new.verification_status is distinct from old.verification_status
     or new.verification_json is distinct from old.verification_json
     or new.verified_at is distinct from old.verified_at
     or new.hospital_id is distinct from old.hospital_id
     or new.department_id is distinct from old.department_id then
    raise exception 'verification, hospital and department are set by the server only';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_check_doctor_verification_update on public.doctors;
create trigger trg_check_doctor_verification_update
  before insert or update on public.doctors
  for each row execute function public.check_doctor_verification_update();

-- The patient of an appointment may cancel it but never writes the doctor's notes.
create or replace function public.check_appointment_update()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() = old.patient_id and new.doctor_notes is distinct from old.doctor_notes then
    raise exception 'only the doctor can write notes';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_check_appointment_update on public.appointments;
create trigger trg_check_appointment_update
  before update on public.appointments
  for each row execute function public.check_appointment_update();

-- For a prescription a doctor wrote, the patient may only switch a medicine on or off.
create or replace function public.check_prescription_item_update()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() = old.patient_id
     and exists (select 1 from public.prescriptions p where p.id = old.prescription_id and p.source = 'doctor')
     and (to_jsonb(new) - 'active') is distinct from (to_jsonb(old) - 'active') then
    raise exception 'a prescription written by a doctor can only be switched on or off';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_check_prescription_item_update on public.prescription_items;
create trigger trg_check_prescription_item_update
  before update on public.prescription_items
  for each row execute function public.check_prescription_item_update();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_care_plans_touch on public.care_plans;
create trigger trg_care_plans_touch
  before update on public.care_plans
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- RPCs
-- ============================================================================

-- ORS-style booking: a token per department and day. The only way to create an appointment.
create or replace function public.book_appointment(
  p_hospital uuid,
  p_department uuid,
  p_doctor uuid,
  p_date date,
  p_reason text
)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.departments;
  next_token int;
  active_count int;
  result public.appointments;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into d from public.departments where id = p_department and hospital_id = p_hospital;
  if not found then raise exception 'unknown department'; end if;
  if p_date < current_date then raise exception 'date is in the past'; end if;
  if not (extract(isodow from p_date)::int = any (d.opd_days)) then raise exception 'OPD is closed on that day'; end if;
  if p_doctor is not null and not exists (
    select 1 from public.doctors
    where id = p_doctor and department_id = p_department and verification_status = 'verified'
  ) then raise exception 'doctor is not in this department'; end if;

  -- serialize token numbers per department + day
  perform pg_advisory_xact_lock(hashtext(p_department::text || p_date::text));
  select count(*) into active_count from public.appointments
    where department_id = p_department and appointment_date = p_date and status <> 'cancelled';
  if active_count >= d.daily_token_limit then raise exception 'no tokens left for that day'; end if;
  -- cancelled rows count here, so a token number is never reused (unique constraint)
  select coalesce(max(token_no), 0) + 1 into next_token from public.appointments
    where department_id = p_department and appointment_date = p_date;

  insert into public.appointments (patient_id, doctor_id, hospital_id, department_id, appointment_date, token_no, status, reason)
  values (auth.uid(), p_doctor, p_hospital, p_department, p_date, next_token, 'requested', p_reason)
  returning * into result;
  return result;
end;
$$;

-- A 6-digit code, valid for 24 hours. pgcrypto lives in "extensions" on hosted Supabase.
create or replace function public.create_care_invite()
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  c text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  loop
    c := lpad((('x' || encode(gen_random_bytes(4), 'hex'))::bit(32)::bigint % 1000000)::text, 6, '0');
    exit when not exists (select 1 from public.care_invites where code = c and used_at is null and expires_at > now());
  end loop;
  insert into public.care_invites (code, patient_id, expires_at)
  values (c, auth.uid(), now() + interval '24 hours')
  on conflict (code) do update set patient_id = excluded.patient_id, expires_at = excluded.expires_at,
                                   used_by = null, used_at = null;
  return c;
end;
$$;

-- Returns null for a wrong or expired code (raising would roll back the attempt record that the
-- rate limit needs). After 5 wrong tries in 15 minutes it raises "too many attempts".
create or replace function public.accept_care_invite(p_code text, p_relation text default null)
returns public.care_links
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.care_invites;
  link public.care_links;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if (select count(*) from public.care_invite_attempts
      where user_id = auth.uid() and attempted_at > now() - interval '15 minutes') >= 5 then
    raise exception 'too many attempts, try again in 15 minutes';
  end if;
  select * into inv from public.care_invites
    where code = p_code and used_at is null and expires_at > now() for update;
  if not found then
    insert into public.care_invite_attempts (user_id) values (auth.uid());
    return null;
  end if;
  if inv.patient_id = auth.uid() then raise exception 'you cannot be your own caregiver'; end if;
  update public.care_invites set used_by = auth.uid(), used_at = now() where code = p_code;
  insert into public.care_links (patient_id, caregiver_id, relation)
  values (inv.patient_id, auth.uid(), p_relation)
  on conflict (patient_id, caregiver_id) do update
    set status = 'active', relation = coalesce(excluded.relation, public.care_links.relation)
  returning * into link;
  return link;
end;
$$;

-- Supabase also grants execute to anon by default, so revoke it explicitly.
revoke all on function public.book_appointment(uuid, uuid, uuid, date, text) from public, anon;
revoke all on function public.create_care_invite() from public, anon;
revoke all on function public.accept_care_invite(text, text) from public, anon;
grant execute on function public.book_appointment(uuid, uuid, uuid, date, text) to authenticated;
grant execute on function public.create_care_invite() to authenticated;
grant execute on function public.accept_care_invite(text, text) to authenticated;

-- ============================================================================
-- TABLE PRIVILEGES
-- Signed-out visitors (anon) get nothing. Signed-in users get what the policies below allow,
-- narrowed to the columns that the app may write.
-- ============================================================================

revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

revoke all on public.web_cache, public.tinyfish_monitors, public.missed_dose_alerts,
              public.care_invite_attempts from authenticated;

-- appointments are created by book_appointment() only; the app may change just these two columns
revoke insert, update on public.appointments from authenticated;
grant update (status, doctor_notes) on public.appointments to authenticated;

-- a patient does not edit who diagnosed them
revoke update on public.conditions from authenticated;
grant update (name, diagnosed_on, notes, active) on public.conditions to authenticated;

-- care links and invites are created by the RPCs; a link's owner may only change its status and relation
revoke insert, update on public.care_links from authenticated;
grant update (status, relation) on public.care_links to authenticated;
revoke insert, update on public.care_invites from authenticated;

-- share links: the token is generated by the database
revoke insert, update on public.share_links from authenticated;
grant insert (patient_id, kind, expires_at) on public.share_links to authenticated;
grant update (revoked, expires_at) on public.share_links to authenticated;

-- care plans are inserted by the server; a doctor reviews them
revoke insert, update, delete on public.care_plans from authenticated;
grant update (status, plan_json, language, reviewed_by, reviewed_at) on public.care_plans to authenticated;

-- "Report a mistake"
revoke insert, update, delete on public.ai_runs from authenticated;
grant update (status) on public.ai_runs to authenticated;

-- emergency requests are created by the server; the patient can cancel
revoke insert, update, delete on public.emergency_requests from authenticated;
grant update (status) on public.emergency_requests to authenticated;

-- drug alerts are created by the server; the patient marks them seen
revoke insert, update, delete on public.drug_alerts from authenticated;
grant update (seen) on public.drug_alerts to authenticated;

-- lab results and price quotes are written by the server
revoke insert, update on public.lab_reports, public.lab_values from authenticated;
revoke insert, update, delete on public.price_quotes from authenticated;
revoke insert, update, delete on public.interaction_checks from authenticated;

-- consents are append-only
revoke update, delete on public.consents from authenticated;

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- Policies read the user as (select auth.uid()) so Postgres evaluates it once per query, not once per row.
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.hospitals enable row level security;
alter table public.departments enable row level security;
alter table public.doctors enable row level security;
alter table public.emergency_contacts enable row level security;
alter table public.conditions enable row level security;
alter table public.appointments enable row level security;
alter table public.prescriptions enable row level security;
alter table public.prescription_items enable row level security;
alter table public.dose_logs enable row level security;
alter table public.lab_reports enable row level security;
alter table public.lab_values enable row level security;
alter table public.vitals enable row level security;
alter table public.meal_logs enable row level security;
alter table public.care_plans enable row level security;
alter table public.care_invites enable row level security;
alter table public.care_links enable row level security;
alter table public.care_invite_attempts enable row level security;
alter table public.missed_dose_alerts enable row level security;
alter table public.share_links enable row level security;
alter table public.interaction_checks enable row level security;
alter table public.consents enable row level security;
alter table public.ai_runs enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.emergency_requests enable row level security;
alter table public.price_quotes enable row level security;
alter table public.drug_alerts enable row level security;
alter table public.push_tokens enable row level security;
alter table public.web_cache enable row level security;
alter table public.tinyfish_monitors enable row level security;

-- ============================================================================
-- 1. PROFILES
-- ============================================================================

create policy "profiles_select" on public.profiles
  for select to authenticated using (
    (select auth.uid()) = id
    or public.is_doctor_of(id)
    or public.is_caregiver_of(id)
    or public.is_admin()
  );

create policy "profiles_insert" on public.profiles
  for insert to authenticated
  with check (public.is_admin() or ((select auth.uid()) = id and role in ('patient', 'doctor')));

-- a role change is blocked by trg_prevent_role_change for everyone but an admin
create policy "profiles_update" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id or public.is_admin())
  with check ((select auth.uid()) = id or public.is_admin());

create policy "profiles_delete" on public.profiles
  for delete to authenticated using (public.is_admin());

-- ============================================================================
-- 2. HOSPITALS AND DEPARTMENTS (public information, written by the seed or an admin)
-- ============================================================================

create policy "hospitals_select" on public.hospitals
  for select to authenticated using (true);
create policy "hospitals_admin" on public.hospitals
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "departments_select" on public.departments
  for select to authenticated using (true);
create policy "departments_admin" on public.departments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- 3. DOCTORS
-- ============================================================================

create policy "doctors_select" on public.doctors
  for select to authenticated using (
    verification_status = 'verified'
    or (select auth.uid()) = id
    or public.is_admin()
  );

-- only a profile with the doctor role may create a doctors row
create policy "doctors_insert" on public.doctors
  for insert to authenticated with check (
    ((select auth.uid()) = id and exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'doctor'))
    or public.is_admin()
  );

-- verification_*, hospital_id and department_id are guarded by trg_check_doctor_verification_update
create policy "doctors_update" on public.doctors
  for update to authenticated
  using ((select auth.uid()) = id or public.is_admin())
  with check ((select auth.uid()) = id or public.is_admin());

create policy "doctors_delete" on public.doctors
  for delete to authenticated using (public.is_admin());

-- ============================================================================
-- 4. PATIENT DATA: contacts, conditions, vitals, meals, doses
-- ============================================================================

-- emergency_contacts: patient CRUD, doctor and admin read
create policy "emergency_contacts_select" on public.emergency_contacts
  for select to authenticated using ((select auth.uid()) = patient_id or public.is_doctor_of(patient_id) or public.is_admin());
create policy "emergency_contacts_insert" on public.emergency_contacts
  for insert to authenticated with check ((select auth.uid()) = patient_id);
create policy "emergency_contacts_update" on public.emergency_contacts
  for update to authenticated using ((select auth.uid()) = patient_id) with check ((select auth.uid()) = patient_id);
create policy "emergency_contacts_delete" on public.emergency_contacts
  for delete to authenticated using ((select auth.uid()) = patient_id);

-- conditions: a patient adds their own; doctor-sourced rows are written by the server
create policy "conditions_select" on public.conditions
  for select to authenticated using (
    (select auth.uid()) = patient_id
    or public.is_doctor_of(patient_id)
    or public.is_caregiver_of(patient_id)
    or public.is_admin()
  );
create policy "conditions_insert" on public.conditions
  for insert to authenticated
  with check ((select auth.uid()) = patient_id and source = 'patient' and diagnosed_by is null and prescription_id is null);
create policy "conditions_update" on public.conditions
  for update to authenticated using ((select auth.uid()) = patient_id) with check ((select auth.uid()) = patient_id);
create policy "conditions_delete" on public.conditions
  for delete to authenticated using ((select auth.uid()) = patient_id);

-- vitals
create policy "vitals_select" on public.vitals
  for select to authenticated using ((select auth.uid()) = patient_id or public.is_doctor_of(patient_id) or public.is_admin());
create policy "vitals_insert" on public.vitals
  for insert to authenticated with check ((select auth.uid()) = patient_id);
create policy "vitals_update" on public.vitals
  for update to authenticated using ((select auth.uid()) = patient_id) with check ((select auth.uid()) = patient_id);
create policy "vitals_delete" on public.vitals
  for delete to authenticated using ((select auth.uid()) = patient_id);

-- meal_logs
create policy "meal_logs_select" on public.meal_logs
  for select to authenticated using ((select auth.uid()) = patient_id or public.is_doctor_of(patient_id) or public.is_admin());
create policy "meal_logs_insert" on public.meal_logs
  for insert to authenticated with check ((select auth.uid()) = patient_id);
create policy "meal_logs_update" on public.meal_logs
  for update to authenticated using ((select auth.uid()) = patient_id) with check ((select auth.uid()) = patient_id);
create policy "meal_logs_delete" on public.meal_logs
  for delete to authenticated using ((select auth.uid()) = patient_id);

-- dose_logs: a patient logs doses of their own medicines only
create policy "dose_logs_select" on public.dose_logs
  for select to authenticated using (
    (select auth.uid()) = patient_id
    or public.is_doctor_of(patient_id)
    or public.is_caregiver_of(patient_id)
    or public.is_admin()
  );
create policy "dose_logs_insert" on public.dose_logs
  for insert to authenticated with check (
    (select auth.uid()) = patient_id
    and exists (select 1 from public.prescription_items i where i.id = item_id and i.patient_id = (select auth.uid()))
  );
create policy "dose_logs_update" on public.dose_logs
  for update to authenticated using ((select auth.uid()) = patient_id) with check ((select auth.uid()) = patient_id);
create policy "dose_logs_delete" on public.dose_logs
  for delete to authenticated using ((select auth.uid()) = patient_id);

-- ============================================================================
-- 5. APPOINTMENTS
-- Rows are inserted only by book_appointment(). The app changes status and doctor_notes only.
-- ============================================================================

create policy "appointments_select" on public.appointments
  for select to authenticated using (
    (select auth.uid()) = patient_id
    or (select auth.uid()) = doctor_id
    or department_id = public.my_verified_department()
    or public.is_caregiver_of(patient_id)
    or public.is_admin()
  );

create policy "appointments_update_patient" on public.appointments
  for update to authenticated
  using ((select auth.uid()) = patient_id)
  with check ((select auth.uid()) = patient_id and status = 'cancelled');

create policy "appointments_update_doctor" on public.appointments
  for update to authenticated
  using ((select auth.uid()) = doctor_id or department_id = public.my_verified_department())
  with check ((select auth.uid()) = doctor_id or department_id = public.my_verified_department());

create policy "appointments_update_admin" on public.appointments
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- 6. PRESCRIPTIONS AND ITEMS
-- ============================================================================

create policy "prescriptions_select" on public.prescriptions
  for select to authenticated using (
    (select auth.uid()) = patient_id
    or public.is_doctor_of(patient_id)
    or public.is_caregiver_of(patient_id)
    or public.is_admin()
  );

-- a patient uploads (source 'upload', no doctor); a doctor writes for their own patients
create policy "prescriptions_insert" on public.prescriptions
  for insert to authenticated with check (
    ((select auth.uid()) = patient_id and source = 'upload' and doctor_id is null)
    or (doctor_id = (select auth.uid()) and source = 'doctor' and public.is_doctor_of(patient_id))
  );

create policy "prescriptions_update" on public.prescriptions
  for update to authenticated
  using (
    ((select auth.uid()) = patient_id and source = 'upload')
    or (doctor_id = (select auth.uid()) and public.is_doctor_of(patient_id))
  )
  with check (
    ((select auth.uid()) = patient_id and source = 'upload' and doctor_id is null)
    or (doctor_id = (select auth.uid()) and source = 'doctor' and public.is_doctor_of(patient_id))
  );

create policy "prescriptions_delete" on public.prescriptions
  for delete to authenticated using ((select auth.uid()) = patient_id and source = 'upload');

create policy "prescription_items_select" on public.prescription_items
  for select to authenticated using (
    (select auth.uid()) = patient_id
    or public.is_doctor_of(patient_id)
    or public.is_caregiver_of(patient_id)
    or public.is_admin()
  );

-- an item always belongs to a prescription of the same patient: the patient's own upload,
-- or a prescription written by this doctor
create policy "prescription_items_insert" on public.prescription_items
  for insert to authenticated with check (
    exists (
      select 1 from public.prescriptions p
      where p.id = prescription_id and p.patient_id = prescription_items.patient_id
        and (
          (p.source = 'upload' and p.patient_id = (select auth.uid()))
          or (p.source = 'doctor' and p.doctor_id = (select auth.uid()))
        )
    )
  );

-- trg_check_prescription_item_update limits the patient to `active` on a doctor's prescription
create policy "prescription_items_update" on public.prescription_items
  for update to authenticated
  using (
    (select auth.uid()) = patient_id
    or exists (select 1 from public.prescriptions p where p.id = prescription_id and p.doctor_id = (select auth.uid()))
  )
  with check (
    (select auth.uid()) = patient_id
    or exists (select 1 from public.prescriptions p where p.id = prescription_id and p.doctor_id = (select auth.uid()))
  );

create policy "prescription_items_delete" on public.prescription_items
  for delete to authenticated using (
    (select auth.uid()) = patient_id
    and exists (select 1 from public.prescriptions p where p.id = prescription_id and p.source = 'upload')
  );

-- ============================================================================
-- 7. LAB REPORTS AND VALUES (the server inserts and updates them)
-- ============================================================================

create policy "lab_reports_select" on public.lab_reports
  for select to authenticated using (
    (select auth.uid()) = patient_id
    or public.is_doctor_of(patient_id)
    or public.is_caregiver_of(patient_id)
    or public.is_admin()
  );
create policy "lab_reports_delete" on public.lab_reports
  for delete to authenticated using ((select auth.uid()) = patient_id);

create policy "lab_values_select" on public.lab_values
  for select to authenticated using (
    (select auth.uid()) = patient_id
    or public.is_doctor_of(patient_id)
    or public.is_caregiver_of(patient_id)
    or public.is_admin()
  );
create policy "lab_values_delete" on public.lab_values
  for delete to authenticated using ((select auth.uid()) = patient_id);

-- ============================================================================
-- 8. CARE PLANS
-- A patient sees a plan once a doctor approved it, or if they generated it themselves. The
-- patient has no update policy, so nobody approves their own plan. The server inserts plans.
-- ============================================================================

create policy "care_plans_select" on public.care_plans
  for select to authenticated using (
    ((select auth.uid()) = patient_id and status in ('approved', 'patient_generated'))
    or public.is_doctor_of(patient_id)
    or (public.is_caregiver_of(patient_id) and status = 'approved')
    or public.is_admin()
  );

create policy "care_plans_update_doctor" on public.care_plans
  for update to authenticated
  using (public.is_doctor_of(patient_id))
  with check (
    public.is_doctor_of(patient_id)
    and status in ('draft', 'approved')
    and (reviewed_by is null or reviewed_by = (select auth.uid()))
  );

create policy "care_plans_admin" on public.care_plans
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- 9. CAREGIVER MODE
-- Invites are created and accepted only through the RPCs.
-- ============================================================================

create policy "care_invites_select" on public.care_invites
  for select to authenticated using ((select auth.uid()) = patient_id or public.is_admin());
create policy "care_invites_delete" on public.care_invites
  for delete to authenticated using ((select auth.uid()) = patient_id or public.is_admin());

-- only the patient (or an admin) changes a link, so a revoked caregiver cannot switch it back on;
-- the caregiver can leave by deleting it
create policy "care_links_select" on public.care_links
  for select to authenticated using ((select auth.uid()) = patient_id or (select auth.uid()) = caregiver_id or public.is_admin());
create policy "care_links_update" on public.care_links
  for update to authenticated
  using ((select auth.uid()) = patient_id or public.is_admin())
  with check ((select auth.uid()) = patient_id or public.is_admin());
create policy "care_links_delete" on public.care_links
  for delete to authenticated using ((select auth.uid()) = patient_id or (select auth.uid()) = caregiver_id or public.is_admin());

-- missed_dose_alerts, care_invite_attempts: server only (RLS on, no policy)

-- ============================================================================
-- 10. SHARING, INTERACTIONS, PRIVACY, AI TRACEABILITY
-- ============================================================================

create policy "share_links_select" on public.share_links
  for select to authenticated using ((select auth.uid()) = patient_id or public.is_admin());
create policy "share_links_insert" on public.share_links
  for insert to authenticated with check ((select auth.uid()) = patient_id);
create policy "share_links_update" on public.share_links
  for update to authenticated using ((select auth.uid()) = patient_id) with check ((select auth.uid()) = patient_id);
create policy "share_links_delete" on public.share_links
  for delete to authenticated using ((select auth.uid()) = patient_id);

create policy "interaction_checks_select" on public.interaction_checks
  for select to authenticated using (
    (select auth.uid()) = patient_id
    or public.is_doctor_of(patient_id)
    or public.is_caregiver_of(patient_id)
    or public.is_admin()
  );

create policy "consents_select" on public.consents
  for select to authenticated using ((select auth.uid()) = user_id or public.is_admin());
create policy "consents_insert" on public.consents
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "ai_runs_select" on public.ai_runs
  for select to authenticated using (
    (select auth.uid()) = user_id
    or public.is_doctor_of(user_id)
    or public.is_admin()
  );
-- "Report a mistake": the user may only flip their own run to reported
create policy "ai_runs_report_own" on public.ai_runs
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and status = 'reported');

-- ============================================================================
-- 11. ASSISTANT CHAT
-- ============================================================================

create policy "chat_sessions_select" on public.chat_sessions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "chat_sessions_insert" on public.chat_sessions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "chat_sessions_update" on public.chat_sessions
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "chat_sessions_delete" on public.chat_sessions
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "chat_messages_select" on public.chat_messages
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "chat_messages_insert" on public.chat_messages
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.chat_sessions s where s.id = session_id and s.user_id = (select auth.uid()))
  );
create policy "chat_messages_update" on public.chat_messages
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "chat_messages_delete" on public.chat_messages
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ============================================================================
-- 12. EMERGENCY, WEB DATA, PUSH
-- ============================================================================

create policy "emergency_requests_select" on public.emergency_requests
  for select to authenticated using (
    (select auth.uid()) = patient_id
    or public.is_caregiver_of(patient_id)
    or public.is_admin()
  );
create policy "emergency_requests_cancel" on public.emergency_requests
  for update to authenticated
  using ((select auth.uid()) = patient_id)
  with check ((select auth.uid()) = patient_id and status = 'cancelled');

create policy "price_quotes_select" on public.price_quotes
  for select to authenticated using (true);

create policy "drug_alerts_select" on public.drug_alerts
  for select to authenticated using ((select auth.uid()) = patient_id or public.is_admin());
create policy "drug_alerts_update" on public.drug_alerts
  for update to authenticated using ((select auth.uid()) = patient_id) with check ((select auth.uid()) = patient_id);

create policy "push_tokens_select" on public.push_tokens
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "push_tokens_insert" on public.push_tokens
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "push_tokens_update" on public.push_tokens
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "push_tokens_delete" on public.push_tokens
  for delete to authenticated using ((select auth.uid()) = user_id);

-- web_cache, tinyfish_monitors: server only (RLS on, no policy)
