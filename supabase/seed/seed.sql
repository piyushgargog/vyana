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
