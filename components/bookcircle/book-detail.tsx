"use client";
import Link from "next/link";
import { useQuery, useMutation } from "@/lib/supabase/hooks";
import { api } from "@/lib/supabase/api";
import type { Id } from "@/lib/supabase/contracts";
import {
  Cover,
  Empty,
  Field,
  Loading,
  PageHeading,
  useFeedback,
} from "./primitives";
import { ProgressRing } from "./signature";
import { useMember } from "./shell";
import { EditBook } from "./reading";
export function BookDetail({ id }: { id: string }) {
  const library = useQuery(api.reading.library);
  const mine = useQuery(api.reading.myBooks);
  const set = useMutation(api.reading.setBook);
  const { membership } = useMember();
  const { run, busy, feedback } = useFeedback();
  if (!library || !mine) return <Loading />;
  const book = library.find((b) => b._id === id);
  if (!book)
    return (
      <Empty
        title="This book is no longer on the shelf"
        description="There are more stories waiting in your club library."
        action={
          <Link className="section-link" href="/library">
            Explore library
          </Link>
        }
      />
    );
  const entry = mine.find((b) => b.book._id === id)?.entry;
  return (
    <>
      <Link className="section-link mb-4" href="/library">
        ← Library
      </Link>
      <PageHeading title={book.title} description={book.author} />
      <section className="panel stack">
        <div className="row between">
          <Cover
            title={book.title}
            author={book.author}
            coverUrl={book.coverUrl}
          />
          <ProgressRing
            value={((entry?.currentPage ?? 0) / book.totalPages) * 100}
            label={`Your progress in ${book.title}`}
          />
        </div>
        <span className="tag">{book.category}</span>
        <p className="prose">
          {book.description || "A new perspective, waiting between the covers."}
        </p>
        <p className="meta">
          {book.totalPages} pages · Your place: page {entry?.currentPage ?? 0}
        </p>
        {feedback}
        <Field label="Reading status">
          <select
            disabled={busy}
            value={entry?.status ?? ""}
            onChange={(e) =>
              run(() =>
                set({
                  bookId: id as Id<"books">,
                  status: e.target.value as
                    | "want"
                    | "reading"
                    | "completed"
                    | "paused",
                }),
              )
            }
          >
            <option disabled value="">
              Add to your shelves
            </option>
            <option value="want">Want to read</option>
            <option value="reading">Currently reading</option>
            <option value="completed">Completed</option>
            <option value="paused">Paused</option>
          </select>
        </Field>
        {membership.role !== "member" && <EditBook book={book} />}
      </section>
    </>
  );
}
