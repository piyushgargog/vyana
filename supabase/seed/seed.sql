-- supabase/seed/seed.sql
-- Demo seed rows for Vyana
-- Owner: Vaibhav Parmar

-- Run after seed-users.ts: the auth users must exist first. Safe to run more than once.
-- All people, phone numbers and registration numbers below are fictional demo data.

-- 1. Profiles for Demo Users
insert into public.profiles (id, role, full_name, phone, dob, gender, blood_group, allergies, city, preferred_language, onboarded)
values
  ('00000000-0000-0000-0000-000000000001', 'patient', 'Aryan Sharma', '+91 00000 00001', '1990-05-15', 'male', 'O+', '{"Penicillin"}', 'Delhi', 'en', true),
  ('00000000-0000-0000-0000-000000000002', 'doctor', 'Dr. Rajesh Mehta', '+91 00000 00002', '1980-08-20', 'male', 'A+', '{}', 'New Delhi', 'en', true),
  ('00000000-0000-0000-0000-000000000003', 'doctor', 'Dr. Sneha Gupta', '+91 00000 00003', '1985-11-12', 'female', 'B+', '{}', 'Delhi', 'en', true),
  ('00000000-0000-0000-0000-000000000004', 'admin', 'Vyana Admin', '+91 00000 00004', '1992-01-01', 'other', 'B+', '{}', 'Delhi', 'en', true),
  ('00000000-0000-0000-0000-000000000005', 'patient', 'Neha Sharma', '+91 00000 00005', '1995-03-22', 'female', 'O+', '{}', 'Delhi', 'en', true)
on conflict (id) do update set
  full_name = excluded.full_name,
  role = excluded.role,
  preferred_language = excluded.preferred_language,
  onboarded = excluded.onboarded;

-- 2. One hospital with one department, so the demo appointments can reference them.
-- V7 adds the full list of Delhi/NCR hospitals and departments.
insert into public.hospitals (id, name, kind, address, city, lat, lng, website, ors_enabled)
values
  ('51000000-0000-0000-0000-000000000001', 'All India Institute of Medical Sciences, New Delhi', 'government',
   'Sri Aurobindo Marg, Ansari Nagar, New Delhi 110029', 'Delhi', 28.5672, 77.2100, 'https://www.aiims.edu', true)
on conflict (id) do nothing;

insert into public.departments (id, hospital_id, name)
values
  ('52000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', 'General Medicine')
on conflict (id) do nothing;

-- 3. Doctor Details
insert into public.doctors (id, specialization, reg_no, state_council, year_of_registration, clinic_name, clinic_address, consultation_fee, availability, verification_status, verification_json, verified_at, hospital_id, department_id)
values
  ('00000000-0000-0000-0000-000000000002', 'General Physician', 'DEMO-0001', 'Delhi Medical Council', 2008, 'Mehta Health Care & Clinic', 'Plot 42, Preet Vihar, East Delhi', 500, '{"days":[1,2,3,4,5,6],"start":"10:00","end":"17:00","slot_minutes":30}'::jsonb, 'verified', '{"source": "seed", "note": "demo doctor, not a real registration"}'::jsonb, now(), '51000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000003', 'Endocrinologist', 'DEMO-0002', 'Delhi Medical Council', 2015, 'Care Diabetes Center', 'Vikas Marg, East Delhi', 800, '{"days":[1,2,3,4,5],"start":"11:00","end":"18:00","slot_minutes":30}'::jsonb, 'pending', null, null, null, null)
on conflict (id) do update set
  verification_status = excluded.verification_status,
  verification_json = excluded.verification_json,
  verified_at = excluded.verified_at,
  hospital_id = excluded.hospital_id,
  department_id = excluded.department_id;

-- 4. Caregiver Link
insert into public.care_links (patient_id, caregiver_id, relation, status)
values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000005', 'Daughter', 'active')
on conflict (patient_id, caregiver_id) do nothing;

-- 5. Patient Emergency Contacts
insert into public.emergency_contacts (id, patient_id, name, phone, relation)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000001', 'Sunita Sharma', '+91 00000 00006', 'Mother'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000001', 'Amit Sharma', '+91 00000 00007', 'Brother')
on conflict (id) do nothing;

-- 6. Patient Chronic Conditions
insert into public.conditions (id, patient_id, name, diagnosed_on, notes, active, source)
values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '00000000-0000-0000-0000-000000000001', 'Type 2 Diabetes', '2022-01-15', 'Well-controlled with Metformin and dietary care', true, 'doctor'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000001', 'Hypertension', '2023-06-10', 'Stage 1 hypertension, monitoring daily BP', true, 'doctor')
on conflict (id) do nothing;

-- 7. Appointments
insert into public.appointments (id, patient_id, doctor_id, hospital_id, department_id, appointment_date, token_no, scheduled_at, status, reason, doctor_notes)
values
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
   '51000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000001', current_date - 14, 12, now() - interval '14 days',
   'completed', 'Routine Diabetic & BP Checkup', 'Patient vitals stable. Recommended routine HbA1c in 3 months.'),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
   '51000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000001', current_date + 3, 5, now() + interval '3 days',
   'confirmed', 'Follow-up consultation', null)
