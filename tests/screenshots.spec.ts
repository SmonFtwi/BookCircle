import { test, expect } from "@playwright/test";
import { mockCircle } from "./fixtures";
import { mkdir } from "node:fs/promises";
test("390px review screens have no overflow or browser errors", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await mockCircle(page, "member");
  if (process.env.UPDATE_SCREENSHOTS)
    await mkdir("docs/screenshots", { recursive: true });
  for (const [name, url, heading] of [
    ["home", "/home", "A little further, Alex."],
    ["library", "/library", "Library"],
    ["club", "/club/discuss", "A little perspective"],
    ["me", "/me", "Me"],
  ]) {
    await page.goto(url);
    if (name === "club")
      await expect(
        page.getByRole("heading", {
          name: "What helped you make reading a daily habit?",
          exact: true,
        }),
      ).toBeVisible();
    else
      await expect(
        page.getByRole("heading", { name: heading, exact: true }),
      ).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (process.env.UPDATE_SCREENSHOTS)
      await page.screenshot({
        path: `docs/screenshots/${name}.png`,
        fullPage: false,
        animations: "disabled",
      });
  }
  await page.goto("/home");
  await page
    .getByRole("button", { name: "Quick actions", exact: true })
    .last()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  if (process.env.UPDATE_SCREENSHOTS)
    await page.screenshot({
      path: "docs/screenshots/quick-action-sheet.png",
      animations: "disabled",
    });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Log reading", exact: false })
    .click();
  await expect(page.getByRole("dialog").getByLabel("Page reached")).toHaveValue(
    "42",
  );
  if (process.env.UPDATE_SCREENSHOTS)
    await page.screenshot({
      path: "docs/screenshots/reading-form.png",
      animations: "disabled",
    });
  await page
    .getByRole("button", { name: "Close quick actions", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await expect(page.locator("html")).toHaveClass(/dark/);
  if (process.env.UPDATE_SCREENSHOTS)
    await page.screenshot({
      path: "docs/screenshots/home-dark.png",
      fullPage: false,
      animations: "disabled",
    });
  expect(errors).toEqual([]);
});
test("baseline Home reference", async ({ page }) => {
  test.skip(
    !process.env.BEFORE_URL,
    "Set BEFORE_URL to capture the original app.",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await mockCircle(page, "member");
  await page.goto(`${process.env.BEFORE_URL}/home`);
  await expect(
    page.getByRole("heading", {
      name: /Good (morning|afternoon|evening), Alex/,
    }),
  ).toBeVisible();
  await page.addStyleTag({
    content: "nextjs-portal {display:none !important}",
  });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: "docs/screenshots/before-home.png",
    fullPage: false,
    animations: "disabled",
  });
});
