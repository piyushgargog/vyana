-- supabase/migrations/0025_price_observations.sql
-- Append-only price observations for the price layer (issue #495 step 5; read by #497).
-- Written only by the service role; signed-in users can read, nobody using the API can
-- change or remove a row — an observation is a record of what a source showed at a time.
-- Owner: Vaibhav Parmar

create table public.price_observations (
  id uuid primary key default gen_random_uuid(),
  -- The normalised medicine key the price layer groups by (its rule lives in #497).
  medicine_key text not null,
  source text not null,
  url text,
  price_inr numeric,
  pack text,
  observed_at timestamptz not null default now(),
  status text not null
);
alter table public.price_observations enable row level security;

create index price_observations_medicine_observed_idx
  on public.price_observations (medicine_key, observed_at desc);

-- Readable by signed-in users. No insert, update or delete policy on purpose: writes are
-- the service role's alone, and rows are never edited or removed through the API.
create policy "price_observations_select_signed_in" on public.price_observations
  for select to authenticated using (true);
