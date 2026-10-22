// Capture the README screens (issue #306) with Playwright (via @playwright/test).
//
//   node docs/images/capture-screens.mjs        (run from the repo root)
//
// Environment:
//   VYANA_BASE_URL     where the web app runs   (default http://localhost:3000)
//   VYANA_DEMO_EMAIL   the demo patient login    (e.g. patient@vyana.test)
//   VYANA_DEMO_PASSWORD  its password            (from the team's seed secrets)
//
// Without a demo login only the public home page is captured; the app screens
// need the demo patient (fictional seed data — never a real person's account).
// With a login the script signs in once and captures every screen below at
// phone (390 px) and desktop (1366 px) widths, into this folder.
// Check every image before committing: no real names, numbers or emails, no
// keys, tokens or server addresses. Files are PNG; keep each under 300 KB
// (shorten the page or crop rather than raising the limit).

import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const OUT = dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.VYANA_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const EMAIL = process.env.VYANA_DEMO_EMAIL;
const PASSWORD = process.env.VYANA_DEMO_PASSWORD;

const SIZES = [
  ["phone", { width: 390, height: 844 }],
  ["desktop", { width: 1366, height: 900 }],
];

// Public: captured with no login. App screens: path after signing in as the demo patient.
const PUBLIC_SHOTS = [{ slug: "home", path: "/" }];
const APP_SHOTS = [
  { slug: "today", path: "/dashboard" },
  { slug: "ask", path: "/assistant" },
  { slug: "scan-result", path: "/prescriptions" },
  { slug: "care-plan", path: "/care" },
  { slug: "interactions", path: "/prescriptions" },
  { slug: "blood", path: "/blood" },
  { slug: "sos", path: "/sos" },
];

const browser = await chromium.launch();

async function shoot(page, slug, path, sizeName, viewport) {
  await page.setViewportSize(viewport);
  await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 60_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const file = `${OUT}/${slug}-${sizeName}.png`;
  await page.screenshot({ path: file });
  console.log("saved", file);
}

for (const [sizeName, viewport] of SIZES) {
  const page = await browser.newPage({ viewport });
  for (const shot of PUBLIC_SHOTS) await shoot(page, shot.slug, shot.path, sizeName, viewport);
  await page.close();
}

if (EMAIL && PASSWORD) {
  const page = await browser.newPage({ viewport: SIZES[1][1] });
  await page.goto(BASE + "/login", { waitUntil: "networkidle" });
  await page.getByLabel(/email/i).first().fill(EMAIL);
  await page.getByLabel(/password/i).first().fill(PASSWORD);
  await page.getByRole("button", { name: /sign in|log in/i }).first().click();
  // Prove the sign-in worked before capturing anything: if the app is still on
  // /login, every "app screen" below would silently save the login page.
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
  if (new URL(page.url()).pathname.startsWith("/login")) {
    throw new Error("Sign-in did not leave /login — check the demo email and password.");
  }
  for (const [sizeName, viewport] of SIZES) {
    for (const shot of APP_SHOTS) await shoot(page, shot.slug, shot.path, sizeName, viewport);
  }
  await page.close();
} else {
  console.log(
    "VYANA_DEMO_EMAIL / VYANA_DEMO_PASSWORD not set: app screens skipped (they need the demo patient)."
  );
}

await browser.close();
