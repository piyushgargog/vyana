-- supabase/seed/seed.sql
-- Demo seed rows for Vyana
-- Owner: Vaibhav Parmar

-- Run after seed-users.ts: the auth users must exist first. Safe to run more than once.
-- The hospitals (names, addresses, websites) are real public information; all people, phone numbers and
-- registration numbers below are fictional demo data.

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

-- 2. Real Delhi hospitals and their departments (public information: names, addresses, websites).
-- Coordinates are approximate. OPD days and timings are the column defaults (Monday to Saturday, 09:00 to
-- 13:00, 100 tokens a day): the real ones come from "Check OPD timings" (POST /api/hospitals/info, TinyFish).
-- The five government hospitals take bookings on ORS, so ors_enabled is true for them.
insert into public.hospitals (id, name, kind, address, city, lat, lng, website, ors_enabled)
values
  ('51000000-0000-0000-0000-000000000001', 'All India Institute of Medical Sciences, New Delhi', 'government', 'Sri Aurobindo Marg, Ansari Nagar, New Delhi 110029', 'Delhi', 28.5672, 77.21, 'https://www.aiims.edu', true),
  ('51000000-0000-0000-0000-000000000002', 'Safdarjung Hospital', 'government', 'Ansari Nagar West, New Delhi 110029', 'Delhi', 28.5677, 77.2058, null, true),
  ('51000000-0000-0000-0000-000000000003', 'Dr. Ram Manohar Lohia Hospital', 'government', 'Baba Kharak Singh Marg, New Delhi 110001', 'Delhi', 28.6258, 77.2, 'https://rmlh.mohfw.gov.in/', true),
  ('51000000-0000-0000-0000-000000000004', 'Lok Nayak Hospital (LNJP)', 'government', 'Jawahar Lal Nehru Marg, Delhi Gate, New Delhi 110002', 'Delhi', 28.6382, 77.2386, null, true),
  ('51000000-0000-0000-0000-000000000005', 'Guru Teg Bahadur Hospital (GTB)', 'government', 'Tahirpur Road, GTB Enclave, Dilshad Garden, Delhi 110095', 'Delhi', 28.6857, 77.3075, null, true),
  ('51000000-0000-0000-0000-000000000006', 'Max Super Speciality Hospital, Patparganj', 'private', '108A, I.P. Extension, Patparganj, Delhi 110092', 'Delhi', 28.6332, 77.3089, 'https://www.maxhealthcare.in', false),
  ('51000000-0000-0000-0000-000000000007', 'Sir Ganga Ram Hospital', 'private', 'Sir Ganga Ram Hospital Marg, Rajinder Nagar, New Delhi 110060', 'Delhi', 28.6385, 77.191, 'https://sgrh.com', false),
  ('51000000-0000-0000-0000-000000000008', 'Indraprastha Apollo Hospitals', 'private', 'Sarita Vihar, Delhi Mathura Road, New Delhi 110076', 'Delhi', 28.5409, 77.284, 'https://www.apollohospitals.com/delhi/', false),
  ('51000000-0000-0000-0000-000000000009', 'Max Super Speciality Hospital, Saket', 'private', '1, 2, Press Enclave Road, Mandir Marg, Saket, New Delhi 110017', 'Delhi', 28.5276, 77.2118, 'https://www.maxhealthcare.in', false)
on conflict (id) do update set
  name = excluded.name, kind = excluded.kind, address = excluded.address, lat = excluded.lat, lng = excluded.lng,
  website = excluded.website, ors_enabled = excluded.ors_enabled;

insert into public.departments (id, hospital_id, name)
values
  ('52000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', 'General Medicine'),
  ('52000000-0000-0000-0000-000000000002', '51000000-0000-0000-0000-000000000001', 'Cardiology'),
  ('52000000-0000-0000-0000-000000000003', '51000000-0000-0000-0000-000000000001', 'Orthopaedics'),
  ('52000000-0000-0000-0000-000000000004', '51000000-0000-0000-0000-000000000001', 'Paediatrics'),
  ('52000000-0000-0000-0000-000000000005', '51000000-0000-0000-0000-000000000001', 'Dermatology'),
  ('52000000-0000-0000-0000-000000000006', '51000000-0000-0000-0000-000000000001', 'ENT'),
  ('52000000-0000-0000-0000-000000000101', '51000000-0000-0000-0000-000000000002', 'General Medicine'),
  ('52000000-0000-0000-0000-000000000102', '51000000-0000-0000-0000-000000000002', 'Orthopaedics'),
  ('52000000-0000-0000-0000-000000000103', '51000000-0000-0000-0000-000000000002', 'Paediatrics'),
  ('52000000-0000-0000-0000-000000000104', '51000000-0000-0000-0000-000000000002', 'Dermatology'),
  ('52000000-0000-0000-0000-000000000105', '51000000-0000-0000-0000-000000000002', 'Gynaecology'),
  ('52000000-0000-0000-0000-000000000106', '51000000-0000-0000-0000-000000000002', 'ENT'),
  ('52000000-0000-0000-0000-000000000201', '51000000-0000-0000-0000-000000000003', 'General Medicine'),
  ('52000000-0000-0000-0000-000000000202', '51000000-0000-0000-0000-000000000003', 'Cardiology'),
  ('52000000-0000-0000-0000-000000000203', '51000000-0000-0000-0000-000000000003', 'Dermatology'),
  ('52000000-0000-0000-0000-000000000204', '51000000-0000-0000-0000-000000000003', 'ENT'),
  ('52000000-0000-0000-0000-000000000205', '51000000-0000-0000-0000-000000000003', 'Gynaecology'),
  ('52000000-0000-0000-0000-000000000301', '51000000-0000-0000-0000-000000000004', 'General Medicine'),
  ('52000000-0000-0000-0000-000000000302', '51000000-0000-0000-0000-000000000004', 'Orthopaedics'),
  ('52000000-0000-0000-0000-000000000303', '51000000-0000-0000-0000-000000000004', 'Paediatrics'),
  ('52000000-0000-0000-0000-000000000304', '51000000-0000-0000-0000-000000000004', 'Dermatology'),
  ('52000000-0000-0000-0000-000000000305', '51000000-0000-0000-0000-000000000004', 'ENT'),
  ('52000000-0000-0000-0000-000000000401', '51000000-0000-0000-0000-000000000005', 'General Medicine'),
  ('52000000-0000-0000-0000-000000000402', '51000000-0000-0000-0000-000000000005', 'Cardiology'),
  ('52000000-0000-0000-0000-000000000403', '51000000-0000-0000-0000-000000000005', 'Orthopaedics'),
  ('52000000-0000-0000-0000-000000000404', '51000000-0000-0000-0000-000000000005', 'Paediatrics'),
  ('52000000-0000-0000-0000-000000000405', '51000000-0000-0000-0000-000000000005', 'Gynaecology'),
  ('52000000-0000-0000-0000-000000000501', '51000000-0000-0000-0000-000000000006', 'General Medicine'),
  ('52000000-0000-0000-0000-000000000502', '51000000-0000-0000-0000-000000000006', 'Cardiology'),
  ('52000000-0000-0000-0000-000000000503', '51000000-0000-0000-0000-000000000006', 'Orthopaedics'),
  ('52000000-0000-0000-0000-000000000504', '51000000-0000-0000-0000-000000000006', 'Dermatology'),
  ('52000000-0000-0000-0000-000000000505', '51000000-0000-0000-0000-000000000006', 'Gynaecology'),
  ('52000000-0000-0000-0000-000000000601', '51000000-0000-0000-0000-000000000007', 'General Medicine'),
  ('52000000-0000-0000-0000-000000000602', '51000000-0000-0000-0000-000000000007', 'Cardiology'),
  ('52000000-0000-0000-0000-000000000603', '51000000-0000-0000-0000-000000000007', 'Paediatrics'),
  ('52000000-0000-0000-0000-000000000604', '51000000-0000-0000-0000-000000000007', 'ENT'),
  ('52000000-0000-0000-0000-000000000605', '51000000-0000-0000-0000-000000000007', 'Gynaecology'),
  ('52000000-0000-0000-0000-000000000701', '51000000-0000-0000-0000-000000000008', 'General Medicine'),
  ('52000000-0000-0000-0000-000000000702', '51000000-0000-0000-0000-000000000008', 'Cardiology'),
  ('52000000-0000-0000-0000-000000000703', '51000000-0000-0000-0000-000000000008', 'Orthopaedics'),
  ('52000000-0000-0000-0000-000000000704', '51000000-0000-0000-0000-000000000008', 'Dermatology'),
  ('52000000-0000-0000-0000-000000000705', '51000000-0000-0000-0000-000000000008', 'ENT'),
  ('52000000-0000-0000-0000-000000000801', '51000000-0000-0000-0000-000000000009', 'General Medicine'),
  ('52000000-0000-0000-0000-000000000802', '51000000-0000-0000-0000-000000000009', 'Cardiology'),
  ('52000000-0000-0000-0000-000000000803', '51000000-0000-0000-0000-000000000009', 'Orthopaedics'),
  ('52000000-0000-0000-0000-000000000804', '51000000-0000-0000-0000-000000000009', 'Paediatrics'),
  ('52000000-0000-0000-0000-000000000805', '51000000-0000-0000-0000-000000000009', 'Dermatology')
on conflict (id) do update set name = excluded.name;

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

-- 3b. Two fictional doctors for each hospital (verified, so booking can offer them).
-- Every name, registration number and phone number is made up. The accounts come from seed-users.ts
-- (doc01@vyana.test ... doc18@vyana.test).
insert into public.profiles (id, role, full_name, phone, dob, gender, city, preferred_language, onboarded)
values
  ('00000000-0000-0000-0000-000000000101', 'doctor', 'Dr. Kavita Nair', '+91 00000 00101', '1976-02-11', 'female', 'Delhi', 'en', true),
  ('00000000-0000-0000-0000-000000000102', 'doctor', 'Dr. Sandeep Bhatia', '+91 00000 00102', '1977-03-12', 'male', 'Delhi', 'en', true),
  ('00000000-0000-0000-0000-000000000103', 'doctor', 'Dr. Meenal Joshi', '+91 00000 00103', '1978-04-13', 'female', 'Delhi', 'en', true),
  ('00000000-0000-0000-0000-000000000104', 'doctor', 'Dr. Harpreet Gill', '+91 00000 00104', '1979-05-14', 'male', 'Delhi', 'en', true),
  ('00000000-0000-0000-0000-000000000105', 'doctor', 'Dr. Farhan Siddiqui', '+91 00000 00105', '1980-06-15', 'male', 'Delhi', 'en', true),
  ('00000000-0000-0000-0000-000000000106', 'doctor', 'Dr. Lata Menon', '+91 00000 00106', '1981-07-16', 'female', 'Delhi', 'en', true),
  ('00000000-0000-0000-0000-000000000107', 'doctor', 'Dr. Arjun Pillai', '+91 00000 00107', '1982-08-17', 'male', 'Delhi', 'en', true),
  ('00000000-0000-0000-0000-000000000108', 'doctor', 'Dr. Ritu Saxena', '+91 00000 00108', '1983-09-18', 'female', 'Delhi', 'en', true),
  ('00000000-0000-0000-0000-000000000109', 'doctor', 'Dr. Manoj Tiwari', '+91 00000 00109', '1984-01-10', 'male', 'Delhi', 'en', true),
  ('00000000-0000-0000-0000-000000000110', 'doctor', 'Dr. Shweta Kulkarni', '+91 00000 00110', '1985-02-11', 'female', 'Delhi', 'en', true),
  ('00000000-0000-0000-0000-000000000111', 'doctor', 'Dr. Vikram Malhotra', '+91 00000 00111', '1986-03-12', 'male', 'Delhi', 'en', true),
  ('00000000-0000-0000-0000-000000000112', 'doctor', 'Dr. Anjali Deshmukh', '+91 00000 00112', '1987-04-13', 'female', 'Delhi', 'en', true),
  ('00000000-0000-0000-0000-000000000113', 'doctor', 'Dr. Rohit Verma', '+91 00000 00113', '1988-05-14', 'male', 'Delhi', 'en', true),
  ('00000000-0000-0000-0000-000000000114', 'doctor', 'Dr. Nandini Iyer', '+91 00000 00114', '1989-06-15', 'female', 'Delhi', 'en', true),
  ('00000000-0000-0000-0000-000000000115', 'doctor', 'Dr. Imran Qureshi', '+91 00000 00115', '1990-07-16', 'male', 'Delhi', 'en', true),
  ('00000000-0000-0000-0000-000000000116', 'doctor', 'Dr. Pooja Chawla', '+91 00000 00116', '1991-08-17', 'female', 'Delhi', 'en', true),
  ('00000000-0000-0000-0000-000000000117', 'doctor', 'Dr. Tarun Bansal', '+91 00000 00117', '1992-09-18', 'male', 'Delhi', 'en', true),
  ('00000000-0000-0000-0000-000000000118', 'doctor', 'Dr. Divya Krishnan', '+91 00000 00118', '1993-01-10', 'female', 'Delhi', 'en', true)
on conflict (id) do update set
  full_name = excluded.full_name, role = excluded.role, onboarded = excluded.onboarded;

insert into public.doctors (id, specialization, reg_no, state_council, year_of_registration, consultation_fee, verification_status, verification_json, verified_at, hospital_id, department_id)
select v.id, v.specialization, v.reg_no, v.state_council, v.year_of_registration, v.consultation_fee, 'verified',
       '{"source": "seed", "note": "demo doctor, not a real registration"}'::jsonb, now(), v.hospital_id, v.department_id
from (values
  ('00000000-0000-0000-0000-000000000101'::uuid, 'General Physician', 'DEMO-1001', 'Delhi Medical Council', 2001, 500, '51000000-0000-0000-0000-000000000001'::uuid, '52000000-0000-0000-0000-000000000001'::uuid),
  ('00000000-0000-0000-0000-000000000102'::uuid, 'Cardiologist', 'DEMO-1002', 'Delhi Medical Council', 2002, 800, '51000000-0000-0000-0000-000000000001'::uuid, '52000000-0000-0000-0000-000000000002'::uuid),
  ('00000000-0000-0000-0000-000000000103'::uuid, 'General Physician', 'DEMO-1003', 'Delhi Medical Council', 2003, 500, '51000000-0000-0000-0000-000000000002'::uuid, '52000000-0000-0000-0000-000000000101'::uuid),
  ('00000000-0000-0000-0000-000000000104'::uuid, 'Orthopaedic Surgeon', 'DEMO-1004', 'Delhi Medical Council', 2004, 800, '51000000-0000-0000-0000-000000000002'::uuid, '52000000-0000-0000-0000-000000000102'::uuid),
  ('00000000-0000-0000-0000-000000000105'::uuid, 'General Physician', 'DEMO-1005', 'Delhi Medical Council', 2005, 500, '51000000-0000-0000-0000-000000000003'::uuid, '52000000-0000-0000-0000-000000000201'::uuid),
  ('00000000-0000-0000-0000-000000000106'::uuid, 'Cardiologist', 'DEMO-1006', 'Delhi Medical Council', 2006, 800, '51000000-0000-0000-0000-000000000003'::uuid, '52000000-0000-0000-0000-000000000202'::uuid),
  ('00000000-0000-0000-0000-000000000107'::uuid, 'General Physician', 'DEMO-1007', 'Delhi Medical Council', 2007, 500, '51000000-0000-0000-0000-000000000004'::uuid, '52000000-0000-0000-0000-000000000301'::uuid),
  ('00000000-0000-0000-0000-000000000108'::uuid, 'Orthopaedic Surgeon', 'DEMO-1008', 'Delhi Medical Council', 2008, 800, '51000000-0000-0000-0000-000000000004'::uuid, '52000000-0000-0000-0000-000000000302'::uuid),
  ('00000000-0000-0000-0000-000000000109'::uuid, 'General Physician', 'DEMO-1009', 'Delhi Medical Council', 2009, 500, '51000000-0000-0000-0000-000000000005'::uuid, '52000000-0000-0000-0000-000000000401'::uuid),
  ('00000000-0000-0000-0000-000000000110'::uuid, 'Cardiologist', 'DEMO-1010', 'Delhi Medical Council', 2010, 800, '51000000-0000-0000-0000-000000000005'::uuid, '52000000-0000-0000-0000-000000000402'::uuid),
  ('00000000-0000-0000-0000-000000000111'::uuid, 'General Physician', 'DEMO-1011', 'Delhi Medical Council', 2011, 500, '51000000-0000-0000-0000-000000000006'::uuid, '52000000-0000-0000-0000-000000000501'::uuid),
  ('00000000-0000-0000-0000-000000000112'::uuid, 'Cardiologist', 'DEMO-1012', 'Delhi Medical Council', 2012, 800, '51000000-0000-0000-0000-000000000006'::uuid, '52000000-0000-0000-0000-000000000502'::uuid),
  ('00000000-0000-0000-0000-000000000113'::uuid, 'General Physician', 'DEMO-1013', 'Delhi Medical Council', 2013, 500, '51000000-0000-0000-0000-000000000007'::uuid, '52000000-0000-0000-0000-000000000601'::uuid),
  ('00000000-0000-0000-0000-000000000114'::uuid, 'Cardiologist', 'DEMO-1014', 'Delhi Medical Council', 2014, 800, '51000000-0000-0000-0000-000000000007'::uuid, '52000000-0000-0000-0000-000000000602'::uuid),
  ('00000000-0000-0000-0000-000000000115'::uuid, 'General Physician', 'DEMO-1015', 'Delhi Medical Council', 2000, 500, '51000000-0000-0000-0000-000000000008'::uuid, '52000000-0000-0000-0000-000000000701'::uuid),
  ('00000000-0000-0000-0000-000000000116'::uuid, 'Cardiologist', 'DEMO-1016', 'Delhi Medical Council', 2001, 800, '51000000-0000-0000-0000-000000000008'::uuid, '52000000-0000-0000-0000-000000000702'::uuid),
  ('00000000-0000-0000-0000-000000000117'::uuid, 'General Physician', 'DEMO-1017', 'Delhi Medical Council', 2002, 500, '51000000-0000-0000-0000-000000000009'::uuid, '52000000-0000-0000-0000-000000000801'::uuid),
  ('00000000-0000-0000-0000-000000000118'::uuid, 'Cardiologist', 'DEMO-1018', 'Delhi Medical Council', 2003, 800, '51000000-0000-0000-0000-000000000009'::uuid, '52000000-0000-0000-0000-000000000802'::uuid)
) as v (id, specialization, reg_no, state_council, year_of_registration, consultation_fee, hospital_id, department_id)
on conflict (id) do update set
  specialization = excluded.specialization, hospital_id = excluded.hospital_id, department_id = excluded.department_id,
  verification_status = excluded.verification_status, verification_json = excluded.verification_json;

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
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'doctor', 'Dr. Rajesh Mehta', null, 'Continue diet plan. Avoid sugary foods. Drink 3L water.', current_date - 14)
on conflict (id) do nothing;

-- A doctor's diagnosis creates the patient's condition (trigger on prescriptions). The demo patient's
-- Type 2 Diabetes condition already exists, so link it to this prescription first and set the diagnosis
-- after: the trigger then finds it instead of adding a second one.
update public.conditions set prescription_id = '11111111-1111-1111-1111-111111111111'
  where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc' and prescription_id is null;
update public.prescriptions set diagnosis = 'Type 2 Diabetes'
  where id = '11111111-1111-1111-1111-111111111111' and diagnosis is distinct from 'Type 2 Diabetes';

insert into public.prescription_items (id, prescription_id, patient_id, medicine_name, strength, form, dose, frequency, times, with_food, duration_days, start_date, active)
values
  ('22222222-2222-2222-2222-222222222221', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'Metformin', '500 mg', 'tablet', '1 tablet', 'BD', '{"09:00","21:00"}', 'after', 30, current_date - 14, true),
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'Telma (Telmisartan)', '40 mg', 'tablet', '1 tablet', 'OD', '{"09:00"}', 'after', 30, current_date - 14, true),
  ('22222222-2222-2222-2222-222222222223', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'Dolo (Paracetamol)', '650 mg', 'tablet', '1 tablet', 'SOS', '{}', 'after', 5, current_date - 14, true)
on conflict (id) do nothing;

-- 9. Dose Logs (last 7 days)
-- Medicine times are India time (09:00 and 21:00 IST), the same as the app and the missed-dose check use. Only
-- doses that are already in the past are logged. The old rows of this patient are replaced so a re-run stays tidy.
delete from public.dose_logs where patient_id = '00000000-0000-0000-0000-000000000001'
  and item_id in ('22222222-2222-2222-2222-222222222221', '22222222-2222-2222-2222-222222222222');

do $$
declare
  d int;
  day_start timestamptz;
  at timestamptz;
begin
  for d in 0..6 loop
    day_start := date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) at time zone 'Asia/Kolkata';

    -- Metformin morning dose
    at := day_start + interval '9 hours';
    if at <= now() - interval '5 minutes' then
      insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
      values ('00000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222221', at, 'taken', at + interval '10 minutes')
      on conflict (item_id, scheduled_for) do nothing;
    end if;

    -- Metformin evening dose (one missed, three days ago)
    at := day_start + interval '21 hours';
    if at <= now() - interval '5 minutes' then
      insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
      values ('00000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222221', at, case when d = 2 then 'missed' else 'taken' end, at + interval '15 minutes')
      on conflict (item_id, scheduled_for) do nothing;
    end if;

    -- Telma morning dose
    at := day_start + interval '9 hours';
    if at <= now() - interval '5 minutes' then
      insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
      values ('00000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', at, 'taken', at + interval '12 minutes')
      on conflict (item_id, scheduled_for) do nothing;
    end if;
  end loop;
end $$;

-- Refill demo: the pack of Metformin runs out in 2 days (4 tablets left at 2 a day), so the home screen shows a
-- "Reorder" card. The quantity follows the doses taken above, so it stays true whenever the seed runs.
update public.prescription_items i
  set quantity_total = 4 + (select count(*) from public.dose_logs l where l.item_id = i.id and l.status = 'taken')
  where i.id = '22222222-2222-2222-2222-222222222221';
update public.prescription_items set quantity_total = 30 where id = '22222222-2222-2222-2222-222222222222';
update public.prescription_items set quantity_total = 10 where id = '22222222-2222-2222-2222-222222222223';

