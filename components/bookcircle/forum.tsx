"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, usePaginatedQuery } from "@/lib/supabase/hooks";
import { api } from "@/lib/supabase/api";
import type { Id } from "@/lib/supabase/contracts";
import {
  MessageCircle,
  ArrowUp,
  Plus,
  Pin,
  LockKeyhole,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ActionForm,
  Field,
  Modal,
  value,
  PageHeading,
  Loading,
  Empty,
  useFeedback,
} from "./primitives";
import { BookSelect } from "./reading";
import { useMember } from "./shell";
export function AskQuestion({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const categories = useQuery(api.forum.categories);
  const ask = useMutation(api.forum.ask);
  return (
    <Modal
      title="Every good conversation starts here."
      description="Ask the circle a question. There’s room for every perspective."
      open={open}
      onOpenChange={setOpen}
      trigger={
        trigger || (
          <Button>
            <Plus />
            Ask a question
          </Button>
        )
      }
    >
      <ActionForm
        label="Post question"
        onSuccess={() => setOpen(false)}
        onSubmit={(d) =>
          ask({
            title: value(d, "title"),
            content: value(d, "content"),
            categoryId: value(d, "categoryId") as Id<"forumCategories">,
            anonymous: d.get("anonymous") === "on",
            ...(value(d, "bookId")
              ? { bookId: value(d, "bookId") as Id<"books"> }
              : {}),
          })
        }
      >
        <Field label="Your question">
          <input
            name="title"
            maxLength={200}
            required
            placeholder="What are you wondering about?"
          />
        </Field>
        <Field label="A little context">
          <textarea name="content" maxLength={10000} required />
        </Field>
        <Field label="Category">
          <select name="categoryId" required>
            <option value="">Choose a category</option>
            {categories
              ?.filter((c) => c.active)
              .map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Related book (optional)">
          <BookSelect optional />
        </Field>
        <label className="check-field">
          <input name="anonymous" type="checkbox" />
          Post as Anonymous Member
        </label>
        <p className="meta">
          Anonymous posts hide your identity from other members. Administrators
          can identify authors for moderation.
        </p>
      </ActionForm>
    </Modal>
  );
}
type Question = NonNullable<Awaited<ReturnType<typeof api.forum.detail>>>;
function QuestionCard({ q }: { q: Question }) {
  return (
    <article className="list-item">
      <div className="row">
        <span className="badge">{q.votes} ↑</span>
        <div className="flex-1 min-w-0">
          <div className="pill-row mb-2">
            <span className="tag">{q.category}</span>
            {q.pinned && (
              <span className="badge">
                <Pin size={11} className="inline" /> Pinned
              </span>
            )}
            {q.locked && <LockKeyhole size={14} />}
          </div>
          <Link href={`/forum/${q.id}`}>
            <h3>{q.title}</h3>
          </Link>
          <p className="meta mt-2">
            {q.author.name} · {q.answerCount} answers ·{" "}
            {new Date(q.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>
    </article>
  );
}
export function ForumPage() {
  const [mode, setMode] = useState<
    "recent" | "trending" | "unanswered" | "mine"
  >("recent");
  const [categoryId, setCategory] = useState<
    Id<"forumCategories"> | undefined
  >();
  const [search, setSearch] = useState("");
  const categories = useQuery(api.forum.categories);
  const list = usePaginatedQuery(
    api.forum.list,
    { mode, ...(categoryId ? { categoryId } : {}) },
    { initialNumItems: 15 },
  );
  const found = useQuery(
    api.forum.search,
    search.trim() ? { text: search } : "skip",
  );
  const questions = search.trim() ? found : list.results;
  return (
    <>
      <PageHeading
        eyebrow="LET’S TALK ABOUT IT"
        title="Conversations that matter"
        description="Ask freely. Listen closely. Grow together."
        action={<AskQuestion />}
      />
      <div className="grid-main">
        <section className="panel">
          <input
            aria-label="Search questions"
            placeholder="Search the conversations…"
            className="search-input mb-5"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="tabs-row">
            {(
              [
                ["recent", "Recent"],
                ["trending", "Trending"],
                ["unanswered", "Unanswered"],
                ["mine", "My questions"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => {
                  setMode(id);
                  setCategory(undefined);
                }}
                className={mode === id ? "active" : ""}
              >
                {label}
              </button>
            ))}
          </div>
          {questions === undefined ? (
            <Loading />
          ) : questions.length ? (
            questions.map((q) => <QuestionCard key={q.id} q={q} />)
          ) : (
            <Empty
              title="Start a meaningful conversation"
              description="Questions open doors. Share one that has been on your mind."
            />
          )}
          {!search && list.status === "CanLoadMore" && (
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => list.loadMore(15)}
            >
              Load more questions
            </Button>
          )}
        </section>
        <aside className="stack">
          <section className="panel">
            <h2 className="mb-4">Explore topics</h2>
            <div className="side-nav">
              <button
                className={`nav-item ${!categoryId ? "active" : ""}`}
                onClick={() => setCategory(undefined)}
              >
                All conversations
              </button>
              {categories
                ?.filter((c) => c.active)
                .map((c) => (
                  <button
                    key={c._id}
                    className={`nav-item ${categoryId === c._id ? "active" : ""}`}
                    onClick={() => {
                      setCategory(c._id);
                      setMode("recent");
                    }}
                  >
                    {c.name}
                  </button>
                ))}
            </div>
          </section>
          <section className="quote-panel">
            <MessageCircle size={25} />
            <h3 className="mt-3">A thoughtful space</h3>
            <p className="meta mt-2">
              Be curious, be kind, and leave room for a different point of view.
              Anonymous participation is always welcome.
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}
function AnswerForm({
  questionId,
  parentId,
  onSuccess,
}: {
  questionId: Id<"forumQuestions">;
  parentId?: Id<"forumAnswers">;
  onSuccess?: () => void;
}) {
  const answer = useMutation(api.forum.answer);
  return (
    <ActionForm
      label={parentId ? "Post reply" : "Share your answer"}
      onSuccess={onSuccess}
      onSubmit={(d) =>
        answer({
          questionId,
          ...(parentId ? { parentId } : {}),
          content: value(d, "content"),
          anonymous: d.get("anonymous") === "on",
        })
      }
    >
      <Field label={parentId ? "Your reply" : "Add your perspective"}>
        <textarea name="content" required maxLength={10000} />
      </Field>
      <label className="check-field">
        <input name="anonymous" type="checkbox" />
        Answer anonymously
      </label>
      <p className="meta">
        Administrators may identify anonymous authors for moderation.
      </p>
    </ActionForm>
  );
}
export function QuestionPage({ id }: { id: string }) {
  const router = useRouter();
  const q = useQuery(api.forum.detail, { questionId: id });
  const answers = usePaginatedQuery(
    api.forum.answers,
    { questionId: id },
    { initialNumItems: 30 },
  );
  const vote = useMutation(api.forum.vote);
  const accept = useMutation(api.forum.accept);
  const moderate = useMutation(api.forum.moderate);
  const remove = useMutation(api.forum.removeQuestion);
  const removeAnswer = useMutation(api.forum.removeAnswer);
  const updateQuestion = useMutation(api.forum.updateQuestion);
  const updateAnswer = useMutation(api.forum.updateAnswer);
  const report = useMutation(api.forum.report);
  const [reply, setReply] = useState<string | null>(null);
  const { membership } = useMember();
  const { run, feedback, busy } = useFeedback();
  if (!q) return <Loading />;
  return (
    <>
      <Link href="/forum" className="section-link mb-5">
        ← All conversations
      </Link>
      <article className="panel">
        <div className="pill-row mb-4">
          <span className="tag">{q.category}</span>
          {q.locked && <span className="badge">Discussion locked</span>}
          {q.pinned && <span className="badge">Pinned</span>}
        </div>
        <h1>{q.title}</h1>
        <p className="meta mt-3 mb-6">
          {q.author.name} · {new Date(q.createdAt).toLocaleDateString()}
          {q.bookTitle ? ` · ${q.bookTitle}` : ""}
        </p>
        <p className="prose">{q.content}</p>
        <div className="reaction-row">
          <button
            disabled={q.isMine || busy}
            aria-pressed={q.myVote}
            onClick={() => run(() => vote({ questionId: id }))}
          >
            <ArrowUp size={16} /> {q.votes} upvotes
          </button>
          <span className="meta">{q.answerCount} answers</span>
          <Modal title="Report this question" trigger={<button>Report</button>}>
            <ActionForm
              label="Send report"
              onSubmit={(d) =>
                report({ questionId: id, reason: value(d, "reason") })
              }
            >
              <Field label="What should moderators know?">
                <textarea name="reason" required maxLength={1000} />
              </Field>
            </ActionForm>
          </Modal>
          {q.isMine && (
            <Modal title="Edit question" trigger={<button>Edit</button>}>
              <ActionForm
                onSubmit={(d) =>
                  updateQuestion({
                    id,
                    title: value(d, "title"),
                    content: value(d, "content"),
                  })
                }
              >
                <Field label="Question">
                  <input name="title" required defaultValue={q.title} />
                </Field>
                <Field label="Description">
                  <textarea name="content" required defaultValue={q.content} />
                </Field>
              </ActionForm>
            </Modal>
          )}
          {(q.isMine || membership.role === "admin") && (
            <Modal
              title="Remove this question?"
              trigger={<button className="danger-link">Remove</button>}
            >
              <Button
                variant="destructive"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await remove({ id });
                    router.push("/forum");
                  })
                }
              >
                Remove question
              </Button>
            </Modal>
          )}
        </div>
        {membership.role === "admin" && (
          <div className="pill-row mt-4">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                run(() =>
                  moderate({
                    questionId: id,
                    pinned: !q.pinned,
                    locked: q.locked,
                  }),
                )
              }
            >
              {q.pinned ? "Unpin" : "Pin"}
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                run(() =>
                  moderate({
                    questionId: id,
                    pinned: q.pinned,
                    locked: !q.locked,
                  }),
                )
              }
            >
              {q.locked ? "Unlock" : "Lock"}
            </Button>
          </div>
        )}
        {feedback}
      </article>
      <section className="panel spaced">
        <h2>{q.answerCount} perspectives</h2>
        {answers.results.map((a) => (
          <article
            key={a.id}
            className={`${a.parentId ? "reply" : "answer"} ${a.accepted ? "accepted" : ""}`}
          >
            <div className="row between">
              <strong className="author-name">{a.author.name}</strong>
              {a.accepted && (
                <span className="tag">
                  <CheckCircle size={12} className="inline mr-1" />
                  Accepted answer
                </span>
              )}
            </div>
            <p className="prose mt-3">{a.content}</p>
            {!a.removed && (
              <div className="reaction-row">
                <button
                  disabled={a.isMine || busy}
                  aria-pressed={a.myVote}
                  onClick={() => run(() => vote({ answerId: a.id }))}
                >
                  <ArrowUp size={14} />
                  {a.votes}
                </button>
                {!a.parentId && !q.locked && (
                  <button
                    onClick={() => setReply(reply === a.id ? null : a.id)}
                  >
                    Reply
                  </button>
                )}
                {q.isMine && !a.parentId && (
                  <button
                    onClick={() =>
                      run(() => accept({ questionId: id, answerId: a.id }))
                    }
                  >
                    {a.accepted ? "Unmark accepted" : "Accept answer"}
                  </button>
                )}
                {a.isMine && (
                  <Modal title="Edit answer" trigger={<button>Edit</button>}>
                    <ActionForm
                      onSubmit={(d) =>
                        updateAnswer({ id: a.id, content: value(d, "content") })
                      }
                    >
                      <Field label="Your answer">
                        <textarea
                          name="content"
                          required
                          defaultValue={a.content}
                        />
                      </Field>
                    </ActionForm>
                  </Modal>
                )}
                {(a.isMine || membership.role === "admin") && (
                  <button
                    className="danger-link"
                    onClick={() => run(() => removeAnswer({ id: a.id }))}
                  >
                    Remove
                  </button>
                )}
                <Modal title="Report answer" trigger={<button>Report</button>}>
                  <ActionForm
                    onSubmit={(d) =>
                      report({
                        questionId: id,
                        answerId: a.id,
                        reason: value(d, "reason"),
                      })
                    }
                    label="Send report"
                  >
                    <Field label="Reason">
                      <textarea name="reason" required maxLength={1000} />
                    </Field>
                  </ActionForm>
                </Modal>
              </div>
            )}
            {reply === a.id && (
              <AnswerForm
                questionId={id}
                parentId={a.id}
                onSuccess={() => setReply(null)}
              />
            )}
          </article>
        ))}
        {answers.status === "CanLoadMore" && (
          <Button variant="outline" onClick={() => answers.loadMore(30)}>
            Load more answers
          </Button>
        )}
        {!q.locked && (
          <div className="spaced">
            <AnswerForm questionId={id} />
          </div>
        )}
      </section>
    </>
  );
}
