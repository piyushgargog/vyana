# Vyana · व्यान

> *The breath that reaches every corner.*

**Vyana is your online one-stop solution for complete healthcare.** Prescriptions, medicine reminders and best prices, lab reports, verified doctors and appointments, emergency help, and a personal AI health assistant: all in one place, on web and mobile.

The name comes from Ayurveda. **Vyana** is the prana that starts at the heart and spreads through the whole body, carrying life to every part of it. The app works the same way. Its AI web agents, powered by [TinyFish](https://tinyfish.ai), go out across the live web (pharmacies, labs, the NMC medical register, hospitals) and bring back what your health needs.

*A portfolio project by four developers.*

---

## Features

| | Feature | What it does |
|---|---|---|
| 🤖 | **AI health assistant** | Chat that knows your medicines, reports and conditions; answers cite trusted sources |
| 💊 | **Prescription scan + reminders** | Snap a prescription, medicines are extracted, and reminders are scheduled with adherence tracking |
| 🛒 | **Medicine price compare** | Live prices from 1mg, PharmEasy, Netmeds and Apollo, plus a Jan Aushadhi generic alternative |
| 🧪 | **Lab reports + test prices** | Upload a report and get flagged values, a plain-language summary and trends; compare test prices across labs |
| 🚑 | **Emergency SOS** | One tap calls 108, shares your live location with your contacts and lists the nearest emergency hospitals |
| 🩺 | **Verified doctors + appointments** | Doctors are verified against the NMC Indian Medical Register; book slots and receive e-prescriptions |
| 📈 | **Disease tracking + nutrition** | Track vitals and conditions, log meals, get a diet plan with sources |
| 🔔 | **Drug safety alerts** | Watches CDSCO quality alerts and notifies you if one of your medicines is affected |

## How TinyFish is used

Full details, with the request flow, are in [`ARCHITECTURE.md`](ARCHITECTURE.md).

| Feature | TinyFish API |
|---|---|
| Medicine and lab price compare | **Agent**, run in parallel across pharmacy and lab sites |
| Doctor verification | **Agent** on the NMC Indian Medical Register |
| Nearby emergency hospitals | **Search** + **Fetch** |
| AI assistant citations, diet plans | **Search** + **Fetch** on trusted health domains |
| Drug safety alerts | **Monitor** + **Search** + **Fetch** |

## Tech stack

**Web:** Next.js · Tailwind · shadcn/ui
**Mobile:** Expo (React Native) · Expo Router
**Backend:** Next.js Route Handlers
**Database:** Supabase (Postgres, Auth, Storage, Realtime)
**Web agents:** TinyFish
**AI:** Vercel AI SDK
**Tooling:** TypeScript · pnpm + Turborepo

## Repository layout

```
apps/web         Next.js: patient web, doctor portal, admin, API routes
apps/mobile      Expo: patient mobile app
packages/shared  @vyana/shared: contracts, types, API client, data hooks
supabase/        migrations, RLS policies, seed data
```

## Getting started

Requirements: Node.js ≥ 20.19 (see [`.nvmrc`](.nvmrc)) and pnpm (`npm i -g pnpm`).

```bash
git clone https://github.com/piyushgargog/vyana.git
cd vyana
pnpm install
pnpm dev:web       # http://localhost:3000
pnpm dev:mobile    # Expo dev server (scan the QR code with Expo Go)
```

Environment variables: copy `apps/web/.env.example` and `apps/mobile/.env.example` to `.env.local` / `.env` and fill them in.

## Documentation

| Doc | What it covers |
|---|---|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | How the apps, API, database and web agents fit together |
| [`apps/web/openapi.yaml`](apps/web/openapi.yaml) | HTTP API reference (OpenAPI 3.1, generated from the contracts) |
| [`CHANGELOG.md`](CHANGELOG.md) | What changed and when |
| [`apps/web/tests/README.md`](apps/web/tests/README.md) | How the backend is tested |
| [`AGENTS.md`](AGENTS.md) | Rules for AI coding agents working in this repo |

## Contributing

We work in feature branches and merge through pull requests only. Read [`CONTRIBUTING.md`](.github/CONTRIBUTING.md) before your first PR.

## Team

| | Role |
|---|---|
| **Piyush Garg** | Team Lead · Backend |
| **Arvind Kushwaha** | Frontend (web + mobile) |
| **Vaibhav Parmar** | Database + data layer |
| **Kareena Sah** | Product |

## Disclaimer

Vyana is a portfolio project. It is **not** a substitute for professional medical advice, diagnosis or treatment. In an emergency, call **108**.

## License

[MIT](LICENSE)
