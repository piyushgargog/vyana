-- 0014_share_link_scopes.sql
-- The data side of the Health Memory Graph (issue #237): a share link can carry scopes — the
-- parts of the record its page may show (labs, vitals, medicines, adherence) — and the record of
-- how often the link was opened. Owner: Vaibhav Parmar
--
-- The RapidBlood migration (0013) is a different file on purpose, so the two ship apart.
--
-- scopes is a plain list of words from one fixed set, checked by the table itself: the app
-- cannot write a scope the shared page does not understand. Old links keep the default, an
-- empty list, and behave exactly as before: their page shows no memory.
--
-- open_count and last_opened_at are written by the server only (the service role, when a link
-- opens). A signed-in user gets no insert or update grant for them — the grants in 0002 name the
-- writable columns — so a patient cannot inflate the count of their own link, and the UPDATE
-- grant there still covers only (revoked, expires_at). No viewer identity or address is stored:
-- the count is all the patient asked to see (#239).

alter table public.share_links
  add column scopes text[] not null default '{}',
  add column open_count int not null default 0,
  add column last_opened_at timestamptz;

alter table public.share_links
  add constraint chk_share_links_scopes
  check (scopes <@ array['labs', 'vitals', 'medicines', 'adherence']::text[]);

-- Creating a link may set its scopes, nothing more: the counters stay server-only.
grant insert (scopes) on public.share_links to authenticated;
