-- 0005_directory.sql
-- Names that a patient needs to see but that RLS keeps in other people's profiles.
-- Owner: Vaibhav Parmar

-- Verified doctors with their name, for the booking screens. profiles holds the name, and a
-- patient cannot read a doctor's profile (it also has dob, phone and so on), so this function
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

-- A patient reads the profile of a caregiver they accepted, so the screen can say who can see
-- their records and offer "revoke". The caregiver accepted the patient's invite, and the link
-- must be active.
create policy "profiles_select_my_caregivers" on public.profiles
  for select to authenticated using (
    exists (
      select 1 from public.care_links l
      where l.patient_id = (select auth.uid()) and l.caregiver_id = profiles.id and l.status = 'active'
    )
  );
