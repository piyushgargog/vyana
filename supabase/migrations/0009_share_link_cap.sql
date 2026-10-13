-- 0009_share_link_cap.sql
-- A share link lives at most 30 days (issue #34, review of #75). Owner: Vaibhav Parmar
--
-- share_links grants INSERT (patient_id, kind, expires_at) and UPDATE (revoked, expires_at) to signed-in users, so
-- without a limit a patient (or a bug in the app) could make a link that opens a medical record for years.
-- The cap counts from the creation of the link, so extending an old link past 30 days is refused too. The hour
-- of slack is for a phone whose clock is a little ahead of the database: the app sets expires_at itself.
alter table public.share_links
  add constraint chk_share_links_max_30_days
  check (expires_at <= created_at + interval '30 days 1 hour');
