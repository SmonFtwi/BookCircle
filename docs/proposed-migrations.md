# Frontend overhaul: backend proposals (not implemented)

No database, RPC, RLS, authentication, invitation, rate limiting, or privacy changes are included in these phases.

## Standalone private notes

The current API creates private reflections only through `reading.log`. The new note sheet defaults to Private, explains that it saves a reading session, requires actual minutes, and preserves the book's current page. Sharing uses `community.create`. It never fabricates zero-minute sessions or stores private content in local storage.

A future standalone private-note mutation could accept a body and optional book. It must enforce current ownership and active membership checks, preserve private-note isolation, and avoid updating reading streaks or challenge counts. This needs a separately reviewed migration and member-isolation tests.

## Unified activity feed

The frontend composes existing shared-insight and anonymous forum DTOs, ordered by their timestamps, alongside meeting, voting, and challenge cards. A future paginated feed RPC could include shared three-lesson reviews and finished-book activity where existing privacy preferences permit it. Existing endpoints do not expose those as a chronological club feed. Do not infer private reading activity, expose anonymous author IDs, or expand leaderboard visibility to fill that gap.
