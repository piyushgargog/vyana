#!/usr/bin/env python3
"""Nightly backup of the Supabase database (issue #116, see RUNBOOK.md).

What it does: reads the connection string from a small env file, runs `pg_dump` of the `public` and `auth`
schemas through the Supabase session pooler, gzips the result, checks that the dump is whole, keeps the newest
7 dumps and deletes older ones.

What it never does: print the connection string or the password (not on the command line, not in the log), or
leave a half-written dump behind. The dump holds users and health data, so it is written with mode 600 into a
directory with mode 700.

Only the Python standard library is used. `pg_dump` runs in a throw-away `postgres:17-alpine` container by default,
so the server needs Docker (it has it for the app) and no Postgres client of the right version.
"""

from __future__ import annotations

import datetime as dt
import gzip
import os
import shlex
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from urllib.parse import unquote, urlsplit

DEFAULT_ENV_FILE = Path.home() / ".vyana-backup.env"
DEFAULT_BACKUP_DIR = Path.home() / "vyana-backups"
KEEP = 7
NAME_PREFIX = "vyana-"
NAME_SUFFIX = ".sql.gz"
# What a complete plain-format dump ends with. A dump cut short (a dropped connection) does not have it.
END_MARKER = b"PostgreSQL database dump complete"
# Anything smaller than this is not a dump of this database (an empty schema list, an error page).
MIN_BYTES = 2_000

# Schemas that hold the app's data. Users (auth) are needed for logins to work after a restore.
SCHEMAS = ("public", "auth")
# Tables of sessions and tokens: secrets that are of no use in a backup (everybody signs in again after a restore).
SKIP_DATA = (
    "auth.refresh_tokens",
    "auth.sessions",
    "auth.one_time_tokens",
    "auth.flow_state",
    "auth.audit_log_entries",
    "auth.mfa_challenges",
)

DOCKER_IMAGE = "postgres:17-alpine"
PG_ENV = ("PGHOST", "PGPORT", "PGUSER", "PGPASSWORD", "PGDATABASE", "PGSSLMODE")


class BackupError(Exception):
    """A failure with a message that is safe to log."""


def read_env_value(path: Path, name: str) -> str:
    """The value of NAME in a KEY=VALUE file. The file is read as text, never run as a shell script."""
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError as error:
        raise BackupError(f"cannot read the env file {path}: {error.strerror}") from None
    for line in lines:
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        if key.strip() == name:
            value = value.strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
                value = value[1:-1]
            return value
    raise BackupError(f"{name} is not set in {path}")


def check_env_file_mode(path: Path) -> None:
    """The file holds the database password: refuse to use it if other users can read it."""
    if os.name == "nt":  # Windows has no Unix modes (the script runs on the Linux server; this keeps the tests runnable here)
        return
    mode = path.stat().st_mode & 0o777
    if mode & 0o077:
        raise BackupError(f"{path} is readable by other users (mode {mode:o}); run: chmod 600 {path}")


def pg_env_from_url(url: str) -> dict[str, str]:
    """Splits postgresql://user:password@host:port/db into the PG* variables libpq reads.

    The password goes to the process through the environment and never through the command line, where every user
    of the machine could see it with `ps`. Percent-encoding in the user and the password is decoded.
    """
    parts = urlsplit(url)
    if parts.scheme not in ("postgres", "postgresql"):
        raise BackupError("the connection string must start with postgresql://")
    if not parts.hostname or not parts.username or parts.password is None:
        raise BackupError("the connection string needs a host, a user and a password")
    return {
        "PGHOST": parts.hostname,
        "PGPORT": str(parts.port or 5432),
        "PGUSER": unquote(parts.username),
        "PGPASSWORD": unquote(parts.password),
        "PGDATABASE": unquote(parts.path.lstrip("/")) or "postgres",
        "PGSSLMODE": "require",
    }


def redact(text: str, secrets: list[str]) -> str:
    """Removes secrets from text before it is logged."""
    for secret in secrets:
        if secret:
            text = text.replace(secret, "***")
    return text


def pg_dump_args() -> list[str]:
    args = ["pg_dump", "--format=plain", "--no-owner", "--no-privileges"]
    args += [f"--schema={s}" for s in SCHEMAS]
    args += [f"--exclude-table-data={t}" for t in SKIP_DATA]
    return args


