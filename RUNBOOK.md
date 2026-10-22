# Runbook: backup and restore

The free Supabase plan keeps no backups of its own, and real people sign up on [vyanahealth.app](https://vyanahealth.app). So the server takes its own copy of the database every night. This page says what is copied, how to set it up, how to check it, and how to restore it.

## What is backed up, and what is not

| Backed up (every night) | Not backed up |
|---|---|
| The `public` schema: every table of the app, its policies and functions | **Uploaded files** (prescription and lab report images in Supabase Storage). A restore brings back the rows that point to them, not the files |
| The `auth` schema: the users (e-mail, name, password hashes), so logins work after a restore | Session and token tables (`auth.sessions`, `auth.refresh_tokens`, ...): everyone signs in again after a restore |
| | The `cron` job and the Vault secrets (`app_url`, `cron_secret`): after a restore into a new project run migration `0008` and set the Vault secrets again |
| | Dashboard settings: SMTP, redirect URLs, email templates, rate limits (see `supabase/README.md`) |
| | The server's env files (`apps/web/.env.production`): they live only on the server |

## How it works

- `scripts/backup/backup-db.py` runs `pg_dump` (in a throw-away `postgres:17-alpine` container, so the Postgres version always fits) through the Supabase **session pooler**, gzips the dump to `~/vyana-backups/vyana-YYYYMMDD-HHMMSSZ.sql.gz`, checks that the file is whole, keeps the **newest 7** and deletes older ones.
- A systemd timer (`scripts/backup/vyana-backup.timer`) starts it every night at 21:00 UTC (02:30 in India). If the server was off, it runs as soon as the server is on again.
- The connection string is in `~/.vyana-backup.env` (mode 600), **not** in the app's env file: the app's containers read that file, and they have no use for the database password.
- Dumps are files with mode 600 in a directory with mode 700, outside the repository. The password is given to `pg_dump` through its environment, never on a command line, and never written to a log.
- A failed night leaves the older dumps as they are and the service ends with an error (`journalctl -u vyana-backup.service`).

## One-time setup on the server

Do this as the `ubuntu` user, in the repository (`~/vyana`, change the paths below if it is somewhere else). Docker must work for this user: `docker ps` shows no error.

1. **Get the connection string** from the Supabase dashboard: *Connect* → **Session pooler** (port **5432**; the "transaction pooler" on port 6543 does not work for `pg_dump`). It looks like
   `postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres`.
   If the password has characters such as `@ / : # ? %`, write them percent-encoded (`@` is `%40`). Never paste the string in chat, an issue or a pull request.
2. **Write it into a private file:**

   ```bash
   install -m 600 /dev/null ~/.vyana-backup.env
   nano ~/.vyana-backup.env      # one line: BACKUP_DATABASE_URL=postgresql://postgres.<ref>:<password>@...:5432/postgres
   ls -l ~/.vyana-backup.env     # must show -rw-------
   ```
3. **Pull the Postgres image once** and run the first backup by hand:

   ```bash
   docker pull postgres:17-alpine
   python3 scripts/backup/backup-db.py
   ls -lh ~/vyana-backups        # one .sql.gz file and LAST_OK
   ```

   It prints `ok: vyana-....sql.gz (... bytes), removed 0 old dump(s)`. If it prints `backup FAILED: ...`, the message says what is wrong (it never contains the password; see Troubleshooting).
4. **Install the nightly timer:**

   ```bash
   sudo cp scripts/backup/vyana-backup.service scripts/backup/vyana-backup.timer /etc/systemd/system/
   sudoedit /etc/systemd/system/vyana-backup.service     # only if the repository is not at /home/ubuntu/vyana
   sudo systemctl daemon-reload
   sudo systemctl enable --now vyana-backup.timer
   systemctl list-timers vyana-backup.timer              # shows the next run
   sudo systemctl start vyana-backup.service             # a test run through systemd
   journalctl -u vyana-backup.service -n 20 --no-pager   # "ok: ..." as the last line
   ```

## Every morning (10 seconds)

```bash
cat ~/vyana-backups/LAST_OK          # the name of the newest dump
ls -lh ~/vyana-backups               # it is from last night (21:00 UTC); the size is about the same as yesterday
```

A dump older than 26 hours means a night was missed: run `journalctl -u vyana-backup.service -n 50 --no-pager`.

## Restore test (do it once, then after any change to the backup)

A backup that was never restored is a hope, not a backup. This restores the newest dump into a local Postgres in Docker; the real database is not touched.

```bash
scripts/backup/restore-check.sh                    # the newest dump
scripts/backup/restore-check.sh ~/vyana-backups/vyana-20261014-210005Z.sql.gz   # a given one
```

It starts `postgres:17-alpine` (no published port, no password), creates the roles and extensions Supabase has, loads the dump, prints the number of rows of the main tables and of the policies, and removes the container. The last line is `RESTORE OK` when users, profiles, hospitals and policies are there and no statement failed; otherwise it lists the first errors and exits with 1.

Then compare with the live project: in the Supabase SQL editor run `select count(*) from public.profiles;` (and `auth.users`, `public.prescriptions`) and check that the numbers are the same as the ones printed, allowing for what happened since the dump.

**Record the result here** (date, dump, numbers, who): *not done yet*.

### Look inside a dump without restoring it

```bash
gzip -dc ~/vyana-backups/vyana-20261014-210005Z.sql.gz | less
gzip -dc ~/vyana-backups/vyana-20261014-210005Z.sql.gz | grep -n '^COPY public.profiles'
```

## Recovering for real

Two cases. **They were not rehearsed**: do the first rehearsal on a scratch Supabase project, not on the day it is needed.

1. **Something was deleted or changed by mistake, the project is fine.** Restore the newest good dump into a local Postgres (above), read the rows you need there (`psql` in the container, or `COPY (select ...) TO STDOUT`) and put them back in the live database with the SQL editor. Do not load a whole dump over a live database.
2. **The project is gone (deleted, or paused for good).**
   1. Create a new Supabase project and apply the migrations in `supabase/migrations` in order (`supabase/README.md`), then run the seed only if you want the demo data.
   2. Set the Vault secrets `app_url` and `cron_secret` and the dashboard settings (SMTP, redirect URLs, templates). The storage buckets are created by migration `0003`.
   3. Load the data of the dump into the new database: restore the dump into a local Postgres as above, then dump **only the data** from there (`pg_dump --data-only --schema=public --schema=auth`) and load that into the new project. Users are in `auth.users`; the trigger that creates profiles does `on conflict do nothing`, so loading `profiles` as well is safe. Check the row counts at the end.
   4. Point the server's env file at the new project (`NEXT_PUBLIC_SUPABASE_URL`, the anon and service-role keys), rebuild the app, and put the same values in the Expo `preview` environment for the next APK.
   5. Uploaded files are gone with the old project unless they were copied separately (see below).

## Rate limits

The AI routes count each signed-in user's calls (table `rate_limits`, function `hit_rate_limit`, migration 0012). Over the limit the API answers `429 RATE_LIMITED` with a `Retry-After` header; the apps show the wait. If the counter itself fails or takes more than 2 seconds, the request goes through (fail open) and `rate_limit_check_failed` is logged. SOS is never limited, and mock runs (`LLM_MOCK=1`, `WEB_MOCK=1`) are not counted.

To let an account run without limits (the safety eval, the prewarm, recording the demo), put its user id in `RATE_LIMIT_EXEMPT_USER_IDS` in `apps/web/.env.production` (comma separated), then run the deploy command. Each exempt call logs `rate_limit_exempt` without the id. Remove the id afterwards.

## What is still missing

- **Uploaded files.** The images in Supabase Storage are not part of this backup. For the demo that is acceptable (the demo data is synthetic and can be re-uploaded); before real use, copy the two buckets too.
- **The backup stays on the same server as the app.** It protects against a mistake in the database, not against losing the server. Copy `~/vyana-backups` to another place from time to time (`scp` to a laptop is enough for now) and keep that copy private: it holds users and health data.

## Troubleshooting

| Message | What to do |
|---|---|
| `cannot read the env file` / `BACKUP_DATABASE_URL is not set` | Step 2 of the setup |
| `... is readable by other users (mode 644)` | `chmod 600 ~/.vyana-backup.env` |
| `cannot start docker` | Docker is not installed for this user: `groups` must show `docker`, or set `BACKUP_PG_DUMP=pg_dump` in the service with a PostgreSQL 17 client installed |
| `pg_dump failed (exit 1): ... password authentication failed` | The password in the file is wrong, or has characters that need percent-encoding |
| `pg_dump failed ... server version mismatch` | The Supabase project runs a newer Postgres than the image: change `DOCKER_IMAGE` in `backup-db.py` to the same major version |
| `pg_dump failed ... connection ... timeout` | Use the **session pooler** host and port 5432 (not the direct connection on an IPv6-only address, not port 6543) |
| `the dump ends too early` | The connection dropped during the dump; the old dumps are kept. Run it again |
| `the dump is only N bytes` | The connection string points to the wrong database or the user cannot read the schemas |

If the connection string was ever shown anywhere it should not have been, change the database password (Supabase dashboard → *Database* → *Reset database password*) and update `~/.vyana-backup.env`.

## Tests of the backup script

```bash
python3 -m unittest scripts/backup/test_backup_db.py -v
```

They use a fake `pg_dump` (no database, no network) and check the file modes, the retention, that the password is never on a command line or in an error message, and that a cut or tiny dump is refused. They do not replace the restore test above.

## Demo seed on the live database (rare, on purpose)

The demo accounts (`@vyana.test`) live on the live database on purpose, for the demo and the video. The seed script (`supabase/seed/seed-users.ts`) refuses a non-local Supabase URL unless `ALLOW_LIVE_SEED=yes` is set, and it only ever creates or updates `@vyana.test` accounts.

One password per role, each at least 16 characters. The names only — the values are set privately, never committed:

- `SEED_PASSWORD_PATIENT`
- `SEED_PASSWORD_DOCTOR`
- `SEED_PASSWORD_CAREGIVER`
- `SEED_PASSWORD_ADMIN`

To re-seed live (Piyush runs this):

```bash
ALLOW_LIVE_SEED=yes \
SEED_PASSWORD_PATIENT=<from-private-store> SEED_PASSWORD_DOCTOR=<from-private-store> \
SEED_PASSWORD_CAREGIVER=<from-private-store> SEED_PASSWORD_ADMIN=<from-private-store> \
SUPABASE_URL=<live-url> SUPABASE_SERVICE_ROLE_KEY=<live-service-key> \
  pnpm --filter @vyana/web exec tsx ../../supabase/seed/seed-users.ts
```

The script prints only the project ref, never a key. After a live re-seed, share the new passwords privately with the team, Kareena, and the E2E secret.
