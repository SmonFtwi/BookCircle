import { test, expect } from "@playwright/test";
import { mockCircle } from "./fixtures";

test("removed features and tutorials are absent on a first mobile visit", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockCircle(page, "admin");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Welcome to your circle")).toHaveCount(0);
  await page.goto("/club/discuss");
  await expect(
    page.getByRole("navigation", { name: "Club sections" }).getByRole("link"),
  ).toHaveCount(3);
  await page.goto("/me/settings?section=management");
  await expect(
    page.getByRole("heading", { name: "Club administration" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /challenge|Pair members/i }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Full name", { exact: true })).toHaveCount(0);
  for (const url of ["/accountability", "/me?section=accountability"]) {
    await page.goto(url);
    await expect(
      page.getByRole("heading", { name: "Me", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("My commitments", { exact: true })).toHaveCount(
      0,
    );
  }
});

test("saving a club thought never creates a private note or reading session", async ({
  page,
}) => {
  const { calls } = await mockCircle(page, "member");
  await page.goto("/club/discuss");
  await page.getByRole("button", { name: "Post to club", exact: true }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByLabel("Post type")).toHaveValue("thought");
  await expect(
    sheet.getByText("Visible to everyone in your club."),
  ).toBeVisible();
  await sheet
    .getByLabel("Your message")
    .fill("This book made me pay attention to small things.");
  await sheet
    .getByRole("button", { name: "Post to club", exact: true })
    .click();
  await expect(sheet).not.toBeVisible();
  expect(calls.some((c) => c.operation === "community.create")).toBe(true);
  expect(
    calls.some(
      (c) =>
        c.operation === "reading.log" || c.operation === "reading.saveNote",
    ),
  ).toBe(false);
});

test("closed voting explains a tie and a round without votes", async ({
  page,
}) => {
  const { voting } = await mockCircle(page, "member");
  voting.round.status = "closed";
  voting.nominations[0].votes = 0;
  voting.nominations[0].percentage = 0;
  await page.goto("/club/vote");
  await expect(
    page.getByText("No votes received. There is no winning book."),
  ).toBeVisible();
  voting.nominations[0].votes = 2;
  voting.nominations.push({
    ...voting.nominations[0],
    _id: "second-nomination",
    book: {
      ...voting.nominations[0].book,
      _id: "second-book",
      title: "Another book",
    },
  });
  await page.reload();
  await expect(
    page.getByText("It’s a tie. A club manager can open a new vote."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Vote for this book", exact: true }),
  ).toHaveCount(0);
});

test("weekly goal shows only minutes and keeps the other stored preferences", async ({
  page,
}) => {
  const { calls } = await mockCircle(page, "member");
  await page.getByRole("button", { name: "Edit goal", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Pages per week")).toHaveCount(0);
  await dialog.getByLabel("Minutes per week").fill("180");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(calls.find((c) => c.operation === "reading.setGoals")?.args).toEqual({
    minutes: 180,
    pages: 100,
    days: 5,
  });
});

test("expired email links explain the problem and offer recovery", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route(/https:\/\/[^/]+\.supabase\.co\//, (route) =>
    route.fulfill({ json: {} }),
  );
  await page.goto("/?authError=invalid-link");
  await expect(
    page.getByRole("alert").filter({ hasText: "This email link" }),
  ).toContainText("This email link has expired or is invalid.");
  await expect(
    page.getByRole("button", { name: "Resend confirmation email" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  if (process.env.UPDATE_SCREENSHOTS) {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Sign in", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: "docs/screenshots/sign-in.png",
      animations: "disabled",
    });
  }
});

test("private notes can be corrected and deleted from Me", async ({ page }) => {
  const { calls } = await mockCircle(page, "member");
  await page.goto("/me?section=notes");
  await page
    .getByRole("button", { name: "Add a note", exact: true })
    .first()
    .click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Your note").fill("Original private note");
  await dialog
    .getByRole("button", { name: "Save private note", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "Edit note", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Your note").fill("Corrected private note");
  await dialog
    .getByRole("button", { name: "Save private note", exact: true })
    .click();
  await expect(dialog.getByRole("status")).toHaveText("Saved privately.");
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(
    page.getByText("Corrected private note", { exact: true }),
  ).toBeVisible();
  page.once("dialog", (confirm) => confirm.accept());
  await page.getByRole("button", { name: "Delete note", exact: true }).click();
  await expect(
    page.getByText("Corrected private note", { exact: true }),
  ).toHaveCount(0);
  expect(calls.some((c) => c.operation === "reading.deleteNote")).toBe(true);
  expect(calls.some((c) => c.operation === "reading.log")).toBe(false);
});
