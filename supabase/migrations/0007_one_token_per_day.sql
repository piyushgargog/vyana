-- 0007_one_token_per_day.sql
-- One active OPD token per patient, department and day (V13, ADR-040). Owner: Vaibhav Parmar
--
-- Without this a patient could book the same department again and again and use up its daily tokens.
-- Cancelling a token frees the slot; a cancelled token number is never given out again.

-- The database keeps the rule even if a row is written some other way (for example a doctor setting a
-- cancelled appointment back to confirmed while the patient has booked again).
create unique index if not exists uq_appointments_one_active_token
  on public.appointments (patient_id, department_id, appointment_date)
  where status <> 'cancelled';

-- Same function as in 0002_rls.sql, with the one new check after the department lock: the lock is
-- taken first, so two taps at the same moment cannot both pass the check.
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

  if exists (
    select 1 from public.appointments
    where patient_id = auth.uid() and department_id = p_department
      and appointment_date = p_date and status <> 'cancelled'
  ) then
    raise exception 'you already have a token for this department on that day';
  end if;

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