-- 10. Lab Reports & Values (HbA1c trend: 8.1, 7.8, 7.4, 6.8 over nine months)
insert into public.lab_reports (id, patient_id, file_path, lab_name, report_date, status, summary)
values
  ('33333333-3333-3333-3333-333333333331', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001/report1.pdf', 'Sample Diagnostics', current_date - 90, 'done', 'HbA1c elevated at 7.4%. Fasting glucose above reference range.'),
  ('33333333-3333-3333-3333-333333333332', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001/report2.pdf', 'Sample Diagnostics', current_date - 7, 'done', 'HbA1c improved to 6.8%. Fasting glucose is lower but still above the reference range.'),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001/report0a.pdf', 'Sample Diagnostics', current_date - 270, 'done', 'HbA1c 8.1%, above the reference range. Fasting glucose is high.'),
  ('33333333-3333-3333-3333-333333333334', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001/report0b.pdf', 'Sample Diagnostics', current_date - 180, 'done', 'HbA1c 7.8%, above the reference range. Fasting glucose is high.')
on conflict (id) do nothing;

insert into public.lab_values (id, report_id, patient_id, test_name, value, unit, ref_low, ref_high, flag, measured_on)
values
  ('44444444-4444-4444-4444-444444444441', '33333333-3333-3333-3333-333333333331', '00000000-0000-0000-0000-000000000001', 'HbA1c', 7.4, '%', 4.0, 5.6, 'high', current_date - 90),
  ('44444444-4444-4444-4444-444444444442', '33333333-3333-3333-3333-333333333331', '00000000-0000-0000-0000-000000000001', 'Fasting Blood Sugar', 142.0, 'mg/dL', 70.0, 100.0, 'high', current_date - 90),
  ('44444444-4444-4444-4444-444444444443', '33333333-3333-3333-3333-333333333332', '00000000-0000-0000-0000-000000000001', 'HbA1c', 6.8, '%', 4.0, 5.6, 'high', current_date - 7),
  ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333332', '00000000-0000-0000-0000-000000000001', 'Fasting Blood Sugar', 115.0, 'mg/dL', 70.0, 100.0, 'high', current_date - 7),
  ('44444444-4444-4444-4444-444444444445', '33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000001', 'HbA1c', 8.1, '%', 4.0, 5.6, 'high', current_date - 270),
  ('44444444-4444-4444-4444-444444444446', '33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000001', 'Fasting Blood Sugar', 168.0, 'mg/dL', 70.0, 100.0, 'high', current_date - 270),
  ('44444444-4444-4444-4444-444444444447', '33333333-3333-3333-3333-333333333334', '00000000-0000-0000-0000-000000000001', 'HbA1c', 7.8, '%', 4.0, 5.6, 'high', current_date - 180),
  ('44444444-4444-4444-4444-444444444448', '33333333-3333-3333-3333-333333333334', '00000000-0000-0000-0000-000000000001', 'Fasting Blood Sugar', 154.0, 'mg/dL', 70.0, 100.0, 'high', current_date - 180)
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

-- 11b. Three days of meals for the demo patient (a diabetic diet, in India time), for the meal log in the care plan.
delete from public.meal_logs where patient_id = '00000000-0000-0000-0000-000000000001';

do $$
declare
  d int;
  day_start timestamptz;
begin
  for d in 0..2 loop
    day_start := date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) at time zone 'Asia/Kolkata';
    insert into public.meal_logs (patient_id, meal, description, calories, logged_at) values
      ('00000000-0000-0000-0000-000000000001', 'breakfast', 'Vegetable poha, tea without sugar', 310, day_start + interval '8 hours 30 minutes'),
      ('00000000-0000-0000-0000-000000000001', 'lunch', '2 rotis, dal, mixed sabzi, curd', 520, day_start + interval '13 hours 15 minutes'),
      ('00000000-0000-0000-0000-000000000001', 'snack', 'Roasted chana, one apple', 180, day_start + interval '17 hours'),
      ('00000000-0000-0000-0000-000000000001', 'dinner', 'Moong dal khichdi, salad', 430, day_start + interval '20 hours 15 minutes');
  end loop;
end $$;

-- 12. An approved care plan for Type 2 Diabetes (shows the "approved" badge and the follow-up test reminders).
-- Written by hand for the demo patient. Real plans come from POST /api/care-plan, where every line is checked against
-- a fetched guideline page. Sources: the NHS and MedlinePlus pages below.
insert into public.care_plans (id, patient_id, condition_id, status, language, plan_json, reviewed_by, reviewed_at)
values (
  '77777777-7777-7777-7777-777777777771',
  '00000000-0000-0000-0000-000000000001',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'approved',
  'en',
  $plan$
  {
    "condition": "Type 2 Diabetes",
    "summary": "Type 2 diabetes means the body does not use insulin well, so sugar builds up in the blood. Steady habits (food, movement, medicines and regular tests) keep it in range and protect the eyes, feet, heart and kidneys.",
    "do": [
      "Take your medicines every day at the times shown in the app.",
      "Be active for at least 150 minutes a week, for example a brisk 30 minute walk on most days.",
      "Check your blood sugar as often as your doctor advised and note the readings.",
      "Get your eyes checked and your feet examined at least once a year."
    ],
    "dont": [
      "Do not stop or change a medicine without asking your doctor.",
      "Do not skip meals while you are on diabetes medicines.",
      "Do not smoke."
    ],
    "diet": {
      "eat_more": ["Vegetables, especially green leafy ones", "Whole grains such as brown rice, oats and whole wheat roti", "Dal, chana and other pulses"],
      "limit": ["Sugary drinks and sweets", "White bread and refined flour (maida) foods", "Fried snacks"],
      "sample_day": [
        { "meal": "breakfast", "items": ["Oats or vegetable upma", "Unsweetened tea"] },
        { "meal": "lunch", "items": ["2 whole wheat rotis", "Dal", "A bowl of vegetables", "Salad"] },
        { "meal": "snack", "items": ["A handful of roasted chana"] },
        { "meal": "dinner", "items": ["Vegetable khichdi with curd", "Salad"] }
      ]
    },
    "red_flags": [
      "Very thirsty and passing a lot of urine, together with vomiting, stomach pain, fast breathing or unusual sleepiness: go to the nearest hospital or call 108.",
      "Very low blood sugar (sweating, shaking, confusion) that does not get better after taking sugar or glucose: call 108.",
      "A foot wound or sore that does not heal, or new numbness or colour change in a foot: see a doctor the same day."
    ],
    "follow_up_tests": [
      { "test": "HbA1c", "every_days": 90 },
      { "test": "Lipid profile", "every_days": 365 }
    ],
    "sources": [
      { "title": "NHS: Type 2 diabetes", "url": "https://www.nhs.uk/conditions/type-2-diabetes/" },
      { "title": "MedlinePlus: Diabetes", "url": "https://medlineplus.gov/diabetes.html" }
    ],
    "language": "en"
  }
  $plan$::jsonb,
  '00000000-0000-0000-0000-000000000002',
  now() - interval '7 days'
)
on conflict (id) do nothing;

-- 13. The demo users accepted the current consent text, so the app does not ask them again.
insert into public.consents (user_id, version)
select id, '2026-10-23' from public.profiles
where id in (
  '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000005'
)
on conflict (user_id, version) do nothing;


-- 14. Five more demo PATIENTS, each showing different features (all people, phone numbers and records are fictional).
--   Meera Iyer     heart patient: a drug-interaction warning (clopidogrel with omeprazole), a cholesterol trend, a refill card
--   Rohan Verma    asthma: inhalers (one as needed), Medical ID with allergies, a patient-generated care plan, SOS demo
--   Kavita Joshi   hypothyroidism: TSH trend from high to normal, an approved care plan, meal log, follow-up tests
--   Gopal Prasad   kidney disease and blood pressure: abnormal lab flags, missed doses, Hindi as the preferred language
--   Ananya Reddy   a scanned paper prescription for an acute illness: active medicines to price in the basket, fever readings
-- Same password rule as the other patient: the patient-role demo password (see seed-users.ts).

insert into public.profiles (id, role, full_name, phone, dob, gender, blood_group, allergies, city, preferred_language, onboarded)
values
  ('00000000-0000-0000-0000-000000000201', 'patient', 'Meera Iyer', '+91 00000 00201', '1962-03-09', 'female', 'B+', '{}', 'Delhi', 'en', true),
  ('00000000-0000-0000-0000-000000000202', 'patient', 'Rohan Verma', '+91 00000 00202', '1997-08-21', 'male', 'O+', '{"Dust mites","Sulfa drugs"}', 'Noida', 'hinglish', true),
  ('00000000-0000-0000-0000-000000000203', 'patient', 'Kavita Joshi', '+91 00000 00203', '1981-11-30', 'female', 'A+', '{}', 'Gurugram', 'en', true),
  ('00000000-0000-0000-0000-000000000204', 'patient', 'Gopal Prasad', '+91 00000 00204', '1954-06-18', 'male', 'AB+', '{}', 'Ghaziabad', 'hi', true),
  ('00000000-0000-0000-0000-000000000205', 'patient', 'Ananya Reddy', '+91 00000 00205', '1991-02-14', 'female', 'O-', '{"Sulfa drugs"}', 'Delhi', 'en', true)
on conflict (id) do update set
  full_name = excluded.full_name,
  role = excluded.role,
  dob = excluded.dob,
  gender = excluded.gender,
  blood_group = excluded.blood_group,
  allergies = excluded.allergies,
  city = excluded.city,
  preferred_language = excluded.preferred_language,
  onboarded = excluded.onboarded;

insert into public.emergency_contacts (id, patient_id, name, phone, relation)
values
  ('e9000001-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000201', 'Karthik Iyer', '+91 00000 00301', 'Son'),
  ('e9000001-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000201', 'Lakshmi Narayanan', '+91 00000 00302', 'Sister'),
  ('e9000002-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000202', 'Suresh Verma', '+91 00000 00303', 'Father'),
  ('e9000002-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000202', 'Aditya Rao', '+91 00000 00304', 'Friend'),
  ('e9000003-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000203', 'Manish Joshi', '+91 00000 00305', 'Husband'),
  ('e9000004-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000204', 'Rajesh Prasad', '+91 00000 00306', 'Son'),
  ('e9000004-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000204', 'Sita Prasad', '+91 00000 00307', 'Wife'),
  ('e9000005-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000205', 'Kiran Reddy', '+91 00000 00308', 'Husband'),
  ('e9000005-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000205', 'Lata Reddy', '+91 00000 00309', 'Mother')
on conflict (id) do nothing;

-- Conditions (a doctor's diagnosis creates the condition; they are linked to the prescriptions below first, as for the first demo patient)
insert into public.conditions (id, patient_id, name, diagnosed_on, notes, active, source)
values
  ('cd000001-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000201', 'Coronary artery disease', '2024-02-12', 'Stent placed in 2024; on regular follow-up', true, 'doctor'),
  ('cd000002-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000202', 'Asthma', '2015-04-03', 'Allergic asthma; keeps a reliever inhaler with him', true, 'doctor'),
  ('cd000003-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000203', 'Hypothyroidism', '2021-09-07', 'On a daily thyroid tablet; TSH checked every 3 months', true, 'doctor'),
  ('cd000004-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000204', 'Hypertension', '2012-05-20', 'Long-standing high blood pressure', true, 'doctor'),
  ('cd000004-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000204', 'Chronic kidney disease (stage 3)', '2023-08-02', 'Kidney function checked every few months', true, 'doctor')
on conflict (id) do nothing;

-- Appointments: one completed visit and one upcoming token each
insert into public.appointments (id, patient_id, doctor_id, hospital_id, department_id, appointment_date, token_no, scheduled_at, status, reason, doctor_notes)
values
  ('a9000001-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000002', '51000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000002', current_date - 21, 31, now() - interval '21 days', 'completed', 'Cardiology follow-up', 'Stable. Continue the medicines as prescribed. Review after 3 months.'),
  ('a9000001-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000201', null, '51000000-0000-0000-0000-000000000003', '52000000-0000-0000-0000-000000000202', current_date + 6, 23, now() + interval '6 days', 'confirmed', 'Cardiology check and lipid profile review', null),
  ('a9000002-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000002', '51000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000001', current_date - 40, 27, now() - interval '40 days', 'completed', 'Asthma review', 'Inhaler technique checked. Keep the reliever inhaler with you.'),
  ('a9000002-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000202', null, '51000000-0000-0000-0000-000000000002', '52000000-0000-0000-0000-000000000101', current_date + 9, 14, now() + interval '9 days', 'confirmed', 'Routine asthma follow-up', null),
  ('a9000003-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000003', '51000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000001', current_date - 20, 35, now() - interval '20 days', 'completed', 'Thyroid review', 'TSH is coming down. Repeat in 3 months.'),
  ('a9000003-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000203', null, '51000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000001', current_date + 12, 29, now() + interval '12 days', 'confirmed', 'Vitamin D and thyroid follow-up', null),
  ('a9000004-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000002', '51000000-0000-0000-0000-000000000003', '52000000-0000-0000-0000-000000000201', current_date - 12, 17, now() - interval '12 days', 'completed', 'Kidney and blood pressure check', 'Creatinine is higher than last time. Please do not miss doses. Review in 2 weeks.'),
  ('a9000004-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000204', null, '51000000-0000-0000-0000-000000000003', '52000000-0000-0000-0000-000000000201', current_date + 2, 9, now() + interval '2 days', 'confirmed', 'Review of kidney tests', null),
  ('a9000005-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000205', null, '51000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000006', current_date - 2, 41, now() - interval '2 days', 'completed', 'Sore throat and fever', null),
  ('a9000005-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000205', null, '51000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000006', current_date + 5, 18, now() + interval '5 days', 'confirmed', 'Follow-up after the course of medicines', null)
on conflict (id) do nothing;

-- Prescriptions (four from a doctor, one scanned from paper)
insert into public.prescriptions (id, patient_id, doctor_id, appointment_id, source, doctor_name, diagnosis, notes, issued_on)
values
  ('b1000001-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000002', 'a9000001-0000-0000-0000-000000000001', 'doctor', 'Dr. Rajesh Mehta', null, 'Continue the medicines as prescribed. Review after 3 months.', current_date - 21),
  ('b1000002-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000002', 'a9000002-0000-0000-0000-000000000001', 'doctor', 'Dr. Rajesh Mehta', null, 'Use the controller inhaler every day. The reliever only when needed.', current_date - 40),
  ('b1000003-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000003', 'a9000003-0000-0000-0000-000000000001', 'doctor', 'Dr. Sneha Gupta', null, 'Take the thyroid tablet on an empty stomach. Repeat the TSH test in 3 months.', current_date - 20),
  ('b1000004-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000002', 'a9000004-0000-0000-0000-000000000001', 'doctor', 'Dr. Rajesh Mehta', null, 'Take the medicines every day. Come back with a fresh creatinine and urea report.', current_date - 12),
  ('b1000005-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000205', null, null, 'upload', 'Dr. A. Khan', 'Acute tonsillitis', 'Scanned from a paper prescription. Finish the whole course.', current_date - 2)
on conflict (id) do nothing;

update public.conditions set prescription_id = 'b1000001-0000-0000-0000-000000000001' where id = 'cd000001-0000-0000-0000-000000000001' and prescription_id is null;
update public.conditions set prescription_id = 'b1000002-0000-0000-0000-000000000001' where id = 'cd000002-0000-0000-0000-000000000001' and prescription_id is null;
update public.conditions set prescription_id = 'b1000003-0000-0000-0000-000000000001' where id = 'cd000003-0000-0000-0000-000000000001' and prescription_id is null;
update public.conditions set prescription_id = 'b1000004-0000-0000-0000-000000000001' where id = 'cd000004-0000-0000-0000-000000000001' and prescription_id is null;
update public.prescriptions set diagnosis = 'Coronary artery disease' where id = 'b1000001-0000-0000-0000-000000000001' and diagnosis is distinct from 'Coronary artery disease';
update public.prescriptions set diagnosis = 'Asthma' where id = 'b1000002-0000-0000-0000-000000000001' and diagnosis is distinct from 'Asthma';
update public.prescriptions set diagnosis = 'Hypothyroidism' where id = 'b1000003-0000-0000-0000-000000000001' and diagnosis is distinct from 'Hypothyroidism';
update public.prescriptions set diagnosis = 'Hypertension' where id = 'b1000004-0000-0000-0000-000000000001' and diagnosis is distinct from 'Hypertension';

-- Medicines (item id: ...b2 + patient number, then 1, 2, 3 ...)
insert into public.prescription_items (id, prescription_id, patient_id, medicine_name, strength, form, dose, frequency, times, with_food, duration_days, start_date, instructions, active, quantity_total)
values
  ('b2000001-0000-0000-0000-000000000001', 'b1000001-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000201', 'Clopidogrel', '75 mg', 'tablet', '1 tablet', 'OD', '{"09:00"}', 'after', 90, current_date - 21, null, true, null),
  ('b2000001-0000-0000-0000-000000000002', 'b1000001-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000201', 'Omeprazole', '20 mg', 'capsule', '1 capsule', 'OD', '{"08:00"}', 'before', 90, current_date - 21, 'Before breakfast', true, 30),
  ('b2000001-0000-0000-0000-000000000003', 'b1000001-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000201', 'Atorvastatin', '20 mg', 'tablet', '1 tablet', 'OD', '{"21:00"}', 'after', 90, current_date - 21, null, true, 30),
  ('b2000001-0000-0000-0000-000000000004', 'b1000001-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000201', 'Metoprolol Succinate', '25 mg', 'tablet', '1 tablet', 'OD', '{"09:00"}', 'after', 90, current_date - 21, null, true, 30),
  ('b2000002-0000-0000-0000-000000000001', 'b1000002-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000202', 'Budesonide + Formoterol', '200/6 mcg', 'inhaler', '2 puffs', 'BD', '{"08:00","20:00"}', 'any', 90, current_date - 40, 'Rinse the mouth after use', true, 120),
  ('b2000002-0000-0000-0000-000000000002', 'b1000002-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000202', 'Salbutamol', '100 mcg', 'inhaler', '2 puffs', 'SOS', '{}', 'any', 90, current_date - 40, 'Only when wheezing or short of breath', true, 200),
  ('b2000002-0000-0000-0000-000000000003', 'b1000002-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000202', 'Montelukast', '10 mg', 'tablet', '1 tablet', 'HS', '{"22:00"}', 'any', 90, current_date - 40, null, true, 30),
  ('b2000003-0000-0000-0000-000000000001', 'b1000003-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000203', 'Levothyroxine', '75 mcg', 'tablet', '1 tablet', 'OD', '{"06:30"}', 'before', 90, current_date - 20, 'On an empty stomach, 30 minutes before breakfast', true, 30),
  ('b2000003-0000-0000-0000-000000000002', 'b1000003-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000203', 'Vitamin D3', '1000 IU', 'tablet', '1 tablet', 'OD', '{"13:30"}', 'after', 90, current_date - 20, null, true, 60),
  ('b2000004-0000-0000-0000-000000000001', 'b1000004-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000204', 'Amlodipine', '5 mg', 'tablet', '1 tablet', 'OD', '{"09:00"}', 'after', 60, current_date - 12, null, true, 30),
  ('b2000004-0000-0000-0000-000000000002', 'b1000004-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000204', 'Telmisartan', '40 mg', 'tablet', '1 tablet', 'OD', '{"09:00"}', 'after', 60, current_date - 12, null, true, 30),
  ('b2000004-0000-0000-0000-000000000003', 'b1000004-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000204', 'Atorvastatin', '10 mg', 'tablet', '1 tablet', 'HS', '{"21:00"}', 'after', 60, current_date - 12, null, true, 30),
  ('b2000004-0000-0000-0000-000000000004', 'b1000004-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000204', 'Folic Acid', '5 mg', 'tablet', '1 tablet', 'OD', '{"13:00"}', 'after', 60, current_date - 12, null, true, 30),
  ('b2000005-0000-0000-0000-000000000001', 'b1000005-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000205', 'Amoxicillin + Clavulanic Acid', '625 mg', 'tablet', '1 tablet', 'BD', '{"09:00","21:00"}', 'after', 5, current_date - 2, 'Finish the whole course', true, 10),
  ('b2000005-0000-0000-0000-000000000002', 'b1000005-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000205', 'Paracetamol', '650 mg', 'tablet', '1 tablet', 'SOS', '{}', 'after', 5, current_date - 2, 'Only for fever or pain', true, 10),
  ('b2000005-0000-0000-0000-000000000003', 'b1000005-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000205', 'Pantoprazole', '40 mg', 'tablet', '1 tablet', 'OD', '{"08:00"}', 'before', 5, current_date - 2, 'Before breakfast', true, 5),
  ('b2000005-0000-0000-0000-000000000004', 'b1000005-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000205', 'Cetirizine', '10 mg', 'tablet', '1 tablet', 'HS', '{"22:00"}', 'any', 5, current_date - 2, null, true, 5)
on conflict (id) do nothing;

-- Dose logs for the last 7 days (India time). Columns: item, hour, day offsets that were missed, day offsets that were skipped.
delete from public.dose_logs where patient_id in ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000205');

do $$
declare
  r record;
  d int;
  day_start timestamptz;
  at timestamptz;
begin
  for r in
    select * from (values
      -- Meera: very regular, one missed evening statin
      ('b2000001-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000201'::uuid, 9, array[]::int[], array[]::int[]),
      ('b2000001-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000201'::uuid, 8, array[]::int[], array[]::int[]),
      ('b2000001-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000201'::uuid, 21, array[3], array[]::int[]),
      ('b2000001-0000-0000-0000-000000000004'::uuid, '00000000-0000-0000-0000-000000000201'::uuid, 9, array[]::int[], array[]::int[]),
      -- Rohan: good, two skipped evening puffs
      ('b2000002-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000202'::uuid, 8, array[]::int[], array[]::int[]),
      ('b2000002-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000202'::uuid, 22, array[]::int[], array[1,4]),
      -- Kavita: perfect streak
      ('b2000003-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000203'::uuid, 6, array[]::int[], array[]::int[]),
      ('b2000003-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000203'::uuid, 13, array[]::int[], array[]::int[]),
      -- Gopal: poor, many missed doses (shows the missed-dose logic and the caregiver alert)
      ('b2000004-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000204'::uuid, 9, array[0,1,3,5], array[]::int[]),
      ('b2000004-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000204'::uuid, 9, array[0,1,3,5], array[]::int[]),
      ('b2000004-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000204'::uuid, 21, array[1,2,4], array[]::int[]),
      -- Ananya: only the last two days of the antibiotic course
      ('b2000005-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000205'::uuid, 9, array[]::int[], array[]::int[]),
      ('b2000005-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000205'::uuid, 8, array[]::int[], array[]::int[])
    ) as t(item_id, patient_id, hour, missed_days, skipped_days)
  loop
    for d in 0..6 loop
      -- Ananya's course began 2 days ago
      continue when r.patient_id = '00000000-0000-0000-0000-000000000205'::uuid and d > 2;
      day_start := date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) at time zone 'Asia/Kolkata';
      at := day_start + (r.hour || ' hours')::interval;
      if at <= now() - interval '5 minutes' then
        insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
        values (r.patient_id, r.item_id, at,
                case when d = any (r.missed_days) then 'missed' when d = any (r.skipped_days) then 'skipped' else 'taken' end,
                at + interval '10 minutes')
        on conflict (item_id, scheduled_for) do nothing;
      end if;
    end loop;
  end loop;
end $$;

-- Ananya's evening antibiotic dose too (2 per day)
do $$
declare d int; day_start timestamptz; at timestamptz;
begin
  for d in 0..2 loop
    day_start := date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) at time zone 'Asia/Kolkata';
    at := day_start + interval '21 hours';
    if at <= now() - interval '5 minutes' then
      insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
      values ('00000000-0000-0000-0000-000000000205', 'b2000005-0000-0000-0000-000000000001', at, 'taken', at + interval '8 minutes')
      on conflict (item_id, scheduled_for) do nothing;
    end if;
  end loop;
end $$;

-- Refill cards: Meera's clopidogrel and Gopal's atorvastatin run out in a few days.
update public.prescription_items i
  set quantity_total = 4 + (select count(*) from public.dose_logs l where l.item_id = i.id and l.status = 'taken')
  where i.id in ('b2000001-0000-0000-0000-000000000001', 'b2000004-0000-0000-0000-000000000003');

-- Lab reports and values (the file paths are placeholders: no real files)
insert into public.lab_reports (id, patient_id, file_path, lab_name, report_date, status, summary)
values
  ('f1000001-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000201/lipid-1.pdf', 'Sample Diagnostics', current_date - 240, 'done', 'LDL cholesterol 142 mg/dL, above the reference range.'),
  ('f1000001-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000201/lipid-2.pdf', 'Sample Diagnostics', current_date - 120, 'done', 'LDL cholesterol 118 mg/dL, lower but still above the reference range.'),
  ('f1000001-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000201/lipid-3.pdf', 'Sample Diagnostics', current_date - 14, 'done', 'LDL cholesterol 96 mg/dL, within the reference range.'),
  ('f1000002-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000202/cbc-1.pdf', 'Sample Diagnostics', current_date - 38, 'done', 'Eosinophils are above the reference range. Other values are within range.'),
  ('f1000003-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000203/thyroid-1.pdf', 'Sample Diagnostics', current_date - 270, 'done', 'TSH 8.2 mIU/L, above the reference range.'),
  ('f1000003-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000203/thyroid-2.pdf', 'Sample Diagnostics', current_date - 150, 'done', 'TSH 5.9 mIU/L, lower but still above the reference range.'),
  ('f1000003-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000203/thyroid-3.pdf', 'Sample Diagnostics', current_date - 21, 'done', 'TSH 3.8 mIU/L, within the reference range. Vitamin D is below the reference range.'),
  ('f1000004-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000204/kidney-1.pdf', 'Sample Diagnostics', current_date - 300, 'done', 'Creatinine 1.5 mg/dL and urea above the reference range.'),
  ('f1000004-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000204/kidney-2.pdf', 'Sample Diagnostics', current_date - 140, 'done', 'Creatinine 1.8 mg/dL, higher than before. Haemoglobin is below the reference range.'),
  ('f1000004-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000204/kidney-3.pdf', 'Sample Diagnostics', current_date - 13, 'done', 'Creatinine 2.1 mg/dL, higher again. Urea and haemoglobin are outside the reference range.'),
  ('f1000005-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000205', '00000000-0000-0000-0000-000000000205/cbc-1.pdf', 'Sample Diagnostics', current_date - 2, 'done', 'White cell count and CRP are above the reference range; haemoglobin is below it.')
on conflict (id) do nothing;

insert into public.lab_values (id, report_id, patient_id, test_name, value, unit, ref_low, ref_high, flag, measured_on)
values
  ('f2000001-0000-0000-0000-000000000001', 'f1000001-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000201', 'LDL Cholesterol', 142, 'mg/dL', 0, 100, 'high', current_date - 240),
  ('f2000001-0000-0000-0000-000000000002', 'f1000001-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000201', 'Total Cholesterol', 214, 'mg/dL', 0, 200, 'high', current_date - 240),
  ('f2000001-0000-0000-0000-000000000003', 'f1000001-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000201', 'LDL Cholesterol', 118, 'mg/dL', 0, 100, 'high', current_date - 120),
  ('f2000001-0000-0000-0000-000000000004', 'f1000001-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000201', 'Total Cholesterol', 192, 'mg/dL', 0, 200, 'normal', current_date - 120),
  ('f2000001-0000-0000-0000-000000000005', 'f1000001-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000201', 'LDL Cholesterol', 96, 'mg/dL', 0, 100, 'normal', current_date - 14),
  ('f2000001-0000-0000-0000-000000000006', 'f1000001-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000201', 'Total Cholesterol', 171, 'mg/dL', 0, 200, 'normal', current_date - 14),
  ('f2000002-0000-0000-0000-000000000001', 'f1000002-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000202', 'Eosinophils', 0.62, '10^3/uL', 0, 0.5, 'high', current_date - 38),
  ('f2000002-0000-0000-0000-000000000002', 'f1000002-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000202', 'Hemoglobin', 14.8, 'g/dL', 13, 17, 'normal', current_date - 38),
  ('f2000003-0000-0000-0000-000000000001', 'f1000003-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000203', 'TSH', 8.2, 'mIU/L', 0.4, 4.0, 'high', current_date - 270),
  ('f2000003-0000-0000-0000-000000000002', 'f1000003-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000203', 'TSH', 5.9, 'mIU/L', 0.4, 4.0, 'high', current_date - 150),
  ('f2000003-0000-0000-0000-000000000003', 'f1000003-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000203', 'TSH', 3.8, 'mIU/L', 0.4, 4.0, 'normal', current_date - 21),
  ('f2000003-0000-0000-0000-000000000004', 'f1000003-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000203', 'Vitamin D (25-OH)', 18, 'ng/mL', 30, 100, 'low', current_date - 21),
  ('f2000004-0000-0000-0000-000000000001', 'f1000004-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000204', 'Creatinine', 1.5, 'mg/dL', 0.7, 1.2, 'high', current_date - 300),
  ('f2000004-0000-0000-0000-000000000002', 'f1000004-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000204', 'Urea', 48, 'mg/dL', 17, 43, 'high', current_date - 300),
  ('f2000004-0000-0000-0000-000000000003', 'f1000004-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000204', 'Creatinine', 1.8, 'mg/dL', 0.7, 1.2, 'high', current_date - 140),
  ('f2000004-0000-0000-0000-000000000004', 'f1000004-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000204', 'Hemoglobin', 11.6, 'g/dL', 13, 17, 'low', current_date - 140),
  ('f2000004-0000-0000-0000-000000000005', 'f1000004-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000204', 'Creatinine', 2.1, 'mg/dL', 0.7, 1.2, 'high', current_date - 13),
  ('f2000004-0000-0000-0000-000000000006', 'f1000004-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000204', 'Urea', 58, 'mg/dL', 17, 43, 'high', current_date - 13),
  ('f2000004-0000-0000-0000-000000000007', 'f1000004-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000204', 'Hemoglobin', 11.2, 'g/dL', 13, 17, 'low', current_date - 13),
  ('f2000005-0000-0000-0000-000000000001', 'f1000005-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000205', 'White Blood Cells', 13.2, '10^3/uL', 4, 11, 'high', current_date - 2),
  ('f2000005-0000-0000-0000-000000000002', 'f1000005-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000205', 'C-Reactive Protein', 18, 'mg/L', 0, 5, 'high', current_date - 2),
  ('f2000005-0000-0000-0000-000000000003', 'f1000005-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000205', 'Hemoglobin', 10.4, 'g/dL', 12, 15, 'low', current_date - 2),
  ('f2000005-0000-0000-0000-000000000004', 'f1000005-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000205', 'Platelets', 240, '10^3/uL', 150, 410, 'normal', current_date - 2)
on conflict (id) do nothing;

-- Seven days of readings. Meera: blood pressure and pulse. Rohan: oxygen level and pulse. Kavita: weight.
-- Gopal: high blood pressure. Ananya: a fever that comes down over four days.
delete from public.vitals where patient_id in ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000205');

do $$
declare
  d int;
  t timestamptz;
begin
  for d in 0..6 loop
    t := now() - (d || ' days')::interval;
    insert into public.vitals (patient_id, type, value, value2, unit, measured_at) values
      ('00000000-0000-0000-0000-000000000201', 'bp', 132 + (d % 4), 82 + (d % 3), 'mmHg', t - interval '1 hour'),
      ('00000000-0000-0000-0000-000000000204', 'bp', 148 + (d % 5), 90 + (d % 4), 'mmHg', t - interval '1 hour');
    insert into public.vitals (patient_id, type, value, unit, measured_at) values
      ('00000000-0000-0000-0000-000000000201', 'heart_rate', 66 + (d % 5), 'bpm', t - interval '90 minutes'),
      ('00000000-0000-0000-0000-000000000202', 'spo2', 97 + (d % 3), '%', t - interval '1 hour'),
      ('00000000-0000-0000-0000-000000000202', 'heart_rate', 70 + (d % 6), 'bpm', t - interval '90 minutes'),
      ('00000000-0000-0000-0000-000000000203', 'weight', 64.6 - (d * 0.1), 'kg', t - interval '3 hours'),
      ('00000000-0000-0000-0000-000000000204', 'weight', 68.2 - (d * 0.1), 'kg', t - interval '3 hours'),
      ('00000000-0000-0000-0000-000000000201', 'weight', 61.4 - (d * 0.1), 'kg', t - interval '3 hours'),
      ('00000000-0000-0000-0000-000000000201', 'spo2', 97 + (d % 2), '%', t - interval '100 minutes'),
      ('00000000-0000-0000-0000-000000000202', 'weight', 70.8 - (d * 0.1), 'kg', t - interval '3 hours'),
      ('00000000-0000-0000-0000-000000000203', 'heart_rate', 72 + (d % 6), 'bpm', t - interval '90 minutes'),
      ('00000000-0000-0000-0000-000000000203', 'spo2', 98 + (d % 2), '%', t - interval '100 minutes'),
      ('00000000-0000-0000-0000-000000000204', 'heart_rate', 74 + (d % 7), 'bpm', t - interval '90 minutes'),
      ('00000000-0000-0000-0000-000000000204', 'spo2', 95 + (d % 3), '%', t - interval '100 minutes'),
      ('00000000-0000-0000-0000-000000000204', 'sugar_random', 128 + (d * 3), 'mg/dL', t - interval '4 hours');
  end loop;
  for d in 0..3 loop
    t := now() - (d || ' days')::interval;
    insert into public.vitals (patient_id, type, value, unit, measured_at)
    values ('00000000-0000-0000-0000-000000000205', 'heart_rate', 96 - (d * 5), 'bpm', t - interval '150 minutes'),
           ('00000000-0000-0000-0000-000000000205', 'spo2', 97 + (case when d < 2 then 2 else 0 end), '%', t - interval '110 minutes');
    insert into public.vitals (patient_id, type, value, unit, measured_at)
    values ('00000000-0000-0000-0000-000000000205', 'temperature', 98.6 + (case when d = 0 then 0.3 when d = 1 then 1.1 when d = 2 then 2.2 else 2.6 end), '°F', t - interval '2 hours');
  end loop;
end $$;

-- Kavita's meals for three days (for the meal log in the care plan)
delete from public.meal_logs where patient_id = '00000000-0000-0000-0000-000000000203';
do $$
declare d int; day_start timestamptz;
begin
  for d in 0..2 loop
    day_start := date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) at time zone 'Asia/Kolkata';
    insert into public.meal_logs (patient_id, meal, description, calories, logged_at) values
      ('00000000-0000-0000-0000-000000000203', 'breakfast', 'Oats upma, one banana', 340, day_start + interval '8 hours 15 minutes'),
      ('00000000-0000-0000-0000-000000000203', 'lunch', '2 rotis, rajma, salad, curd', 560, day_start + interval '13 hours'),
      ('00000000-0000-0000-0000-000000000203', 'snack', 'Roasted makhana, green tea', 130, day_start + interval '17 hours'),
      ('00000000-0000-0000-0000-000000000203', 'dinner', 'Vegetable khichdi, a bowl of dal', 450, day_start + interval '20 hours');
  end loop;
end $$;

-- Meera and Gopal: three days of meals (a heart-friendly diet; a low-salt diet)
delete from public.meal_logs where patient_id in ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000204');
do $$
declare d int; day_start timestamptz;
begin
  for d in 0..2 loop
    day_start := date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) at time zone 'Asia/Kolkata';
    insert into public.meal_logs (patient_id, meal, description, calories, logged_at) values
      ('00000000-0000-0000-0000-000000000201', 'breakfast', 'Vegetable daliya, a glass of low-fat milk', 290, day_start + interval '8 hours'),
      ('00000000-0000-0000-0000-000000000201', 'lunch', '2 rotis, lauki sabzi, dal, salad', 480, day_start + interval '13 hours'),
      ('00000000-0000-0000-0000-000000000201', 'snack', 'A handful of almonds, one guava', 190, day_start + interval '17 hours'),
      ('00000000-0000-0000-0000-000000000201', 'dinner', 'Vegetable soup, 1 roti, paneer bhurji', 410, day_start + interval '20 hours'),
      ('00000000-0000-0000-0000-000000000204', 'breakfast', 'Plain upma without added salt, tea', 260, day_start + interval '7 hours 45 minutes'),
      ('00000000-0000-0000-0000-000000000204', 'lunch', '2 rotis, moong dal, bottle gourd sabzi', 440, day_start + interval '12 hours 30 minutes'),
      ('00000000-0000-0000-0000-000000000204', 'dinner', 'Khichdi with curd, cucumber salad', 380, day_start + interval '19 hours 30 minutes');
  end loop;
end $$;

-- Care plans (written by hand for the demo; real plans come from POST /api/care-plan, where every line is checked
-- against a fetched guideline page). Kavita's is approved by the demo doctor; Rohan's shows the "not reviewed by a doctor" badge.
insert into public.care_plans (id, patient_id, condition_id, status, language, plan_json, reviewed_by, reviewed_at)
values (
  'c9000003-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000203', 'cd000003-0000-0000-0000-000000000001', 'approved', 'en',
  $plan$
  {
    "condition": "Hypothyroidism",
    "summary": "With an underactive thyroid the body makes too little thyroid hormone. A daily tablet replaces it, and regular blood tests (TSH) show whether the amount is right.",
    "do": [
      "Take your thyroid tablet at the same time every day, on an empty stomach.",
      "Wait about 30 minutes before eating breakfast or having tea or coffee.",
      "Get your TSH checked when your doctor asks, usually every few months.",
      "Tell your doctor about every other medicine or supplement you take."
    ],
    "dont": [
      "Do not stop or change the tablet on your own, even when you feel well.",
      "Do not take the tablet together with calcium or iron supplements; ask your doctor how far apart to take them."
    ],
    "diet": {
      "eat_more": ["Fruits and vegetables", "Whole grains such as oats and whole wheat roti", "Dal, beans and other pulses"],
      "limit": ["Very large amounts of soy products", "Highly processed snacks"],
      "sample_day": [
        { "meal": "breakfast", "items": ["Oats upma", "A banana"] },
        { "meal": "lunch", "items": ["2 rotis", "Rajma", "Salad", "Curd"] },
        { "meal": "snack", "items": ["Roasted makhana"] },
        { "meal": "dinner", "items": ["Vegetable khichdi", "A bowl of dal"] }
      ]
    },
    "red_flags": [
      "Chest pain, a very fast or irregular heartbeat, or trouble breathing: call 108.",
      "Extreme tiredness with confusion, a very slow pulse or feeling very cold: go to the nearest hospital.",
      "A new swelling in the neck or trouble swallowing: see a doctor soon."
    ],
    "follow_up_tests": [
      { "test": "TSH", "every_days": 90 },
      { "test": "Vitamin D", "every_days": 180 }
    ],
    "sources": [
      { "title": "NHS: Underactive thyroid", "url": "https://www.nhs.uk/conditions/underactive-thyroid-hypothyroidism/" },
      { "title": "MedlinePlus: Hypothyroidism", "url": "https://medlineplus.gov/hypothyroidism.html" }
    ],
    "language": "en"
  }
  $plan$::jsonb,
  '00000000-0000-0000-0000-000000000003', now() - interval '20 days'
),
(
  'c9000002-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000202', 'cd000002-0000-0000-0000-000000000001', 'patient_generated', 'en',
  $plan$
  {
    "condition": "Asthma",
    "summary": "Asthma makes the airways narrow and swollen, which causes wheezing and shortness of breath. Using the controller inhaler every day and knowing your triggers keeps symptoms down.",
    "do": [
      "Use your controller inhaler every day, even when you feel well.",
      "Keep your reliever inhaler with you at all times.",
      "Note what sets off your symptoms (dust, smoke, cold air, pollen) and avoid them where you can.",
      "Keep a written asthma action plan from your doctor."
    ],
    "dont": [
      "Do not stop the controller inhaler without asking your doctor.",
      "Do not smoke, and stay away from other people's smoke."
    ],
    "diet": {
      "eat_more": ["Fruits and vegetables", "A balanced diet with enough water"],
      "limit": ["Foods you know trigger your symptoms"],
      "sample_day": [
        { "meal": "breakfast", "items": ["Oats with fruit"] },
        { "meal": "lunch", "items": ["Rotis", "Dal", "Vegetables", "Curd"] },
        { "meal": "dinner", "items": ["Khichdi", "Salad"] }
      ]
    },
    "red_flags": [
      "Severe breathlessness, being unable to speak a full sentence, or blue lips: call 108 now.",
      "Your reliever inhaler gives no relief or you need it more often than usual: get medical help the same day."
    ],
    "follow_up_tests": [
      { "test": "Peak flow or lung function check", "every_days": 180 }
    ],
    "sources": [
      { "title": "NHS: Asthma", "url": "https://www.nhs.uk/conditions/asthma/" },
      { "title": "MedlinePlus: Asthma", "url": "https://medlineplus.gov/asthma.html" }
    ],
    "language": "en"
  }
  $plan$::jsonb,
  null, null
)
on conflict (id) do nothing;

insert into public.care_plans (id, patient_id, condition_id, status, language, plan_json, reviewed_by, reviewed_at)
values
(
  'c9000001-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000201', 'cd000001-0000-0000-0000-000000000001', 'approved', 'en',
  $plan$
  {
    "condition": "Coronary artery disease",
    "summary": "Coronary artery disease means the arteries that feed the heart have narrowed. Taking your medicines every day, eating well, staying active and keeping blood pressure and cholesterol in check lowers the chance of problems.",
    "do": [
      "Take every heart medicine at the time shown in the app, including the one that protects your stent.",
      "Walk or do other gentle activity most days, as your doctor allows.",
      "Check your blood pressure and pulse regularly and note the readings.",
      "Keep your follow-up visits and cholesterol tests."
    ],
    "dont": [
      "Do not stop a heart medicine on your own, even when you feel well.",
      "Do not smoke, and avoid other people's smoke."
    ],
    "diet": {
      "eat_more": ["Vegetables and fruit", "Whole grains such as oats and whole wheat roti", "Dal, beans, nuts and fish"],
      "limit": ["Salt", "Fried and fatty foods", "Sweets and sugary drinks"],
      "sample_day": [
        { "meal": "breakfast", "items": ["Vegetable daliya", "Low-fat milk"] },
        { "meal": "lunch", "items": ["2 rotis", "Lauki sabzi", "Dal", "Salad"] },
        { "meal": "snack", "items": ["A handful of almonds", "A guava"] },
        { "meal": "dinner", "items": ["Vegetable soup", "1 roti", "Paneer bhurji"] }
      ]
    },
    "red_flags": [
      "Chest pain, pressure or tightness, especially with sweating, breathlessness or pain spreading to the arm or jaw: call 108 now.",
      "Fainting, or a very fast or irregular heartbeat that does not settle: call 108.",
      "Unusual bleeding or black stools while on blood-thinning medicines: contact your doctor the same day."
    ],
    "follow_up_tests": [
      { "test": "Lipid profile", "every_days": 120 },
      { "test": "ECG", "every_days": 180 }
    ],
    "sources": [
      { "title": "NHS: Coronary heart disease", "url": "https://www.nhs.uk/conditions/coronary-heart-disease/" },
      { "title": "MedlinePlus: Coronary artery disease", "url": "https://medlineplus.gov/coronaryarterydisease.html" }
    ],
    "language": "en"
  }
  $plan$::jsonb,
  '00000000-0000-0000-0000-000000000002', now() - interval '21 days'
),
(
  'c9000004-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000204', 'cd000004-0000-0000-0000-000000000001', 'approved', 'en',
  $plan$
  {
    "condition": "Hypertension",
    "summary": "High blood pressure often has no symptoms but strains the heart, brain and kidneys over time. Medicines, less salt, regular activity and regular readings keep it under control.",
    "do": [
      "Take your blood pressure medicines every day at the times shown in the app.",
      "Measure your blood pressure at home as your doctor advised and note the readings.",
      "Cut down on salt: avoid adding extra salt, pickles and papad.",
      "Keep your follow-up visits and your kidney tests."
    ],
    "dont": [
      "Do not stop or skip the medicines because you feel fine.",
      "Do not take painkillers such as ibuprofen without asking your doctor, as they can affect blood pressure and the kidneys."
    ],
    "diet": {
      "eat_more": ["Fresh vegetables and fruit your doctor allows", "Whole grains", "Dal and curd in the amounts your doctor advised"],
      "limit": ["Salt and salty snacks", "Pickles, papad and processed food", "Tea and coffee in large amounts"],
      "sample_day": [
        { "meal": "breakfast", "items": ["Plain upma without added salt", "Tea"] },
        { "meal": "lunch", "items": ["2 rotis", "Moong dal", "Bottle gourd sabzi"] },
        { "meal": "dinner", "items": ["Khichdi with curd", "Cucumber salad"] }
      ]
    },
    "red_flags": [
      "A very severe headache with confusion, chest pain, trouble speaking or weakness on one side of the body: call 108 now.",
      "Blood pressure readings that stay very high even after taking your medicines: contact your doctor the same day.",
      "Swelling of the face or legs, or passing much less urine than usual: see a doctor soon."
    ],
    "follow_up_tests": [
      { "test": "Kidney function (creatinine, urea)", "every_days": 90 },
      { "test": "Haemoglobin", "every_days": 90 }
    ],
    "sources": [
      { "title": "NHS: High blood pressure (hypertension)", "url": "https://www.nhs.uk/conditions/high-blood-pressure-hypertension/" },
      { "title": "MedlinePlus: High blood pressure", "url": "https://medlineplus.gov/highbloodpressure.html" }
    ],
    "language": "en"
  }
  $plan$::jsonb,
  '00000000-0000-0000-0000-000000000002', now() - interval '12 days'
)
on conflict (id) do nothing;

