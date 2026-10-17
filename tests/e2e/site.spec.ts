import { expect, test } from "@playwright/test";

test("home page stays usable on desktop and mobile", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Find your");
  await expect(page.locator(".booking-search").first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".mobile-menu summary")).toBeVisible();
  await page.locator(".mobile-menu summary").click();
  await expect(page.locator(".mobile-menu nav a", { hasText: "The resort" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("primary destination pages render and unknown pages use the custom 404", async ({ page }) => {
  for (const [path, heading] of [["/rooms", "Room to settle into."], ["/faq", "Before you arrive."]]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(heading);
  }
  await page.goto("/this-page-does-not-exist");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("This page wandered off.");
});
