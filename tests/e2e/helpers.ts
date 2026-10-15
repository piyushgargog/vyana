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
  // The app redirects to /dashboard, /doctor or /onboarding after sign-in.
  await page.waitForURL(/\/(dashboard|doctor|onboarding)/, { timeout: 15000 });
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
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "page must not scroll sideways").toBeLessThanOrEqual(1);
}
