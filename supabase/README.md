# Supabase: database, policies, storage, seed

Schema, row level security (RLS), storage buckets, realtime and demo data for Vyana.

How the data moves through the app, and who can reach it at each step: [`DATA-FLOW.md`](DATA-FLOW.md).

| Path | What |
| --- | --- |
| `migrations/0001_schema.sql` | Tables and sign-up trigger (plan 5.1 + 5.6) |
| `migrations/0002_rls.sql` | Helper functions, trigger guards, RPCs, grants, RLS policies |
| `migrations/0003_storage.sql` | Private `prescriptions` and `lab-reports` buckets + folder policies |
| `migrations/0004_realtime.sql` | Live tables: `emergency_requests`, `appointments`, `drug_alerts`, `care_plans` |
| `migrations/0005_data_layer.sql` | What the query functions need: `doctor_directory()`, `my_caregivers()`, `department_tokens()`, `create_doctor_prescription()` (one transaction), the AI mistake note, and a stricter dose log update |
| `migrations/0006_diagnosis_condition.sql` | A doctor's diagnosis on an e-Rx creates the patient's condition (one per prescription; an edited diagnosis updates it) |
| `migrations/0007_one_token_per_day.sql` | `book_appointment` gives a patient at most one active token per department and day (a unique index backs it) |
| `migrations/0008_missed_dose_cron.sql` | pg_cron calls `POST /api/cron/missed-doses` every 15 minutes through `run_missed_dose_check()` (address and secret come from the Vault) |
| `migrations/0009_share_link_cap.sql` | a share link expires within 30 days of its creation (a CHECK on `share_links`, one hour of slack for phone clocks) |
| `migrations/0010_account_deletion.sql` | A doctor or a caregiver can delete their account: links from other people's records to them (`doctor_id`, `diagnosed_by`, `reviewed_by`, `used_by`) are cleared instead of blocking the deletion |
| `migrations/0011_meal_log_limits.sql` | The meal log keeps its limits in the database (a description of 1 to 200 characters, 0 to 5,000 calories) and is indexed by patient and time |
| `migrations/0012_rate_limits.sql` | The counters behind the per-user limits on the AI and web-agent routes: the table `rate_limits` and the function `hit_rate_limit()`, which only the server may call; a pg_cron job clears old rows every hour |
| `seed/seed-users.ts` | Creates the demo auth users through the admin API |
| `seed/seed.sql` | Demo rows for those users (safe to run again) |
| `tests/database/*.test.sql` | pgTAP tests of the schema and every access path |

## Seed order

`config.toml` turns off the automatic seed, because the auth users must exist before `seed.sql` runs.

1. Apply the migrations to a clean local database:
   ```bash
   supabase db reset
   ```
2. Create the demo users (patient, doctor, doctor2, admin, caregiver, and `doc01` to `doc18`, two fictional doctors for each hospital; all `@vyana.test`). The password comes only from `SEED_PASSWORD`, the script exits without it:
   ```bash
   SEED_PASSWORD=<choose-one> SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
     pnpm --filter @vyana/web exec tsx ../../supabase/seed/seed-users.ts
   ```
   `@supabase/supabase-js` is installed in the web workspace, so run the script from there (pnpm does not hoist it to the repo root).
3. Load the demo rows:
   ```bash
   psql "$DB_URL" -f supabase/seed/seed.sql
   ```

Users are created only through the admin API, which also writes `auth.identities`. Raw inserts into `auth.users` would leave email login broken.

## What the demo world contains

`patient@vyana.test` (Aryan Sharma) opens a full app:

- **Hospitals:** 9 real Delhi hospitals with 47 departments (public information: names, addresses, websites; coordinates are approximate). Five government hospitals (AIIMS, Safdarjung, Dr. RML, LNJP, GTB) take bookings on ORS; four private ones (Max Patparganj, Sir Ganga Ram, Indraprastha Apollo, Max Saket). OPD days and timings are the column defaults; the real ones come from "Check OPD timings".
- **Doctors:** two fictional, verified doctors for each hospital (`doc01` to `doc18`), plus Dr. Rajesh Mehta at AIIMS and a pending doctor for the NMC demo.
- **Medicines:** Metformin (2 days from a refill: the home screen shows a Reorder card), Telmisartan, and Dolo as needed; seven days of dose logs in India time.
- **Care plan:** an approved plan for Type 2 Diabetes with follow-up tests (HbA1c every 90 days).
- **Reports:** four reports with an HbA1c trend of 8.1, 7.8, 7.4 and 6.8 over nine months.
- **People and more:** two conditions, two appointments, vitals, two emergency contacts, a caregiver (`caregiver@vyana.test`), and accepted consents.

