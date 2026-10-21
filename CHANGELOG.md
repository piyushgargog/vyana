# Changelog

All notable changes to Vyana are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- The website has a "Download for Android" button (and an "Android app" link in the menu). `/download/android` sends the visitor to the .apk of the latest GitHub release.

### Removed
- Medicine quality alerts (CDSCO): the alerts screen, `POST /api/alerts/check`, the TinyFish Monitor webhook and the `monitor:create` script. The `drug_alerts` and `tinyfish_monitors` tables stay in the database, unused.

### Changed
- Demo data: ten more fictional demo patients with different diseases and three caregivers, and a year of lab reports, vitals and dose logs for every demo patient (for the charts and the shared record).
- The website no longer offers "Install app" in mobile browsers (the web manifest uses `display: browser`), so visitors do not mistake it for the Android app.
- Android app: the Today screen now greets you by name and time of day ("Good morning, Piyush") instead of showing an alert banner.

### Fixed
- **Text fixes from QA:** the doctor header no longer shows a doubled "Dr. Dr." when the stored name already has the title; basket prices always show two decimals (₹163.40, not ₹163.4); the onboarding emergency-contact relationship field no longer comes prefilled; the "Account Role" badge reads "Account Role: Patient" instead of the all-caps constant style.
- The emergency Medical ID QR is now plain readable text (name, blood group, allergies, medicines, one emergency contact) that any phone camera shows without internet. It used to be base64 text that only looked like gibberish, and its link needed internet. A long medicine list is cut with a "+N more" note. The QR has square corners and error level M so it scans on Android.
- "Revoke" on a share link now visibly works: turned-off and expired links leave the "Active share links" list and the Medical ID and Timeline screens, the app confirms it, and a revoke that changes no row is an error instead of a silent "ok".
- Signing out on one device no longer signs you out everywhere (web and Android; the Android fix ships with the next APK).
- The on-screen keyboard no longer covers the field you type in: on the website the page resizes with the keyboard, scrolls the field into view and hides the floating tab bar while you type; in the Android app every scrolling screen scrolls the focused field above the keyboard.
- The AI pool skips a dead, revoked or out-of-credit key (401, 402, 403, 408) and tries the next key, model or provider instead of failing the whole request.
- Android app: the keyboard no longer covers the text field; "Ask Vyana" and "Me" no longer show a second title and a gap under the header; notifications use the Vyana mark as the small icon.
- Public pages meet the AA colour-contrast limit; CI is green again (contrast, slow E2E waits, a secret-scan false positive).

## [1.0.0] - 2026-10-18

The first release: the web app at https://vyanahealth.app and the Android app (preview APK, attached to this release).

### Added (this release, on top of everything below)
- **Web patient pages:** scan a prescription and read one (`/prescriptions/scan`, `/prescriptions/[id]`), upload a lab report and read one with its trend (`/reports/upload`, `/reports/[id]`), compare medicine prices (`/basket`), book an OPD token (`/appointments/book`), see and cancel your tokens (`/appointments`), ask the AI assistant (`/assistant`), emergency help (`/sos`: call 108 or 112 only when you tap, nearby hospitals, an alert for your contacts after a confirmation) and the care plan (`/care/[conditionId]`; a draft plan is never shown to a patient).
- **Liquid Glass design system** for web and mobile (iOS 26 style: glass on the navigation, white cards on grey), the restyled patient dashboard, public pages, login and sign-up, and the new Vyana icon, link preview and web manifest.
- **A welcome screen** when the Android app opens: three seconds with the logo, the tagline and the Indian flag with "Made with love in India" (tap to skip; reduced motion respected).
- **Per-user rate limits** on the AI and web-agent routes (a database counter, 429 `RATE_LIMITED` with `Retry-After`, fail-open, SOS never limited) and friendly "try again in N minutes" messages in the web and mobile apps; `RATE_LIMIT_EXEMPT_USER_IDS` for tests and demos.
- **Branded sign-up and sign-in emails** (confirm, magic link, reset, new email) sent through Resend from the project's own domain.
- **Content Security Policy** on every web route, a nightly database backup, security workflows (container scan, secret scan, ZAP, uptime), Scorecard, Dependabot for Docker and a tag-triggered release workflow.
- **End-to-end tests** (Playwright) of the demo path and a script that refreshes the demo data; chat helpers with unit tests for the assistant.