-- The new demo patients accepted the current consent text, so the app does not ask them again.
insert into public.consents (user_id, version)
select id, '2026-10-23' from public.profiles
where id in ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000205')
on conflict (user_id, version) do nothing;


-- 15. Ten more demo PATIENTS with different diseases, three caregivers and a year of history for all sixteen patients.
-- Everything is fictional. The history (lab reports, vitals, dose logs) uses dates relative to the seed day, so it never looks stale.
--   Arjun Malhotra   type 2 diabetes + high blood pressure + cholesterol: HbA1c 9.4 -> 7.1 over a year, an approved care plan, a share link
--   Shabnam Khan     beta-thalassemia major: a transfusion every 3 weeks, rare blood group B negative, ferritin trend, caregiver (mother)
--   Ramesh Chandra   COPD: lung tests, a flare-up with a short steroid course (a medicine that has ended), oxygen readings
--   Priya Nair       PCOS + iron-deficiency anaemia + vitamin D deficiency: haemoglobin 8.9 -> 11.9, weight loss
--   Harpreet Singh   atrial fibrillation on warfarin: a monthly INR in range except one high reading; an ibuprofen prescription (interaction warning); a share link
--   Lakshmi Pillai   polypharmacy at 70: seven medicines, a bone density test, missed doses
--   Aarav Mehta      type 1 diabetes in a 9-year-old: insulin and a sugar reading several times a day, caregiver (mother)
--   Fatima Sheikh    gestational diabetes + anaemia at 30 weeks of pregnancy, blood group A negative
--   Deepak Yadav     pulmonary tuberculosis, month 3 of 6: a finished first phase and a current second phase, liver tests
--   Sanjay Kulkarni  epilepsy, lives in Pune, scanned prescription
-- The five earlier patients and Aryan get a year of history too. Passwords: the patient demo password (caregivers: the caregiver password).

insert into public.profiles (id, role, full_name, phone, dob, gender, blood_group, allergies, city, preferred_language, onboarded)
values
  ('00000000-0000-0000-0000-000000000206', 'patient', 'Arjun Malhotra', '+91 00000 00400', '1974-02-19', 'male', 'A+', '{}', 'Delhi', 'en', true),
  ('00000000-0000-0000-0000-000000000207', 'patient', 'Shabnam Khan', '+91 00000 00401', '2000-09-05', 'female', 'B-', '{}', 'Ghaziabad', 'hinglish', true),
  ('00000000-0000-0000-0000-000000000208', 'patient', 'Ramesh Chandra', '+91 00000 00402', '1958-12-03', 'male', 'O+', '{"Penicillin"}', 'Faridabad', 'hi', true),
  ('00000000-0000-0000-0000-000000000209', 'patient', 'Priya Nair', '+91 00000 00403', '1997-07-24', 'female', 'AB+', '{}', 'Delhi', 'en', true),
  ('00000000-0000-0000-0000-000000000210', 'patient', 'Harpreet Singh', '+91 00000 00404', '1968-10-11', 'male', 'B+', '{"Aspirin"}', 'Gurugram', 'hinglish', true),
  ('00000000-0000-0000-0000-000000000211', 'patient', 'Lakshmi Pillai', '+91 00000 00405', '1955-03-27', 'female', 'O+', '{"Sulfa drugs"}', 'Delhi', 'en', true),
  ('00000000-0000-0000-0000-000000000212', 'patient', 'Aarav Mehta', '+91 00000 00406', '2017-06-02', 'male', 'A+', '{}', 'Gurugram', 'en', true),
  ('00000000-0000-0000-0000-000000000213', 'patient', 'Fatima Sheikh', '+91 00000 00407', '1998-01-16', 'female', 'A-', '{}', 'Noida', 'hinglish', true),
  ('00000000-0000-0000-0000-000000000214', 'patient', 'Deepak Yadav', '+91 00000 00408', '1985-05-09', 'male', 'O+', '{}', 'Ghaziabad', 'hi', true),
  ('00000000-0000-0000-0000-000000000215', 'patient', 'Sanjay Kulkarni', '+91 00000 00409', '1990-08-30', 'male', 'B+', '{"Phenytoin"}', 'Pune', 'en', true),
  ('00000000-0000-0000-0000-000000000216', 'patient', 'Rajesh Prasad', '+91 00000 00410', null, null, null, '{}', null, 'en', true),
  ('00000000-0000-0000-0000-000000000217', 'patient', 'Rukhsana Khan', '+91 00000 00411', null, null, null, '{}', null, 'en', true),
  ('00000000-0000-0000-0000-000000000218', 'patient', 'Sunita Mehta', '+91 00000 00412', null, null, null, '{}', null, 'en', true)
on conflict (id) do update set
  full_name = excluded.full_name, role = excluded.role, dob = excluded.dob, gender = excluded.gender, blood_group = excluded.blood_group,
  allergies = excluded.allergies, city = excluded.city, preferred_language = excluded.preferred_language, onboarded = excluded.onboarded;

-- Aryan: the earlier demo had no date of birth, gender or city. Meera, Rohan and the others have them already.
update public.profiles set dob = '1978-04-12', gender = 'male', city = 'Delhi', preferred_language = 'hinglish'
  where id = '00000000-0000-0000-0000-000000000001';

insert into public.emergency_contacts (id, patient_id, name, phone, relation)
values
  ('e8110001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000206', 'Neelam Malhotra', '+91 00000 00413', 'Wife'),
  ('e8110002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000206', 'Rohit Malhotra', '+91 00000 00414', 'Brother'),
  ('e8120001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000207', 'Rukhsana Khan', '+91 00000 00415', 'Mother'),
  ('e8120002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000207', 'Imran Khan', '+91 00000 00416', 'Brother'),
  ('e8130001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000208', 'Sunil Chandra', '+91 00000 00417', 'Son'),
  ('e8130002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000208', 'Geeta Chandra', '+91 00000 00418', 'Wife'),
  ('e8140001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000209', 'Suresh Nair', '+91 00000 00419', 'Father'),
  ('e8140002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000209', 'Anjali Nair', '+91 00000 00420', 'Sister'),
  ('e8150001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000210', 'Jaspreet Kaur', '+91 00000 00421', 'Wife'),
  ('e8150002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000210', 'Gurmeet Singh', '+91 00000 00422', 'Son'),
  ('e8160001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000211', 'Mohan Pillai', '+91 00000 00423', 'Son'),
  ('e8160002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000211', 'Radha Pillai', '+91 00000 00424', 'Daughter-in-law'),
  ('e8170001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000212', 'Sunita Mehta', '+91 00000 00425', 'Mother'),
  ('e8170002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000212', 'Vivek Mehta', '+91 00000 00426', 'Father'),
  ('e8180001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000213', 'Zaid Sheikh', '+91 00000 00427', 'Husband'),
  ('e8180002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000213', 'Ayesha Sheikh', '+91 00000 00428', 'Mother-in-law'),
  ('e8190001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000214', 'Savita Yadav', '+91 00000 00429', 'Wife'),
  ('e8190002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000214', 'Ramesh Yadav', '+91 00000 00430', 'Brother'),
  ('e8200001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000215', 'Madhuri Kulkarni', '+91 00000 00431', 'Mother'),
  ('e8200002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000215', 'Nikhil Joshi', '+91 00000 00432', 'Friend')
on conflict (id) do nothing;

-- Conditions
insert into public.conditions (id, patient_id, name, diagnosed_on, notes, active, source)
values
  ('c1110001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000206', 'Type 2 Diabetes', current_date - 2900, 'Long-standing; HbA1c is coming down with treatment', true, 'doctor'),
  ('c1110002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000206', 'Hypertension', current_date - 2500, 'Blood pressure is easier to control since he lost weight', true, 'doctor'),
  ('c1110003-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000206', 'High cholesterol', current_date - 1800, 'Cholesterol is checked every 3 to 4 months', true, 'doctor'),
  ('c1120001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000207', 'Beta-thalassemia major', current_date - 6200, 'Needs a blood transfusion about every 3 weeks; takes iron-removal medicine daily', true, 'doctor'),
  ('c1130001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000208', 'COPD', current_date - 1500, 'Former smoker. One flare-up in the last 6 months treated with a short steroid course', true, 'doctor'),
  ('c1130002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000208', 'Hypertension', current_date - 3300, 'Tablet once a day', true, 'doctor'),
  ('c1140001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000209', 'PCOS', current_date - 1100, 'Irregular periods; weight loss and metformin are helping', true, 'doctor'),
  ('c1140002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000209', 'Iron-deficiency anaemia', current_date - 330, 'Haemoglobin is rising on iron tablets', true, 'doctor'),
  ('c1140003-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000209', 'Vitamin D deficiency', current_date - 330, null, true, 'doctor'),
  ('c1150001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000210', 'Atrial fibrillation', current_date - 900, 'On a blood thinner; INR is checked every month', true, 'doctor'),
  ('c1150002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000210', 'Hypertension', current_date - 2900, null, true, 'doctor'),
  ('c1160001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000211', 'Osteoarthritis of the knees', current_date - 2600, null, true, 'doctor'),
  ('c1160002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000211', 'Osteoporosis', current_date - 800, 'Weekly bone tablet; calcium and vitamin D every day', true, 'doctor'),
  ('c1160003-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000211', 'Hypothyroidism', current_date - 3600, null, true, 'doctor'),
  ('c1160004-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000211', 'Hypertension', current_date - 3900, null, true, 'doctor'),
  ('c1170001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000212', 'Type 1 Diabetes', current_date - 480, 'Diagnosed at age 7; his parents give the insulin and note the sugar readings', true, 'doctor'),
  ('c1180001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000213', 'Gestational diabetes', current_date - 55, 'Found at the 24-week check; diet and tablets; reviewed every 2 weeks', true, 'doctor'),
  ('c1180002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000213', 'Anaemia in pregnancy', current_date - 55, null, true, 'doctor'),
  ('c1190001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000214', 'Pulmonary tuberculosis', current_date - 78, '6-month course; month 3 now. Takes every dose under the DOTS reminder', true, 'doctor'),
  ('c1200001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000215', 'Epilepsy', current_date - 3400, 'Seizure-free for 14 months on one medicine; never skips a dose', true, 'doctor'),
  ('c1030009-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000202', 'Allergic rhinitis', current_date - 2600, 'Worse in the dust season (Oct and Nov)', true, 'doctor'),
  ('c1050009-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000204', 'Anaemia of kidney disease', current_date - 400, 'Haemoglobin is checked with every kidney test', true, 'doctor'),
  ('c1060009-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000205', 'Iron-deficiency anaemia', current_date - 700, 'Resolved after 4 months of iron tablets', true, 'doctor')
on conflict (id) do nothing;

-- Appointments: past visits and upcoming tokens (one token per patient per day)
insert into public.appointments (id, patient_id, doctor_id, hospital_id, department_id, appointment_date, token_no, scheduled_at, status, reason, doctor_notes)
values
  ('a8110001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000206', '00000000-0000-0000-0000-000000000003', '51000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000001', current_date - 150, 22, (date_trunc('day', now() at time zone 'Asia/Kolkata') - interval '150 days' + interval '10 hours') at time zone 'Asia/Kolkata', 'completed', 'Diabetes review', 'HbA1c 8.4: medicines adjusted. Review in 3 months.'),
  ('a8110002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000206', '00000000-0000-0000-0000-000000000003', '51000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000001', current_date - 60, 31, (date_trunc('day', now() at time zone 'Asia/Kolkata') - interval '60 days' + interval '10 hours') at time zone 'Asia/Kolkata', 'completed', 'Diabetes and blood pressure follow-up', 'HbA1c 7.6. Continue the same medicines.'),
  ('a8110003-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000206', null, '51000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000001', current_date + 8, 19, (date_trunc('day', now() at time zone 'Asia/Kolkata') + interval '8 days' + interval '10 hours') at time zone 'Asia/Kolkata', 'confirmed', '3-month diabetes review', null),
  ('a8120001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000207', '00000000-0000-0000-0000-000000000002', '51000000-0000-0000-0000-000000000005', '52000000-0000-0000-0000-000000000401', current_date - 21, 12, (date_trunc('day', now() at time zone 'Asia/Kolkata') - interval '21 days' + interval '10 hours') at time zone 'Asia/Kolkata', 'completed', 'Day-care blood transfusion', 'Transfusion done. Next due in 3 weeks.'),
  ('a8120002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000207', null, '51000000-0000-0000-0000-000000000005', '52000000-0000-0000-0000-000000000401', current_date + 2, 8, (date_trunc('day', now() at time zone 'Asia/Kolkata') + interval '2 days' + interval '10 hours') at time zone 'Asia/Kolkata', 'confirmed', 'Day-care blood transfusion (needs B-negative blood)', null),
  ('a8130001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000208', '00000000-0000-0000-0000-000000000002', '51000000-0000-0000-0000-000000000004', '52000000-0000-0000-0000-000000000301', current_date - 95, 41, (date_trunc('day', now() at time zone 'Asia/Kolkata') - interval '95 days' + interval '10 hours') at time zone 'Asia/Kolkata', 'completed', 'Breathlessness and cough', 'Flare-up of COPD: short steroid course and a chest check.'),
  ('a8130002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000208', null, '51000000-0000-0000-0000-000000000004', '52000000-0000-0000-0000-000000000301', current_date + 5, 26, (date_trunc('day', now() at time zone 'Asia/Kolkata') + interval '5 days' + interval '10 hours') at time zone 'Asia/Kolkata', 'confirmed', 'COPD review with lung test', null),
  ('a8140001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000209', '00000000-0000-0000-0000-000000000002', '51000000-0000-0000-0000-000000000005', '52000000-0000-0000-0000-000000000405', current_date - 120, 14, (date_trunc('day', now() at time zone 'Asia/Kolkata') - interval '120 days' + interval '10 hours') at time zone 'Asia/Kolkata', 'completed', 'Irregular periods', 'PCOS: lifestyle changes and metformin; iron and vitamin D tablets for the tests.'),
  ('a8140002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000209', null, '51000000-0000-0000-0000-000000000002', '52000000-0000-0000-0000-000000000105', current_date + 9, 11, (date_trunc('day', now() at time zone 'Asia/Kolkata') + interval '9 days' + interval '10 hours') at time zone 'Asia/Kolkata', 'confirmed', 'PCOS and anaemia follow-up', null),
  ('a8150001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000210', '00000000-0000-0000-0000-000000000106', '51000000-0000-0000-0000-000000000003', '52000000-0000-0000-0000-000000000202', current_date - 70, 17, (date_trunc('day', now() at time zone 'Asia/Kolkata') - interval '70 days' + interval '10 hours') at time zone 'Asia/Kolkata', 'completed', 'Atrial fibrillation: INR check', 'INR in range. Continue the blood thinner.'),
  ('a8150002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000210', null, '51000000-0000-0000-0000-000000000003', '52000000-0000-0000-0000-000000000202', current_date + 3, 13, (date_trunc('day', now() at time zone 'Asia/Kolkata') + interval '3 days' + interval '10 hours') at time zone 'Asia/Kolkata', 'confirmed', 'Monthly INR and heart check', null),
  ('a8160001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000211', '00000000-0000-0000-0000-000000000002', '51000000-0000-0000-0000-000000000007', '52000000-0000-0000-0000-000000000601', current_date - 80, 33, (date_trunc('day', now() at time zone 'Asia/Kolkata') - interval '80 days' + interval '10 hours') at time zone 'Asia/Kolkata', 'completed', 'Knee pain and bone health', 'Osteoporosis tablet weekly; calcium and vitamin D daily.'),
  ('a8160002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000211', null, '51000000-0000-0000-0000-000000000007', '52000000-0000-0000-0000-000000000601', current_date + 6, 21, (date_trunc('day', now() at time zone 'Asia/Kolkata') + interval '6 days' + interval '10 hours') at time zone 'Asia/Kolkata', 'confirmed', 'Follow-up: bone and thyroid tests', null),
  ('a8170001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000212', '00000000-0000-0000-0000-000000000003', '51000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000004', current_date - 100, 9, (date_trunc('day', now() at time zone 'Asia/Kolkata') - interval '100 days' + interval '10 hours') at time zone 'Asia/Kolkata', 'completed', 'Type 1 diabetes review (child)', 'HbA1c improving. Parents shown how to count carbohydrates.'),
  ('a8170002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000212', null, '51000000-0000-0000-0000-000000000009', '52000000-0000-0000-0000-000000000804', current_date + 10, 16, (date_trunc('day', now() at time zone 'Asia/Kolkata') + interval '10 days' + interval '10 hours') at time zone 'Asia/Kolkata', 'confirmed', '3-month diabetes review (child)', null),
  ('a8180001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000213', '00000000-0000-0000-0000-000000000002', '51000000-0000-0000-0000-000000000002', '52000000-0000-0000-0000-000000000105', current_date - 20, 24, (date_trunc('day', now() at time zone 'Asia/Kolkata') - interval '20 days' + interval '10 hours') at time zone 'Asia/Kolkata', 'completed', 'Antenatal visit: gestational diabetes', 'Diet plan and tablets started. Review every 2 weeks.'),
  ('a8180002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000213', null, '51000000-0000-0000-0000-000000000002', '52000000-0000-0000-0000-000000000105', current_date + 4, 18, (date_trunc('day', now() at time zone 'Asia/Kolkata') + interval '4 days' + interval '10 hours') at time zone 'Asia/Kolkata', 'confirmed', 'Antenatal visit with growth scan', null),
  ('a8190001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000214', '00000000-0000-0000-0000-000000000002', '51000000-0000-0000-0000-000000000005', '52000000-0000-0000-0000-000000000401', current_date - 60, 7, (date_trunc('day', now() at time zone 'Asia/Kolkata') - interval '60 days' + interval '10 hours') at time zone 'Asia/Kolkata', 'completed', 'Tuberculosis: end of the first phase', 'Moving to the second phase of the course.'),
  ('a8190002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000214', null, '51000000-0000-0000-0000-000000000005', '52000000-0000-0000-0000-000000000401', current_date + 7, 15, (date_trunc('day', now() at time zone 'Asia/Kolkata') + interval '7 days' + interval '10 hours') at time zone 'Asia/Kolkata', 'confirmed', 'Tuberculosis: monthly review and liver test', null),
  ('a8020009-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000102', '51000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000002', current_date - 160, 27, (date_trunc('day', now() at time zone 'Asia/Kolkata') - interval '160 days' + interval '10 hours') at time zone 'Asia/Kolkata', 'completed', 'Cardiology follow-up', 'Cholesterol is coming down. Continue the same medicines.'),
  ('a8050009-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000002', '51000000-0000-0000-0000-000000000003', '52000000-0000-0000-0000-000000000201', current_date - 95, 13, (date_trunc('day', now() at time zone 'Asia/Kolkata') - interval '95 days' + interval '10 hours') at time zone 'Asia/Kolkata', 'completed', 'Kidney and blood pressure visit', 'Creatinine is slowly rising: recheck in 3 months.')
on conflict (id) do nothing;

-- Prescriptions
insert into public.prescriptions (id, patient_id, doctor_id, appointment_id, source, doctor_name, diagnosis, notes, issued_on)
values
  ('b3110001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000206', '00000000-0000-0000-0000-000000000003', 'a8110002-0000-0000-0000-000000000000', 'doctor', 'Dr. Sneha Gupta', null, 'Take the medicines every day. Walk 30 minutes a day. Come back in 3 months with an HbA1c and kidney tests.', current_date - 60),
  ('b3120001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000207', '00000000-0000-0000-0000-000000000002', 'a8120001-0000-0000-0000-000000000000', 'doctor', 'Dr. Rajesh Mehta', null, 'Take the iron-removal tablet every morning on an empty stomach. Blood transfusion every 3 weeks.', current_date - 21),
  ('b3130001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000208', '00000000-0000-0000-0000-000000000002', 'a8130001-0000-0000-0000-000000000000', 'doctor', 'Dr. Rajesh Mehta', null, 'Use the daily inhalers. The reliever only when needed. The steroid course is finished.', current_date - 95),
  ('b3140001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000209', '00000000-0000-0000-0000-000000000002', 'a8140001-0000-0000-0000-000000000000', 'doctor', 'Dr. Rajesh Mehta', null, 'Take the medicines after food. Repeat blood tests in 3 months.', current_date - 120),
  ('b3150001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000210', '00000000-0000-0000-0000-000000000106', 'a8150001-0000-0000-0000-000000000000', 'doctor', 'Dr. Lata Menon', null, 'Take the blood thinner every night at the same time. Monthly INR test. Avoid pain-killer tablets such as ibuprofen.', current_date - 70),
  ('b3150002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000210', null, null, 'upload', 'Dr. M. Arora', 'Knee pain', 'Scanned from a paper prescription from a clinic near home.', current_date - 12),
  ('b3160001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000211', '00000000-0000-0000-0000-000000000002', 'a8160001-0000-0000-0000-000000000000', 'doctor', 'Dr. Rajesh Mehta', null, 'Weekly bone tablet on the same day: empty stomach, a full glass of water, stay upright for 30 minutes.', current_date - 80),
  ('b3170001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000212', '00000000-0000-0000-0000-000000000003', 'a8170001-0000-0000-0000-000000000000', 'doctor', 'Dr. Sneha Gupta', null, 'Insulin as taught. Check the sugar before meals and at bedtime. Keep the emergency glucagon kit at home.', current_date - 100),
  ('b3180001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000213', '00000000-0000-0000-0000-000000000002', 'a8180001-0000-0000-0000-000000000000', 'doctor', 'Dr. Rajesh Mehta', null, 'Diet plan, tablets and folic acid. Check the fasting sugar every morning.', current_date - 20),
  ('b3190001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000214', '00000000-0000-0000-0000-000000000002', 'a8190001-0000-0000-0000-000000000000', 'doctor', 'Dr. Rajesh Mehta', null, 'Second phase of the 6-month course: two medicines every morning, plus vitamin B6. Never skip a dose.', current_date - 20),
  ('b3190002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000214', '00000000-0000-0000-0000-000000000002', null, 'doctor', 'Dr. Rajesh Mehta', null, 'First phase (2 months): four medicines every morning plus vitamin B6.', current_date - 78),
  ('b3200001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000215', null, null, 'upload', 'Dr. S. Joshi', 'Epilepsy', 'Scanned from a paper prescription from his neurologist in Pune.', current_date - 40),
  ('b3010009-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', null, 'doctor', 'Dr. Rajesh Mehta', null, 'Earlier prescription: one metformin tablet a day (for his Type 2 Diabetes). Replaced on 1 October.', current_date - 280),
  ('b3030009-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000002', null, 'doctor', 'Dr. Rajesh Mehta', null, 'Short prednisolone course for an asthma flare-up in the dust season.', current_date - 150),
  ('b3060009-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000205', '00000000-0000-0000-0000-000000000002', null, 'doctor', 'Dr. Rajesh Mehta', null, 'Iron tablets for 4 months for iron-deficiency anaemia. Finished.', current_date - 470)
on conflict (id) do nothing;

-- Link each doctor's diagnosis to the prescription it came from (the app shows the condition with its prescription).
-- The prescriptions above have no diagnosis yet: a trigger turns a doctor's diagnosis into a condition, so the link comes first.
update public.conditions set prescription_id = 'b3110001-0000-0000-0000-000000000000' where id = 'c1110001-0000-0000-0000-000000000000' and prescription_id is null;
update public.conditions set prescription_id = 'b3120001-0000-0000-0000-000000000000' where id = 'c1120001-0000-0000-0000-000000000000' and prescription_id is null;
update public.conditions set prescription_id = 'b3130001-0000-0000-0000-000000000000' where id = 'c1130001-0000-0000-0000-000000000000' and prescription_id is null;
update public.conditions set prescription_id = 'b3140001-0000-0000-0000-000000000000' where id = 'c1140001-0000-0000-0000-000000000000' and prescription_id is null;
update public.conditions set prescription_id = 'b3150001-0000-0000-0000-000000000000' where id = 'c1150001-0000-0000-0000-000000000000' and prescription_id is null;
update public.conditions set prescription_id = 'b3160001-0000-0000-0000-000000000000' where id = 'c1160002-0000-0000-0000-000000000000' and prescription_id is null;
update public.conditions set prescription_id = 'b3170001-0000-0000-0000-000000000000' where id = 'c1170001-0000-0000-0000-000000000000' and prescription_id is null;
update public.conditions set prescription_id = 'b3180001-0000-0000-0000-000000000000' where id = 'c1180001-0000-0000-0000-000000000000' and prescription_id is null;
update public.conditions set prescription_id = 'b3190001-0000-0000-0000-000000000000' where id = 'c1190001-0000-0000-0000-000000000000' and prescription_id is null;

-- Now the diagnoses: the trigger finds the linked condition and only renames it (it would otherwise add a second one);
-- the long-standing diagnosis dates are put back afterwards.
update public.prescriptions set diagnosis = 'Type 2 Diabetes' where id = 'b3110001-0000-0000-0000-000000000000' and diagnosis is distinct from 'Type 2 Diabetes';
update public.conditions set diagnosed_on = current_date - 2900, name = 'Type 2 Diabetes' where id = 'c1110001-0000-0000-0000-000000000000';
update public.prescriptions set diagnosis = 'Beta-thalassemia major' where id = 'b3120001-0000-0000-0000-000000000000' and diagnosis is distinct from 'Beta-thalassemia major';
update public.conditions set diagnosed_on = current_date - 6200, name = 'Beta-thalassemia major' where id = 'c1120001-0000-0000-0000-000000000000';
update public.prescriptions set diagnosis = 'COPD' where id = 'b3130001-0000-0000-0000-000000000000' and diagnosis is distinct from 'COPD';
update public.conditions set diagnosed_on = current_date - 1500, name = 'COPD' where id = 'c1130001-0000-0000-0000-000000000000';
update public.prescriptions set diagnosis = 'PCOS' where id = 'b3140001-0000-0000-0000-000000000000' and diagnosis is distinct from 'PCOS';
update public.conditions set diagnosed_on = current_date - 1100, name = 'PCOS' where id = 'c1140001-0000-0000-0000-000000000000';
update public.prescriptions set diagnosis = 'Atrial fibrillation' where id = 'b3150001-0000-0000-0000-000000000000' and diagnosis is distinct from 'Atrial fibrillation';
update public.conditions set diagnosed_on = current_date - 900, name = 'Atrial fibrillation' where id = 'c1150001-0000-0000-0000-000000000000';
update public.prescriptions set diagnosis = 'Osteoporosis' where id = 'b3160001-0000-0000-0000-000000000000' and diagnosis is distinct from 'Osteoporosis';
update public.conditions set diagnosed_on = current_date - 800, name = 'Osteoporosis' where id = 'c1160002-0000-0000-0000-000000000000';
update public.prescriptions set diagnosis = 'Type 1 Diabetes' where id = 'b3170001-0000-0000-0000-000000000000' and diagnosis is distinct from 'Type 1 Diabetes';
update public.conditions set diagnosed_on = current_date - 480, name = 'Type 1 Diabetes' where id = 'c1170001-0000-0000-0000-000000000000';
update public.prescriptions set diagnosis = 'Gestational diabetes' where id = 'b3180001-0000-0000-0000-000000000000' and diagnosis is distinct from 'Gestational diabetes';
update public.conditions set diagnosed_on = current_date - 55, name = 'Gestational diabetes' where id = 'c1180001-0000-0000-0000-000000000000';
update public.prescriptions set diagnosis = 'Pulmonary tuberculosis' where id = 'b3190001-0000-0000-0000-000000000000' and diagnosis is distinct from 'Pulmonary tuberculosis';
update public.conditions set diagnosed_on = current_date - 78, name = 'Pulmonary tuberculosis' where id = 'c1190001-0000-0000-0000-000000000000';

