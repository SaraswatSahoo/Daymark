import { expect, test } from "@playwright/test";

const PAGES = ["/", "/inbox", "/today", "/upcoming", "/calendar", "/calendar?view=week", "/tasks", "/notes", "/projects", "/reminders", "/review", "/settings"];

test("no horizontal overflow at common widths", async ({ page }) => {
  for (const width of [320, 375, 768, 1024]) {
    await page.setViewportSize({ width, height: 800 });
    for (const path of PAGES) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${path} at ${width}px overflows by ${overflow}px`).toBeLessThanOrEqual(0);
    }
  }
});

test("bottom navigation, capture button and menu work on a phone", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Primary" });
  await expect(nav).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Main navigation" })).toBeHidden();

  await nav.getByRole("button", { name: "Quick capture" }).click();
  const dialog = page.getByRole("dialog", { name: "Quick capture" });
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await dialog.getByLabel("Task", { exact: true }).fill("Buy bus pass tomorrow");
  await dialog.getByRole("button", { name: /Save task/ }).click();
  await expect(dialog).toBeHidden();

  await nav.getByRole("link", { name: "My Day" }).click();
  await expect(page).toHaveURL(/\/today/);

  await nav.getByRole("button", { name: /Menu/ }).click();
  await page.getByRole("link", { name: "Upcoming" }).click();
  await expect(page).toHaveURL(/\/upcoming/);
  await expect(page.getByText("Buy bus pass")).toBeVisible();
});

test("touch targets in the bottom bar are comfortable", async ({ page }) => {
  await page.goto("/");
  const items = page.getByRole("navigation", { name: "Primary" }).locator("a, button");
  for (const el of await items.all()) {
    const b = await el.boundingBox();
    expect(b!.height).toBeGreaterThanOrEqual(44);
  }
});
