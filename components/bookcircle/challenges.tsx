"use client";
import { useState } from "react";
import { useQuery, useMutation } from "@/lib/supabase/hooks";
import { api } from "@/lib/supabase/api";
import { Button } from "@/components/ui/button";
import { Trophy, Plus } from "lucide-react";
import {
  ActionForm,
  Field,
  Modal,
  value,
  number,
  dayInZone,
  PageHeading,
  Loading,
  Empty,
  Meter,
  useFeedback,
} from "./primitives";
import { useMember } from "./shell";
export function CreateChallenge() {
  const [open, setOpen] = useState(false);
  const save = useMutation(api.club.saveChallenge);
  const { profile } = useMember();
  return (
    <Modal
      title="Give the circle a shared goal"
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button>
          <Plus />
          Create challenge
        </Button>
      }
    >
      <ActionForm
        onSuccess={() => setOpen(false)}
        label="Create challenge"
        onSubmit={(d) =>
          save({
            title: value(d, "title"),
            description: value(d, "description"),
            startDate: value(d, "start"),
            endDate: value(d, "end"),
            goalType: value(d, "type") as
              | "minutes"
              | "days"
              | "insights"
              | "commitments",
            target: number(d, "target"),
          })
        }
      >
        <Field label="Challenge title">
          <input name="title" maxLength={160} required />
        </Field>
        <Field label="Description">
          <textarea name="description" />
        </Field>
        <div className="field-row">
          <Field label="Start date">
            <input
              name="start"
              type="date"
              defaultValue={dayInZone(profile.timezone)}
              required
            />
          </Field>
          <Field label="End date">
            <input name="end" type="date" required />
          </Field>
        </div>
        <div className="field-row">
          <Field label="Goal">
            <select name="type">
              <option value="minutes">Reading minutes</option>
              <option value="days">Reading days</option>
              <option value="insights">Shared insights</option>
              <option value="commitments">Completed commitments</option>
            </select>
          </Field>
          <Field label="Target">
            <input name="target" type="number" min={1} max={1000} required />
          </Field>
        </div>
      </ActionForm>
    </Modal>
  );
}
export function ChallengesPage() {
  const { membership } = useMember();
  const rows = useQuery(api.club.challenges);
  const join = useMutation(api.club.joinChallenge);
  const { run, feedback, busy } = useFeedback();
  if (!rows) return <Loading />;
  return (
    <>
      <PageHeading
        eyebrow="A LITTLE CHALLENGE. A LOT OF ENCOURAGEMENT."
        title="Grow a little, together"
        description="Shared goals to help you make reading a steady part of life."
        action={membership.role === "admin" ? <CreateChallenge /> : undefined}
      />
      {feedback}
      {rows.length ? (
        <div className="library-grid">
          {rows.map(
            ({ challenge: c, joined, progress, completed, participants }) => (
              <article className="panel" key={c._id}>
                <span className="challenge-icon">
                  <Trophy />
                </span>
                <span className="tag mb-3">
                  {completed
                    ? "ACHIEVED"
                    : joined
                      ? "YOU’RE IN"
                      : "CLUB CHALLENGE"}
                </span>
                <h2>{c.title}</h2>
                <p className="muted text-sm mt-3">{c.description}</p>
                <p className="meta mt-4">
                  {c.startDate} → {c.endDate}
                </p>
                <div className="progress-label">
                  <span>
                    {progress} / {c.target} {c.goalType}
                  </span>
                  <strong>
                    {Math.min(100, Math.round((progress / c.target) * 100))}%
                  </strong>
                </div>
                <Meter value={(progress / c.target) * 100} />
                <p className="meta mt-4">
                  {participants.length} participants
                  {participants.length
                    ? ` · ${participants
                        .slice(0, 3)
                        .map((p) => p.name.split(" ")[0])
                        .join(", ")}`
                    : ""}
                </p>
                {!joined && (
                  <Button
                    className="mt-5 w-full"
                    disabled={
                      busy || c.endDate < new Date().toISOString().slice(0, 10)
                    }
                    onClick={() => run(() => join({ id: c._id }))}
                  >
                    Join challenge
                  </Button>
                )}
                {joined && (
                  <p className="meta mt-5">
                    Progress updates automatically from your activity.
                  </p>
                )}
              </article>
            ),
          )}
        </div>
      ) : (
        <div className="panel">
          <Empty
            title="Something to look forward to"
            description="Your administrator will post the next shared reading challenge here."
          />
        </div>
      )}
    </>
  );
}
