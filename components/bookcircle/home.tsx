"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Calendar } from "lucide-react";
import { useQuery } from "@/lib/supabase/hooks";
import { api } from "@/lib/supabase/api";
import { Button } from "@/components/ui/button";
import { useMember } from "./shell";
import { Cover, Loading, Meter, PageHeading, dayInZone } from "./primitives";
import { launchQuickAction } from "./quick-actions";
import { InlineRSVP } from "./events";
import { Goals } from "./reading";
import { DiscussionFeed } from "./discussions";

export function HomePage() {
  const { profile } = useMember();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const stats = useQuery(api.reading.stats, {
    today: dayInZone(profile.timezone),
  });
  const books = useQuery(api.reading.myBooks);
  const meetings = useQuery(api.club.meetings);
  const rounds = useQuery(api.club.votingRounds, { now: 0 });
  if (!stats || !books || !meetings || !rounds) return <Loading />;
  const current = books.find((b) => b.entry.status === "reading");
  const next = meetings.find((m) => m.meeting.endsAt > now);
  const vote = rounds.find(
    (r) => r.round.status === "open" && r.round.deadline > now,
  );
  return (
    <>
      <PageHeading
        title={`Hi, ${profile.name.split(" ")[0]}`}
        description="What are you reading today?"
      />
      <div className="stack home-feed">
        <section className="panel reading-focus">
          {current ? (
            <>
              <div className="current-chapter">
                <Cover
                  small
                  title={current.book.title}
                  author={current.book.author}
                  coverUrl={current.book.coverUrl}
                />
                <div>
                  <p className="meta">Currently reading</p>
                  <h2>
                    <Link href={`/library/${current.book._id}`}>
                      {current.book.title}
                    </Link>
                  </h2>
                  <p className="meta">{current.book.author}</p>
                  <p className="meta">
                    Page {current.entry.currentPage} of{" "}
                    {current.book.totalPages}
                  </p>
                </div>
              </div>
              <Button
                onClick={() =>
                  launchQuickAction({
                    action: "reading",
                    bookId: current.book._id,
                  })
                }
              >
                Log reading <ArrowRight size={18} />
              </Button>
            </>
          ) : (
            <>
              <BookOpen size={28} className="text-primary" />
              <h2>Choose your next book</h2>
              <p className="muted">
                Find a book in the club library and start reading.
              </p>
              <Button asChild>
                <Link href="/library">
                  Browse books <ArrowRight size={18} />
                </Link>
              </Button>
            </>
          )}
        </section>
        <section
          className="weekly-summary"
          aria-label="Weekly reading progress"
        >
          <div className="row between">
            <div>
              <h2>This week</h2>
              <p className="meta">
                {stats.week.minutes} of {stats.goals.minutes} minutes
                {stats.streak > 0 ? ` · ${stats.streak}-day streak` : ""}
              </p>
            </div>
            <Goals />
          </div>
          <Meter
            value={
              stats.goals.minutes
                ? (stats.week.minutes / stats.goals.minutes) * 100
                : 0
            }
            label="Weekly reading goal"
          />
        </section>
        {next && (
          <section className="panel">
            <div className="section-head">
              <h2>Next meeting</h2>
              <Calendar size={20} className="text-primary" />
            </div>
            <h3>{next.meeting.title}</h3>
            <p className="meta mt-2">
              {new Date(next.meeting.startsAt).toLocaleString(undefined, {
                timeZone: profile.timezone,
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}{" "}
              · {profile.timezone}
            </p>
            <p className="meta">{next.meeting.location}</p>
            <InlineRSVP
              meetingId={next.meeting._id}
              status={next.rsvp?.status}
              question={next.rsvp?.question}
            />
            <Link className="section-link mt-3" href="/club/meetings">
              Meeting details <ArrowRight size={16} />
            </Link>
          </section>
        )}
        {vote && (
          <Link href="/club/vote" className="vote-summary">
            <div>
              <span className="meta">
                {vote.myVote ? "You voted" : "Choose our next book"}
              </span>
              <h3>{vote.round.title}</h3>
            </div>
            <span className="section-link">
              {vote.myVote ? "View vote" : "Vote"} <ArrowRight size={18} />
            </span>
          </Link>
        )}
        <section className="stack">
          <div className="section-head">
            <h2>Recent conversations</h2>
            <Link className="section-link" href="/club/discuss">
              View all <ArrowRight size={16} />
            </Link>
          </div>
          <DiscussionFeed compact />
        </section>
      </div>
    </>
  );
}
