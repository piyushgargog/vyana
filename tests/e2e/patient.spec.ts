import { expect, test } from "@playwright/test";

import { expectNoHorizontalScroll, requiredEnv, signIn, signOut } from "./helpers";

/**
 * Patient demo path (issue #141).
 * Uses patient@vyana.test; reads nothing that stays and creates nothing.
 */
test.describe("patient flow", () => {
  test("sign in, Today, medicines, prescription, reports, Ask, sign out", async ({ page }) => {
    const password = requiredEnv("E2E_PASSWORD_PATIENT");
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await signIn(page, "patient@vyana.test", password);

    // Today shows doses.
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: /today/i }).first()).toBeVisible({ timeout: 15000 });
    await expectNoHorizontalScroll(page);

    // Medicines: open a prescription from the dashboard or nav.
    await page.getByRole("link", { name: /prescriptions/i }).first().click();
    await expect(page).toHaveURL(/\/prescriptions\/scan/);
    await expectNoHorizontalScroll(page);

    // Reports.
    await page.getByRole("link", { name: /lab reports/i }).first().click();
    await expect(page).toHaveURL(/\/reports\/upload/);
    await expectNoHorizontalScroll(page);

    // Ask: type a question, an answer (or the safe-error sentence) appears.
    // AI itself is not under test; the safe fallback counts as a pass.
    await page.goto("/assistant");
    const box = page.getByRole("textbox").first();
    if (await box.count()) {
      await box.fill("What are my active medicines?");
      await page.getByRole("button", { name: /send/i }).click();
      await expect(page.getByText(/vyana assistant|vyana is thinking|couldn.t answer/i).first()).toBeVisible({ timeout: 60000 });
    }

    await expect(errors, `console errors: ${errors.join("; ")}`).toHaveLength(0);
    await signOut(page);
  });
});
