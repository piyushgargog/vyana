#!/usr/bin/env python3
"""Scrub E2E demo-account credentials out of Playwright failure artifacts.

Context: the E2E workflow signs in to the live site with repository secrets
(E2E_PASSWORD_PATIENT / E2E_PASSWORD_DOCTOR). Playwright's `fill()` on the
password input records the value in the trace's DOM snapshots
(`__playwright_value_` attributes), so a retained `trace.zip` uploaded as a
GitHub artifact would carry the live demo-account passwords to anyone with
repo read access. A signed-in trace carries more than the passwords: the
Supabase auth exchange in `trace.network` / `resources/` and the session in
snapshots hold live access / refresh tokens (`access_token` /
`refresh_token` values, the `sb-*-auth-token` local-storage entry,
`Authorization: Bearer ...` headers). This script rewrites every such
occurrence in `test-results/` and `playwright-report/` (inside zip files,
in plain text files and in standalone binary files such as screenshots)
as ***REDACTED*** before the upload step runs.

For each password, the raw value and its encoded / escaped forms are
scrubbed: URL-encoded (percent and `+`), JSON-escaped (quotes, backslash
and ``\\uXXXX``), HTML-escaped (`&quot;`, `&amp;`, ...) and base64
(standard and URL-safe, padded and unpadded).

The script fails closed:

- if artifact directories exist and are non-empty but no secret values
  are loaded, it exits non-zero (a renamed / dropped env var must not
  silently disable the scrub);
- an unreadable or corrupt artifact (e.g. a `trace.zip` left partially
  written by a killed run) exits non-zero instead of being skipped;
- after scrubbing, a verification pass re-scans every artifact and
  exits non-zero if any secret variant or token value is still present.

The workflow gates the artifact upload on this step succeeding, so a
failure here means no artifact is published at all. The secrets arrive
as environment variables; they are never printed.

Usage (from the repo root):
    E2E_PASSWORD_PATIENT=... E2E_PASSWORD_DOCTOR=... \
        python3 .github/scripts/scrub-e2e-traces.py
"""

from __future__ import annotations

import base64
import html
import json
import os
import re
import sys
import urllib.parse
import zipfile

REDACTED = "***REDACTED***"
REDACTED_B = REDACTED.encode("utf-8")
TARGET_DIRS = ("test-results", "playwright-report")

_TOKEN_FIELDS = (
    "access_token|refresh_token|provider_token|provider_refresh_token"
    "|accessToken|refreshToken"
)

# Token-shaped material, independent of the configured passwords. Each
# pattern keeps the key / prefix in group 1, the secret value in group 2
# and any closing quote in the last group, so the value alone is replaced.
_TEXT_TOKEN_PATTERNS = [
    # JSON, plain or escaped at any depth (the sb-*-auth-token
    # local-storage entry holds the session as a JSON string inside the
    # snapshot JSON, so its fields arrive double-escaped):
    # "access_token": "v" / \"access_token\":\"v\" / \\\"access_token\\\":\\\"v\\\"
    (
        re.compile(
            r'(\\*"(?:' + _TOKEN_FIELDS + r')\\*"\s*:\s*\\*")([^"\\]+)(\\*")',
            re.IGNORECASE,
        ),
        3,
    ),
    # Single-quoted: 'refresh_token': 'v'
    (
        re.compile(
            r"('(?:" + _TOKEN_FIELDS + r")'\s*:\s*')([^']+)(')",
            re.IGNORECASE,
        ),
        3,
    ),
    # Form / query encoded: access_token=v&... / refresh_token=v
    (
        re.compile(
            r"((?:access_token|refresh_token)\s*=\s*)([^&\s\"'<>;,]+)",
            re.IGNORECASE,
        ),
        2,
    ),
    # Authorization / bare bearer token: Bearer <jwt>
    (
        re.compile(r"(\bBearer\s+)([A-Za-z0-9\-_\.+/=]{8,})", re.IGNORECASE),
        2,
    ),
]

_BYTES_TOKEN_PATTERNS = [
    (re.compile(pattern.pattern.encode("utf-8"), re.IGNORECASE), last_group)
    for pattern, last_group in _TEXT_TOKEN_PATTERNS
]


def load_secrets() -> list[str]:
    secrets = [
        os.environ.get("E2E_PASSWORD_PATIENT", ""),
        os.environ.get("E2E_PASSWORD_DOCTOR", ""),
    ]
    return [s for s in secrets if s]


def secret_variants(secret: str) -> list[str]:
    """Every textual form a secret can take inside a trace artifact."""
    variants = {
        secret,
        # URL-encoded, in a query string or a form-encoded body.
        urllib.parse.quote(secret, safe=""),
        urllib.parse.quote_plus(secret, safe=""),
        # HTML-escaped, inside DOM snapshot attribute values.
        html.escape(secret, quote=True),
        secret.replace("&", "&amp;").replace('"', "&quot;").replace("'", "&#39;"),
        secret.replace("&", "&amp;").replace('"', "&quot;").replace("'", "&apos;"),
        # JSON-escaped, inside request post-data and network records.
        json.dumps(secret, ensure_ascii=True)[1:-1],
        json.dumps(secret, ensure_ascii=False)[1:-1],
        # Base64, standard and URL-safe, with and without padding.
        base64.b64encode(secret.encode("utf-8")).decode("ascii"),
        base64.urlsafe_b64encode(secret.encode("utf-8")).decode("ascii"),
        base64.b64encode(secret.encode("utf-8")).decode("ascii").rstrip("="),
        base64.urlsafe_b64encode(secret.encode("utf-8")).decode("ascii").rstrip("="),
    }
    # Longest first, so an encoded form is replaced whole rather than a
    # raw substring inside it being replaced first.
    return sorted((v for v in variants if v), key=len, reverse=True)


