"use client";
import { useMutation, useQuery } from "@/lib/supabase/hooks";
import {
  forumEmojis,
  getForumReactions,
  toggleForumReaction,
  type ReactionTarget,
} from "@/lib/supabase/reactions";
import { useFeedback } from "./primitives";
export function ForumReactions({ target }: { target: ReactionTarget }) {
  const reactions = useQuery(getForumReactions, target);
  const toggle = useMutation(toggleForumReaction);
  const { run, busy, feedback } = useFeedback();
  return (
    <div>
      <div className="reaction-row" role="group" aria-label="Emoji reactions">
        {forumEmojis.map(({ emoji, label }) => {
          const reaction = reactions?.find((item) => item.emoji === emoji);
          return (
            <button
              key={emoji}
              type="button"
              title={label}
              aria-label={`${label}${reaction?.count ? `, ${reaction.count} reactions` : ""}`}
              aria-pressed={reaction?.mine ?? false}
              disabled={busy || !reactions}
              onClick={() => run(() => toggle({ ...target, emoji }))}
            >
              <span aria-hidden="true" className="text-lg">
                {emoji}
              </span>
              <span>{reaction?.count || ""}</span>
            </button>
          );
        })}
      </div>
      {feedback}
    </div>
  );
}