def dump_command() -> list[str]:
    """The pg_dump command: BACKUP_PG_DUMP overrides it (for example `pg_dump` from a local Postgres install)."""
    override = os.environ.get("BACKUP_PG_DUMP")
    if override:
        return shlex.split(override) + pg_dump_args()[1:]
    # `-e NAME` without a value passes the variable from this process: the password is not on the command line.
    docker = ["docker", "run", "--rm", "-i"]
    for name in PG_ENV:
        docker += ["-e", name]
    return docker + [DOCKER_IMAGE] + pg_dump_args()


def verify_dump(path: Path) -> None:
    """The file must be a whole gzip file whose last lines are the end of a plain pg_dump."""
    size = path.stat().st_size
    if size < MIN_BYTES:
        raise BackupError(f"the dump is only {size} bytes: not a dump of this database")
    tail = b""
    try:
        with gzip.open(path, "rb") as f:
            while chunk := f.read(1 << 20):
                tail = (tail + chunk)[-4096:]
    except (OSError, EOFError) as error:
        raise BackupError(f"the dump is not a valid gzip file: {error}") from None
    if END_MARKER not in tail:
        raise BackupError("the dump ends too early (the connection may have dropped)")


def prune(backup_dir: Path, keep: int = KEEP) -> list[Path]:
    """Deletes all but the newest `keep` dumps. Only files made by this script are touched."""
    dumps = sorted(p for p in backup_dir.iterdir() if p.name.startswith(NAME_PREFIX) and p.name.endswith(NAME_SUFFIX))
    removed = dumps[:-keep] if keep > 0 else dumps
    for old in removed:
        old.unlink()
    return removed


def run_backup(env_file: Path, backup_dir: Path, now: dt.datetime | None = None, keep: int = KEEP) -> Path:
    check_env_file_mode(env_file)
    url = read_env_value(env_file, "BACKUP_DATABASE_URL")
    pg_env = pg_env_from_url(url)
    secrets = [url, pg_env["PGPASSWORD"]]

    backup_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(backup_dir, 0o700)
    stamp = (now or dt.datetime.now(dt.timezone.utc)).strftime("%Y%m%d-%H%M%SZ")
    final = backup_dir / f"{NAME_PREFIX}{stamp}{NAME_SUFFIX}"
    partial = backup_dir / f".{final.name}.partial"

    command = dump_command()
    env = {**os.environ, **pg_env}
    try:
        fd = os.open(partial, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, "wb") as raw, gzip.GzipFile(fileobj=raw, mode="wb", compresslevel=6) as out:
            # stderr goes to a temporary file, not a pipe: a full pipe would stop pg_dump while we read its output.
            with tempfile.TemporaryFile() as err_file:
                try:
                    proc = subprocess.Popen(command, env=env, stdout=subprocess.PIPE, stderr=err_file)
                except OSError as error:
                    raise BackupError(f"cannot start {command[0]}: {error.strerror}") from None
                with proc:
                    assert proc.stdout is not None
                    shutil.copyfileobj(proc.stdout, out)
                    code = proc.wait()
                err_file.seek(0)
                stderr = err_file.read(65536).decode("utf-8", "replace")
        if code != 0:
            message = redact(stderr.strip().splitlines()[-1] if stderr.strip() else "no message", secrets)
            raise BackupError(f"pg_dump failed (exit {code}): {message}")
        verify_dump(partial)
        os.replace(partial, final)
    finally:
        if partial.exists():
            partial.unlink()

    removed = prune(backup_dir, keep)
    (backup_dir / "LAST_OK").write_text(f"{final.name}\n", encoding="utf-8")
    os.chmod(backup_dir / "LAST_OK", 0o600)
    print(f"ok: {final.name} ({final.stat().st_size} bytes), removed {len(removed)} old dump(s)")
    return final


def main() -> int:
    env_file = Path(os.environ.get("BACKUP_ENV_FILE", DEFAULT_ENV_FILE))
    backup_dir = Path(os.environ.get("BACKUP_DIR", DEFAULT_BACKUP_DIR))
    os.umask(0o077)
    try:
        run_backup(env_file, backup_dir)
    except BackupError as error:
        print(f"backup FAILED: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
