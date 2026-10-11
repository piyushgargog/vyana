# Changelog

All notable changes to Vyana are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- README and ARCHITECTURE describe the full feature set (token booking, prescription basket delivery, care plans, caregiver mode, privacy controls) and the AI safety approach.
- Architecture overview (`ARCHITECTURE.md`) and a generated OpenAPI reference for the HTTP API (`apps/web/openapi.yaml`, `pnpm docs:openapi`); CI checks that the reference matches the contracts.
- `@vyana/shared`: Zod request/response contracts for every API route, realistic mock fixtures, a typed API client with mock mode, `ApiProvider`/`useApi`, and React Query hooks for every route.
- Monorepo: Next.js 16 web app, Expo SDK 57 mobile app and the shared package, wired with pnpm workspaces and Turborepo.
- CI on every pull request: lint, typecheck, tests, web build, expo-doctor, CodeQL, secret scanning, dependency review, PR title check and auto-labels.
- Repository basics: README, MIT license, contributing guide, security policy, issue and PR templates, CODEOWNERS, Dependabot.

### Fixed
- API client: trailing-slash trimming no longer uses a regex flagged as a potential ReDoS.
- Shared React modules are marked as client modules, so Next.js server components can import `@vyana/shared`.
