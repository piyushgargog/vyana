-- 0004_realtime.sql
-- Realtime publication for Vyana: plan section 5.4 and 5.6
-- Owner: Vaibhav Parmar

-- A patient sees an emergency update, a booking change, a drug alert and a care plan approval live.
-- Realtime applies the RLS policies of 0002, so nobody receives rows they cannot select.
do $$
declare
  t text;
begin
  foreach t in array array['emergency_requests', 'appointments', 'drug_alerts', 'care_plans'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
