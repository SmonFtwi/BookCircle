import { test, expect } from "@playwright/test";
import { mockCircle, inviteeId } from "./fixtures";

test("manager creates a selected-member screen-time challenge and manages invitations", async ({
  page,
}) => {
  const { calls } = await mockCircle(page, "admin");
  await page
    .getByRole("button", { name: "Create challenge", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Challenge title").fill("Evenings offline");
  await dialog
    .getByLabel("Category", { exact: true })
    .selectOption("screen_time");
  await expect(dialog.getByLabel("Tracking")).toHaveValue("daily_number");
  await expect(dialog.getByLabel("Daily rule")).toHaveValue("maximum");
  await dialog.getByLabel("End date").fill("2099-12-31");
  await dialog.getByLabel("Daily threshold").fill("120");
  await dialog.getByLabel("Target successful days").fill("3");
  await dialog.getByLabel("Who can participate?").selectOption("invite_only");
  await dialog.getByLabel("Search members").fill("Sam");
  await dialog.getByLabel("Sam Reader").check();
  await dialog
    .getByRole("button", { name: "Create challenge", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  expect(
    calls.find((c) => c.operation === "club.saveChallenge")?.args,
  ).toMatchObject({
    category: "screen_time",
    goalType: "daily_number",
    comparison: "maximum",
    dailyThreshold: 120,
    target: 3,
    memberIds: [inviteeId],
    participationMode: "invite_only",
  });
  await page.getByRole("button", { name: "Manage challenge" }).click();
  await dialog.getByLabel("Sam Reader").check();
  await dialog.getByRole("button", { name: "Send invitations" }).click();
  await expect(
    dialog.getByRole("button", { name: "Revoke", exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Revoke", exact: true }).click();
  await expect(dialog.getByText("· revoked", { exact: true })).toBeVisible();
  expect(
    calls.some((c) => c.operation === "club.revokeChallengeInvitation"),
  ).toBe(true);
});

test("member accepts, records zero, edits and deletes a private daily entry", async ({
  page,
}) => {
  const { calls } = await mockCircle(page, "member", "invited");
  await expect(
    page.getByRole("button", { name: "Create challenge" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Accept invitation" }).click();
  await page.getByRole("button", { name: "Record progress" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Daily amount (minutes)").fill("0");
  await dialog.getByRole("button", { name: "Save entry" }).click();
  await expect(dialog.getByText("0 minutes", { exact: true })).toBeVisible();
  await dialog.getByLabel("Daily amount (minutes)").fill("150");
  await dialog.getByRole("button", { name: "Update entry" }).click();
  await expect(dialog.getByText("150 minutes", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(dialog.getByText("No entries yet.")).toBeVisible();
  expect(
    calls
      .filter((c) => c.operation === "club.saveChallengeEntry")
      .map((c) => c.args.value),
  ).toEqual([0, 150]);
});

test("mobile member declines and uses category filters without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockCircle(page, "member", "invited");
  await page.getByRole("button", { name: "Decline", exact: true }).click();
  await expect(
    page.getByText("You declined this invitation.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Accept invitation" }),
  ).toHaveCount(0);
  await page.getByLabel("Category", { exact: true }).selectOption("fitness");
  await expect(
    page.getByRole("heading", { name: "No active challenges" }),
  ).toBeVisible();
  await page.getByLabel("Category", { exact: true }).selectOption("all");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
