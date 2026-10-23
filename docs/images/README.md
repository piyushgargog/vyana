# README screens

Screenshots for the README's **Screens** section (issue #306). Every image is
captured from the fictional demo patient or the public pages — never a real
person's data.

## What is here

| File | What it shows | How it was captured |
|---|---|---|
| `home-desktop.png` | The public home page at 1366 px | `capture-screens.mjs`, no login |
| `home-phone.png` | The public home page at 390 px | `capture-screens.mjs`, no login |
| `u1-home-phone-zoom200.png` | U1 largest-text pass (#285): home at 200% zoom, phone width — header actions wrap under the brand, nothing off-screen | Mock-env build, Playwright Chromium, 195 CSS px layout at scale factor 2 |
| `u1-home-desktop-zoom200.png` | U1: home at 200% zoom, desktop width (683 CSS px layout) | Same |
| `u1-login-phone-zoom200.png` | U1: sign-in at 200% zoom, phone width | Same |
| `u1-terms-phone-zoom200.png` | U1: terms at 200% zoom, phone width — long words break inside the article | Same |

## Capturing the rest

The app screens (Today, Ask Vyana with a cited answer, prescription scan
result, a care plan with sources, medicine interactions, blood search
results, the SOS / emergency card, the Health Memory Graph share page, and —
once C1 is merged — care suggestions) need a signed-in demo session:

```sh
# 1. Run the web app (mock env is enough for the public shell; the demo data
#    itself comes from the seeded demo accounts)
pnpm --filter @vyana/web dev

# 2. Capture everything, phone and desktop
VYANA_BASE_URL=http://localhost:3000 \
VYANA_DEMO_EMAIL=patient@vyana.test \
VYANA_DEMO_PASSWORD='<the seed password, from the team>' \
node docs/images/capture-screens.mjs
```

The demo GIF (15–25 s: scan a prescription → reminders → ask a question →
open SOS) is recorded the same way: sign in as the demo patient on the phone
or the web, screen-record the path, and save it here as `demo.gif` (under
4 MB), then put it at the top of the README under the title.

## Rules for every image

- Demo patient only; check for names, phone numbers and emails before
  committing, and re-shoot rather than editing an image to hide data.
- No key, token or server address in frame (viewport captures only — no
  browser chrome).
- PNG or WebP, under 300 KB each; the GIF under 4 MB.
