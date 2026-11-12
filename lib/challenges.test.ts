import { describe, expect, it } from "vitest";
import { challengePhase, challengeDate } from "./challenges";

describe("challenge calendar dates", () => {
  const challenge = { startDate: "2026-10-28", endDate: "2026-11-02" };
  it("includes both boundary days and switches only outside them", () => {
    expect(challengePhase(challenge, "2026-10-27")).toBe("Upcoming");
    expect(challengePhase(challenge, "2026-10-28")).toBe("Active");
    expect(challengePhase(challenge, "2026-11-02")).toBe("Active");
    expect(challengePhase(challenge, "2026-11-03")).toBe("Past");
  });
  it("supports a one-day challenge", () => {
    expect(
      challengePhase(
        { startDate: "2026-10-28", endDate: "2026-10-28" },
        "2026-10-28",
      ),
    ).toBe("Active");
  });
  it("formats calendar dates independently of the machine timezone", () => {
    expect(challengeDate("2026-01-01")).toBe("Jan 1, 2026");
  });
});

import {
  challengeAction,
  challengeGoalDescription,
  challengeUnit,
  isManualChallenge,
  type ChallengeRow,
} from "./challenges";

describe("general challenge presentation", () => {
  const base: ChallengeRow["challenge"] = {
    _id: "challenge",
    _creationTime: 0,
    clubId: "club",
    createdBy: "manager",
    title: "Less screen time",
    description: "",
    category: "screen_time",
    categoryLabel: null,
    participationMode: "invite_only",
    startDate: "2026-10-01",
    endDate: "2026-10-31",
    goalType: "daily_number",
    target: 20,
    unit: "minutes",
    dailyThreshold: 120,
    comparison: "maximum",
  };
  it("shows a daily maximum and successful days rather than accumulated minutes", () => {
    expect(challengeGoalDescription(base)).toBe(
      "At most 120 minutes per day · 20 successful days",
    );
    expect(challengeUnit(base)).toBe("successful days");
    expect(challengeAction(base)).toEqual({
      href: "/challenges",
      label: "Record progress",
    });
  });
  it("distinguishes daily minimums, totals, and check-ins", () => {
    expect(
      challengeGoalDescription({
        ...base,
        comparison: "minimum",
        dailyThreshold: 8000,
        unit: "steps",
      }),
    ).toContain("At least 8,000 steps per day");
    expect(
      challengeGoalDescription({
        ...base,
        goalType: "total",
        target: 12.5,
        unit: "km",
      }),
    ).toBe("12.5 km");
    expect(challengeUnit({ ...base, goalType: "daily_checkin" })).toBe(
      "successful days",
    );
  });
  it("preserves automatic activity links and units", () => {
    for (const goalType of [
      "minutes",
      "days",
      "insights",
      "commitments",
    ] as const) {
      const challenge = { ...base, goalType };
      expect(isManualChallenge(challenge)).toBe(false);
      expect(challengeAction(challenge).href).not.toBe("/challenges");
    }
    expect(challengeUnit({ ...base, goalType: "minutes" })).toBe(
      "reading minutes",
    );
  });
});
