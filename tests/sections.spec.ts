import { test, expect } from "@playwright/test";
import { mockCircle } from "./fixtures";
for (const width of [320, 390, 768, 1280]) {
  test(`compact shelves and full-width Club content at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockCircle(page, "member");
    await page.goto("/library");
    const book = page.getByRole("article", {
      name: "The Art of Noticing",
      exact: true,
    });
    await expect(book).toBeVisible();
    const cover = await book.locator(".shelf-cover-link").boundingBox();
    const title = await book.locator(".shelf-title").boundingBox();
    const card = await book.boundingBox();
    expect(cover!.x + cover!.width).toBeLessThanOrEqual(title!.x);
    expect(cover!.height / cover!.width).toBeCloseTo(1.5);
    expect(card!.height).toBeLessThan(340);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.goto("/club/discuss");
    await expect(
      page.getByRole("heading", { name: "Conversations", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: "Topic", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: "Show", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Explore topics" }),
    ).toHaveCount(0);
    const feed = await page
      .getByRole("region", { name: "Conversations", exact: true })
      .boundingBox();
    const main = await page.locator("main").boundingBox();
    expect(feed!.width).toBeGreaterThan(main!.width * 0.85);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
test("Library search, shelf changes and removal stay usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { calls } = await mockCircle(page, "member");
  await page.goto("/library");
  const atomic = page.getByRole("article", {
    name: "Atomic Habits",
    exact: true,
  });
  await atomic.getByRole("combobox").selectOption("want");
  await expect(atomic.getByRole("combobox")).toHaveValue("want");
  expect(
    calls.find((c) => c.operation === "reading.setBook")?.args.status,
  ).toBe("want");
  await page.getByRole("button", { name: /My shelves/ }).click();
  await expect(atomic).toBeVisible();
  await page
    .getByRole("searchbox", { name: "Search books" })
    .fill("nothing matches");
  await expect(
    page.getByRole("heading", { name: "No books found" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();
  await atomic.getByLabel("Options for Atomic Habits").click();
  await atomic.getByRole("button", { name: "Remove from my shelves" }).click();
  await expect(atomic).toHaveCount(0);
});
test("Me provides clear separate destinations and an obvious way back", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockCircle(page, "member");
  await page.goto("/me");
  await expect(
    page.getByRole("heading", { name: "Alex", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Recent sessions" }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: /Private notes Ideas/ }).click();
  await expect(
    page.getByRole("heading", { name: "Private notes", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "My profile", exact: true }).click();
  await page
    .getByRole("link", { name: /Reading history Your sessions/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Recent sessions", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "My profile", exact: true }).click();
  await page.getByRole("link", { name: /Commitments & partner Put/ }).click();
  await expect(
    page.getByRole("heading", { name: "My commitments", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "My profile", exact: true }).click();
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
    "Alex",
  );
  await expect(
    page.getByRole("heading", { name: "Club management" }),
  ).toHaveCount(0);
});
test("Club topics and sorting use the existing query arguments", async ({
  page,
}) => {
  await mockCircle(page, "member");
  await page.goto("/club/discuss");
  const requestPromise = page.waitForRequest((request) => {
    if (!request.url().includes("bookcircle_query")) return false;
    const body = request.postDataJSON();
    return (
      body.operation === "forum.list" &&
      body.args.categoryId === "70000000-0000-0000-0000-000000000002" &&
      body.args.mode === "trending"
    );
  });
  await page
    .getByRole("combobox", { name: "Topic", exact: true })
    .selectOption("70000000-0000-0000-0000-000000000002");
  await page
    .getByRole("combobox", { name: "Show", exact: true })
    .selectOption("trending");
  await requestPromise;
  await page
    .getByRole("navigation", { name: "Discussion views" })
    .getByRole("link", { name: "Shared insights", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "From the circle", exact: true }),
  ).toBeVisible();
});
test("review captures for narrow and dark section layouts", async ({
  page,
}) => {
  test.skip(
    !process.env.UPDATE_SCREENSHOTS,
    "Set UPDATE_SCREENSHOTS to capture the design review.",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await mockCircle(page, "member");
  for (const [name, path, title] of [
    ["library", "/library", "Library"],
    ["club", "/club/discuss", "Conversations"],
    ["me", "/me", "Me"],
  ]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: `docs/screenshots/${name}-dark.png`,
      animations: "disabled",
    });
  }
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/library");
  await expect(
    page.getByRole("article", { name: "The Art of Noticing", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/library-320.png",
    animations: "disabled",
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/club/discuss");
  await expect(
    page.getByRole("heading", { name: "Conversations", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/club-desktop.png",
    animations: "disabled",
  });
});