Run the seed again at any time: it replaces the dose logs and vitals and leaves the rest as it is.

## Missed-dose alerts (pg_cron)

Every 15 minutes the database calls `POST {app_url}/api/cron/missed-doses` with the header `x-cron-secret`. The route
finds doses that were due 60+ minutes ago and are not logged as taken or skipped (no log, or a log saying missed), for patients
with an active caregiver, and pushes each caregiver phone once (`missed_dose_alerts` keeps it to once). Set the address and the secret once per project (the
secret is the value of `CRON_SECRET` on the server):

```sql
select vault.create_secret('https://<your-domain>', 'app_url');
select vault.create_secret('<the value of CRON_SECRET>', 'cron_secret');
```

Until both exist the job logs a warning and does nothing. To see the runs: `select * from cron.job_run_details order by start_time desc limit 5;`.
To run one by hand: `select public.run_missed_dose_check();`.

## Rate limits (migration 0012)

The API limits how often one user can call the AI and web-agent routes, so one account cannot use up the team's Groq and
TinyFish credits. The database only keeps the counters; the API (`withRoute`, issue #138) decides the limits.

| What | Detail |
|---|---|
| Table `public.rate_limits` | `user_id`, `bucket` (a name such as `ai_chat` or `agent`), `window_start`, `hits`. One row per user, bucket and window. Deleted with the account |
| Who can read or write it | **Nobody from the app.** RLS is on with no policy at all, and the privileges of `anon` and `authenticated` are removed too |
| Function `hit_rate_limit(p_user, p_bucket, p_window_seconds, p_max)` | Counts one call and returns `allowed` (false when this call is over the maximum), `remaining` and `reset_at` (when the window ends) |
| Who can call it | **Only `service_role`**, the admin client of the server, after it has checked who the user is. A signed-in user could otherwise spend another user's allowance |
| How it counts | One statement, `insert ... on conflict do update set hits = hits + 1 returning ...`, so two calls at the same moment each get their own number. The window is a fixed slice of time that starts on a multiple of its length since 1970 (every 10 minutes on the clock, for example). Refused calls are counted too |
| Wrong arguments | A window of 0 or less, a negative maximum, no user or a bucket name of 0 or over 64 characters raise `22023` |
| Clean-up | The pg_cron job `rate-limits-cleanup` runs at minute 17 of every hour and deletes rows older than one day |

From the server:

```ts
const { data } = await supabaseAdmin().rpc("hit_rate_limit", { p_user: user.id, p_bucket: "ai_chat", p_window_seconds: 600, p_max: 20 });
// data[0] = { allowed, remaining, reset_at }
```

## Tests

```bash
supabase test db
```

Run it after `supabase db reset`: a database that already has the demo seed holds ids that clash with the users the tests create. (On a real Supabase a direct delete from `storage.objects` raises an error instead of deleting nothing; the test helper `tap_deleted` counts both as 0 rows.)

The tests sign in as real roles (`authenticated`, `anon`) with a JWT subject and check, among others:

- sign-up cannot create an admin; nobody but the server changes a role or verifies a doctor
- a doctor only reads patients of their own verified department
- appointments exist only through `book_appointment` (tokens 1, 2, ...)
- a caregiver reads but never writes, and a revoked caregiver cannot switch back on
- invite codes are rate limited (5 wrong tries per 15 minutes)
- a patient never sees an unreviewed AI care plan; a doctor edits and approves it and the patient sees it
- the e-Rx flow: a doctor prescribes only for patients of their own department and only in their own name
- admin access, share link revoke, and a caregiver who leaves by deleting the link
- storage: a user reaches only their own folder, and both buckets are private
- deleting an account: a patient, a doctor and a caregiver can all be deleted, every row of the patient goes, other people's records stay
- every foreign key has an index, and every `security definer` function sets its `search_path`

## Database types

`packages/shared/src/db/database.types.ts` is generated from the migrations. After a schema change, regenerate it and commit the result:

```bash
supabase gen types typescript --local --schema public > packages/shared/src/db/database.types.ts
```

Update the `Db*` aliases in `packages/shared/src/db/types.ts` when a table is added or removed.

## Notes

- Hosted Supabase installs `pgcrypto` in the `extensions` schema, so functions that need `gen_random_bytes` set `search_path = public, extensions`.
- Every `security definer` function sets `search_path = public`.
- `accept_care_invite` returns `null` for a wrong or expired code (the client shows "invalid or expired code") and raises `too many attempts` after 5 wrong tries in 15 minutes.
- `config.toml` uses Postgres 17 (the Supabase default). Check `select version();` on the cloud project and adjust `major_version` if it differs.