### Changed
- The home page and the sign-in pages show **"Open Vyana"** when you are already signed in (the session cookie was never lost; the pages just did not say so), and `/login` and `/sign-up` send a signed-in person into the app. The proxy refreshes the session only on full page loads.
- The seeded demo accounts use **one password per role**; the seed refuses to touch a live database unless asked to.
- The Android build no longer uses React Compiler: it wrote `Symbol.for(...)` into every component, and our icon component named `Symbol` hid the built-in, which closed the app at launch.
- Demo hospital pins (GTB, Max Patparganj) match OpenStreetMap.

### Fixed
- **Safety:** the SOS screen no longer calls 108 by itself after a countdown; a call only starts when the user taps a call button.
- **Privacy:** the caregiver screen shows the linked patient's prescriptions, never the caregiver's own.
- The prescription scan and care plan screens no longer show an invented doctor, diagnosis or date when none was read; they say it was not found.
- The Android / iOS app now reads the API address from `EXPO_PUBLIC_API_URL` (the name the build uses), and falls back to the live site instead of `localhost`, so release builds reach the server.
- The assistant no longer shows dose amounts, counts or schedules ("200 mg", "3 times a day"): such a sentence is held back unless it repeats the patient's own saved medicine, and any dose question ends with "ask your doctor or pharmacist".
- The assistant no longer answers with an empty reply when its main model hits a rate limit: the fallback model now gets the conversation without the main model's reasoning, which it refused. If an answer still fails, the patient sees "Something went wrong while answering. Please try again."
- How often a medicine is taken is now read from the written schedule in code ("1-0-1" is twice a day). A live photo scan had read "1-0-1" as once a day; the code's reading now wins, and the item is marked for the patient to check.
- The example env file no longer puts comments after values. Docker Compose reads `KEY=  # text` as the value `# text`, which silently turned an empty key pool and an empty push token into text on the server.
- The API now accepts the ids of the demo records. Its strict id check rejected the simple ids in the seed (for example the demo diabetes condition and prescription, and every seeded hospital), so those requests answered 400. Found by running the live check against a real Supabase stack.

