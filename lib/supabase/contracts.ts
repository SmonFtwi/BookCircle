// Typed application contracts, independent of the previous backend.
export type Id<T extends string = string> = string & { readonly __table?: T };
export type ChallengeCategory =
  | "reading"
  | "fitness"
  | "diet"
  | "screen_time"
  | "other";
export type ChallengeGoal =
  | "minutes"
  | "days"
  | "insights"
  | "commitments"
  | "total"
  | "daily_number"
  | "daily_checkin";
export type ChallengeParticipation =
  | "invited"
  | "accepted"
  | "declined"
  | "revoked";
export interface ChallengeConfiguration {
  category: ChallengeCategory;
  categoryLabel: string | null;
  participationMode: "open" | "invite_only";
  unit: string | null;
  dailyThreshold: number | null;
  comparison: "minimum" | "maximum" | null;
}
type Cursor = string;
export interface PaginationResult<T> {
  page: T[];
  isDone: boolean;
  continueCursor: string;
}
export interface Contracts {
  "admin.setMemberRole": {
    args: { id: Id<"memberships">; role: "admin" | "moderator" | "member" };
    result: null;
  };
  "admin.overview": {
    args: Record<string, never>;
    result: {
      club: {
        _id: Id<"clubs">;
        _creationTime: number;
        weeklyPrompt?: string | undefined;
        name: string;
        description: string;
        createdAt: number;
      };
      counts: {
        _id: Id<"counters">;
        _creationTime: number;
        members: number;
        clubId: Id<"clubs">;
        sessions: number;
        insights: number;
        questions: number;
      } | null;
    };
  };
  "admin.members": {
    args: Record<string, never>;
    result: {
      membership: {
        _id: Id<"memberships">;
        _creationTime: number;
        role: "admin" | "moderator" | "member";
        clubId: Id<"clubs">;
        profileId: Id<"profiles">;
        status: "active" | "inactive";
      };
      name: string;
      email: string;
      lastActiveAt: number;
    }[];
  };
  "admin.setMemberStatus": {
    args: { id: Id<"memberships">; status: "active" | "inactive" };
    result: null;
  };
  "admin.invitations": {
    args: Record<string, never>;
    result: {
      _id: Id<"invitations">;
      createdAt: number;
      expiresAt: number;
      maxUses: number;
      uses: number;
      revoked: boolean;
    }[];
  };
  "admin.generateInvitation": {
    args: { maxUses: number; expiresInDays: number };
    result: { id: Id<"invitations">; code: string };
  };
  "admin.revokeInvitation": { args: { id: Id<"invitations"> }; result: null };
  "admin.reports": {
    args: Record<string, never>;
    result: {
      _id: Id<"forumReports">;
      _creationTime: number;
      answerId?: Id<"forumAnswers"> | undefined;
      clubId: Id<"clubs">;
      questionId: Id<"forumQuestions">;
      reporterId: Id<"profiles">;
      reason: string;
      resolved: boolean;
    }[];
  };
  "admin.resolveReport": { args: { id: Id<"forumReports"> }; result: null };
  "admin.saveCategory": {
    args: {
      id?: Id<"forumCategories"> | undefined;
      name: string;
      active: boolean;
    };
    result: Id<"forumCategories">;
  };
  "admin.setWeeklyPrompt": { args: { prompt: string }; result: null };
  "club.commitments": {
    args: Record<string, never>;
    result: {
      _id: Id<"commitments">;
      _creationTime: number;
      bookId?: Id<"books"> | undefined;
      completedAt?: number | undefined;
      description: string;
      clubId: Id<"clubs">;
      profileId: Id<"profiles">;
      status: "completed" | "pending" | "not_completed";
      title: string;
      targetDate: string;
      outcome: string;
      shared: boolean;
    }[];
  };
  "club.saveCommitment": {
    args: {
      id?: Id<"commitments"> | undefined;
      bookId?: Id<"books"> | undefined;
      description: string;
      title: string;
      targetDate: string;
      shared: boolean;
    };
    result: Id<"commitments">;
  };
  "club.setCommitmentStatus": {
    args: {
      id: Id<"commitments">;
      status: "completed" | "pending" | "not_completed";
      outcome: string;
    };
    result: null;
  };
  "club.deleteCommitment": { args: { id: Id<"commitments"> }; result: null };
  "club.challenges": {
    args: Record<string, never>;
    result: {
      challenge: ChallengeConfiguration & {
        _id: Id<"challenges">;
        _creationTime: number;
        description: string;
        clubId: Id<"clubs">;
        createdBy: Id<"profiles">;
        title: string;
        goalType: ChallengeGoal;
        startDate: string;
        endDate: string;
        target: number;
      };
      joined: boolean;
      participationStatus: ChallengeParticipation | null;
      acceptedDate: string | null;
      invitations: {
        profileId: Id<"profiles">;
        name: string;
        status: ChallengeParticipation;
      }[];
      progress: number;
      completed: boolean;
      participants: { profileId: Id<"profiles">; name: string }[];
      leaderboard: {
        profileId: Id<"profiles">;
        name: string;
        rank: number;
        progress: number;
      }[];
    }[];
  };
  "club.saveChallenge": {
    args: {
      id?: Id<"challenges">;
      description: string;
      title: string;
      goalType?: ChallengeGoal;
      startDate?: string;
      endDate?: string;
      target?: number;
      memberIds?: Id<"profiles">[];
    } & Partial<ChallengeConfiguration>;
    result: Id<"challenges">;
  };
  "club.challengeMembers": {
    args: Record<string, never>;
    result: { profileId: Id<"profiles">; name: string }[];
  };
  "club.inviteChallengeMembers": {
    args: { id: Id<"challenges">; memberIds: Id<"profiles">[] };
    result: null;
  };
  "club.revokeChallengeInvitation": {
    args: { id: Id<"challenges">; profileId: Id<"profiles"> };
    result: null;
  };
  "club.respondChallengeInvitation": {
    args: { id: Id<"challenges">; response: "accepted" | "declined" };
    result: null;
  };
  "club.challengeEntries": {
    args: { id: Id<"challenges"> };
    result: {
      date: string;
      value: number | null;
      successful: boolean | null;
    }[];
  };
  "club.saveChallengeEntry": {
    args: {
      id: Id<"challenges">;
      date: string;
      value?: number;
      successful?: boolean;
    };
    result: null;
  };
  "club.deleteChallengeEntry": {
    args: { id: Id<"challenges">; date: string };
    result: null;
  };
  "club.joinChallenge": { args: { id: Id<"challenges"> }; result: null };
  "club.weeklyReview": {
    args: { week: string };
    result: {
      _id: Id<"weeklyReviews">;
      _creationTime: number;
      profileId: Id<"profiles">;
      week: string;
      achieved: boolean;
      lesson: string;
      improvement: string;
    } | null;
  };
  "club.saveWeeklyReview": {
    args: {
      week: string;
      achieved: boolean;
      lesson: string;
      improvement: string;
    };
    result: null;
  };
  "club.partner": {
    args: Record<string, never>;
    result: {
      totals: {
        _id: Id<"readingTotals">;
        _creationTime: number;
        profileId: Id<"profiles">;
        books: number;
        pages: number;
        minutes: number;
        sessions: number;
        days: number;
      } | null;
      commitments: {
        _id: Id<"commitments">;
        _creationTime: number;
        bookId?: Id<"books"> | undefined;
        completedAt?: number | undefined;
        description: string;
        clubId: Id<"clubs">;
        profileId: Id<"profiles">;
        status: "completed" | "pending" | "not_completed";
        title: string;
        targetDate: string;
        outcome: string;
        shared: boolean;
      }[];
      readingLogs: {
        _id: Id<"readingLogs">;
        _creationTime: number;
        clubId: Id<"clubs">;
        profileId: Id<"profiles">;
        bookId: Id<"books">;
        date: string;
        startPage: number;
        endPage: number;
        pages: number;
        minutes: number;
        notes: string;
      }[];
      encouragements: {
        _id: Id<"encouragements">;
        _creationTime: number;
        senderId: Id<"profiles">;
        recipientId: Id<"profiles">;
        message: string;
      }[];
      name: string;
      avatarUrl: string | null;
      profileId: Id<"profiles">;
    } | null;
  };
  "club.pairMembers": {
    args: { firstId: Id<"profiles">; secondId: Id<"profiles"> };
    result: null;
  };
  "club.encourage": { args: { message: string }; result: null };
  "club.votingRounds": {
    args: { now: number };
    result: {
      round: {
        _id: Id<"votingRounds">;
        _creationTime: number;
        winnerId?: Id<"books"> | undefined;
        clubId: Id<"clubs">;
        status: "open" | "closed";
        title: string;
        deadline: number;
      };
      myVote: Id<"bookNominations"> | null;
      nominations: {
        _id: Id<"bookNominations">;
        book: {
          _id: Id<"books">;
          _creationTime: number;
          description: string;
          clubId: Id<"clubs">;
          title: string;
          author: string;
          coverUrl: string;
          totalPages: number;
          category: string;
        };
        votes: number | null;
        percentage: number | null;
      }[];
    }[];
  };
  "club.saveVotingRound": {
    args: {
      id?: Id<"votingRounds"> | undefined;
      title: string;
      deadline: number;
    };
    result: Id<"votingRounds">;
  };
  "club.nominate": {
    args: { bookId: Id<"books">; roundId: Id<"votingRounds"> };
    result: null;
  };
  "club.vote": { args: { nominationId: Id<"bookNominations"> }; result: null };
  "club.closeVoting": { args: { id: Id<"votingRounds"> }; result: null };
  "club.meetings": {
    args: Record<string, never>;
    result: {
      meeting: {
        _id: Id<"meetings">;
        _creationTime: number;
        bookId?: Id<"books"> | undefined;
        description: string;
        clubId: Id<"clubs">;
        title: string;
        startsAt: number;
        endsAt: number;
        location: string;
      };
      rsvp: {
        _id: Id<"meetingRSVPs">;
        _creationTime: number;
        profileId: Id<"profiles">;
        status: "going" | "maybe" | "declined";
        meetingId: Id<"meetings">;
        question: string;
      } | null;
      review: {
        _id: Id<"bookReviews">;
        _creationTime: number;
        profileId: Id<"profiles">;
        bookId: Id<"books">;
        applied: string;
        improvement: string;
        meetingId: Id<"meetings">;
        lessons: string[];
        changed: string;
      } | null;
    }[];
  };
  "club.saveMeeting": {
    args: {
      id?: Id<"meetings"> | undefined;
      bookId?: Id<"books"> | undefined;
      description: string;
      title: string;
      startsAt: number;
      endsAt: number;
      location: string;
    };
    result: Id<"meetings">;
  };
  "club.rsvp": {
    args: {
      status: "going" | "maybe" | "declined";
      meetingId: Id<"meetings">;
      question: string;
    };
    result: null;
  };
  "club.reviewBook": {
    args: {
      applied: string;
      improvement: string;
      meetingId: Id<"meetings">;
      lessons: string[];
      changed: string;
    };
    result: null;
  };
  "club.meetingAgenda": {
    args: { meetingId: Id<"meetings"> };
    result: {
      meeting: {
        _id: Id<"meetings">;
        _creationTime: number;
        bookId?: Id<"books"> | undefined;
        description: string;
        clubId: Id<"clubs">;
        title: string;
        startsAt: number;
        endsAt: number;
        location: string;
      };
      rsvps: {
        _id: Id<"meetingRSVPs">;
        _creationTime: number;
        profileId: Id<"profiles">;
        status: "going" | "maybe" | "declined";
        meetingId: Id<"meetings">;
        question: string;
      }[];
      reviews: {
        _id: Id<"bookReviews">;
        _creationTime: number;
        profileId: Id<"profiles">;
        bookId: Id<"books">;
        applied: string;
        improvement: string;
        meetingId: Id<"meetings">;
        lessons: string[];
        changed: string;
      }[];
    };
  };
  "club.deleteChallenge": { args: { id: Id<"challenges"> }; result: null };
  "community.feed": {
    args: {
      paginationOpts: {
        id?: number;
        endCursor?: string | null;
        maximumRowsRead?: number;
        maximumBytesRead?: number;
        numItems: number;
        cursor: string | null;
      };
    };
    result: {
      page: {
        post: {
          _id: Id<"insights">;
          _creationTime: number;
          bookId?: Id<"books"> | undefined;
          clubId: Id<"clubs">;
          title: string;
          authorId: Id<"profiles">;
          content: string;
          chapter: string;
          commentCount: number;
          helpful: number;
          interesting: number;
          applied: number;
        };
        author: { name: string; avatarUrl: string | null };
        bookTitle: string | null;
        myReactions: ("helpful" | "interesting" | "applied")[];
      }[];
      isDone: boolean;
      continueCursor: Cursor;
      splitCursor?: Cursor | null;
      pageStatus?: "SplitRecommended" | "SplitRequired" | null;
    };
  };
  "community.create": {
    args: {
      bookId?: Id<"books"> | undefined;
      title: string;
      content: string;
      chapter: string;
    };
    result: Id<"insights">;
  };
  "community.update": {
    args: {
      bookId?: Id<"books"> | undefined;
      id: Id<"insights">;
      title: string;
      content: string;
      chapter: string;
    };
    result: null;
  };
  "community.remove": { args: { id: Id<"insights"> }; result: null };
  "community.comments": {
    args: {
      id: Id<"insights">;
      paginationOpts: {
        id?: number;
        endCursor?: string | null;
        maximumRowsRead?: number;
        maximumBytesRead?: number;
        numItems: number;
        cursor: string | null;
      };
    };
    result: {
      page: {
        comment: {
          _id: Id<"insightComments">;
          _creationTime: number;
          authorId: Id<"profiles">;
          content: string;
          insightId: Id<"insights">;
        };
        author: { name: string; avatarUrl: string | null };
        isMine: boolean;
      }[];
      isDone: boolean;
      continueCursor: Cursor;
      splitCursor?: Cursor | null;
      pageStatus?: "SplitRecommended" | "SplitRequired" | null;
    };
  };
  "community.comment": {
    args: { id: Id<"insights">; content: string };
    result: Id<"insightComments">;
  };
  "community.removeComment": {
    args: { id: Id<"insightComments"> };
    result: null;
  };
  "community.react": {
    args: { type: "helpful" | "interesting" | "applied"; id: Id<"insights"> };
    result: null;
  };
  "forum.categories": {
    args: Record<string, never>;
    result: {
      _id: Id<"forumCategories">;
      _creationTime: number;
      name: string;
      clubId: Id<"clubs">;
      active: boolean;
    }[];
  };
  "forum.list": {
    args: {
      categoryId?: Id<"forumCategories"> | undefined;
      mode?: "recent" | "trending" | "unanswered" | "mine" | undefined;
      paginationOpts: {
        id?: number;
        endCursor?: string | null;
        maximumRowsRead?: number;
        maximumBytesRead?: number;
        numItems: number;
        cursor: string | null;
      };
    };
    result: {
      page: {
        id: Id<"forumQuestions">;
        createdAt: number;
        title: string;
        content: string;
        categoryId: Id<"forumCategories">;
        category: string;
        bookTitle: string | null;
        anonymous: boolean;
        author: { name: string; avatarUrl: string | null };
        isMine: boolean;
        pinned: boolean;
        locked: boolean;
        votes: number;
        answerCount: number;
        acceptedAnswerId: Id<"forumAnswers"> | null;
        myVote: boolean;
      }[];
      isDone: boolean;
      continueCursor: Cursor;
      splitCursor?: Cursor | null;
      pageStatus?: "SplitRecommended" | "SplitRequired" | null;
    };
  };
  "forum.search": {
    args: { text: string };
    result: {
      id: Id<"forumQuestions">;
      createdAt: number;
      title: string;
      content: string;
      categoryId: Id<"forumCategories">;
      category: string;
      bookTitle: string | null;
      anonymous: boolean;
      author: { name: string; avatarUrl: string | null };
      isMine: boolean;
      pinned: boolean;
      locked: boolean;
      votes: number;
      answerCount: number;
      acceptedAnswerId: Id<"forumAnswers"> | null;
      myVote: boolean;
    }[];
  };
  "forum.detail": {
    args: { questionId: Id<"forumQuestions"> };
    result: {
      id: Id<"forumQuestions">;
      createdAt: number;
      title: string;
      content: string;
      categoryId: Id<"forumCategories">;
      category: string;
      bookTitle: string | null;
      anonymous: boolean;
      author: { name: string; avatarUrl: string | null };
      isMine: boolean;
      pinned: boolean;
      locked: boolean;
      votes: number;
      answerCount: number;
      acceptedAnswerId: Id<"forumAnswers"> | null;
      myVote: boolean;
    };
  };
  "forum.answers": {
    args: {
      questionId: Id<"forumQuestions">;
      paginationOpts: {
        id?: number;
        endCursor?: string | null;
        maximumRowsRead?: number;
        maximumBytesRead?: number;
        numItems: number;
        cursor: string | null;
      };
    };
    result: {
      page: {
        id: Id<"forumAnswers">;
        createdAt: number;
        questionId: Id<"forumQuestions">;
        parentId: Id<"forumAnswers"> | null;
        content: string;
        anonymous: boolean;
        author: { name: string; avatarUrl: string | null };
        isMine: boolean;
        votes: number;
        myVote: boolean;
        accepted: boolean;
        removed: boolean;
      }[];
      isDone: boolean;
      continueCursor: Cursor;
      splitCursor?: Cursor | null;
      pageStatus?: "SplitRecommended" | "SplitRequired" | null;
    };
  };
  "forum.ask": {
    args: {
      bookId?: Id<"books"> | undefined;
      title: string;
      content: string;
      categoryId: Id<"forumCategories">;
      anonymous: boolean;
    };
    result: Id<"forumQuestions">;
  };
  "forum.updateQuestion": {
    args: { id: Id<"forumQuestions">; title: string; content: string };
    result: null;
  };
  "forum.removeQuestion": { args: { id: Id<"forumQuestions"> }; result: null };
  "forum.answer": {
    args: {
      parentId?: Id<"forumAnswers"> | undefined;
      content: string;
      anonymous: boolean;
      questionId: Id<"forumQuestions">;
    };
    result: Id<"forumAnswers">;
  };
  "forum.updateAnswer": {
    args: { id: Id<"forumAnswers">; content: string };
    result: null;
  };
  "forum.removeAnswer": { args: { id: Id<"forumAnswers"> }; result: null };
  "forum.vote": {
    args: {
      questionId?: Id<"forumQuestions"> | undefined;
      answerId?: Id<"forumAnswers"> | undefined;
    };
    result: null;
  };
  "forum.accept": {
    args: { questionId: Id<"forumQuestions">; answerId: Id<"forumAnswers"> };
    result: null;
  };
  "forum.moderate": {
    args: {
      pinned: boolean;
      locked: boolean;
      questionId: Id<"forumQuestions">;
    };
    result: null;
  };
  "forum.report": {
    args: {
      answerId?: Id<"forumAnswers"> | undefined;
      questionId: Id<"forumQuestions">;
      reason: string;
    };
    result: null;
  };
  "forum.moderationIdentity": {
    args: {
      answerId?: Id<"forumAnswers"> | undefined;
      questionId: Id<"forumQuestions">;
    };
    result: { name: string; email: string };
  };
  "notifications.list": {
    args: Record<string, never>;
    result: {
      _id: Id<"notifications">;
      _creationTime: number;
      profileId: Id<"profiles">;
      title: string;
      body: string;
      href: string;
      read: boolean;
    }[];
  };
  "notifications.markRead": {
    args: { id?: Id<"notifications"> | undefined };
    result: null;
  };
  "profiles.me": {
    args: Record<string, never>;
    result: {
      profile: {
        _id: Id<"profiles">;
        _creationTime: number;
        avatarId?: Id<"_storage"> | undefined;
        name: string;
        authId: string;
        email: string;
        timezone: string;
        shareReadingDetails: boolean;
        notificationsEnabled: boolean;
        joinedAt: number;
        lastActiveAt: number;
      };
      membership: {
        _id: Id<"memberships">;
        _creationTime: number;
        role: "admin" | "moderator" | "member";
        clubId: Id<"clubs">;
        profileId: Id<"profiles">;
        status: "active" | "inactive";
      };
      club: {
        _id: Id<"clubs">;
        _creationTime: number;
        weeklyPrompt?: string | undefined;
        name: string;
        description: string;
        createdAt: number;
      };
      avatarUrl: string | null;
    } | null;
  };
  "profiles.configuration": {
    args: Record<string, never>;
    result: { passwordResetEnabled: boolean };
  };
  "profiles.update": {
    args: {
      name: string;
      timezone: string;
      shareReadingDetails: boolean;
      notificationsEnabled: boolean;
    };
    result: null;
  };
  "profiles.uploadUrl": { args: Record<string, never>; result: string };
  "profiles.setAvatar": { args: { storageId: Id<"_storage"> }; result: null };
  "profiles.changePassword": {
    args: { currentPassword: string; newPassword: string };
    result: null;
  };
  "profiles.directory": {
    args: Record<string, never>;
    result: {
      id: Id<"profiles">;
      name: string;
      role: "admin" | "moderator" | "member";
    }[];
  };
  "reading.library": {
    args: Record<string, never>;
    result: {
      _id: Id<"books">;
      _creationTime: number;
      description: string;
      clubId: Id<"clubs">;
      title: string;
      author: string;
      coverUrl: string;
      totalPages: number;
      category: string;
    }[];
  };
  "reading.myBooks": {
    args: Record<string, never>;
    result: {
      entry: {
        _id: Id<"userBooks">;
        _creationTime: number;
        completedAt?: number | undefined;
        profileId: Id<"profiles">;
        status: "reading" | "want" | "completed" | "paused";
        bookId: Id<"books">;
        currentPage: number;
      };
      book: {
        _id: Id<"books">;
        _creationTime: number;
        description: string;
        clubId: Id<"clubs">;
        title: string;
        author: string;
        coverUrl: string;
        totalPages: number;
        category: string;
      };
    }[];
  };
  "reading.addBook": {
    args: {
      description: string;
      title: string;
      author: string;
      coverUrl: string;
      totalPages: number;
      category: string;
    };
    result: Id<"books">;
  };
  "reading.editBook": {
    args: {
      description: string;
      title: string;
      author: string;
      coverUrl: string;
      totalPages: number;
      category: string;
      bookId: Id<"books">;
    };
    result: null;
  };
  "reading.deleteBook": { args: { bookId: Id<"books"> }; result: null };
  "reading.setBook": {
    args: {
      status: "reading" | "want" | "completed" | "paused";
      bookId: Id<"books">;
    };
    result: null;
  };
  "reading.removeBook": { args: { bookId: Id<"books"> }; result: null };
  "reading.log": {
    args: {
      reflection?: string | undefined;
      shareReflection?: boolean | undefined;
      commitment?: { title: string; targetDate: string } | undefined;
      bookId: Id<"books">;
      date: string;
      startPage: number;
      endPage: number;
      minutes: number;
      notes: string;
    };
    result: Id<"readingLogs">;
  };
  "reading.logs": {
    args: {
      paginationOpts: {
        id?: number;
        endCursor?: string | null;
        maximumRowsRead?: number;
        maximumBytesRead?: number;
        numItems: number;
        cursor: string | null;
      };
    };
    result: PaginationResult<{
      _id: Id<"readingLogs">;
      _creationTime: number;
      clubId: Id<"clubs">;
      profileId: Id<"profiles">;
      bookId: Id<"books">;
      date: string;
      startPage: number;
      endPage: number;
      pages: number;
      minutes: number;
      notes: string;
    }>;
  };
  "reading.reflections": {
    args: Record<string, never>;
    result: {
      _id: Id<"reflections">;
      _creationTime: number;
      profileId: Id<"profiles">;
      bookId: Id<"books">;
      date: string;
      body: string;
    }[];
  };
  "reading.setGoals": {
    args: { pages: number; minutes: number; days: number };
    result: null;
  };
  "reading.stats": {
    args: { today: string };
    result: {
      streak: number;
      week: { pages: number; minutes: number; days: number };
      totals: {
        pages: number;
        minutes: number;
        days: number;
        sessions: number;
        books: number;
      };
      goals: { pages: number; minutes: number; days: number };
      calendar: { date: string; minutes: number; pages: number }[];
    };
  };
  "registration.register": {
    args: {
      name: string;
      email: string;
      timezone: string;
      code: string;
      password: string;
    };
    result: null;
  };
  "registration.validateInvitation": {
    args: { code: string };
    result: { clubName: string };
  };
}
export type Doc<T extends "books"> = T extends "books"
  ? Contracts["reading.library"]["result"][number]
  : never;
