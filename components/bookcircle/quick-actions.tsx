"use client";
import { useEffect, useState } from "react";
import { Drawer } from "vaul";
import { ArrowLeft, BookOpen, Feather, MessageCircle, X } from "lucide-react";
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
export type QuickAction = "reading" | "note" | "question";
type Launch = {
  action?: QuickAction;
  bookId?: Id<"books">;
  share?: boolean;
};
const EVENT = "bookcircle:quick-action";
export function launchQuickAction(detail: Launch = {}) {
  const target =
    detail.action === "note" && detail.share
      ? { ...detail, action: "question" }
      : detail;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: target }));
}
const choices = [
  {
    id: "reading",
    label: "Log reading",
    hint: "Save your time and page.",
    icon: BookOpen,
  },
  {
    id: "note",
    label: "Private note",
    hint: "Only you can see it.",
    icon: Feather,
  },
  {
    id: "question",
    label: "Post to club",
    hint: "Share a thought or ask a question.",
    icon: MessageCircle,
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
        ? "Reading saved."
        : launch.action === "note" && !launch.share
          ? "Note saved privately."
          : "Posted to club.",
    );
    if (
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
      navigator.vibrate
    )
      navigator.vibrate(10);
  }
  const title = choices.find((c) => c.id === launch.action)?.label ?? "Add";
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
                    onClick={() =>
                      setLaunch({ action: c.id, share: c.id === "question" })
                    }
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
              <NoteForm onSuccess={saved} />
            ) : (
              <QuestionForm
                initialType={launch.share ? "thought" : "question"}
                onSuccess={saved}
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
          shareReflection: false,
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
        </div>
      </details>
    </ActionForm>
  );
}
function NoteForm({ onSuccess }: { onSuccess: () => void }) {
  const books = useQuery(api.reading.library);
  const save = useMutation(api.reading.saveNote);
  if (!books) return <Loading />;
  return (
    <ActionForm
      label="Save private note"
      successMessage="Saved privately."
      onSuccess={onSuccess}
      onSubmit={(d) =>
        save({
          body: value(d, "content").trim(),
          ...(value(d, "bookId")
            ? { bookId: value(d, "bookId") as Id<"books"> }
            : {}),
        })
      }
    >
      <Field label="Your note">
        <textarea
          autoFocus
          name="content"
          required
          maxLength={10000}
          placeholder="One idea I’m taking with me…"
        />
      </Field>
      <Field label="Related book (optional)">
        <select name="bookId" defaultValue="">
          <option value="">No related book</option>
          {books.map((b) => (
            <option key={b._id} value={b._id}>
              {b.title}
            </option>
          ))}
        </select>
      </Field>
      <p className="meta">Only you can see this note.</p>
    </ActionForm>
  );
}
function QuestionForm({
  initialType,
  onSuccess,
}: {
  initialType: string;
  onSuccess: () => void;
}) {
  const categories = useQuery(api.forum.categories);
  const books = useQuery(api.reading.library);
  const ask = useMutation(api.forum.ask);
  const create = useMutation(api.community.create);
  const [kind, setKind] = useState(initialType);
  if (!categories || !books) return <Loading />;
  const active = categories.filter((c) => c.active);
  return (
    <ActionForm
      label="Post to club"
      onSuccess={onSuccess}
      onSubmit={(d) => {
        const content = value(d, "content").trim();
        if (kind === "thought")
          return create({
            title: value(d, "title") || content.slice(0, 200),
            content,
            chapter: "",
            ...(value(d, "bookId")
              ? { bookId: value(d, "bookId") as Id<"books"> }
              : {}),
          });
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
      <Field label="Post type">
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="thought">Thought</option>
          <option value="question">Question</option>
        </select>
      </Field>
      <Field label="Your message">
        <textarea
          name="content"
          autoFocus
          required
          maxLength={10000}
          placeholder="Share something from your reading…"
        />
      </Field>
      <p className="meta">Visible to everyone in your club.</p>
      {kind === "question" && (
        <>
          <label className="check-field">
            <input type="checkbox" name="anonymous" />
            Post anonymously
          </label>
          <p className="meta">
            Moderators and administrators can identify anonymous authors for
            moderation.
          </p>
        </>
      )}
      <details className="optional-fields">
        <summary>More options</summary>
        <Field label="Title (optional)">
          <input name="title" maxLength={200} />
        </Field>
        <Field label="Category">
          <select
            name="categoryId"
            required={kind === "question"}
            defaultValue={active[0]?._id ?? ""}
          >
            {kind === "question" && !active.length && (
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
      {kind === "question" && !active.length && (
        <p role="alert">
          A club manager needs to add a question category first.
        </p>
      )}
    </ActionForm>
  );
}
