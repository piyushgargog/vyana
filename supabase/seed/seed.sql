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
select id, '2026-10-11' from public.profiles
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
select id, '2026-10-11' from public.profiles
where id in ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000205')
on conflict (user_id, version) do nothing;
