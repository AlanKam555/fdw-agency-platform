import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const pages = ["/", "/faq", "/services", "/maids", "/apply", "/login", "/contact", "/privacy", "/disclaimer", "/register"];

for (const path of pages) {
  test(`${path} has no WCAG A or AA axe violations`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
}
