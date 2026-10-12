# Supabase: database, policies, storage, seed

Schema, row level security (RLS), storage buckets, realtime and demo data for Vyana.

| Path | What |
| --- | --- |
| `migrations/0001_schema.sql` | Tables and sign-up trigger (plan 5.1 + 5.6) |
| `migrations/0002_rls.sql` | Helper functions, trigger guards, RPCs, grants, RLS policies |
| `migrations/0003_storage.sql` | Private `prescriptions` and `lab-reports` buckets + folder policies |
| `migrations/0004_realtime.sql` | Live tables: `emergency_requests`, `appointments`, `drug_alerts`, `care_plans` |
| `migrations/0005_data_layer.sql` | What the query functions need: `doctor_directory()`, `my_caregivers()`, `department_tokens()`, `create_doctor_prescription()` (one transaction), the AI mistake note, and a stricter dose log update |
| `seed/seed-users.ts` | Creates the demo auth users through the admin API |
| `seed/seed.sql` | Demo rows for those users (safe to run again) |
| `tests/database/*.test.sql` | pgTAP tests of the schema and every access path |

## Seed order

`config.toml` turns off the automatic seed, because the auth users must exist before `seed.sql` runs.

1. Apply the migrations to a clean local database:
   ```bash
   supabase db reset
   ```
2. Create the demo users (patient, doctor, doctor2, admin, caregiver; all `@vyana.test`). The password comes only from `SEED_PASSWORD`, the script exits without it:
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

## Tests

```bash
supabase test db
```

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
