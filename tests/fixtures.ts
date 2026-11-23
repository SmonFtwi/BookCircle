import { expect, type Page } from "@playwright/test";

const userId = "10000000-0000-0000-0000-000000000001";
export const inviteeId = "10000000-0000-0000-0000-000000000002";
const today = new Date().toISOString().slice(0, 10);

const projectRef = new URL(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://your-project.supabase.co",
).hostname.split(".")[0];

export async function mockCircle(
  page: Page,
  role: "admin" | "moderator" | "member",
  status: "invited" | "accepted" = "accepted",
) {
  const calls: { operation: string; args: Record<string, unknown> }[] = [];
  const entries: {
    date: string;
    value: number | null;
    successful: boolean | null;
  }[] = [];
  const row = {
    challenge: {
      _id: "20000000-0000-0000-0000-000000000001",
      title: "Less screen time",
      description: "Make room for a good book.",
      category: "screen_time",
      categoryLabel: null,
      participationMode: "invite_only",
      goalType: "daily_number",
      unit: "minutes",
      dailyThreshold: 120,
      comparison: "maximum",
      target: 3,
      startDate: today,
      endDate: "2099-12-31",
    },
    joined: status === "accepted",
    participationStatus: status,
    acceptedDate: status === "accepted" ? today : null,
    progress: 0,
    completed: false,
    participants:
      status === "accepted" ? [{ profileId: userId, name: "Alex" }] : [],
    invitations: [] as { profileId: string; name: string; status: string }[],
    leaderboard: [] as {
      profileId: string;
      name: string;
      rank: number;
      progress: number;
    }[],
  };
  const book = {
    _id: "30000000-0000-0000-0000-000000000001",
    title: "The Art of Noticing",
    author: "Rob Walker",
    coverUrl: "",
    totalPages: 256,
    category: "Everyday wonder",
    description: "Small practices for a more attentive life.",
  };
  const library = [
    book,
    {
      ...book,
      _id: "30000000-0000-0000-0000-000000000002",
      title: "Atomic Habits",
      author: "James Clear",
      totalPages: 320,
      category: "Personal Growth",
    },
    {
      ...book,
      _id: "30000000-0000-0000-0000-000000000003",
      title: "Deep Work: Rules for Focused Success in a Distracted World",
      author: "Cal Newport",
      totalPages: 304,
      category: "Focus & intention",
    },
  ];
  const shelves = new Map([[book._id, "reading"]]);
  const logs: Record<string, unknown>[] = [];
  const meeting = {
    meeting: {
      _id: "40000000-0000-0000-0000-000000000001",
      title: "A Sunday of good conversation",
      startsAt: Date.now() + 86400000,
      endsAt: Date.now() + 90000000,
      location: "The reading room",
      description: "Bring one idea that stayed with you.",
    },
    rsvp: null as null | Record<string, unknown>,
    review: null,
  };
  const voting = {
    round: {
      _id: "50000000-0000-0000-0000-000000000001",
      title: "Our next shared chapter",
      status: "open",
      deadline: Date.now() + 172800000,
    },
    nominations: [
      {
        _id: "60000000-0000-0000-0000-000000000001",
        book,
        votes: null,
        percentage: null,
      },
    ],
    myVote: null as null | string,
  };
  // Browser-only fixtures: no authentication or application writes reach Supabase.
  await page.route(/https:\/\/[^/]+\.supabase\.co\//, async (route) => {
    const request = route.request();
    const url = request.url();
    if (url.includes("/rest/v1/rpc/")) {
      const { operation, args } = request.postDataJSON();
      let result: unknown = null;
      if (url.includes("bookcircle_mutate")) {
        calls.push({ operation, args });
        if (operation === "reading.setBook")
          shelves.set(args.bookId, args.status);
        if (operation === "reading.removeBook") shelves.delete(args.bookId);
        if (operation === "reading.log")
          logs.unshift({
            _id: `log-${logs.length}`,
            ...args,
            pages: args.endPage - args.startPage,
          });
        if (operation === "club.rsvp")
          meeting.rsvp = { status: args.status, question: args.question };
        if (operation === "club.vote") voting.myVote = args.nominationId;
        if (operation === "club.respondChallengeInvitation") {
          row.participationStatus = args.response;
          row.joined = args.response === "accepted";
          row.acceptedDate = row.joined ? today : null;
        }
        if (operation === "club.saveChallengeEntry") {
          const index = entries.findIndex((e) => e.date === args.date);
          const entry = {
            date: args.date,
            value: args.value ?? null,
            successful: args.successful ?? null,
          };
          if (index >= 0) entries[index] = entry;
          else entries.push(entry);
        }
        if (operation === "club.deleteChallengeEntry")
          entries.splice(
            entries.findIndex((e) => e.date === args.date),
            1,
          );
        row.progress = entries.filter(
          (e) => e.value !== null && e.value <= 120,
        ).length;
        row.leaderboard = row.progress
          ? [
              {
                profileId: userId,
                name: "Alex",
                rank: 1,
                progress: row.progress,
              },
            ]
          : [];
        if (operation === "club.inviteChallengeMembers")
          row.invitations.push({
            profileId: inviteeId,
            name: "Sam Reader",
            status: "invited",
          });
        if (operation === "club.revokeChallengeInvitation")
          row.invitations[0].status = "revoked";
        if (operation === "club.saveChallenge") result = row.challenge._id;
      } else if (operation === "profiles.me") {
        result = {
          profile: {
            _id: userId,
            name: "Alex",
            email: "alex@example.invalid",
            timezone: "UTC",
            joinedAt: Date.now(),
          },
          membership: { role },
          club: { name: "Test circle" },
        };
      } else if (operation === "club.challenges") result = [row];
      else if (operation === "club.challengeMembers")
        result = [
          { profileId: inviteeId, name: "Sam Reader" },
          { profileId: userId, name: "Alex" },
        ];
      else if (operation === "club.challengeEntries") result = entries;
      else if (operation === "notifications.list") result = [];
      else if (operation === "reading.library") result = library;
      else if (operation === "reading.myBooks")
        result = library
          .filter((b) => shelves.has(b._id))
          .map((b) => ({
            book: b,
            entry: {
              status: shelves.get(b._id),
              currentPage:
                b._id === book._id ? Number(logs[0]?.endPage ?? 42) : 0,
            },
          }));
      else if (operation === "reading.stats")
        result = {
          streak: 5 + logs.length,
          week: {
            pages: 42,
            minutes:
              75 + logs.reduce((sum, log) => sum + Number(log.minutes), 0),
            days: 3,
          },
          totals: {
            books: 2,
            days: 12,
            minutes: 420,
            pages: 216,
            sessions: logs.length,
          },
          goals: { pages: 100, minutes: 120, days: 5 },
          calendar: [{ date: today, minutes: 20, pages: 12 }],
        };
      else if (operation === "reading.logs")
        result = { page: logs, isDone: true, continueCursor: "" };
      else if (operation === "reading.reflections")
        result = logs
          .filter((log) => log.reflection)
          .map((log, index) => ({
            _id: `note-${index}`,
            bookId: log.bookId,
            date: log.date,
            body: log.reflection,
          }));
      else if (operation === "community.feed")
        result = {
          page: [
            {
              post: {
                _id: "insight-1",
                _creationTime: Date.now() - 3600000,
                title: "Look at the familiar, again",
                content:
                  "Today I took the long way home. The same street felt like a new chapter when I slowed down enough to notice.",
                chapter: "",
                commentCount: 0,
                helpful: 3,
                interesting: 2,
                applied: 1,
                authorId: inviteeId,
              },
              author: { name: "Sam Reader", avatarUrl: null },
              bookTitle: book.title,
              myReactions: [],
            },
          ],
          isDone: true,
          continueCursor: "",
        };
      else if (operation === "forum.list")
        result = {
          page: [
            {
              id: "question-1",
              title: "What helped you make reading a daily habit?",
              category: "Book talk",
              createdAt: Date.now() - 7200000,
              author: { name: "Anonymous Member", avatarUrl: null },
              answerCount: 2,
              votes: 4,
              pinned: false,
              locked: false,
            },
          ],
          isDone: true,
          continueCursor: "",
        };
      else if (operation === "club.meetings") result = [meeting];
      else if (operation === "club.votingRounds") result = [voting];
      else if (operation === "club.commitments") result = [];
      else if (
        operation === "club.partner" ||
        operation === "club.weeklyReview"
      )
        result = null;
      else if (operation === "forum.categories")
        result = [
          {
            _id: "70000000-0000-0000-0000-000000000001",
            name: "Book talk",
            active: true,
          },
          {
            _id: "70000000-0000-0000-0000-000000000002",
            name: "Putting ideas into practice",
            active: true,
          },
          {
            _id: "70000000-0000-0000-0000-000000000003",
            name: "Questions & support",
            active: true,
          },
        ];
      else if (operation === "admin.overview")
        result = {
          counts: { members: 8 },
          club: { weeklyPrompt: "What stayed with you?" },
        };
      else if (
        [
          "profiles.directory",
          "admin.members",
          "admin.invitations",
          "admin.reports",
        ].includes(operation)
      )
        result = [];
      else throw new Error(`Unexpected query: ${operation}`);
      await route.fulfill({ json: result });
    } else await route.fulfill({ json: {} });
  });
  await page.addInitScript(
    ({ userId, project }) => {
      localStorage.setItem("bookcircle:install-guide-dismissed:v1", "true");
      localStorage.setItem("bookcircle:onboarding:v1", "true");
      const encode = (obj: unknown) =>
        btoa(JSON.stringify(obj))
          .replaceAll("=", "")
          .replaceAll("+", "-")
          .replaceAll("/", "_");
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const session = {
        access_token: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: userId, exp, role: "authenticated" })}.fixture`,
        refresh_token: "fixture",
        expires_at: exp,
        expires_in: 3600,
        token_type: "bearer",
        user: {
          id: userId,
          email: "fixture@example.invalid",
          aud: "authenticated",
          role: "authenticated",
          app_metadata: {},
          user_metadata: {},
        },
      };
      document.cookie = `sb-${project}-auth-token=base64-${encode(session)}; path=/; SameSite=Lax`;
    },
    { userId, project: projectRef },
  );
  await page.goto("/club/challenges");
  await expect(
    page.getByRole("heading", { name: "Less screen time", exact: true }),
  ).toBeVisible();
  return { calls, row };
}
