"use client";
import { launchQuickAction } from "./quick-actions";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, usePaginatedQuery } from "@/lib/supabase/hooks";
import { api } from "@/lib/supabase/api";
import type { Id } from "@/lib/supabase/contracts";
import { ArrowUp, Plus, Pin, LockKeyhole, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ActionForm,
  Field,
  Modal,
  value,
  Loading,
  useFeedback,
} from "./primitives";
import { useMember } from "./shell";
export function AskQuestion({ trigger }: { trigger?: React.ReactNode }) {
  return trigger ? (
    <span onClick={() => launchQuickAction({ action: "question" })}>
      {trigger}
    </span>
  ) : (
    <Button onClick={() => launchQuickAction({ action: "question" })}>
      <Plus />
      Ask a question
    </Button>
  );
}
type Question = NonNullable<Awaited<ReturnType<typeof api.forum.detail>>>;
export function QuestionCard({ q }: { q: Question }) {
  return (
    <article className="discussion-card">
      <div className="row between">
        <span className="tag">{q.category}</span>
        <div className="pill-row">
          {q.pinned && (
            <span className="meta">
              <Pin size={14} aria-hidden="true" /> Pinned
            </span>
          )}
          {q.locked && (
            <span className="meta">
              <LockKeyhole size={14} aria-hidden="true" /> Closed
            </span>
          )}
        </div>
      </div>
      <Link className="discussion-title" href={`/forum/${q.id}`}>
        <h3>{q.title}</h3>
      </Link>
      <div className="discussion-card-footer">
        <div className="discussion-author">
          <span className="avatar" aria-hidden="true">
            {q.author.name.slice(0, 1)}
          </span>
          <div>
            <strong>{q.author.name}</strong>
            <p>
              {new Date(q.createdAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </p>
          </div>
        </div>
        <span className="discussion-counts">
          <span>
            {q.answerCount} {q.answerCount === 1 ? "reply" : "replies"}
          </span>
          <span>{q.votes} ↑</span>
        </span>
      </div>
    </article>
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
        Administrators and moderators may identify anonymous authors for
        moderation.
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
          {(q.isMine || membership.role !== "member") && (
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
          {(q.isMine || membership.role !== "member") && (
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
        {membership.role !== "member" && (
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
                {(a.isMine || membership.role !== "member") && (
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
                {(a.isMine || membership.role !== "member") && (
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
