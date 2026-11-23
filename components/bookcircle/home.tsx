"use client";
import { Onboarding } from "./onboarding";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Calendar,
  ArrowRight,
  Vote,
  MessageCircle,
  Feather,
} from "lucide-react";
import { useQuery } from "@/lib/supabase/hooks";
import { api } from "@/lib/supabase/api";
import { useMember } from "./shell";
import { Button } from "@/components/ui/button";
import {
  Cover,
  Empty,
  Loading,
  PageHeading,
  dayInZone,
  errorText,
} from "./primitives";
import { ProgressRing, StreakRibbon } from "./signature";
import { launchQuickAction } from "./quick-actions";
import { InsightCard } from "./community";
import { InlineRSVP } from "./events";
import { challengePhase } from "@/lib/challenges";
type Insights = Awaited<ReturnType<typeof api.community.feed>>;
type Questions = Awaited<ReturnType<typeof api.forum.list>>;
function ActivityFeed() {
  const [count, setCount] = useState(6);
  const [revision, setRevision] = useState(0);
  const [fresh, setFresh] = useState(false);
  const [data, setData] = useState<{
    insights: Insights;
    questions: Questions;
  }>();
  const [error, setError] = useState("");
  useEffect(() => {
    const notify = () => setFresh(true);
    window.addEventListener("bookcircle:new-activity", notify);
    return () => window.removeEventListener("bookcircle:new-activity", notify);
  }, []);
  useEffect(() => {
    let live = true;
    const paginationOpts = { numItems: count, cursor: null };
    Promise.all([
      api.community.feed({ paginationOpts }),
      api.forum.list({ mode: "recent", paginationOpts }),
    ])
      .then(([insights, questions]) => {
        if (live) {
          setData({ insights, questions });
          setError("");
        }
      })
      .catch((e) => {
        if (live) setError(errorText(e));
      });
    return () => {
      live = false;
    };
  }, [count, revision]);
  const items = data
    ? [
        ...data.insights.page.map((item) => ({
          id: `insight-${item.post._id}`,
          time: item.post._creationTime,
          content: <InsightCard item={item} />,
        })),
        ...data.questions.page.map((q) => ({
          id: `question-${q.id}`,
          time: q.createdAt,
          content: (
            <article className="feed-card">
              <div className="author-row">
                <span className="avatar" aria-hidden="true">
                  {q.author.name.slice(0, 1)}
                </span>
                <div>
                  <strong>{q.author.name}</strong>
                  <p className="meta">
                    Started a conversation ·{" "}
                    {new Date(q.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <Link href={`/forum/${q.id}`}>
                <h3>{q.title}</h3>
              </Link>
              <p className="meta mt-3">
                {q.category} · {q.answerCount} answers
              </p>
              <Link className="section-link mt-3" href={`/forum/${q.id}`}>
                Join the conversation <ArrowRight size={16} />
              </Link>
            </article>
          ),
        })),
      ]
        .sort((a, b) => b.time - a.time)
        .slice(0, count)
    : [];
  return (
    <section className="stack" aria-label="Club activity">
      <div className="section-head">
        <h2>From your circle</h2>
        <Feather size={20} className="text-primary" />
      </div>
      {fresh && (
        <Button
          className="new-activity"
          variant="outline"
          onClick={() => {
            setRevision((r) => r + 1);
            setFresh(false);
          }}
        >
          New activity ↑
        </Button>
      )}
      {error && (
        <div role="alert" className="panel">
          <p>{error}</p>
          <Button variant="outline" onClick={() => setRevision((r) => r + 1)}>
            Try again
          </Button>
        </div>
      )}
      {!data ? (
        <Loading />
      ) : items.length ? (
        <>
          {items.map((item) => (
            <div key={item.id}>{item.content}</div>
          ))}
          {(!data.insights.isDone ||
            !data.questions.isDone ||
            data.insights.page.length + data.questions.page.length > count) && (
            <Button variant="outline" onClick={() => setCount((n) => n + 6)}>
              Load more
            </Button>
          )}
        </>
      ) : (
        <div className="panel">
          <Empty
            title="Every circle starts with a conversation"
            description="Share a thought from your latest read. Someone might need to hear it."
            action={
              <Button
                variant="outline"
                onClick={() =>
                  launchQuickAction({ action: "note", share: true })
                }
              >
                Share an insight
              </Button>
            }
          />
        </div>
      )}
    </section>
  );
}
export function HomePage() {
  const { profile } = useMember();
  const [now] = useState(() => Date.now());
  const today = dayInZone(profile.timezone);
  const stats = useQuery(api.reading.stats, { today });
  const books = useQuery(api.reading.myBooks);
  const meetings = useQuery(api.club.meetings);
  const rounds = useQuery(api.club.votingRounds, { now });
  const challenges = useQuery(api.club.challenges);
  if (!stats || !books) return <Loading />;
  const current = books.find((b) => b.entry.status === "reading");
  const next = meetings
    ?.filter((m) => m.meeting.endsAt > now)
    .sort((a, b) => a.meeting.startsAt - b.meeting.startsAt)[0];
  const vote = rounds?.find(
    (r) => r.round.status === "open" && r.round.deadline > now,
  );
  const active = challenges
    ?.filter((r) => r.joined && challengePhase(r.challenge, today) === "Active")
    .slice(0, 2);
  return (
    <>
      <Onboarding />
      <PageHeading
        eyebrow={new Intl.DateTimeFormat("en", {
          timeZone: profile.timezone,
          weekday: "long",
          month: "long",
          day: "numeric",
        }).format(new Date())}
        title={`A little further, ${profile.name.split(" ")[0]}.`}
        description="A few pages. A good conversation. Your circle."
      />
      <div className="stack home-feed">
        <section className="panel streak-card">
          <div className="row between">
            <div>
              <p className="eyebrow">YOUR READING RHYTHM</p>
              <h2>You’re on a {stats.streak}-day streak.</h2>
              <p className="muted">
                {stats.week.minutes} of {stats.goals.minutes} minutes this week
              </p>
            </div>
            <ProgressRing
              value={
                stats.goals.minutes
                  ? (stats.week.minutes / stats.goals.minutes) * 100
                  : 0
              }
              label="Weekly reading goal"
            />
          </div>
          <div className="row between mt-5">
            <Button onClick={() => launchQuickAction({ action: "reading" })}>
              Log reading <ArrowRight size={18} />
            </Button>
            <StreakRibbon>{stats.streak} days</StreakRibbon>
          </div>
        </section>
        {!meetings ? (
          <Loading />
        ) : (
          next && (
            <section className="panel meeting-feed-card">
              <div className="section-head">
                <span className="eyebrow">NEXT GATHERING</span>
                <Calendar size={20} className="text-primary" />
              </div>
              <h2>{next.meeting.title}</h2>
              <p className="meta mt-3">
                {new Date(next.meeting.startsAt).toLocaleString(undefined, {
                  timeZone: profile.timezone,
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}{" "}
                · {next.meeting.location}
              </p>
              <InlineRSVP
                meetingId={next.meeting._id}
                status={next.rsvp?.status}
                question={next.rsvp?.question}
              />
              <Link className="section-link mt-3" href="/club/meetings">
                Meeting details <ArrowRight size={16} />
              </Link>
            </section>
          )
        )}
        {vote && (
          <section className="panel">
            <div className="section-head">
              <span className="eyebrow">OUR NEXT CHAPTER</span>
              <Vote size={20} className="text-primary" />
            </div>
            <h2>{vote.round.title}</h2>
            <p className="muted mt-2">
              Vote closes in{" "}
              {Math.max(1, Math.ceil((vote.round.deadline - now) / 86400000))}{" "}
              days.
            </p>
            <Link className="section-link mt-4" href="/club/vote">
              {vote.myVote ? "See your vote" : "Vote"} <ArrowRight size={16} />
            </Link>
          </section>
        )}
        {active?.map((row) => (
          <article className="panel" key={row.challenge._id}>
            <div className="row between">
              <div>
                <p className="eyebrow">A SMALL DAILY STEP</p>
                <h2>{row.challenge.title}</h2>
                <p className="muted">
                  {row.progress} of {row.challenge.target} ·{" "}
                  {row.completed
                    ? "Goal reached. Well done!"
                    : "Keep your promise to yourself."}
                </p>
              </div>
              <ProgressRing
                value={(row.progress / row.challenge.target) * 100}
                label={`Your progress in ${row.challenge.title}`}
                size={64}
              />
            </div>
            <button
              className="section-link mt-4"
              onClick={() => launchQuickAction({ action: "checkin" })}
            >
              Check in today <ArrowRight size={16} />
            </button>
          </article>
        ))}
        {current && (
          <section className="panel current-chapter">
            <Cover
              small
              title={current.book.title}
              author={current.book.author}
              coverUrl={current.book.coverUrl}
            />
            <div>
              <p className="eyebrow">ON YOUR NIGHTSTAND</p>
              <h2>{current.book.title}</h2>
              <p className="meta">
                {current.book.author} · Page {current.entry.currentPage} of{" "}
                {current.book.totalPages}
              </p>
              <Link className="section-link" href="/library">
                Your shelves <ArrowRight size={16} />
              </Link>
            </div>
          </section>
        )}
        <ActivityFeed />
        <Link className="section-link" href="/club/discuss">
          <MessageCircle size={18} /> All conversations <ArrowRight size={16} />
        </Link>
      </div>
    </>
  );
}
