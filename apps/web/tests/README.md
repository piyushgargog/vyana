# Backend tests

Tests for the API in `apps/web/app/api/**` and the server code in `apps/web/lib/server/**`. They run with Vitest as part of `pnpm test` and in CI on every pull request.

## Layout

```
tests/
├─ unit/          # one service at a time, external clients mocked (TinyFish, LLM, Supabase)
├─ integration/   # route handlers end to end, with TINYFISH_MOCK=1 and LLM_MOCK=1
└─ fixtures/      # request bodies and expected responses shared by tests
```

The safety cases (emergency phrases, no diagnosis, no dose advice, citations, prices, redaction) are the JSON files in `apps/web/tests/safety/`. Sample documents for evaluating prescription and lab-report extraction are not kept in the repository.

## Rules

- **No network in tests.** TinyFish, the LLM and Supabase are mocked or run in mock mode. Live-web checks are manual evaluation runs, not tests.
- Every route gets at least:
  - happy path (response matches its `...Res` schema)
  - missing token → 401
  - invalid body → 400
  - a failing upstream → the documented status (partial results stay 200)
- Every service gets tests for its edge cases: sorting, partial failures, cache hit/miss, "no cache when empty".
- Names say the behavior: `returns partial quotes when one pharmacy times out`.
- A bug fix comes with a test that fails before the fix.

## Running

```bash
pnpm test                         # everything (Turborepo)
pnpm --filter @vyana/web test     # backend only
pnpm --filter @vyana/shared test  # contracts, mocks, API client
```
