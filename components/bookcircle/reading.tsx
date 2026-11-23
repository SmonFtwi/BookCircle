"use client";
import Link from "next/link";
import { launchQuickAction } from "./quick-actions";
import { useState } from "react";
import { useQuery, useMutation, usePaginatedQuery } from "@/lib/supabase/hooks";
import { api } from "@/lib/supabase/api";
import type { Id, Doc } from "@/lib/supabase/contracts";
import { Button } from "@/components/ui/button";
import { Plus, BookOpen } from "lucide-react";
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
  Cover,
  Meter,
  useFeedback,
} from "./primitives";
import { useMember } from "./shell";
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip } from "recharts";
export function BookSelect({
  name = "bookId",
  optional = false,
  defaultValue,
}: {
  name?: string;
  optional?: boolean;
  defaultValue?: string;
}) {
  const books = useQuery(api.reading.library);
  const [selected, setSelected] = useState(defaultValue || "");
  return (
    <select
      name={name}
      required={!optional}
      disabled={!books}
      value={selected}
      onChange={(event) => setSelected(event.target.value)}
    >
      <option value="">{optional ? "No related book" : "Choose a book"}</option>
      {books?.map((b) => (
        <option key={b._id} value={b._id}>
          {b.title}
        </option>
      ))}
    </select>
  );
}
export function LogReading({
  trigger,
  bookId,
}: {
  trigger?: React.ReactNode;
  bookId?: Id<"books">;
}) {
  return trigger ? (
    <span onClick={() => launchQuickAction({ action: "reading", bookId })}>
      {trigger}
    </span>
  ) : (
    <Button onClick={() => launchQuickAction({ action: "reading", bookId })}>
      <Plus />
      Log reading
    </Button>
  );
}
export function AddBook() {
  const [open, setOpen] = useState(false);
  const add = useMutation(api.reading.addBook);
  return (
    <Modal
      title="Add to the club library"
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button variant="outline">
          <Plus />
          Add a book
        </Button>
      }
    >
      <ActionForm
        onSuccess={() => setOpen(false)}
        label="Add book"
        onSubmit={(d) =>
          add({
            title: value(d, "title"),
            author: value(d, "author"),
            description: value(d, "description"),
            coverUrl: value(d, "coverUrl"),
            totalPages: number(d, "totalPages"),
            category: value(d, "category"),
          })
        }
      >
        <Field label="Title">
          <input name="title" maxLength={200} required />
        </Field>
        <Field label="Author">
          <input name="author" maxLength={120} required />
        </Field>
        <div className="field-row">
          <Field label="Total pages">
            <input
              name="totalPages"
              type="number"
              min={1}
              max={20000}
              required
            />
          </Field>
          <Field label="Category">
            <input name="category" required defaultValue="Personal Growth" />
          </Field>
        </div>
        <Field label="Description">
          <textarea name="description" maxLength={5000} />
        </Field>
        <Field label="Cover image URL (optional)">
          <input name="coverUrl" type="url" placeholder="https://…" />
        </Field>
      </ActionForm>
    </Modal>
  );
}
export function EditBook({ book }: { book: Doc<"books"> }) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const edit = useMutation(api.reading.editBook);
  const remove = useMutation(api.reading.deleteBook);
  const { run, busy, feedback } = useFeedback();
  return (
    <>
      <Modal
        title={`Edit ${book.title}`}
        open={open}
        onOpenChange={setOpen}
        trigger={
          <Button variant="ghost" size="sm" className="text-xs w-full mt-2">
            Edit book
          </Button>
        }
      >
        <ActionForm
          onSuccess={() => setOpen(false)}
          label="Save book changes"
          onSubmit={(d) =>
            edit({
              bookId: book._id,
              title: value(d, "title"),
              author: value(d, "author"),
              description: value(d, "description"),
              coverUrl: value(d, "coverUrl"),
              totalPages: book.totalPages,
              category: value(d, "category"),
            })
          }
        >
          <Field label="Title">
            <input
              name="title"
              defaultValue={book.title}
              maxLength={200}
              required
            />
          </Field>
          <Field label="Author">
            <input
              name="author"
              defaultValue={book.author}
              maxLength={120}
              required
            />
          </Field>
          <div className="field-row">
            <Field label="Total pages" hint="Edition length cannot be modified">
              <input
                name="totalPages"
                type="number"
                disabled
                defaultValue={book.totalPages}
              />
            </Field>
            <Field label="Category">
              <input name="category" required defaultValue={book.category} />
            </Field>
          </div>
          <Field label="Description">
            <textarea
              name="description"
              defaultValue={book.description}
              maxLength={5000}
            />
          </Field>
          <Field label="Cover image URL (optional)">
            <input
              name="coverUrl"
              type="url"
              defaultValue={book.coverUrl}
              placeholder="https://…"
            />
          </Field>
          <div className="pt-2">
            <button
              type="button"
              className="danger-link text-xs"
              onClick={() => {
                setOpen(false);
                setConfirmDelete(true);
              }}
            >
              Remove from club library
            </button>
          </div>
        </ActionForm>
      </Modal>
      <Modal
        title={`Remove ${book.title}?`}
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        description="This removes the book from the club catalog."
      >
        {feedback}
        <Button
          variant="destructive"
          disabled={busy}
          onClick={() =>
            run(async () => {
              await remove({ bookId: book._id });
              setConfirmDelete(false);
            })
          }
        >
          Delete from library
        </Button>
      </Modal>
    </>
  );
}
export function Goals() {
  const [open, setOpen] = useState(false);
  const { profile } = useMember();
  const stats = useQuery(api.reading.stats, {
    today: dayInZone(profile.timezone),
  });
  const save = useMutation(api.reading.setGoals);
  return (
    <Modal
      title="A goal that fits your life"
      description="Small, steady steps. Your goals are here to encourage you."
      open={open}
      onOpenChange={setOpen}
      trigger={<Button variant="outline">Edit goals</Button>}
    >
      <ActionForm
        onSuccess={() => setOpen(false)}
        onSubmit={(d) =>
          save({
            pages: number(d, "pages"),
            minutes: number(d, "minutes"),
            days: number(d, "days"),
          })
        }
      >
        <Field label="Pages per week">
          <input
            name="pages"
            type="number"
            min={0}
            max={10000}
            required
            defaultValue={stats?.goals.pages}
          />
        </Field>
        <Field label="Minutes per week">
          <input
            name="minutes"
            type="number"
            min={0}
            max={10080}
            required
            defaultValue={stats?.goals.minutes}
          />
        </Field>
        <Field label="Reading days per week">
          <input
            name="days"
            type="number"
            min={1}
            max={7}
            required
            defaultValue={stats?.goals.days}
          />
        </Field>
      </ActionForm>
    </Modal>
  );
}
export function ReadingPage() {
  const { membership } = useMember();
  const [tab, setTab] = useState("library");
  const [search, setSearch] = useState("");
  const [shelf, setShelf] = useState("all");
  const books = useQuery(api.reading.myBooks);
  const library = useQuery(api.reading.library);
  const setBook = useMutation(api.reading.setBook);
  const remove = useMutation(api.reading.removeBook);
  const { run, feedback, busy } = useFeedback();
  if (!books || !library) return <Loading />;
  const shown = (
    tab === "library"
      ? library.map((book) => ({
          book,
          entry: books.find((b) => b.book._id === book._id)?.entry,
        }))
      : books.filter((b) => shelf === "all" || b.entry.status === shelf)
  ).filter(({ book }) =>
    `${book.title} ${book.author}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="A WORLD BETWEEN THE COVERS"
        title="Library"
        description="Find your next good read. Make it your own."
      />
      <Field label="Search books">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Title or author"
        />
      </Field>
      <div
        className="segment-control mt-4"
        role="group"
        aria-label="Library sections"
      >
        {[
          ["library", "Club books"],
          ["shelves", "My shelves"],
        ].map(([id, label]) => (
          <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {tab === "shelves" && (
        <Field label="Shelf">
          <select value={shelf} onChange={(e) => setShelf(e.target.value)}>
            <option value="all">All my books</option>
            <option value="reading">Reading</option>
            <option value="want">Want to read</option>
            <option value="completed">Completed</option>
            <option value="paused">Paused</option>
          </select>
        </Field>
      )}
      {feedback}
      {shown.length ? (
        <div className="library-grid">
          {shown.map(({ book, entry }) => (
            <article className="panel library-card" key={book._id}>
              <Cover
                title={book.title}
                author={book.author}
                coverUrl={book.coverUrl}
              />
              <div>
                <span className="tag">{book.category}</span>
                <Link href={`/library/${book._id}`}>
                  <h3 className="mt-2">{book.title} →</h3>
                </Link>
                <p>{book.author}</p>
                <div className="progress-label">
                  <span>
                    {entry?.currentPage ?? 0} / {book.totalPages} pages
                  </span>
                  <span>
                    {Math.round(
                      ((entry?.currentPage ?? 0) / book.totalPages) * 100,
                    )}
                    %
                  </span>
                </div>
                <Meter
                  value={((entry?.currentPage ?? 0) / book.totalPages) * 100}
                />
                <Field label="Reading status">
                  <select
                    disabled={busy}
                    value={entry?.status ?? ""}
                    onChange={(e) =>
                      run(() =>
                        setBook({
                          bookId: book._id,
                          status: e.target.value as
                            | "want"
                            | "reading"
                            | "completed"
                            | "paused",
                        }),
                      )
                    }
                  >
                    <option value="" disabled>
                      Add to your list
                    </option>
                    <option value="want">Want to read</option>
                    <option value="reading">Currently reading</option>
                    <option value="paused">Paused</option>
                    <option value="completed">Completed</option>
                  </select>
                </Field>
                {entry && (
                  <button
                    className="text-button mt-2"
                    disabled={busy}
                    onClick={() => run(() => remove({ bookId: book._id }))}
                  >
                    Remove from my list
                  </button>
                )}
                {membership.role !== "member" && tab === "library" && (
                  <EditBook book={book} />
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="panel">
          <Empty
            title={
              tab === "library"
                ? "Your library starts here"
                : "Your next chapter is waiting"
            }
            description={
              tab === "library"
                ? "Your administrator can add the first book to your shared library."
                : "Explore the club library and choose a book to begin."
            }
            action={
              tab !== "library" ? (
                <Button variant="outline" onClick={() => setTab("library")}>
                  <BookOpen />
                  Explore library
                </Button>
              ) : undefined
            }
          />
        </div>
      )}
    </>
  );
}

export function ReadingHistory() {
  const { profile } = useMember();
  const library = useQuery(api.reading.library);
  const stats = useQuery(api.reading.stats, {
    today: dayInZone(profile.timezone),
  });
  const logs = usePaginatedQuery(api.reading.logs, {}, { initialNumItems: 10 });
  if (!library || !stats) return <Loading />;
  return (
    <>
      {" "}
      <div className="grid-main spaced">
        <section className="panel">
          <div className="section-head">
            <h2>Your reading rhythm</h2>
            <span className="tag">Last 14 reading days</span>
          </div>
          <div className="stat-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.calendar.slice(0, 14).reverse()}>
                <XAxis
                  dataKey="date"
                  tickFormatter={(s) => s.slice(5)}
                  tick={{ fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip />
                <Bar
                  dataKey="minutes"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="meta">
            {stats.week.minutes} / {stats.goals.minutes} minutes this week ·{" "}
            {stats.week.days} / {stats.goals.days} reading days
          </p>
        </section>
        <section className="panel">
          <h2 className="mb-4">Recent sessions</h2>
          {logs.results.length ? (
            logs.results.map((l) => (
              <div className="list-item" key={l._id}>
                <strong>
                  {library.find((b) => b._id === l.bookId)?.title ?? "Book"}
                </strong>
                <p>
                  {l.date} · {l.minutes} min · {l.pages} new pages
                </p>
                {l.notes && <p className="muted">{l.notes}</p>}
              </div>
            ))
          ) : (
            <Empty
              title="Your first session awaits"
              description="Log a little reading whenever you have a moment."
            />
          )}
          {logs.status === "CanLoadMore" && (
            <Button variant="ghost" onClick={() => logs.loadMore(10)}>
              Load more
            </Button>
          )}
        </section>
      </div>
    </>
  );
}
