"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { api } from "@/lib/supabase/api";
import { useMutation, useQuery } from "@/lib/supabase/hooks";
import type {
  ChallengeCategory,
  ChallengeGoal,
  Id,
} from "@/lib/supabase/contracts";
import {
  challengeCategories,
  challengeGoalDescription,
  challengePhase,
  type ChallengeRow,
} from "@/lib/challenges";
import { Button } from "@/components/ui/button";
import {
  ActionForm,
  Field,
  Modal,
  value,
  number,
  dayInZone,
  Loading,
  useFeedback,
} from "./primitives";
import { useMember } from "./shell";

function MemberPicker({
  selected,
  onChange,
  excluded = [],
}: {
  selected: Id<"profiles">[];
  onChange: (ids: Id<"profiles">[]) => void;
  excluded?: Id<"profiles">[];
}) {
  const members = useQuery(api.club.challengeMembers);
  const [search, setSearch] = useState("");
  const available = members?.filter((m) => !excluded.includes(m.profileId));
  const visible = available?.filter((m) =>
    m.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  return (
    <fieldset className="challenge-member-picker">
      <legend>Select members · {selected.length} selected</legend>
      <Field label="Search members">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Field>
      {!members ? (
        <Loading />
      ) : (
        <div className="challenge-member-list">
          {visible?.map((m) => (
            <label className="challenge-check" key={m.profileId}>
              <input
                type="checkbox"
                checked={selected.includes(m.profileId)}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...selected, m.profileId]
                      : selected.filter((id) => id !== m.profileId),
                  )
                }
              />
              <span>{m.name}</span>
            </label>
          ))}
          {!visible?.length && (
            <p className="muted text-sm">No matching members available.</p>
          )}
        </div>
      )}
    </fieldset>
  );
}

export function CreateChallenge() {
  const [open, setOpen] = useState(false);
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
      <CreateChallengeForm onSuccess={() => setOpen(false)} />
    </Modal>
  );
}
function CreateChallengeForm({ onSuccess }: { onSuccess: () => void }) {
  const save = useMutation(api.club.saveChallenge);
  const { profile } = useMember();
  const [category, setCategory] = useState<ChallengeCategory>("reading");
  const [goal, setGoal] = useState<ChallengeGoal>("minutes");
  const [mode, setMode] = useState<"open" | "invite_only">("open");
  const [selected, setSelected] = useState<Id<"profiles">[]>([]);
  const daily = goal === "daily_number" || goal === "daily_checkin";
  return (
    <ActionForm
      label="Create challenge"
      onSuccess={onSuccess}
      onSubmit={(d) =>
        save({
          title: value(d, "title"),
          description: value(d, "description"),
          category,
          categoryLabel:
            category === "other" ? value(d, "categoryLabel") : null,
          participationMode: mode,
          memberIds: mode === "invite_only" ? selected : [],
          startDate: value(d, "start"),
          endDate: value(d, "end"),
          goalType: goal,
          target: number(d, "target"),
          unit:
            goal === "total" || goal === "daily_number"
              ? value(d, "unit")
              : null,
          dailyThreshold:
            goal === "daily_number" ? number(d, "threshold") : null,
          comparison:
            goal === "daily_number"
              ? (value(d, "comparison") as "minimum" | "maximum")
              : null,
        })
      }
    >
      <Field label="Challenge title">
        <input name="title" maxLength={160} required />
      </Field>
      <Field
        label="Description"
        hint="Explain the activity and what counts toward the goal."
      >
        <textarea name="description" />
      </Field>
      <Field label="Category">
        <select
          aria-label="Category"
          value={category}
          onChange={(e) => {
            const next = e.target.value as ChallengeCategory;
            setCategory(next);
            setGoal(
              next === "reading"
                ? "minutes"
                : next === "screen_time"
                  ? "daily_number"
                  : "daily_checkin",
            );
          }}
        >
          {Object.entries(challengeCategories).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      {category === "other" && (
        <Field label="Custom category">
          <input name="categoryLabel" maxLength={60} required />
        </Field>
      )}
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
      <Field label="Tracking">
        <select
          value={goal}
          onChange={(e) => setGoal(e.target.value as ChallengeGoal)}
        >
          {category === "reading" && (
            <optgroup label="Automatic activity">
              <option value="minutes">Reading minutes</option>
              <option value="days">Reading days</option>
              <option value="insights">Shared insights</option>
              <option value="commitments">Completed commitments</option>
            </optgroup>
          )}
          <optgroup label="Member records progress">
            <option value="total">Total numeric target</option>
            <option value="daily_number">Daily numeric goal</option>
            <option value="daily_checkin">Daily yes/no check-in</option>
          </optgroup>
        </select>
      </Field>
      {(goal === "total" || goal === "daily_number") && (
        <Field
          label="Unit"
          hint="For example: steps, minutes, kilometres, or servings."
        >
          <input
            key={category}
            name="unit"
            maxLength={40}
            defaultValue={category === "screen_time" ? "minutes" : ""}
            required
          />
        </Field>
      )}
      {goal === "daily_number" && (
        <div className="field-row">
          <Field label="Daily rule">
            <select
              key={category}
              name="comparison"
              defaultValue={category === "screen_time" ? "maximum" : "minimum"}
            >
              <option value="minimum">At least</option>
              <option value="maximum">At most</option>
            </select>
          </Field>
          <Field label="Daily threshold">
            <input
              name="threshold"
              type="number"
              min={0}
              max={1000000000}
              step="0.01"
              required
            />
          </Field>
        </div>
      )}
      <Field
        label={daily ? "Target successful days" : "Total target"}
        hint={
          daily
            ? "Cannot exceed the number of days in the challenge."
            : undefined
        }
      >
        <input
          name="target"
          type="number"
          min={daily ? 1 : 0.01}
          max={1000000000}
          step={daily || goal !== "total" ? 1 : 0.01}
          required
        />
      </Field>
      <Field label="Who can participate?">
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as typeof mode)}
        >
          <option value="open">Open to the club</option>
          <option value="invite_only">Invite selected members</option>
        </select>
      </Field>
      {mode === "invite_only" && (
        <>
          <p className="muted text-sm">
            Only selected members and managers can see this challenge. Members
            accept or decline before participating.
          </p>
          <MemberPicker selected={selected} onChange={setSelected} />
        </>
      )}
    </ActionForm>
  );
}

