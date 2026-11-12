"use client";
import Link from "next/link";
import { challengePhase, challengeDate, challengeUnit } from "@/lib/challenges";
import { useState } from "react";
import { useQuery } from "@/lib/supabase/hooks";
import { api } from "@/lib/supabase/api";
import {
  Flame,
  Clock,
  BookOpen,
  Plus,
  Lightbulb,
  MessageCircle,
  ArrowRight,
  Sprout,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMember } from "./shell";
import {
  PageHeading,
  Loading,
  Empty,
  Cover,
  Meter,
  dayInZone,
} from "./primitives";
import { LogReading } from "./reading";
import { ShareInsight, InsightCard } from "./community";
import { AskQuestion } from "./forum";
import { AddCommitment } from "./accountability";
export function HomePage() {
  const { profile } = useMember();
  const [now] = useState(() => Date.now());
  const books = useQuery(api.reading.myBooks);
  const commitments = useQuery(api.club.commitments);
  const challenges = useQuery(api.club.challenges);
  const meetings = useQuery(api.club.meetings);
  const nextMeeting = meetings
    ?.filter((x) => x.meeting.endsAt > now)
    .sort((a, b) => a.meeting.startsAt - b.meeting.startsAt)[0]?.meeting;
  const today = dayInZone(profile.timezone);
  const activeChallenge =
    challenges?.find(
      (x) =>
        x.participationStatus === "invited" &&
        challengePhase(x.challenge, today) !== "Past",
    ) ??
    challenges?.find(
      (x) => x.joined && challengePhase(x.challenge, today) === "Active",
    ) ??
    challenges?.find((x) => challengePhase(x.challenge, today) === "Active") ??
    challenges
      ?.filter((x) => challengePhase(x.challenge, today) === "Upcoming")
      .sort((a, b) =>
        a.challenge.startDate.localeCompare(b.challenge.startDate),
      )[0];
  const stats = useQuery(api.reading.stats, {
    today: dayInZone(profile.timezone),
  });
  const feed = useQuery(api.community.feed, {
    paginationOpts: { numItems: 3, cursor: null },
  });
  const questions = useQuery(api.forum.list, {
    mode: "unanswered",
    paginationOpts: { numItems: 3, cursor: null },
  });
  const hour = Number(
    new Intl.DateTimeFormat("en", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: profile.timezone,
    }).format(new Date()),
  );
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  if (!books || !stats) return <Loading />;
  const current = books.find((b) => b.entry.status === "reading");
  return (
    <>
      <PageHeading
        eyebrow={new Intl.DateTimeFormat("en", {
          timeZone: profile.timezone,
          weekday: "long",
          month: "long",
          day: "numeric",
        }).format(new Date())}
        title={`${greeting}, ${profile.name.split(" ")[0]}.`}
        description="Pick up your book, track your progress, and take your next small step."
        action={<LogReading />}
      />
      <div className="grid-main">
        <div className="stack">
          <section className="hero-card">
            <p className="eyebrow">YOUR CURRENT CHAPTER</p>
            {current ? (
              <div className="hero-book">
                <Cover
                  title={current.book.title}
                  author={current.book.author}
                  coverUrl={current.book.coverUrl}
                />
                <div className="hero-info">
                  <h2>{current.book.title}</h2>
                  <p>by {current.book.author}</p>
                  <div className="progress-label">
                    <span>
                      Page {current.entry.currentPage} of{" "}
                      {current.book.totalPages}
                    </span>
                    <strong>
                      {Math.round(
                        (current.entry.currentPage / current.book.totalPages) *
                          100,
                      )}
                      % complete
                    </strong>
                  </div>
                  <Meter
                    value={
                      (current.entry.currentPage / current.book.totalPages) *
                      100
                    }
                  />
                  <LogReading
                    bookId={current.book._id}
                    trigger={
                      <Button>
                        Continue reading <ArrowRight />
                      </Button>
                    }
                  />
                </div>
              </div>
            ) : (
              <Empty
                title="Make room for your next good book"
                description="Choose a book from your club library and turn the first page."
                action={
                  <Button asChild>
                    <Link href="/reading">
                      Explore your library <ArrowRight />
                    </Link>
                  </Button>
                }
              />
            )}
          </section>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-top">
                Reading streak <Flame size={17} />
              </div>
              <p className="stat-number">
                {stats.streak} <small>days</small>
              </p>
              <span className="stat-caption">One day at a time</span>
            </div>
            <div className="stat-card">
              <div className="stat-top">
                This week <Clock size={17} />
              </div>
              <p className="stat-number">
                {stats.week.minutes} <small>min</small>
              </p>
              <span className="stat-caption">
                of {stats.goals.minutes} min goal
              </span>
            </div>
            <div className="stat-card">
              <div className="stat-top">
                Books finished <BookOpen size={17} />
              </div>
              <p className="stat-number">
                {stats.totals.books} <small>books</small>
              </p>
              <span className="stat-caption">Lessons to carry with you</span>
            </div>
          </div>
          <section>
            <div className="section-head">
              <h2>A little something today</h2>
            </div>
            <div className="quick-grid">
              <LogReading
                trigger={
                  <button className="quick-button">
                    <Plus size={21} />
                    Log reading
                  </button>
                }
              />
              <ShareInsight
                trigger={
                  <button className="quick-button">
                    <Lightbulb size={21} />
                    Share insight
                  </button>
                }
              />
              <AskQuestion
                trigger={
                  <button className="quick-button">
                    <MessageCircle size={21} />
                    Ask a question
                  </button>
                }
              />
              <AddCommitment
                trigger={
                  <button className="quick-button">
                    <Sprout size={21} />
                    Add commitment
                  </button>
                }
              />
            </div>
          </section>
        </div>
        <aside className="stack">
          {activeChallenge && (
            <section className="panel">
              <p className="eyebrow">
                {challengePhase(activeChallenge.challenge, today) === "Upcoming"
                  ? "UP NEXT"
                  : "YOUR NEXT CHALLENGE"}
              </p>
              <h2>{activeChallenge.challenge.title}</h2>
              <p className="muted text-sm mt-3">
                {activeChallenge.challenge.description}
              </p>
              <p className="meta mt-3">
                {challengeDate(activeChallenge.challenge.startDate)} –{" "}
                {challengeDate(activeChallenge.challenge.endDate)}
              </p>
              <div className="progress-label">
                <span>
                  {activeChallenge.progress} /{" "}
                  {activeChallenge.challenge.target}{" "}
                  {challengeUnit(activeChallenge.challenge)}
                </span>
              </div>
              <Meter
                value={
                  (activeChallenge.progress /
                    activeChallenge.challenge.target) *
                  100
                }
              />
              <Link href="/challenges" className="section-link mt-4">
                {activeChallenge.joined
                  ? "View challenge"
                  : activeChallenge.participationStatus === "invited"
                    ? "Respond to invitation"
                    : "View challenge"}{" "}
                →
              </Link>
            </section>
          )}
          {commitments?.some((c) => c.status === "pending") && (
            <section className="panel">
              <h2>Ideas into action</h2>
              {commitments
                .filter((c) => c.status === "pending")
                .slice(0, 3)
                .map((c) => (
                  <Link
                    key={c._id}
                    className="list-item block"
                    href="/accountability"
                  >
                    <h3>{c.title}</h3>
                    <p className="meta">Due {c.targetDate}</p>
                  </Link>
                ))}
            </section>
          )}
          <section className="panel">
            <div className="section-head">
              <h2>Your weekly rhythm</h2>
              <span className="tag">THIS WEEK</span>
            </div>
            <p className="muted text-sm mb-5">
              A little consistency makes a difference.
            </p>
            <div className="progress-label">
              <span>Reading days</span>
              <strong>
                {stats.week.days} / {stats.goals.days}
              </strong>
            </div>
            <Meter value={(stats.week.days / stats.goals.days) * 100} />
            <div className="progress-label mt-5">
              <span>Pages read</span>
              <strong>
                {stats.week.pages} / {stats.goals.pages}
              </strong>
            </div>
            <Meter
              value={
                stats.goals.pages
                  ? (stats.week.pages / stats.goals.pages) * 100
                  : 0
              }
            />
            <Link href="/challenges" className="section-link mt-6">
              Explore club challenges <ArrowRight size={14} />
            </Link>
          </section>

          <section className="panel">
            <div className="row">
              <span className="challenge-icon mb-0">
                <Calendar size={21} />
              </span>
              <div>
                <h3>{nextMeeting?.title ?? "Make time for your circle"}</h3>
                <p className="meta">
                  {nextMeeting
                    ? new Date(nextMeeting.startsAt).toLocaleString(undefined, {
                        timeZone: profile.timezone,
                      })
                    : "Conversations beyond the page."}
                </p>
              </div>
            </div>
            <Link href="/meetings" className="section-link mt-5">
              Meetings & book reviews <ArrowRight size={14} />
            </Link>
          </section>
        </aside>
      </div>
      <div className="grid-main home-community">
        <section className="panel">
          <div className="section-head">
            <h2>From the circle</h2>
            <Link href="/community" className="section-link">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          {!feed ? (
            <Loading />
          ) : feed.page.length ? (
            feed.page.map((item) => (
              <InsightCard key={item.post._id} item={item} />
            ))
          ) : (
            <Empty
              title="Good ideas belong here"
              description="Be the first to share a lesson with your circle."
              action={
                <ShareInsight
                  trigger={
                    <Button variant="outline">Share your first insight</Button>
                  }
                />
              }
            />
          )}
        </section>
        <section className="panel">
          <div className="section-head">
            <h2>Join the conversation</h2>
            <MessageCircle size={19} className="text-primary" />
          </div>
          {!questions ? (
            <Loading />
          ) : questions.page.length ? (
            questions.page.map((q) => (
              <Link
                className="list-item block"
                key={q.id}
                href={`/forum/${q.id}`}
              >
                <h3>{q.title}</h3>
                <p className="meta mt-2">
                  {q.category} · Awaiting a perspective
                </p>
              </Link>
            ))
          ) : (
            <p className="muted text-sm">
              A thoughtful question can open up a whole new perspective.
            </p>
          )}
          <Link href="/forum" className="section-link mt-5">
            Visit the forum <ArrowRight size={14} />
          </Link>
        </section>
      </div>
    </>
  );
}
