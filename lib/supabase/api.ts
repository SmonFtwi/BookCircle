import { supabase } from "./client";
import type { Contracts } from "./contracts";
import { register, validateInvitation, changePassword } from "./auth";
export type Endpoint<A, R> = (args: A) => Promise<R>;
function endpoint<K extends keyof Contracts>(
  operation: K,
  query: boolean,
): Endpoint<Contracts[K]["args"], Contracts[K]["result"]> {
  return async (args) => {
    if (operation === "profiles.configuration")
      return { passwordResetEnabled: true } as Contracts[K]["result"];
    const { data, error } = await supabase.rpc(
      query ? "bookcircle_query" : "bookcircle_mutate",
      { operation, args: args ?? {} },
    );
    if (error) throw new Error(error.message);
    return (await resolveAvatars(data)) as Contracts[K]["result"];
  };
}
async function resolveAvatars(value: unknown): Promise<unknown> {
  if (Array.isArray(value)) return Promise.all(value.map(resolveAvatars));
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = { ...value };
    await Promise.all(
      Object.entries(result).map(async ([key, v]) => {
        if (
          key === "avatarUrl" &&
          typeof v === "string" &&
          !v.startsWith("https://")
        ) {
          const { data, error } = await supabase.storage
            .from("avatars")
            .createSignedUrl(v, 3600);
          result[key] = error ? null : data.signedUrl;
        } else if (typeof v === "object") result[key] = await resolveAvatars(v);
      }),
    );
    return result;
  }
  return value;
}
export const api = {
  admin: {
    overview: endpoint("admin.overview", true),
    members: endpoint("admin.members", true),
    setMemberRole: endpoint("admin.setMemberRole", false),
    setMemberStatus: endpoint("admin.setMemberStatus", false),
    invitations: endpoint("admin.invitations", true),
    generateInvitation: endpoint("admin.generateInvitation", false),
    revokeInvitation: endpoint("admin.revokeInvitation", false),
    reports: endpoint("admin.reports", true),
    resolveReport: endpoint("admin.resolveReport", false),
    saveCategory: endpoint("admin.saveCategory", false),
    setWeeklyPrompt: endpoint("admin.setWeeklyPrompt", false),
  },
  club: {
    commitments: endpoint("club.commitments", true),
    saveCommitment: endpoint("club.saveCommitment", false),
    setCommitmentStatus: endpoint("club.setCommitmentStatus", false),
    deleteCommitment: endpoint("club.deleteCommitment", false),
    challenges: endpoint("club.challenges", true),
    saveChallenge: endpoint("club.saveChallenge", false),
    joinChallenge: endpoint("club.joinChallenge", false),
    weeklyReview: endpoint("club.weeklyReview", true),
    saveWeeklyReview: endpoint("club.saveWeeklyReview", false),
    partner: endpoint("club.partner", true),
    pairMembers: endpoint("club.pairMembers", false),
    encourage: endpoint("club.encourage", false),
    votingRounds: endpoint("club.votingRounds", true),
    saveVotingRound: endpoint("club.saveVotingRound", false),
    nominate: endpoint("club.nominate", false),
    vote: endpoint("club.vote", false),
    closeVoting: endpoint("club.closeVoting", false),
    meetings: endpoint("club.meetings", true),
    saveMeeting: endpoint("club.saveMeeting", false),
    rsvp: endpoint("club.rsvp", false),
    reviewBook: endpoint("club.reviewBook", false),
    meetingAgenda: endpoint("club.meetingAgenda", true),
    deleteChallenge: endpoint("club.deleteChallenge", false),
  },
  community: {
    feed: endpoint("community.feed", true),
    create: endpoint("community.create", false),
    update: endpoint("community.update", false),
    remove: endpoint("community.remove", false),
    comments: endpoint("community.comments", true),
    comment: endpoint("community.comment", false),
    removeComment: endpoint("community.removeComment", false),
    react: endpoint("community.react", false),
  },
  forum: {
    categories: endpoint("forum.categories", true),
    list: endpoint("forum.list", true),
    search: endpoint("forum.search", true),
    detail: endpoint("forum.detail", true),
    answers: endpoint("forum.answers", true),
    ask: endpoint("forum.ask", false),
    updateQuestion: endpoint("forum.updateQuestion", false),
    removeQuestion: endpoint("forum.removeQuestion", false),
    answer: endpoint("forum.answer", false),
    updateAnswer: endpoint("forum.updateAnswer", false),
    removeAnswer: endpoint("forum.removeAnswer", false),
    vote: endpoint("forum.vote", false),
    accept: endpoint("forum.accept", false),
    moderate: endpoint("forum.moderate", false),
    report: endpoint("forum.report", false),
    moderationIdentity: endpoint("forum.moderationIdentity", true),
  },
  notifications: {
    list: endpoint("notifications.list", true),
    markRead: endpoint("notifications.markRead", false),
  },
  profiles: {
    me: endpoint("profiles.me", true),
    configuration: endpoint("profiles.configuration", true),
    update: endpoint("profiles.update", false),
    uploadUrl: async () => "/api/upload",
    setAvatar: endpoint("profiles.setAvatar", false),
    changePassword: changePassword,
    directory: endpoint("profiles.directory", true),
  },
  reading: {
    library: endpoint("reading.library", true),
    myBooks: endpoint("reading.myBooks", true),
    addBook: endpoint("reading.addBook", false),
    editBook: endpoint("reading.editBook", false),
    deleteBook: endpoint("reading.deleteBook", false),
    setBook: endpoint("reading.setBook", false),
    removeBook: endpoint("reading.removeBook", false),
    log: endpoint("reading.log", false),
    logs: endpoint("reading.logs", true),
    reflections: endpoint("reading.reflections", true),
    setGoals: endpoint("reading.setGoals", false),
    stats: endpoint("reading.stats", true),
  },
  registration: {
    register: register,
    validateInvitation: validateInvitation,
  },
};
