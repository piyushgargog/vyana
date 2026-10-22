-- 0021_doctor_reg_unique.sql
-- One council number, one verified doctor account — enforced by the database (issue #360).
-- Owner: Vaibhav Parmar
--
-- Until now the "one registration, one account" rule (ADR-047) lived only in
-- app code: the verify flow reads the verified rows, compares normalised
-- numbers in JS, and only then saves. Two approvals of the same council
-- number for two different accounts at the same moment can both pass that
-- read-then-write check, and both rows end up verified. This migration adds
-- the missing backstop: a partial unique index over the normalised number
-- and council, covering verified rows only.
--
-- The issue says "profiles"; the registration columns (reg_no, state_council,
-- verification_status) live on public.doctors, so the guard is on doctors —
-- every row there is a doctor.
--
-- The two helpers below mirror the app exactly: normalizeRegNo and
-- councilKey in apps/web/lib/server/tinyfish/nmc.ts (copied into
-- apps/web/lib/server/doctor-register.ts by PR #355). If the JS
-- normalisation ever changes, these must change in the same PR, or the
-- guard will miss spellings the app treats as the same number.

-- "MCI/12-345" and "mci 12345" are the same number: lower case, then drop
-- spaces and the separators . / \ and -.
create or replace function public.normalize_reg_no(p_reg_no text)
returns text
language sql
immutable
strict
as $$
  select regexp_replace(lower(p_reg_no), '[\s./\\-]+', '', 'g');
$$;

-- "Delhi Medical Council" and "delhi" are the same council: the words that
-- are not filler (state, medical, council, of, the), in order, joined by a
-- single space. Non-letters are separators, as in the JS split.
create or replace function public.council_key(p_council text)
returns text
language sql
immutable
strict
as $$
  select coalesce((
    select string_agg(t.tok, ' ' order by t.ord)
    from regexp_split_to_table(lower(p_council), '[^a-z]+') with ordinality as t(tok, ord)
    where t.tok <> '' and t.tok not in ('state', 'medical', 'council', 'of', 'the')
  ), '');
$$;

-- Existing duplicates first (the issue's ask): if the live data already has
-- two verified doctors on one normalised number + council, refuse and name
-- them, so they are resolved by hand instead of being forced under the
-- index or silently blocking it. On clean data this does nothing.
do $$
declare
  dup_list text;
begin
  select string_agg(d.nreg || ' / ' || d.ck || ' x' || d.n, '; ')
    into dup_list
    from (
      select public.normalize_reg_no(reg_no) as nreg,
             public.council_key(state_council) as ck,
             count(*)::text as n
        from public.doctors
       where verification_status = 'verified' and reg_no is not null
       group by public.normalize_reg_no(reg_no), public.council_key(state_council)
      having count(*) > 1
    ) d;
  if dup_list is not null then
    raise exception '0021: verified doctor duplicates (normalised reg_no / council): % — resolve them before this index can be created', dup_list;
  end if;
end $$;

-- The guard itself. Pending and failed rows are outside it: the same
-- number may be claimed by many accounts, verified for only one.
create unique index idx_doctors_verified_reg_council
  on public.doctors (public.normalize_reg_no(reg_no), public.council_key(state_council))
  where verification_status = 'verified' and reg_no is not null;
