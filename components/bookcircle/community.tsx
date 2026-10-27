"use client";
import { useState } from "react";
import { useMutation, usePaginatedQuery } from "@/lib/supabase/hooks";
import { api } from "@/lib/supabase/api";
import type { Id } from "@/lib/supabase/contracts";
import { MessageCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ActionForm,
  Field,
  Modal,
  value,
  PageHeading,
  Empty,
  useFeedback,
} from "./primitives";
import { BookSelect } from "./reading";
import { useMember } from "./shell";
type Insight = Awaited<ReturnType<typeof api.community.feed>>["page"][number];
export function ShareInsight({
  trigger,
  existing,
}: {
  trigger?: React.ReactNode;
  existing?: Insight;
}) {
  const [open, setOpen] = useState(false);
  const create = useMutation(api.community.create);
  const update = useMutation(api.community.update);
  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title={existing ? "Edit your insight" : "What stayed with you?"}
      description="Share an idea, a lesson, or a different way of seeing things."
      trigger={
        trigger || (
          <Button>
            <Plus />
            Share insight
          </Button>
        )
      }
    >
      <ActionForm
        onSuccess={() => setOpen(false)}
        label={existing ? "Save changes" : "Share with the circle"}
        onSubmit={(d) => {
          const args = {
            title: value(d, "title"),
            content: value(d, "content"),
            chapter: value(d, "chapter"),
            ...(value(d, "bookId")
              ? { bookId: value(d, "bookId") as Id<"books"> }
              : {}),
          };
          return existing
            ? update({ id: existing.post._id, ...args })
            : create(args);
        }}
      >
        <Field label="Give your insight a title">
          <input
            name="title"
            maxLength={200}
            required
            defaultValue={existing?.post.title}
          />
        </Field>
        <Field label="Your reflection">
          <textarea
            name="content"
            maxLength={10000}
            required
            defaultValue={existing?.post.content}
            placeholder="One idea I’m taking with me…"
          />
        </Field>
        <Field label="Related book">
          <BookSelect optional defaultValue={existing?.post.bookId} />
        </Field>
        <Field label="Chapter (optional)">
          <input
            name="chapter"
            maxLength={100}
            defaultValue={existing?.post.chapter}
          />
        </Field>
      </ActionForm>
    </Modal>
  );
}
function Comments({ id }: { id: Id<"insights"> }) {
  const { membership } = useMember();
  const rows = usePaginatedQuery(
    api.community.comments,
    { id },
    { initialNumItems: 10 },
  );
  const comment = useMutation(api.community.comment);
  const remove = useMutation(api.community.removeComment);
  const { run, feedback } = useFeedback();
  return (
    <div className="spaced">
      {rows.results.map(({ comment: c, author, isMine }) => (
        <div key={c._id} className="list-item">
          <strong className="author-name">{author.name}</strong>
          <p>{c.content}</p>
          {(isMine || membership.role !== "member") && (
            <button
              className="text-button"
              onClick={() => run(() => remove({ id: c._id }))}
            >
              Delete comment
            </button>
          )}
        </div>
      ))}
      {rows.status === "CanLoadMore" && (
        <Button variant="ghost" onClick={() => rows.loadMore(10)}>
          More comments
        </Button>
      )}
      {feedback}
      <ActionForm
        label="Add comment"
        onSubmit={(d) => comment({ id, content: value(d, "content") })}
      >
        <Field label="Join the conversation">
          <textarea name="content" required maxLength={3000} />
        </Field>
      </ActionForm>
    </div>
  );
}
export function InsightCard({ item }: { item: Insight }) {
  const [comments, setComments] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const react = useMutation(api.community.react);
  const remove = useMutation(api.community.remove);
  const { profile, membership } = useMember();
  const { run, feedback, busy } = useFeedback();
  return (
    <article className="feed-card">
      <div className="author-row">
        <span className="avatar">
          {item.author.name
            .split(" ")
            .map((s) => s[0])
            .slice(0, 2)
            .join("")}
        </span>
        <div>
          <p className="author-name">{item.author.name}</p>
          <span className="meta">
            {new Date(item.post._creationTime).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
            {item.bookTitle ? ` · ${item.bookTitle}` : ""}
          </span>
        </div>
      </div>
      <h3>{item.post.title}</h3>
      <p className="prose">{item.post.content}</p>
      {item.bookTitle && (
        <span className="tag mt-3">
          {item.bookTitle}
          {item.post.chapter ? ` · ${item.post.chapter}` : ""}
        </span>
      )}
      <div className="reaction-row">
        {(
          [
            { type: "helpful", label: "Helpful", emoji: "❤️" },
            { type: "interesting", label: "Interesting", emoji: "💡" },
            { type: "applied", label: "Applied", emoji: "🌱" },
          ] as const
        ).map((r) => (
          <button
            key={r.type}
            aria-pressed={item.myReactions.includes(r.type)}
            disabled={busy}
            onClick={() =>
              run(() => react({ id: item.post._id, type: r.type }))
            }
          >
            <span aria-hidden="true">{r.emoji}</span>
            {r.label} {item.post[r.type] || ""}
          </button>
        ))}
        <button onClick={() => setComments(!comments)}>
          <MessageCircle size={14} />
          {item.post.commentCount} comments
        </button>
      </div>
      {(item.post.authorId === profile._id || membership.role !== "member") && (
        <div className="reaction-row">
          <ShareInsight existing={item} trigger={<button>Edit</button>} />
          <button className="danger-link" onClick={() => setConfirm(true)}>
            Delete
          </button>
        </div>
      )}
      {feedback}
      {comments && <Comments id={item.post._id} />}
      <Modal
        title="Delete your insight?"
        open={confirm}
        onOpenChange={setConfirm}
        description="Your post will be removed from the community feed."
      >
        <Button
          variant="destructive"
          disabled={busy}
          onClick={() => run(() => remove({ id: item.post._id }))}
        >
          Delete insight
        </Button>
      </Modal>
    </article>
  );
}
export function CommunityPage() {
  const feed = usePaginatedQuery(
    api.community.feed,
    {},
    { initialNumItems: 10 },
  );
  return (
    <>
      <PageHeading
        eyebrow="READ SOMETHING. SHARE SOMETHING."
        title="From the circle"
        description="Ideas worth keeping. Reflections worth sharing."
        action={<ShareInsight />}
      />
      <div className="grid-main">
        <section className="panel">
          {feed.results.length ? (
            feed.results.map((item) => (
              <InsightCard key={item.post._id} item={item} />
            ))
          ) : (
            <Empty
              title="A space for your first insight"
              description="What has your reading taught you lately? Your perspective could inspire someone."
            />
          )}
          {feed.status === "CanLoadMore" && (
            <Button
              className="mt-5"
              variant="outline"
              onClick={() => feed.loadMore(10)}
            >
              Load more insights
            </Button>
          )}
        </section>
        <aside className="quote-panel">
          <p className="eyebrow">A THOUGHT TO TAKE WITH YOU</p>
          <blockquote>
            Good ideas grow when we give them room in our lives.
          </blockquote>
          <p className="meta">
            Read a little. Reflect honestly. Try one small change.
          </p>
        </aside>
      </div>
    </>
  );
}
