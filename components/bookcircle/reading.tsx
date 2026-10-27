"use client";
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
  const [open, setOpen] = useState(false);
  const [reflect, setReflect] = useState(false);
  const log = useMutation(api.reading.log);
  const { profile } = useMember();
  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Make today a reading day."
      description="A few pages count. Capture your progress, then reflect if you’d like."
      trigger={
        trigger || (
          <Button>
            <Plus />
            Log reading
          </Button>
        )
      }
    >
      <ActionForm
        label="Save reading session"
        onSuccess={() => setOpen(false)}
        onSubmit={async (d) => {
          await log({
            bookId: value(d, "bookId") as Id<"books">,
            date: value(d, "date"),
            startPage: number(d, "startPage"),
            endPage: number(d, "endPage"),
            minutes: number(d, "minutes"),
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
          });
        }}
      >
        <Field label="What did you read?">
          <BookSelect defaultValue={bookId} />
        </Field>
        <div className="field-row">
          <Field label="Reading date">
            <input
              name="date"
              type="date"
              defaultValue={dayInZone(profile.timezone)}
              max={dayInZone(profile.timezone)}
              required
            />
          </Field>
          <Field label="Minutes read">
            <input
              name="minutes"
              type="number"
              min={1}
              max={1440}
              defaultValue={20}
              required
            />
          </Field>
        </div>
        <div className="field-row">
          <Field label="Page before reading">
            <input
              name="startPage"
              type="number"
              min={0}
              defaultValue={0}
              required
            />
          </Field>
          <Field label="Page reached">
            <input name="endPage" type="number" min={0} required />
          </Field>
        </div>
        <Field label="Private notes (optional)">
          <textarea
            name="notes"
            maxLength={5000}
            placeholder="Something to remember…"
          />
        </Field>
        <button
          type="button"
          className="text-button"
          onClick={() => setReflect(!reflect)}
        >
          {reflect ? "Hide reflection" : "Read → Reflect → Apply (optional)"}
        </button>
        {reflect && (
          <>
            <Field label="What is one important idea you learned?">
              <textarea name="reflection" maxLength={10000} />
            </Field>
            <label className="check-field">
              <input name="share" type="checkbox" />
              Share this reflection with the club
            </label>
            <Field label="How will you apply this lesson?">
              <input
                name="commitment"
                maxLength={200}
                placeholder="One small action…"
              />
            </Field>
            <Field label="Target date">
              <input
                name="targetDate"
                type="date"
                defaultValue={dayInZone(profile.timezone)}
              />
            </Field>
          </>
        )}
      </ActionForm>
    </Modal>
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
  const { profile, membership } = useMember();
  const [tab, setTab] = useState("reading");
  const books = useQuery(api.reading.myBooks);
  const library = useQuery(api.reading.library);
  const stats = useQuery(api.reading.stats, {
    today: dayInZone(profile.timezone),
  });
  const logs = usePaginatedQuery(api.reading.logs, {}, { initialNumItems: 10 });
  const setBook = useMutation(api.reading.setBook);
  const remove = useMutation(api.reading.removeBook);
  const { run, feedback, busy } = useFeedback();
  if (!books || !library || !stats) return <Loading />;
  const shown =
    tab === "library"
      ? library.map((book) => ({
          book,
          entry: books.find((b) => b.book._id === book._id)?.entry,
        }))
      : books.filter((b) => tab === "all" || b.entry.status === tab);
  return (
    <>
      <PageHeading
        eyebrow="ONE PAGE AT A TIME"
        title="Your reading journey"
        description="Choose a book from Club library, then use Reading status to add it to your list or move it between shelves."
        action={<LogReading />}
      />
      <div className="row between mb-6">
        <div className="pill-row">
          <Goals />
          {membership.role !== "member" && <AddBook />}
        </div>
        <span className="meta">{stats.totals.books} books completed</span>
      </div>
      {feedback}
      <div className="tabs-row">
        {[
          ["reading", "Reading"],
          ["want", "Want to read"],
          ["completed", "Completed"],
          ["paused", "Paused"],
          ["library", "Club library"],
        ].map(([id, label]) => (
          <button
            className={tab === id ? "active" : ""}
            key={id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
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
                <h3 className="mt-2">{book.title}</h3>
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
                <div className="mt-3">
                  <LogReading
                    bookId={book._id}
                    trigger={<Button variant="outline">Log reading</Button>}
                  />
                </div>
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
                <Bar dataKey="minutes" fill="#245c4f" radius={[4, 4, 0, 0]} />
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
