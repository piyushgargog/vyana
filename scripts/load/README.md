# Load tests (issue #303)

k6 scripts for the hot routes, run against a **local or staging** build with
the mock model — **never the live site**. The point is honest numbers: how
the app behaves at 10, 50 and 100 people at once, before the README claims
anything.

## What you need

- [k6](https://k6.io/docs/get-started/installation/) on your path.
- A local stack: `supabase start`, the seed applied (`supabase/seed/seed-users.ts`
  then `seed.sql`), and the web app running with the mock model so no real AI
  call is made and no free-tier quota is spent:

  ```sh
  LLM_MOCK=1 pnpm dev
  ```

- The demo patient's credentials and the project keys, as environment
  variables (the same ones `pnpm live:check` uses):

  ```sh
  export BASE_URL=http://localhost:3000          # the web app
  export SUPABASE_URL=http://localhost:54321     # supabase start's API URL
  export SUPABASE_ANON_KEY=<the local anon key>
  export PATIENT_EMAIL=patient@vyana.test
  export PATIENT_PASSWORD=<the demo patient password>
  ```

## Run it

One scenario at a time (each ramps 10 → 50 → 100 virtual users and holds a
minute at each step):

```sh
k6 run -e SCENARIO=dashboard scripts/load/main.js
k6 run -e SCENARIO=me scripts/load/main.js
k6 run -e SCENARIO=blood scripts/load/main.js
k6 run -e SCENARIO=care-plan scripts/load/main.js
k6 run -e SCENARIO=assistant scripts/load/main.js
k6 run -e SCENARIO=share scripts/load/main.js
```

A quick smoke first (1 user, a few seconds) to check the setup:

```sh
k6 run -e SCENARIO=me -e QUICK=1 scripts/load/main.js
```

The summary at the end prints, per scenario: requests, error rate, and the
response time p50 / p95. Record those three numbers; a scenario fails its
threshold when the error rate reaches 1% or p95 passes 2 s (5 s for the care
plan and the assistant, which write more).

## The scenarios

- **dashboard** — the data reads the dashboard makes, the way the browser
  makes them: profile, today's dose logs and the active prescription items,
  straight from the database API with the patient's token.
- **me** — `GET /api/me`.
- **blood** — `POST /api/blood/search` for Delhi. The app caches a search for
  15 minutes, so after the first call the load lands on Vyana, not on the
  public stock service. `setup()` makes that warm-up call itself; never
  point this scenario at a deployment whose cache is cold and shared with
  real users.
- **care-plan** — `POST /api/care-plan` for the demo patient's first
  condition (found in `setup()`), with the mock model. Refused unless
  `CONFIRM_MOCK_LLM=1` is passed (see below).
- **assistant** — `POST /api/assistant/chat` with one short message; the mock
  model streams a fixed answer, and the chat rows are written for real.
  Refused unless `CONFIRM_MOCK_LLM=1` is passed (see below).
- **share** — `GET /api/share/<token>` for a medical-ID link `setup()`
  creates (and revokes at the end). No sign-in: this is the public page a
  stranger's phone opens from the QR code.

Passwords and tokens travel only in the environment variables above. Nothing
in this folder holds a credential. Two guards run before any request:

- **Targets are an allow-list.** `BASE_URL` and `SUPABASE_URL` must be
  `localhost`, `127.0.0.1`, or exactly the `STAGING_URL` you set — anything
  else, the live site under any name or address included, is refused.
- **The model scenarios need an explicit confirmation.** `care-plan` and
  `assistant` spend model calls and write real rows wherever they point, so
  they run only with `-e CONFIRM_MOCK_LLM=1`, which is the runner's way of
  saying "the target was started with `LLM_MOCK=1`".

## Results

The database-layer measurements behind the index review (the dose scan
before and after migration 0018, and the read mix) were run on a local
database with the seed plus synthetic volume; the raw output is in
[`results/`](results/). The end-to-end k6 summaries (requests, error rate,
p50, p95 per scenario) still need a run against a local Supabase stack —
until they exist, treat any end-to-end figure as an estimate, not a
measurement.
