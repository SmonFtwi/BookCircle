"use client";
import { useState, useEffect, useCallback } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./client";
import type { Endpoint } from "./api";
import { collectPages, type Page } from "./pagination";
const listeners = new Set<() => void>();
export function mutateQueries() {
  listeners.forEach((fn) => fn());
}
export function useQuery<A, R>(
  fn: Endpoint<A, R>,
  args?: A | "skip",
): R | undefined {
  const key = JSON.stringify(args ?? {});
  const [state, setState] = useState<{ key: string; data?: R; error?: Error }>({
    key: "",
  });
  useEffect(() => {
    if (key === '"skip"') return;
    let live = true;
    let request = 0;
    const run = () => {
      const id = ++request;
      fn(JSON.parse(key))
        .then((data) => {
          if (live && id === request) setState({ key, data });
        })
        .catch((error) => {
          if (live && id === request)
            setState({
              key,
              error: error instanceof Error ? error : new Error(String(error)),
            });
        });
    };
    run();
    listeners.add(run);
    return () => {
      live = false;
      listeners.delete(run);
    };
  }, [fn, key]);
  if (state.key === key && state.error) throw state.error;
  return state.key === key ? state.data : undefined;
}
type Pagination = {
  paginationOpts: { numItems: number; cursor: string | null };
};
export function usePaginatedQuery<A extends Pagination, T>(
  fn: Endpoint<A, Page<T>>,
  args: Omit<A, "paginationOpts">,
  options: { initialNumItems: number },
) {
  const key = JSON.stringify(args);
  const [paging, setPaging] = useState({ key, count: options.initialNumItems });
  const count = paging.key === key ? paging.count : options.initialNumItems;
  const paged = useCallback(
    () =>
      collectPages<T>(
        (cursor, numItems) =>
          fn({ ...JSON.parse(key), paginationOpts: { numItems, cursor } } as A),
        count,
      ),
    [fn, key, count],
  );
  const data = useQuery(paged);
  return {
    results: data?.page ?? [],
    status: !data
      ? "LoadingFirstPage"
      : data.isDone
        ? "Exhausted"
        : "CanLoadMore",
    isLoading: !data,
    loadMore: (n: number) => setPaging({ key, count: count + n }),
  };
}
export function useMutation<A, R>(fn: Endpoint<A, R>) {
  return useCallback(
    async (
      ...values: Record<string, never> extends A ? [args?: A] : [args: A]
    ) => {
      const result = await fn((values[0] ?? {}) as A);
      mutateQueries();
      return result;
    },
    [fn],
  );
}
export const useAction = useMutation;
export function useAuth() {
  const [state, setState] = useState<{
    isLoading: boolean;
    isAuthenticated: boolean;
    user: User | null;
  }>({ isLoading: true, isAuthenticated: false, user: null });
  useEffect(() => {
    let live = true;
    supabase.auth.getSession().then(({ data }) => {
      if (live)
        setState({
          isLoading: false,
          isAuthenticated: !!data.session,
          user: data.session?.user ?? null,
        });
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (live) {
        setState({
          isLoading: false,
          isAuthenticated: !!session,
          user: session?.user ?? null,
        });
        queueMicrotask(mutateQueries);
      }
    });
    return () => {
      live = false;
      subscription.unsubscribe();
    };
  }, []);
  return state;
}
