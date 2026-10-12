# Changelog

All notable changes to Vyana are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Backend foundations: one error format for every API route, bearer-token sign-in checks with roles, a shared cache for public web results, and `apps/web/.env.example`.
- AI safety checks: extracted values must quote text found in the document, links are limited to pages the server actually fetched, and emergency warning signs (English, Hindi, Hinglish) are detected by fixed rules before any model runs.
- API contracts, mocks, client methods and hooks for prescription basket pricing, care plans, interaction checks, symptom triage, hospital OPD info, PM-JAY hospitals, share links, data export and account deletion.
- AI safety fields in the contracts: every AI response carries model and prompt metadata, and extracted prescription items and lab values carry their source text and a `needs_review` flag.
- README and ARCHITECTURE describe the full feature set (token booking, prescription basket delivery, care plans, caregiver mode, privacy controls) and the AI safety approach.
- Architecture overview (`ARCHITECTURE.md`) and a generated OpenAPI reference for the HTTP API (`apps/web/openapi.yaml`, `pnpm docs:openapi`); CI checks that the reference matches the contracts.
- `@vyana/shared`: Zod request/response contracts for every API route, realistic mock fixtures, a typed API client with mock mode, `ApiProvider`/`useApi`, and React Query hooks for every route.
- Monorepo: Next.js 16 web app, Expo SDK 57 mobile app and the shared package, wired with pnpm workspaces and Turborepo.
- CI on every pull request: lint, typecheck, tests, web build, expo-doctor, CodeQL, secret scanning, dependency review, PR title check and auto-labels.
- Repository basics: README, MIT license, contributing guide, security policy, issue and PR templates, CODEOWNERS, Dependabot.
- Code of Conduct (Contributor Covenant 2.1), accessibility statement (`.github/ACCESSIBILITY.md`) and an accessibility issue template.

### Changed
- ARCHITECTURE documents privacy before AI and the verified interaction table.

### Removed
- The standalone diet-plan endpoint; diet guidance is now part of the care plan.

### Security
- Third-party GitHub Actions are pinned to full commit SHAs.
- Vitest upgraded to 4.1.11 (GHSA-82fw-gwwq-j7x9, development only).

### Fixed
- API client: trailing-slash trimming no longer uses a regex flagged as a potential ReDoS.
- Shared React modules are marked as client modules, so Next.js server components can import `@vyana/shared`.
