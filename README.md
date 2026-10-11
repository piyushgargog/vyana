# Vyana · व्यान

> *The breath that reaches every corner.*

**Vyana is your online one-stop solution for complete healthcare**, with a personal AI assistant inside. Book hospital appointments with a token (like the government ORS portal), keep prescriptions and reports in one timeline, get your medicines delivered at the best price straight from your prescription, never miss a dose or a refill, follow a care plan after a diagnosis, and get help fast in an emergency. All on web and mobile.

The name comes from Ayurveda. **Vyana** is the prana that starts at the heart and spreads through the whole body, carrying life to every part of it. The app works the same way. Its AI web agents, powered by [TinyFish](https://tinyfish.ai), go out across the live web (pharmacies, labs, the NMC medical register, hospitals) and bring back what your health needs.

*A portfolio project by four developers.*

---

## Features

| | Feature | What it does |
|---|---|---|
| 💊 | **Prescriptions, reminders and refills** | Scan a prescription or receive one from your doctor, review it, and get dose reminders with adherence tracking. Vyana warns you before a medicine runs out |
| 🛒 | **Medicines delivered from your prescription** | Prices your **whole prescription** live on 1mg, PharmEasy, Netmeds and Apollo, plus a Jan Aushadhi generic basket, then hands you off to the cheapest pharmacy to order |
| 🏥 | **Hospital appointments with a token** | Pick a hospital, department and date and get a token number, like the government ORS portal; see OPD timings fetched from the web |
| 🩺 | **Verified doctors and e-prescriptions** | Doctors are checked against the NMC Indian Medical Register and write e-prescriptions with a diagnosis |
| 📋 | **Care plan after a diagnosis** | What to do, what to avoid, what to eat, warning signs and follow-up tests, from trusted health sources and **approved by your doctor** |
| 🧪 | **Reports and health timeline** | Upload a lab report and get flagged values and a plain-language summary; every prescription, report and visit in one timeline you can share with a doctor |
| 🤖 | **AI health assistant** | Chat in English, Hindi or Hinglish; it knows your medicines and reports and cites trusted sources |
| 🚑 | **Emergency** | One tap calls 108, shares your live location, opens Blinkit Ambulance where available, lists nearby emergency hospitals, and shows your medical ID QR |
| 👨‍👩‍👧 | **Caregiver mode** | Family members can follow a patient's medicines and get an alert when a dose is missed |
| ⚠️ | **Safety checks** | Drug interaction warnings across prescriptions and a symptom check that points you to the right department, or to 108 |
| 🔒 | **Your data, your control** | Consent at sign-up, download all your data, delete your account any time |

## How TinyFish is used

Full details, with the request flow, are in [`ARCHITECTURE.md`](ARCHITECTURE.md).

| Feature | TinyFish API |
|---|---|
| Prescription basket price compare (delivery) | **Agent**: one agent per pharmacy prices the whole basket, all four in parallel |
| Doctor verification | **Agent** on the NMC Indian Medical Register |
| Hospital OPD timings, nearby emergency hospitals | **Search** + **Fetch** |
| Care plans, interaction checks, assistant answers | **Search** + **Fetch** on trusted health domains, with citations |
| Medicine quality alerts | **Monitor** + **Search** + **Fetch** |

## AI you can trust

Health decisions can't rest on a guess. Vyana's AI never invents a dose, a price, a lab value or a source:
- Extracted values must appear in the original document, and anything uncertain is flagged for you to review.
- Citations are checked against the pages actually read.
- Warning signs are caught by fixed rules before any AI runs.
- Care plans for a diagnosis are approved by the doctor.

Details: [`ARCHITECTURE.md`](ARCHITECTURE.md#ai-safety).

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
