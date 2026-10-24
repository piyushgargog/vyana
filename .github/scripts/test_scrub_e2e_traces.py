#!/usr/bin/env python3
"""Tests for scrub-e2e-traces.py (finding: the scrubber had no committed test).

Run from the repo root:
    python3 .github/scripts/test_scrub_e2e_traces.py
or in CI via the step in .github/workflows/e2e.yml.
"""

from __future__ import annotations

import base64
import html
import importlib.util
import json
import os
import sys
import tempfile
import unittest
import urllib.parse
import zipfile
from pathlib import Path

_SCRIPT = Path(__file__).with_name("scrub-e2e-traces.py")
_spec = importlib.util.spec_from_file_location("scrub_e2e_traces", _SCRIPT)
assert _spec is not None and _spec.loader is not None
scrub = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(scrub)

# A password exercising every escaping path: quote, backslash, &, non-ASCII.
SECRET = 'Demo&"Pass\\word\u20ac1'
ACCESS_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signaturepart"
REFRESH_TOKEN = "v1.refresh-token-value"


def forms_of(secret: str) -> dict[str, str]:
    return {
        "raw": secret,
        "url": urllib.parse.quote(secret, safe=""),
        "url_plus": urllib.parse.quote_plus(secret, safe=""),
        "json": json.dumps(secret, ensure_ascii=True)[1:-1],
        "html": html.escape(secret, quote=True),
        "base64": base64.b64encode(secret.encode("utf-8")).decode("ascii"),
        "base64_urlsafe": base64.urlsafe_b64encode(secret.encode("utf-8")).decode("ascii"),
    }


class ScrubTextTests(unittest.TestCase):
    def test_every_encoded_form_is_scrubbed(self) -> None:
        for name, form in forms_of(SECRET).items():
            with self.subTest(form=name):
                out, count = scrub.scrub_text(f"prefix {form} suffix", [SECRET])
                self.assertNotIn(form, out)
                self.assertIn(scrub.REDACTED, out)
                self.assertGreaterEqual(count, 1)

    def test_session_tokens_are_scrubbed(self) -> None:
        samples = [
            json.dumps({"access_token": ACCESS_TOKEN, "refresh_token": REFRESH_TOKEN, "keep": "me"}),
            '{\\"access_token\\":\\"' + ACCESS_TOKEN + '\\",\\"refresh_token\\":\\"' + REFRESH_TOKEN + '\\"}',
            f"Authorization: Bearer {ACCESS_TOKEN}",
            f"access_token={ACCESS_TOKEN}&refresh_token={REFRESH_TOKEN}",
            # Supabase local-storage session entry, JSON-escaped as in snapshots.
            '{\\"sb-proj-auth-token\\":\\"{\\\\\\"access_token\\\\\\":\\\\\\"'
            + ACCESS_TOKEN
            + '\\\\\\"}\\"}',
        ]
        for sample in samples:
            with self.subTest(sample=sample[:40]):
                out, _count = scrub.scrub_text(sample, [SECRET])
                self.assertNotIn(ACCESS_TOKEN, out)
                self.assertNotIn(REFRESH_TOKEN, out)

    def test_non_secret_content_survives(self) -> None:
        out, count = scrub.scrub_text("nothing sensitive here", [SECRET])
        self.assertEqual(out, "nothing sensitive here")
        self.assertEqual(count, 0)


class ScrubBytesAndFileTests(unittest.TestCase):
    def test_scrub_bytes_handles_binary(self) -> None:
        data = b"\x89PNG\x00\xff" + SECRET.encode("utf-8") + b"\x00end"
        out, count = scrub.scrub_bytes(data, [SECRET])
        self.assertNotIn(SECRET.encode("utf-8"), out)
        self.assertGreaterEqual(count, 1)
        self.assertTrue(out.startswith(b"\x89PNG"))

    def test_standalone_binary_file_is_scrubbed(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "screenshot.png")
            with open(path, "wb") as handle:
                handle.write(b"\xff\xd8\xff" + SECRET.encode("utf-8") + b"\xff\xd9")
            count = scrub.scrub_file(path, [SECRET])
            self.assertGreaterEqual(count, 1)
            with open(path, "rb") as handle:
                self.assertNotIn(SECRET.encode("utf-8"), handle.read())


class ScrubZipTests(unittest.TestCase):
    def test_synthetic_trace_zip(self) -> None:
        forms = forms_of(SECRET)
        trace = "\n".join(forms.values()) + f'\n{{"access_token": "{ACCESS_TOKEN}"}}\nBearer {ACCESS_TOKEN}'
        network = f"Authorization: Bearer {ACCESS_TOKEN}\nrefresh_token={REFRESH_TOKEN}"
        png = b"\x89PNG" + SECRET.encode("utf-8")
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "trace.zip")
            with zipfile.ZipFile(path, "w") as zout:
                zout.writestr("trace.trace", trace)
                zout.writestr("trace.network", network)
                zout.writestr("resources/shot.png", png)
                zout.writestr("page.html", f"<input value=\"{forms['html']}\">")
                # Duplicate entry name: both copies must survive and be scrubbed.
                zout.writestr("dup.txt", SECRET)
                zout.writestr("dup.txt", SECRET)
            scrub.scrub_zip(path, [SECRET])
            with zipfile.ZipFile(path, "r") as zin:
                self.assertEqual(zin.namelist().count("dup.txt"), 2)
                for name in zin.namelist():
                    data = zin.read(name)
                    self.assertNotIn(SECRET.encode("utf-8"), data, name)
                    self.assertNotIn(ACCESS_TOKEN.encode("utf-8"), data, name)
                    self.assertNotIn(REFRESH_TOKEN.encode("utf-8"), data, name)
                    for form in forms.values():
                        self.assertNotIn(form.encode("utf-8"), data, name)


class MainFailClosedTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self._cwd = os.getcwd()
        self._env = dict(os.environ)
        os.chdir(self._tmp.name)
        os.makedirs("test-results", exist_ok=True)

    def tearDown(self) -> None:
        os.chdir(self._cwd)
        os.environ.clear()
        os.environ.update(self._env)
        self._tmp.cleanup()

    def test_no_secrets_with_artifacts_fails(self) -> None:
        Path("test-results/trace.zip").write_bytes(b"anything")
        os.environ.pop("E2E_PASSWORD_PATIENT", None)
        os.environ.pop("E2E_PASSWORD_DOCTOR", None)
        self.assertEqual(scrub.main(), 1)

    def test_no_secrets_without_artifacts_passes(self) -> None:
        os.environ.pop("E2E_PASSWORD_PATIENT", None)
        os.environ.pop("E2E_PASSWORD_DOCTOR", None)
        self.assertEqual(scrub.main(), 0)

    def test_main_scrubs_and_verifies(self) -> None:
        Path("test-results/log.txt").write_text(f"pw={SECRET} token Bearer {ACCESS_TOKEN}", encoding="utf-8")
        os.environ["E2E_PASSWORD_PATIENT"] = SECRET
        os.environ.pop("E2E_PASSWORD_DOCTOR", None)
        self.assertEqual(scrub.main(), 0)
        text = Path("test-results/log.txt").read_text(encoding="utf-8")
        self.assertNotIn(SECRET, text)
        self.assertNotIn(ACCESS_TOKEN, text)


if __name__ == "__main__":
    unittest.main()
