import { expect, type Page } from "@playwright/test";

/** Fails fast with a clear message when a credential is missing. */
export function requiredEnv(name: string): string {
  // E2E_PASSWORD_<ROLE>, else SEED_PASSWORD_<ROLE> (per-role demo passwords), else one shared E2E_PASSWORD.
  const role = name.replace(/^E2E_PASSWORD_/, "");
  const value = process.env[name] ?? process.env[`SEED_PASSWORD_${role}`] ?? process.env.E2E_PASSWORD;
  if (!value) throw new Error(`Set ${name} to run the E2E tests (never commit it).`);
  return value;
}

/** Signs in through the login form and waits for the app shell. */
export async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  // The app redirects to /dashboard, /doctor or /onboarding after sign-in, or to /consent when the account has not
  // accepted the current consent version yet (the demo accounts after every version bump, issue #472).
  await page.waitForURL(/\/(dashboard|doctor|onboarding|consent)/, { timeout: 15000 });
  await acceptConsentIfRedirected(page);
}

/**
 * The consent gate resolves asynchronously in the app shell: after the first
 * post-login URL lands, the shell can still bounce the page to /consent (the
 * scheduled E2E run of 2026-10-24 failed exactly this way — sign-in returned
 * on /doctor/ while the shell was still fetching consent, then the page left
 * for /consent and the doctor flow timed out waiting for /doctor/). Handling
 * /consent only when it is the first landing is therefore racy. Give the shell
 * a few seconds to perform that redirect and accept consent if it appears.
 */
async function acceptConsentIfRedirected(page: Page): Promise<void> {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (/\/consent/.test(page.url())) {
      for (const box of await page.getByRole("checkbox").all()) await box.check();
      await page.getByRole("button", { name: /i consent/i }).click();
      await page.waitForURL(/\/(dashboard|doctor|onboarding)/, { timeout: 15000 });
      return;
    }
    await page.waitForTimeout(250);
  }
}

/** Signs out via the profile menu. */
export async function signOut(page: Page): Promise<void> {
  // The app shell has a sign-out control; fall back to clearing the session.
  const signOutBtn = page.getByRole("button", { name: /sign out/i });
  if (await signOutBtn.count()) {
    await signOutBtn.first().click();
  } else {
    await page.evaluate(() => localStorage.clear());
    await page.goto("/login");
  }
  await expect(page).toHaveURL(/\/login/);
}

/** Asserts no horizontal scroll at the current viewport. */
export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const measure = () =>
    page.evaluate(() => {
      const width = document.documentElement.clientWidth;
      const wide: string[] = [];
      for (const el of Array.from(document.querySelectorAll("body *"))) {
        const box = el.getBoundingClientRect();
        if (box.width > 0 && (box.right > width + 1 || box.left < -1)) {
          wide.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)} [${Math.round(box.left)}..${Math.round(box.right)}] "${(el.textContent ?? "").trim().slice(0, 30)}"`);
        }
      }
      return { overflow: document.documentElement.scrollWidth - width, wide: wide.slice(0, 8) };
    });
  // A page may still be settling (skeletons, a toast sliding in): wait for it, and say which elements stick out if it never does.
  let last = await measure();
  for (let i = 0; i < 20 && last.overflow > 1; i++) {
    await page.waitForTimeout(250);
    last = await measure();
  }
  expect(last.overflow, `page must not scroll sideways; wider than the screen: ${last.wide.join(" | ")}`).toBeLessThanOrEqual(1);
}
