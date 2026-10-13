# Data flow

How a patient's data moves through Vyana, who can reach it at each step, and what protects it. It follows the code in this repository; [`ARCHITECTURE.md`](../ARCHITECTURE.md) has the overview of the apps and [`README.md`](README.md) the database.

## The big picture

```mermaid
flowchart LR
  subgraph Phone["Patient's phone"]
    APP["Vyana app"]
    LOCAL[("On the phone<br/>session in secure storage<br/>reminder schedule")]
  end
  subgraph Supabase
    AUTH["Auth<br/>(JWT)"]
    DB[("Postgres<br/>row-level security")]
    ST[("Storage<br/>private buckets<br/>one folder per user")]
    CRON["pg_cron<br/>every 15 min"]
    VAULT["Vault<br/>app address + secret"]
  end
  subgraph Server["Next.js API (the only place with secrets)"]
    API["Routes<br/>token check · validation"]
    SAFE["Privacy filter<br/>removes names, phones,<br/>addresses, IDs"]
  end
  AI["AI model"]
  WEB(("Trusted health sites<br/>pharmacies · registers"))
  PUSH["Expo push service"]
  CARER["Caregiver's phone"]
  DOC["Doctor or first responder<br/>(share link, no sign-in)"]

  APP -- "sign in" --> AUTH
  APP -- "own rows only (RLS)" --> DB
  APP -- "own folder only" --> ST
  APP -- "Bearer JWT" --> API
  APP --- LOCAL
  API -- "service role,<br/>after an ownership check" --> DB
  API --> ST
  API --> SAFE --> AI
  API --> WEB
  CRON -- "reads address + secret" --> VAULT
  CRON -- "POST /api/cron/missed-doses" --> API
  API -- "generic text only" --> PUSH --> CARER
  DOC -- "GET /api/share/token" --> API
```

Two rules hold everywhere:

1. **A user reaches only their own rows.** Plain reads and writes go straight from the app to Postgres under row-level security. Everything else goes through the API, which checks the Bearer token first and uses the service-role key only after an explicit ownership check.
2. **Secrets never leave the server.** The phone and the browser hold the public Supabase key and the user's own session, nothing else.

## Flow 1: scanning a prescription

```mermaid
sequenceDiagram
  autonumber
  actor P as Patient
  participant A as App
  participant S as Storage (private)
  participant API as API
  participant F as Privacy filter
  participant M as AI model
  participant DB as Postgres

  P->>A: photo or PDF of the prescription
  A->>S: upload to prescriptions/{user_id}/{uuid}
  A->>API: POST /api/prescriptions/extract {file_path} + Bearer
  API->>API: the path must be inside this user's folder
  API->>S: download (service role)
  API->>M: a photo is read into text (only a provider whose terms rule out keeping or training)
  M-->>API: document text
  API->>F: document text
  F-->>API: text without names, phones, addresses, IDs
  API->>M: extract medicines (every field must quote the text)
  M-->>API: structured answer
  API->>API: code checks each quote exists in the text
  API->>DB: save the prescription and medicines (under the user's own session)
  API-->>A: items + warnings
  P->>A: checks every medicine against the paper
  A->>A: schedule reminders on the phone
```

What is stored: the uploaded file (private bucket, the user's folder), the saved medicines, and a record of the AI run (model, prompt version, sources) so a mistake can be reported. Reminders are scheduled on the phone itself; their text leaves out medicine names unless the user turns that on.

## Flow 2: a missed dose reaches the caregiver

```mermaid
sequenceDiagram
  autonumber
  participant C as pg_cron (every 15 min)
  participant V as Vault
  participant API as POST /api/cron/missed-doses
  participant DB as Postgres
  participant X as Expo push service
  actor G as Caregiver's phone

  C->>V: read app address + secret
  C->>API: call with header x-cron-secret
  API->>API: secret must match
  API->>DB: doses due 60+ min ago with no dose log, for patients with an active caregiver
  API->>DB: claim each dose in missed_dose_alerts (primary key = once)
  API->>X: one push per caregiver phone
  X-->>G: "A dose was missed. Aryan has not logged the 09:00 dose."
  API->>DB: remove push tokens the service reports as dead
```

The lock screen shows the first name and the time, never a medicine, batch or condition. The claim is written before the push is sent, so two runs at the same moment cannot alert twice; if the push service cannot be reached, the claim is released and the next run tries again.

## Flow 3: sharing a record with a doctor or a first responder

```mermaid
sequenceDiagram
  autonumber
  actor P as Patient
  participant DB as Postgres
  actor D as Doctor / first responder
  participant API as GET /api/share/{token}

  P->>DB: create a link (medical ID or timeline, at most 30 days)
  P-->>D: sends the link or shows the QR
  D->>API: opens the link, no sign-in
  API->>DB: token exists, not turned off, not expired?
  alt valid
    API-->>D: read-only record, no-store, not for search engines
  else unknown, expired or turned off
    API-->>D: the same 404 for all three
  end
  P->>DB: turn the link off (answers 404 at once)
```

A medical-ID link shows name, age, blood group, allergies, active conditions and medicines, and emergency contacts. A timeline link drops the contacts and adds the history. Neither shows the patient's id, phone number or the token.

## What the user controls

| Control | What happens |
|---|---|
| **Consent** | Asked at sign-up and stored with its version (`consents`) |
| **Download my data** | `GET /api/me/export`: every row the user owns, keyed by table, and their files with one-hour links. Tokens and codes that open data to somebody else are left out |
| **Delete my account** | `DELETE /api/me` (after a sign-in within 15 minutes): the user's files go first, then the account, and every row of the patient goes with it |
| **Caregiver access** | Joined with a 24-hour code; turned off by either side |
| **Share links** | Expire within 30 days; turned off at any time |

## Who can see what

| Data | The patient | A caregiver | A doctor | Anyone with a share link | The server |
|---|---|---|---|---|---|
| Profile, medicines, doses, reports, vitals | yes | yes, read only, while the link is active | only for patients of their own verified department | only what the link shows, until it expires | to do the work asked; health data is kept out of the logs |
| Uploaded files | yes (own folder) | no | no | no | to read the scan |
| Push token | yes | no | no | no | to send the alert |
| Link tokens, caregiver codes | yes | no | no | no | to check them |
