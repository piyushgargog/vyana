"""Tests of backup-db.py with a fake pg_dump (no database, no network).

Run:  python3 -m unittest scripts/backup/test_backup_db.py -v     (from the repository root)
"""

import datetime as dt
import gzip
import hashlib
import importlib.util
import io
import os
import stat
import sys
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from unittest import mock
from urllib.parse import quote

HERE = Path(__file__).parent
spec = importlib.util.spec_from_file_location("backup_db", HERE / "backup-db.py")
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)

PASSWORD = "p@ss/word:with$pecial&chars"  # percent-encoded in the URL below
# Built from parts at run time: a whole connection string with a password in the source is what secret scanners look for.
HOST = "aws-0-ap-south-1.pooler.supabase.com"
URL = "".join(["postgresql", "://", "postgres.abcdef", ":", quote(PASSWORD, safe=""), "@", HOST, ":5432/postgres"])
# Lines that do not compress to nothing, like real rows (the script refuses a dump under 2 KB once compressed).
ROWS = "".join(hashlib.sha256(str(i).encode()).hexdigest() + "\n" for i in range(400))
GOOD_DUMP = "-- PostgreSQL database dump\n" + "COPY public.profiles (id) FROM stdin;\n" + ROWS + "\\.\n\n-- PostgreSQL database dump complete\n"

# A stand-in for pg_dump: prints a dump, or what the test asks for, and records how it was called.
FAKE = r'''
import json, os, sys
mode = os.environ.get("FAKE_MODE", "good")
with open(os.environ["FAKE_LOG"], "w") as log:
    json.dump({"argv": sys.argv[1:], "PGHOST": os.environ.get("PGHOST"), "PGPORT": os.environ.get("PGPORT"),
               "PGUSER": os.environ.get("PGUSER"), "PGPASSWORD": os.environ.get("PGPASSWORD"),
               "PGDATABASE": os.environ.get("PGDATABASE"), "PGSSLMODE": os.environ.get("PGSSLMODE")}, log)
if mode == "good":
    sys.stdout.write(os.environ["FAKE_DUMP"])
elif mode == "cut":
    sys.stdout.write(os.environ["FAKE_DUMP"].replace("-- PostgreSQL database dump complete", ""))
elif mode == "tiny":
    sys.stdout.write("-- PostgreSQL database dump complete\n")
elif mode == "fail":
    sys.stdout.write("-- PostgreSQL database dump\nCOPY")
    sys.stderr.write("pg_dump: error: connection to server failed: password authentication failed " + os.environ["PGPASSWORD"] + "\n")
    sys.exit(1)
'''


class BackupTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.fake = self.tmp / "fake_pg_dump.py"
        self.fake.write_text(FAKE)
        self.log = self.tmp / "call.json"
        self.env_file = self.tmp / "backup.env"
        self.env_file.write_text(f"# comment\nOTHER=1\nBACKUP_DATABASE_URL={URL}\n")
        os.chmod(self.env_file, 0o600)
        self.dir = self.tmp / "backups"
        patcher = mock.patch.dict(
            os.environ,
            {"BACKUP_PG_DUMP": f'"{sys.executable}" "{self.fake}"', "FAKE_LOG": str(self.log), "FAKE_DUMP": GOOD_DUMP, "FAKE_MODE": "good"},
        )
        patcher.start()
        self.addCleanup(patcher.stop)

    def run_backup(self, **kw):
        out = io.StringIO()
        with redirect_stdout(out):
            return backup.run_backup(self.env_file, self.dir, **kw), out.getvalue()

    # ------------------------------------------------------------------ a good night
    def test_writes_a_gzip_dump_that_reads_back(self):
        path, out = self.run_backup(now=dt.datetime(2026, 10, 14, 21, 0, 5, tzinfo=dt.timezone.utc))
        self.assertEqual(path.name, "vyana-20261014-210005Z.sql.gz")
        self.assertEqual(gzip.open(path, "rt").read(), GOOD_DUMP)
        self.assertIn("ok: vyana-20261014-210005Z.sql.gz", out)
        self.assertEqual((self.dir / "LAST_OK").read_text().strip(), path.name)

    @unittest.skipIf(os.name == "nt", "Unix modes")
    def test_files_are_private(self):
        path, _ = self.run_backup()
        self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o600)
        self.assertEqual(stat.S_IMODE(self.dir.stat().st_mode), 0o700)
        self.assertEqual(stat.S_IMODE((self.dir / "LAST_OK").stat().st_mode), 0o600)

    def test_the_password_reaches_pg_dump_only_through_the_environment(self):
        self.run_backup()
        import json

        call = json.loads(self.log.read_text())
        self.assertEqual(call["PGPASSWORD"], PASSWORD)  # decoded from the percent-encoding
        self.assertEqual((call["PGHOST"], call["PGPORT"], call["PGUSER"], call["PGDATABASE"]), ("aws-0-ap-south-1.pooler.supabase.com", "5432", "postgres.abcdef", "postgres"))
        self.assertEqual(call["PGSSLMODE"], "require")
        self.assertNotIn(PASSWORD, " ".join(call["argv"]))
        self.assertNotIn("pooler.supabase.com", " ".join(call["argv"]))

    def test_dumps_the_public_and_auth_schemas_without_session_data(self):
        import json

        self.run_backup()
        argv = json.loads(self.log.read_text())["argv"]
        self.assertIn("--schema=public", argv)
        self.assertIn("--schema=auth", argv)
        self.assertIn("--no-owner", argv)
        self.assertIn("--no-privileges", argv)
        self.assertIn("--exclude-table-data=auth.refresh_tokens", argv)
        self.assertIn("--exclude-table-data=auth.sessions", argv)

    def test_the_default_command_runs_pg_dump_in_docker_with_the_password_from_the_environment(self):
        with mock.patch.dict(os.environ):
            os.environ.pop("BACKUP_PG_DUMP")
            command = backup.dump_command()
        self.assertEqual(command[:4], ["docker", "run", "--rm", "-i"])
        self.assertIn("postgres:17-alpine", command)
        self.assertIn("PGPASSWORD", command)  # "-e PGPASSWORD": a name, not a value
        self.assertNotIn(PASSWORD, " ".join(command))

    # ------------------------------------------------------------------ retention
    def test_keeps_the_newest_seven_and_only_touches_its_own_files(self):
        self.dir.mkdir(mode=0o700)
        for day in range(1, 11):
            (self.dir / f"vyana-202610{day:02d}-210000Z.sql.gz").write_bytes(b"old")
        (self.dir / "notes.txt").write_text("not a dump")
        path, out = self.run_backup(now=dt.datetime(2026, 10, 14, 21, 0, 0, tzinfo=dt.timezone.utc))
        left = sorted(p.name for p in self.dir.iterdir() if p.name.endswith(".sql.gz"))
        self.assertEqual(len(left), 7)
        self.assertEqual(left[-1], path.name)
        self.assertNotIn("vyana-20261001-210000Z.sql.gz", left)
        self.assertTrue((self.dir / "notes.txt").exists())
        self.assertIn("removed 4 old dump(s)", out)

    # ------------------------------------------------------------------ a bad night keeps the old dumps
    def test_a_failed_dump_leaves_nothing_behind_and_keeps_the_old_ones(self):
        self.dir.mkdir(mode=0o700)
        old = self.dir / "vyana-20261013-210000Z.sql.gz"
        old.write_bytes(b"yesterday")
        os.environ["FAKE_MODE"] = "fail"
        with self.assertRaises(backup.BackupError) as raised:
            self.run_backup()
        self.assertTrue(old.exists())
        self.assertEqual(sorted(p.name for p in self.dir.iterdir()), [old.name])  # no partial file, no LAST_OK

    def test_error_text_never_contains_the_password_or_the_url(self):
        os.environ["FAKE_MODE"] = "fail"
        with self.assertRaises(backup.BackupError) as raised:
            self.run_backup()
        text = str(raised.exception)
        self.assertNotIn(PASSWORD, text)
        self.assertNotIn(URL, text)
        self.assertIn("***", text)

    def test_a_dump_that_ends_early_is_refused(self):
        os.environ["FAKE_MODE"] = "cut"
        with self.assertRaisesRegex(backup.BackupError, "ends too early"):
            self.run_backup()
        self.assertEqual(list(self.dir.glob("vyana-*")), [])

    def test_a_tiny_dump_is_refused(self):
        os.environ["FAKE_MODE"] = "tiny"
        with self.assertRaisesRegex(backup.BackupError, "not a dump of this database"):
            self.run_backup()

    def test_a_missing_pg_dump_is_an_error_not_a_crash(self):
        os.environ["BACKUP_PG_DUMP"] = "this-command-does-not-exist-vyana"
        with self.assertRaisesRegex(backup.BackupError, "cannot start"):
            self.run_backup()

    # ------------------------------------------------------------------ the env file
    def test_a_missing_variable_or_file_is_named(self):
        self.env_file.write_text("OTHER=1\n")
        with self.assertRaisesRegex(backup.BackupError, "BACKUP_DATABASE_URL is not set"):
            self.run_backup()
        with self.assertRaisesRegex(backup.BackupError, "cannot read the env file"):
            backup.run_backup(self.tmp / "missing.env", self.dir)

    @unittest.skipIf(os.name == "nt", "Unix modes")
    def test_an_env_file_that_others_can_read_is_refused(self):
        os.chmod(self.env_file, 0o644)
        with self.assertRaisesRegex(backup.BackupError, "chmod 600"):
            self.run_backup()

    def test_the_env_file_is_read_as_text_not_run(self):
        marker = self.tmp / "ran"
        self.env_file.write_text(f'BACKUP_DATABASE_URL="{URL}"\nX=$(touch {marker})\n')
        self.run_backup()
        self.assertFalse(marker.exists())

    def test_a_bad_connection_string_is_refused_without_echoing_it(self):
        for bad in ["mysql" + "://u:p@h/db", "postgresql" + "://host/db", "postgresql" + "://user@host/db", "not a url"]:
            with self.subTest(bad=bad):
                self.env_file.write_text(f"BACKUP_DATABASE_URL={bad}\n")
                with self.assertRaises(backup.BackupError) as raised:
                    self.run_backup()
                self.assertNotIn(bad, str(raised.exception))

    # ------------------------------------------------------------------ main()
    def test_main_returns_1_and_prints_to_stderr_on_failure(self):
        os.environ["BACKUP_ENV_FILE"] = str(self.env_file)
        os.environ["BACKUP_DIR"] = str(self.dir)
        os.environ["FAKE_MODE"] = "fail"
        err = io.StringIO()
        with redirect_stderr(err):
            self.assertEqual(backup.main(), 1)
        self.assertIn("backup FAILED", err.getvalue())
        self.assertNotIn(PASSWORD, err.getvalue())

    def test_main_returns_0_on_success(self):
        os.environ["BACKUP_ENV_FILE"] = str(self.env_file)
        os.environ["BACKUP_DIR"] = str(self.dir)
        with redirect_stdout(io.StringIO()):
            self.assertEqual(backup.main(), 0)


if __name__ == "__main__":
    unittest.main()