on conflict (id) do nothing;

-- 8. Prescriptions and Items
insert into public.prescriptions (id, patient_id, doctor_id, appointment_id, source, doctor_name, diagnosis, notes, issued_on)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'doctor', 'Dr. Rajesh Mehta', 'Type 2 Diabetes Mellitus & Primary Hypertension', 'Continue diet plan. Avoid sugary foods. Drink 3L water.', current_date - 14)
on conflict (id) do nothing;

insert into public.prescription_items (id, prescription_id, patient_id, medicine_name, strength, form, dose, frequency, times, with_food, duration_days, start_date, active)
values
  ('22222222-2222-2222-2222-222222222221', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'Metformin', '500 mg', 'tablet', '1 tablet', 'BD', '{"09:00","21:00"}', 'after', 30, current_date - 14, true),
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'Telma (Telmisartan)', '40 mg', 'tablet', '1 tablet', 'OD', '{"09:00"}', 'after', 30, current_date - 14, true),
  ('22222222-2222-2222-2222-222222222223', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'Dolo (Paracetamol)', '650 mg', 'tablet', '1 tablet', 'SOS', '{}', 'after', 5, current_date - 14, true)
on conflict (id) do nothing;

-- 9. Dose Logs (Last 7 days)
do $$
declare
  d int;
  t timestamptz;
begin
  for d in 0..6 loop
    t := date_trunc('day', now() - (d || ' days')::interval);
    
    -- Metformin morning dose
    insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
    values ('00000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222221', t + interval '9 hours', 'taken', t + interval '9 hours 10 minutes')
    on conflict (item_id, scheduled_for) do nothing;

    -- Metformin evening dose
    insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
    values ('00000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222221', t + interval '21 hours', case when d = 2 then 'missed' else 'taken' end, t + interval '21 hours 15 minutes')
    on conflict (item_id, scheduled_for) do nothing;

    -- Telma morning dose
    insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
    values ('00000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', t + interval '9 hours', 'taken', t + interval '9 hours 12 minutes')
    on conflict (item_id, scheduled_for) do nothing;
  end loop;
end $$;

-- 10. Lab Reports & Values (HbA1c Trend Demo)
insert into public.lab_reports (id, patient_id, file_path, lab_name, report_date, status, summary)
values
  ('33333333-3333-3333-3333-333333333331', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001/report1.pdf', 'Sample Diagnostics', current_date - 90, 'done', 'HbA1c elevated at 7.4%. Fasting glucose above reference range.'),
  ('33333333-3333-3333-3333-333333333332', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001/report2.pdf', 'Sample Diagnostics', current_date - 7, 'done', 'Significant improvement in HbA1c (6.8%). Fasting glucose normalized.')
on conflict (id) do nothing;

insert into public.lab_values (id, report_id, patient_id, test_name, value, unit, ref_low, ref_high, flag, measured_on)
values
  ('44444444-4444-4444-4444-444444444441', '33333333-3333-3333-3333-333333333331', '00000000-0000-0000-0000-000000000001', 'HbA1c', 7.4, '%', 4.0, 5.6, 'high', current_date - 90),
  ('44444444-4444-4444-4444-444444444442', '33333333-3333-3333-3333-333333333331', '00000000-0000-0000-0000-000000000001', 'Fasting Blood Sugar', 142.0, 'mg/dL', 70.0, 100.0, 'high', current_date - 90),
  ('44444444-4444-4444-4444-444444444443', '33333333-3333-3333-3333-333333333332', '00000000-0000-0000-0000-000000000001', 'HbA1c', 6.8, '%', 4.0, 5.6, 'high', current_date - 7),
  ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333332', '00000000-0000-0000-0000-000000000001', 'Fasting Blood Sugar', 115.0, 'mg/dL', 70.0, 100.0, 'normal', current_date - 7)
on conflict (id) do nothing;

-- 11. 7 Days of Vitals (Clean up previous runs for demo patient)
delete from public.vitals where patient_id = '00000000-0000-0000-0000-000000000001';

do $$
declare
  d int;
  t timestamptz;
begin
  for d in 0..6 loop
    t := now() - (d || ' days')::interval;

    -- Blood Pressure
    insert into public.vitals (patient_id, type, value, value2, unit, measured_at)
    values ('00000000-0000-0000-0000-000000000001', 'bp', 124 + (d % 3), 82 + (d % 2), 'mmHg', t - interval '1 hour');

    -- Fasting Sugar
    insert into public.vitals (patient_id, type, value, unit, measured_at)
    values ('00000000-0000-0000-0000-000000000001', 'sugar_fasting', 110 + (d * 2), 'mg/dL', t - interval '2 hours');

    -- Weight
    insert into public.vitals (patient_id, type, value, unit, measured_at)
    values ('00000000-0000-0000-0000-000000000001', 'weight', 72.5 - (d * 0.1), 'kg', t - interval '3 hours');
  end loop;
end $$;
