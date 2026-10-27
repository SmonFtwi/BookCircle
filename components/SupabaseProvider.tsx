"use client";
import { ReactNode, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { mutateQueries } from "@/lib/supabase/hooks";

export default function SupabaseProvider({
  children,
}: {
  children: ReactNode;
}) {
  const missingConfig =
    process.env.NODE_ENV === "production" &&
    (!process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL.includes("your-project"));

  useEffect(() => {
    const channel = supabase
      .channel("club-changes")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "club_revisions" },
        mutateQueries,
      )
      .subscribe();
    const timer = setInterval(mutateQueries, 60000);
    const refresh = () => mutateQueries();
    window.addEventListener("focus", refresh);
    return () => {
      void supabase.removeChannel(channel);
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  if (missingConfig) {
    return (
      <main className="welcome">
        <div className="auth-card">
          <h1>Configuration needed</h1>
          <p>
            Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in your hosting
            environment and redeploy.
          </p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
