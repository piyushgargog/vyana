-- 0001_schema.sql
-- Vyana (व्यान) database schema: plan sections 5.1 and 5.6 (scope v2)
-- Owner: Vaibhav Parmar

-- Hosted Supabase installs pgcrypto in the "extensions" schema.
create extension if not exists pgcrypto with schema extensions;

-- ============================================================================
-- 1. USERS
-- ============================================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'patient' check (role in ('patient', 'doctor', 'admin')),
  full_name text,
  phone text,
  dob date,
  gender text check (gender in ('male', 'female', 'other')),
  blood_group text,
  allergies text[] not null default '{}',
  city text,
  preferred_language text not null default 'en' check (preferred_language in ('en', 'hi', 'hinglish')),
  onboarded boolean not null default false,
  created_at timestamptz not null default now()
);

-- After a sign-up, create the profile. Clients control raw_user_meta_data, so only
-- 'patient' and 'doctor' are accepted; an admin is created by the seed or the service role.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    case when new.raw_user_meta_data->>'role' = 'doctor' then 'doctor' else 'patient' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- 2. HOSPITALS AND DEPARTMENTS (ORS-style booking)
-- ============================================================================

create table public.hospitals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('government', 'private')),
  address text,
  city text not null default 'Delhi',
  lat double precision,
  lng double precision,
  phone text,
  website text,
  ors_enabled boolean not null default false,
  pmjay_empanelled boolean,
  opd_info jsonb,
  opd_info_fetched_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(id) on delete cascade,
  name text not null,
  opd_days int[] not null default '{1,2,3,4,5,6}',
  opd_start time not null default '09:00',
  opd_end time not null default '13:00',
  daily_token_limit int not null default 100,
  created_at timestamptz not null default now(),
  unique (hospital_id, name)
);

-- ============================================================================
-- 3. DOCTORS, CONTACTS, CONDITIONS
-- ============================================================================

create table public.doctors (
  id uuid primary key references public.profiles(id) on delete cascade,
  specialization text not null,
  reg_no text not null,
  state_council text not null,
  year_of_registration int,
  clinic_name text,
  clinic_address text,
  consultation_fee int,
  availability jsonb not null default '{"days":[1,2,3,4,5,6],"start":"10:00","end":"17:00","slot_minutes":30}',
  verification_status text not null default 'pending' check (verification_status in ('pending', 'verified', 'failed')),
  verification_json jsonb,
  verified_at timestamptz,
  hospital_id uuid references public.hospitals(id),
  department_id uuid references public.departments(id),
  created_at timestamptz not null default now()
);
create index idx_doctors_department_id on public.doctors(department_id);

create table public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  phone text not null,
  relation text,
  created_at timestamptz not null default now()
);
create index idx_emergency_contacts_patient_id on public.emergency_contacts(patient_id);

-- ============================================================================
-- 4. CARE: APPOINTMENTS, PRESCRIPTIONS, DOSES
-- ============================================================================

-- Department-level booking like ORS: the token number is the queue position,
-- the doctor and the time slot are optional. Rows are created only by book_appointment().
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  doctor_id uuid references public.doctors(id),
  hospital_id uuid not null references public.hospitals(id),
  department_id uuid not null references public.departments(id),
  appointment_date date not null,
  token_no int not null,
  scheduled_at timestamptz,
  status text not null default 'requested' check (status in ('requested', 'confirmed', 'completed', 'cancelled')),
  reason text,
  doctor_notes text,
  created_at timestamptz not null default now(),
  unique (department_id, appointment_date, token_no)
);
create index idx_appointments_patient_id on public.appointments(patient_id);
create index idx_appointments_doctor_id on public.appointments(doctor_id);

create table public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  doctor_id uuid references public.doctors(id),
  appointment_id uuid references public.appointments(id),
  source text not null check (source in ('upload', 'doctor')),
  file_path text,
  doctor_name text,
  diagnosis text,
  notes text,
  issued_on date not null default current_date,
  created_at timestamptz not null default now()
);
create index idx_prescriptions_patient_id on public.prescriptions(patient_id);

