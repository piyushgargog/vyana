-- 0018_indexes.sql
-- The index review (issue #303): one index the hot queries earn. Two others
-- were measured and deliberately not added — the numbers are in PR #303.
-- Owner: Vaibhav Parmar
--
-- The ten most common queries were run with explain (analyze, buffers) on a
-- database carrying the demo seed plus synthetic runtime volume (100k AI
-- runs, 102k chat messages, 104k dose logs, 5k share links). Eight of the ten
-- were already served by an index or are scans of tables that stay small. Of
-- the remaining two:
--
-- The missed-dose scan (the cron route, every 15 minutes) reads dose_logs by
-- status and a scheduled_for window. The planner had to walk the whole
-- (item_id, scheduled_for) unique index to answer it — 0.99 ms over 104k
-- rows, growing linearly with the table. An index on (status, scheduled_for)
-- answers it from the window alone: 0.073 ms after, a 13x improvement, and
-- flat as the table grows.
--
-- The other candidate, (session_id, created_at) on chat_messages, was built
-- and measured and is NOT in this migration: at 2,000 messages in a session
-- the planner prefers the existing (session_id) index plus a 1.2 ms in-memory
-- sort, and it still prefers it with the composite index present. Revisit
-- if real sessions grow past tens of thousands of messages.

create index idx_dose_logs_status_scheduled
  on public.dose_logs (status, scheduled_for);
