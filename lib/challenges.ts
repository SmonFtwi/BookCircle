import type { Contracts } from "./supabase/contracts";

export type ChallengeRow = Contracts["club.challenges"]["result"][number];
export type ChallengePhase = "Active" | "Upcoming" | "Past";

export function challengePhase(
  challenge: Pick<ChallengeRow["challenge"], "startDate" | "endDate">,
  today: string,
): ChallengePhase {
  if (challenge.endDate < today) return "Past";
  return challenge.startDate > today ? "Upcoming" : "Active";
}

export const challengeUnits = {
  minutes: "reading minutes",
  days: "reading days",
  insights: "shared insights",
  commitments: "completed commitments",
} as const;

export const challengeActions = {
  minutes: { href: "/reading", label: "Log reading" },
  days: { href: "/reading", label: "Log reading" },
  insights: { href: "/community", label: "Share an insight" },
  commitments: { href: "/accountability", label: "View commitments" },
} as const;

export function challengeDate(date: string) {
  // These are calendar dates, not instants: avoid shifting them to the previous day.
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

export const challengeCategories = {
  reading: "Reading",
  fitness: "Fitness",
  diet: "Diet",
  screen_time: "Screen Time",
  other: "Other",
} as const;

type Challenge = ChallengeRow["challenge"];
export function isManualChallenge(challenge: Pick<Challenge, "goalType">) {
  return ["total", "daily_number", "daily_checkin"].includes(
    challenge.goalType,
  );
}
export function challengeUnit(challenge: Pick<Challenge, "goalType" | "unit">) {
  if (challenge.goalType === "total") return challenge.unit || "units";
  if (
    challenge.goalType === "daily_number" ||
    challenge.goalType === "daily_checkin"
  )
    return "successful days";
  return challengeUnits[challenge.goalType];
}
export function challengeGoalDescription(challenge: Challenge) {
  if (challenge.goalType === "daily_number") {
    return `${challenge.comparison === "maximum" ? "At most" : "At least"} ${challenge.dailyThreshold?.toLocaleString()} ${challenge.unit} per day · ${challenge.target} successful days`;
  }
  return `${challenge.target.toLocaleString()} ${challengeUnit(challenge)}`;
}
export function challengeAction(challenge: Challenge) {
  if (isManualChallenge(challenge))
    return { href: "/challenges", label: "Record progress" };
  return challengeActions[challenge.goalType as keyof typeof challengeActions];
}