export function ManageChallenge({ row }: { row: ChallengeRow }) {
  const [open, setOpen] = useState(false);
  return (
    <Modal
      title="Manage challenge"
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button variant="outline" className="mt-3 w-full">
          Manage challenge
        </Button>
      }
    >
      <ChallengeManagement row={row} />
    </Modal>
  );
}
function ChallengeManagement({ row }: { row: ChallengeRow }) {
  const { challenge: c, invitations } = row;
  const { profile } = useMember();
  const save = useMutation(api.club.saveChallenge);
  const invite = useMutation(api.club.inviteChallengeMembers);
  const revoke = useMutation(api.club.revokeChallengeInvitation);
  const [selected, setSelected] = useState<Id<"profiles">[]>([]);
  const { run, feedback, busy } = useFeedback();
  const ended = challengePhase(c, dayInZone(profile.timezone)) === "Past";
  return (
    <div className="stack">
      <ActionForm
        label="Save details"
        onSubmit={(d) =>
          save({
            id: c._id,
            title: value(d, "title"),
            description: value(d, "description"),
          })
        }
      >
        <Field label="Title">
          <input name="title" defaultValue={c.title} maxLength={160} required />
        </Field>
        <Field label="Description">
          <textarea name="description" defaultValue={c.description} />
        </Field>
        <p className="muted text-sm">
          Dates, goals, and participation mode stay fixed after creation.
        </p>
      </ActionForm>
      {c.participationMode === "invite_only" && (
        <>
          <h3>Invitations</h3>
          {feedback}
          {invitations.length === 0 && (
            <p className="muted">No invitations yet.</p>
          )}
          {invitations.map((m) => (
            <div className="section-head" key={m.profileId}>
              <span>
                {m.name} <small className="muted">· {m.status}</small>
              </span>
              {m.status === "invited" && !ended && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    run(
                      () => revoke({ id: c._id, profileId: m.profileId }),
                      "Invitation revoked.",
                    )
                  }
                >
                  Revoke
                </Button>
              )}
            </div>
          ))}
          {!ended && (
            <ActionForm
              label="Send invitations"
              onSuccess={() => setSelected([])}
              onSubmit={() => {
                if (!selected.length)
                  return Promise.reject(
                    new Error("Select at least one member."),
                  );
                return invite({ id: c._id, memberIds: selected });
              }}
            >
              <MemberPicker
                selected={selected}
                onChange={setSelected}
                excluded={invitations
                  .filter(
                    (m) => m.status === "accepted" || m.status === "invited",
                  )
                  .map((m) => m.profileId)}
              />
            </ActionForm>
          )}
        </>
      )}
    </div>
  );
}

