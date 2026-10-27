import { supabase } from "./client";
export const forumEmojis = [
  { emoji: "👍", label: "Helpful" },
  { emoji: "❤️", label: "Love" },
  { emoji: "😂", label: "Funny" },
  { emoji: "💡", label: "Insightful" },
  { emoji: "👏", label: "Applause" },
  { emoji: "🤔", label: "Thought-provoking" },
] as const;
export type ForumEmoji = (typeof forumEmojis)[number]["emoji"];
export type ReactionTarget =
  | { questionId: string; answerId?: never }
  | { questionId?: never; answerId: string };
export type ReactionSummary = {
  emoji: ForumEmoji;
  count: number;
  mine: boolean;
};
export async function getForumReactions(
  target: ReactionTarget,
): Promise<ReactionSummary[]> {
  const { data, error } = await supabase.rpc("forum_reactions", {
    question_id: target.questionId ?? null,
    answer_id: target.answerId ?? null,
  });
  if (error) throw new Error(error.message);
  return data;
}
export async function toggleForumReaction(
  args: ReactionTarget & { emoji: ForumEmoji },
) {
  const { error } = await supabase.rpc("toggle_forum_reaction", {
    emoji: args.emoji,
    question_id: args.questionId ?? null,
    answer_id: args.answerId ?? null,
  });
  if (error) throw new Error(error.message);
}