-- Medicines (a medicine with an end date is a finished course and shows as such in the history)
insert into public.prescription_items (id, prescription_id, patient_id, medicine_name, strength, form, dose, frequency, times, with_food, duration_days, start_date, end_date, instructions, active, quantity_total)
values
  ('b4110001-0000-0000-0000-000000000000', 'b3110001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000206', 'Metformin', '1000 mg', 'tablet', '1 tablet', 'BD', '{"08:30","20:30"}', 'after', 90, current_date - 60, null, null, true, 60),
  ('b4110002-0000-0000-0000-000000000000', 'b3110001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000206', 'Glimepiride', '2 mg', 'tablet', '1 tablet', 'OD', '{"08:00"}', 'before', 90, current_date - 60, null, 'Before breakfast', true, 30),
  ('b4110003-0000-0000-0000-000000000000', 'b3110001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000206', 'Sitagliptin', '100 mg', 'tablet', '1 tablet', 'OD', '{"09:00"}', 'after', 90, current_date - 60, null, null, true, 30),
  ('b4110004-0000-0000-0000-000000000000', 'b3110001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000206', 'Telmisartan', '40 mg', 'tablet', '1 tablet', 'OD', '{"09:00"}', 'after', 90, current_date - 60, null, null, true, 30),
  ('b4110005-0000-0000-0000-000000000000', 'b3110001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000206', 'Atorvastatin', '20 mg', 'tablet', '1 tablet', 'HS', '{"21:30"}', 'after', 90, current_date - 60, null, null, true, 30),
  ('b4120001-0000-0000-0000-000000000000', 'b3120001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000207', 'Deferasirox', '500 mg', 'tablet', '1 tablet', 'OD', '{"07:00"}', 'before', 90, current_date - 400, null, 'Dissolve in water, on an empty stomach', true, 30),
  ('b4120002-0000-0000-0000-000000000000', 'b3120001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000207', 'Folic Acid', '5 mg', 'tablet', '1 tablet', 'OD', '{"13:00"}', 'after', 90, current_date - 400, null, null, true, 30),
  ('b4120003-0000-0000-0000-000000000000', 'b3120001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000207', 'Vitamin D3', '60000 IU', 'tablet', '1 tablet', 'custom', '{"12:00"}', 'after', 56, current_date - 120, null, 'Once a week, on Sundays', true, 8),
  ('b4130001-0000-0000-0000-000000000000', 'b3130001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000208', 'Tiotropium', '18 mcg', 'inhaler', '1 capsule inhaled', 'OD', '{"08:00"}', 'any', 90, current_date - 95, null, 'Inhale with the device', true, 30),
  ('b4130002-0000-0000-0000-000000000000', 'b3130001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000208', 'Budesonide + Formoterol', '400/12 mcg', 'inhaler', '1 puff', 'BD', '{"08:30","20:30"}', 'any', 90, current_date - 95, null, 'Rinse the mouth after use', true, 120),
  ('b4130003-0000-0000-0000-000000000000', 'b3130001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000208', 'Salbutamol', '100 mcg', 'inhaler', '2 puffs', 'SOS', '{}', 'any', 90, current_date - 95, null, 'Only when short of breath or wheezing', true, 200),
  ('b4130004-0000-0000-0000-000000000000', 'b3130001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000208', 'Amlodipine', '5 mg', 'tablet', '1 tablet', 'OD', '{"09:00"}', 'after', 90, current_date - 95, null, null, true, 30),
  ('b4130005-0000-0000-0000-000000000000', 'b3130001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000208', 'Prednisolone', '30 mg', 'tablet', '1 tablet', 'OD', '{"08:00"}', 'after', 5, current_date - 95, current_date - 90, 'Short course for the flare-up. Finished.', false, 5),
  ('b4140001-0000-0000-0000-000000000000', 'b3140001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000209', 'Metformin', '500 mg', 'tablet', '1 tablet', 'BD', '{"09:00","21:00"}', 'after', 90, current_date - 120, null, null, true, 60),
  ('b4140002-0000-0000-0000-000000000000', 'b3140001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000209', 'Ferrous Ascorbate', '100 mg', 'tablet', '1 tablet', 'OD', '{"14:00"}', 'after', 90, current_date - 120, null, 'Not with tea or milk', true, 30),
  ('b4140003-0000-0000-0000-000000000000', 'b3140001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000209', 'Vitamin D3', '60000 IU', 'tablet', '1 tablet', 'custom', '{"12:00"}', 'after', 56, current_date - 120, current_date - 56, 'Once a week for 8 weeks. Finished.', false, 8),
  ('b4140004-0000-0000-0000-000000000000', 'b3140001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000209', 'Folic Acid', '5 mg', 'tablet', '1 tablet', 'OD', '{"13:00"}', 'after', 90, current_date - 120, null, null, true, 30),
  ('b4150001-0000-0000-0000-000000000000', 'b3150001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000210', 'Warfarin', '5 mg', 'tablet', '1 tablet', 'HS', '{"21:00"}', 'any', 90, current_date - 70, null, 'At the same time every night', true, 30),
  ('b4150002-0000-0000-0000-000000000000', 'b3150001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000210', 'Metoprolol Succinate', '50 mg', 'tablet', '1 tablet', 'BD', '{"08:00","20:00"}', 'after', 90, current_date - 70, null, null, true, 60),
  ('b4150003-0000-0000-0000-000000000000', 'b3150001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000210', 'Telmisartan', '40 mg', 'tablet', '1 tablet', 'OD', '{"09:00"}', 'after', 90, current_date - 70, null, null, true, 30),
  ('b4150004-0000-0000-0000-000000000000', 'b3150002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000210', 'Ibuprofen', '400 mg', 'tablet', '1 tablet', 'SOS', '{}', 'after', 5, current_date - 12, null, 'Only for knee pain (bought on a clinic prescription)', true, 10),
  ('b4160001-0000-0000-0000-000000000000', 'b3160001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000211', 'Alendronate', '70 mg', 'tablet', '1 tablet', 'custom', '{"07:00"}', 'before', 90, current_date - 80, null, 'Once a week, on Mondays, empty stomach, full glass of water', true, 12),
  ('b4160002-0000-0000-0000-000000000000', 'b3160001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000211', 'Calcium + Vitamin D3', '500 mg/250 IU', 'tablet', '1 tablet', 'BD', '{"13:00","21:00"}', 'after', 90, current_date - 80, null, 'Not on the same time as the weekly tablet', true, 60),
  ('b4160003-0000-0000-0000-000000000000', 'b3160001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000211', 'Levothyroxine', '50 mcg', 'tablet', '1 tablet', 'OD', '{"06:30"}', 'before', 90, current_date - 80, null, 'Empty stomach', true, 30),
  ('b4160004-0000-0000-0000-000000000000', 'b3160001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000211', 'Amlodipine', '5 mg', 'tablet', '1 tablet', 'OD', '{"09:00"}', 'after', 90, current_date - 80, null, null, true, 30),
  ('b4160005-0000-0000-0000-000000000000', 'b3160001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000211', 'Pantoprazole', '40 mg', 'tablet', '1 tablet', 'OD', '{"08:00"}', 'before', 90, current_date - 80, null, 'Before breakfast', true, 30),
  ('b4160006-0000-0000-0000-000000000000', 'b3160001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000211', 'Atorvastatin', '10 mg', 'tablet', '1 tablet', 'HS', '{"21:00"}', 'after', 90, current_date - 80, null, null, true, 30),
  ('b4160007-0000-0000-0000-000000000000', 'b3160001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000211', 'Paracetamol', '650 mg', 'tablet', '1 tablet', 'SOS', '{}', 'after', 90, current_date - 80, null, 'Only for knee pain', true, 20),
  ('b4170001-0000-0000-0000-000000000000', 'b3170001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000212', 'Insulin Glargine', '100 units/mL', 'injection', 'As taught (long-acting)', 'HS', '{"21:00"}', 'any', 90, current_date - 100, null, 'Given by a parent', true, 1),
  ('b4170002-0000-0000-0000-000000000000', 'b3170001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000212', 'Insulin Lispro', '100 units/mL', 'injection', 'As taught (mealtime)', 'TDS', '{"08:00","13:00","20:00"}', 'before', 90, current_date - 100, null, 'Just before meals, given by a parent', true, 1),
  ('b4170003-0000-0000-0000-000000000000', 'b3170001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000212', 'Glucagon Emergency Kit', '1 mg', 'injection', '1 injection', 'SOS', '{}', 'any', 90, current_date - 100, null, 'Only for a very low sugar when he cannot swallow: then call 108', true, 1),
  ('b4180001-0000-0000-0000-000000000000', 'b3180001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000213', 'Metformin', '500 mg', 'tablet', '1 tablet', 'BD', '{"09:00","21:00"}', 'after', 60, current_date - 20, null, null, true, 60),
  ('b4180002-0000-0000-0000-000000000000', 'b3180001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000213', 'Folic Acid', '5 mg', 'tablet', '1 tablet', 'OD', '{"13:00"}', 'after', 60, current_date - 55, null, null, true, 30),
  ('b4180003-0000-0000-0000-000000000000', 'b3180001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000213', 'Ferrous Fumarate', '200 mg', 'tablet', '1 tablet', 'OD', '{"14:00"}', 'after', 60, current_date - 55, null, 'Not with tea or milk', true, 30),
  ('b4180004-0000-0000-0000-000000000000', 'b3180001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000213', 'Calcium', '500 mg', 'tablet', '1 tablet', 'OD', '{"17:00"}', 'after', 60, current_date - 55, null, null, true, 30),
  ('b4190001-0000-0000-0000-000000000000', 'b3190002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000214', 'Isoniazid + Rifampicin + Pyrazinamide + Ethambutol', 'fixed-dose', 'tablet', 'weight-band dose', 'OD', '{"07:30"}', 'before', 56, current_date - 78, current_date - 22, 'First phase: finished', false, 56),
  ('b4190002-0000-0000-0000-000000000000', 'b3190001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000214', 'Isoniazid + Rifampicin', 'fixed-dose', 'tablet', 'weight-band dose', 'OD', '{"07:30"}', 'before', 112, current_date - 21, null, 'Second phase', true, 56),
  ('b4190003-0000-0000-0000-000000000000', 'b3190002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000214', 'Pyridoxine (Vitamin B6)', '40 mg', 'tablet', '1 tablet', 'OD', '{"07:30"}', 'after', 168, current_date - 78, null, 'Protects the nerves', true, 60),
  ('b4200001-0000-0000-0000-000000000000', 'b3200001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000215', 'Levetiracetam', '500 mg', 'tablet', '1 tablet', 'BD', '{"08:00","20:00"}', 'any', 90, current_date - 40, null, 'Never skip a dose', true, 60),
  ('b4200002-0000-0000-0000-000000000000', 'b3200001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000215', 'Folic Acid', '5 mg', 'tablet', '1 tablet', 'OD', '{"13:00"}', 'after', 90, current_date - 40, null, null, true, 30),
  ('b4010091-0000-0000-0000-000000000000', 'b3010009-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001', 'Metformin', '500 mg', 'tablet', '1 tablet', 'OD', '{"09:00"}', 'after', 180, current_date - 280, current_date - 21, 'Replaced on 1 October by two a day', false, 30),
  ('b4030091-0000-0000-0000-000000000000', 'b3030009-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000202', 'Prednisolone', '20 mg', 'tablet', '1 tablet', 'OD', '{"08:00"}', 'after', 5, current_date - 150, current_date - 145, 'Short course. Finished.', false, 5),
  ('b4060091-0000-0000-0000-000000000000', 'b3060009-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000205', 'Ferrous Ascorbate', '100 mg', 'tablet', '1 tablet', 'OD', '{"14:00"}', 'after', 120, current_date - 470, current_date - 350, 'Course finished', false, 120)
on conflict (id) do nothing;

-- Lab reports and values (the file paths are placeholders: no real files)
insert into public.lab_reports (id, patient_id, file_path, lab_name, report_date, status, summary)
values
  ('f3010021-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001/report-21.pdf', 'Sample Diagnostics', current_date - 365, 'done', 'HbA1c 9.0%, well above the reference range. Fasting sugar high.'),
  ('f3010022-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001/report-22.pdf', 'Sample Diagnostics', current_date - 300, 'done', 'HbA1c 8.7%. Cholesterol is above the reference range.'),
  ('f3010023-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001/report-23.pdf', 'Sample Diagnostics', current_date - 120, 'done', 'LDL cholesterol is lower than before but still above the reference range. Kidney tests are within range.'),
  ('f3010024-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001/report-24.pdf', 'Sample Diagnostics', current_date - 14, 'done', 'LDL cholesterol is within the reference range. Vitamin B12 is near the lower limit.'),
  ('f3020021-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000201/report-21.pdf', 'Sample Diagnostics', current_date - 420, 'done', 'LDL cholesterol 168 mg/dL, well above the reference range.'),
  ('f3020022-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000201/report-22.pdf', 'Sample Diagnostics', current_date - 330, 'done', 'LDL cholesterol 152 mg/dL, above the reference range.'),
  ('f3020023-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000201/report-23.pdf', 'Sample Diagnostics', current_date - 60, 'done', 'HbA1c and creatinine are within the reference range.'),
  ('f3030021-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000202/report-21.pdf', 'Sample Diagnostics', current_date - 400, 'done', 'Eosinophils and total IgE are above the reference range.'),
  ('f3030022-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000202/report-22.pdf', 'Sample Diagnostics', current_date - 210, 'done', 'Eosinophils are above the reference range.'),
  ('f3030023-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000202/report-23.pdf', 'Sample Diagnostics', current_date - 100, 'done', 'A flare-up: white cells and eosinophils are above the reference range.'),
  ('f3040021-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000203/report-21.pdf', 'Sample Diagnostics', current_date - 460, 'done', 'TSH 12.4 mIU/L, far above the reference range. Free T4 is below it.'),
  ('f3040022-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000203/report-22.pdf', 'Sample Diagnostics', current_date - 365, 'done', 'TSH 9.6 mIU/L, still above the reference range.'),
  ('f3040023-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000203/report-23.pdf', 'Sample Diagnostics', current_date - 90, 'done', 'TSH 4.4 mIU/L, close to the reference range. Vitamin D is below it.'),
  ('f3050021-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000204/report-21.pdf', 'Sample Diagnostics', current_date - 430, 'done', 'Creatinine 1.3 mg/dL, above the reference range.'),
  ('f3050022-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000204/report-22.pdf', 'Sample Diagnostics', current_date - 210, 'done', 'Creatinine 1.7 mg/dL, higher than before.'),
  ('f3050023-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000204/report-23.pdf', 'Sample Diagnostics', current_date - 60, 'done', 'Creatinine 2.0 mg/dL. Haemoglobin is below the reference range.'),
  ('f3060021-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000205', '00000000-0000-0000-0000-000000000205/report-21.pdf', 'Sample Diagnostics', current_date - 480, 'done', 'Haemoglobin 9.1 g/dL and ferritin are below the reference range.'),
  ('f3060022-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000205', '00000000-0000-0000-0000-000000000205/report-22.pdf', 'Sample Diagnostics', current_date - 380, 'done', 'Haemoglobin 11.8 g/dL: improving on iron tablets.'),
  ('f3060023-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000205', '00000000-0000-0000-0000-000000000205/report-23.pdf', 'Sample Diagnostics', current_date - 300, 'done', 'Haemoglobin 13.0 g/dL and ferritin are within the reference range.'),
  ('f3110001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000206', '00000000-0000-0000-0000-000000000206/report-1.pdf', 'Sample Diagnostics', current_date - 360, 'done', 'HbA1c 9.4%, well above the reference range. Cholesterol and triglycerides are high.'),
  ('f3110002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000206', '00000000-0000-0000-0000-000000000206/report-2.pdf', 'Sample Diagnostics', current_date - 270, 'done', 'HbA1c 8.8%. Fasting sugar is high.'),
  ('f3110003-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000206', '00000000-0000-0000-0000-000000000206/report-3.pdf', 'Sample Diagnostics', current_date - 150, 'done', 'HbA1c 8.4%. Urine albumin is still above the reference range.'),
  ('f3110004-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000206', '00000000-0000-0000-0000-000000000206/report-4.pdf', 'Sample Diagnostics', current_date - 60, 'done', 'HbA1c 7.6%. Cholesterol is coming down.'),
  ('f3110005-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000206', '00000000-0000-0000-0000-000000000206/report-5.pdf', 'Sample Diagnostics', current_date - 12, 'done', 'HbA1c 7.1%, the lowest so far. Kidney tests are within the reference range.'),
  ('f3120001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000207', '00000000-0000-0000-0000-000000000207/report-1.pdf', 'Sample Diagnostics', current_date - 330, 'done', 'Haemoglobin 6.9 g/dL before the transfusion. Ferritin is very high.'),
  ('f3120002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000207', '00000000-0000-0000-0000-000000000207/report-2.pdf', 'Sample Diagnostics', current_date - 270, 'done', 'Haemoglobin 7.2 g/dL before the transfusion.'),
  ('f3120003-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000207', '00000000-0000-0000-0000-000000000207/report-3.pdf', 'Sample Diagnostics', current_date - 210, 'done', 'Haemoglobin 7.0 g/dL before the transfusion. Iron-removal medicine started.'),
  ('f3120004-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000207', '00000000-0000-0000-0000-000000000207/report-4.pdf', 'Sample Diagnostics', current_date - 150, 'done', 'Haemoglobin 7.4 g/dL before the transfusion. Ferritin is coming down.'),
  ('f3120005-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000207', '00000000-0000-0000-0000-000000000207/report-5.pdf', 'Sample Diagnostics', current_date - 90, 'done', 'Haemoglobin 7.3 g/dL before the transfusion.'),
  ('f3120006-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000207', '00000000-0000-0000-0000-000000000207/report-6.pdf', 'Sample Diagnostics', current_date - 42, 'done', 'Haemoglobin 7.1 g/dL before the transfusion.'),
  ('f3120007-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000207', '00000000-0000-0000-0000-000000000207/report-7.pdf', 'Sample Diagnostics', current_date - 21, 'done', 'Haemoglobin 7.2 g/dL before the transfusion; 10.1 g/dL after it.'),
  ('f3130001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000208', '00000000-0000-0000-0000-000000000208/report-1.pdf', 'Sample Diagnostics', current_date - 380, 'done', 'Lung function test: FEV1 is below the reference range.'),
  ('f3130002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000208', '00000000-0000-0000-0000-000000000208/report-2.pdf', 'Sample Diagnostics', current_date - 190, 'done', 'Lung function test: FEV1 slightly lower than a year ago.'),
  ('f3130003-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000208', '00000000-0000-0000-0000-000000000208/report-3.pdf', 'Sample Diagnostics', current_date - 98, 'done', 'A flare-up: white cells and C-reactive protein are above the reference range.'),
  ('f3130004-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000208', '00000000-0000-0000-0000-000000000208/report-4.pdf', 'Sample Diagnostics', current_date - 20, 'done', 'Lung function test: FEV1 is back near the earlier value. Blood counts are within range.'),
  ('f3140001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000209', '00000000-0000-0000-0000-000000000209/report-1.pdf', 'Sample Diagnostics', current_date - 330, 'done', 'Haemoglobin 8.9 g/dL, ferritin and vitamin D are far below the reference range.'),
  ('f3140002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000209', '00000000-0000-0000-0000-000000000209/report-2.pdf', 'Sample Diagnostics', current_date - 240, 'done', 'Haemoglobin 9.8 g/dL: improving.'),
  ('f3140003-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000209', '00000000-0000-0000-0000-000000000209/report-3.pdf', 'Sample Diagnostics', current_date - 120, 'done', 'Haemoglobin 10.9 g/dL.'),
  ('f3140004-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000209', '00000000-0000-0000-0000-000000000209/report-4.pdf', 'Sample Diagnostics', current_date - 18, 'done', 'Haemoglobin 11.9 g/dL, close to the reference range. Vitamin D is now within range.'),
  ('f3150001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000210', '00000000-0000-0000-0000-000000000210/report-1.pdf', 'Sample Diagnostics', current_date - 330, 'done', 'INR 2.4, within the target range for his blood thinner.'),
  ('f3150002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000210', '00000000-0000-0000-0000-000000000210/report-2.pdf', 'Sample Diagnostics', current_date - 300, 'done', 'INR 1.8, below the target range.'),
  ('f3150003-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000210', '00000000-0000-0000-0000-000000000210/report-3.pdf', 'Sample Diagnostics', current_date - 270, 'done', 'INR 2.2, within the target range.'),
  ('f3150004-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000210', '00000000-0000-0000-0000-000000000210/report-4.pdf', 'Sample Diagnostics', current_date - 240, 'done', 'INR 2.6, within the target range.'),
  ('f3150005-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000210', '00000000-0000-0000-0000-000000000210/report-5.pdf', 'Sample Diagnostics', current_date - 210, 'done', 'INR 3.4, above the target range.'),
  ('f3150006-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000210', '00000000-0000-0000-0000-000000000210/report-6.pdf', 'Sample Diagnostics', current_date - 180, 'done', 'INR 2.7, within the target range.'),
  ('f3150007-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000210', '00000000-0000-0000-0000-000000000210/report-7.pdf', 'Sample Diagnostics', current_date - 150, 'done', 'INR 2.3, within the target range.'),
  ('f3150008-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000210', '00000000-0000-0000-0000-000000000210/report-8.pdf', 'Sample Diagnostics', current_date - 120, 'done', 'INR 2.5, within the target range.'),
  ('f3150009-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000210', '00000000-0000-0000-0000-000000000210/report-9.pdf', 'Sample Diagnostics', current_date - 90, 'done', 'INR 2.1, within the target range.'),
  ('f3150010-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000210', '00000000-0000-0000-0000-000000000210/report-10.pdf', 'Sample Diagnostics', current_date - 60, 'done', 'INR 2.4, within the target range.'),
  ('f3150011-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000210', '00000000-0000-0000-0000-000000000210/report-11.pdf', 'Sample Diagnostics', current_date - 30, 'done', 'INR 2.6, within the target range.'),
  ('f3150012-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000210', '00000000-0000-0000-0000-000000000210/report-12.pdf', 'Sample Diagnostics', current_date - 4, 'done', 'INR 3.6, above the target range (he had taken ibuprofen the week before).'),
  ('f3160001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000211', '00000000-0000-0000-0000-000000000211/report-1.pdf', 'Sample Diagnostics', current_date - 300, 'done', 'Bone density T-score -2.6, below the reference range. Vitamin D is low.'),
  ('f3160002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000211', '00000000-0000-0000-0000-000000000211/report-2.pdf', 'Sample Diagnostics', current_date - 140, 'done', 'Thyroid and calcium are within the reference range. Vitamin D is improving.'),
  ('f3160003-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000211', '00000000-0000-0000-0000-000000000211/report-3.pdf', 'Sample Diagnostics', current_date - 25, 'done', 'Vitamin D is within the reference range. Haemoglobin is slightly low.'),
  ('f3170001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000212', '00000000-0000-0000-0000-000000000212/report-1.pdf', 'Sample Diagnostics', current_date - 330, 'done', 'HbA1c 9.2% at diagnosis follow-up.'),
  ('f3170002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000212', '00000000-0000-0000-0000-000000000212/report-2.pdf', 'Sample Diagnostics', current_date - 240, 'done', 'HbA1c 8.6%.'),
  ('f3170003-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000212', '00000000-0000-0000-0000-000000000212/report-3.pdf', 'Sample Diagnostics', current_date - 150, 'done', 'HbA1c 8.1%.'),
  ('f3170004-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000212', '00000000-0000-0000-0000-000000000212/report-4.pdf', 'Sample Diagnostics', current_date - 60, 'done', 'HbA1c 7.6%.'),
  ('f3180001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000213', '00000000-0000-0000-0000-000000000213/report-1.pdf', 'Sample Diagnostics', current_date - 55, 'done', 'Glucose tolerance test: fasting and 2-hour values are above the reference range. Haemoglobin is low.'),
  ('f3180002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000213', '00000000-0000-0000-0000-000000000213/report-2.pdf', 'Sample Diagnostics', current_date - 20, 'done', 'Haemoglobin is improving. Fasting sugar is nearer the reference range.'),
  ('f3190001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000214', '00000000-0000-0000-0000-000000000214/report-1.pdf', 'Sample Diagnostics', current_date - 78, 'done', 'Before treatment: haemoglobin and ESR are outside the reference range.'),
  ('f3190002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000214', '00000000-0000-0000-0000-000000000214/report-2.pdf', 'Sample Diagnostics', current_date - 50, 'done', 'Liver test (ALT) is slightly above the reference range: repeat in 2 weeks.'),
  ('f3190003-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000214', '00000000-0000-0000-0000-000000000214/report-3.pdf', 'Sample Diagnostics', current_date - 36, 'done', 'Liver test (ALT) is back within the reference range.'),
  ('f3190004-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000214', '00000000-0000-0000-0000-000000000214/report-4.pdf', 'Sample Diagnostics', current_date - 12, 'done', 'Haemoglobin and ESR are improving. Liver tests are within range.'),
  ('f3200001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000215', '00000000-0000-0000-0000-000000000215/report-1.pdf', 'Sample Diagnostics', current_date - 330, 'done', 'Blood count and liver tests are within the reference range.'),
  ('f3200002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000215', '00000000-0000-0000-0000-000000000215/report-2.pdf', 'Sample Diagnostics', current_date - 40, 'done', 'Vitamin D is below the reference range. Other tests are within range.')
on conflict (id) do nothing;

