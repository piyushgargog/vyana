#!/usr/bin/env bash
# Restores a backup into a throw-away local Postgres and checks that the data is there (issue #116, RUNBOOK.md).
#
#   scripts/backup/restore-check.sh                      # the newest dump in ~/vyana-backups
#   scripts/backup/restore-check.sh path/to/dump.sql.gz  # a given dump
#
# Needs Docker. The Postgres container has no published port and no password and is removed at the end, so
# nothing of the backup stays on the machine except the dump itself. The database in the dump is NOT touched.
set -euo pipefail
umask 077

DIR="${BACKUP_DIR:-$HOME/vyana-backups}"
DUMP="${1:-}"
if [ -z "$DUMP" ]; then
  DUMP="$(ls -1 "$DIR"/vyana-*.sql.gz 2>/dev/null | sort | tail -n 1 || true)"
fi
if [ -z "$DUMP" ] || [ ! -f "$DUMP" ]; then
  echo "No dump found. Pass a file, or set BACKUP_DIR (now: $DIR)." >&2
  exit 2
fi
gzip -t "$DUMP"
echo "Restoring $(basename "$DUMP") ($(du -h "$DUMP" | cut -f1))"

NAME="vyana-restore-check-$$"
LOG="$(mktemp)"
cleanup() {
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  rm -f "$LOG"
}
trap cleanup EXIT

docker run -d --name "$NAME" -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17-alpine >/dev/null

# The image starts a temporary server, then restarts: wait for the second "ready".
for _ in $(seq 1 60); do
  ready="$(docker logs "$NAME" 2>&1 | grep -c 'database system is ready to accept connections' || true)"
  [ "$ready" -ge 2 ] && break
  sleep 1
done
[ "${ready:-0}" -ge 2 ] || { echo "The test database did not start." >&2; exit 3; }

psql_in() { docker exec -i "$NAME" psql -U postgres -d postgres -X -q "$@"; }

# What Supabase has and a plain Postgres does not: its roles, and the extensions the tables use.
psql_in -v ON_ERROR_STOP=1 <<'SQL'
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role authenticator noinherit login;
create role supabase_auth_admin nologin;
create schema extensions;
create extension pgcrypto with schema extensions;
create extension "uuid-ossp" with schema extensions;
SQL

# Restore. Errors are collected, not fatal, so one problem does not hide the rest.
gzip -dc "$DUMP" | psql_in -v ON_ERROR_STOP=0 >/dev/null 2>"$LOG" || true
errors="$(grep -c 'ERROR' "$LOG" || true)"

echo
echo "Rows restored:"
psql_in -At -F ' = ' <<'SQL'
select 'auth.users', count(*) from auth.users
union all select 'profiles', count(*) from public.profiles
union all select 'prescriptions', count(*) from public.prescriptions
union all select 'prescription_items', count(*) from public.prescription_items
union all select 'dose_logs', count(*) from public.dose_logs
union all select 'consents', count(*) from public.consents
union all select 'hospitals', count(*) from public.hospitals;
SQL

users="$(psql_in -At -c 'select count(*) from auth.users' || echo 0)"
profiles="$(psql_in -At -c 'select count(*) from public.profiles' || echo 0)"
hospitals="$(psql_in -At -c 'select count(*) from public.hospitals' || echo 0)"
policies="$(psql_in -At -c "select count(*) from pg_policies where schemaname = 'public'" || echo 0)"

echo
echo "Policies on public tables: $policies"
echo "Errors while restoring: $errors"
if [ "$errors" -gt 0 ]; then
  echo "First errors:"
  grep 'ERROR' "$LOG" | head -n 15
fi

if [ "$users" -gt 0 ] && [ "$profiles" -gt 0 ] && [ "$hospitals" -gt 0 ] && [ "$policies" -gt 0 ] && [ "$errors" -eq 0 ]; then
  echo "RESTORE OK"
else
  echo "RESTORE NEEDS A LOOK (see above)" >&2
  exit 1
fi
