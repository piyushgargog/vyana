-- 0010_account_deletion.sql
-- Deleting an account must never be blocked by a link from somebody else's record (V9, issue #35).
-- Owner: Vaibhav Parmar
--
-- Everything a patient owns is removed with their profile (every patient_id / user_id key cascades). Five links
-- pointed the other way and had no delete rule, so they stopped the deletion of an account that other
-- people's records still mention:
--
--   care_invites.used_by      a caregiver who joined with a code could not delete their account
--   appointments.doctor_id    a doctor who saw patients could not delete theirs
--   prescriptions.doctor_id   (the doctor's name stays on the prescription as text in doctor_name)
--   conditions.diagnosed_by
--   care_plans.reviewed_by
--
-- The patient's record stays; only the pointer to the deleted person is cleared.
alter table public.care_invites drop constraint care_invites_used_by_fkey;
alter table public.care_invites
  add constraint care_invites_used_by_fkey foreign key (used_by) references public.profiles(id) on delete set null;

alter table public.appointments drop constraint appointments_doctor_id_fkey;
alter table public.appointments
  add constraint appointments_doctor_id_fkey foreign key (doctor_id) references public.doctors(id) on delete set null;

alter table public.prescriptions drop constraint prescriptions_doctor_id_fkey;
alter table public.prescriptions
  add constraint prescriptions_doctor_id_fkey foreign key (doctor_id) references public.doctors(id) on delete set null;

alter table public.conditions drop constraint conditions_diagnosed_by_fkey;
alter table public.conditions
  add constraint conditions_diagnosed_by_fkey foreign key (diagnosed_by) references public.doctors(id) on delete set null;

alter table public.care_plans drop constraint care_plans_reviewed_by_fkey;
alter table public.care_plans
  add constraint care_plans_reviewed_by_fkey foreign key (reviewed_by) references public.doctors(id) on delete set null;