insert into public.lab_values (id, report_id, patient_id, test_name, value, unit, ref_low, ref_high, flag, measured_on)
values
  ('f4010211-0000-0000-0000-000000000000', 'f3010021-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001', 'HbA1c', 9, '%', 4, 5.6, 'high', current_date - 365),
  ('f4010212-0000-0000-0000-000000000000', 'f3010021-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001', 'Fasting Blood Sugar', 188, 'mg/dL', 70, 100, 'high', current_date - 365),
  ('f4010221-0000-0000-0000-000000000000', 'f3010022-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001', 'HbA1c', 8.7, '%', 4, 5.6, 'high', current_date - 300),
  ('f4010222-0000-0000-0000-000000000000', 'f3010022-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001', 'LDL Cholesterol', 148, 'mg/dL', 0, 100, 'high', current_date - 300),
  ('f4010223-0000-0000-0000-000000000000', 'f3010022-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001', 'Total Cholesterol', 224, 'mg/dL', 0, 200, 'high', current_date - 300),
  ('f4010224-0000-0000-0000-000000000000', 'f3010022-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001', 'Triglycerides', 210, 'mg/dL', 0, 150, 'high', current_date - 300),
  ('f4010231-0000-0000-0000-000000000000', 'f3010023-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001', 'LDL Cholesterol', 118, 'mg/dL', 0, 100, 'high', current_date - 120),
  ('f4010232-0000-0000-0000-000000000000', 'f3010023-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001', 'Total Cholesterol', 196, 'mg/dL', 0, 200, 'normal', current_date - 120),
  ('f4010233-0000-0000-0000-000000000000', 'f3010023-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001', 'Triglycerides', 164, 'mg/dL', 0, 150, 'high', current_date - 120),
  ('f4010234-0000-0000-0000-000000000000', 'f3010023-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001', 'Creatinine', 0.9, 'mg/dL', 0.7, 1.2, 'normal', current_date - 120),
  ('f4010235-0000-0000-0000-000000000000', 'f3010023-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001', 'Vitamin B12', 238, 'pg/mL', 200, 900, 'normal', current_date - 120),
  ('f4010241-0000-0000-0000-000000000000', 'f3010024-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001', 'LDL Cholesterol', 94, 'mg/dL', 0, 100, 'normal', current_date - 14),
  ('f4010242-0000-0000-0000-000000000000', 'f3010024-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001', 'Total Cholesterol', 172, 'mg/dL', 0, 200, 'normal', current_date - 14),
  ('f4010243-0000-0000-0000-000000000000', 'f3010024-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001', 'Triglycerides', 138, 'mg/dL', 0, 150, 'normal', current_date - 14),
  ('f4010244-0000-0000-0000-000000000000', 'f3010024-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001', 'Vitamin B12', 214, 'pg/mL', 200, 900, 'normal', current_date - 14),
  ('f4020211-0000-0000-0000-000000000000', 'f3020021-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000201', 'LDL Cholesterol', 168, 'mg/dL', 0, 100, 'high', current_date - 420),
  ('f4020212-0000-0000-0000-000000000000', 'f3020021-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000201', 'Total Cholesterol', 248, 'mg/dL', 0, 200, 'high', current_date - 420),
  ('f4020213-0000-0000-0000-000000000000', 'f3020021-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000201', 'Triglycerides', 190, 'mg/dL', 0, 150, 'high', current_date - 420),
  ('f4020221-0000-0000-0000-000000000000', 'f3020022-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000201', 'LDL Cholesterol', 152, 'mg/dL', 0, 100, 'high', current_date - 330),
  ('f4020222-0000-0000-0000-000000000000', 'f3020022-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000201', 'Total Cholesterol', 232, 'mg/dL', 0, 200, 'high', current_date - 330),
  ('f4020223-0000-0000-0000-000000000000', 'f3020022-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000201', 'Triglycerides', 176, 'mg/dL', 0, 150, 'high', current_date - 330),
  ('f4020231-0000-0000-0000-000000000000', 'f3020023-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000201', 'HbA1c', 5.4, '%', 4, 5.6, 'normal', current_date - 60),
  ('f4020232-0000-0000-0000-000000000000', 'f3020023-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000201', 'Creatinine', 0.8, 'mg/dL', 0.6, 1.1, 'normal', current_date - 60),
  ('f4030211-0000-0000-0000-000000000000', 'f3030021-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000202', 'Eosinophils', 0.74, '10^3/uL', 0, 0.5, 'high', current_date - 400),
  ('f4030212-0000-0000-0000-000000000000', 'f3030021-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000202', 'Total IgE', 410, 'IU/mL', 0, 100, 'high', current_date - 400),
  ('f4030221-0000-0000-0000-000000000000', 'f3030022-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000202', 'Eosinophils', 0.66, '10^3/uL', 0, 0.5, 'high', current_date - 210),
  ('f4030222-0000-0000-0000-000000000000', 'f3030022-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000202', 'Total IgE', 360, 'IU/mL', 0, 100, 'high', current_date - 210),
  ('f4030231-0000-0000-0000-000000000000', 'f3030023-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000202', 'White Blood Cells', 12.4, '10^3/uL', 4, 11, 'high', current_date - 100),
  ('f4030232-0000-0000-0000-000000000000', 'f3030023-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000202', 'Eosinophils', 0.88, '10^3/uL', 0, 0.5, 'high', current_date - 100),
  ('f4030233-0000-0000-0000-000000000000', 'f3030023-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000202', 'C-Reactive Protein', 14, 'mg/L', 0, 5, 'high', current_date - 100),
  ('f4040211-0000-0000-0000-000000000000', 'f3040021-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000203', 'TSH', 12.4, 'mIU/L', 0.4, 4, 'high', current_date - 460),
  ('f4040212-0000-0000-0000-000000000000', 'f3040021-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000203', 'Free T4', 0.6, 'ng/dL', 0.8, 1.8, 'low', current_date - 460),
  ('f4040221-0000-0000-0000-000000000000', 'f3040022-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000203', 'TSH', 9.6, 'mIU/L', 0.4, 4, 'high', current_date - 365),
  ('f4040222-0000-0000-0000-000000000000', 'f3040022-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000203', 'Free T4', 0.7, 'ng/dL', 0.8, 1.8, 'low', current_date - 365),
  ('f4040223-0000-0000-0000-000000000000', 'f3040022-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000203', 'Vitamin D (25-OH)', 14, 'ng/mL', 30, 100, 'low', current_date - 365),
  ('f4040231-0000-0000-0000-000000000000', 'f3040023-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000203', 'TSH', 4.4, 'mIU/L', 0.4, 4, 'high', current_date - 90),
  ('f4040232-0000-0000-0000-000000000000', 'f3040023-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000203', 'Vitamin D (25-OH)', 16, 'ng/mL', 30, 100, 'low', current_date - 90),
  ('f4050211-0000-0000-0000-000000000000', 'f3050021-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000204', 'Creatinine', 1.3, 'mg/dL', 0.7, 1.2, 'high', current_date - 430),
  ('f4050212-0000-0000-0000-000000000000', 'f3050021-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000204', 'Urea', 44, 'mg/dL', 17, 43, 'high', current_date - 430),
  ('f4050213-0000-0000-0000-000000000000', 'f3050021-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000204', 'Hemoglobin', 12.4, 'g/dL', 13, 17, 'low', current_date - 430),
  ('f4050214-0000-0000-0000-000000000000', 'f3050021-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000204', 'eGFR', 58, 'mL/min', 90, 130, 'low', current_date - 430),
  ('f4050221-0000-0000-0000-000000000000', 'f3050022-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000204', 'Creatinine', 1.7, 'mg/dL', 0.7, 1.2, 'high', current_date - 210),
  ('f4050222-0000-0000-0000-000000000000', 'f3050022-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000204', 'Urea', 52, 'mg/dL', 17, 43, 'high', current_date - 210),
  ('f4050223-0000-0000-0000-000000000000', 'f3050022-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000204', 'Hemoglobin', 11.9, 'g/dL', 13, 17, 'low', current_date - 210),
  ('f4050224-0000-0000-0000-000000000000', 'f3050022-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000204', 'eGFR', 44, 'mL/min', 90, 130, 'low', current_date - 210),
  ('f4050231-0000-0000-0000-000000000000', 'f3050023-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000204', 'Creatinine', 2, 'mg/dL', 0.7, 1.2, 'high', current_date - 60),
  ('f4050232-0000-0000-0000-000000000000', 'f3050023-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000204', 'Urea', 55, 'mg/dL', 17, 43, 'high', current_date - 60),
  ('f4050233-0000-0000-0000-000000000000', 'f3050023-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000204', 'Hemoglobin', 11.4, 'g/dL', 13, 17, 'low', current_date - 60),
  ('f4050234-0000-0000-0000-000000000000', 'f3050023-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000204', 'eGFR', 37, 'mL/min', 90, 130, 'low', current_date - 60),
  ('f4050235-0000-0000-0000-000000000000', 'f3050023-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000204', 'Potassium', 5.3, 'mmol/L', 3.5, 5.1, 'high', current_date - 60),
  ('f4060211-0000-0000-0000-000000000000', 'f3060021-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000205', 'Hemoglobin', 9.1, 'g/dL', 12, 15, 'low', current_date - 480),
  ('f4060212-0000-0000-0000-000000000000', 'f3060021-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000205', 'Ferritin', 7, 'ng/mL', 15, 150, 'low', current_date - 480),
  ('f4060221-0000-0000-0000-000000000000', 'f3060022-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000205', 'Hemoglobin', 11.8, 'g/dL', 12, 15, 'low', current_date - 380),
  ('f4060222-0000-0000-0000-000000000000', 'f3060022-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000205', 'Ferritin', 22, 'ng/mL', 15, 150, 'normal', current_date - 380),
  ('f4060231-0000-0000-0000-000000000000', 'f3060023-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000205', 'Hemoglobin', 13, 'g/dL', 12, 15, 'normal', current_date - 300),
  ('f4060232-0000-0000-0000-000000000000', 'f3060023-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000205', 'Ferritin', 48, 'ng/mL', 15, 150, 'normal', current_date - 300),
  ('f4110011-0000-0000-0000-000000000000', 'f3110001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000206', 'HbA1c', 9.4, '%', 4, 5.6, 'high', current_date - 360),
  ('f4110012-0000-0000-0000-000000000000', 'f3110001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000206', 'Fasting Blood Sugar', 198, 'mg/dL', 70, 100, 'high', current_date - 360),
  ('f4110013-0000-0000-0000-000000000000', 'f3110001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000206', 'LDL Cholesterol', 168, 'mg/dL', 0, 100, 'high', current_date - 360),
  ('f4110014-0000-0000-0000-000000000000', 'f3110001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000206', 'Triglycerides', 244, 'mg/dL', 0, 150, 'high', current_date - 360),
  ('f4110015-0000-0000-0000-000000000000', 'f3110001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000206', 'Creatinine', 1, 'mg/dL', 0.7, 1.2, 'normal', current_date - 360),
  ('f4110016-0000-0000-0000-000000000000', 'f3110001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000206', 'Urine Albumin/Creatinine', 42, 'mg/g', 0, 30, 'high', current_date - 360),
  ('f4110021-0000-0000-0000-000000000000', 'f3110002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000206', 'HbA1c', 8.8, '%', 4, 5.6, 'high', current_date - 270),
  ('f4110022-0000-0000-0000-000000000000', 'f3110002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000206', 'Fasting Blood Sugar', 172, 'mg/dL', 70, 100, 'high', current_date - 270),
  ('f4110023-0000-0000-0000-000000000000', 'f3110002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000206', 'LDL Cholesterol', 142, 'mg/dL', 0, 100, 'high', current_date - 270),
  ('f4110024-0000-0000-0000-000000000000', 'f3110002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000206', 'Triglycerides', 206, 'mg/dL', 0, 150, 'high', current_date - 270),
  ('f4110031-0000-0000-0000-000000000000', 'f3110003-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000206', 'HbA1c', 8.4, '%', 4, 5.6, 'high', current_date - 150),
  ('f4110032-0000-0000-0000-000000000000', 'f3110003-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000206', 'Fasting Blood Sugar', 154, 'mg/dL', 70, 100, 'high', current_date - 150),
  ('f4110033-0000-0000-0000-000000000000', 'f3110003-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000206', 'LDL Cholesterol', 118, 'mg/dL', 0, 100, 'high', current_date - 150),
  ('f4110034-0000-0000-0000-000000000000', 'f3110003-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000206', 'Creatinine', 1, 'mg/dL', 0.7, 1.2, 'normal', current_date - 150),
  ('f4110035-0000-0000-0000-000000000000', 'f3110003-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000206', 'Urine Albumin/Creatinine', 36, 'mg/g', 0, 30, 'high', current_date - 150),
  ('f4110041-0000-0000-0000-000000000000', 'f3110004-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000206', 'HbA1c', 7.6, '%', 4, 5.6, 'high', current_date - 60),
  ('f4110042-0000-0000-0000-000000000000', 'f3110004-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000206', 'Fasting Blood Sugar', 128, 'mg/dL', 70, 100, 'high', current_date - 60),
  ('f4110043-0000-0000-0000-000000000000', 'f3110004-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000206', 'LDL Cholesterol', 96, 'mg/dL', 0, 100, 'normal', current_date - 60),
  ('f4110044-0000-0000-0000-000000000000', 'f3110004-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000206', 'Triglycerides', 158, 'mg/dL', 0, 150, 'high', current_date - 60),
  ('f4110051-0000-0000-0000-000000000000', 'f3110005-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000206', 'HbA1c', 7.1, '%', 4, 5.6, 'high', current_date - 12),
  ('f4110052-0000-0000-0000-000000000000', 'f3110005-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000206', 'Fasting Blood Sugar', 112, 'mg/dL', 70, 100, 'high', current_date - 12),
  ('f4110053-0000-0000-0000-000000000000', 'f3110005-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000206', 'Creatinine', 1.1, 'mg/dL', 0.7, 1.2, 'normal', current_date - 12),
  ('f4110054-0000-0000-0000-000000000000', 'f3110005-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000206', 'Urine Albumin/Creatinine', 24, 'mg/g', 0, 30, 'normal', current_date - 12),
  ('f4120011-0000-0000-0000-000000000000', 'f3120001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000207', 'Hemoglobin', 6.9, 'g/dL', 12, 15, 'low', current_date - 330),
  ('f4120012-0000-0000-0000-000000000000', 'f3120001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000207', 'Ferritin', 3100, 'ng/mL', 15, 150, 'high', current_date - 330),
  ('f4120013-0000-0000-0000-000000000000', 'f3120001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000207', 'Total Bilirubin', 2.4, 'mg/dL', 0.2, 1.2, 'high', current_date - 330),
  ('f4120021-0000-0000-0000-000000000000', 'f3120002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000207', 'Hemoglobin', 7.2, 'g/dL', 12, 15, 'low', current_date - 270),
  ('f4120022-0000-0000-0000-000000000000', 'f3120002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000207', 'Ferritin', 2850, 'ng/mL', 15, 150, 'high', current_date - 270),
  ('f4120031-0000-0000-0000-000000000000', 'f3120003-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000207', 'Hemoglobin', 7, 'g/dL', 12, 15, 'low', current_date - 210),
  ('f4120032-0000-0000-0000-000000000000', 'f3120003-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000207', 'Ferritin', 2640, 'ng/mL', 15, 150, 'high', current_date - 210),
  ('f4120033-0000-0000-0000-000000000000', 'f3120003-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000207', 'SGPT (ALT)', 58, 'U/L', 7, 56, 'high', current_date - 210),
  ('f4120041-0000-0000-0000-000000000000', 'f3120004-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000207', 'Hemoglobin', 7.4, 'g/dL', 12, 15, 'low', current_date - 150),
  ('f4120042-0000-0000-0000-000000000000', 'f3120004-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000207', 'Ferritin', 2310, 'ng/mL', 15, 150, 'high', current_date - 150),
  ('f4120051-0000-0000-0000-000000000000', 'f3120005-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000207', 'Hemoglobin', 7.3, 'g/dL', 12, 15, 'low', current_date - 90),
  ('f4120052-0000-0000-0000-000000000000', 'f3120005-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000207', 'Ferritin', 2050, 'ng/mL', 15, 150, 'high', current_date - 90),
  ('f4120053-0000-0000-0000-000000000000', 'f3120005-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000207', 'SGPT (ALT)', 52, 'U/L', 7, 56, 'normal', current_date - 90),
  ('f4120061-0000-0000-0000-000000000000', 'f3120006-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000207', 'Hemoglobin', 7.1, 'g/dL', 12, 15, 'low', current_date - 42),
  ('f4120062-0000-0000-0000-000000000000', 'f3120006-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000207', 'Ferritin', 1900, 'ng/mL', 15, 150, 'high', current_date - 42),
  ('f4120063-0000-0000-0000-000000000000', 'f3120006-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000207', 'Total Bilirubin', 1.9, 'mg/dL', 0.2, 1.2, 'high', current_date - 42),
  ('f4120071-0000-0000-0000-000000000000', 'f3120007-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000207', 'Hemoglobin', 7.2, 'g/dL', 12, 15, 'low', current_date - 21),
  ('f4120072-0000-0000-0000-000000000000', 'f3120007-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000207', 'Ferritin', 1820, 'ng/mL', 15, 150, 'high', current_date - 21),
  ('f4130011-0000-0000-0000-000000000000', 'f3130001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000208', 'FEV1 (% predicted)', 58, '%', 80, 120, 'low', current_date - 380),
  ('f4130012-0000-0000-0000-000000000000', 'f3130001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000208', 'FEV1/FVC ratio', 0.62, 'ratio', 0.7, 1, 'low', current_date - 380),
  ('f4130021-0000-0000-0000-000000000000', 'f3130002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000208', 'FEV1 (% predicted)', 54, '%', 80, 120, 'low', current_date - 190),
  ('f4130022-0000-0000-0000-000000000000', 'f3130002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000208', 'FEV1/FVC ratio', 0.6, 'ratio', 0.7, 1, 'low', current_date - 190),
  ('f4130023-0000-0000-0000-000000000000', 'f3130002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000208', 'Hemoglobin', 15.2, 'g/dL', 13, 17, 'normal', current_date - 190),
  ('f4130031-0000-0000-0000-000000000000', 'f3130003-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000208', 'White Blood Cells', 13.8, '10^3/uL', 4, 11, 'high', current_date - 98),
  ('f4130032-0000-0000-0000-000000000000', 'f3130003-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000208', 'C-Reactive Protein', 26, 'mg/L', 0, 5, 'high', current_date - 98),
  ('f4130033-0000-0000-0000-000000000000', 'f3130003-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000208', 'Hemoglobin', 15, 'g/dL', 13, 17, 'normal', current_date - 98),
  ('f4130041-0000-0000-0000-000000000000', 'f3130004-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000208', 'FEV1 (% predicted)', 53, '%', 80, 120, 'low', current_date - 20),
  ('f4130042-0000-0000-0000-000000000000', 'f3130004-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000208', 'FEV1/FVC ratio', 0.59, 'ratio', 0.7, 1, 'low', current_date - 20),
  ('f4130043-0000-0000-0000-000000000000', 'f3130004-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000208', 'White Blood Cells', 8.2, '10^3/uL', 4, 11, 'normal', current_date - 20),
  ('f4130044-0000-0000-0000-000000000000', 'f3130004-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000208', 'C-Reactive Protein', 3, 'mg/L', 0, 5, 'normal', current_date - 20),
  ('f4140011-0000-0000-0000-000000000000', 'f3140001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000209', 'Hemoglobin', 8.9, 'g/dL', 12, 15, 'low', current_date - 330),
  ('f4140012-0000-0000-0000-000000000000', 'f3140001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000209', 'Ferritin', 6, 'ng/mL', 15, 150, 'low', current_date - 330),
  ('f4140013-0000-0000-0000-000000000000', 'f3140001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000209', 'Vitamin D (25-OH)', 11, 'ng/mL', 30, 100, 'low', current_date - 330),
  ('f4140014-0000-0000-0000-000000000000', 'f3140001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000209', 'TSH', 2.4, 'mIU/L', 0.4, 4, 'normal', current_date - 330),
  ('f4140021-0000-0000-0000-000000000000', 'f3140002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000209', 'Hemoglobin', 9.8, 'g/dL', 12, 15, 'low', current_date - 240),
  ('f4140022-0000-0000-0000-000000000000', 'f3140002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000209', 'Ferritin', 12, 'ng/mL', 15, 150, 'low', current_date - 240),
  ('f4140023-0000-0000-0000-000000000000', 'f3140002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000209', 'Vitamin D (25-OH)', 19, 'ng/mL', 30, 100, 'low', current_date - 240),
  ('f4140031-0000-0000-0000-000000000000', 'f3140003-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000209', 'Hemoglobin', 10.9, 'g/dL', 12, 15, 'low', current_date - 120),
  ('f4140032-0000-0000-0000-000000000000', 'f3140003-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000209', 'Ferritin', 24, 'ng/mL', 15, 150, 'normal', current_date - 120),
  ('f4140033-0000-0000-0000-000000000000', 'f3140003-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000209', 'Vitamin D (25-OH)', 28, 'ng/mL', 30, 100, 'low', current_date - 120),
  ('f4140034-0000-0000-0000-000000000000', 'f3140003-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000209', 'Fasting Blood Sugar', 96, 'mg/dL', 70, 100, 'normal', current_date - 120),
  ('f4140041-0000-0000-0000-000000000000', 'f3140004-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000209', 'Hemoglobin', 11.9, 'g/dL', 12, 15, 'low', current_date - 18),
  ('f4140042-0000-0000-0000-000000000000', 'f3140004-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000209', 'Ferritin', 38, 'ng/mL', 15, 150, 'normal', current_date - 18),
  ('f4140043-0000-0000-0000-000000000000', 'f3140004-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000209', 'Vitamin D (25-OH)', 36, 'ng/mL', 30, 100, 'normal', current_date - 18),
  ('f4150011-0000-0000-0000-000000000000', 'f3150001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000210', 'INR', 2.4, 'ratio', 2, 3, 'normal', current_date - 330),
  ('f4150012-0000-0000-0000-000000000000', 'f3150001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000210', 'Creatinine', 1, 'mg/dL', 0.7, 1.2, 'normal', current_date - 330),
  ('f4150021-0000-0000-0000-000000000000', 'f3150002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000210', 'INR', 1.8, 'ratio', 2, 3, 'low', current_date - 300),
  ('f4150031-0000-0000-0000-000000000000', 'f3150003-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000210', 'INR', 2.2, 'ratio', 2, 3, 'normal', current_date - 270),
  ('f4150041-0000-0000-0000-000000000000', 'f3150004-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000210', 'INR', 2.6, 'ratio', 2, 3, 'normal', current_date - 240),
  ('f4150051-0000-0000-0000-000000000000', 'f3150005-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000210', 'INR', 3.4, 'ratio', 2, 3, 'high', current_date - 210),
  ('f4150061-0000-0000-0000-000000000000', 'f3150006-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000210', 'INR', 2.7, 'ratio', 2, 3, 'normal', current_date - 180),
  ('f4150071-0000-0000-0000-000000000000', 'f3150007-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000210', 'INR', 2.3, 'ratio', 2, 3, 'normal', current_date - 150),
  ('f4150072-0000-0000-0000-000000000000', 'f3150007-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000210', 'Hemoglobin', 14.1, 'g/dL', 13, 17, 'normal', current_date - 150),
  ('f4150081-0000-0000-0000-000000000000', 'f3150008-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000210', 'INR', 2.5, 'ratio', 2, 3, 'normal', current_date - 120),
  ('f4150091-0000-0000-0000-000000000000', 'f3150009-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000210', 'INR', 2.1, 'ratio', 2, 3, 'normal', current_date - 90),
  ('f4150101-0000-0000-0000-000000000000', 'f3150010-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000210', 'INR', 2.4, 'ratio', 2, 3, 'normal', current_date - 60),
  ('f4150102-0000-0000-0000-000000000000', 'f3150010-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000210', 'Creatinine', 1.1, 'mg/dL', 0.7, 1.2, 'normal', current_date - 60),
  ('f4150111-0000-0000-0000-000000000000', 'f3150011-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000210', 'INR', 2.6, 'ratio', 2, 3, 'normal', current_date - 30),
  ('f4150121-0000-0000-0000-000000000000', 'f3150012-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000210', 'INR', 3.6, 'ratio', 2, 3, 'high', current_date - 4),
  ('f4160011-0000-0000-0000-000000000000', 'f3160001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000211', 'Bone density T-score', -2.6, 'SD', -1, 2, 'low', current_date - 300),
  ('f4160012-0000-0000-0000-000000000000', 'f3160001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000211', 'Vitamin D (25-OH)', 16, 'ng/mL', 30, 100, 'low', current_date - 300),
  ('f4160013-0000-0000-0000-000000000000', 'f3160001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000211', 'Calcium', 8.4, 'mg/dL', 8.6, 10.2, 'low', current_date - 300),
  ('f4160021-0000-0000-0000-000000000000', 'f3160002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000211', 'TSH', 3.2, 'mIU/L', 0.4, 4, 'normal', current_date - 140),
  ('f4160022-0000-0000-0000-000000000000', 'f3160002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000211', 'Calcium', 9.1, 'mg/dL', 8.6, 10.2, 'normal', current_date - 140),
  ('f4160023-0000-0000-0000-000000000000', 'f3160002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000211', 'Vitamin D (25-OH)', 24, 'ng/mL', 30, 100, 'low', current_date - 140),
  ('f4160031-0000-0000-0000-000000000000', 'f3160003-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000211', 'Vitamin D (25-OH)', 32, 'ng/mL', 30, 100, 'normal', current_date - 25),
  ('f4160032-0000-0000-0000-000000000000', 'f3160003-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000211', 'Calcium', 9.3, 'mg/dL', 8.6, 10.2, 'normal', current_date - 25),
  ('f4160033-0000-0000-0000-000000000000', 'f3160003-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000211', 'Hemoglobin', 11.8, 'g/dL', 12, 15, 'low', current_date - 25),
  ('f4160034-0000-0000-0000-000000000000', 'f3160003-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000211', 'Creatinine', 0.9, 'mg/dL', 0.6, 1.1, 'normal', current_date - 25),
  ('f4170011-0000-0000-0000-000000000000', 'f3170001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000212', 'HbA1c', 9.2, '%', 4, 5.6, 'high', current_date - 330),
  ('f4170012-0000-0000-0000-000000000000', 'f3170001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000212', 'TSH', 2.9, 'mIU/L', 0.4, 4, 'normal', current_date - 330),
  ('f4170021-0000-0000-0000-000000000000', 'f3170002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000212', 'HbA1c', 8.6, '%', 4, 5.6, 'high', current_date - 240),
  ('f4170031-0000-0000-0000-000000000000', 'f3170003-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000212', 'HbA1c', 8.1, '%', 4, 5.6, 'high', current_date - 150),
  ('f4170041-0000-0000-0000-000000000000', 'f3170004-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000212', 'HbA1c', 7.6, '%', 4, 5.6, 'high', current_date - 60),
  ('f4170042-0000-0000-0000-000000000000', 'f3170004-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000212', 'TSH', 3.1, 'mIU/L', 0.4, 4, 'normal', current_date - 60),
  ('f4180011-0000-0000-0000-000000000000', 'f3180001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000213', 'OGTT Fasting Glucose', 98, 'mg/dL', 70, 92, 'high', current_date - 55),
  ('f4180012-0000-0000-0000-000000000000', 'f3180001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000213', 'OGTT 2-hour Glucose', 168, 'mg/dL', 70, 153, 'high', current_date - 55),
  ('f4180013-0000-0000-0000-000000000000', 'f3180001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000213', 'HbA1c', 5.9, '%', 4, 5.6, 'high', current_date - 55),
  ('f4180014-0000-0000-0000-000000000000', 'f3180001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000213', 'Hemoglobin', 10.2, 'g/dL', 11, 14, 'low', current_date - 55),
  ('f4180015-0000-0000-0000-000000000000', 'f3180001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000213', 'Ferritin', 9, 'ng/mL', 15, 150, 'low', current_date - 55),
  ('f4180021-0000-0000-0000-000000000000', 'f3180002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000213', 'Hemoglobin', 10.8, 'g/dL', 11, 14, 'low', current_date - 20),
  ('f4180022-0000-0000-0000-000000000000', 'f3180002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000213', 'Fasting Blood Sugar', 94, 'mg/dL', 70, 100, 'normal', current_date - 20),
  ('f4180023-0000-0000-0000-000000000000', 'f3180002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000213', 'HbA1c', 5.6, '%', 4, 5.6, 'normal', current_date - 20),
  ('f4190011-0000-0000-0000-000000000000', 'f3190001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000214', 'Hemoglobin', 11.1, 'g/dL', 13, 17, 'low', current_date - 78),
  ('f4190012-0000-0000-0000-000000000000', 'f3190001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000214', 'ESR', 62, 'mm/hr', 0, 20, 'high', current_date - 78),
  ('f4190013-0000-0000-0000-000000000000', 'f3190001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000214', 'SGPT (ALT)', 34, 'U/L', 7, 56, 'normal', current_date - 78),
  ('f4190021-0000-0000-0000-000000000000', 'f3190002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000214', 'SGPT (ALT)', 68, 'U/L', 7, 56, 'high', current_date - 50),
  ('f4190022-0000-0000-0000-000000000000', 'f3190002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000214', 'Total Bilirubin', 1.1, 'mg/dL', 0.2, 1.2, 'normal', current_date - 50),
  ('f4190023-0000-0000-0000-000000000000', 'f3190002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000214', 'Hemoglobin', 11.6, 'g/dL', 13, 17, 'low', current_date - 50),
  ('f4190031-0000-0000-0000-000000000000', 'f3190003-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000214', 'SGPT (ALT)', 44, 'U/L', 7, 56, 'normal', current_date - 36),
  ('f4190032-0000-0000-0000-000000000000', 'f3190003-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000214', 'ESR', 48, 'mm/hr', 0, 20, 'high', current_date - 36),
  ('f4190041-0000-0000-0000-000000000000', 'f3190004-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000214', 'Hemoglobin', 12.6, 'g/dL', 13, 17, 'low', current_date - 12),
  ('f4190042-0000-0000-0000-000000000000', 'f3190004-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000214', 'ESR', 34, 'mm/hr', 0, 20, 'high', current_date - 12),
  ('f4190043-0000-0000-0000-000000000000', 'f3190004-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000214', 'SGPT (ALT)', 38, 'U/L', 7, 56, 'normal', current_date - 12),
  ('f4200011-0000-0000-0000-000000000000', 'f3200001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000215', 'Hemoglobin', 14.6, 'g/dL', 13, 17, 'normal', current_date - 330),
  ('f4200012-0000-0000-0000-000000000000', 'f3200001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000215', 'SGPT (ALT)', 28, 'U/L', 7, 56, 'normal', current_date - 330),
  ('f4200013-0000-0000-0000-000000000000', 'f3200001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000215', 'Calcium', 9.4, 'mg/dL', 8.6, 10.2, 'normal', current_date - 330),
  ('f4200021-0000-0000-0000-000000000000', 'f3200002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000215', 'Vitamin D (25-OH)', 22, 'ng/mL', 30, 100, 'low', current_date - 40),
  ('f4200022-0000-0000-0000-000000000000', 'f3200002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000215', 'Calcium', 9.2, 'mg/dL', 8.6, 10.2, 'normal', current_date - 40),
  ('f4200023-0000-0000-0000-000000000000', 'f3200002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000215', 'SGPT (ALT)', 31, 'U/L', 7, 56, 'normal', current_date - 40)
on conflict (id) do nothing;

-- Vitals: a year of readings. The old rows are removed first so that running this again does not double them
-- (the last 7 days of the earlier patients stay as they are: those series stop 8 days ago).
delete from public.vitals where patient_id in ('00000000-0000-0000-0000-000000000206', '00000000-0000-0000-0000-000000000207', '00000000-0000-0000-0000-000000000208', '00000000-0000-0000-0000-000000000209', '00000000-0000-0000-0000-000000000210', '00000000-0000-0000-0000-000000000211', '00000000-0000-0000-0000-000000000212', '00000000-0000-0000-0000-000000000213', '00000000-0000-0000-0000-000000000214', '00000000-0000-0000-0000-000000000215');
delete from public.vitals where patient_id in ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000205') and measured_at < now() - interval '8 days';
insert into public.vitals (patient_id, type, value, value2, unit, measured_at)
select '00000000-0000-0000-0000-000000000001', 'sugar_fasting', round((178 + (118 - 178) * (1 - (d - 8)::numeric / 352) + (((abs(hashtext('00000000-0000-0000-0000-000000000001|sugar_fasting|a|' || d)) % 1000) / 1000.0) - 0.5) * 18)::numeric, 0), null, 'mg/dL',
  ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '7 hours' + ((abs(hashtext('00000000-0000-0000-0000-000000000001|sugar_fasting|t|' || d)) % 45) || ' minutes')::interval) at time zone 'Asia/Kolkata'
from generate_series(8, 360, 4) as d
where (abs(hashtext('00000000-0000-0000-0000-000000000001|sugar_fasting|s|' || d)) % 100) >= 25
  and ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '7 hours') at time zone 'Asia/Kolkata' <= now();
insert into public.vitals (patient_id, type, value, value2, unit, measured_at)
select '00000000-0000-0000-0000-000000000001', 'weight', round((91 + (84 - 91) * (1 - (d - 8)::numeric / 352) + (((abs(hashtext('00000000-0000-0000-0000-000000000001|weight|a|' || d)) % 1000) / 1000.0) - 0.5) * 0.6)::numeric, 1), null, 'kg',
  ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '7 hours' + ((abs(hashtext('00000000-0000-0000-0000-000000000001|weight|t|' || d)) % 45) || ' minutes')::interval) at time zone 'Asia/Kolkata'
from generate_series(8, 360, 14) as d
where (abs(hashtext('00000000-0000-0000-0000-000000000001|weight|s|' || d)) % 100) >= 10
  and ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '7 hours') at time zone 'Asia/Kolkata' <= now();
insert into public.vitals (patient_id, type, value, value2, unit, measured_at)
select '00000000-0000-0000-0000-000000000001', 'bp', round((146 + (130 - 146) * (1 - (d - 8)::numeric / 232) + (((abs(hashtext('00000000-0000-0000-0000-000000000001|bp|a|' || d)) % 1000) / 1000.0) - 0.5) * 6)::numeric, 0), round((92 + (82 - 92) * (1 - (d - 8)::numeric / 232) + (((abs(hashtext('00000000-0000-0000-0000-000000000001|bp|b|' || d)) % 1000) / 1000.0) - 0.5) * 4)::numeric, 0), 'mmHg',
  ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '8 hours' + ((abs(hashtext('00000000-0000-0000-0000-000000000001|bp|t|' || d)) % 45) || ' minutes')::interval) at time zone 'Asia/Kolkata'
from generate_series(8, 240, 5) as d
where (abs(hashtext('00000000-0000-0000-0000-000000000001|bp|s|' || d)) % 100) >= 20
  and ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '8 hours') at time zone 'Asia/Kolkata' <= now();
insert into public.vitals (patient_id, type, value, value2, unit, measured_at)
select '00000000-0000-0000-0000-000000000201', 'bp', round((144 + (130 - 144) * (1 - (d - 8)::numeric / 352) + (((abs(hashtext('00000000-0000-0000-0000-000000000201|bp|a|' || d)) % 1000) / 1000.0) - 0.5) * 6)::numeric, 0), round((90 + (80 - 90) * (1 - (d - 8)::numeric / 352) + (((abs(hashtext('00000000-0000-0000-0000-000000000201|bp|b|' || d)) % 1000) / 1000.0) - 0.5) * 4)::numeric, 0), 'mmHg',
  ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '8 hours' + ((abs(hashtext('00000000-0000-0000-0000-000000000201|bp|t|' || d)) % 45) || ' minutes')::interval) at time zone 'Asia/Kolkata'
from generate_series(8, 360, 5) as d
where (abs(hashtext('00000000-0000-0000-0000-000000000201|bp|s|' || d)) % 100) >= 25
  and ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '8 hours') at time zone 'Asia/Kolkata' <= now();
insert into public.vitals (patient_id, type, value, value2, unit, measured_at)
select '00000000-0000-0000-0000-000000000201', 'heart_rate', round((74 + (66 - 74) * (1 - (d - 8)::numeric / 352) + (((abs(hashtext('00000000-0000-0000-0000-000000000201|heart_rate|a|' || d)) % 1000) / 1000.0) - 0.5) * 4)::numeric, 0), null, 'bpm',
  ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '8 hours' + ((abs(hashtext('00000000-0000-0000-0000-000000000201|heart_rate|t|' || d)) % 45) || ' minutes')::interval) at time zone 'Asia/Kolkata'
from generate_series(8, 360, 5) as d
where (abs(hashtext('00000000-0000-0000-0000-000000000201|heart_rate|s|' || d)) % 100) >= 25
  and ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '8 hours') at time zone 'Asia/Kolkata' <= now();
insert into public.vitals (patient_id, type, value, value2, unit, measured_at)
select '00000000-0000-0000-0000-000000000201', 'weight', round((66 + (61.5 - 66) * (1 - (d - 8)::numeric / 352) + (((abs(hashtext('00000000-0000-0000-0000-000000000201|weight|a|' || d)) % 1000) / 1000.0) - 0.5) * 0.5)::numeric, 1), null, 'kg',
  ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '7 hours' + ((abs(hashtext('00000000-0000-0000-0000-000000000201|weight|t|' || d)) % 45) || ' minutes')::interval) at time zone 'Asia/Kolkata'
from generate_series(8, 360, 14) as d
where (abs(hashtext('00000000-0000-0000-0000-000000000201|weight|s|' || d)) % 100) >= 10
  and ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '7 hours') at time zone 'Asia/Kolkata' <= now();
insert into public.vitals (patient_id, type, value, value2, unit, measured_at)
select '00000000-0000-0000-0000-000000000202', 'spo2', round((96 + (98 - 96) * (1 - (d - 8)::numeric / 192) + (((abs(hashtext('00000000-0000-0000-0000-000000000202|spo2|a|' || d)) % 1000) / 1000.0) - 0.5) * 1.2)::numeric, 0), null, '%',
  ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '8 hours' + ((abs(hashtext('00000000-0000-0000-0000-000000000202|spo2|t|' || d)) % 45) || ' minutes')::interval) at time zone 'Asia/Kolkata'
from generate_series(8, 200, 4) as d
where (abs(hashtext('00000000-0000-0000-0000-000000000202|spo2|s|' || d)) % 100) >= 20
  and ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '8 hours') at time zone 'Asia/Kolkata' <= now();
insert into public.vitals (patient_id, type, value, value2, unit, measured_at)
select '00000000-0000-0000-0000-000000000202', 'heart_rate', round((78 + (70 - 78) * (1 - (d - 8)::numeric / 192) + (((abs(hashtext('00000000-0000-0000-0000-000000000202|heart_rate|a|' || d)) % 1000) / 1000.0) - 0.5) * 5)::numeric, 0), null, 'bpm',
  ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '8 hours' + ((abs(hashtext('00000000-0000-0000-0000-000000000202|heart_rate|t|' || d)) % 45) || ' minutes')::interval) at time zone 'Asia/Kolkata'
from generate_series(8, 200, 6) as d
where (abs(hashtext('00000000-0000-0000-0000-000000000202|heart_rate|s|' || d)) % 100) >= 25
  and ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '8 hours') at time zone 'Asia/Kolkata' <= now();
insert into public.vitals (patient_id, type, value, value2, unit, measured_at)
select '00000000-0000-0000-0000-000000000202', 'weight', round((73 + (70.8 - 73) * (1 - (d - 8)::numeric / 352) + (((abs(hashtext('00000000-0000-0000-0000-000000000202|weight|a|' || d)) % 1000) / 1000.0) - 0.5) * 0.5)::numeric, 1), null, 'kg',
  ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '7 hours' + ((abs(hashtext('00000000-0000-0000-0000-000000000202|weight|t|' || d)) % 45) || ' minutes')::interval) at time zone 'Asia/Kolkata'
from generate_series(8, 360, 14) as d
where (abs(hashtext('00000000-0000-0000-0000-000000000202|weight|s|' || d)) % 100) >= 10
  and ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '7 hours') at time zone 'Asia/Kolkata' <= now();
insert into public.vitals (patient_id, type, value, value2, unit, measured_at)
select '00000000-0000-0000-0000-000000000203', 'weight', round((72 + (64.8 - 72) * (1 - (d - 8)::numeric / 352) + (((abs(hashtext('00000000-0000-0000-0000-000000000203|weight|a|' || d)) % 1000) / 1000.0) - 0.5) * 0.5)::numeric, 1), null, 'kg',
  ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '7 hours' + ((abs(hashtext('00000000-0000-0000-0000-000000000203|weight|t|' || d)) % 45) || ' minutes')::interval) at time zone 'Asia/Kolkata'
from generate_series(8, 360, 14) as d
where (abs(hashtext('00000000-0000-0000-0000-000000000203|weight|s|' || d)) % 100) >= 10
  and ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '7 hours') at time zone 'Asia/Kolkata' <= now();
insert into public.vitals (patient_id, type, value, value2, unit, measured_at)
select '00000000-0000-0000-0000-000000000203', 'heart_rate', round((62 + (74 - 62) * (1 - (d - 8)::numeric / 172) + (((abs(hashtext('00000000-0000-0000-0000-000000000203|heart_rate|a|' || d)) % 1000) / 1000.0) - 0.5) * 4)::numeric, 0), null, 'bpm',
  ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '8 hours' + ((abs(hashtext('00000000-0000-0000-0000-000000000203|heart_rate|t|' || d)) % 45) || ' minutes')::interval) at time zone 'Asia/Kolkata'
from generate_series(8, 180, 6) as d
where (abs(hashtext('00000000-0000-0000-0000-000000000203|heart_rate|s|' || d)) % 100) >= 25
  and ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '8 hours') at time zone 'Asia/Kolkata' <= now();
insert into public.vitals (patient_id, type, value, value2, unit, measured_at)
select '00000000-0000-0000-0000-000000000204', 'bp', round((138 + (150 - 138) * (1 - (d - 8)::numeric / 352) + (((abs(hashtext('00000000-0000-0000-0000-000000000204|bp|a|' || d)) % 1000) / 1000.0) - 0.5) * 7)::numeric, 0), round((84 + (92 - 84) * (1 - (d - 8)::numeric / 352) + (((abs(hashtext('00000000-0000-0000-0000-000000000204|bp|b|' || d)) % 1000) / 1000.0) - 0.5) * 4)::numeric, 0), 'mmHg',
  ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '8 hours' + ((abs(hashtext('00000000-0000-0000-0000-000000000204|bp|t|' || d)) % 45) || ' minutes')::interval) at time zone 'Asia/Kolkata'
from generate_series(8, 360, 4) as d
where (abs(hashtext('00000000-0000-0000-0000-000000000204|bp|s|' || d)) % 100) >= 20
  and ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '8 hours') at time zone 'Asia/Kolkata' <= now();
insert into public.vitals (patient_id, type, value, value2, unit, measured_at)
select '00000000-0000-0000-0000-000000000204', 'weight', round((70.5 + (68.4 - 70.5) * (1 - (d - 8)::numeric / 352) + (((abs(hashtext('00000000-0000-0000-0000-000000000204|weight|a|' || d)) % 1000) / 1000.0) - 0.5) * 0.5)::numeric, 1), null, 'kg',
  ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '7 hours' + ((abs(hashtext('00000000-0000-0000-0000-000000000204|weight|t|' || d)) % 45) || ' minutes')::interval) at time zone 'Asia/Kolkata'
from generate_series(8, 360, 14) as d
where (abs(hashtext('00000000-0000-0000-0000-000000000204|weight|s|' || d)) % 100) >= 10
  and ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '7 hours') at time zone 'Asia/Kolkata' <= now();
insert into public.vitals (patient_id, type, value, value2, unit, measured_at)
select '00000000-0000-0000-0000-000000000204', 'spo2', round((97 + (95 - 97) * (1 - (d - 8)::numeric / 192) + (((abs(hashtext('00000000-0000-0000-0000-000000000204|spo2|a|' || d)) % 1000) / 1000.0) - 0.5) * 1)::numeric, 0), null, '%',
  ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '8 hours' + ((abs(hashtext('00000000-0000-0000-0000-000000000204|spo2|t|' || d)) % 45) || ' minutes')::interval) at time zone 'Asia/Kolkata'
from generate_series(8, 200, 7) as d
where (abs(hashtext('00000000-0000-0000-0000-000000000204|spo2|s|' || d)) % 100) >= 20
  and ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '8 hours') at time zone 'Asia/Kolkata' <= now();
insert into public.vitals (patient_id, type, value, value2, unit, measured_at)
select '00000000-0000-0000-0000-000000000205', 'weight', round((62 + (58.4 - 62) * (1 - (d - 8)::numeric / 352) + (((abs(hashtext('00000000-0000-0000-0000-000000000205|weight|a|' || d)) % 1000) / 1000.0) - 0.5) * 0.5)::numeric, 1), null, 'kg',
  ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '7 hours' + ((abs(hashtext('00000000-0000-0000-0000-000000000205|weight|t|' || d)) % 45) || ' minutes')::interval) at time zone 'Asia/Kolkata'
