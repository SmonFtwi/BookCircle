"use client";
import { useState } from "react";
import { useQuery, useMutation } from "@/lib/supabase/hooks";
import { api } from "@/lib/supabase/api";
import type { Id } from "@/lib/supabase/contracts";
import { Button } from "@/components/ui/button";
import { Plus, Calendar, Vote } from "lucide-react";
import {
  ActionForm,
  Field,
  Modal,
  value,
  PageHeading,
  Loading,
  Empty,
  Cover,
  Meter,
  useFeedback,
} from "./primitives";
import { useMember } from "./shell";
import { BookSelect } from "./reading";
export function CreateRound() {
  const [open, setOpen] = useState(false);
  const save = useMutation(api.club.saveVotingRound);
  return (
    <Modal
      title="Choose our next chapter"
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button>
          <Plus />
          Open voting
        </Button>
      }
    >
      <ActionForm
        label="Open voting round"
        onSuccess={() => setOpen(false)}
        onSubmit={(d) =>
          save({
            title: value(d, "title"),
            deadline: new Date(value(d, "deadline")).getTime(),
          })
        }
      >
        <Field label="Round title">
          <input name="title" required maxLength={160} />
        </Field>
        <Field label="Voting deadline (your device timezone)">
          <input name="deadline" type="datetime-local" required />
        </Field>
      </ActionForm>
    </Modal>
  );
}
export function VotingPage() {
  const [time] = useState(() => Date.now());
  const rounds = useQuery(api.club.votingRounds, { now: time });
  const vote = useMutation(api.club.vote);
  const close = useMutation(api.club.closeVoting);
  const nominate = useMutation(api.club.nominate);
  const { membership } = useMember();
  const { run, busy, feedback } = useFeedback();
  if (!rounds) return <Loading />;
  return (
    <>
      <PageHeading
        eyebrow="LET THE CIRCLE CHOOSE"
        title="Our next good read"
        description="One member, one vote. A whole new perspective ahead."
        action={membership.role !== "member" ? <CreateRound /> : undefined}
      />
      {feedback}
      <div className="stack">
        {rounds.length ? (
          rounds.map(({ round: r, nominations, myVote }) => (
            <section key={r._id} className="panel">
              <div className="section-head">
                <div>
                  <span className="tag mb-2">{r.status.toUpperCase()}</span>
                  <h2>{r.title}</h2>
                  <p className="meta">
                    Deadline: {new Date(r.deadline).toLocaleString()}
                  </p>
                </div>
                <Vote className="text-primary" />
              </div>
              <div className="library-grid">
                {nominations.map((n) => (
                  <article className="library-card" key={n._id}>
                    <Cover
                      title={n.book.title}
                      author={n.book.author}
                      coverUrl={n.book.coverUrl}
                    />
                    <div>
                      <h3>{n.book.title}</h3>
                      <p>{n.book.author}</p>
                      {r.winnerId === n.book._id && (
                        <span className="tag mt-2">THE CIRCLE’S NEXT READ</span>
                      )}
                      {n.votes !== null ? (
                        <>
                          <div className="progress-label">
                            <span>{n.votes} votes</span>
                            <strong>{Math.round(n.percentage ?? 0)}%</strong>
                          </div>
                          <Meter value={n.percentage ?? 0} />
                        </>
                      ) : (
                        <Button
                          disabled={busy || r.deadline <= Date.now()}
                          variant={myVote === n._id ? "default" : "outline"}
                          className="mt-4"
                          onClick={() =>
                            run(() => vote({ nominationId: n._id }))
                          }
                        >
                          {myVote === n._id
                            ? "Your vote ✓"
                            : "Vote for this book"}
                        </Button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
              {!nominations.length && (
                <Empty
                  title="Nominations are on their way"
                  description="Your administrator can add books from the club library."
                />
              )}
              {membership.role !== "member" && r.status === "open" && (
                <div className="pill-row mt-6">
                  <Modal
                    title="Nominate a book"
                    trigger={
                      <Button variant="outline">
                        <Plus />
                        Add nomination
                      </Button>
                    }
                  >
                    <ActionForm
                      label="Nominate book"
                      onSubmit={(d) =>
                        nominate({
                          roundId: r._id,
                          bookId: value(d, "bookId") as Id<"books">,
                        })
                      }
                    >
                      <Field label="Book from the club library">
                        <BookSelect />
                      </Field>
                    </ActionForm>
                  </Modal>
                  <Modal
                    title="Close this voting round?"
                    description="Voting will stop and results will be shared with all members."
                    trigger={
                      <Button variant="outline">
                        Close & announce results
                      </Button>
                    }
                  >
                    <Button
                      disabled={busy}
                      onClick={() => run(() => close({ id: r._id }))}
                    >
                      Close voting
                    </Button>
                  </Modal>
                </div>
              )}
            </section>
          ))
        ) : (
          <section className="panel">
            <Empty
              title="Your next shared story awaits"
              description="Your administrator will open a book voting round here."
            />
          </section>
        )}
      </div>
    </>
  );
}
export function CreateMeeting() {
  const [open, setOpen] = useState(false);
  const save = useMutation(api.club.saveMeeting);
  return (
    <Modal
      title="Make time for a good conversation"
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button>
          <Plus />
          Schedule meeting
        </Button>
      }
    >
      <ActionForm
        label="Schedule meeting"
        onSuccess={() => setOpen(false)}
        onSubmit={(d) =>
          save({
            title: value(d, "title"),
            startsAt: new Date(value(d, "start")).getTime(),
            endsAt: new Date(value(d, "end")).getTime(),
            location: value(d, "location"),
            description: value(d, "description"),
            ...(value(d, "bookId")
              ? { bookId: value(d, "bookId") as Id<"books"> }
              : {}),
          })
        }
      >
        <Field label="Meeting title">
          <input name="title" required maxLength={160} />
        </Field>
        <Field label="Starts (your device timezone)">
          <input type="datetime-local" name="start" required />
        </Field>
        <Field label="Ends (your device timezone)">
          <input type="datetime-local" name="end" required />
        </Field>
        <Field label="Location or meeting link">
          <input name="location" required />
        </Field>
        <Field label="What will we discuss?">
          <textarea name="description" />
        </Field>
        <Field label="Related book">
          <BookSelect optional />
        </Field>
      </ActionForm>
    </Modal>
  );
}
function Agenda({ id }: { id: Id<"meetings"> }) {
  const agenda = useQuery(api.club.meetingAgenda, { meetingId: id });
  const members = useQuery(api.profiles.directory);
  if (!agenda) return <Loading />;
  const name = (id: Id<"profiles">) =>
    members?.find((m) => m.id === id)?.name ?? "Member";
  return (
    <div className="stack">
      <div>
        <h3>RSVPs & questions</h3>
        {agenda.rsvps.map((r) => (
          <div className="list-item" key={r._id}>
            <strong>
              {name(r.profileId)} · {r.status}
            </strong>
            <p>{r.question}</p>
          </div>
        ))}
      </div>
      <div>
        <h3>Book reviews</h3>
        {agenda.reviews.map((r) => (
          <div key={r._id} className="list-item">
            <strong>{name(r.profileId)}</strong>
            <ol className="list-decimal pl-5">
              {r.lessons.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ol>
            <p>Applied: {r.applied}</p>
            <p>Changed: {r.changed}</p>
            <p>Next month: {r.improvement}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
export function MeetingsPage() {
  const rows = useQuery(api.club.meetings);
  const rsvp = useMutation(api.club.rsvp);
  const reviewBook = useMutation(api.club.reviewBook);
  const { membership, profile } = useMember();
  if (!rows) return <Loading />;
  return (
    <>
      <PageHeading
        eyebrow="BEYOND THE LAST PAGE"
        title="Gather with your circle"
        description="Make space for conversation, connection, and a new point of view."
        action={membership.role !== "member" ? <CreateMeeting /> : undefined}
      />
      <div className="stack">
        {rows.length ? (
          rows.map(({ meeting: m, rsvp: r, review }) => (
            <section className="panel" key={m._id}>
              <div className="row mb-5">
                <span className="date-block">
                  <span>
                    {new Date(m.startsAt).toLocaleDateString("en", {
                      month: "short",
                      timeZone: profile.timezone,
                    })}
                  </span>
                  <strong>
                    {new Date(m.startsAt).toLocaleDateString("en", {
                      day: "numeric",
                      timeZone: profile.timezone,
                    })}
                  </strong>
                </span>
                <div>
                  <h2>{m.title}</h2>
                  <p className="meta">
                    {new Date(m.startsAt).toLocaleString(undefined, {
                      timeZone: profile.timezone,
                    })}{" "}
                    · {profile.timezone}
                  </p>
                  <p className="meta">{m.location}</p>
                </div>
              </div>
              <p className="prose">{m.description}</p>
              <div className="pill-row mt-5">
                <Modal
                  title="Save your place"
                  trigger={
                    <Button variant="outline">
                      <Calendar />
                      {r ? `RSVP: ${r.status}` : "RSVP & submit a question"}
                    </Button>
                  }
                >
                  <ActionForm
                    label="Save RSVP"
                    onSubmit={(d) =>
                      rsvp({
                        meetingId: m._id,
                        status: value(d, "status") as
                          | "going"
                          | "maybe"
                          | "declined",
                        question: value(d, "question"),
                      })
                    }
                  >
                    <Field label="Will you join us?">
                      <select name="status" defaultValue={r?.status ?? "going"}>
                        <option value="going">I’m going</option>
                        <option value="maybe">Maybe</option>
                        <option value="declined">I can’t make it</option>
                      </select>
                    </Field>
                    <Field label="A question for the discussion (optional)">
                      <textarea name="question" defaultValue={r?.question} />
                    </Field>
                  </ActionForm>
                </Modal>
                {m.bookId && (
                  <Modal
                    title="Your monthly book review"
                    trigger={
                      <Button variant="outline">
                        {review ? "Update book review" : "Prepare book review"}
                      </Button>
                    }
                  >
                    <ActionForm
                      label="Save book review"
                      onSubmit={(d) =>
                        reviewBook({
                          meetingId: m._id,
                          lessons: [
                            value(d, "lesson1"),
                            value(d, "lesson2"),
                            value(d, "lesson3"),
                          ],
                          applied: value(d, "applied"),
                          changed: value(d, "changed"),
                          improvement: value(d, "improvement"),
                        })
                      }
                    >
                      {[1, 2, 3].map((n) => (
                        <Field key={n} label={`Main lesson ${n}`}>
                          <textarea
                            name={`lesson${n}`}
                            required
                            defaultValue={review?.lessons[n - 1]}
                          />
                        </Field>
                      ))}
                      <Field label="What did you apply?">
                        <textarea
                          name="applied"
                          required
                          defaultValue={review?.applied}
                        />
                      </Field>
                      <Field label="What changed in your life?">
                        <textarea
                          name="changed"
                          required
                          defaultValue={review?.changed}
                        />
                      </Field>
                      <Field label="What will you improve next month?">
                        <textarea
                          name="improvement"
                          required
                          defaultValue={review?.improvement}
                        />
                      </Field>
                    </ActionForm>
                  </Modal>
                )}
                {membership.role !== "member" && (
                  <Modal
                    title="Meeting agenda"
                    trigger={
                      <Button variant="outline">View agenda & reviews</Button>
                    }
                  >
                    <Agenda id={m._id} />
                  </Modal>
                )}
              </div>
            </section>
          ))
        ) : (
          <section className="panel">
            <Empty
              title="The next gathering is coming"
              description="Your administrator will share meeting details here."
            />
          </section>
        )}
      </div>
    </>
  );
}
