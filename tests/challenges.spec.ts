import { test, expect, type Page } from "@playwright/test";

const userId = "10000000-0000-0000-0000-000000000001";
const inviteeId = "10000000-0000-0000-0000-000000000002";
const today = new Date().toISOString().slice(0, 10);

const projectRef = new URL(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://your-project.supabase.co",
).hostname.split(".")[0];

async function mockCircle(
  page: Page,
  role: "admin" | "member",
  status: "invited" | "accepted" = "accepted",
) {
  const calls: { operation: string; args: Record<string, unknown> }[] = [];
  const entries: {
    date: string;
    value: number | null;
    successful: boolean | null;
  }[] = [];
  const row = {
    challenge: {
      _id: "20000000-0000-0000-0000-000000000001",
      title: "Less screen time",
      description: "Make room for a good book.",
      category: "screen_time",
      categoryLabel: null,
      participationMode: "invite_only",
      goalType: "daily_number",
      unit: "minutes",
      dailyThreshold: 120,
      comparison: "maximum",
      target: 3,
      startDate: today,
      endDate: "2099-12-31",
    },
    joined: status === "accepted",
    participationStatus: status,
    acceptedDate: status === "accepted" ? today : null,
    progress: 0,
    completed: false,
    participants:
      status === "accepted" ? [{ profileId: userId, name: "Alex" }] : [],
    invitations: [] as { profileId: string; name: string; status: string }[],
    leaderboard: [] as {
      profileId: string;
      name: string;
      rank: number;
      progress: number;
    }[],
  };
  // Browser-only fixtures: no authentication or application writes reach Supabase.
  await page.route(/https:\/\/[^/]+\.supabase\.co\//, async (route) => {
    const request = route.request();
    const url = request.url();
    if (url.includes("/rest/v1/rpc/")) {
      const { operation, args } = request.postDataJSON();
      let result: unknown = null;
      if (url.includes("bookcircle_mutate")) {
        calls.push({ operation, args });
        if (operation === "club.respondChallengeInvitation") {
          row.participationStatus = args.response;
          row.joined = args.response === "accepted";
          row.acceptedDate = row.joined ? today : null;
        }
        if (operation === "club.saveChallengeEntry") {
          const index = entries.findIndex((e) => e.date === args.date);
          const entry = {
            date: args.date,
            value: args.value ?? null,
            successful: args.successful ?? null,
          };
          if (index >= 0) entries[index] = entry;
          else entries.push(entry);
        }
        if (operation === "club.deleteChallengeEntry")
          entries.splice(
            entries.findIndex((e) => e.date === args.date),
            1,
          );
        row.progress = entries.filter(
          (e) => e.value !== null && e.value <= 120,
        ).length;
        row.leaderboard = row.progress
          ? [
              {
                profileId: userId,
                name: "Alex",
                rank: 1,
                progress: row.progress,
              },
            ]
          : [];
        if (operation === "club.inviteChallengeMembers")
          row.invitations.push({
            profileId: inviteeId,
            name: "Sam Reader",
            status: "invited",
          });
        if (operation === "club.revokeChallengeInvitation")
          row.invitations[0].status = "revoked";
        if (operation === "club.saveChallenge") result = row.challenge._id;
      } else if (operation === "profiles.me") {
        result = {
          profile: {
            _id: userId,
            name: "Alex",
            timezone: "UTC",
            joinedAt: Date.now(),
          },
          membership: { role },
          club: { name: "Test circle" },
        };
      } else if (operation === "club.challenges") result = [row];
      else if (operation === "club.challengeMembers")
        result = [
          { profileId: inviteeId, name: "Sam Reader" },
          { profileId: userId, name: "Alex" },
        ];
      else if (operation === "club.challengeEntries") result = entries;
      else if (operation === "notifications.list") result = [];
      else throw new Error(`Unexpected query: ${operation}`);
      await route.fulfill({ json: result });
    } else await route.fulfill({ json: {} });
  });
  await page.addInitScript(
    ({ userId, project }) => {
      const encode = (obj: unknown) =>
        btoa(JSON.stringify(obj))
          .replaceAll("=", "")
          .replaceAll("+", "-")
          .replaceAll("/", "_");
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const session = {
        access_token: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: userId, exp, role: "authenticated" })}.fixture`,
        refresh_token: "fixture",
        expires_at: exp,
        expires_in: 3600,
        token_type: "bearer",
        user: {
          id: userId,
          email: "fixture@example.invalid",
          aud: "authenticated",
          role: "authenticated",
          app_metadata: {},
          user_metadata: {},
        },
      };
      document.cookie = `sb-${project}-auth-token=base64-${encode(session)}; path=/; SameSite=Lax`;
    },
    { userId, project: projectRef },
  );
  await page.goto("/challenges");
  await expect(
    page.getByRole("heading", { name: "Less screen time", exact: true }),
  ).toBeVisible();
  return { calls, row };
}

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