### Added
- Every AI result now includes its `run_id`, so "Report a mistake" works on the prescription scan and lab report screens in the app. Tapping a reminder opens the right screen (today's doses, medicines, or reports).
- A doctor can now run the medicine interaction check for their own patient, from a saved prescription (`prescription_id`) or for all of the patient's current medicines (`patient_id`). The server checks that the doctor treats this patient; any other doctor gets 403. The result is stored for the patient.
- A patient can correct a value the AI read from their own lab report (`POST /api/reports/values/correct`, hook `useCorrectLabValue`). The server recomputes the flag from the report's range, rebuilds the summary in code and keeps the old value for the record. The report analysis now returns each value's `id` for this.
- The AI layer can use several API keys, models and providers: extra keys per provider (`GROQ_API_KEYS`, …) are used round-robin, and `LLM_FALLBACKS` / `LLM_VISION_FALLBACKS` name models that take over on a rate limit, a too-large request, an outage or a timeout. Calls that carry no patient data (nearby hospitals, hospital timings, PM-JAY, care plans from public pages) may use any provider; patient data still goes only to providers with recorded data terms. `ai_runs` records the model that actually answered.
- The server sends security headers (HSTS, content-type, frame, referrer and permissions policies), no longer names its software, and sends `www` to the main address.
- Docker deployment: a `Dockerfile` (Next.js standalone build), `docker-compose.yml` and a `Caddyfile` (automatic HTTPS) run the web app and API on a single server. `pnpm monitor:create <url>` creates the drug quality alert Monitor after deployment.
- AI providers: the app can use Gemini, Groq, NVIDIA, OpenRouter or Hugging Face (free tiers). Their data terms were read and recorded; in production only a provider with recorded terms (Groq, with Zero Data Retention) can receive patient text, so a free tier that trains on prompts is limited to testing and the demo.

- Optional pool of TinyFish keys (`TINYFISH_API_KEYS`): new agent runs rotate across the keys, a run is always read with the key that started it, and a key that is out of credits or rate limited is skipped. With a single key nothing changes.
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
- Caregiver alerts also cover a dose the patient logged as missed (only taken and skipped count as handled), and the lock screen shows the first name only. A patient now gets one push when a government quality alert names one of their medicines (no medicine or batch on the lock screen).

- Share links last 30 days at most: the database refuses a longer `expires_at` (migration `0009`), including when an old link is extended, and `createShareLink` rejects 0 or more than 720 hours before asking the database. The 404 of `GET /api/share/[token]` now also carries `cache-control: no-store`, and the age and the "medicine still running" check use the day in India.
- Privacy controls: `GET /api/me/export` downloads every row the user owns, keyed by table, with links to their uploaded files that work for one hour (link tokens, pairing codes and device tokens are left out, and a caregiver or doctor gets their own data, not their patients'). `DELETE /api/me` removes the user's files and then the account, and everything of the patient goes with it; it asks for a sign-in within the last 15 minutes. Migration `0010` lets doctors and caregivers delete their accounts too.
- Meal log: `addMeal` checks a meal before it is sent (a known meal type, a description of 1 to 200 characters, whole calories from 0 to 5,000) and the database holds the same limits (migration `0011`); new `deleteMeal` / `useDeleteMeal` remove a wrong entry, `totalCalories` adds up a day, and the demo patient has three days of meals.
- Data-flow documentation (`supabase/DATA-FLOW.md`): diagrams of how data moves between the phone, Supabase, the API, the AI model and the push service, the prescription scan, the missed-dose alert and the share link, plus what the user controls. The Android preview build (`apps/mobile/eas.json`, `apps/mobile/BUILD.md`) now uses the real backend and the `preview` environment of the Expo project.
- Mobile screens for lab test price compare, drug quality alerts, the PM-JAY hospital finder and the meal log. Hospitals are only searched around the phone's real location (with the location off, the screens say so and link to the national portal), a lab search runs only when the user taps Search or opens it from a follow-up test, and an alert check with no result says "No alert found in the sources checked" in a neutral message.
- Nightly database backup on the server: `scripts/backup/backup-db.py` (stdlib Python; `pg_dump` in a throw-away Postgres container through the Supabase session pooler, gzip, newest 7 kept, files mode 600, the password never on a command line or in a log), a systemd service and timer (02:30 India time), `scripts/backup/restore-check.sh` for the restore test, and `RUNBOOK.md` with the setup, the daily check and the recovery steps.
- Security and reliability workflows: container security (Hadolint, image build, Trivy scan with SARIF, SBOM, a boot check as a non-root user), a Security workflow (actionlint, zizmor, gitleaks, Trivy on the repository), a weekly passive OWASP ZAP scan of the live site, and an uptime check every 15 minutes that opens an `incident` issue after two failed checks in a row. Every workflow action is pinned to a full commit SHA, checkouts no longer keep credentials, and Dependabot has a 5 day cooldown, Docker and Compose ecosystems and grouped minor and patch updates (npm routine updates stay off until 19 October).
- Per-user rate limit counters in the database (migration `0012`): the table `rate_limits` (no policy, no access for users) and the function `hit_rate_limit()`, one atomic statement that only the server can call, with an hourly clean-up job. The API uses it to limit the AI and web-agent routes.
- Per-user rate limits on the AI and web-agent routes: `withRoute` takes a `rateLimit` option that counts the signed-in user's call before the handler runs (so an over-limit request never reaches a model or a web agent) and answers 429 `RATE_LIMITED` with a `Retry-After` header; if the counter fails the request goes through. The limits are in `RATE_LIMITS` and `RATE_LIMITED_ROUTES` (`@vyana/shared`), the OpenAPI reference documents the 429, and `requireUser` now asks Supabase once per request.

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
- Demo hospitals: the GTB Hospital and Max Saket addresses now match the hospitals' own listings (Tahirpur Road, GTB Enclave; Mandir Marg).
- The storage database test passes on a real Supabase, where a direct delete from `storage.objects` raises an error instead of deleting nothing.
- A real, scannable QR code for the Medical ID: `buildQrMatrix` in `@vyana/shared` (the old `generateQrMatrix` only drew a pattern that looked like a QR code, and no phone could read it). The tests decode the code with an independent decoder, including Hindi text and the longest Medical ID. The Medical ID screens still have to switch to it (see the pull request).
