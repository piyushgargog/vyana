# Security Policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Report them privately through
[GitHub private vulnerability reporting](https://github.com/piyushgargog/vyana/security/advisories/new), or by email to piyushgarg@vyanahealth.app.
We will reply as soon as possible.

## How we protect this project

- **Secrets:** API keys (TinyFish, LLM, Supabase service role) live only in server-side environment variables. The mobile app and the browser never receive them.
- **Committed files:** only `.env.example` files are committed. Secret scanning with push protection is enabled, and CI runs a secret scan on every PR.
- **Data access:** Supabase Row Level Security restricts every table, so users can read only their own health data.
- **Code scanning:** CodeQL runs on every PR, and dependency review blocks known-vulnerable packages. Dependabot raises security updates.
- **Branch protection:** `main` is protected, so changes land only through reviewed pull requests with passing checks.
