import { describe, it, expect } from "vitest";
import { collectPages } from "./pagination";
describe("cursor pagination", () => {
  it("reads beyond the server page limit without duplicates", async () => {
    const values = Array.from({ length: 250 }, (_, i) => i);
    const result = await collectPages(async (cursor, size) => {
      expect(size).toBeLessThanOrEqual(100);
      const start = Number(cursor ?? 0);
      return {
        page: values.slice(start, start + size),
        isDone: start + size >= values.length,
        continueCursor: String(start + size),
      };
    }, 240);
    expect(result.page).toEqual(values.slice(0, 240));
    expect(result.isDone).toBe(false);
  });
  it("stops on the final page", async () => {
    const result = await collectPages(
      async () => ({ page: [1, 2], isDone: true, continueCursor: "2" }),
      200,
    );
    expect(result.page).toEqual([1, 2]);
    expect(result.isDone).toBe(true);
  });
  it("does not loop forever when a cursor does not advance", async () => {
    await expect(
      collectPages(
        async () => ({ page: [], isDone: false, continueCursor: "0" }),
        20,
      ),
    ).rejects.toThrow("did not advance");
  });
  it("surfaces errors instead of treating failure as an empty collection", async () => {
    await expect(
      collectPages(async () => {
        throw new Error("Membership required");
      }, 20),
    ).rejects.toThrow("Membership required");
  });
});
