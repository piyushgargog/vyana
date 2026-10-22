-- 0020_conditions_dedupe.sql
-- One condition, once (issue #333): the demo patient showed "Type 2 Diabetes" four times —
-- the live check used to add it on every run (that half is fixed in PR #311), the app let a
-- patient add the same name twice, and nothing in the database said no. This migration
-- removes the duplicates that are already there and adds the index that keeps them out.
-- Owner: Vaibhav Parmar

-- 1. Care plans that hang on a duplicate row move to the row that stays, so no plan is
--    lost when the duplicate goes. (The alternative was deleting those plans with the row;
--    a plan a doctor approved should not vanish because a name was typed twice.)
with keepers as (
  select patient_id,
         lower(btrim(name)) as name_key,
         (array_agg(id order by created_at, id))[1] as keep_id
  from public.conditions
  group by patient_id, lower(btrim(name))
)
update public.care_plans cp
set condition_id = k.keep_id
from public.conditions c
join keepers k
  on k.patient_id = c.patient_id
 and k.name_key = lower(btrim(c.name))
where cp.condition_id = c.id
  and c.id <> k.keep_id;

-- 2. The duplicate rows go; the oldest of each name (by created_at, then id) stays.
with keepers as (
  select patient_id,
         lower(btrim(name)) as name_key,
         (array_agg(id order by created_at, id))[1] as keep_id
  from public.conditions
  group by patient_id, lower(btrim(name))
)
delete from public.conditions c
using keepers k
where k.patient_id = c.patient_id
  and k.name_key = lower(btrim(c.name))
  and c.id <> k.keep_id;

-- 3. And they cannot come back: one row per patient and name, compared the way a person
--    compares it — case and the spaces at the ends do not make a second condition.
create unique index idx_conditions_patient_name_key
  on public.conditions (patient_id, (lower(btrim(name))));
