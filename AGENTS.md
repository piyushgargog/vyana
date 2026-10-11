# Working on Vyana: rules for coding agents

Read this before changing anything in this repository.

## Docs first, never guess

1. Read the docs that cover your change **before** writing code:
   - [`ARCHITECTURE.md`](ARCHITECTURE.md)
   - [`apps/web/openapi.yaml`](apps/web/openapi.yaml)
   - [`.github/CONTRIBUTING.md`](.github/CONTRIBUTING.md)
   - the team's private plan, if your human gave it to you (`PLAN.md` or `docs/`, both gitignored)
2. Build exactly what they describe. If the code has to differ, change the docs first (and say why), then the code.
3. Never invent routes, fields, tables, env vars or files that the docs don't describe. Ask your human.

## Contracts

- API shapes live in `packages/shared/src/contracts` (Zod). JSON is snake_case, matching the DB columns.
- After changing a contract, run `pnpm docs:openapi` and commit `apps/web/openapi.yaml`. CI fails if it is stale.
- Update the mocks in `packages/shared/src/mocks` in the same change.

## Ownership

Only edit files your human owns (see `.github/CODEOWNERS`). If you need a change elsewhere, write the exact request for your human to pass on.

## Framework versions

Next.js 16, Expo SDK 57, React 19.2.3 and Zod 4 differ from older training data:
- Read `apps/web/AGENTS.md` and `apps/mobile/AGENTS.md` first.
- In Next 16, middleware is `proxy.ts`.
- Add Expo packages only with `npx expo install`.

## Git

- Branch `<name>/<task-id>-<slug>`, small Conventional Commits, PR into `main`. Direct pushes to `main` are blocked.
- **Never add AI-tool attribution** (e.g. `Co-Authored-By` trailers or "Generated with …" lines) to commits, PRs or issues.
- Never commit secrets or `.env` files. Only `.env.example` is committed.

## Checks before you say "done"

`pnpm lint` · `pnpm typecheck` · `pnpm test` · update `CHANGELOG.md` (Unreleased) for user-visible changes.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
