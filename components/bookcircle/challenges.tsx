"use client";
import { useState } from "react";
import Link from "next/link";
import { Trophy } from "lucide-react";
import {
  challengePhase,
  challengeUnit,
  challengeAction,
  challengeDate,
  challengeCategories,
  challengeGoalDescription,
  isManualChallenge,
  type ChallengePhase,
  type ChallengeRow,
} from "@/lib/challenges";
import { useQuery, useMutation } from "@/lib/supabase/hooks";
import { api } from "@/lib/supabase/api";
import { Button } from "@/components/ui/button";
import {
  PageHeading,
  Loading,
  Empty,
  Meter,
  useFeedback,
  dayInZone,
  Field,
} from "./primitives";
import { useMember } from "./shell";
import {
  CreateChallenge,
  ManageChallenge,
  ChallengeEntries,
} from "./challenge-forms";
export { CreateChallenge } from "./challenge-forms";

export function ChallengesPage() {
  const { membership, profile } = useMember();
  const rows = useQuery(api.club.challenges);
  const [phase, setPhase] = useState<ChallengePhase>("Active");
  const [category, setCategory] = useState("all");
  const [mine, setMine] = useState(false);
  const today = dayInZone(profile.timezone);
  const filtered = rows?.filter(
    (row) =>
      (category === "all" || row.challenge.category === category) &&
      (!mine || row.joined || row.participationStatus === "invited"),
  );
  const visible = filtered
    ?.filter(({ challenge }) => challengePhase(challenge, today) === phase)
    .sort((a, b) =>
      phase === "Past"
        ? b.challenge.endDate.localeCompare(a.challenge.endDate)
        : a.challenge.startDate.localeCompare(b.challenge.startDate),
    );
  const pending = rows?.filter(
    (row) =>
      row.participationStatus === "invited" &&
      challengePhase(row.challenge, today) !== "Past",
  );
  return (
    <>
      <PageHeading
        eyebrow="SMALL STEPS, SHARED GOALS"
        title="Challenges"
        description="Build a reading habit, move more, or make time for what matters. Find a goal and grow with your circle."
        action={membership.role !== "member" ? <CreateChallenge /> : undefined}
      />
      {!!pending?.length && (
        <div className="panel mb-5" role="status">
          You have {pending.length} pending challenge{" "}
          {pending.length === 1 ? "invitation" : "invitations"}. Accept an
          invitation below to start participating.{" "}
          {pending.some(
            (r) => challengePhase(r.challenge, today) === "Upcoming",
          ) && (
            <button
              className="section-link"
              onClick={() => {
                setPhase("Upcoming");
                setCategory("all");
                setMine(true);
              }}
            >
              View upcoming invitations →
            </button>
          )}
        </div>
      )}
      <div className="challenge-toolbar">
        <div
          className="challenge-filters"
          role="group"
          aria-label="Challenge status"
        >
          {(["Active", "Upcoming", "Past"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              aria-pressed={phase === tab}
              onClick={() => setPhase(tab)}
            >
              {tab}{" "}
              <span>
                {filtered?.filter(
                  ({ challenge }) => challengePhase(challenge, today) === tab,
                ).length ?? "–"}
              </span>
            </button>
          ))}
        </div>
        <Field label="Category">
          <select
            aria-label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="all">All categories</option>
            {Object.entries(challengeCategories).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <label className="challenge-check">
          <input
            type="checkbox"
            checked={mine}
            onChange={(e) => setMine(e.target.checked)}
          />
          My challenges
        </label>
      </div>
      {!rows ? (
        <Loading />
      ) : visible?.length ? (
        <div className="challenge-grid">
          {visible.map((row) => (
            <ChallengeCard key={row.challenge._id} row={row} />
          ))}
        </div>
      ) : (
        <div className="panel">
          <Empty
            title={`No ${phase.toLowerCase()} challenges`}
            description="Try another category or status, or check back when your circle shares a new goal."
          />
        </div>
      )}
    </>
  );
}
function ChallengeCard({ row }: { row: ChallengeRow }) {
  const {
    challenge: c,
    joined,
    progress,
    completed,
    participants,
    leaderboard,
    participationStatus,
  } = row;
  const { membership, profile } = useMember();
  const join = useMutation(api.club.joinChallenge);
  const respond = useMutation(api.club.respondChallengeInvitation);
  const { run, feedback, busy } = useFeedback();
  const phase = challengePhase(c, dayInZone(profile.timezone));
  const action = challengeAction(c);
  const percent = Math.min(100, Math.round((progress / c.target) * 100));
  const invited = participationStatus === "invited";
  return (
    <article className="panel challenge-panel">
      <div className="section-head">
        <span className="challenge-icon mb-0">
          <Trophy aria-hidden="true" />
        </span>
        <span className="tag">
          {joined && completed
            ? "ACHIEVED"
            : joined
              ? "YOU’RE IN"
              : invited && phase !== "Past"
                ? "INVITED"
                : phase.toUpperCase()}
        </span>
      </div>
      <p className="meta mt-3">
        {c.category === "other"
          ? c.categoryLabel
          : challengeCategories[c.category]}{" "}
        ·{" "}
        {c.participationMode === "invite_only"
          ? "Invitation only"
          : "Open to the club"}
      </p>
      <h2>{c.title}</h2>
      <p className="muted text-sm mt-3">{c.description}</p>
      <p className="meta mt-3">
        {challengeDate(c.startDate)} – {challengeDate(c.endDate)}
      </p>
      <p className="challenge-goal">
        Goal: <strong>{challengeGoalDescription(c)}</strong>
      </p>
      {joined && (
        <div className="challenge-progress">
          <div className="progress-label">
            <span>
              Your progress: {progress.toLocaleString()} /{" "}
              {c.target.toLocaleString()} {challengeUnit(c)}
            </span>
            <strong>{percent}%</strong>
          </div>
          <Meter value={percent} label={`Your progress in ${c.title}`} />
        </div>
      )}
      <section
        className="leaderboard"
        aria-label={`Top participants in ${c.title}`}
      >
        <div className="section-head">
          <h3>Leading the way</h3>
          <span className="meta">TOP 3</span>
        </div>
        {leaderboard?.length ? (
          <ol className="leaderboard-list">
            {leaderboard.map((leader) => (
              <li
                key={leader.profileId}
                className={
                  leader.profileId === profile._id ? "is-you" : undefined
                }
              >
                <span
                  className="leaderboard-rank"
                  aria-label={`Rank ${leader.rank}`}
                >
                  {leader.rank}
                </span>
                <span className="leaderboard-name">
                  {leader.name}
                  {leader.profileId === profile._id && <small> · You</small>}
                </span>
                <strong className="leaderboard-score">
                  {leader.progress.toLocaleString()}
                  <small>{challengeUnit(c)}</small>
                </strong>
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted text-sm">
            {!leaderboard
              ? "The leaderboard is temporarily unavailable. Please try again shortly."
              : phase === "Upcoming"
                ? "The leaderboard starts when the challenge begins."
                : phase === "Past"
                  ? "No successful activity was recorded for this challenge."
                  : "Every little step counts. Record your first activity to get things started."}
          </p>
        )}
      </section>
      <div className="challenge-footer">
        <p className="meta">
          {participants.length}{" "}
          {participants.length === 1 ? "participant" : "participants"} ·{" "}
          {isManualChallenge(c)
            ? "Member-reported progress"
            : "Updates automatically"}
        </p>
        {feedback}
        {!joined &&
          phase !== "Past" &&
          (invited || c.participationMode === "open") && (
            <>
              <p className="muted text-sm mt-3">
                By joining, your name and aggregate score can appear on this
                challenge’s leaderboard. Daily entries and private notes stay
                private.
              </p>
              {invited ? (
                <div className="flex gap-2 mt-4">
                  <Button
                    disabled={busy}
                    onClick={() =>
                      run(
                        () => respond({ id: c._id, response: "accepted" }),
                        "Invitation accepted. You’re in!",
                      )
                    }
                  >
                    Accept invitation
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () => respond({ id: c._id, response: "declined" }),
                        "Invitation declined.",
                      )
                    }
                  >
                    Decline
                  </Button>
                </div>
              ) : (
                <Button
                  className="mt-4 w-full"
                  disabled={busy}
                  onClick={() =>
                    run(() => join({ id: c._id }), "You joined the challenge.")
                  }
                >
                  {busy ? "Joining…" : "Join challenge"}
                </Button>
              )}
            </>
          )}
        {!joined && participationStatus === "declined" && (
          <p className="muted text-sm mt-3">
            You declined this invitation. A manager can invite you again.
          </p>
        )}
        {joined && isManualChallenge(c) && phase !== "Upcoming" && (
          <ChallengeEntries row={row} />
        )}
        {joined && !isManualChallenge(c) && phase === "Active" && (
          <Button asChild className="mt-4 w-full">
            <Link href={action.href}>{action.label}</Link>
          </Button>
        )}
        {joined && phase === "Upcoming" && (
          <p className="muted text-sm mt-3">
            You’re in. Activity from {challengeDate(c.startDate)} counts toward
            your goal.
          </p>
        )}
        {phase === "Past" && (
          <p className="muted text-sm mt-3">This challenge has ended.</p>
        )}
        {membership.role !== "member" && <ManageChallenge row={row} />}
      </div>
    </article>
  );
}
