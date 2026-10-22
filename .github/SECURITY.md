# Security Policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Report them privately through
[GitHub private vulnerability reporting](https://github.com/piyushgargog/vyana/security/advisories/new), or by email to piyushgarg@vyanahealth.app.
We will reply as soon as possible.

## How we protect this project

- **Secrets:** API keys (LLM, Supabase service role) live only in server-side environment variables. The mobile app and the browser never receive them.
- **Committed files:** only `.env.example` files are committed. Secret scanning with push protection is enabled, and CI runs a secret scan on every PR.
- **Data access:** Supabase Row Level Security restricts every table, so users can read only their own health data.
- **Blood requests:** the `blood_requests` table holds the contact name and phone number that a patient types for a request. Only its owner can read or change a row. Signed-in users can write only the listed columns, the database sets the id and timestamps, and signed-out visitors have no access. The rows are part of the data download.
- **Share link counters:** `open_count` and `last_opened_at` on a share link are written by the server only. They change through `bump_share_open`, a security-definer function that only the service role can run, so no signed-in user can change them. The count stores no viewer identity or address.
- **Health Memory Graph:** the `memory` section of a shared record is built from stored rows only (labs, vitals, medicines and dose logs), each capped in size. It contains no AI output.
- **Rate limits:** each signed-in user can call the AI and web-agent routes only so often (the assistant 20 times in 10 minutes, a prescription or report scan 10 times an hour, a care plan, symptom or interaction check 20 times an hour, a web-agent route such as prices, blood stock or doctor verification 10 times an hour, nearby emergency hospitals 30 times in 10 minutes). The check comes after the sign-in check and before any model or web-agent call; over the limit the API answers 429 `RATE_LIMITED` with a `Retry-After` header. SOS is never limited, and a counter that fails never blocks a patient (the request goes through and the failure is logged). The counters are in the database (`rate_limits`, readable by nobody but the server); see `supabase/README.md`.
- **Backups:** the server dumps the database every night (`pg_dump`, the last 7 kept) into a private directory outside the repository (files mode 600, directory 700). The connection string is in a private env file, is given to `pg_dump` through its environment and never appears on a command line or in a log. A restore into a local Postgres is tested; see [RUNBOOK.md](../RUNBOOK.md). Uploaded files are not part of the backup yet.
- **Code scanning:** CodeQL runs on every PR, and dependency review blocks known-vulnerable packages. Dependabot raises security updates.
- **Pipelines:** every workflow action is pinned to a full commit SHA and every workflow asks only for the permissions it needs; actionlint and zizmor audit the workflows, gitleaks and Trivy scan the history, the dependencies and the configuration, the Docker image is linted, scanned and checked to start as a non-root user, OWASP ZAP scans the live site passively every week, and an uptime check opens an `incident` issue after two failed checks in a row. Dependabot waits 5 days before proposing a new release (security updates come at once). Nothing is deployed from Actions.
- **Branch protection:** `main` is protected, so changes land only through reviewed pull requests with passing checks.

## Accepted risks

- **A secret in a URL (2026-10-14, issue #152): no longer applicable.** The medicine quality alerts feature, its webhook route and the `monitor:create` script were removed on 2026-10-20, so no secret travels in a URL any more.

- **Dev-toolchain audit exceptions (2026-10-14, issue #154):** `pnpm audit` reports GHSA-86w9-cpqp-85rv (node-forge, RSA signature verification), GHSA-vfj7-8cjw-p6xm (braces, ReDoS), GHSA-w5hq-g745-h8pq (uuid, buffer bounds) and GHSA-vcc3-ghjq-m6fr (decode-uri-component, DoS). All four reach us only through the Expo/mobile dev toolchain (`@expo/cli`, metro) and the web devDependencies (`eslint-config-next`); `pnpm why` confirms none of them is in the production web image, which ships only the Next.js standalone output. No patched version exists upstream yet. They are ignored in `auditConfig.ignoreGhsas` in `pnpm-workspace.yaml` (pnpm v11+ reads auditConfig only from there, not from `package.json`) and in `.trivyignore`. Re-check on Dependabot alerts; remove an ignore when a patched version exists.
