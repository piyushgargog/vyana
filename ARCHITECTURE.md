# Architecture

Vyana is a pnpm + Turborepo monorepo with two apps and one shared package. The web app also hosts the backend, so there is a single deploy.

```mermaid
flowchart LR
  subgraph Clients
    M["Mobile app<br/>Expo · React Native"]
    W["Web app<br/>Next.js pages"]
  end
  CF["Cloudflare<br/>proxy · TLS"]
  CD["Caddy<br/>HTTPS · headers"]
  subgraph Server["Next.js API routes (apps/web/app/api)"]
    API["Route handlers<br/>auth · validation · errors"]
    WR["Web readers<br/>e-RaktKosh · OpenStreetMap · MedlinePlus · trusted pages"]
    AI["AI layer<br/>Vercel AI SDK"]
    C[("web_cache")]
  end
  subgraph Supabase
    DB[("Postgres + RLS")]
    ST[("Storage<br/>private buckets")]
    RT["Realtime"]
    AU["Auth"]
  end
  WEB(("Live web<br/>pharmacies · labs · NMC register<br/>hospitals · health sites"))

  M & W -- "@vyana/shared hooks<br/>(Bearer JWT)" --> CF --> CD --> API
  M & W -- "direct CRUD under RLS" --> DB
  M & W -- "uploads" --> ST
  RT -- "live status" --> M & W
  API --> WR --> WEB
  API --> AI
  API --> C
  API -- "service role (server-owned writes)" --> DB
  API --> ST
  AU -.->|JWT| API
```

## Packages

| Path | What it is |
|---|---|
| `apps/web` | Next.js (App Router). Patient web app, doctor portal, admin, **and** the HTTP API in `app/api/**`. |
| `apps/mobile` | Expo (React Native, Expo Router) patient app. |
| `packages/shared` (`@vyana/shared`) | Zod contracts for every API route, typed API client, React Query hooks, mock fixtures, shared constants. TypeScript source with no build step. |
| `supabase/` | Migrations, row-level security policies, seed data. |

## Two ways to reach data

