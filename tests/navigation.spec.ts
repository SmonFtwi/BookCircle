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
  await expect(page).toHaveURL(/\/club\/challenges$/);
  await expect(
    page.getByRole("heading", { name: "Less screen time", exact: true }),
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
    page.getByRole("status").filter({ hasText: "Nice." }),
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
test("private note defaults, honest anonymity, and drawer check-in", async ({
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
  await sheet.getByRole("button", { name: "Add a note", exact: false }).click();
  await expect(sheet.getByLabel("Share with club")).not.toBeChecked();
  await sheet.getByLabel("Your note").fill("A private idea worth keeping.");
  await sheet.getByLabel("Minutes read").fill("12");
  await sheet
    .getByRole("button", { name: "Save note & reading", exact: true })
    .click();
  await expect(sheet).not.toBeVisible();
  expect(calls.find((c) => c.operation === "reading.log")?.args).toMatchObject({
    minutes: 12,
    startPage: 42,
    endPage: 42,
    reflection: "A private idea worth keeping.",
    shareReflection: false,
  });
  expect(calls.some((c) => c.operation === "community.create")).toBe(false);
  await launch();
  sheet = page.getByRole("dialog");
  await sheet
    .getByRole("button", { name: "Ask a question", exact: false })
    .click();
  await expect(
    sheet.getByText(
      "Moderators and administrators can identify anonymous authors for moderation.",
    ),
  ).toBeVisible();
  await sheet
    .getByLabel("Your question")
    .fill("How do you choose your next book?");
  await sheet.getByLabel("Post anonymously").check();
  await sheet
    .getByRole("button", { name: "Post question", exact: true })
    .click();
  await expect(sheet).not.toBeVisible();
  expect(calls.find((c) => c.operation === "forum.ask")?.args.anonymous).toBe(
    true,
  );
  await launch();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Challenge check-in", exact: false })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Daily amount (minutes)")
    .fill("45");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save entry", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(calls.some((c) => c.operation === "club.saveChallengeEntry")).toBe(
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
