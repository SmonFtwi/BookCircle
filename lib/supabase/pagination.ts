export type Page<T> = { page: T[]; isDone: boolean; continueCursor: string };
export async function collectPages<T>(
  fetchPage: (cursor: string | null, size: number) => Promise<Page<T>>,
  count: number,
): Promise<Page<T>> {
  const page: T[] = [];
  let cursor: string | null = null;
  let isDone = false;
  while (page.length < count && !isDone) {
    const next = await fetchPage(cursor, Math.min(100, count - page.length));
    page.push(...next.page);
    isDone = next.isDone;
    if (!isDone && (next.continueCursor === cursor || next.page.length === 0))
      throw new Error("Pagination did not advance. Please retry.");
    cursor = next.continueCursor;
  }
  return { page, isDone, continueCursor: cursor ?? "" };
}
