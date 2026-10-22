-- 0016_plans.sql
-- Plans, limits and a waitlist (issue #301): tables only, no payments.
-- Owner: Vaibhav Parmar
--
-- Three small tables and two functions give the app a place to say "this
-- person is on the free plan, with these limits" and a place to collect
-- interest before any billing exists:
--
--   plans       the three plans and their limits, seeded below. The numbers
--               are placeholders and live only here, so they are easy to change.
--   user_plans  which plan each profile is on. Written by a trigger (below)
--               and by the service role; a user can read only their own row.
--   waitlist    an email, a plan and a short note — nothing about a patient.
--               No role can read or write it directly; join_waitlist() is the
--               only way in.
--
-- The features jsonb carries the plan switches that are not counts:
--   caregivers          the plan includes caregiver links
--   care_agent_max_open how many care-agent suggestions may be open at once
--                       (null = no limit; the care agent itself is issue #302)
-- Clinic promises nothing yet, so its features are empty and its limits null.

create table public.plans (
  id text primary key check (id in ('free', 'family', 'clinic')),
  name text not null,
  daily_ai_calls int,
  max_profiles int,
  features jsonb not null default '{}'
);

insert into public.plans (id, name, daily_ai_calls, max_profiles, features) values
  ('free',   'Free',   30,   1,    '{"caregivers": false, "care_agent_max_open": 3}'::jsonb),
  ('family', 'Family', 150,  5,    '{"caregivers": true, "care_agent_max_open": null}'::jsonb),
  ('clinic', 'Clinic', null, null, '{}'::jsonb)
on conflict (id) do nothing;

-- Plans are prices on a page: anyone may read them, nobody but the service
-- role may change them.
alter table public.plans enable row level security;
create policy "plans_select" on public.plans
  for select to anon, authenticated using (true);
grant select on public.plans to anon, authenticated, service_role;
revoke insert, update, delete on public.plans from anon, authenticated;

-- ---------------------------------------------------------------- user_plans

create table public.user_plans (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  plan_id text not null references public.plans(id),
  since timestamptz not null default now(),
  source text not null default 'default' check (source in ('default', 'admin', 'waitlist'))
);

alter table public.user_plans enable row level security;
create policy "user_plans_select_own" on public.user_plans
  for select to authenticated using (user_id = auth.uid());
grant select on public.user_plans to authenticated, service_role;
revoke insert, update, delete on public.user_plans from anon, authenticated;
revoke all on public.user_plans from anon;
create index idx_user_plans_plan on public.user_plans (plan_id);

-- Every new profile starts on free. The profile row itself is created by the
-- sign-up trigger (0005), so this fires for every way a profile appears.
create or replace function public.give_default_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_plans (user_id, plan_id, source)
  values (new.id, 'free', 'default')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger trg_profiles_default_plan
  after insert on public.profiles
  for each row execute function public.give_default_plan();

-- A trigger function needs no execute grant for anyone: the trigger fires it.
revoke execute on function public.give_default_plan() from public;

-- Everyone who is already here gets free too.
insert into public.user_plans (user_id, plan_id, source)
select id, 'free', 'default' from public.profiles
on conflict (user_id) do nothing;

-- The caller's plan, with its limits: one row, or none when the caller is not
-- signed in (or has no profile). Security definer, filtered by auth.uid()
-- itself, so it can only ever hand back the caller's own plan.
create or replace function public.current_plan()
returns table (
  plan_id text, name text, daily_ai_calls int, max_profiles int,
  features jsonb, since timestamptz, source text
)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.name, p.daily_ai_calls, p.max_profiles, p.features, up.since, up.source
  from public.user_plans up
  join public.plans p on p.id = up.plan_id
  where up.user_id = auth.uid();
$$;

revoke all on function public.current_plan() from public, anon;
grant execute on function public.current_plan() to authenticated, service_role;

-- ------------------------------------------------------------------ waitlist

-- The address is stored lower-cased (the table refuses anything else) and is
-- unique per plan: the same person may wait for two plans, never twice for one.
create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email)) check (char_length(email) <= 254),
  plan_id text not null references public.plans(id),
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now(),
  unique (email, plan_id)
);

-- No direct access at all: no policies, and the grants are taken back, so the
-- function below is the only door.
alter table public.waitlist enable row level security;
revoke all on public.waitlist from anon, authenticated;
grant select, insert, update, delete on public.waitlist to service_role;
create index idx_waitlist_plan on public.waitlist (plan_id);

-- Anonymous joins need a counter that is not keyed by the address itself:
-- counting rows of the same email can never reach a limit when an address
-- holds at most one row per plan. This table holds nothing but a timestamp
-- per anonymous attempt (signed-in callers are counted by hit_rate_limit,
-- against their profile). No role can touch it directly.
create table public.waitlist_attempts (
  id bigint generated always as identity primary key,
  attempted_at timestamptz not null default now()
);

alter table public.waitlist_attempts enable row level security;
revoke all on public.waitlist_attempts from anon, authenticated;
grant select, insert, update, delete on public.waitlist_attempts to service_role;
create index idx_waitlist_attempts_time on public.waitlist_attempts (attempted_at);

-- Join the waitlist. Open to anyone (the pricing page is public), so it
-- defends itself: the address must look like an address and fit in 254
-- characters, the plan must exist, and the note is capped by the table.
-- Rate limits: a signed-in caller is counted by hit_rate_limit like every
-- other bucket (5 an hour); an anonymous caller has no profile to count
-- against (rate_limits.user_id is a profile key), so anonymous joins as a
-- whole are capped at 30 an hour through waitlist_attempts — the form
-- cannot be flooded, and no per-address counter can be gamed by varying
-- the address.
-- The answer is only whether the address is new to this plan. An earlier
-- version handed back the stored row on a repeat join, which gave anyone
-- who submitted somebody else's address that person's note and join date;
-- the note is free text, so nothing of the stored row is returned now.
create or replace function public.join_waitlist(p_email text, p_plan_id text, p_note text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_uid uuid := auth.uid();
  v_allowed boolean;
  v_new_id uuid;
begin
  if char_length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'join_waitlist: invalid email' using errcode = '22023';
  end if;
  if p_plan_id is null or not exists (select 1 from public.plans p where p.id = p_plan_id) then
    raise exception 'join_waitlist: unknown plan' using errcode = '22023';
  end if;
  if p_note is not null and char_length(p_note) > 200 then
    raise exception 'join_waitlist: note too long' using errcode = '22023';
  end if;

  if v_uid is not null then
    select h.allowed into v_allowed
    from public.hit_rate_limit(v_uid, 'waitlist-join', 3600, 5) h;
    if not coalesce(v_allowed, false) then
      raise exception 'join_waitlist: rate limited, try again later' using errcode = 'P0001';
    end if;
  else
    delete from public.waitlist_attempts where attempted_at < now() - interval '1 day';
    if (select count(*) from public.waitlist_attempts
         where attempted_at > now() - interval '1 hour') >= 30 then
      raise exception 'join_waitlist: rate limited, try again later' using errcode = 'P0001';
    end if;
    insert into public.waitlist_attempts default values;
  end if;

  insert into public.waitlist (email, plan_id, note)
  values (v_email, p_plan_id, p_note)
  on conflict (email, plan_id) do nothing
  returning id into v_new_id;

  return v_new_id is not null;
end;
$$;

revoke all on function public.join_waitlist(text, text, text) from public;
grant execute on function public.join_waitlist(text, text, text) to anon, authenticated, service_role;
