"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="welcome">
      <div className="auth-card">
        <h1>Something interrupted your visit.</h1>
        <p>
          Please try again. If this continues, contact your club administrator.
        </p>
        <Button onClick={reset}>Try again</Button>
      </div>
    </main>
  );
}
