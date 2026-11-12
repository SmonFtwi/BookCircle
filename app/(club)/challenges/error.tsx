"use client";
import { Button } from "@/components/ui/button";
export default function ChallengeError({ reset }: { reset: () => void }) {
  return (
    <section className="panel" role="alert">
      <h1>Challenges couldn’t load</h1>
      <p className="muted mt-3 mb-5">
        Check your connection and try again. Your saved activity is safe.
      </p>
      <Button onClick={reset}>Try again</Button>
    </section>
  );
}
