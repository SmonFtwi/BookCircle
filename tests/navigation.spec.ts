import { test, expect } from "@playwright/test";
import { mockCircle } from "./fixtures";
test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
});
test("four tabs, legacy redirects, and member management isolation", async ({
  page,
}) => {
  await mockCircle(page, "member");
  const nav = page.getByRole("navigation", {
    name: "Main navigation",
    exact: true,
  });
  for (const [name, path] of [
    ["Home", "/home"],
    ["Library", "/library"],
    ["Club", "/club/discuss"],
    ["Me", "/me"],
  ]) {
    await test.step(`Navigate to ${name}`, async () => {
      await nav
        .getByRole("link", { name, exact: true })
        .click({ timeout: 5000 });
    });
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(nav.getByRole("link", { name, exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Club management", exact: true }),
  ).toHaveCount(0);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/me\/settings\?section=management/);
  await expect(
    page.getByRole("heading", { name: "Club management", exact: true }),
  ).toHaveCount(0);
  await page.goto("/challenges");
  await expect(page).toHaveURL(/\/club\/discuss$/);
  await expect(
    page.getByRole("heading", { name: "Discussions", exact: true }),
  ).toBeVisible();
});
test("quick-action reading uses current page and updates the screen behind it", async ({
  page,
}) => {
  const { calls } = await mockCircle(page, "member");
  await page.goto("/home");
  await page
    .getByRole("button", { name: "Quick actions", exact: true })
    .last()
    .click();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("button", { name: "Log reading" }).click();
  await expect(sheet.getByLabel("Page reached")).toHaveValue("42");
  await sheet.getByRole("button", { name: "30 min", exact: true }).click();
  await sheet.getByLabel("Page reached").fill("62");
  await sheet
    .getByRole("button", { name: "Save reading", exact: true })
    .click();
  await expect(sheet).not.toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: "Reading saved." }),
  ).toBeVisible();
  expect(calls.find((c) => c.operation === "reading.log")?.args).toMatchObject({
    startPage: 42,
    endPage: 62,
    minutes: 30,
    shareReflection: false,
  });
});
test("one-tap RSVP and voting retain the existing mutations", async ({
  page,
}) => {
  const { calls } = await mockCircle(page, "member");
  await page.goto("/club/meetings");
  await page.getByRole("button", { name: "Going", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Going", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(calls.find((c) => c.operation === "club.rsvp")?.args.status).toBe(
    "going",
  );
  await page.getByRole("link", { name: "Vote", exact: true }).click();
  await page
    .getByRole("button", { name: "Vote for this book", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Your vote ✓", exact: true }),
  ).toBeVisible();
  expect(calls.some((c) => c.operation === "club.vote")).toBe(true);
});
test("moderator sees content management but never Invitations", async ({
  page,
}) => {
  await mockCircle(page, "moderator");
  await page.goto("/me/settings");
  const management = page.getByRole("navigation", {
    name: "Club management",
    exact: true,
  });
  await expect(
    management.getByRole("link", { name: "Moderation" }),
  ).toBeVisible();
  await expect(
    management.getByRole("link", { name: "Invitations" }),
  ).toHaveCount(0);
  await expect(
    management.getByRole("link", { name: "Members", exact: true }),
  ).toHaveCount(0);
});
test("private notes save without reading activity and club questions stay explicit", async ({
  page,
}) => {
  const { calls } = await mockCircle(page, "member");
  const launch = () =>
    page
      .getByRole("button", { name: "Quick actions", exact: true })
      .last()
      .click();
  await launch();
  let sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("button", { name: /Challenge/ })).toHaveCount(0);
  await sheet.getByRole("button", { name: /Private note/ }).click();
  await expect(sheet.getByLabel("Minutes read")).toHaveCount(0);
  await expect(sheet.getByLabel("Related book (optional)")).toHaveValue("");
  await sheet.getByLabel("Your note").fill("A private idea worth keeping.");
  await sheet
    .getByRole("button", { name: "Save private note", exact: true })
    .click();
  await expect(sheet).not.toBeVisible();
  expect(calls.find((c) => c.operation === "reading.saveNote")?.args).toEqual({
    body: "A private idea worth keeping.",
  });
  expect(
    calls.some(
      (c) =>
        c.operation === "reading.log" || c.operation === "community.create",
    ),
  ).toBe(false);
  await page.goto("/me?section=notes");
  await expect(page.getByText("A private idea worth keeping.")).toBeVisible();
  await launch();
  sheet = page.getByRole("dialog");
  await sheet.getByRole("button", { name: /Post to club/ }).click();
  await sheet.getByLabel("Post type").selectOption("question");
  await expect(
    sheet.getByText(
      "Moderators and administrators can identify anonymous authors for moderation.",
    ),
  ).toBeVisible();
  await sheet
    .getByLabel("Your message")
    .fill("How do you choose your next book?");
  await sheet.getByLabel("Post anonymously").check();
  await sheet
    .getByRole("button", { name: "Post to club", exact: true })
    .click();
  await expect(sheet).not.toBeVisible();
  expect(calls.find((c) => c.operation === "forum.ask")?.args.anonymous).toBe(
    true,
  );
});
test("realtime activity waits for an explicit refresh; dark theme persists", async ({
  page,
}) => {
  await mockCircle(page, "member");
  await page.goto("/home");
  await expect(
    page.getByRole("heading", { name: "Look at the familiar, again" }),
  ).toBeVisible();
  await page.evaluate(() =>
    window.dispatchEvent(new Event("bookcircle:new-activity")),
  );
  await expect(
    page.getByRole("button", { name: "New activity ↑" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "New activity ↑" }).click();
  await expect(
    page.getByRole("button", { name: "New activity ↑" }),
  ).toHaveCount(0);
  await page.goto("/me/settings");
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("button", { name: "Automatic", exact: true }).click();
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});
