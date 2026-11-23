import { test, expect } from "@playwright/test";
import { mockCircle } from "./fixtures";
test("rendered text and button contrast in both color schemes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockCircle(page, "member");
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    for (const url of [
      "/home",
      "/library",
      "/club/discuss",
      "/me",
      "/me/settings",
    ]) {
      await page.goto(url);
      await expect(page.locator("main h1")).toBeVisible();
      await expect(
        page.getByRole("status", { name: "Loading your circle" }),
      ).toHaveCount(0);
      const failures = await page.evaluate(() => {
        type Color = [number, number, number, number];
        const parse = (value: string): Color => {
          const n = value.match(/[\d.]+/g)?.map(Number) ?? [];
          return [n[0] ?? 0, n[1] ?? 0, n[2] ?? 0, n[3] ?? 1];
        };
        const blend = (a: Color, b: Color): Color => [
          a[0] * a[3] + b[0] * (1 - a[3]),
          a[1] * a[3] + b[1] * (1 - a[3]),
          a[2] * a[3] + b[2] * (1 - a[3]),
          1,
        ];
        const lum = (c: Color) =>
          c
            .slice(0, 3)
            .map((n) => n / 255)
            .map((n) =>
              n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4,
            )
            .reduce((sum, n, i) => sum + n * [0.2126, 0.7152, 0.0722][i], 0);
        const failures: string[] = [];
        for (const el of document.querySelectorAll<HTMLElement>(
          "main *, nav *, header *",
        )) {
          if (!(el instanceof HTMLElement)) continue;
          const text = Array.from(el.childNodes)
            .filter((n) => n.nodeType === Node.TEXT_NODE)
            .map((n) => n.textContent)
            .join("")
            .trim();
          if (!/[a-z0-9]/i.test(text)) continue;
          const rect = el.getBoundingClientRect();
          if (rect.width < 3 || rect.height < 3) continue;
          const ancestors: HTMLElement[] = [];
          let current: HTMLElement | null = el;
          while (current) {
            ancestors.unshift(current);
            current = current.parentElement;
          }
          if (
            ancestors.some((a) => {
              const s = getComputedStyle(a);
              return (
                s.visibility === "hidden" ||
                Number(s.opacity) < 0.8 ||
                s.backgroundImage !== "none"
              );
            })
          )
            continue;
          if ((el as HTMLButtonElement).disabled) continue;
          let bg: Color = [255, 255, 255, 1];
          for (const a of ancestors)
            bg = blend(parse(getComputedStyle(a).backgroundColor), bg);
          const style = getComputedStyle(el);
          const fg = blend(parse(style.color), bg);
          const a = lum(fg),
            b = lum(bg);
          const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
          const size = parseFloat(style.fontSize),
            weight = parseInt(style.fontWeight);
          const minimum =
            size >= 24 || (size >= 18.66 && weight >= 700) ? 3 : 4.5;
          if (ratio + 0.02 < minimum)
            failures.push(
              `${text.slice(0, 55)}: ${ratio.toFixed(2)}:1 (needs ${minimum})`,
            );
        }
        return failures;
      });
      expect(failures, `${colorScheme} ${url}`).toEqual([]);
    }
  }
});