def _all_variants(secrets: list[str]) -> list[str]:
    variants: list[str] = []
    for secret in secrets:
        for variant in secret_variants(secret):
            if variant not in variants:
                variants.append(variant)
    return sorted(variants, key=len, reverse=True)


def scrub_text(text: str, secrets: list[str]) -> tuple[str, int]:
    count = 0
    for variant in _all_variants(secrets):
        occurrences = text.count(variant)
        if occurrences:
            text = text.replace(variant, REDACTED)
            count += occurrences
    for pattern, _last_group in _TEXT_TOKEN_PATTERNS:
        def _replace(match: re.Match[str]) -> str:
            nonlocal count
            if match.group(2) == REDACTED:
                return match.group(0)
            count += 1
            groups = [match.group(i) or "" for i in range(1, pattern.groups + 1)]
            groups[1] = REDACTED
            return "".join(groups)

        text = pattern.sub(_replace, text)
    return text, count


def scrub_bytes(data: bytes, secrets: list[str]) -> tuple[bytes, int]:
    count = 0
    for variant in _all_variants(secrets):
        raw = variant.encode("utf-8")
        occurrences = data.count(raw)
        if occurrences:
            data = data.replace(raw, REDACTED_B)
            count += occurrences
    for pattern, _last_group in _BYTES_TOKEN_PATTERNS:
        def _replace(match: re.Match[bytes]) -> bytes:
            nonlocal count
            if match.group(2) == REDACTED_B:
                return match.group(0)
            count += 1
            groups = [match.group(i) or b"" for i in range(1, pattern.groups + 1)]
            groups[1] = REDACTED_B
            return b"".join(groups)

        data = pattern.sub(_replace, data)
    return data, count


def scrub_zip(path: str, secrets: list[str]) -> int:
    count = 0
    with zipfile.ZipFile(path, "r") as zin:
        # Read entry by entry (not by name) so duplicate entry names are
        # preserved, and keep the original ZipInfo (timestamp, attributes,
        # compression) when rewriting.
        entries: list[tuple[zipfile.ZipInfo, bytes]] = []
        for info in zin.infolist():
            with zin.open(info) as entry:
                entries.append((info, entry.read()))
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as zout:
        for info, data in entries:
            data, found = scrub_bytes(data, secrets)
            count += found
            zout.writestr(info, data)
    return count


def scrub_file(path: str, secrets: list[str]) -> int:
    # Read and scrub as bytes so standalone binary artifacts (failure
    # screenshots, videos) are scrubbed too, not silently skipped.
    # An unreadable file raises OSError to the caller: fail closed.
    with open(path, "rb") as handle:
        data = handle.read()
    scrubbed, count = scrub_bytes(data, secrets)
    if count:
        with open(path, "wb") as handle:
            handle.write(scrubbed)
    return count


def _iter_artifact_files() -> list[str]:
    paths: list[str] = []
    for base in TARGET_DIRS:
        if not os.path.isdir(base):
            continue
        for root, _dirs, files in os.walk(base):
            for filename in sorted(files):
                paths.append(os.path.join(root, filename))
    return paths


def _leftover_in_bytes(data: bytes, variants_b: list[bytes]) -> bool:
    for raw in variants_b:
        if raw in data:
            return True
    for pattern, _last_group in _BYTES_TOKEN_PATTERNS:
        for match in pattern.finditer(data):
            if match.group(2) != REDACTED_B:
                return True
    return False


def verify_scrubbed(secrets: list[str]) -> list[str]:
    """Re-scan every artifact; return paths still holding secret material."""
    variants_b = [v.encode("utf-8") for v in _all_variants(secrets)]
    leftovers: list[str] = []
    for path in _iter_artifact_files():
        if path.endswith(".zip"):
            with zipfile.ZipFile(path, "r") as zin:
                for info in zin.infolist():
                    with zin.open(info) as entry:
                        if _leftover_in_bytes(entry.read(), variants_b):
                            leftovers.append(path)
                            break
        else:
            with open(path, "rb") as handle:
                if _leftover_in_bytes(handle.read(), variants_b):
                    leftovers.append(path)
    return leftovers


def main() -> int:
    secrets = load_secrets()
    artifact_files = _iter_artifact_files()
    if not secrets:
        if artifact_files:
            print(
                "E2E password env vars are not set but failure artifacts "
                "exist; refusing to let them upload unscrubbed.",
                file=sys.stderr,
            )
            return 1
        print("No E2E password env vars set; nothing to scrub.")
        return 0

    total = 0
    try:
        for path in artifact_files:
            if path.endswith(".zip"):
                total += scrub_zip(path, secrets)
            else:
                total += scrub_file(path, secrets)
    except (OSError, zipfile.BadZipFile) as error:
        # Never print the error's payload: it may quote artifact content.
        print(
            f"Scrubbing failed ({type(error).__name__}); "
            "failure artifacts must not upload.",
            file=sys.stderr,
        )
        return 1

    leftovers = verify_scrubbed(secrets)
    if leftovers:
        print(
            "Scrub verification failed: secret material is still present "
            f"in {len(leftovers)} artifact file(s); refusing upload.",
            file=sys.stderr,
        )
        return 1

    print(f"Scrubbed {total} credential occurrence(s) from E2E failure artifacts.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
