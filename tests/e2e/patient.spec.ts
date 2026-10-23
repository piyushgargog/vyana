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

    // Reports: the phone tab bar keeps the five most used sections, so no "Lab reports"
    // link exists in the phone shell (issue #451). Phone users reach reports from Today:
    // go back to the dashboard and use its "Upload a lab report" quick action. The same
    // steps work on desktop, so one flow covers both projects.
    await page.getByRole("link", { name: /dashboard/i }).first().click();
    await expect(page).toHaveURL(/\/dashboard/);
    await page.getByRole("link", { name: /upload a lab report/i }).first().click();
    await expect(page).toHaveURL(/\/reports\/upload/);
    await expectNoHorizontalScroll(page);

    // Ask: the page only has to load. Sending a message would write chat rows and make a paid AI call on the live site every night.
    await page.goto("/assistant");
    await expect(page.getByRole("textbox").first()).toBeVisible();

    await expect(errors, `console errors: ${errors.join("; ")}`).toHaveLength(0);
    await signOut(page);
  });

  // Prices as lookup links (issue #298): the four shop buttons of pharmacySearchLinks
  // (1mg, PharmEasy, Netmeds, Apollo). Parked until W1 (#295) replaces the basket
  // page's agent comparison with those links — drop the .fixme then. Written now so
  // the step lands with the rest of the agent removal.
  test.fixme("prices page shows the four shop lookup buttons", async ({ page }) => {
    const password = requiredEnv("E2E_PASSWORD_PATIENT");
    await signIn(page, "patient@vyana.test", password);
    await page.goto("/basket");
    for (const shop of ["1mg", "PharmEasy", "Netmeds", "Apollo"]) {
      await expect(page.getByRole("link", { name: new RegExp(shop, "i") }).first()).toBeVisible();
    }
    await expectNoHorizontalScroll(page);
    await signOut(page);
  });
});
