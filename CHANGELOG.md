# Changelog

All notable changes to Vyana are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- AI providers: the app can use Gemini, Groq, NVIDIA, OpenRouter or Hugging Face (free tiers). Their data terms were read and recorded; in production only a provider with recorded terms (Groq, with Zero Data Retention) can receive patient text, so a free tier that trains on prompts is limited to testing and the demo.
- Release tooling: `pnpm eval:safety` runs the safety checks that need an AI model (no diagnosis, no dose advice, no invented links, care plan lines) against the running app, and `pnpm review:sheet` writes a tick-box sheet of the reviewed medical lists for the human review.
- `pnpm live:check` checks a running API against a real Supabase project as the seeded demo users: sign-in and roles, row level security, the cache, share links, the assistant stream and the emergency routes. `--llm` adds the routes that need a model; `--agents` adds the basket, lab compare and doctor verification (uses TinyFish credits).
- Lab test price compare: `POST /api/labs/compare` finds each lab's own page for a test in a city (Healthians, Redcliffe, Thyrocare, 1mg Labs) and checks the price in the background; `GET /api/labs/compare/{job_id}` reports progress. A price counts only when it appears on the lab's page, and the cheapest is always a confirmed price.
- Medicine quality alerts: `POST /api/alerts/check` looks for government (CDSCO) quality alerts and recalls that name the patient's medicines, and `POST /api/webhooks/tinyfish-monitor` saves new ones from a TinyFish Monitor for every patient they concern. A fixed rule decides (the medicine by brand or salt, plus alert wording), with no AI; news and other sites are ignored.
- Ayushman Bharat (PM-JAY) hospital finder: `POST /api/schemes/pmjay-hospitals` lists hospitals near a location that a government page lists as empanelled, with their address and specialities as written on that page. Third-party lists are never used; when nothing official is found, the app links to the official site.
- Booking: a patient can hold only one active OPD token per department and day, so nobody can use up a department's daily tokens. Cancelling a token frees the slot; the cancelled number is never given out again.
- A doctor's e-prescription with a diagnosis now creates the patient's condition automatically (one per prescription, an edited diagnosis updates it), so the care plan draft can start from it. Doctors still cannot insert conditions themselves.
- AI safety test suite: case files for every safety check (emergencies, redaction, prices, interactions, care plans, no diagnosis, no dose advice, citations). The checks that need no AI model run on every change.

