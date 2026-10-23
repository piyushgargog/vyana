#!/usr/bin/env python3
"""Scrub E2E demo-account credentials out of Playwright failure artifacts.

Context: the E2E workflow signs in to the live site with repository secrets
(E2E_PASSWORD_PATIENT / E2E_PASSWORD_DOCTOR). Playwright's `fill()` on the
password input records the value in the trace's DOM snapshots
(`__playwright_value_` attributes), so a retained `trace.zip` uploaded as a
GitHub artifact would carry the live demo-account passwords to anyone with
repo read access. This script rewrites every secret occurrence in
`test-results/` and `playwright-report/` (inside zip files and in plain text
files) as ***REDACTED*** before the upload step runs.

The secrets arrive as environment variables; they are never printed.

Usage (from the repo root):
    E2E_PASSWORD_PATIENT=... E2E_PASSWORD_DOCTOR=... \
        python3 .github/scripts/scrub-e2e-traces.py
"""

from __future__ import annotations

import os
import sys
import zipfile

REDACTED = "***REDACTED***"
TARGET_DIRS = ("test-results", "playwright-report")


def load_secrets() -> list[str]:
    secrets = [
        os.environ.get("E2E_PASSWORD_PATIENT", ""),
        os.environ.get("E2E_PASSWORD_DOCTOR", ""),
    ]
    return [s for s in secrets if s]


def scrub_text(text: str, secrets: list[str]) -> tuple[str, int]:
    count = 0
    for secret in secrets:
        occurrences = text.count(secret)
        if occurrences:
            text = text.replace(secret, REDACTED)
            count += occurrences
    return text, count


def scrub_bytes(data: bytes, secrets: list[str]) -> tuple[bytes, int]:
    count = 0
    for secret in secrets:
        raw = secret.encode("utf-8")
        occurrences = data.count(raw)
        if occurrences:
            data = data.replace(raw, REDACTED.encode("utf-8"))
            count += occurrences
    return data, count


def scrub_zip(path: str, secrets: list[str]) -> int:
    count = 0
    with zipfile.ZipFile(path, "r") as zin:
        entries = {name: zin.read(name) for name in zin.namelist()}
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as zout:
        for name, data in entries.items():
            try:
                data.decode("utf-8")
            except UnicodeDecodeError:
                # Binary entry (e.g. a screenshot): scrub at the byte level, which
                # leaves the bytes untouched when the secret is not present.
                data, found = scrub_bytes(data, secrets)
                count += found
                zout.writestr(name, data)
                continue
            text, found = scrub_text(data.decode("utf-8"), secrets)
            count += found
            zout.writestr(name, text.encode("utf-8"))
    return count


def scrub_file(path: str, secrets: list[str]) -> int:
    try:
        with open(path, encoding="utf-8") as handle:
            text = handle.read()
    except (UnicodeDecodeError, OSError):
        return 0
    scrubbed, count = scrub_text(text, secrets)
    if count:
        with open(path, "w", encoding="utf-8") as handle:
            handle.write(scrubbed)
    return count


def main() -> int:
    secrets = load_secrets()
    if not secrets:
        print("No E2E password env vars set; nothing to scrub.")
        return 0

    total = 0
    for base in TARGET_DIRS:
        if not os.path.isdir(base):
            continue
        for root, _dirs, files in os.walk(base):
            for filename in files:
                path = os.path.join(root, filename)
                if filename.endswith(".zip"):
                    total += scrub_zip(path, secrets)
                else:
                    total += scrub_file(path, secrets)

    print(f"Scrubbed {total} credential occurrence(s) from E2E failure artifacts.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