from generate_series(8, 360, 14) as d
where (abs(hashtext('00000000-0000-0000-0000-000000000205|weight|s|' || d)) % 100) >= 10
  and ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '7 hours') at time zone 'Asia/Kolkata' <= now();
insert into public.vitals (patient_id, type, value, value2, unit, measured_at)
select '00000000-0000-0000-0000-000000000205', 'heart_rate', round((84 + (76 - 84) * (1 - (d - 8)::numeric / 192) + (((abs(hashtext('00000000-0000-0000-0000-000000000205|heart_rate|a|' || d)) % 1000) / 1000.0) - 0.5) * 5)::numeric, 0), null, 'bpm',
  ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '8 hours' + ((abs(hashtext('00000000-0000-0000-0000-000000000205|heart_rate|t|' || d)) % 45) || ' minutes')::interval) at time zone 'Asia/Kolkata'
from generate_series(8, 200, 8) as d
where (abs(hashtext('00000000-0000-0000-0000-000000000205|heart_rate|s|' || d)) % 100) >= 25
  and ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '8 hours') at time zone 'Asia/Kolkata' <= now();
insert into public.vitals (patient_id, type, value, value2, unit, measured_at)
select '00000000-0000-0000-0000-000000000206', 'sugar_fasting', round((196 + (112 - 196) * (1 - (d - 0)::numeric / 360) + (((abs(hashtext('00000000-0000-0000-0000-000000000206|sugar_fasting|a|' || d)) % 1000) / 1000.0) - 0.5) * 16)::numeric, 0), null, 'mg/dL',
  ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '7 hours' + ((abs(hashtext('00000000-0000-0000-0000-000000000206|sugar_fasting|t|' || d)) % 45) || ' minutes')::interval) at time zone 'Asia/Kolkata'
from generate_series(0, 360, 3) as d
where (abs(hashtext('00000000-0000-0000-0000-000000000206|sugar_fasting|s|' || d)) % 100) >= 20
  and ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '7 hours') at time zone 'Asia/Kolkata' <= now();
insert into public.vitals (patient_id, type, value, value2, unit, measured_at)
select '00000000-0000-0000-0000-000000000206', 'sugar_random', round((214 + (148 - 214) * (1 - (d - 0)::numeric / 120) + (((abs(hashtext('00000000-0000-0000-0000-000000000206|sugar_random|a|' || d)) % 1000) / 1000.0) - 0.5) * 22)::numeric, 0), null, 'mg/dL',
  ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '15 hours' + ((abs(hashtext('00000000-0000-0000-0000-000000000206|sugar_random|t|' || d)) % 45) || ' minutes')::interval) at time zone 'Asia/Kolkata'
from generate_series(0, 120, 5) as d
where (abs(hashtext('00000000-0000-0000-0000-000000000206|sugar_random|s|' || d)) % 100) >= 30
  and ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '15 hours') at time zone 'Asia/Kolkata' <= now();
insert into public.vitals (patient_id, type, value, value2, unit, measured_at)
select '00000000-0000-0000-0000-000000000206', 'bp', round((152 + (128 - 152) * (1 - (d - 0)::numeric / 360) + (((abs(hashtext('00000000-0000-0000-0000-000000000206|bp|a|' || d)) % 1000) / 1000.0) - 0.5) * 6)::numeric, 0), round((94 + (80 - 94) * (1 - (d - 0)::numeric / 360) + (((abs(hashtext('00000000-0000-0000-0000-000000000206|bp|b|' || d)) % 1000) / 1000.0) - 0.5) * 4)::numeric, 0), 'mmHg',
  ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '8 hours' + ((abs(hashtext('00000000-0000-0000-0000-000000000206|bp|t|' || d)) % 45) || ' minutes')::interval) at time zone 'Asia/Kolkata'
from generate_series(0, 360, 4) as d
where (abs(hashtext('00000000-0000-0000-0000-000000000206|bp|s|' || d)) % 100) >= 20
  and ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '8 hours') at time zone 'Asia/Kolkata' <= now();
insert into public.vitals (patient_id, type, value, value2, unit, measured_at)
select '00000000-0000-0000-0000-000000000206', 'weight', round((96 + (88.5 - 96) * (1 - (d - 0)::numeric / 360) + (((abs(hashtext('00000000-0000-0000-0000-000000000206|weight|a|' || d)) % 1000) / 1000.0) - 0.5) * 0.6)::numeric, 1), null, 'kg',
  ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '7 hours' + ((abs(hashtext('00000000-0000-0000-0000-000000000206|weight|t|' || d)) % 45) || ' minutes')::interval) at time zone 'Asia/Kolkata'
from generate_series(0, 360, 10) as d
where (abs(hashtext('00000000-0000-0000-0000-000000000206|weight|s|' || d)) % 100) >= 10
  and ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '7 hours') at time zone 'Asia/Kolkata' <= now();
insert into public.vitals (patient_id, type, value, value2, unit, measured_at)
select '00000000-0000-0000-0000-000000000206', 'heart_rate', round((82 + (74 - 82) * (1 - (d - 0)::numeric / 200) + (((abs(hashtext('00000000-0000-0000-0000-000000000206|heart_rate|a|' || d)) % 1000) / 1000.0) - 0.5) * 4)::numeric, 0), null, 'bpm',
  ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '8 hours' + ((abs(hashtext('00000000-0000-0000-0000-000000000206|heart_rate|t|' || d)) % 45) || ' minutes')::interval) at time zone 'Asia/Kolkata'
from generate_series(0, 200, 7) as d
where (abs(hashtext('00000000-0000-0000-0000-000000000206|heart_rate|s|' || d)) % 100) >= 25
  and ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '8 hours') at time zone 'Asia/Kolkata' <= now();
insert into public.vitals (patient_id, type, value, value2, unit, measured_at)
select '00000000-0000-0000-0000-000000000207', 'heart_rate', round((104 + (94 - 104) * (1 - (d - 0)::numeric / 200) + (((abs(hashtext('00000000-0000-0000-0000-000000000207|heart_rate|a|' || d)) % 1000) / 1000.0) - 0.5) * 6)::numeric, 0), null, 'bpm',
  ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '9 hours' + ((abs(hashtext('00000000-0000-0000-0000-000000000207|heart_rate|t|' || d)) % 45) || ' minutes')::interval) at time zone 'Asia/Kolkata'
from generate_series(0, 200, 5) as d
where (abs(hashtext('00000000-0000-0000-0000-000000000207|heart_rate|s|' || d)) % 100) >= 20
  and ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '9 hours') at time zone 'Asia/Kolkata' <= now();
insert into public.vitals (patient_id, type, value, value2, unit, measured_at)
select '00000000-0000-0000-0000-000000000207', 'spo2', round((96 + (97 - 96) * (1 - (d - 0)::numeric / 200) + (((abs(hashtext('00000000-0000-0000-0000-000000000207|spo2|a|' || d)) % 1000) / 1000.0) - 0.5) * 1)::numeric, 0), null, '%',
  ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '9 hours' + ((abs(hashtext('00000000-0000-0000-0000-000000000207|spo2|t|' || d)) % 45) || ' minutes')::interval) at time zone 'Asia/Kolkata'
from generate_series(0, 200, 5) as d
where (abs(hashtext('00000000-0000-0000-0000-000000000207|spo2|s|' || d)) % 100) >= 20
  and ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '9 hours') at time zone 'Asia/Kolkata' <= now();
insert into public.vitals (patient_id, type, value, value2, unit, measured_at)
select '00000000-0000-0000-0000-000000000207', 'weight', round((40.2 + (43 - 40.2) * (1 - (d - 0)::numeric / 360) + (((abs(hashtext('00000000-0000-0000-0000-000000000207|weight|a|' || d)) % 1000) / 1000.0) - 0.5) * 0.5)::numeric, 1), null, 'kg',
  ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '8 hours' + ((abs(hashtext('00000000-0000-0000-0000-000000000207|weight|t|' || d)) % 45) || ' minutes')::interval) at time zone 'Asia/Kolkata'
from generate_series(0, 360, 14) as d
where (abs(hashtext('00000000-0000-0000-0000-000000000207|weight|s|' || d)) % 100) >= 10
  and ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '8 hours') at time zone 'Asia/Kolkata' <= now();
insert into public.vitals (patient_id, type, value, value2, unit, measured_at)
select '00000000-0000-0000-0000-000000000207', 'bp', round((98 + (104 - 98) * (1 - (d - 0)::numeric / 200) + (((abs(hashtext('00000000-0000-0000-0000-000000000207|bp|a|' || d)) % 1000) / 1000.0) - 0.5) * 5)::numeric, 0), round((60 + (66 - 60) * (1 - (d - 0)::numeric / 200) + (((abs(hashtext('00000000-0000-0000-0000-000000000207|bp|b|' || d)) % 1000) / 1000.0) - 0.5) * 4)::numeric, 0), 'mmHg',
  ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '9 hours' + ((abs(hashtext('00000000-0000-0000-0000-000000000207|bp|t|' || d)) % 45) || ' minutes')::interval) at time zone 'Asia/Kolkata'
from generate_series(0, 200, 7) as d
where (abs(hashtext('00000000-0000-0000-0000-000000000207|bp|s|' || d)) % 100) >= 20
  and ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '9 hours') at time zone 'Asia/Kolkata' <= now();
insert into public.vitals (patient_id, type, value, value2, unit, measured_at)
select '00000000-0000-0000-0000-000000000208', 'spo2', round((94 + (94 - 94) * (1 - (d - 0)::numeric / 200) + (((abs(hashtext('00000000-0000-0000-0000-000000000208|spo2|a|' || d)) % 1000) / 1000.0) - 0.5) * 1.4)::numeric, 0), null, '%',
  ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '8 hours' + ((abs(hashtext('00000000-0000-0000-0000-000000000208|spo2|t|' || d)) % 45) || ' minutes')::interval) at time zone 'Asia/Kolkata'
from generate_series(0, 200, 2) as d
where (abs(hashtext('00000000-0000-0000-0000-000000000208|spo2|s|' || d)) % 100) >= 20
  and ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '8 hours') at time zone 'Asia/Kolkata' <= now();
insert into public.vitals (patient_id, type, value, value2, unit, measured_at)
select '00000000-0000-0000-0000-000000000208', 'heart_rate', round((86 + (80 - 86) * (1 - (d - 0)::numeric / 200) + (((abs(hashtext('00000000-0000-0000-0000-000000000208|heart_rate|a|' || d)) % 1000) / 1000.0) - 0.5) * 5)::numeric, 0), null, 'bpm',
  ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '8 hours' + ((abs(hashtext('00000000-0000-0000-0000-000000000208|heart_rate|t|' || d)) % 45) || ' minutes')::interval) at time zone 'Asia/Kolkata'
from generate_series(0, 200, 4) as d
where (abs(hashtext('00000000-0000-0000-0000-000000000208|heart_rate|s|' || d)) % 100) >= 20
  and ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '8 hours') at time zone 'Asia/Kolkata' <= now();
insert into public.vitals (patient_id, type, value, value2, unit, measured_at)
select '00000000-0000-0000-0000-000000000208', 'weight', round((69 + (66.5 - 69) * (1 - (d - 0)::numeric / 360) + (((abs(hashtext('00000000-0000-0000-0000-000000000208|weight|a|' || d)) % 1000) / 1000.0) - 0.5) * 0.6)::numeric, 1), null, 'kg',
  ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '8 hours' + ((abs(hashtext('00000000-0000-0000-0000-000000000208|weight|t|' || d)) % 45) || ' minutes')::interval) at time zone 'Asia/Kolkata'
from generate_series(0, 360, 14) as d
where (abs(hashtext('00000000-0000-0000-0000-000000000208|weight|s|' || d)) % 100) >= 10
  and ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '8 hours') at time zone 'Asia/Kolkata' <= now();
insert into public.vitals (patient_id, type, value, value2, unit, measured_at)
select '00000000-0000-0000-0000-000000000208', 'bp', round((138 + (132 - 138) * (1 - (d - 0)::numeric / 200) + (((abs(hashtext('00000000-0000-0000-0000-000000000208|bp|a|' || d)) % 1000) / 1000.0) - 0.5) * 6)::numeric, 0), round((84 + (80 - 84) * (1 - (d - 0)::numeric / 200) + (((abs(hashtext('00000000-0000-0000-0000-000000000208|bp|b|' || d)) % 1000) / 1000.0) - 0.5) * 4)::numeric, 0), 'mmHg',
  ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '8 hours' + ((abs(hashtext('00000000-0000-0000-0000-000000000208|bp|t|' || d)) % 45) || ' minutes')::interval) at time zone 'Asia/Kolkata'
from generate_series(0, 200, 5) as d
where (abs(hashtext('00000000-0000-0000-0000-000000000208|bp|s|' || d)) % 100) >= 20
  and ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '8 hours') at time zone 'Asia/Kolkata' <= now();
insert into public.vitals (patient_id, type, value, value2, unit, measured_at)
select '00000000-0000-0000-0000-000000000209', 'weight', round((79 + (71 - 79) * (1 - (d - 0)::numeric / 360) + (((abs(hashtext('00000000-0000-0000-0000-000000000209|weight|a|' || d)) % 1000) / 1000.0) - 0.5) * 0.5)::numeric, 1), null, 'kg',
  ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '7 hours' + ((abs(hashtext('00000000-0000-0000-0000-000000000209|weight|t|' || d)) % 45) || ' minutes')::interval) at time zone 'Asia/Kolkata'
from generate_series(0, 360, 7) as d
where (abs(hashtext('00000000-0000-0000-0000-000000000209|weight|s|' || d)) % 100) >= 15
  and ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '7 hours') at time zone 'Asia/Kolkata' <= now();
insert into public.vitals (patient_id, type, value, value2, unit, measured_at)
select '00000000-0000-0000-0000-000000000209', 'heart_rate', round((92 + (80 - 92) * (1 - (d - 0)::numeric / 200) + (((abs(hashtext('00000000-0000-0000-0000-000000000209|heart_rate|a|' || d)) % 1000) / 1000.0) - 0.5) * 5)::numeric, 0), null, 'bpm',
  ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '8 hours' + ((abs(hashtext('00000000-0000-0000-0000-000000000209|heart_rate|t|' || d)) % 45) || ' minutes')::interval) at time zone 'Asia/Kolkata'
from generate_series(0, 200, 8) as d
where (abs(hashtext('00000000-0000-0000-0000-000000000209|heart_rate|s|' || d)) % 100) >= 25
  and ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '8 hours') at time zone 'Asia/Kolkata' <= now();
insert into public.vitals (patient_id, type, value, value2, unit, measured_at)
select '00000000-0000-0000-0000-000000000209', 'bp', round((112 + (110 - 112) * (1 - (d - 0)::numeric / 200) + (((abs(hashtext('00000000-0000-0000-0000-000000000209|bp|a|' || d)) % 1000) / 1000.0) - 0.5) * 5)::numeric, 0), round((74 + (72 - 74) * (1 - (d - 0)::numeric / 200) + (((abs(hashtext('00000000-0000-0000-0000-000000000209|bp|b|' || d)) % 1000) / 1000.0) - 0.5) * 3)::numeric, 0), 'mmHg',
  ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '8 hours' + ((abs(hashtext('00000000-0000-0000-0000-000000000209|bp|t|' || d)) % 45) || ' minutes')::interval) at time zone 'Asia/Kolkata'
from generate_series(0, 200, 10) as d
where (abs(hashtext('00000000-0000-0000-0000-000000000209|bp|s|' || d)) % 100) >= 25
  and ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '8 hours') at time zone 'Asia/Kolkata' <= now();
insert into public.vitals (patient_id, type, value, value2, unit, measured_at)
select '00000000-0000-0000-0000-000000000210', 'bp', round((142 + (128 - 142) * (1 - (d - 0)::numeric / 330) + (((abs(hashtext('00000000-0000-0000-0000-000000000210|bp|a|' || d)) % 1000) / 1000.0) - 0.5) * 6)::numeric, 0), round((88 + (80 - 88) * (1 - (d - 0)::numeric / 330) + (((abs(hashtext('00000000-0000-0000-0000-000000000210|bp|b|' || d)) % 1000) / 1000.0) - 0.5) * 4)::numeric, 0), 'mmHg',
  ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '8 hours' + ((abs(hashtext('00000000-0000-0000-0000-000000000210|bp|t|' || d)) % 45) || ' minutes')::interval) at time zone 'Asia/Kolkata'
from generate_series(0, 330, 4) as d
where (abs(hashtext('00000000-0000-0000-0000-000000000210|bp|s|' || d)) % 100) >= 20
  and ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '8 hours') at time zone 'Asia/Kolkata' <= now();
insert into public.vitals (patient_id, type, value, value2, unit, measured_at)
select '00000000-0000-0000-0000-000000000210', 'heart_rate', round((98 + (76 - 98) * (1 - (d - 0)::numeric / 330) + (((abs(hashtext('00000000-0000-0000-0000-000000000210|heart_rate|a|' || d)) % 1000) / 1000.0) - 0.5) * 10)::numeric, 0), null, 'bpm',
  ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '8 hours' + ((abs(hashtext('00000000-0000-0000-0000-000000000210|heart_rate|t|' || d)) % 45) || ' minutes')::interval) at time zone 'Asia/Kolkata'
from generate_series(0, 330, 4) as d
where (abs(hashtext('00000000-0000-0000-0000-000000000210|heart_rate|s|' || d)) % 100) >= 20
  and ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '8 hours') at time zone 'Asia/Kolkata' <= now();
insert into public.vitals (patient_id, type, value, value2, unit, measured_at)
select '00000000-0000-0000-0000-000000000210', 'weight', round((84 + (81 - 84) * (1 - (d - 0)::numeric / 330) + (((abs(hashtext('00000000-0000-0000-0000-000000000210|weight|a|' || d)) % 1000) / 1000.0) - 0.5) * 0.6)::numeric, 1), null, 'kg',
  ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '7 hours' + ((abs(hashtext('00000000-0000-0000-0000-000000000210|weight|t|' || d)) % 45) || ' minutes')::interval) at time zone 'Asia/Kolkata'
from generate_series(0, 330, 14) as d
where (abs(hashtext('00000000-0000-0000-0000-000000000210|weight|s|' || d)) % 100) >= 10
  and ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '7 hours') at time zone 'Asia/Kolkata' <= now();
insert into public.vitals (patient_id, type, value, value2, unit, measured_at)
select '00000000-0000-0000-0000-000000000211', 'bp', round((150 + (136 - 150) * (1 - (d - 0)::numeric / 300) + (((abs(hashtext('00000000-0000-0000-0000-000000000211|bp|a|' || d)) % 1000) / 1000.0) - 0.5) * 7)::numeric, 0), round((88 + (82 - 88) * (1 - (d - 0)::numeric / 300) + (((abs(hashtext('00000000-0000-0000-0000-000000000211|bp|b|' || d)) % 1000) / 1000.0) - 0.5) * 4)::numeric, 0), 'mmHg',
  ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '9 hours' + ((abs(hashtext('00000000-0000-0000-0000-000000000211|bp|t|' || d)) % 45) || ' minutes')::interval) at time zone 'Asia/Kolkata'
from generate_series(0, 300, 5) as d
where (abs(hashtext('00000000-0000-0000-0000-000000000211|bp|s|' || d)) % 100) >= 20
  and ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '9 hours') at time zone 'Asia/Kolkata' <= now();
insert into public.vitals (patient_id, type, value, value2, unit, measured_at)
select '00000000-0000-0000-0000-000000000211', 'weight', round((62 + (60.5 - 62) * (1 - (d - 0)::numeric / 300) + (((abs(hashtext('00000000-0000-0000-0000-000000000211|weight|a|' || d)) % 1000) / 1000.0) - 0.5) * 0.5)::numeric, 1), null, 'kg',
  ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '8 hours' + ((abs(hashtext('00000000-0000-0000-0000-000000000211|weight|t|' || d)) % 45) || ' minutes')::interval) at time zone 'Asia/Kolkata'
from generate_series(0, 300, 14) as d
where (abs(hashtext('00000000-0000-0000-0000-000000000211|weight|s|' || d)) % 100) >= 10
  and ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '8 hours') at time zone 'Asia/Kolkata' <= now();
insert into public.vitals (patient_id, type, value, value2, unit, measured_at)
select '00000000-0000-0000-0000-000000000211', 'heart_rate', round((78 + (74 - 78) * (1 - (d - 0)::numeric / 200) + (((abs(hashtext('00000000-0000-0000-0000-000000000211|heart_rate|a|' || d)) % 1000) / 1000.0) - 0.5) * 4)::numeric, 0), null, 'bpm',
  ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '9 hours' + ((abs(hashtext('00000000-0000-0000-0000-000000000211|heart_rate|t|' || d)) % 45) || ' minutes')::interval) at time zone 'Asia/Kolkata'
from generate_series(0, 200, 7) as d
where (abs(hashtext('00000000-0000-0000-0000-000000000211|heart_rate|s|' || d)) % 100) >= 25
  and ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '9 hours') at time zone 'Asia/Kolkata' <= now();
insert into public.vitals (patient_id, type, value, value2, unit, measured_at)
select '00000000-0000-0000-0000-000000000212', 'sugar_fasting', round((168 + (118 - 168) * (1 - (d - 0)::numeric / 120) + (((abs(hashtext('00000000-0000-0000-0000-000000000212|sugar_fasting|a|' || d)) % 1000) / 1000.0) - 0.5) * 24)::numeric, 0), null, 'mg/dL',
  ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '7 hours' + ((abs(hashtext('00000000-0000-0000-0000-000000000212|sugar_fasting|t|' || d)) % 45) || ' minutes')::interval) at time zone 'Asia/Kolkata'
from generate_series(0, 120, 1) as d
where (abs(hashtext('00000000-0000-0000-0000-000000000212|sugar_fasting|s|' || d)) % 100) >= 8
  and ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '7 hours') at time zone 'Asia/Kolkata' <= now();
insert into public.vitals (patient_id, type, value, value2, unit, measured_at)
select '00000000-0000-0000-0000-000000000212', 'sugar_random', round((190 + (150 - 190) * (1 - (d - 0)::numeric / 60) + (((abs(hashtext('00000000-0000-0000-0000-000000000212|sugar_random|a|' || d)) % 1000) / 1000.0) - 0.5) * 40)::numeric, 0), null, 'mg/dL',
  ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '14 hours' + ((abs(hashtext('00000000-0000-0000-0000-000000000212|sugar_random|t|' || d)) % 45) || ' minutes')::interval) at time zone 'Asia/Kolkata'
from generate_series(0, 60, 1) as d
where (abs(hashtext('00000000-0000-0000-0000-000000000212|sugar_random|s|' || d)) % 100) >= 15
  and ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '14 hours') at time zone 'Asia/Kolkata' <= now();
insert into public.vitals (patient_id, type, value, value2, unit, measured_at)
select '00000000-0000-0000-0000-000000000212', 'weight', round((24.6 + (29.2 - 24.6) * (1 - (d - 0)::numeric / 360) + (((abs(hashtext('00000000-0000-0000-0000-000000000212|weight|a|' || d)) % 1000) / 1000.0) - 0.5) * 0.3)::numeric, 1), null, 'kg',
  ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '7 hours' + ((abs(hashtext('00000000-0000-0000-0000-000000000212|weight|t|' || d)) % 45) || ' minutes')::interval) at time zone 'Asia/Kolkata'
from generate_series(0, 360, 14) as d
where (abs(hashtext('00000000-0000-0000-0000-000000000212|weight|s|' || d)) % 100) >= 10
  and ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '7 hours') at time zone 'Asia/Kolkata' <= now();
insert into public.vitals (patient_id, type, value, value2, unit, measured_at)
select '00000000-0000-0000-0000-000000000213', 'weight', round((61.5 + (71.4 - 61.5) * (1 - (d - 0)::numeric / 160) + (((abs(hashtext('00000000-0000-0000-0000-000000000213|weight|a|' || d)) % 1000) / 1000.0) - 0.5) * 0.4)::numeric, 1), null, 'kg',
  ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '8 hours' + ((abs(hashtext('00000000-0000-0000-0000-000000000213|weight|t|' || d)) % 45) || ' minutes')::interval) at time zone 'Asia/Kolkata'
from generate_series(0, 160, 7) as d
where (abs(hashtext('00000000-0000-0000-0000-000000000213|weight|s|' || d)) % 100) >= 5
  and ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '8 hours') at time zone 'Asia/Kolkata' <= now();
insert into public.vitals (patient_id, type, value, value2, unit, measured_at)
select '00000000-0000-0000-0000-000000000213', 'bp', round((106 + (118 - 106) * (1 - (d - 0)::numeric / 160) + (((abs(hashtext('00000000-0000-0000-0000-000000000213|bp|a|' || d)) % 1000) / 1000.0) - 0.5) * 5)::numeric, 0), round((68 + (76 - 68) * (1 - (d - 0)::numeric / 160) + (((abs(hashtext('00000000-0000-0000-0000-000000000213|bp|b|' || d)) % 1000) / 1000.0) - 0.5) * 3)::numeric, 0), 'mmHg',
  ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '9 hours' + ((abs(hashtext('00000000-0000-0000-0000-000000000213|bp|t|' || d)) % 45) || ' minutes')::interval) at time zone 'Asia/Kolkata'
from generate_series(0, 160, 7) as d
where (abs(hashtext('00000000-0000-0000-0000-000000000213|bp|s|' || d)) % 100) >= 10
  and ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '9 hours') at time zone 'Asia/Kolkata' <= now();
insert into public.vitals (patient_id, type, value, value2, unit, measured_at)
select '00000000-0000-0000-0000-000000000213', 'sugar_fasting', round((99 + (91 - 99) * (1 - (d - 0)::numeric / 55) + (((abs(hashtext('00000000-0000-0000-0000-000000000213|sugar_fasting|a|' || d)) % 1000) / 1000.0) - 0.5) * 7)::numeric, 0), null, 'mg/dL',
  ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '7 hours' + ((abs(hashtext('00000000-0000-0000-0000-000000000213|sugar_fasting|t|' || d)) % 45) || ' minutes')::interval) at time zone 'Asia/Kolkata'
from generate_series(0, 55, 1) as d
where (abs(hashtext('00000000-0000-0000-0000-000000000213|sugar_fasting|s|' || d)) % 100) >= 10
  and ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '7 hours') at time zone 'Asia/Kolkata' <= now();
insert into public.vitals (patient_id, type, value, value2, unit, measured_at)
select '00000000-0000-0000-0000-000000000213', 'sugar_random', round((148 + (126 - 148) * (1 - (d - 0)::numeric / 55) + (((abs(hashtext('00000000-0000-0000-0000-000000000213|sugar_random|a|' || d)) % 1000) / 1000.0) - 0.5) * 16)::numeric, 0), null, 'mg/dL',
  ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '14 hours' + ((abs(hashtext('00000000-0000-0000-0000-000000000213|sugar_random|t|' || d)) % 45) || ' minutes')::interval) at time zone 'Asia/Kolkata'
from generate_series(0, 55, 2) as d
where (abs(hashtext('00000000-0000-0000-0000-000000000213|sugar_random|s|' || d)) % 100) >= 20
  and ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '14 hours') at time zone 'Asia/Kolkata' <= now();
insert into public.vitals (patient_id, type, value, value2, unit, measured_at)
select '00000000-0000-0000-0000-000000000214', 'weight', round((51.5 + (56.2 - 51.5) * (1 - (d - 0)::numeric / 78) + (((abs(hashtext('00000000-0000-0000-0000-000000000214|weight|a|' || d)) % 1000) / 1000.0) - 0.5) * 0.5)::numeric, 1), null, 'kg',
  ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '8 hours' + ((abs(hashtext('00000000-0000-0000-0000-000000000214|weight|t|' || d)) % 45) || ' minutes')::interval) at time zone 'Asia/Kolkata'
from generate_series(0, 78, 7) as d
where (abs(hashtext('00000000-0000-0000-0000-000000000214|weight|s|' || d)) % 100) >= 10
  and ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '8 hours') at time zone 'Asia/Kolkata' <= now();
insert into public.vitals (patient_id, type, value, value2, unit, measured_at)
select '00000000-0000-0000-0000-000000000214', 'temperature', round((100.2 + (98.4 - 100.2) * (1 - (d - 0)::numeric / 78) + (((abs(hashtext('00000000-0000-0000-0000-000000000214|temperature|a|' || d)) % 1000) / 1000.0) - 0.5) * 0.5)::numeric, 1), null, '°F',
  ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '19 hours' + ((abs(hashtext('00000000-0000-0000-0000-000000000214|temperature|t|' || d)) % 45) || ' minutes')::interval) at time zone 'Asia/Kolkata'
from generate_series(0, 78, 2) as d
where (abs(hashtext('00000000-0000-0000-0000-000000000214|temperature|s|' || d)) % 100) >= 15
  and ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '19 hours') at time zone 'Asia/Kolkata' <= now();
insert into public.vitals (patient_id, type, value, value2, unit, measured_at)
select '00000000-0000-0000-0000-000000000214', 'spo2', round((94 + (97 - 94) * (1 - (d - 0)::numeric / 78) + (((abs(hashtext('00000000-0000-0000-0000-000000000214|spo2|a|' || d)) % 1000) / 1000.0) - 0.5) * 1)::numeric, 0), null, '%',
  ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '8 hours' + ((abs(hashtext('00000000-0000-0000-0000-000000000214|spo2|t|' || d)) % 45) || ' minutes')::interval) at time zone 'Asia/Kolkata'
from generate_series(0, 78, 5) as d
where (abs(hashtext('00000000-0000-0000-0000-000000000214|spo2|s|' || d)) % 100) >= 20
  and ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '8 hours') at time zone 'Asia/Kolkata' <= now();
insert into public.vitals (patient_id, type, value, value2, unit, measured_at)
select '00000000-0000-0000-0000-000000000215', 'weight', round((73 + (72 - 73) * (1 - (d - 0)::numeric / 330) + (((abs(hashtext('00000000-0000-0000-0000-000000000215|weight|a|' || d)) % 1000) / 1000.0) - 0.5) * 0.6)::numeric, 1), null, 'kg',
  ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '8 hours' + ((abs(hashtext('00000000-0000-0000-0000-000000000215|weight|t|' || d)) % 45) || ' minutes')::interval) at time zone 'Asia/Kolkata'
from generate_series(0, 330, 14) as d
where (abs(hashtext('00000000-0000-0000-0000-000000000215|weight|s|' || d)) % 100) >= 10
  and ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '8 hours') at time zone 'Asia/Kolkata' <= now();
insert into public.vitals (patient_id, type, value, value2, unit, measured_at)
select '00000000-0000-0000-0000-000000000215', 'bp', round((122 + (118 - 122) * (1 - (d - 0)::numeric / 330) + (((abs(hashtext('00000000-0000-0000-0000-000000000215|bp|a|' || d)) % 1000) / 1000.0) - 0.5) * 5)::numeric, 0), round((78 + (76 - 78) * (1 - (d - 0)::numeric / 330) + (((abs(hashtext('00000000-0000-0000-0000-000000000215|bp|b|' || d)) % 1000) / 1000.0) - 0.5) * 3)::numeric, 0), 'mmHg',
  ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '8 hours' + ((abs(hashtext('00000000-0000-0000-0000-000000000215|bp|t|' || d)) % 45) || ' minutes')::interval) at time zone 'Asia/Kolkata'
from generate_series(0, 330, 14) as d
where (abs(hashtext('00000000-0000-0000-0000-000000000215|bp|s|' || d)) % 100) >= 15
  and ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '8 hours') at time zone 'Asia/Kolkata' <= now();
insert into public.vitals (patient_id, type, value, value2, unit, measured_at)
select '00000000-0000-0000-0000-000000000215', 'heart_rate', round((72 + (70 - 72) * (1 - (d - 0)::numeric / 330) + (((abs(hashtext('00000000-0000-0000-0000-000000000215|heart_rate|a|' || d)) % 1000) / 1000.0) - 0.5) * 4)::numeric, 0), null, 'bpm',
  ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '8 hours' + ((abs(hashtext('00000000-0000-0000-0000-000000000215|heart_rate|t|' || d)) % 45) || ' minutes')::interval) at time zone 'Asia/Kolkata'