- `pnpm prewarm` fills the shared cache before a demo (the demo prescription's pharmacy baskets and the care plan pages for the demo conditions); `--dry-run` shows the plan and the agent-run estimate. The README's TinyFish section now lists each feature's endpoint and code.
- Reminders on the phone: dose reminders for the next days (a dose already logged gets none), a refill alert at 9:00 for each medicine that is running out (units left from the quantity dispensed and the doses taken), and a reminder for each follow-up test of an approved care plan. The phone also saves its push token. What to remind of and when is planned by tested pure functions in `@vyana/shared` (`getRefillStatus`, `planDoseReminders`, `planRefillAlerts`, `planFollowUpReminders`).
- Doctor verification: `POST /api/doctors/verify` checks a doctor on the NMC Indian Medical Register.
  - A web agent only reads the register; the server decides.
  - A doctor is verified only when the registration number, council, surname and name match (initials allowed), and the year too when both give one. A fake or borrowed number never verifies.
  - A number already verified on another account is refused. If the register can't be read, or asks for a CAPTCHA, the result stays pending; CAPTCHAs are never automated.
- Medicine interaction check: `POST /api/medicines/interactions` checks the patient's active medicines (or one prescription).
  - Brand names are mapped to salts from a reviewed list of 44 common Indian brands, each checked against its pharmacy page (`pnpm verify:brands`), or from a salt written in brackets. Medicines that can't be mapped are listed as not checked (`not_checked`).
  - The reviewed interaction table is checked first. Other pairs are looked up on trusted medicine pages: the server picks the sentences that name both medicines, the AI only confirms that a sentence states an interaction, and the sentence is shown word for word. Severity comes from the sentence's own words.
  - Each interaction says which layer found it (`layer`). An empty result lists the sources checked and never says a combination is safe.
- Symptom triage: `POST /api/triage` suggests how soon to see a doctor and which hospital department to book.
  - Emergency warning signs (English, Hindi, Hinglish) go straight to "call 108 / press SOS" without any AI.
  - Otherwise the AI only picks the urgency and up to 2 departments from the hospital list. The advice, warning signs and disclaimer are fixed text in the user's language, so no AI-written sentence reaches the user, and it never names a disease.
  - Personal details are removed before the symptoms reach the AI. If the AI can't answer, the result is "see a General Medicine doctor soon".
- Care plans: `POST /api/care-plan` builds a plan for a condition (summary, do's and don'ts, diet with a sample day, warning signs, follow-up tests) from trusted guideline pages.
  - Every bullet must quote the page it comes from, and the server checks the quote is really there. Follow-up intervals are read from those quotes, and the sample day uses only foods the pages recommend. Medicines and doses are never mentioned.
  - Warning signs include a reviewed list for 10 common conditions (diabetes, high blood pressure, asthma, COPD, angina, heart failure, epilepsy, pregnancy, dengue, underactive thyroid), each item quoted from an NHS or MedlinePlus page; `pnpm verify:red-flags` re-checks them against the live pages.
  - A doctor's request creates a draft the doctor approves. A patient can generate a plan only for a condition they added, marked as not reviewed by a doctor.
- AI health assistant: `POST /api/assistant/chat` streams answers in English, Hindi or Hinglish.
  - It searches and reads trusted health sites only (WHO, MoHFW, MedlinePlus, NHS, CDC, NCBI, ICMR, CDSCO) and cites them. Any other link is removed while the answer streams, and an answer without a trusted source says so.
  - It can read your own medicines, lab values and conditions, and compare a medicine's price across pharmacies.
  - Emergency warning signs make the reply start with a fixed "call 108 / press SOS" notice, written by the server before the AI answers.
  - Personal details are removed before the AI sees a message. Conversations are saved, and each reply is logged so it can be reported as a mistake.
- Data layer for the apps: typed query functions (`@vyana/shared`) for the profile, doctors (with names via `doctor_directory`), hospitals, token booking, prescriptions and the doctor's e-Rx, doses and adherence, lab reports, vitals, care plans, caregivers, share links, consents, timeline, AI mistake reports, storage uploads and push tokens, plus a React Query hook for each. Cached data is dropped when another user signs in.
- Auth and data plumbing: Supabase clients for web (browser, server, `proxy.ts` session refresh) and mobile (session encrypted in AsyncStorage, key in SecureStore, so it survives app restarts), `AppProviders` with `useSupabase()` and `useSession()`, generated database types (`Tables`, `TablesInsert`, `TablesUpdate`, `Db*` row aliases) and the v2 constants (consent version, emergency numbers, Blinkit, ORS, caregiver invite lifetime, missed-dose grace).
- Database (`supabase/`): the full v2 schema (hospitals and departments, token booking, care plans, caregiver mode, share links, consents, AI run log), row level security for every table, private storage buckets, realtime for the live tables and demo seed data. Appointments are created only by the `book_appointment` function, caregiver invites only by `create_care_invite` / `accept_care_invite` (5 wrong codes per 15 minutes, then locked). Executable pgTAP tests in `supabase/tests/database/` cover every access path (`supabase test db`).
- Backend foundations: one error format for every API route, bearer-token sign-in checks with roles, a shared cache for public web results, and `apps/web/.env.example`.
- Prescription basket pricing: `POST /api/prescriptions/basket` starts one web agent per pharmacy in the background and `GET /api/prescriptions/basket/{job_id}` reports progress; every price must appear on the pharmacy's product page before it counts, and totals, ordering and savings are computed by the server. `pnpm smoke:basket` runs the whole pipeline live.
- Live web layer: a TinyFish client for Search, Fetch, browser agents (with live progress, time limits and a per-minute run limit) and Monitors, the agent start pages for each pharmacy and the medical register, offline fixtures, and `pnpm smoke:tinyfish` to check everything against the live sites.
- Prescription and lab report reading:
  - `POST /api/prescriptions/extract` and `POST /api/reports/analyze` read an uploaded photo or PDF. A PDF's own text is used when it has one. Personal details are removed before extraction, and every value must quote the document text, otherwise it is cleared and flagged for review.
  - Lab flags are computed in code. Report summaries are written from the verified values only and checked for diagnosis or dose wording.
  - Photos go to a model only after a provider's data terms are approved.
- Emergency and hospital routes:
  - `POST /api/emergency/nearby` finds hospitals with emergency care near a location. Every name, address and phone number must appear on the fetched page; the route never fails, so the SOS screen always works.
  - `POST /api/emergency/sos` records the request, returns emergency contacts, nearby hospitals and a ready SMS, then updates the ambulance status (simulated).
  - `POST /api/hospitals/info` returns a hospital's OPD timings, keeping only rows quoted from the hospital's pages, and caches them for 7 days.
- AI layer: every AI call asks for structured output at temperature 0, retries once if the answer doesn't match its schema (then asks the user to enter it manually), and is logged with its model, prompt version and sources. A mock mode serves fixtures until a model provider is chosen.
- More AI safety checks: personal details (names, phone numbers, emails, addresses, ID numbers, dates of birth) are replaced with placeholders before any text reaches a model; AI text is checked for diagnosis wording and medicine doses; a curated table of well-known drug interactions, each backed by a quote from an NHS, MHRA or MedlinePlus page, with `pnpm verify:interactions` to re-check the quotes against the live pages.
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
- Demo data v2: nine real Delhi hospitals (five government, four private) with 47 departments, two fictional verified doctors for each, a Metformin pack that is 2 days from a refill, an approved Type 2 Diabetes care plan, an HbA1c trend over four reports, accepted consents, and dose logs in India time. Booking now shows real hospitals.

- Missed-dose alerts for caregivers: every 15 minutes the database calls `POST /api/cron/missed-doses`; a dose that was due 60+ minutes ago and never logged sends one push to each caregiver phone (no medicine name on the lock screen). A push helper for Expo notifications (`lib/server/push.ts`) removes dead tokens.

- Share with a doctor or a first responder: `GET /api/share/[token]` opens a read-only record (the medical ID, or the timeline) from an unguessable expiring link, with no sign-in; an unknown, expired or turned-off link is one and the same 404. The offline Medical ID QR (`buildMedicalIdQr` / `parseMedicalIdQr`) carries name, blood group, allergies, medicines and one emergency contact in under 600 characters, readable without internet.

### Changed
- **API contract:** emergency requests now reject a latitude outside −90…90 or a longitude outside −180…180, and an SOS note over 500 characters.
- **API contract:** a single-medicine price check is now a one-item basket job. `POST /api/medicines/compare` and `MedicinesCompareRes` are removed; `medicines.compare` / `useCompareMedicine` keep their names, post to `/api/prescriptions/basket` and return `BasketCompareRes` (poll with `useBasketJob`).
- **API contract:** basket pricing is now a job. `BasketCompareRes` gains `job_id` and `status`, baskets can be `pending`, and lines carry `price_verified`; new client method `basket.job()` and hook `useBasketJob()`.
- ARCHITECTURE documents privacy before AI and the verified interaction table.

### Removed
- The standalone diet-plan endpoint; diet guidance is now part of the care plan.

### Security
- Third-party GitHub Actions are pinned to full commit SHAs.
- Vitest upgraded to 4.1.11 (GHSA-82fw-gwwq-j7x9, development only).

### Fixed
- API client: trailing-slash trimming no longer uses a regex flagged as a potential ReDoS.
- Shared React modules are marked as client modules, so Next.js server components can import `@vyana/shared`.
- Severe burns ("severe burn", "jal gaya") are now treated as emergencies.
- Personal-detail removal no longer swallows medical values written after an address, and removes the name after a "Patient:" label.
