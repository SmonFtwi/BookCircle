"use client";
import { useEffect, useState } from "react";
import { Drawer } from "vaul";
import {
  ArrowLeft,
  BookOpen,
  Feather,
  MessageCircle,
  Trophy,
  X,
} from "lucide-react";
import { useMutation, useQuery } from "@/lib/supabase/hooks";
import { api } from "@/lib/supabase/api";
import type { Id } from "@/lib/supabase/contracts";
import { useMember } from "./shell";
import {
  ActionForm,
  Field,
  Loading,
  dayInZone,
  number,
  value,
} from "./primitives";
import { Button } from "@/components/ui/button";
import { EntryEditor } from "./challenge-forms";
import { challengePhase, isManualChallenge } from "@/lib/challenges";
import Link from "next/link";
export type QuickAction = "reading" | "note" | "question" | "checkin";
type Launch = {
  action?: QuickAction;
  bookId?: Id<"books">;
  challengeId?: string;
  share?: boolean;
};
const EVENT = "bookcircle:quick-action";
export function launchQuickAction(detail: Launch = {}) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail }));
}
const choices = [
  {
    id: "reading",
    label: "Log reading",
    hint: "A few pages. A little progress.",
    icon: BookOpen,
  },
  {
    id: "note",
    label: "Add a note",
    hint: "Keep an idea close.",
    icon: Feather,
  },
  {
    id: "question",
    label: "Ask a question",
    hint: "Let a conversation begin.",
    icon: MessageCircle,
  },
  {
    id: "checkin",
    label: "Challenge check-in",
    hint: "Small steps, together.",
    icon: Trophy,
  },
] as const;
export function QuickActions() {
  const [open, setOpen] = useState(false);
  const [launch, setLaunch] = useState<Launch>({});
  const [toast, setToast] = useState("");
  useEffect(() => {
    const handler = (event: Event) => {
      setLaunch((event as CustomEvent<Launch>).detail);
      setOpen(true);
    };
    const close = () => setOpen(false);
    window.addEventListener(EVENT, handler);
    window.addEventListener("bookcircle:close-quick-action", close);
    return () => {
      window.removeEventListener(EVENT, handler);
      window.removeEventListener("bookcircle:close-quick-action", close);
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  function saved() {
    setOpen(false);
    setToast(
      launch.action === "reading"
        ? "Nice. A little closer to your next chapter."
        : "Saved. One small step, worth keeping.",
    );
    if (
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
      navigator.vibrate
    )
      navigator.vibrate(10);
  }
  const title =
    choices.find((c) => c.id === launch.action)?.label ?? "A little step today";
  return (
    <>
      <Drawer.Root open={open} onOpenChange={setOpen} repositionInputs>
        <Drawer.Portal>
          <Drawer.Overlay className="dialog-overlay" />
          <Drawer.Content
            className="quick-sheet"
            data-flow={!!launch.action}
            aria-describedby="quick-description"
          >
            <div className="sheet-handle" aria-hidden="true" />
            <div className="row between mb-4">
              <div className="row">
                {launch.action && (
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Back to quick actions"
                    onClick={() => setLaunch({})}
                  >
                    <ArrowLeft />
                  </Button>
                )}
                <Drawer.Title className="dialog-title">{title}</Drawer.Title>
              </div>
              <Drawer.Close asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Close quick actions"
                >
                  <X />
                </Button>
              </Drawer.Close>
            </div>
            <Drawer.Description id="quick-description" className="sr-only">
              Read, reflect, and grow with your circle.
            </Drawer.Description>
            {!launch.action ? (
              <div className="quick-action-options">
                {choices.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setLaunch({ action: c.id })}
                  >
                    <span className="action-icon">
                      <c.icon size={24} strokeWidth={1.75} />
                    </span>
                    <span>
                      <strong>{c.label}</strong>
                      <small>{c.hint}</small>
                    </span>
                  </button>
                ))}
              </div>
            ) : launch.action === "reading" ? (
              <ReadingForm bookId={launch.bookId} onSuccess={saved} />
            ) : launch.action === "note" ? (
              <NoteForm initialShare={launch.share} onSuccess={saved} />
            ) : launch.action === "question" ? (
              <QuestionForm onSuccess={saved} />
            ) : (
              <CheckinForm
                initialId={launch.challengeId}
                onSuccess={saved}
                onReading={() => setLaunch({ action: "reading" })}
                onNote={() => setLaunch({ action: "note", share: true })}
              />
            )}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
      {toast && (
        <div className="circle-toast" role="status">
          {toast}
        </div>
      )}
    </>
  );
}
function ReadingForm({
  bookId,
  onSuccess,
}: {
  bookId?: Id<"books">;
  onSuccess: () => void;
}) {
  const books = useQuery(api.reading.library);
  const mine = useQuery(api.reading.myBooks);
  const logs = useQuery(api.reading.logs, {
    paginationOpts: { numItems: 1, cursor: null },
  });
  if (!books || !mine || !logs) return <Loading />;
  const initial =
    bookId ??
    logs.page[0]?.bookId ??
    mine.find((b) => b.entry.status === "reading")?.book._id ??
    books[0]?._id;
  return (
    <SessionForm
      key={initial}
      books={books}
      mine={mine}
      initial={initial}
      onSuccess={onSuccess}
    />
  );
}
type Books = Awaited<ReturnType<typeof api.reading.library>>;
type Mine = Awaited<ReturnType<typeof api.reading.myBooks>>;
function SessionForm({
  books,
  mine,
  initial,
  onSuccess,
}: {
  books: Books;
  mine: Mine;
  initial?: Id<"books">;
  onSuccess: () => void;
}) {
  const { profile } = useMember();
  const log = useMutation(api.reading.log);
  const [bookId, setBookId] = useState(initial ?? "");
  const [minutes, setMinutes] = useState(20);
  const [page, setPage] = useState(
    mine.find((b) => b.book._id === initial)?.entry.currentPage ?? 0,
  );
  const start = mine.find((b) => b.book._id === bookId)?.entry.currentPage ?? 0;
  const length = books.find((b) => b._id === bookId)?.totalPages ?? 20000;
  if (!books.length)
    return (
      <p className="muted">
        Your club library is waiting for its first book. A club manager can add
        one in Settings.
      </p>
    );
  return (
    <ActionForm
      label="Save reading"
      onSuccess={onSuccess}
      onSubmit={(d) =>
        log({
          bookId: bookId as Id<"books">,
          date: value(d, "date"),
          startPage: number(d, "startPage"),
          endPage: page,
          minutes,
          notes: value(d, "notes"),
          reflection: value(d, "reflection"),
          shareReflection: d.get("share") === "on",
          ...(value(d, "commitment")
            ? {
                commitment: {
                  title: value(d, "commitment"),
                  targetDate: value(d, "targetDate"),
                },
              }
            : {}),
        })
      }
    >
      <Field label="Book">
        <select
          name="bookId"
          value={bookId}
          required
          onChange={(e) => {
            setBookId(e.target.value);
            setPage(
              mine.find((b) => b.book._id === e.target.value)?.entry
                .currentPage ?? 0,
            );
          }}
        >
          {books.map((b) => (
            <option key={b._id} value={b._id}>
              {b.title}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Minutes read">
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={1440}
          value={minutes || ""}
          onChange={(e) => setMinutes(Number(e.target.value))}
          required
        />
      </Field>
      <div className="pill-row" role="group" aria-label="Quick minutes">
        {[15, 30, 60].map((n) => (
          <Button
            key={n}
            type="button"
            variant="outline"
            aria-pressed={minutes === n}
            onClick={() => setMinutes(n)}
          >
            {n} min
          </Button>
        ))}
      </div>
      <Field label="Page reached">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={length}
          value={page}
          onChange={(e) => setPage(Number(e.target.value))}
          required
        />
      </Field>
      <details className="optional-fields">
        <summary>More options</summary>
        <div className="form-stack">
          <Field label="Reading date">
            <input
              type="date"
              name="date"
              required
              defaultValue={dayInZone(profile.timezone)}
              max={dayInZone(profile.timezone)}
            />
          </Field>
          <Field label="Page before reading">
            <input
              key={bookId}
              name="startPage"
              type="number"
              inputMode="numeric"
              min={0}
              max={length}
              defaultValue={start}
              required
            />
          </Field>
          <Field label="Private notes">
            <textarea name="notes" maxLength={5000} />
          </Field>
          <Field label="What stayed with you?">
            <textarea name="reflection" maxLength={10000} />
          </Field>
          <label className="check-field">
            <input name="share" type="checkbox" />
            Share this reflection with the club
          </label>
          <Field label="Your next step">
            <input name="commitment" maxLength={200} />
          </Field>
          <Field label="Target date">
            <input
              name="targetDate"
              type="date"
              defaultValue={dayInZone(profile.timezone)}
            />
          </Field>
        </div>
      </details>
    </ActionForm>
  );
}
function NoteForm({
  initialShare = false,
  onSuccess,
}: {
  initialShare?: boolean;
  onSuccess: () => void;
}) {
  const { profile } = useMember();
  const [share, setShare] = useState(initialShare);
  const books = useQuery(api.reading.library);
  const mine = useQuery(api.reading.myBooks);
  const create = useMutation(api.community.create);
  const log = useMutation(api.reading.log);
  if (!books || !mine) return <Loading />;
  const current =
    mine.find((b) => b.entry.status === "reading")?.book._id ?? books[0]?._id;
  return (
    <ActionForm
      label={share ? "Share with club" : "Save note & reading"}
      onSuccess={onSuccess}
      onSubmit={(d) => {
        const body = value(d, "content").trim();
        const bookId = value(d, "bookId") as Id<"books">;
        if (share)
          return create({
            title: value(d, "title") || body.slice(0, 200),
            content: body,
            chapter: value(d, "chapter"),
            ...(bookId ? { bookId } : {}),
          });
        const page =
          mine.find((b) => b.book._id === bookId)?.entry.currentPage ?? 0;
        return log({
          bookId,
          date: dayInZone(profile.timezone),
          startPage: page,
          endPage: page,
          minutes: number(d, "minutes"),
          notes: "",
          reflection: body,
          shareReflection: false,
        });
      }}
    >
      <Field label="Your note">
        <textarea
          autoFocus
          name="content"
          required
          maxLength={share ? 10000 : 10000}
          placeholder="One idea I’m taking with me…"
        />
      </Field>
      <Field label="Related book">
        <select name="bookId" defaultValue={current ?? ""} required={!share}>
          <option value="">No related book</option>
          {books.map((b) => (
            <option key={b._id} value={b._id}>
              {b.title}
            </option>
          ))}
        </select>
      </Field>
      <label className="check-field">
        <input
          type="checkbox"
          checked={share}
          onChange={(e) => setShare(e.target.checked)}
        />
        Share with club{" "}
        <span className="meta">{share ? "Shared" : "Private"}</span>
      </label>
      {!share && (
        <>
          <p className="meta">
            Private notes are saved with a reading session. Enter the minutes
            you read; your page stays the same.
          </p>
          <Field label="Minutes read">
            <input
              name="minutes"
              type="number"
              inputMode="numeric"
              min={1}
              max={1440}
              required
            />
          </Field>
        </>
      )}
      {share && (
        <details className="optional-fields">
          <summary>More options</summary>
          <Field label="Title">
            <input name="title" maxLength={200} />
          </Field>
          <Field label="Chapter">
            <input name="chapter" maxLength={100} />
          </Field>
        </details>
      )}
    </ActionForm>
  );
}
function QuestionForm({ onSuccess }: { onSuccess: () => void }) {
  const categories = useQuery(api.forum.categories);
  const books = useQuery(api.reading.library);
  const ask = useMutation(api.forum.ask);
  if (!categories || !books) return <Loading />;
  const active = categories.filter((c) => c.active);
  return (
    <ActionForm
      label="Post question"
      onSuccess={onSuccess}
      onSubmit={(d) => {
        const content = value(d, "content").trim();
        return ask({
          title: value(d, "title") || content.slice(0, 200),
          content,
          categoryId: value(d, "categoryId") as Id<"forumCategories">,
          anonymous: d.get("anonymous") === "on",
          ...(value(d, "bookId")
            ? { bookId: value(d, "bookId") as Id<"books"> }
            : {}),
        });
      }}
    >
      <Field label="Your question">
        <textarea
          name="content"
          autoFocus
          required
          maxLength={10000}
          placeholder="What are you wondering about?"
        />
      </Field>
      <label className="check-field">
        <input type="checkbox" name="anonymous" />
        Post anonymously
      </label>
      <p className="meta">
        Moderators and administrators can identify anonymous authors for
        moderation.
      </p>
      <details className="optional-fields">
        <summary>More options</summary>
        <Field label="Question title">
          <input name="title" maxLength={200} />
        </Field>
        <Field label="Category">
          <select
            name="categoryId"
            required
            defaultValue={active[0]?._id ?? ""}
          >
            {!active.length && (
              <option value="">No categories available</option>
            )}
            {active.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Related book">
          <select name="bookId">
            <option value="">No related book</option>
            {books.map((b) => (
              <option key={b._id} value={b._id}>
                {b.title}
              </option>
            ))}
          </select>
        </Field>
      </details>
      {!active.length && (
        <p role="alert">
          A club manager needs to add a question category first.
        </p>
      )}
    </ActionForm>
  );
}
function CheckinForm({
  initialId,
  onSuccess,
  onReading,
  onNote,
}: {
  initialId?: string;
  onSuccess: () => void;
  onReading: () => void;
  onNote: () => void;
}) {
  const { profile } = useMember();
  const rows = useQuery(api.club.challenges);
  const [id, setId] = useState(initialId ?? "");
  if (!rows) return <Loading />;
  const active = rows.filter(
    (r) =>
      r.joined &&
      challengePhase(r.challenge, dayInZone(profile.timezone)) === "Active",
  );
  const row = active.find((r) => r.challenge._id === id) ?? active[0];
  if (!row)
    return (
      <div className="stack">
        <p>Join a challenge and take a little step each day.</p>
        <Button asChild>
          <Link
            href="/club/challenges"
            onClick={() =>
              window.dispatchEvent(new Event("bookcircle:close-quick-action"))
            }
          >
            Explore challenges
          </Link>
        </Button>
      </div>
    );
  return (
    <div className="stack">
      <Field label="Challenge">
        <select
          value={row.challenge._id}
          onChange={(e) => setId(e.target.value)}
        >
          {active.map((r) => (
            <option key={r.challenge._id} value={r.challenge._id}>
              {r.challenge.title}
            </option>
          ))}
        </select>
      </Field>
      {isManualChallenge(row.challenge) ? (
        <EntryEditor key={row.challenge._id} row={row} onSuccess={onSuccess} />
      ) : (
        <>
          <p>
            This challenge counts your{" "}
            {row.challenge.goalType === "commitments"
              ? "completed commitments"
              : row.challenge.goalType === "insights"
                ? "shared insights"
                : "reading"}{" "}
            automatically.
          </p>
          {row.challenge.goalType === "commitments" ? (
            <Link
              className="primary-link"
              href="/me?section=accountability"
              onClick={() =>
                window.dispatchEvent(new Event("bookcircle:close-quick-action"))
              }
            >
              View commitments
            </Link>
          ) : (
            <Button
              onClick={
                row.challenge.goalType === "insights" ? onNote : onReading
              }
            >
              {row.challenge.goalType === "insights"
                ? "Share an insight"
                : "Log reading"}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