from generate_series(0, 330, 14) as d
where (abs(hashtext('00000000-0000-0000-0000-000000000215|heart_rate|s|' || d)) % 100) >= 15
  and ((date_trunc('day', now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + interval '8 hours') at time zone 'Asia/Kolkata' <= now();

-- Dose logs: up to 120 days for each medicine, with a realistic share of missed and skipped doses (a few "bad patches" too).
-- They are written in India time and never for a time in the future. (as-needed medicines have no logs.)
insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
select '00000000-0000-0000-0000-000000000001', i.id, t.at,
  case
    when r < (case when d between 28 and 35 and 35 > 0 then 50 else 9 end) then 'missed'
    when r < (case when d between 28 and 35 and 35 > 0 then 50 else 9 end) + 3 then 'skipped'
    else 'taken' end,
  t.at + interval '10 minutes'
from public.prescription_items i
cross join lateral generate_series(0, 120) as d
cross join lateral unnest(array[9,21]) as h
cross join lateral (select (date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + (h || ' hours')::interval) at time zone 'Asia/Kolkata' as at) t
cross join lateral (select abs(hashtext(i.id::text || '|' || d || '|' || h)) % 100 as r) rr
where i.id = '22222222-2222-2222-2222-222222222221'
  and t.at <= now() - interval '5 minutes'
  and (t.at at time zone 'Asia/Kolkata')::date >= i.start_date
  and (t.at at time zone 'Asia/Kolkata')::date <= coalesce(i.end_date, current_date)
on conflict (item_id, scheduled_for) do nothing;
insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
select '00000000-0000-0000-0000-000000000001', i.id, t.at,
  case
    when r < (case when d between 28 and 35 and 35 > 0 then 50 else 8 end) then 'missed'
    when r < (case when d between 28 and 35 and 35 > 0 then 50 else 8 end) + 2 then 'skipped'
    else 'taken' end,
  t.at + interval '10 minutes'
from public.prescription_items i
cross join lateral generate_series(0, 120) as d
cross join lateral unnest(array[9]) as h
cross join lateral (select (date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + (h || ' hours')::interval) at time zone 'Asia/Kolkata' as at) t
cross join lateral (select abs(hashtext(i.id::text || '|' || d || '|' || h)) % 100 as r) rr
where i.id = '22222222-2222-2222-2222-222222222222'
  and t.at <= now() - interval '5 minutes'
  and (t.at at time zone 'Asia/Kolkata')::date >= i.start_date
  and (t.at at time zone 'Asia/Kolkata')::date <= coalesce(i.end_date, current_date)
on conflict (item_id, scheduled_for) do nothing;
insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
select '00000000-0000-0000-0000-000000000201', i.id, t.at,
  case
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 3 end) then 'missed'
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 3 end) + 0 then 'skipped'
    else 'taken' end,
  t.at + interval '10 minutes'
from public.prescription_items i
cross join lateral generate_series(0, 120) as d
cross join lateral unnest(array[9]) as h
cross join lateral (select (date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + (h || ' hours')::interval) at time zone 'Asia/Kolkata' as at) t
cross join lateral (select abs(hashtext(i.id::text || '|' || d || '|' || h)) % 100 as r) rr
where i.id = 'b2000001-0000-0000-0000-000000000001'
  and t.at <= now() - interval '5 minutes'
  and (t.at at time zone 'Asia/Kolkata')::date >= i.start_date
  and (t.at at time zone 'Asia/Kolkata')::date <= coalesce(i.end_date, current_date)
on conflict (item_id, scheduled_for) do nothing;
insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
select '00000000-0000-0000-0000-000000000201', i.id, t.at,
  case
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 4 end) then 'missed'
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 4 end) + 0 then 'skipped'
    else 'taken' end,
  t.at + interval '10 minutes'
from public.prescription_items i
cross join lateral generate_series(0, 120) as d
cross join lateral unnest(array[8]) as h
cross join lateral (select (date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + (h || ' hours')::interval) at time zone 'Asia/Kolkata' as at) t
cross join lateral (select abs(hashtext(i.id::text || '|' || d || '|' || h)) % 100 as r) rr
where i.id = 'b2000001-0000-0000-0000-000000000002'
  and t.at <= now() - interval '5 minutes'
  and (t.at at time zone 'Asia/Kolkata')::date >= i.start_date
  and (t.at at time zone 'Asia/Kolkata')::date <= coalesce(i.end_date, current_date)
on conflict (item_id, scheduled_for) do nothing;
insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
select '00000000-0000-0000-0000-000000000201', i.id, t.at,
  case
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 6 end) then 'missed'
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 6 end) + 1 then 'skipped'
    else 'taken' end,
  t.at + interval '10 minutes'
from public.prescription_items i
cross join lateral generate_series(0, 120) as d
cross join lateral unnest(array[21]) as h
cross join lateral (select (date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + (h || ' hours')::interval) at time zone 'Asia/Kolkata' as at) t
cross join lateral (select abs(hashtext(i.id::text || '|' || d || '|' || h)) % 100 as r) rr
where i.id = 'b2000001-0000-0000-0000-000000000003'
  and t.at <= now() - interval '5 minutes'
  and (t.at at time zone 'Asia/Kolkata')::date >= i.start_date
  and (t.at at time zone 'Asia/Kolkata')::date <= coalesce(i.end_date, current_date)
on conflict (item_id, scheduled_for) do nothing;
insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
select '00000000-0000-0000-0000-000000000201', i.id, t.at,
  case
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 3 end) then 'missed'
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 3 end) + 0 then 'skipped'
    else 'taken' end,
  t.at + interval '10 minutes'
from public.prescription_items i
cross join lateral generate_series(0, 120) as d
cross join lateral unnest(array[9]) as h
cross join lateral (select (date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + (h || ' hours')::interval) at time zone 'Asia/Kolkata' as at) t
cross join lateral (select abs(hashtext(i.id::text || '|' || d || '|' || h)) % 100 as r) rr
where i.id = 'b2000001-0000-0000-0000-000000000004'
  and t.at <= now() - interval '5 minutes'
  and (t.at at time zone 'Asia/Kolkata')::date >= i.start_date
  and (t.at at time zone 'Asia/Kolkata')::date <= coalesce(i.end_date, current_date)
on conflict (item_id, scheduled_for) do nothing;
insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
select '00000000-0000-0000-0000-000000000202', i.id, t.at,
  case
    when r < (case when d between 100 and 120 and 120 > 0 then 55 else 14 end) then 'missed'
    when r < (case when d between 100 and 120 and 120 > 0 then 55 else 14 end) + 4 then 'skipped'
    else 'taken' end,
  t.at + interval '10 minutes'
from public.prescription_items i
cross join lateral generate_series(0, 120) as d
cross join lateral unnest(array[8,20]) as h
cross join lateral (select (date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + (h || ' hours')::interval) at time zone 'Asia/Kolkata' as at) t
cross join lateral (select abs(hashtext(i.id::text || '|' || d || '|' || h)) % 100 as r) rr
where i.id = 'b2000002-0000-0000-0000-000000000001'
  and t.at <= now() - interval '5 minutes'
  and (t.at at time zone 'Asia/Kolkata')::date >= i.start_date
  and (t.at at time zone 'Asia/Kolkata')::date <= coalesce(i.end_date, current_date)
on conflict (item_id, scheduled_for) do nothing;
insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
select '00000000-0000-0000-0000-000000000202', i.id, t.at,
  case
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 12 end) then 'missed'
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 12 end) + 3 then 'skipped'
    else 'taken' end,
  t.at + interval '10 minutes'
from public.prescription_items i
cross join lateral generate_series(0, 120) as d
cross join lateral unnest(array[22]) as h
cross join lateral (select (date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + (h || ' hours')::interval) at time zone 'Asia/Kolkata' as at) t
cross join lateral (select abs(hashtext(i.id::text || '|' || d || '|' || h)) % 100 as r) rr
where i.id = 'b2000002-0000-0000-0000-000000000003'
  and t.at <= now() - interval '5 minutes'
  and (t.at at time zone 'Asia/Kolkata')::date >= i.start_date
  and (t.at at time zone 'Asia/Kolkata')::date <= coalesce(i.end_date, current_date)
on conflict (item_id, scheduled_for) do nothing;
insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
select '00000000-0000-0000-0000-000000000203', i.id, t.at,
  case
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 2 end) then 'missed'
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 2 end) + 0 then 'skipped'
    else 'taken' end,
  t.at + interval '10 minutes'
from public.prescription_items i
cross join lateral generate_series(0, 120) as d
cross join lateral unnest(array[6]) as h
cross join lateral (select (date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + (h || ' hours')::interval) at time zone 'Asia/Kolkata' as at) t
cross join lateral (select abs(hashtext(i.id::text || '|' || d || '|' || h)) % 100 as r) rr
where i.id = 'b2000003-0000-0000-0000-000000000001'
  and t.at <= now() - interval '5 minutes'
  and (t.at at time zone 'Asia/Kolkata')::date >= i.start_date
  and (t.at at time zone 'Asia/Kolkata')::date <= coalesce(i.end_date, current_date)
on conflict (item_id, scheduled_for) do nothing;
insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
select '00000000-0000-0000-0000-000000000203', i.id, t.at,
  case
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 8 end) then 'missed'
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 8 end) + 2 then 'skipped'
    else 'taken' end,
  t.at + interval '10 minutes'
from public.prescription_items i
cross join lateral generate_series(0, 120) as d
cross join lateral unnest(array[13]) as h
cross join lateral (select (date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + (h || ' hours')::interval) at time zone 'Asia/Kolkata' as at) t
cross join lateral (select abs(hashtext(i.id::text || '|' || d || '|' || h)) % 100 as r) rr
where i.id = 'b2000003-0000-0000-0000-000000000002'
  and t.at <= now() - interval '5 minutes'
  and (t.at at time zone 'Asia/Kolkata')::date >= i.start_date
  and (t.at at time zone 'Asia/Kolkata')::date <= coalesce(i.end_date, current_date)
on conflict (item_id, scheduled_for) do nothing;
insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
select '00000000-0000-0000-0000-000000000204', i.id, t.at,
  case
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 35 end) then 'missed'
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 35 end) + 5 then 'skipped'
    else 'taken' end,
  t.at + interval '10 minutes'
from public.prescription_items i
cross join lateral generate_series(0, 120) as d
cross join lateral unnest(array[9]) as h
cross join lateral (select (date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + (h || ' hours')::interval) at time zone 'Asia/Kolkata' as at) t
cross join lateral (select abs(hashtext(i.id::text || '|' || d || '|' || h)) % 100 as r) rr
where i.id = 'b2000004-0000-0000-0000-000000000001'
  and t.at <= now() - interval '5 minutes'
  and (t.at at time zone 'Asia/Kolkata')::date >= i.start_date
  and (t.at at time zone 'Asia/Kolkata')::date <= coalesce(i.end_date, current_date)
on conflict (item_id, scheduled_for) do nothing;
insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
select '00000000-0000-0000-0000-000000000204', i.id, t.at,
  case
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 35 end) then 'missed'
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 35 end) + 5 then 'skipped'
    else 'taken' end,
  t.at + interval '10 minutes'
from public.prescription_items i
cross join lateral generate_series(0, 120) as d
cross join lateral unnest(array[9]) as h
cross join lateral (select (date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + (h || ' hours')::interval) at time zone 'Asia/Kolkata' as at) t
cross join lateral (select abs(hashtext(i.id::text || '|' || d || '|' || h)) % 100 as r) rr
where i.id = 'b2000004-0000-0000-0000-000000000002'
  and t.at <= now() - interval '5 minutes'
  and (t.at at time zone 'Asia/Kolkata')::date >= i.start_date
  and (t.at at time zone 'Asia/Kolkata')::date <= coalesce(i.end_date, current_date)
on conflict (item_id, scheduled_for) do nothing;
insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
select '00000000-0000-0000-0000-000000000204', i.id, t.at,
  case
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 42 end) then 'missed'
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 42 end) + 4 then 'skipped'
    else 'taken' end,
  t.at + interval '10 minutes'
from public.prescription_items i
cross join lateral generate_series(0, 120) as d
cross join lateral unnest(array[21]) as h
cross join lateral (select (date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + (h || ' hours')::interval) at time zone 'Asia/Kolkata' as at) t
cross join lateral (select abs(hashtext(i.id::text || '|' || d || '|' || h)) % 100 as r) rr
where i.id = 'b2000004-0000-0000-0000-000000000003'
  and t.at <= now() - interval '5 minutes'
  and (t.at at time zone 'Asia/Kolkata')::date >= i.start_date
  and (t.at at time zone 'Asia/Kolkata')::date <= coalesce(i.end_date, current_date)
on conflict (item_id, scheduled_for) do nothing;
insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
select '00000000-0000-0000-0000-000000000204', i.id, t.at,
  case
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 38 end) then 'missed'
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 38 end) + 4 then 'skipped'
    else 'taken' end,
  t.at + interval '10 minutes'
from public.prescription_items i
cross join lateral generate_series(0, 120) as d
cross join lateral unnest(array[13]) as h
cross join lateral (select (date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + (h || ' hours')::interval) at time zone 'Asia/Kolkata' as at) t
cross join lateral (select abs(hashtext(i.id::text || '|' || d || '|' || h)) % 100 as r) rr
where i.id = 'b2000004-0000-0000-0000-000000000004'
  and t.at <= now() - interval '5 minutes'
  and (t.at at time zone 'Asia/Kolkata')::date >= i.start_date
  and (t.at at time zone 'Asia/Kolkata')::date <= coalesce(i.end_date, current_date)
on conflict (item_id, scheduled_for) do nothing;
insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
select '00000000-0000-0000-0000-000000000206', i.id, t.at,
  case
    when r < (case when d between 26 and 40 and 40 > 0 then 55 else 12 end) then 'missed'
    when r < (case when d between 26 and 40 and 40 > 0 then 55 else 12 end) + 3 then 'skipped'
    else 'taken' end,
  t.at + interval '10 minutes'
from public.prescription_items i
cross join lateral generate_series(0, 120) as d
cross join lateral unnest(array[8,20]) as h
cross join lateral (select (date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + (h || ' hours')::interval) at time zone 'Asia/Kolkata' as at) t
cross join lateral (select abs(hashtext(i.id::text || '|' || d || '|' || h)) % 100 as r) rr
where i.id = 'b4110001-0000-0000-0000-000000000000'
  and t.at <= now() - interval '5 minutes'
  and (t.at at time zone 'Asia/Kolkata')::date >= i.start_date
  and (t.at at time zone 'Asia/Kolkata')::date <= coalesce(i.end_date, current_date)
on conflict (item_id, scheduled_for) do nothing;
insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
select '00000000-0000-0000-0000-000000000206', i.id, t.at,
  case
    when r < (case when d between 26 and 40 and 40 > 0 then 55 else 10 end) then 'missed'
    when r < (case when d between 26 and 40 and 40 > 0 then 55 else 10 end) + 3 then 'skipped'
    else 'taken' end,
  t.at + interval '10 minutes'
from public.prescription_items i
cross join lateral generate_series(0, 120) as d
cross join lateral unnest(array[8]) as h
cross join lateral (select (date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + (h || ' hours')::interval) at time zone 'Asia/Kolkata' as at) t
cross join lateral (select abs(hashtext(i.id::text || '|' || d || '|' || h)) % 100 as r) rr
where i.id = 'b4110002-0000-0000-0000-000000000000'
  and t.at <= now() - interval '5 minutes'
  and (t.at at time zone 'Asia/Kolkata')::date >= i.start_date
  and (t.at at time zone 'Asia/Kolkata')::date <= coalesce(i.end_date, current_date)
on conflict (item_id, scheduled_for) do nothing;
insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
select '00000000-0000-0000-0000-000000000206', i.id, t.at,
  case
    when r < (case when d between 26 and 40 and 40 > 0 then 55 else 10 end) then 'missed'
    when r < (case when d between 26 and 40 and 40 > 0 then 55 else 10 end) + 2 then 'skipped'
    else 'taken' end,
  t.at + interval '10 minutes'
from public.prescription_items i
cross join lateral generate_series(0, 120) as d
cross join lateral unnest(array[9]) as h
cross join lateral (select (date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + (h || ' hours')::interval) at time zone 'Asia/Kolkata' as at) t
cross join lateral (select abs(hashtext(i.id::text || '|' || d || '|' || h)) % 100 as r) rr
where i.id = 'b4110003-0000-0000-0000-000000000000'
  and t.at <= now() - interval '5 minutes'
  and (t.at at time zone 'Asia/Kolkata')::date >= i.start_date
  and (t.at at time zone 'Asia/Kolkata')::date <= coalesce(i.end_date, current_date)
on conflict (item_id, scheduled_for) do nothing;
insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
select '00000000-0000-0000-0000-000000000206', i.id, t.at,
  case
    when r < (case when d between 26 and 40 and 40 > 0 then 55 else 8 end) then 'missed'
    when r < (case when d between 26 and 40 and 40 > 0 then 55 else 8 end) + 2 then 'skipped'
    else 'taken' end,
  t.at + interval '10 minutes'
from public.prescription_items i
cross join lateral generate_series(0, 120) as d
cross join lateral unnest(array[9]) as h
cross join lateral (select (date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + (h || ' hours')::interval) at time zone 'Asia/Kolkata' as at) t
cross join lateral (select abs(hashtext(i.id::text || '|' || d || '|' || h)) % 100 as r) rr
where i.id = 'b4110004-0000-0000-0000-000000000000'
  and t.at <= now() - interval '5 minutes'
  and (t.at at time zone 'Asia/Kolkata')::date >= i.start_date
  and (t.at at time zone 'Asia/Kolkata')::date <= coalesce(i.end_date, current_date)
on conflict (item_id, scheduled_for) do nothing;
insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
select '00000000-0000-0000-0000-000000000206', i.id, t.at,
  case
    when r < (case when d between 26 and 40 and 40 > 0 then 60 else 18 end) then 'missed'
    when r < (case when d between 26 and 40 and 40 > 0 then 60 else 18 end) + 4 then 'skipped'
    else 'taken' end,
  t.at + interval '10 minutes'
from public.prescription_items i
cross join lateral generate_series(0, 120) as d
cross join lateral unnest(array[21]) as h
cross join lateral (select (date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + (h || ' hours')::interval) at time zone 'Asia/Kolkata' as at) t
cross join lateral (select abs(hashtext(i.id::text || '|' || d || '|' || h)) % 100 as r) rr
where i.id = 'b4110005-0000-0000-0000-000000000000'
  and t.at <= now() - interval '5 minutes'
  and (t.at at time zone 'Asia/Kolkata')::date >= i.start_date
  and (t.at at time zone 'Asia/Kolkata')::date <= coalesce(i.end_date, current_date)
on conflict (item_id, scheduled_for) do nothing;
insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
select '00000000-0000-0000-0000-000000000207', i.id, t.at,
  case
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 6 end) then 'missed'
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 6 end) + 2 then 'skipped'
    else 'taken' end,
  t.at + interval '10 minutes'
from public.prescription_items i
cross join lateral generate_series(0, 120) as d
cross join lateral unnest(array[7]) as h
cross join lateral (select (date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + (h || ' hours')::interval) at time zone 'Asia/Kolkata' as at) t
cross join lateral (select abs(hashtext(i.id::text || '|' || d || '|' || h)) % 100 as r) rr
where i.id = 'b4120001-0000-0000-0000-000000000000'
  and t.at <= now() - interval '5 minutes'
  and (t.at at time zone 'Asia/Kolkata')::date >= i.start_date
  and (t.at at time zone 'Asia/Kolkata')::date <= coalesce(i.end_date, current_date)
on conflict (item_id, scheduled_for) do nothing;
insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
select '00000000-0000-0000-0000-000000000207', i.id, t.at,
  case
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 8 end) then 'missed'
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 8 end) + 2 then 'skipped'
    else 'taken' end,
  t.at + interval '10 minutes'
from public.prescription_items i
cross join lateral generate_series(0, 120) as d
cross join lateral unnest(array[13]) as h
cross join lateral (select (date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + (h || ' hours')::interval) at time zone 'Asia/Kolkata' as at) t
cross join lateral (select abs(hashtext(i.id::text || '|' || d || '|' || h)) % 100 as r) rr
where i.id = 'b4120002-0000-0000-0000-000000000000'
  and t.at <= now() - interval '5 minutes'
  and (t.at at time zone 'Asia/Kolkata')::date >= i.start_date
  and (t.at at time zone 'Asia/Kolkata')::date <= coalesce(i.end_date, current_date)
on conflict (item_id, scheduled_for) do nothing;
insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
select '00000000-0000-0000-0000-000000000207', i.id, t.at,
  case
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 10 end) then 'missed'
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 10 end) + 0 then 'skipped'
    else 'taken' end,
  t.at + interval '10 minutes'
from public.prescription_items i
cross join lateral generate_series(0, 120) as d
cross join lateral unnest(array[12]) as h
cross join lateral (select (date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + (h || ' hours')::interval) at time zone 'Asia/Kolkata' as at) t
cross join lateral (select abs(hashtext(i.id::text || '|' || d || '|' || h)) % 100 as r) rr
where i.id = 'b4120003-0000-0000-0000-000000000000'
  and t.at <= now() - interval '5 minutes'
  and (t.at at time zone 'Asia/Kolkata')::date >= i.start_date
  and (t.at at time zone 'Asia/Kolkata')::date <= coalesce(i.end_date, current_date)
on conflict (item_id, scheduled_for) do nothing;
insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
select '00000000-0000-0000-0000-000000000208', i.id, t.at,
  case
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 7 end) then 'missed'
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 7 end) + 2 then 'skipped'
    else 'taken' end,
  t.at + interval '10 minutes'
from public.prescription_items i
cross join lateral generate_series(0, 120) as d
cross join lateral unnest(array[8]) as h
cross join lateral (select (date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + (h || ' hours')::interval) at time zone 'Asia/Kolkata' as at) t
cross join lateral (select abs(hashtext(i.id::text || '|' || d || '|' || h)) % 100 as r) rr
where i.id = 'b4130001-0000-0000-0000-000000000000'
  and t.at <= now() - interval '5 minutes'
  and (t.at at time zone 'Asia/Kolkata')::date >= i.start_date
  and (t.at at time zone 'Asia/Kolkata')::date <= coalesce(i.end_date, current_date)
on conflict (item_id, scheduled_for) do nothing;
insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
select '00000000-0000-0000-0000-000000000208', i.id, t.at,
  case
    when r < (case when d between 96 and 120 and 120 > 0 then 60 else 12 end) then 'missed'
    when r < (case when d between 96 and 120 and 120 > 0 then 60 else 12 end) + 4 then 'skipped'
    else 'taken' end,
  t.at + interval '10 minutes'
from public.prescription_items i
cross join lateral generate_series(0, 120) as d
cross join lateral unnest(array[8,20]) as h
cross join lateral (select (date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + (h || ' hours')::interval) at time zone 'Asia/Kolkata' as at) t
cross join lateral (select abs(hashtext(i.id::text || '|' || d || '|' || h)) % 100 as r) rr
where i.id = 'b4130002-0000-0000-0000-000000000000'
  and t.at <= now() - interval '5 minutes'
  and (t.at at time zone 'Asia/Kolkata')::date >= i.start_date
  and (t.at at time zone 'Asia/Kolkata')::date <= coalesce(i.end_date, current_date)
on conflict (item_id, scheduled_for) do nothing;
insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
select '00000000-0000-0000-0000-000000000208', i.id, t.at,
  case
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 8 end) then 'missed'
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 8 end) + 2 then 'skipped'
    else 'taken' end,
  t.at + interval '10 minutes'
from public.prescription_items i
cross join lateral generate_series(0, 120) as d
cross join lateral unnest(array[9]) as h
cross join lateral (select (date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + (h || ' hours')::interval) at time zone 'Asia/Kolkata' as at) t
cross join lateral (select abs(hashtext(i.id::text || '|' || d || '|' || h)) % 100 as r) rr
where i.id = 'b4130004-0000-0000-0000-000000000000'
  and t.at <= now() - interval '5 minutes'
  and (t.at at time zone 'Asia/Kolkata')::date >= i.start_date
  and (t.at at time zone 'Asia/Kolkata')::date <= coalesce(i.end_date, current_date)
on conflict (item_id, scheduled_for) do nothing;
insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
select '00000000-0000-0000-0000-000000000208', i.id, t.at,
  case
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 0 end) then 'missed'
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 0 end) + 0 then 'skipped'
    else 'taken' end,
  t.at + interval '10 minutes'
from public.prescription_items i
cross join lateral generate_series(0, 120) as d
cross join lateral unnest(array[8]) as h
cross join lateral (select (date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + (h || ' hours')::interval) at time zone 'Asia/Kolkata' as at) t
cross join lateral (select abs(hashtext(i.id::text || '|' || d || '|' || h)) % 100 as r) rr
where i.id = 'b4130005-0000-0000-0000-000000000000'
  and t.at <= now() - interval '5 minutes'
  and (t.at at time zone 'Asia/Kolkata')::date >= i.start_date
  and (t.at at time zone 'Asia/Kolkata')::date <= coalesce(i.end_date, current_date)
on conflict (item_id, scheduled_for) do nothing;
insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
select '00000000-0000-0000-0000-000000000209', i.id, t.at,
  case
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 15 end) then 'missed'
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 15 end) + 5 then 'skipped'
    else 'taken' end,
  t.at + interval '10 minutes'
from public.prescription_items i
cross join lateral generate_series(0, 120) as d
cross join lateral unnest(array[9,21]) as h
cross join lateral (select (date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + (h || ' hours')::interval) at time zone 'Asia/Kolkata' as at) t
cross join lateral (select abs(hashtext(i.id::text || '|' || d || '|' || h)) % 100 as r) rr
where i.id = 'b4140001-0000-0000-0000-000000000000'
  and t.at <= now() - interval '5 minutes'
  and (t.at at time zone 'Asia/Kolkata')::date >= i.start_date
  and (t.at at time zone 'Asia/Kolkata')::date <= coalesce(i.end_date, current_date)
on conflict (item_id, scheduled_for) do nothing;
insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
select '00000000-0000-0000-0000-000000000209', i.id, t.at,
  case
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 18 end) then 'missed'
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 18 end) + 4 then 'skipped'
    else 'taken' end,
  t.at + interval '10 minutes'
from public.prescription_items i
cross join lateral generate_series(0, 120) as d
cross join lateral unnest(array[14]) as h
cross join lateral (select (date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + (h || ' hours')::interval) at time zone 'Asia/Kolkata' as at) t
cross join lateral (select abs(hashtext(i.id::text || '|' || d || '|' || h)) % 100 as r) rr
where i.id = 'b4140002-0000-0000-0000-000000000000'
  and t.at <= now() - interval '5 minutes'
  and (t.at at time zone 'Asia/Kolkata')::date >= i.start_date
  and (t.at at time zone 'Asia/Kolkata')::date <= coalesce(i.end_date, current_date)
on conflict (item_id, scheduled_for) do nothing;
insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
select '00000000-0000-0000-0000-000000000209', i.id, t.at,
  case
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 5 end) then 'missed'
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 5 end) + 0 then 'skipped'
    else 'taken' end,
  t.at + interval '10 minutes'
from public.prescription_items i
cross join lateral generate_series(0, 120) as d
cross join lateral unnest(array[12]) as h
cross join lateral (select (date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + (h || ' hours')::interval) at time zone 'Asia/Kolkata' as at) t
cross join lateral (select abs(hashtext(i.id::text || '|' || d || '|' || h)) % 100 as r) rr
where i.id = 'b4140003-0000-0000-0000-000000000000'
  and t.at <= now() - interval '5 minutes'
  and (t.at at time zone 'Asia/Kolkata')::date >= i.start_date
  and (t.at at time zone 'Asia/Kolkata')::date <= coalesce(i.end_date, current_date)
on conflict (item_id, scheduled_for) do nothing;
insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
select '00000000-0000-0000-0000-000000000209', i.id, t.at,
  case
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 14 end) then 'missed'
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 14 end) + 3 then 'skipped'
    else 'taken' end,
  t.at + interval '10 minutes'
from public.prescription_items i
cross join lateral generate_series(0, 120) as d
cross join lateral unnest(array[13]) as h
cross join lateral (select (date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + (h || ' hours')::interval) at time zone 'Asia/Kolkata' as at) t
cross join lateral (select abs(hashtext(i.id::text || '|' || d || '|' || h)) % 100 as r) rr
where i.id = 'b4140004-0000-0000-0000-000000000000'
  and t.at <= now() - interval '5 minutes'
  and (t.at at time zone 'Asia/Kolkata')::date >= i.start_date
  and (t.at at time zone 'Asia/Kolkata')::date <= coalesce(i.end_date, current_date)
on conflict (item_id, scheduled_for) do nothing;
insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
select '00000000-0000-0000-0000-000000000210', i.id, t.at,
  case
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 4 end) then 'missed'
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 4 end) + 1 then 'skipped'
    else 'taken' end,
  t.at + interval '10 minutes'
from public.prescription_items i
cross join lateral generate_series(0, 120) as d
cross join lateral unnest(array[21]) as h
cross join lateral (select (date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + (h || ' hours')::interval) at time zone 'Asia/Kolkata' as at) t
cross join lateral (select abs(hashtext(i.id::text || '|' || d || '|' || h)) % 100 as r) rr
where i.id = 'b4150001-0000-0000-0000-000000000000'
  and t.at <= now() - interval '5 minutes'
  and (t.at at time zone 'Asia/Kolkata')::date >= i.start_date
  and (t.at at time zone 'Asia/Kolkata')::date <= coalesce(i.end_date, current_date)
on conflict (item_id, scheduled_for) do nothing;
insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
select '00000000-0000-0000-0000-000000000210', i.id, t.at,
  case
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 6 end) then 'missed'
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 6 end) + 2 then 'skipped'
    else 'taken' end,
  t.at + interval '10 minutes'
from public.prescription_items i
cross join lateral generate_series(0, 120) as d
cross join lateral unnest(array[8,20]) as h
cross join lateral (select (date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + (h || ' hours')::interval) at time zone 'Asia/Kolkata' as at) t
cross join lateral (select abs(hashtext(i.id::text || '|' || d || '|' || h)) % 100 as r) rr
where i.id = 'b4150002-0000-0000-0000-000000000000'
  and t.at <= now() - interval '5 minutes'
  and (t.at at time zone 'Asia/Kolkata')::date >= i.start_date
  and (t.at at time zone 'Asia/Kolkata')::date <= coalesce(i.end_date, current_date)
on conflict (item_id, scheduled_for) do nothing;
insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
select '00000000-0000-0000-0000-000000000210', i.id, t.at,
  case
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 7 end) then 'missed'
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 7 end) + 2 then 'skipped'
    else 'taken' end,
  t.at + interval '10 minutes'
from public.prescription_items i
cross join lateral generate_series(0, 120) as d
cross join lateral unnest(array[9]) as h
cross join lateral (select (date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + (h || ' hours')::interval) at time zone 'Asia/Kolkata' as at) t
cross join lateral (select abs(hashtext(i.id::text || '|' || d || '|' || h)) % 100 as r) rr
where i.id = 'b4150003-0000-0000-0000-000000000000'
  and t.at <= now() - interval '5 minutes'
  and (t.at at time zone 'Asia/Kolkata')::date >= i.start_date
  and (t.at at time zone 'Asia/Kolkata')::date <= coalesce(i.end_date, current_date)
on conflict (item_id, scheduled_for) do nothing;
insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
select '00000000-0000-0000-0000-000000000211', i.id, t.at,
  case
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 12 end) then 'missed'
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 12 end) + 0 then 'skipped'
    else 'taken' end,
  t.at + interval '10 minutes'
from public.prescription_items i
cross join lateral generate_series(0, 120) as d
cross join lateral unnest(array[7]) as h
cross join lateral (select (date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + (h || ' hours')::interval) at time zone 'Asia/Kolkata' as at) t
cross join lateral (select abs(hashtext(i.id::text || '|' || d || '|' || h)) % 100 as r) rr
where i.id = 'b4160001-0000-0000-0000-000000000000'
  and t.at <= now() - interval '5 minutes'
  and (t.at at time zone 'Asia/Kolkata')::date >= i.start_date
  and (t.at at time zone 'Asia/Kolkata')::date <= coalesce(i.end_date, current_date)
on conflict (item_id, scheduled_for) do nothing;
insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
select '00000000-0000-0000-0000-000000000211', i.id, t.at,
  case
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 22 end) then 'missed'
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 22 end) + 4 then 'skipped'
    else 'taken' end,
  t.at + interval '10 minutes'
from public.prescription_items i
cross join lateral generate_series(0, 120) as d
cross join lateral unnest(array[13,21]) as h
cross join lateral (select (date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + (h || ' hours')::interval) at time zone 'Asia/Kolkata' as at) t
cross join lateral (select abs(hashtext(i.id::text || '|' || d || '|' || h)) % 100 as r) rr
where i.id = 'b4160002-0000-0000-0000-000000000000'
  and t.at <= now() - interval '5 minutes'
  and (t.at at time zone 'Asia/Kolkata')::date >= i.start_date
  and (t.at at time zone 'Asia/Kolkata')::date <= coalesce(i.end_date, current_date)
on conflict (item_id, scheduled_for) do nothing;
insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
select '00000000-0000-0000-0000-000000000211', i.id, t.at,
  case
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 15 end) then 'missed'
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 15 end) + 3 then 'skipped'
    else 'taken' end,
  t.at + interval '10 minutes'
from public.prescription_items i
cross join lateral generate_series(0, 120) as d
cross join lateral unnest(array[6]) as h
cross join lateral (select (date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + (h || ' hours')::interval) at time zone 'Asia/Kolkata' as at) t
cross join lateral (select abs(hashtext(i.id::text || '|' || d || '|' || h)) % 100 as r) rr
where i.id = 'b4160003-0000-0000-0000-000000000000'
  and t.at <= now() - interval '5 minutes'
  and (t.at at time zone 'Asia/Kolkata')::date >= i.start_date
  and (t.at at time zone 'Asia/Kolkata')::date <= coalesce(i.end_date, current_date)
