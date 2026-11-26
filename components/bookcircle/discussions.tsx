"use client";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { usePaginatedQuery } from "@/lib/supabase/hooks";
import { api } from "@/lib/supabase/api";
import { Button } from "@/components/ui/button";
import { InsightCard } from "./community";
import { QuestionCard } from "./forum";
import { Empty, Loading, PageHeading } from "./primitives";
import { launchQuickAction } from "./quick-actions";

export function DiscussionFeed({ compact = false }: { compact?: boolean }) {
  const [revision, setRevision] = useState(0);
  const [fresh, setFresh] = useState(false);
  useEffect(() => {
    const notify = () => setFresh(true);
    const own = () => setRevision((n) => n + 1);
    window.addEventListener("bookcircle:new-activity", notify);
    window.addEventListener("bookcircle:own-activity", own);
    return () => {
      window.removeEventListener("bookcircle:new-activity", notify);
      window.removeEventListener("bookcircle:own-activity", own);
    };
  }, []);
  return (
    <section className="stack" aria-label="Conversations">
      {fresh && (
        <Button
          variant="outline"
          onClick={() => {
            setRevision((n) => n + 1);
            setFresh(false);
          }}
        >
          New activity ↑
        </Button>
      )}
      <FeedItems key={revision} compact={compact} />
    </section>
  );
}
function FeedItems({ compact }: { compact: boolean }) {
  const insights = usePaginatedQuery(
    api.community.feed,
    {},
    { initialNumItems: compact ? 3 : 10 },
  );
  const questions = usePaginatedQuery(
    api.forum.list,
    { mode: "recent" },
    { initialNumItems: compact ? 3 : 10 },
  );
  if (insights.isLoading || questions.isLoading) return <Loading />;
  const items = [
    ...insights.results.map((item) => ({
      id: `post-${item.post._id}`,
      time: item.post._creationTime,
      content: <InsightCard item={item} />,
    })),
    ...questions.results.map((item) => ({
      id: `question-${item.id}`,
      time: item.createdAt,
      content: <QuestionCard q={item} />,
    })),
  ].sort((a, b) => b.time - a.time);
  if (!items.length)
    return (
      <Empty
        title="Start a conversation"
        description="Share a thought about a book or ask your club a question."
        action={
          <Button
            onClick={() =>
              launchQuickAction({ action: "question", share: true })
            }
          >
            Post to club
          </Button>
        }
      />
    );
  return (
    <>
      {(compact ? items.slice(0, 3) : items).map((item) => (
        <div key={item.id}>{item.content}</div>
      ))}
      {!compact &&
        (insights.status === "CanLoadMore" ||
          questions.status === "CanLoadMore") && (
          <Button
            variant="outline"
            onClick={() => {
              if (insights.status === "CanLoadMore") insights.loadMore(10);
              if (questions.status === "CanLoadMore") questions.loadMore(10);
            }}
          >
            Load more
          </Button>
        )}
    </>
  );
}
export function Discussions() {
  return (
    <>
      <PageHeading
        title="Discussions"
        action={
          <Button
            onClick={() =>
              launchQuickAction({ action: "question", share: true })
            }
          >
            <Plus size={18} />
            Post to club
          </Button>
        }
      />
      <DiscussionFeed />
    </>
  );
}
