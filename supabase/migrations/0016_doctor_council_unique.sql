-- 0016_doctor_council_unique.sql
-- One council registration, one verified doctor (issue #360). Owner: Vaibhav Parmar
--
-- The app already refuses a registration number that another verified doctor holds
-- (apps/web/lib/server/doctor-verify.ts), but that check is read-then-write: two
-- approvals of the same number for two different accounts at the same moment can both
-- pass it, and both rows end up verified with the same number. This migration is the
-- database backstop: a partial unique index on public.doctors over the normalised
-- registration number and council, covering verified rows only.
--
-- (The issue says "on profiles", but the registration columns — reg_no, state_council,
-- verification_status — live on public.doctors; profiles holds none of them.)
--
-- The normalisation is the app's own (normalizeRegNo / councilKey in
-- apps/web/lib/server/tinyfish/nmc.ts), restated below as two immutable functions so
-- the index agrees with the app spelling for spelling: "MCI/12-345" and "mci 12345"
-- are the same number, and "Delhi Medical Council", "Medical Council of Delhi" and
-- "Delhi" are the same council. If the app functions ever change, these must change
-- in the same release, or the guard will disagree with the check it backs up.
--
-- BEFORE APPLYING: check the live data for doctors who are already verified with the
-- same normalised number and council — the guard near the bottom stops this
-- migration (naming the offending keys) rather than forcing the index over
-- duplicates, so they can be listed on issue #360 and resolved first. The same
-- report, to run by hand once the functions below exist:
--
--   select public.doctor_reg_no_key(reg_no) as reg_key,
--          public.doctor_council_key(state_council) as council_key,
--          count(*), array_agg(id)
--   from public.doctors
--   where verification_status = 'verified'
--   group by 1, 2
--   having count(*) > 1;

-- The app's normalizeRegNo: lower-case, then drop every whitespace character, ".",
-- "/", "\" and "-". regexp_replace and lower are both immutable in Postgres, and the
-- rest is fixed text, so the function honestly is.
create or replace function public.doctor_reg_no_key(p_reg_no text)
returns text
language plpgsql
immutable
strict
as $$
begin
  return regexp_replace(lower(p_reg_no), '[\s./\\-]+', '', 'g');
end;
$$;

-- The app's councilKey: lower-case, split on runs of non-letters, drop the filler
-- words (state, medical, council, of, the), join what is left with single spaces.
-- A plpgsql body, because the split-filter-join cannot be one index expression; the
-- function itself is a pure function of its input, so immutable is honest.
create or replace function public.doctor_council_key(p_council text)
returns text
language plpgsql
immutable
strict
as $$
declare
  word text;
  kept text[] := '{}';
begin
  foreach word in array regexp_split_to_array(lower(p_council), '[^a-z]+') loop
    if word <> '' and word not in ('state', 'medical', 'council', 'of', 'the') then
      kept := kept || word;
    end if;
  end loop;
  return array_to_string(kept, ' ');
end;
$$;

-- Stop, do not force: if verified doctors already share a registration, creating the
-- index would fail anyway — fail here instead, naming the keys, so they can be
-- listed on issue #360 and resolved before this migration is applied again.
do $$
declare
  dup_keys text;
begin
  select string_agg(reg_key || ' / ' || council_key, '; ')
    into dup_keys
  from (
    select public.doctor_reg_no_key(reg_no) as reg_key,
           public.doctor_council_key(state_council) as council_key
    from public.doctors
    where verification_status = 'verified'
    group by 1, 2
    having count(*) > 1
    limit 10
  ) dup;
  if dup_keys is not null then
    raise exception 'verified doctors already share a council registration: % — resolve them (issue #360) before applying this migration', dup_keys;
  end if;
end;
$$;

-- Verified rows only: pending and failed applications may repeat a number freely
-- (a doctor reapplying, two applicants claiming the same number before either is
-- approved) — the guard bites exactly where the app's promise is made.
create unique index idx_doctors_verified_registration
  on public.doctors (
    (public.doctor_reg_no_key(reg_no)),
    (public.doctor_council_key(state_council))
  )
  where verification_status = 'verified';