on conflict (item_id, scheduled_for) do nothing;
insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
select '00000000-0000-0000-0000-000000000211', i.id, t.at,
  case
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 20 end) then 'missed'
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 20 end) + 3 then 'skipped'
    else 'taken' end,
  t.at + interval '10 minutes'
from public.prescription_items i
cross join lateral generate_series(0, 120) as d
cross join lateral unnest(array[9]) as h
cross join lateral (select (date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + (h || ' hours')::interval) at time zone 'Asia/Kolkata' as at) t
cross join lateral (select abs(hashtext(i.id::text || '|' || d || '|' || h)) % 100 as r) rr
where i.id = 'b4160004-0000-0000-0000-000000000000'
  and t.at <= now() - interval '5 minutes'
  and (t.at at time zone 'Asia/Kolkata')::date >= i.start_date
  and (t.at at time zone 'Asia/Kolkata')::date <= coalesce(i.end_date, current_date)
on conflict (item_id, scheduled_for) do nothing;
insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
select '00000000-0000-0000-0000-000000000211', i.id, t.at,
  case
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 25 end) then 'missed'
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 25 end) + 4 then 'skipped'
    else 'taken' end,
  t.at + interval '10 minutes'
from public.prescription_items i
cross join lateral generate_series(0, 120) as d
cross join lateral unnest(array[8]) as h
cross join lateral (select (date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + (h || ' hours')::interval) at time zone 'Asia/Kolkata' as at) t
cross join lateral (select abs(hashtext(i.id::text || '|' || d || '|' || h)) % 100 as r) rr
where i.id = 'b4160005-0000-0000-0000-000000000000'
  and t.at <= now() - interval '5 minutes'
  and (t.at at time zone 'Asia/Kolkata')::date >= i.start_date
  and (t.at at time zone 'Asia/Kolkata')::date <= coalesce(i.end_date, current_date)
on conflict (item_id, scheduled_for) do nothing;
insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
select '00000000-0000-0000-0000-000000000211', i.id, t.at,
  case
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 28 end) then 'missed'
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 28 end) + 5 then 'skipped'
    else 'taken' end,
  t.at + interval '10 minutes'
from public.prescription_items i
cross join lateral generate_series(0, 120) as d
cross join lateral unnest(array[21]) as h
cross join lateral (select (date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + (h || ' hours')::interval) at time zone 'Asia/Kolkata' as at) t
cross join lateral (select abs(hashtext(i.id::text || '|' || d || '|' || h)) % 100 as r) rr
where i.id = 'b4160006-0000-0000-0000-000000000000'
  and t.at <= now() - interval '5 minutes'
  and (t.at at time zone 'Asia/Kolkata')::date >= i.start_date
  and (t.at at time zone 'Asia/Kolkata')::date <= coalesce(i.end_date, current_date)
on conflict (item_id, scheduled_for) do nothing;
insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
select '00000000-0000-0000-0000-000000000212', i.id, t.at,
  case
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 3 end) then 'missed'
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 3 end) + 1 then 'skipped'
    else 'taken' end,
  t.at + interval '10 minutes'
from public.prescription_items i
cross join lateral generate_series(0, 120) as d
cross join lateral unnest(array[21]) as h
cross join lateral (select (date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + (h || ' hours')::interval) at time zone 'Asia/Kolkata' as at) t
cross join lateral (select abs(hashtext(i.id::text || '|' || d || '|' || h)) % 100 as r) rr
where i.id = 'b4170001-0000-0000-0000-000000000000'
  and t.at <= now() - interval '5 minutes'
  and (t.at at time zone 'Asia/Kolkata')::date >= i.start_date
  and (t.at at time zone 'Asia/Kolkata')::date <= coalesce(i.end_date, current_date)
on conflict (item_id, scheduled_for) do nothing;
insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
select '00000000-0000-0000-0000-000000000212', i.id, t.at,
  case
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 8 end) then 'missed'
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 8 end) + 3 then 'skipped'
    else 'taken' end,
  t.at + interval '10 minutes'
from public.prescription_items i
cross join lateral generate_series(0, 120) as d
cross join lateral unnest(array[8,13,20]) as h
cross join lateral (select (date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + (h || ' hours')::interval) at time zone 'Asia/Kolkata' as at) t
cross join lateral (select abs(hashtext(i.id::text || '|' || d || '|' || h)) % 100 as r) rr
where i.id = 'b4170002-0000-0000-0000-000000000000'
  and t.at <= now() - interval '5 minutes'
  and (t.at at time zone 'Asia/Kolkata')::date >= i.start_date
  and (t.at at time zone 'Asia/Kolkata')::date <= coalesce(i.end_date, current_date)
on conflict (item_id, scheduled_for) do nothing;
insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
select '00000000-0000-0000-0000-000000000213', i.id, t.at,
  case
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 9 end) then 'missed'
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 9 end) + 2 then 'skipped'
    else 'taken' end,
  t.at + interval '10 minutes'
from public.prescription_items i
cross join lateral generate_series(0, 120) as d
cross join lateral unnest(array[9,21]) as h
cross join lateral (select (date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + (h || ' hours')::interval) at time zone 'Asia/Kolkata' as at) t
cross join lateral (select abs(hashtext(i.id::text || '|' || d || '|' || h)) % 100 as r) rr
where i.id = 'b4180001-0000-0000-0000-000000000000'
  and t.at <= now() - interval '5 minutes'
  and (t.at at time zone 'Asia/Kolkata')::date >= i.start_date
  and (t.at at time zone 'Asia/Kolkata')::date <= coalesce(i.end_date, current_date)
on conflict (item_id, scheduled_for) do nothing;
insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
select '00000000-0000-0000-0000-000000000213', i.id, t.at,
  case
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 8 end) then 'missed'
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 8 end) + 2 then 'skipped'
    else 'taken' end,
  t.at + interval '10 minutes'
from public.prescription_items i
cross join lateral generate_series(0, 120) as d
cross join lateral unnest(array[13]) as h
cross join lateral (select (date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + (h || ' hours')::interval) at time zone 'Asia/Kolkata' as at) t
cross join lateral (select abs(hashtext(i.id::text || '|' || d || '|' || h)) % 100 as r) rr
where i.id = 'b4180002-0000-0000-0000-000000000000'
  and t.at <= now() - interval '5 minutes'
  and (t.at at time zone 'Asia/Kolkata')::date >= i.start_date
  and (t.at at time zone 'Asia/Kolkata')::date <= coalesce(i.end_date, current_date)
on conflict (item_id, scheduled_for) do nothing;
insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
select '00000000-0000-0000-0000-000000000213', i.id, t.at,
  case
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 12 end) then 'missed'
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 12 end) + 3 then 'skipped'
    else 'taken' end,
  t.at + interval '10 minutes'
from public.prescription_items i
cross join lateral generate_series(0, 120) as d
cross join lateral unnest(array[14]) as h
cross join lateral (select (date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + (h || ' hours')::interval) at time zone 'Asia/Kolkata' as at) t
cross join lateral (select abs(hashtext(i.id::text || '|' || d || '|' || h)) % 100 as r) rr
where i.id = 'b4180003-0000-0000-0000-000000000000'
  and t.at <= now() - interval '5 minutes'
  and (t.at at time zone 'Asia/Kolkata')::date >= i.start_date
  and (t.at at time zone 'Asia/Kolkata')::date <= coalesce(i.end_date, current_date)
on conflict (item_id, scheduled_for) do nothing;
insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
select '00000000-0000-0000-0000-000000000213', i.id, t.at,
  case
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 14 end) then 'missed'
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 14 end) + 3 then 'skipped'
    else 'taken' end,
  t.at + interval '10 minutes'
from public.prescription_items i
cross join lateral generate_series(0, 120) as d
cross join lateral unnest(array[17]) as h
cross join lateral (select (date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + (h || ' hours')::interval) at time zone 'Asia/Kolkata' as at) t
cross join lateral (select abs(hashtext(i.id::text || '|' || d || '|' || h)) % 100 as r) rr
where i.id = 'b4180004-0000-0000-0000-000000000000'
  and t.at <= now() - interval '5 minutes'
  and (t.at at time zone 'Asia/Kolkata')::date >= i.start_date
  and (t.at at time zone 'Asia/Kolkata')::date <= coalesce(i.end_date, current_date)
on conflict (item_id, scheduled_for) do nothing;
insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
select '00000000-0000-0000-0000-000000000214', i.id, t.at,
  case
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 3 end) then 'missed'
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 3 end) + 0 then 'skipped'
    else 'taken' end,
  t.at + interval '10 minutes'
from public.prescription_items i
cross join lateral generate_series(0, 120) as d
cross join lateral unnest(array[7]) as h
cross join lateral (select (date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + (h || ' hours')::interval) at time zone 'Asia/Kolkata' as at) t
cross join lateral (select abs(hashtext(i.id::text || '|' || d || '|' || h)) % 100 as r) rr
where i.id = 'b4190001-0000-0000-0000-000000000000'
  and t.at <= now() - interval '5 minutes'
  and (t.at at time zone 'Asia/Kolkata')::date >= i.start_date
  and (t.at at time zone 'Asia/Kolkata')::date <= coalesce(i.end_date, current_date)
on conflict (item_id, scheduled_for) do nothing;
insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
select '00000000-0000-0000-0000-000000000214', i.id, t.at,
  case
    when r < (case when d between 8 and 10 and 10 > 0 then 100 else 6 end) then 'missed'
    when r < (case when d between 8 and 10 and 10 > 0 then 100 else 6 end) + 0 then 'skipped'
    else 'taken' end,
  t.at + interval '10 minutes'
from public.prescription_items i
cross join lateral generate_series(0, 120) as d
cross join lateral unnest(array[7]) as h
cross join lateral (select (date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + (h || ' hours')::interval) at time zone 'Asia/Kolkata' as at) t
cross join lateral (select abs(hashtext(i.id::text || '|' || d || '|' || h)) % 100 as r) rr
where i.id = 'b4190002-0000-0000-0000-000000000000'
  and t.at <= now() - interval '5 minutes'
  and (t.at at time zone 'Asia/Kolkata')::date >= i.start_date
  and (t.at at time zone 'Asia/Kolkata')::date <= coalesce(i.end_date, current_date)
on conflict (item_id, scheduled_for) do nothing;
insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
select '00000000-0000-0000-0000-000000000214', i.id, t.at,
  case
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 5 end) then 'missed'
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 5 end) + 0 then 'skipped'
    else 'taken' end,
  t.at + interval '10 minutes'
from public.prescription_items i
cross join lateral generate_series(0, 120) as d
cross join lateral unnest(array[7]) as h
cross join lateral (select (date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + (h || ' hours')::interval) at time zone 'Asia/Kolkata' as at) t
cross join lateral (select abs(hashtext(i.id::text || '|' || d || '|' || h)) % 100 as r) rr
where i.id = 'b4190003-0000-0000-0000-000000000000'
  and t.at <= now() - interval '5 minutes'
  and (t.at at time zone 'Asia/Kolkata')::date >= i.start_date
  and (t.at at time zone 'Asia/Kolkata')::date <= coalesce(i.end_date, current_date)
on conflict (item_id, scheduled_for) do nothing;
insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
select '00000000-0000-0000-0000-000000000215', i.id, t.at,
  case
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 4 end) then 'missed'
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 4 end) + 1 then 'skipped'
    else 'taken' end,
  t.at + interval '10 minutes'
from public.prescription_items i
cross join lateral generate_series(0, 120) as d
cross join lateral unnest(array[8,20]) as h
cross join lateral (select (date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + (h || ' hours')::interval) at time zone 'Asia/Kolkata' as at) t
cross join lateral (select abs(hashtext(i.id::text || '|' || d || '|' || h)) % 100 as r) rr
where i.id = 'b4200001-0000-0000-0000-000000000000'
  and t.at <= now() - interval '5 minutes'
  and (t.at at time zone 'Asia/Kolkata')::date >= i.start_date
  and (t.at at time zone 'Asia/Kolkata')::date <= coalesce(i.end_date, current_date)
on conflict (item_id, scheduled_for) do nothing;
insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
select '00000000-0000-0000-0000-000000000215', i.id, t.at,
  case
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 12 end) then 'missed'
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 12 end) + 3 then 'skipped'
    else 'taken' end,
  t.at + interval '10 minutes'
from public.prescription_items i
cross join lateral generate_series(0, 120) as d
cross join lateral unnest(array[13]) as h
cross join lateral (select (date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + (h || ' hours')::interval) at time zone 'Asia/Kolkata' as at) t
cross join lateral (select abs(hashtext(i.id::text || '|' || d || '|' || h)) % 100 as r) rr
where i.id = 'b4200002-0000-0000-0000-000000000000'
  and t.at <= now() - interval '5 minutes'
  and (t.at at time zone 'Asia/Kolkata')::date >= i.start_date
  and (t.at at time zone 'Asia/Kolkata')::date <= coalesce(i.end_date, current_date)
on conflict (item_id, scheduled_for) do nothing;
insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
select '00000000-0000-0000-0000-000000000001', i.id, t.at,
  case
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 10 end) then 'missed'
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 10 end) + 2 then 'skipped'
    else 'taken' end,
  t.at + interval '10 minutes'
from public.prescription_items i
cross join lateral generate_series(0, 120) as d
cross join lateral unnest(array[9]) as h
cross join lateral (select (date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + (h || ' hours')::interval) at time zone 'Asia/Kolkata' as at) t
cross join lateral (select abs(hashtext(i.id::text || '|' || d || '|' || h)) % 100 as r) rr
where i.id = 'b4010091-0000-0000-0000-000000000000'
  and t.at <= now() - interval '5 minutes'
  and (t.at at time zone 'Asia/Kolkata')::date >= i.start_date
  and (t.at at time zone 'Asia/Kolkata')::date <= coalesce(i.end_date, current_date)
on conflict (item_id, scheduled_for) do nothing;
insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
select '00000000-0000-0000-0000-000000000202', i.id, t.at,
  case
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 0 end) then 'missed'
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 0 end) + 0 then 'skipped'
    else 'taken' end,
  t.at + interval '10 minutes'
from public.prescription_items i
cross join lateral generate_series(0, 120) as d
cross join lateral unnest(array[8]) as h
cross join lateral (select (date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + (h || ' hours')::interval) at time zone 'Asia/Kolkata' as at) t
cross join lateral (select abs(hashtext(i.id::text || '|' || d || '|' || h)) % 100 as r) rr
where i.id = 'b4030091-0000-0000-0000-000000000000'
  and t.at <= now() - interval '5 minutes'
  and (t.at at time zone 'Asia/Kolkata')::date >= i.start_date
  and (t.at at time zone 'Asia/Kolkata')::date <= coalesce(i.end_date, current_date)
on conflict (item_id, scheduled_for) do nothing;
insert into public.dose_logs (patient_id, item_id, scheduled_for, status, logged_at)
select '00000000-0000-0000-0000-000000000205', i.id, t.at,
  case
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 4 end) then 'missed'
    when r < (case when d between 0 and 0 and 0 > 0 then 0 else 4 end) + 0 then 'skipped'
    else 'taken' end,
  t.at + interval '10 minutes'
from public.prescription_items i
cross join lateral generate_series(0, 120) as d
cross join lateral unnest(array[14]) as h
cross join lateral (select (date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) + (h || ' hours')::interval) at time zone 'Asia/Kolkata' as at) t
cross join lateral (select abs(hashtext(i.id::text || '|' || d || '|' || h)) % 100 as r) rr
where i.id = 'b4060091-0000-0000-0000-000000000000'
  and t.at <= now() - interval '5 minutes'
  and (t.at at time zone 'Asia/Kolkata')::date >= i.start_date
  and (t.at at time zone 'Asia/Kolkata')::date <= coalesce(i.end_date, current_date)
on conflict (item_id, scheduled_for) do nothing;

delete from public.dose_logs d using public.prescription_items i
  where d.item_id = i.id and i.id in ('b4160001-0000-0000-0000-000000000000', 'b4120003-0000-0000-0000-000000000000', 'b4140003-0000-0000-0000-000000000000')
    and (case when i.id = 'b4160001-0000-0000-0000-000000000000' then extract(isodow from d.scheduled_for at time zone 'Asia/Kolkata') <> 1 else extract(isodow from d.scheduled_for at time zone 'Asia/Kolkata') <> 7 end);

-- Refill cards: a few medicines run out in a few days (Arjun's metformin, Harpreet's warfarin, Lakshmi's thyroid tablet)
update public.prescription_items i
  set quantity_total = 3 + (select count(*) from public.dose_logs l where l.item_id = i.id and l.status = 'taken' and l.scheduled_for > now() - interval '30 days')
  where i.id in ('b4110001-0000-0000-0000-000000000000', 'b4150001-0000-0000-0000-000000000000', 'b4160003-0000-0000-0000-000000000000');

-- Meals for Arjun, Priya, Fatima and Deepak (three days each, for the meal log)
delete from public.meal_logs where patient_id in ('00000000-0000-0000-0000-000000000206', '00000000-0000-0000-0000-000000000209', '00000000-0000-0000-0000-000000000213', '00000000-0000-0000-0000-000000000214');
do $$
declare d int; day_start timestamptz;
begin
  for d in 0..2 loop
    day_start := date_trunc('day', (now() at time zone 'Asia/Kolkata') - (d || ' days')::interval) at time zone 'Asia/Kolkata';
    insert into public.meal_logs (patient_id, meal, description, calories, logged_at) values
      ('00000000-0000-0000-0000-000000000206', 'breakfast', 'Vegetable oats, a boiled egg', 310, day_start + interval '8 hours'),
      ('00000000-0000-0000-0000-000000000206', 'lunch', '2 rotis, dal, mixed vegetables, salad', 520, day_start + interval '13 hours 15 minutes'),
      ('00000000-0000-0000-0000-000000000206', 'snack', 'Roasted chana, green tea', 140, day_start + interval '17 hours'),
      ('00000000-0000-0000-0000-000000000206', 'dinner', 'Vegetable soup, 1 roti, paneer sabzi', 430, day_start + interval '20 hours 15 minutes'),
      ('00000000-0000-0000-0000-000000000209', 'breakfast', 'Besan chilla with mint chutney', 280, day_start + interval '8 hours 30 minutes'),
      ('00000000-0000-0000-0000-000000000209', 'lunch', '2 rotis, rajma, salad, curd', 540, day_start + interval '13 hours 30 minutes'),
      ('00000000-0000-0000-0000-000000000209', 'dinner', 'Vegetable pulao, raita', 460, day_start + interval '20 hours 30 minutes'),
      ('00000000-0000-0000-0000-000000000213', 'breakfast', 'Vegetable daliya, a glass of milk', 300, day_start + interval '8 hours'),
      ('00000000-0000-0000-0000-000000000213', 'lunch', '2 rotis, dal, palak sabzi, curd', 520, day_start + interval '13 hours'),
      ('00000000-0000-0000-0000-000000000213', 'snack', 'A handful of almonds, one guava', 190, day_start + interval '17 hours'),
      ('00000000-0000-0000-0000-000000000213', 'dinner', 'Khichdi, a bowl of vegetables', 440, day_start + interval '20 hours'),
      ('00000000-0000-0000-0000-000000000214', 'breakfast', 'Daliya with milk, a boiled egg', 340, day_start + interval '8 hours 15 minutes'),
      ('00000000-0000-0000-0000-000000000214', 'lunch', '3 rotis, dal, paneer bhurji, salad', 640, day_start + interval '13 hours'),
      ('00000000-0000-0000-0000-000000000214', 'snack', 'Roasted chana, a banana', 220, day_start + interval '17 hours'),
      ('00000000-0000-0000-0000-000000000214', 'dinner', 'Khichdi with curd, an egg curry', 560, day_start + interval '20 hours');
  end loop;
end $$;

-- Care plans (written by hand for the demo; every source is a real health page)
insert into public.care_plans (id, patient_id, condition_id, status, language, plan_json, reviewed_by, reviewed_at)
values
(
  'c8110001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000206', 'c1110001-0000-0000-0000-000000000000', 'approved', 'en',
  $plan$
{
  "condition": "Type 2 Diabetes",
  "summary": "In type 2 diabetes the body does not use insulin well, so sugar stays high in the blood. Medicines, healthy food, regular activity and regular tests keep it in a safer range and protect the eyes, kidneys, nerves and heart.",
  "do": [
    "Take your diabetes and blood pressure medicines every day at the times shown in the app.",
    "Walk or exercise for about 30 minutes on most days, as your doctor allows.",
    "Check your sugar as your doctor advised and write the readings down.",
    "Have your HbA1c, kidney tests and eye check on the dates your doctor gives.",
    "Look at your feet every day for cuts, blisters or sores."
  ],
  "dont": [
    "Do not stop or change a medicine on your own because the readings look good.",
    "Do not skip meals if you take medicines that can lower the sugar too much."
  ],
  "diet": {
    "eat_more": [
      "Vegetables, especially leafy ones",
      "Whole grains such as whole wheat roti, oats and millets",
      "Dal, beans, sprouts and curd"
    ],
    "limit": [
      "Sweets, sugary drinks and fruit juice",
      "White rice and white bread in large amounts",
      "Fried and very salty snacks"
    ],
    "sample_day": [
      {
        "meal": "breakfast",
        "items": [
          "Vegetable oats",
          "A boiled egg or a glass of buttermilk"
        ]
      },
      {
        "meal": "lunch",
        "items": [
          "2 rotis",
          "Dal",
          "A large bowl of vegetables",
          "Salad"
        ]
      },
      {
        "meal": "snack",
        "items": [
          "Roasted chana"
        ]
      },
      {
        "meal": "dinner",
        "items": [
          "Vegetable soup",
          "1 roti",
          "Paneer or tofu sabzi"
        ]
      }
    ]
  },
  "red_flags": [
    "Very high sugar with vomiting, deep fast breathing, or confusion: go to the nearest hospital or call 108.",
    "A sugar reading that is very low with sweating, shaking or fainting: take sugar or juice and get help.",
    "A foot sore or wound that does not heal: see a doctor soon."
  ],
  "follow_up_tests": [
    {
      "test": "HbA1c",
      "every_days": 90
    },
    {
      "test": "Kidney function (creatinine)",
      "every_days": 180
    },
    {
      "test": "Eye check",
      "every_days": 365
    }
  ],
  "sources": [
    {
      "title": "NHS: Type 2 diabetes",
      "url": "https://www.nhs.uk/conditions/type-2-diabetes/"
    },
    {
      "title": "MedlinePlus: Diabetes",
      "url": "https://medlineplus.gov/diabetes.html"
    }
  ],
  "language": "en"
}
  $plan$::jsonb,
  '00000000-0000-0000-0000-000000000003', now() - interval '58 days'
),
(
  'c8170001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000212', 'c1170001-0000-0000-0000-000000000000', 'approved', 'en',
  $plan$
{
  "condition": "Type 1 Diabetes",
  "summary": "In type 1 diabetes the body makes no insulin, so insulin must be given every day. Checking the sugar, matching insulin to food and activity, and knowing what to do when the sugar is too low or too high keep a child safe and well.",
  "do": [
    "Give the insulin exactly as the doctor taught you, at the times shown in the app.",
    "Check the sugar before meals and at bedtime, and write the readings down.",
    "Keep a fast sugar source (glucose tablets or juice) with the child at school and at play.",
    "Keep the emergency glucagon kit at home and show other family members how to use it.",
    "Keep the follow-up visits and the HbA1c tests."
  ],
  "dont": [
    "Do not skip the insulin, even when the child is ill or not eating: call the doctor for advice.",
    "Do not leave the child alone for long after a low sugar."
  ],
  "diet": {
    "eat_more": [
      "Regular meals with vegetables",
      "Whole grains, dal and curd",
      "Fruit with meals, not as large separate portions"
    ],
    "limit": [
      "Sugary drinks and sweets (except to treat a low sugar)",
      "Large portions of white rice and bread"
    ],
    "sample_day": [
      {
        "meal": "breakfast",
        "items": [
          "Vegetable poha",
          "A glass of milk"
        ]
      },
      {
        "meal": "lunch",
        "items": [
          "2 rotis",
          "Dal",
          "Vegetables",
          "Curd"
        ]
      },
      {
        "meal": "snack",
        "items": [
          "Roasted chana or a handful of nuts"
        ]
      },
      {
        "meal": "dinner",
        "items": [
          "Khichdi with vegetables",
          "Salad"
        ]
      }
    ]
  },
  "red_flags": [
    "Not able to swallow, a fit, or loss of consciousness with a low sugar: use the glucagon kit and call 108.",
    "Vomiting, stomach pain, fast deep breathing or unusual sleepiness with a high sugar: go to the nearest hospital now.",
    "Repeated low sugar readings in a week: call the doctor the same day."
  ],
  "follow_up_tests": [
    {
      "test": "HbA1c",
      "every_days": 90
    },
    {
      "test": "Thyroid (TSH)",
      "every_days": 365
    }
  ],
  "sources": [
    {
      "title": "NHS: Type 1 diabetes",
      "url": "https://www.nhs.uk/conditions/type-1-diabetes/"
    },
    {
      "title": "MedlinePlus: Diabetes",
      "url": "https://medlineplus.gov/diabetes.html"
    }
  ],
  "language": "en"
}
  $plan$::jsonb,
  '00000000-0000-0000-0000-000000000003', now() - interval '98 days'
),
(
  'c8190001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000214', 'c1190001-0000-0000-0000-000000000000', 'approved', 'en',
  $plan$
{
  "condition": "Pulmonary tuberculosis",
  "summary": "Tuberculosis of the lungs is cured by taking every dose of the medicines for the full 6 months, even after you feel well. Stopping early lets the germ come back and become harder to treat.",
  "do": [
    "Take your tuberculosis medicines every morning at the time shown in the app, and do not miss a dose.",
    "Cover your mouth when you cough, keep the room airy, and sleep in a separate room in the first weeks if you can.",
    "Eat protein-rich food: dal, eggs, milk, curd, sprouts.",
    "Go for the monthly review and the liver test your doctor asks for."
  ],
  "dont": [
    "Do not stop or skip medicines when you feel better.",
    "Do not drink alcohol during the treatment."
  ],
  "diet": {
    "eat_more": [
      "Dal, eggs, milk, curd and paneer",
      "Fruit and vegetables",
      "Nuts and jaggery with chana"
    ],
    "limit": [
      "Alcohol",
      "Very oily food"
    ],
    "sample_day": [
      {
        "meal": "breakfast",
        "items": [
          "Vegetable daliya",
          "A boiled egg",
          "Milk"
        ]
      },
      {
        "meal": "lunch",
        "items": [
          "2 rotis",
          "Dal",
          "Vegetables",
          "Curd"
        ]
      },
      {
        "meal": "snack",
        "items": [
          "Roasted chana",
          "A banana"
        ]
      },
      {
        "meal": "dinner",
        "items": [
          "Khichdi",
          "Paneer bhurji",
          "Salad"
        ]
      }
    ]
  },
  "red_flags": [
    "Yellow eyes or skin, dark urine, or ongoing vomiting: stop and see the doctor the same day.",
    "Coughing up a lot of blood or severe breathlessness: call 108.",
    "Changes in vision or numbness in the hands and feet: tell your doctor soon."
  ],
  "follow_up_tests": [
    {
      "test": "Liver function (SGPT)",
      "every_days": 30
    },
    {
      "test": "Chest X-ray",
      "every_days": 60
    }
  ],
  "sources": [
    {
      "title": "NHS: Tuberculosis (TB)",
      "url": "https://www.nhs.uk/conditions/tuberculosis-tb/"
    },
    {
      "title": "MedlinePlus: Tuberculosis",
      "url": "https://medlineplus.gov/tuberculosis.html"
    }
  ],
  "language": "en"
}
  $plan$::jsonb,
  '00000000-0000-0000-0000-000000000002', now() - interval '18 days'
),
(
  'c8120001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000207', 'c1120001-0000-0000-0000-000000000000', 'approved', 'en',
  $plan$
{
  "condition": "Beta-thalassemia major",
  "summary": "In thalassemia the body makes too little healthy haemoglobin, so regular blood transfusions are needed. Because transfusions add iron, a daily iron-removal medicine and regular tests protect the heart and liver.",
  "do": [
    "Keep every transfusion appointment and tell the hospital early if you cannot find the right blood group.",
    "Take the iron-removal medicine every day at the time shown in the app.",
    "Keep your ferritin, liver and heart checks on schedule.",
    "Eat a balanced diet with folate-rich foods such as green vegetables and pulses."
  ],
  "dont": [
    "Do not take iron tablets or iron-rich supplements unless your doctor asks you to.",
    "Do not skip the iron-removal medicine."
  ],
  "diet": {
    "eat_more": [
      "Leafy vegetables and pulses (folate)",
      "Milk, curd and calcium-rich foods",
      "Plenty of water"
    ],
    "limit": [
      "Iron-fortified foods and iron supplements",
      "Large amounts of red meat and liver (very rich in iron): ask your doctor how much is fine"
    ],
    "sample_day": [
      {
        "meal": "breakfast",
        "items": [
          "Vegetable upma",
          "A glass of milk"
        ]
      },
      {
        "meal": "lunch",
        "items": [
          "2 rotis",
          "Dal",
          "Palak sabzi",
          "Curd"
        ]
      },
      {
        "meal": "dinner",
        "items": [
          "Khichdi",
          "Vegetables"
        ]
      }
    ]
  },
  "red_flags": [
    "Fever with shivering during or after a transfusion: tell the hospital at once.",
    "Breathlessness, swelling of the legs, or a very fast heartbeat: call 108.",
    "A fever that does not settle within a day: see a doctor the same day."
  ],
  "follow_up_tests": [
    {
      "test": "Ferritin",
      "every_days": 90
    },
    {
      "test": "Liver function (SGPT)",
      "every_days": 90
    }
  ],
  "sources": [
    {
      "title": "NHS: Thalassaemia",
      "url": "https://www.nhs.uk/conditions/thalassaemia/"
    },
    {
      "title": "MedlinePlus: Thalassemia",
      "url": "https://medlineplus.gov/thalassemia.html"
    }
  ],
  "language": "en"
}
  $plan$::jsonb,
  '00000000-0000-0000-0000-000000000002', now() - interval '20 days'
)
on conflict (id) do nothing;

-- Caregivers: each looks after one patient (the caregiver password applies)
insert into public.care_links (patient_id, caregiver_id, relation, status)
values
  ('00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000216', 'Son', 'active'),
  ('00000000-0000-0000-0000-000000000207', '00000000-0000-0000-0000-000000000217', 'Mother', 'active'),
  ('00000000-0000-0000-0000-000000000212', '00000000-0000-0000-0000-000000000218', 'Mother', 'active')
on conflict (patient_id, caregiver_id) do update set status = 'active', relation = excluded.relation;

-- Consent: the demo patients accepted the current text, so the app does not ask again
insert into public.consents (user_id, version)
select id, '2026-10-23' from public.profiles where id in ('00000000-0000-0000-0000-000000000206', '00000000-0000-0000-0000-000000000207', '00000000-0000-0000-0000-000000000208', '00000000-0000-0000-0000-000000000209', '00000000-0000-0000-0000-000000000210', '00000000-0000-0000-0000-000000000211', '00000000-0000-0000-0000-000000000212', '00000000-0000-0000-0000-000000000213', '00000000-0000-0000-0000-000000000214', '00000000-0000-0000-0000-000000000215', '00000000-0000-0000-0000-000000000216', '00000000-0000-0000-0000-000000000217', '00000000-0000-0000-0000-000000000218')
on conflict (user_id, version) do nothing;

-- Share links: an active 30-day history link for Arjun and Harpreet, to try the shared record page
delete from public.share_links where patient_id in ('00000000-0000-0000-0000-000000000206', '00000000-0000-0000-0000-000000000210');
insert into public.share_links (patient_id, kind, expires_at)
values ('00000000-0000-0000-0000-000000000206', 'timeline', now() + interval '29 days'), ('00000000-0000-0000-0000-000000000210', 'timeline', now() + interval '29 days');

-- 16. Blood requests for the RapidBlood tracker (#235): Shabnam (B-, a transfusion every 3 weeks)
-- is searching for the one due now and received the last one; Fatima (A-, pregnant) has been in
-- touch with a blood bank. All names and phone numbers are the fictional demo ones, as everywhere.
delete from public.blood_requests where patient_id in ('00000000-0000-0000-0000-000000000207', '00000000-0000-0000-0000-000000000213');
insert into public.blood_requests (patient_id, blood_group, component, units, hospital_name, city, contact_name, contact_phone, status, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000207', 'B-', 'red_cells', 2, 'Demo City Hospital', 'Ghaziabad', 'Rukhsana Khan', '+91 00000 00411', 'searching', now() - interval '1 day', now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000000207', 'B-', 'red_cells', 2, 'Demo City Hospital', 'Ghaziabad', 'Rukhsana Khan', '+91 00000 00411', 'received', now() - interval '21 days', now() - interval '20 days'),
  ('00000000-0000-0000-0000-000000000213', 'A-', 'red_cells', 1, 'Demo General Hospital', 'Noida', 'Imran Sheikh', '+91 00000 00412', 'contacted', now() - interval '2 days', now() - interval '1 day');
