-- 0006_diagnosis_condition.sql
-- A doctor's diagnosis becomes the patient's condition (V12, ADR-037). Owner: Vaibhav Parmar
--
-- When a doctor saves an e-prescription with a diagnosis, the patient gets a condition
-- (source 'doctor', diagnosed_by the doctor, prescription_id), and the care plan draft starts from it.
-- Doctors still cannot insert into conditions: RLS is unchanged, and the trigger below does the insert.

-- At most one condition per prescription. A partial index, because patient-added conditions have no
-- prescription and a patient's own upload never gets one.
create unique index if not exists uq_conditions_doctor_prescription
  on public.conditions (prescription_id)
  where source = 'doctor' and prescription_id is not null;

-- Runs as the table owner so it can insert into conditions, but only does anything for a prescription
-- with source 'doctor', and the policies of prescriptions already decide who may create one (a verified
-- doctor, in their own name, for a patient of their department).
create or replace function public.create_condition_from_diagnosis()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(coalesce(new.diagnosis, ''));
begin
  if new.source <> 'doctor' or v_name = '' then
    -- A patient's own upload never creates a condition. If the diagnosis is cleared later the condition
    -- stays: a care plan may already hang on it (care_plans.condition_id cascades on delete).
    return new;
  end if;

  insert into public.conditions (patient_id, name, source, diagnosed_by, prescription_id, diagnosed_on)
  values (new.patient_id, v_name, 'doctor', new.doctor_id, new.id, new.issued_on)
  on conflict (prescription_id) where source = 'doctor' and prescription_id is not null
  do update set name = excluded.name, diagnosed_on = excluded.diagnosed_on;

  return new;
end;
$$;

drop trigger if exists trg_condition_from_diagnosis on public.prescriptions;
create trigger trg_condition_from_diagnosis
  after insert or update of diagnosis on public.prescriptions
  for each row execute function public.create_condition_from_diagnosis();

-- Only the trigger calls it.
revoke all on function public.create_condition_from_diagnosis() from public, anon, authenticated;
