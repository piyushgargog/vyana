-- supabase/migrations/0026_weekly_summaries.sql
-- Weekly summaries (issue #495 step 4): one row per patient and week (Monday, IST) with the
-- dose counts, covered days and device averages the family card (#491) and the results page
-- (#496) read, so no screen recomputes them. Filled by pg_cron every night for the current
-- and the previous week; rows are recomputed, never edited by hand. The switch-on functions
-- follow the care agent pattern (0024): this migration creates nothing on a schedule.
-- Owner: Vaibhav Parmar

create table public.weekly_summaries (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  -- The Monday of the week, as an India calendar date.
  week_start date not null,
  doses_due int not null default 0,
  doses_taken int not null default 0,
  -- Days in the week with at least one taken dose (the PDC numerator, see health/adherence).
  days_covered int not null default 0,
  steps_avg numeric,
  sleep_avg_minutes numeric,
  -- Flags written by the care rules when they exist (#417); a plain record until then.
  rule_flags jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now(),
  unique (patient_id, week_start)
);
alter table public.weekly_summaries enable row level security;

-- An active caregiver link, and the patient has an unrevoked, unexpired share link whose
-- scopes include adherence — the scope this summary is made of.
create or replace function public.caregiver_can_read_weekly(p uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_caregiver_of(p) and exists (
    select 1 from public.share_links s
    where s.patient_id = p and not s.revoked and s.expires_at > now()
      and 'adherence' = any (s.scopes)
  );
$$;

-- The patient reads their own rows; a caregiver reads a row only when the patient shared
-- the adherence scope with them (the helper above). Writes are the fill function's alone.
create policy "weekly_summaries_select_own" on public.weekly_summaries
  for select to authenticated using ((select auth.uid()) = patient_id);
create policy "weekly_summaries_select_caregiver" on public.weekly_summaries
  for select to authenticated using (public.caregiver_can_read_weekly(patient_id));

-- Recomputes the current and previous IST weeks for every profile. Doses due come from the
-- medicines switched on now (the same limit getAdherence documents: the database keeps no
-- history of the switch); a day is covered by one taken dose, as in PDC.
create or replace function public.fill_weekly_summaries()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  monday date := (now() at time zone 'Asia/Kolkata')::date
    - ((extract(isodow from (now() at time zone 'Asia/Kolkata')::date)::int - 1));
  w date;
begin
  foreach w in array array[monday - 7, monday] loop
    insert into public.weekly_summaries
      (patient_id, week_start, doses_due, doses_taken, days_covered, steps_avg, sleep_avg_minutes, rule_flags, computed_at)
    select p.id, w,
      coalesce(dues.due, 0),
      coalesce(logs.taken, 0),
      coalesce(logs.covered, 0),
      act.steps_avg,
      act.sleep_avg_minutes,
      '{}'::jsonb,
      now()
    from public.profiles p
    left join (
      select i.patient_id, sum(cardinality(i.times))::int as due
      from public.prescription_items i
      join generate_series(w, w + 6, interval '1 day') d(day)
        on d.day::date between i.start_date and coalesce(i.end_date, d.day::date)
      where i.active and i.times is not null and cardinality(i.times) > 0
      group by i.patient_id
    ) dues on dues.patient_id = p.id
    left join (
      select patient_id,
        count(*) filter (where status = 'taken')::int as taken,
        count(distinct (scheduled_for at time zone 'Asia/Kolkata')::date)
          filter (where status = 'taken')::int as covered
      from public.dose_logs
      where (scheduled_for at time zone 'Asia/Kolkata')::date between w and w + 6
      group by patient_id
    ) logs on logs.patient_id = p.id
    left join (
      select patient_id, avg(steps) as steps_avg, avg(sleep_minutes) as sleep_avg_minutes
      from public.daily_activity
      where day between w and w + 6
      group by patient_id
    ) act on act.patient_id = p.id
    on conflict (patient_id, week_start) do update set
      doses_due = excluded.doses_due,
      doses_taken = excluded.doses_taken,
      days_covered = excluded.days_covered,
      steps_avg = excluded.steps_avg,
      sleep_avg_minutes = excluded.sleep_avg_minutes,
      computed_at = excluded.computed_at;
  end loop;
end;
$$;
revoke all on function public.fill_weekly_summaries() from public, anon, authenticated;
grant execute on function public.fill_weekly_summaries() to service_role;

-- The nightly job (02:00 IST), created only when Piyush switches it on, like the care
-- agent's (0024): select public.schedule_weekly_summaries();
create or replace function public.schedule_weekly_summaries()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_id bigint;
begin
  select jobid into job_id from cron.job where jobname = 'weekly-summaries-nightly';
  if job_id is not null then
    return job_id;
  end if;
  return cron.schedule(
    'weekly-summaries-nightly',
    '30 20 * * *',
    $job$select public.fill_weekly_summaries()$job$
  );
end;
$$;
revoke all on function public.schedule_weekly_summaries() from public, anon, authenticated;
grant execute on function public.schedule_weekly_summaries() to service_role;

create or replace function public.unschedule_weekly_summaries()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform cron.unschedule('weekly-summaries-nightly');
end;
$$;
revoke all on function public.unschedule_weekly_summaries() from public, anon, authenticated;
grant execute on function public.unschedule_weekly_summaries() to service_role;
