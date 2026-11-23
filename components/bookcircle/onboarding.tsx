"use client";
import { useState, useSyncExternalStore } from "react";
import { BookOpen, Feather, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
const key = "bookcircle:onboarding:v1";
function subscribe(callback: () => void) {
  window.addEventListener("bookcircle:onboarding", callback);
  return () => window.removeEventListener("bookcircle:onboarding", callback);
}
function shouldShow() {
  try {
    return localStorage.getItem(key) !== "true";
  } catch {
    return false;
  }
}
const cards = [
  {
    title: "Read",
    body: "A few pages each day can change the way you see.",
    icon: BookOpen,
  },
  {
    title: "Reflect",
    body: "Keep an idea for yourself, or share it with your circle.",
    icon: Feather,
  },
  {
    title: "Meet",
    body: "Good books bring us together. Make time for a conversation.",
    icon: Users,
  },
];
export function Onboarding() {
  const show = useSyncExternalStore(subscribe, shouldShow, () => false);
  const [step, setStep] = useState(0);
  function dismiss() {
    try {
      localStorage.setItem(key, "true");
    } catch {}
    window.dispatchEvent(new Event("bookcircle:onboarding"));
  }
  if (!show) return null;
  const card = cards[step];
  return (
    <section
      className="panel onboarding-card mb-6"
      aria-label="Welcome to your circle"
    >
      <card.icon size={28} strokeWidth={1.75} />
      <p className="eyebrow mt-3">WELCOME TO YOUR CIRCLE · {step + 1} / 3</p>
      <h2>{card.title}</h2>
      <p className="muted mt-2">{card.body}</p>
      <div className="row between mt-4">
        <Button
          variant="outline"
          onClick={() => (step === 2 ? dismiss() : setStep((n) => n + 1))}
        >
          {step === 2 ? "Make yourself at home" : "Next"}
        </Button>
        <Button variant="ghost" onClick={dismiss}>
          Skip
        </Button>
      </div>
    </section>
  );
}
