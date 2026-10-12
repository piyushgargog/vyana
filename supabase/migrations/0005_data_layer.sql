-- 0005_data_layer.sql
-- What the query functions in @vyana/shared need beyond 0001 to 0004. Owner: Vaibhav Parmar
--
-- Everything here shares one rule: show a person only what the screen needs. Profiles stay private
-- (they hold dob, phone, allergies); the functions below return names, counts and ids.

-- ============================================================================
-- 1. NAMES OF OTHER PEOPLE
-- ============================================================================

-- Verified doctors with their name, for the booking screens. profiles holds the name, and a
-- patient cannot read a doctor's profile (it also has dob and phone), so this function
-- returns only public fields: no verification_json, no contact details.
create or replace function public.doctor_directory(
  p_id uuid default null,
  p_hospital uuid default null,
  p_department uuid default null
)
returns table (
  id uuid,
  full_name text,
  specialization text,
  reg_no text,
  state_council text,
  year_of_registration int,
  clinic_name text,
  clinic_address text,
  consultation_fee int,
  availability jsonb,
  hospital_id uuid,
  department_id uuid,
  verified_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select d.id, p.full_name, d.specialization, d.reg_no, d.state_council, d.year_of_registration,
         d.clinic_name, d.clinic_address, d.consultation_fee, d.availability,
         d.hospital_id, d.department_id, d.verified_at
  from public.doctors d
  join public.profiles p on p.id = d.id
  where d.verification_status = 'verified'
    and auth.uid() is not null
    and (p_id is null or d.id = p_id)
    and (p_hospital is null or d.hospital_id = p_hospital)
    and (p_department is null or d.department_id = p_department)
  order by p.full_name nulls last;
$$;

revoke all on function public.doctor_directory(uuid, uuid, uuid) from public, anon;
grant execute on function public.doctor_directory(uuid, uuid, uuid) to authenticated;

-- The people who look after the signed-in patient: who they are and how they are related, nothing
-- else. A patient has no SELECT on a caregiver's profile, so the phone, dob and allergies of the
-- caregiver stay private.
create or replace function public.my_caregivers()
returns table (
  link_id uuid,
  caregiver_id uuid,
  full_name text,
  relation text,
  status text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select l.id, l.caregiver_id, p.full_name, l.relation, l.status, l.created_at
  from public.care_links l
  join public.profiles p on p.id = l.caregiver_id
  where l.patient_id = auth.uid()
  order by l.created_at desc;
$$;

revoke all on function public.my_caregivers() from public, anon;
grant execute on function public.my_caregivers() to authenticated;

-- ============================================================================
-- 2. TOKENS LEFT (booking is by token, not by time slot)
-- ============================================================================

-- Whether a department's OPD is open on a day and how many tokens are left. Only the count leaves
-- the database: other patients' appointments stay invisible to a patient.
create or replace function public.department_tokens(p_department uuid, p_date date)
returns table (opd_open boolean, tokens_left int, daily_token_limit int)
language sql
stable
security definer
set search_path = public
as $$
  select
    (p_date >= current_date and extract(isodow from p_date)::int = any (d.opd_days)) as opd_open,
    greatest(d.daily_token_limit - (
      select count(*)::int from public.appointments a
      where a.department_id = d.id and a.appointment_date = p_date and a.status <> 'cancelled'
    ), 0) as tokens_left,
    d.daily_token_limit
  from public.departments d
  where d.id = p_department and auth.uid() is not null;
$$;

revoke all on function public.department_tokens(uuid, date) from public, anon;
grant execute on function public.department_tokens(uuid, date) to authenticated;

-- ============================================================================
-- 3. A DOCTOR'S E-PRESCRIPTION IN ONE TRANSACTION
-- ============================================================================

-- Writes the prescription and all its medicines or nothing. A doctor cannot delete a prescription, so
-- a failed second step must not leave the first behind (and a condition and care plan draft with it, once
-- the diagnosis trigger exists). It runs as the caller (security invoker): the policies of
-- prescriptions and prescription_items decide, exactly as for direct inserts.
create or replace function public.create_doctor_prescription(
  p_patient uuid,
  p_appointment uuid,
  p_diagnosis text,
  p_notes text,
  p_items jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_rx uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'a prescription needs at least one medicine';
  end if;

  insert into public.prescriptions (patient_id, doctor_id, appointment_id, source, diagnosis, notes)
  values (p_patient, auth.uid(), p_appointment, 'doctor', p_diagnosis, p_notes)
  returning id into v_rx;

  insert into public.prescription_items (
    prescription_id, patient_id, medicine_name, strength, form, dose, frequency, times, with_food,
    duration_days, start_date, end_date, instructions, quantity_total, refill_alert_days
  )
  select
    v_rx, p_patient, i.medicine_name, i.strength, coalesce(i.form, 'tablet'), i.dose, i.frequency,
    coalesce(i.times, '{}'), coalesce(i.with_food, 'any'), i.duration_days, coalesce(i.start_date, current_date),
    i.end_date, i.instructions, i.quantity_total, coalesce(i.refill_alert_days, 3)
  from jsonb_to_recordset(p_items) as i (
    medicine_name text, strength text, form text, dose text, frequency text, times text[], with_food text,
    duration_days int, start_date date, end_date date, instructions text, quantity_total numeric, refill_alert_days int
  );

  return v_rx;
end;
$$;

revoke all on function public.create_doctor_prescription(uuid, uuid, text, text, jsonb) from public, anon;
grant execute on function public.create_doctor_prescription(uuid, uuid, text, text, jsonb) to authenticated;

-- ============================================================================
-- 4. NOTE ON A REPORTED AI MISTAKE
-- ============================================================================

-- "Report a mistake" (plan 2A) takes a short note. The user may still change nothing but the status
-- of their own run (to 'reported') and now this note; the policy keeps requiring status = 'reported'.
alter table public.ai_runs add column if not exists report_note text check (char_length(report_note) <= 1000);
grant update (report_note) on public.ai_runs to authenticated;

-- ============================================================================
-- 5. A DOSE LOG MUST STAY ON THE PATIENT'S OWN MEDICINE
-- ============================================================================

-- dose_logs_update did not repeat the "the item is mine" check of dose_logs_insert, so an update could
-- point item_id at someone else's medicine.
drop policy if exists "dose_logs_update" on public.dose_logs;
create policy "dose_logs_update" on public.dose_logs
  for update to authenticated
  using ((select auth.uid()) = patient_id)
  with check (
    (select auth.uid()) = patient_id
    and exists (select 1 from public.prescription_items i where i.id = item_id and i.patient_id = (select auth.uid()))
  );