| Path | Used for | Protection |
|---|---|---|
| **Direct to Supabase** (supabase-js under the user's session) | Plain reads and writes of the user's own records: profile, contacts, vitals, appointments, dose logs, blood requests | Row Level Security on every table |
| **Through the API** (`/api/*`) | Anything that needs a secret or the live web: LLM calls, the readers of public pages, server-owned records | Bearer token check, Zod validation, server-only keys |

## How the live web is used

The server reads public sources directly (`apps/web/lib/server/web`), with a User-Agent that says who we are, an allow-list of hosts, https only, a size cap and a cache. There is no outside agent service in between.

| Feature | Source | What happens |
|---|---|---|
| Blood stock (RapidBlood) | e-RaktKosh (NHM / C-DAC) public JSON endpoints | Three plain GET calls per area; a bank row is only what the source listed, shown with our own read time and "call to confirm" |
| Nearby emergency hospitals | OpenStreetMap Overpass, then the seeded `hospitals` table | One request (about a second); emergency and ICU are `null` unless the map says so |
| Care plans, interaction checks, assistant | MedlinePlus topic search and `fetchPage` on trusted health domains | Every statement keeps its source; a quote must be on the page the model was given |
| Doctor registration | An admin | The admin checks the public register by hand and records the result; no automatic check |
| Prices, lab tests, PM-JAY, hospital timings | Plain links to the pharmacies, labs, the official PM-JAY portal and the hospital's own site | The app reads no price or list from these sites |

Web results are cached in Postgres (`web_cache`), so repeated lookups are instant and cost nothing.

## Blood stock search, step by step

RapidBlood is a short background job that the app polls.

- `POST /api/blood/search` (`apps/web/app/api/blood/search/route.ts`) calls `startBloodJob` in [`blood.ts`](apps/web/lib/server/blood.ts). It returns a finished search from the cache, or starts the search of each area and returns a `job_id`.
- `GET /api/blood/search/{job_id}` calls `pollBloodJob`. It reads the answers of the areas, checks their rows, and returns the banks found so far, verified rows first.
- The `job_id` is sealed by the server, and only the user who started the search can read it.
- A finished search is cached for 15 minutes under its blood group, component and city.
- Requests that the patient tracks are rows in `blood_requests` (migration `0013`). The app reads and writes that table directly under owner-only row level security, and the patient sets each status. The search itself keeps no table.

## Share links and the Health Memory Graph

- The phone creates share links that last 24 hours, 7 days or 30 days, with optional scopes (labs, vitals, medicines, adherence). The scopes are stored in `share_links.scopes` (migration `0014`).
- `GET /api/share/{token}` returns the shared record from `loadSharedRecord` in [`data/share.ts`](apps/web/lib/server/data/share.ts). For a timeline link with scopes, the record also has a `memory` section, built by `buildMemory` in [`packages/shared/src/health/memory.ts`](packages/shared/src/health/memory.ts) from stored rows only. A medical ID link never carries memory.
- Each successful open calls `bump_share_open`, one atomic update that counts the open and sets `last_opened_at`. Only the service role can run it. No viewer identity or address is stored.
- The memory section contains no AI output.

## AI safety

Vyana treats AI output as a draft that must be proven, never as fact:

| Rule | How it is enforced |
|---|---|
| No invented doses, prices, values or links | Extracted fields carry the exact text they came from, and the server checks that text appears in the document; prices must come from the pharmacy's own page and pass range checks; links must be pages the server actually fetched |
| Code decides, AI explains | Lab flags come from reference ranges in code; emergency warning signs come from fixed rules that run before any model; totals and savings are computed in code |
| Structured output only | Every model call returns a schema-validated object at temperature 0; invalid output is retried once, then the user is asked to enter it manually |
| A human confirms | Patients review every scanned prescription before reminders are set; doctors approve care plans for their diagnoses |
| Say "I don't know" | Missing or conflicting sources mean the app says so and points to a doctor or 108; it never diagnoses and never calls a combination "safe" |
| Traceable | Each AI result is stored with the model, prompt version and sources; users can report a mistake |
| Privacy before AI | Names, phone numbers, addresses and ID numbers are removed from text before it reaches a model; prescription and report images go only to a provider whose terms rule out keeping or training on them |
| Streaming answers stay checked | The assistant's reply passes through a filter as it streams: a link is held until it is complete and removed unless the server fetched it from a trusted health site in that request; emergency warning signs make the server write a fixed 108 / SOS notice before the AI answers |
| Care plans quote their pages | Every care plan bullet carries the sentence it came from, checked against the fetched page; follow-up intervals are computed from those sentences; warning signs include a reviewed, quoted list per condition (`pnpm verify:red-flags`) |
| Verified interaction data | Well-known dangerous medicine combinations come from a reviewed table checked in code; anything else needs a quoted, trusted source |

## Contracts

Every API route has a request and response schema in `packages/shared/src/contracts`. The server validates what it receives and the client validates what it gets back. JSON uses snake_case, the same as the database columns. The public reference [`apps/web/openapi.yaml`](apps/web/openapi.yaml) is generated from these schemas (`pnpm docs:openapi`), and CI fails if it is out of date.

## Security boundaries

- Only `apps/web` server code holds secrets (Supabase service role, LLM). The mobile app and the browser never see them.
- The server sits behind Cloudflare; its firewall accepts web traffic only from Cloudflare, and SSH only from the administrator's address, so the server's own address is never public. Caddy adds security headers (HSTS, content-type, frame, referrer and permissions policies).
- An AI provider sees patient text only after names, phone numbers, addresses and IDs are removed, and only if its data terms are recorded; the code refuses other providers in production.
- The service-role client is used only for server-owned writes, after an explicit ownership check.
- Content from the web is treated as untrusted data, never as instructions.
- See [`.github/SECURITY.md`](.github/SECURITY.md) for reporting.

## Deployment

The web app and API run as one container (Next.js standalone build) behind Caddy, which handles HTTPS, on a single server with Docker Compose: `Dockerfile`, `docker-compose.yml` and `Caddyfile` at the repository root. Supabase (Postgres, Auth, Storage, Realtime) is a hosted project. Secrets live in an env file on the server, outside git and outside the image; only the two public `NEXT_PUBLIC_*` values are passed in while the image is built. Start it with `docker compose --env-file apps/web/.env.production up -d --build`.

```text
Browser / app → Cloudflare (proxy, TLS) → firewall (Cloudflare only) → Caddy (HTTPS, headers) → web container → Supabase · public web sources · AI provider
```

The web container publishes no port; Caddy reaches it over the Compose network. Updates are `git pull` and the same `docker compose` command; a rollback is checking out the previous commit and running it again.

## CI

Every pull request runs: lint + typecheck (+ OpenAPI drift check), unit tests, web production build, expo-doctor, CodeQL, secret scanning, dependency review and a Conventional Commit title check. `main` accepts changes only through pull requests that pass them.
