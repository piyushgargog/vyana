import { expect, test } from "@playwright/test";

import { expectNoHorizontalScroll, requiredEnv, signIn, signOut } from "./helpers";

/**
 * Doctor demo path (issue #141).
 * Uses doctor@vyana.test. Opens the prescribe page but never submits.
 */
test.describe("doctor flow", () => {
  test("sign in, queue, patient, prescribe page (no submit), sign out", async ({ page }) => {
    const password = requiredEnv("E2E_PASSWORD_DOCTOR");
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await signIn(page, "doctor@vyana.test", password);

    // The queue loads.
    await expect(page).toHaveURL(/\/doctor/);
    await expect(page.getByRole("heading", { name: /queue|today|patients/i }).first()).toBeVisible({ timeout: 15000 });
    await expectNoHorizontalScroll(page);

    // Open a patient, then the prescribe page. Never submit.
    const patientLink = page.getByRole("link").filter({ hasText: /patient|visit|token/i }).first();
    if (await patientLink.count()) {
      await patientLink.click();
      const prescribeLink = page.getByRole("link", { name: /prescribe/i }).first();
      if (await prescribeLink.count()) {
        await prescribeLink.click();
        await expect(page).toHaveURL(/prescribe/);
        await expectNoHorizontalScroll(page);
      }
    }

    await expect(errors, `console errors: ${errors.join("; ")}`).toHaveLength(0);
    await signOut(page);
  });
});
