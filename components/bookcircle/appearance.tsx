"use client";
import { ThemeProvider, useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useSyncExternalStore } from "react";
const subscribe = () => () => {};
export function AppearanceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return (
    <section className="panel mb-6">
      <h2>Appearance</h2>
      <div className="theme-options" role="group" aria-label="Color theme">
        {["system", "light", "dark"].map((option) => (
          <Button
            key={option}
            variant={mounted && theme === option ? "default" : "outline"}
            aria-pressed={mounted && theme === option}
            onClick={() => setTheme(option)}
          >
            {option === "system"
              ? "Automatic"
              : option === "light"
                ? "Light"
                : "Dark"}
          </Button>
        ))}
      </div>
    </section>
  );
}