create table public.conditions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  diagnosed_on date,
  notes text,
  active boolean not null default true,
  source text not null default 'patient' check (source in ('patient', 'doctor')),
  prescription_id uuid references public.prescriptions(id),
  diagnosed_by uuid references public.doctors(id),
  created_at timestamptz not null default now()
);
create index idx_conditions_patient_id on public.conditions(patient_id);

create table public.prescription_items (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references public.prescriptions(id) on delete cascade,
  patient_id uuid not null references public.profiles(id) on delete cascade,
  medicine_name text not null,
  strength text,
  form text not null default 'tablet' check (form in ('tablet', 'capsule', 'syrup', 'injection', 'drops', 'inhaler', 'other')),
  dose text, -- e.g. '1 tablet', '5 ml'
  frequency text not null check (frequency in ('OD', 'BD', 'TDS', 'QID', 'HS', 'SOS', 'custom')),
  times text[] not null default '{}', -- 'HH:MM' 24h, e.g. {'09:00','21:00'}
  with_food text not null default 'any' check (with_food in ('before', 'after', 'any')),
  duration_days int,
  start_date date not null default current_date,
  end_date date,
  instructions text,
  active boolean not null default true,
  quantity_total numeric, -- units dispensed (e.g. 30 tablets, 100 ml)
  refill_alert_days int not null default 3,
  created_at timestamptz not null default now()
);
create index idx_prescription_items_prescription_id on public.prescription_items(prescription_id);
create index idx_prescription_items_patient_id on public.prescription_items(patient_id);

create table public.dose_logs (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  item_id uuid not null references public.prescription_items(id) on delete cascade,
  scheduled_for timestamptz not null,
  status text not null check (status in ('taken', 'missed', 'skipped')),
  logged_at timestamptz not null default now(),
  unique (item_id, scheduled_for)
);
create index idx_dose_logs_patient_id on public.dose_logs(patient_id);

-- ============================================================================
-- 5. LABS AND HEALTH TRACKING
-- ============================================================================

create table public.lab_reports (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  file_path text not null,
  lab_name text,
  report_date date,
  status text not null default 'processing' check (status in ('processing', 'done', 'failed')),
  summary text,
  extracted_json jsonb,
  created_at timestamptz not null default now()
);
create index idx_lab_reports_patient_id on public.lab_reports(patient_id);

create table public.lab_values (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.lab_reports(id) on delete cascade,
  patient_id uuid not null references public.profiles(id) on delete cascade,
  test_name text not null,
  value numeric,
  value_text text,
  unit text,
  ref_low numeric,
  ref_high numeric,
  flag text not null default 'unknown' check (flag in ('low', 'normal', 'high', 'unknown')),
  measured_on date,
  created_at timestamptz not null default now()
);
create index idx_lab_values_report_id on public.lab_values(report_id);
create index idx_lab_values_patient_id on public.lab_values(patient_id);

create table public.vitals (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('bp', 'sugar_fasting', 'sugar_random', 'weight', 'heart_rate', 'spo2', 'temperature')),
  value numeric not null,
  value2 numeric, -- bp: value = systolic, value2 = diastolic
  unit text not null,
  measured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index idx_vitals_patient_id on public.vitals(patient_id);

