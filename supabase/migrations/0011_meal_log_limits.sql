-- 0011_meal_log_limits.sql
-- Limits for the meal log (V10, T3). Owner: Vaibhav Parmar
--
-- The app checks a meal before it sends it (MEAL_DESCRIPTION_MAX, MEAL_CALORIES_MAX in constants.ts); the
-- database keeps the same limits so a typo like 3000000 calories, or an empty meal, cannot be written some
-- other way. A day's list is read by patient and time, so one index covers both.
alter table public.meal_logs
  add constraint chk_meal_logs_description check (btrim(description) <> '' and char_length(description) <= 200),
  add constraint chk_meal_logs_calories check (calories is null or calories between 0 and 5000);

create index idx_meal_logs_patient_logged_at on public.meal_logs (patient_id, logged_at);
drop index public.idx_meal_logs_patient_id;
