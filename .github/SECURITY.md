# Security Policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Report them privately through
[GitHub private vulnerability reporting](https://github.com/piyushgargog/vyana/security/advisories/new), or by email to piyushgarg@vyanahealth.app.
We will reply as soon as possible.

## How we protect this project

- **Secrets:** API keys (TinyFish, LLM, Supabase service role) live only in server-side environment variables. The mobile app and the browser never receive them.
- **Committed files:** only `.env.example` files are committed. Secret scanning with push protection is enabled, and CI runs a secret scan on every PR.
- **Data access:** Supabase Row Level Security restricts every table, so users can read only their own health data.
- **Backups:** the server dumps the database every night (`pg_dump`, the last 7 kept) into a private directory outside the repository (files mode 600, directory 700). The connection string is in a private env file, is given to `pg_dump` through its environment and never appears on a command line or in a log. A restore into a local Postgres is tested; see [RUNBOOK.md](../RUNBOOK.md). Uploaded files are not part of the backup yet.
- **Code scanning:** CodeQL runs on every PR, and dependency review blocks known-vulnerable packages. Dependabot raises security updates.
- **Pipelines:** every workflow action is pinned to a full commit SHA and every workflow asks only for the permissions it needs; actionlint and zizmor audit the workflows, gitleaks and Trivy scan the history, the dependencies and the configuration, the Docker image is linted, scanned and checked to start as a non-root user, OWASP ZAP scans the live site passively every week, and an uptime check opens an `incident` issue after two failed checks in a row. Dependabot waits 5 days before proposing a new release (security updates come at once). Nothing is deployed from Actions.
- **Branch protection:** `main` is protected, so changes land only through reviewed pull requests with passing checks.

## Accepted risks

- **TinyFish monitor webhook secret in the URL (2026-10-14, issue #152):** the TinyFish Monitor API accepts only a `webhook_url` for delivery — no custom headers and no request signing (checked against [the Monitor docs](https://docs.tinyfish.ai/monitor) and the MCP server tool definitions). So the monitor secret travels as `?secret=...` on `POST /api/webhooks/tinyfish-monitor`, and URLs end up in logs (Caddy, Cloudflare, TinyFish). To contain it: the route never logs the URL (the request log carries only the route name, a request id and the status), and the Caddy access log redacts the `secret` query value (`log` → `format filter` → `request>uri query { replace secret REDACTED }` in `Caddyfile`). The secret itself is a long random value that can be rotated by re-running `pnpm monitor:create`. Re-check if TinyFish adds webhook headers or signing; switch to `Authorization: Bearer` then.