-- meal_logs stays (F16 is T3, no UI until then). nutrition_plans was dropped in v2 (see care_plans).
create table public.meal_logs (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  meal text not null check (meal in ('breakfast', 'lunch', 'dinner', 'snack')),
  description text not null,
  calories int,
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index idx_meal_logs_patient_id on public.meal_logs(patient_id);

-- ============================================================================
-- 6. CARE PLANS
-- ============================================================================

create table public.care_plans (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  condition_id uuid not null references public.conditions(id) on delete cascade,
  status text not null check (status in ('draft', 'approved', 'patient_generated')),
  language text not null default 'en' check (language in ('en', 'hi', 'hinglish')),
  plan_json jsonb not null, -- CarePlan (plan 6.5)
  reviewed_by uuid references public.doctors(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_care_plans_patient_id on public.care_plans(patient_id);

-- ============================================================================
-- 7. CAREGIVER MODE
-- ============================================================================

create table public.care_invites (
  code text primary key,
  patient_id uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null,
  used_by uuid references public.profiles(id),
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_care_invites_patient_id on public.care_invites(patient_id);

create table public.care_links (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  caregiver_id uuid not null references public.profiles(id) on delete cascade,
  relation text,
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  unique (patient_id, caregiver_id)
);
create index idx_care_links_caregiver_id on public.care_links(caregiver_id);

-- One alert per missed dose, so the 15 minute cron never repeats itself.
create table public.missed_dose_alerts (
  item_id uuid not null references public.prescription_items(id) on delete cascade,
  scheduled_for timestamptz not null,
  sent_at timestamptz not null default now(),
  primary key (item_id, scheduled_for)
);

-- Failed invite-code guesses, for rate limiting. Only accept_care_invite() writes it.
create table public.care_invite_attempts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  attempted_at timestamptz not null default now()
);
create index idx_care_invite_attempts_user on public.care_invite_attempts(user_id, attempted_at);

-- ============================================================================
-- 8. SHARING, INTERACTIONS, PRIVACY, AI TRACEABILITY
-- ============================================================================

create table public.share_links (
  token text primary key default encode(extensions.gen_random_bytes(24), 'hex'),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('medical_id', 'timeline')),
  expires_at timestamptz not null,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_share_links_patient_id on public.share_links(patient_id);

-- Interaction results cache (per patient + medicine set).
create table public.interaction_checks (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  medicines_key text not null,
  result_json jsonb not null,
  created_at timestamptz not null default now(),
  unique (patient_id, medicines_key)
);

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  version text not null,
  accepted_at timestamptz not null default now(),
  unique (user_id, version)
);

-- AI traceability (plan 2A rule 8): the server inserts, the user reads their own runs,
-- "Report a mistake" sets status to reported.
create table public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  feature text not null,
  model text,
  prompt_version text,
  input_ref text,
  output_json jsonb,
  sources jsonb,
  status text not null default 'ok' check (status in ('ok', 'needs_review', 'rejected', 'reported')),
  created_at timestamptz not null default now()
);
create index idx_ai_runs_user_id on public.ai_runs(user_id);

-- ============================================================================
-- 9. ASSISTANT AND EMERGENCY
-- ============================================================================

create table public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text,
  created_at timestamptz not null default now()
);
create index idx_chat_sessions_user_id on public.chat_sessions(user_id);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  parts jsonb not null,
  created_at timestamptz not null default now()
);
create index idx_chat_messages_session_id on public.chat_messages(session_id);

create table public.emergency_requests (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  area text,
  note text,
  status text not null default 'requested' check (status in ('requested', 'dispatched', 'arriving', 'completed', 'cancelled')),
  eta_minutes int,
  hospitals_json jsonb,
  created_at timestamptz not null default now()
);
create index idx_emergency_requests_patient_id on public.emergency_requests(patient_id);

-- ============================================================================
-- 10. WEB DATA AND SYSTEM TABLES (written only by the server)
-- ============================================================================

create table public.price_quotes (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('medicine', 'lab_test')),
  query text not null,
  source text not null,
  product_name text not null,
  pack_size text,
  price numeric,
  mrp numeric,
  in_stock boolean,
  product_url text,
  fetched_at timestamptz not null default now()
);
create index idx_price_quotes_query on public.price_quotes(query);

create table public.drug_alerts (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  medicine_name text not null,
  title text not null,
  url text not null,
  snippet text,
  seen boolean not null default false,
  created_at timestamptz not null default now(),
  unique (patient_id, url)
);

create table public.push_tokens (
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios', 'android', 'web')),
  updated_at timestamptz not null default now(),
  primary key (user_id, token)
);

create table public.web_cache (
  key text primary key,
  kind text not null,
  payload jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table public.tinyfish_monitors (
  id uuid primary key default gen_random_uuid(),
  tinyfish_id text not null unique,
  query text not null,
  created_at timestamptz not null default now()
);
