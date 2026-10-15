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

    // Ask: the page only has to load. Sending a message would write chat rows and make a paid AI call on the live site every night.
    await page.goto("/assistant");
    await expect(page.getByRole("textbox").first()).toBeVisible();

    await expect(errors, `console errors: ${errors.join("; ")}`).toHaveLength(0);
    await signOut(page);
  });
});