export function ChallengeEntries({ row }: { row: ChallengeRow }) {
  const { profile } = useMember();
  return (
    <Modal
      title="Your challenge progress"
      trigger={
        <Button className="mt-4 w-full">
          {challengePhase(row.challenge, dayInZone(profile.timezone)) === "Past"
            ? "View your entries"
            : "Record progress"}
        </Button>
      }
    >
      <EntryEditor row={row} />
    </Modal>
  );
}
function EntryEditor({ row }: { row: ChallengeRow }) {
  const c = row.challenge;
  const { profile } = useMember();
  const today = dayInZone(profile.timezone);
  const active = challengePhase(c, today) === "Active";
  const [date, setDate] = useState(today);
  const entries = useQuery(api.club.challengeEntries, { id: c._id });
  const save = useMutation(api.club.saveChallengeEntry);
  const remove = useMutation(api.club.deleteChallengeEntry);
  const { run, feedback, busy } = useFeedback();
  const existing = entries?.find((e) => e.date === date);
  const minDate =
    row.acceptedDate && row.acceptedDate > c.startDate
      ? row.acceptedDate
      : c.startDate;
  return (
    <div className="stack">
      <p>{challengeGoalDescription(c)}</p>
      <p className="muted text-sm">
        Your daily entries are private. Only your name and aggregate score
        appear on the leaderboard.
      </p>
      {!entries ? (
        <Loading />
      ) : (
        <>
          {active && (
            <>
              <Field label="Entry date">
                <input
                  type="date"
                  value={date}
                  min={minDate}
                  max={today < c.endDate ? today : c.endDate}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </Field>
              <ActionForm
                key={`${date}:${existing?.value}:${existing?.successful}`}
                label={existing ? "Update entry" : "Save entry"}
                onSubmit={(d) =>
                  save({
                    id: c._id,
                    date,
                    ...(c.goalType === "daily_checkin"
                      ? { successful: value(d, "successful") === "yes" }
                      : { value: number(d, "amount") }),
                  })
                }
              >
                {c.goalType === "daily_checkin" ? (
                  <Field label="Did you meet your daily goal?">
                    <select
                      name="successful"
                      defaultValue={
                        existing?.successful === false ? "no" : "yes"
                      }
                    >
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </Field>
                ) : (
                  <Field label={`Daily amount (${c.unit})`}>
                    <input
                      name="amount"
                      type="number"
                      min={0}
                      max={1000000000}
                      step="0.01"
                      defaultValue={existing?.value ?? ""}
                      required
                    />
                  </Field>
                )}
                <p className="muted text-sm">
                  One entry per day. Saving again replaces that day’s entry.
                </p>
              </ActionForm>
            </>
          )}
          <h3>Your entries</h3>
          {feedback}
          {!entries.length && <p className="muted">No entries yet.</p>}
          {entries.map((entry) => (
            <div className="challenge-entry" key={entry.date}>
              <div>
                <strong>{entry.date}</strong>
                <p className="muted text-sm">
                  {c.goalType === "daily_checkin"
                    ? entry.successful
                      ? "Goal met"
                      : "Goal not met"
                    : `${entry.value?.toLocaleString()} ${c.unit}`}
                </p>
              </div>
              {active && (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setDate(entry.date)}>
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () => remove({ id: c._id, date: entry.date }),
                        "Entry deleted.",
                      )
                    }
                  >
                    Delete
                  </Button>
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
