import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { expectNoHorizontalScroll } from "./helpers";

/**
 * Public pages (issue #141): load with no console errors, no horizontal
 * scroll at 390 px, and no serious/critical axe issues.
 */
test.describe("public pages", () => {
  for (const path of ["/", "/privacy", "/terms", "/login"]) {
    test(`${path} loads clean`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });

      await page.goto(path);
      await expect(page.locator("body")).toBeVisible();
      await expectNoHorizontalScroll(page);

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(serious, JSON.stringify(serious.map((v) => v.id))).toHaveLength(0);

      await expect(errors, `console errors: ${errors.join("; ")}`).toHaveLength(0);
    });
  }
});
