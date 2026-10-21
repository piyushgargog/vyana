-- supabase/tests/database/schema.test.sql
-- Structural checks for the schema in plan sections 5.1 and 5.6. Run with: supabase test db
-- Owner: Vaibhav Parmar

begin;
create extension if not exists pgtap with schema extensions;

select plan(10);

select is(
  (select count(*)::int from unnest(array[
    'profiles', 'doctors', 'hospitals', 'departments', 'emergency_contacts', 'conditions', 'appointments',
    'prescriptions', 'prescription_items', 'dose_logs', 'lab_reports', 'lab_values', 'vitals', 'meal_logs',
    'care_plans', 'care_invites', 'care_links', 'missed_dose_alerts', 'share_links', 'interaction_checks',
    'consents', 'ai_runs', 'chat_sessions', 'chat_messages', 'emergency_requests', 'price_quotes',
    'drug_alerts', 'push_tokens', 'web_cache', 'tinyfish_monitors', 'blood_requests'
  ]) t where to_regclass('public.' || t) is null),
  0, 'every table of plan 5.1 and 5.6 exists');

select is(to_regclass('public.nutrition_plans')::text, null, 'nutrition_plans is dropped in v2 (replaced by care_plans)');

select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  0, 'row level security is on for every table');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef
     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')),
  0, 'every security definer function sets search_path');

select is(
  (select count(*)::int from information_schema.columns
   where table_schema = 'public' and table_name = 'appointments'
     and column_name in ('hospital_id', 'department_id', 'appointment_date', 'token_no') and is_nullable = 'YES'),
  0, 'hospital, department, date and token of an appointment are required');

select ok(
  (select count(*) from information_schema.columns
   where table_schema = 'public' and table_name = 'prescription_items'
     and ((column_name = 'quantity_total' and data_type = 'numeric')
       or (column_name = 'refill_alert_days' and is_nullable = 'NO'))) = 2,
  'quantity_total is numeric and refill_alert_days is required');

select is(
  (select count(*)::int from pg_constraint
   where conrelid = 'public.missed_dose_alerts'::regclass and contype = 'p'),
  1, 'a missed dose is alerted once (primary key on item and time)');

select is(
  (select count(*)::int from pg_publication_tables
   where pubname = 'supabase_realtime' and schemaname = 'public'
     and tablename in ('emergency_requests', 'appointments', 'drug_alerts', 'care_plans')),
  4, 'realtime publishes the four live tables');

select is(
  (select count(*)::int from pg_indexes
   where schemaname = 'public' and indexname in ('idx_web_cache_expires_at', 'idx_prescription_items_active_medicine')),
  2, 'the cache cleanup and the medicine-name lookups are indexed');

select is(
  (select count(*)::int from pg_constraint c
   where c.contype = 'f' and c.connamespace = 'public'::regnamespace
     and not exists (select 1 from pg_index i where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1])),
  0, 'every foreign key has an index that starts with its first column');

select * from finish();
rollback;
