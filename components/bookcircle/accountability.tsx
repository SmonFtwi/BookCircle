"use client";
import { useState } from "react";
import { useQuery, useMutation } from "@/lib/supabase/hooks";
import { api } from "@/lib/supabase/api";
import type { Id } from "@/lib/supabase/contracts";
import { Button } from "@/components/ui/button";
import { Plus, CheckCircle, HeartHandshake } from "lucide-react";
import {
  ActionForm,
  Field,
  Modal,
  value,
  dayInZone,
  PageHeading,
  Loading,
  Empty,
  useFeedback,
} from "./primitives";
import { useMember } from "./shell";
import { BookSelect } from "./reading";
export function AddCommitment({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const save = useMutation(api.club.saveCommitment);
  const { profile } = useMember();
  return (
    <Modal
      title="Turn an idea into a small action."
      open={open}
      onOpenChange={setOpen}
      description="What will you do differently because of what you read?"
      trigger={
        trigger || (
          <Button>
            <Plus />
            Add commitment
          </Button>
        )
      }
    >
      <ActionForm
        onSuccess={() => setOpen(false)}
        label="Make a commitment"
        onSubmit={(d) =>
          save({
            title: value(d, "title"),
            description: value(d, "description"),
            targetDate: value(d, "targetDate"),
            shared: d.get("shared") === "on",
            ...(value(d, "bookId")
              ? { bookId: value(d, "bookId") as Id<"books"> }
              : {}),
          })
        }
      >
        <Field label="One small action">
          <input name="title" required maxLength={160} />
        </Field>
        <Field label="How will you do it?">
          <textarea name="description" maxLength={5000} />
        </Field>
        <Field label="Target date">
          <input
            name="targetDate"
            type="date"
            defaultValue={dayInZone(profile.timezone)}
            required
          />
        </Field>
        <Field label="Related book">
          <BookSelect optional />
        </Field>
        <label className="check-field">
          <input name="shared" type="checkbox" />
          Share with my accountability partner
        </label>
      </ActionForm>
    </Modal>
  );
}
export function AccountabilityPage() {
  const { profile } = useMember();
  const [today, setToday] = useState(dayInZone(profile.timezone));
  const rows = useQuery(api.club.commitments);
  const partner = useQuery(api.club.partner);
  const review = useQuery(api.club.weeklyReview, { week: today });
  const saveReview = useMutation(api.club.saveWeeklyReview);
  const encourage = useMutation(api.club.encourage);
  const update = useMutation(api.club.setCommitmentStatus);
  const remove = useMutation(api.club.deleteCommitment);
  const { run, feedback, busy } = useFeedback();
  if (!rows) return <Loading />;
  return (
    <>
      <PageHeading
        eyebrow="SMALL ACTIONS. REAL GROWTH."
        title="Put your reading into practice"
        description="Make a promise to yourself. Let your circle cheer you on."
        action={<AddCommitment />}
      />
      <div className="grid-main">
        <div className="stack">
          <section className="panel">
            <h2 className="mb-4">My commitments</h2>
            {feedback}
            {rows.length ? (
              rows.map((c) => (
                <article className="list-item" key={c._id}>
                  <div className="row between">
                    <h3>{c.title}</h3>
                    <span className="tag">{c.status.replaceAll("_", " ")}</span>
                  </div>
                  <p className="muted mt-2">{c.description}</p>
                  <p className="meta mt-2">
                    Target: {c.targetDate}
                    {c.shared ? " · Shared with partner" : " · Private"}
                  </p>
                  {c.outcome && <p className="prose mt-2">{c.outcome}</p>}
                  <div className="reaction-row">
                    <Modal
                      title="How did it go?"
                      trigger={
                        <button>
                          <CheckCircle size={15} />
                          Record outcome
                        </button>
                      }
                    >
                      <ActionForm
                        onSubmit={(d) =>
                          update({
                            id: c._id,
                            status: value(d, "status") as
                              | "pending"
                              | "completed"
                              | "not_completed",
                            outcome: value(d, "outcome"),
                          })
                        }
                      >
                        <Field label="Status">
                          <select name="status" defaultValue={c.status}>
                            <option value="pending">Pending</option>
                            <option value="completed">Completed</option>
                            <option value="not_completed">Not completed</option>
                          </select>
                        </Field>
                        <Field label="What happened?">
                          <textarea
                            name="outcome"
                            defaultValue={c.outcome}
                            maxLength={5000}
                          />
                        </Field>
                      </ActionForm>
                    </Modal>
                    <button
                      disabled={busy}
                      className="danger-link"
                      onClick={() => run(() => remove({ id: c._id }))}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <Empty
                title="Let an idea take root"
                description="Choose one thing from your reading and try it in your everyday life."
              />
            )}
          </section>
          <section className="panel">
            <div className="section-head">
              <h2>Your weekly pause</h2>
              <input
                aria-label="Review week"
                type="date"
                value={today}
                onChange={(e) => setToday(e.target.value)}
                className="max-w-[145px]"
              />
            </div>
            {review !== undefined && (
              <ActionForm
                key={review?._id ?? today}
                label="Save weekly review"
                onSubmit={(d) =>
                  saveReview({
                    week: today,
                    achieved: d.get("achieved") === "on",
                    lesson: value(d, "lesson"),
                    improvement: value(d, "improvement"),
                  })
                }
              >
                <label className="check-field">
                  <input
                    name="achieved"
                    type="checkbox"
                    defaultChecked={review?.achieved}
                  />
                  I achieved my reading goal this week
                </label>
                <Field label="What was your most useful lesson?">
                  <textarea
                    name="lesson"
                    required
                    defaultValue={review?.lesson}
                  />
                </Field>
                <Field label="What will you improve next week?">
                  <textarea
                    name="improvement"
                    required
                    defaultValue={review?.improvement}
                  />
                </Field>
              </ActionForm>
            )}
          </section>
        </div>
        <aside className="stack">
          <section className="panel">
            <HeartHandshake className="text-primary mb-3" />
            <h2>Your reading partner</h2>
            {partner ? (
              <>
                <h3 className="mt-4">{partner.name}</h3>
                <p className="meta">
                  {partner.totals?.books ?? 0} books ·{" "}
                  {partner.totals?.minutes ?? 0} reading minutes
                </p>
                {partner.commitments.map((c) => (
                  <div className="list-item" key={c._id}>
                    <h3>{c.title}</h3>
                    <p className="meta">
                      {c.status.replaceAll("_", " ")} · {c.targetDate}
                    </p>
                  </div>
                ))}
                <div className="spaced">
                  <ActionForm
                    label="Send encouragement"
                    onSubmit={(d) =>
                      encourage({ message: value(d, "message") })
                    }
                  >
                    <Field label="A few kind words">
                      <textarea
                        name="message"
                        maxLength={280}
                        required
                        placeholder="You’ve got this…"
                      />
                    </Field>
                  </ActionForm>
                </div>
                {partner.encouragements.map((e) => (
                  <div className="list-item" key={e._id}>
                    <p>{e.message}</p>
                    <span className="meta">
                      {new Date(e._creationTime).toLocaleDateString()}
                    </span>
                  </div>
                ))}
                {partner.readingLogs.length > 0 && (
                  <div className="spaced">
                    <h3>Shared reading sessions</h3>
                    {partner.readingLogs.map((l) => (
                      <p key={l._id} className="meta">
                        {l.date} · {l.minutes} min · {l.pages} pages
                      </p>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <Empty
                title="A little encouragement goes a long way"
                description="Your administrator can pair you with a reading partner."
              />
            )}
          </section>
          <section className="quote-panel">
            <blockquote>
              Progress doesn’t need an audience. Sometimes, it just needs a
              friend.
            </blockquote>
          </section>
        </aside>
      </div>
    </>
  );
}
