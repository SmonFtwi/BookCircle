# BookCircle UX review

## Design

Warm literary reading room: paper, ink, deep green, terracotta, Fraunces headings, and DM Sans interface text. Circular navigation marks, goal rings, avatars, and a bookmark ribbon provide the signature. The direction scores 14 on the frontend-design feasibility index (impact 4, context 5, feasibility 4, performance 4, consistency risk 3).

## Feature map

| Destination | Features |
| --- | --- |
| Home | Streak, weekly goal, upcoming meeting and RSVP, open vote, active challenges, current book, shared insights and forum activity |
| Library | Search, Club books / My shelves, all four shelf states, book details, reading status, removal from personal shelves; managers retain book editing |
| Center + | Reading session with optional notes/reflection/commitment, private note with a reading session or shared insight, anonymous question, challenge check-in |
| Club: Discuss | Questions, search, categories, sorting, answers/replies, reactions, reporting and role-gated moderation; shared insights with comments/reactions/edit/delete |
| Club: Vote | Nominations, voting and change of choice under existing rules, deadlines and results; manager round controls |
| Club: Meetings | Inline RSVP, optional discussion question, three-lesson reviews; manager scheduling and agenda |
| Club: Challenges | Status/category/participation filters, join/invitation responses, private entries with editing/deletion, collapsed top-three leaderboard; manager creation and invitations |
| Me | Profile summary and totals; separate Private notes, Reading history, and Commitments & partner destinations; weekly goal and streak |
| Me: Settings | Profile/avatar, timezone, existing privacy and notification preferences, password, sign out, installation guide, automatic/light/dark appearance |
| Settings: Club management | Library, prompts, categories, partner pairing, moderation for managers; members and invitations remain admin only |

Legacy reading, forum-list, voting, meetings, challenges, community, accountability, profile and admin URLs redirect to their new locations. Forum detail links remain valid. Sign-in, registration, password reset, auth callback, APIs and all server permission checks are unchanged. Maximum destination depth is two URL segments within each tab.

## Validation

- Each phase ran `npm run check` and `npm run test:ui`. Next.js occasionally stopped after a security upgrade reminder; retrying the same check completed successfully. The subsequent [Next.js security upgrade](nextjs-security-upgrade.md) pins Next.js and its ESLint config to 16.4.6 and resolves that framework advisory.
- Final validation passed: 10 unit tests, production build/typecheck/lint, and 12 browser tests (including the optional original-app capture).
- Final browser coverage exercises all four tabs, legacy redirects, member/moderator gating, reading defaults and payload, private-note defaults, anonymous-author disclosure, inline RSVP, voting, private entry editing/deletion, drawer check-in, explicit activity refresh, dark-mode persistence, 390px overflow, and browser console/page errors.
- Production browser tests start their own app on port 3100. `PLAYWRIGHT_BASE_URL` supports an external test server. Installed Chrome was used in this environment through `PLAYWRIGHT_EXECUTABLE_PATH`.
- Rendered-text contrast is checked on Home, Library, Club discussions, Me, and Settings in both themes. The audit skips image/gradient backgrounds, opacity effects, and disabled controls; these need visual review. Reserved cover dimensions, 44–48px controls, visible focus, keyboard-trapped drawers, safe-area padding, and reduced-motion overrides were inspected in code and screenshots.
- Primary token contrast: light ink/paper 16.00:1; muted/paper 5.54:1; white/green 7.49:1. Dark ink/card 14.27:1; muted/card 6.03:1; button text/green 6.20:1. Destructive pairs: light 6.54:1, dark 10.74:1. Terracotta is decorative; ribbon text uses ink.
- No database-related files changed, so database tests were not run. No `.env*` files were edited. No live member data was used in browser tests or screenshots.
- Lighthouse mobile scores and real-device keyboard/haptic behavior have not been measured; no score is claimed. Full offline support remains out of scope.

## Existing-data limits

Standalone private notes need a new endpoint. The UI explicitly saves them with an actual reading session and does not fabricate activity. Finished-book and shared-review feed events need a privacy-aware shared feed endpoint; those features remain in Library and Meetings. See [proposed migrations](proposed-migrations.md). No migration is implemented.

## Review branches

The six branches are stacked in phase order. Review and merge decisions remain with the repository owner. No changes are merged into main. Draft PR descriptions are in [reviews](reviews/); they reference the overall baseline/final screenshots collected in phase 6, rather than presenting those as screenshots of each intermediate phase.

| Phase | Branch | Draft PR description |
| --- | --- | --- |
| 1 | `ux/phase-1-shell` | [Shell](reviews/phase-1.md) |
| 2 | `ux/phase-2-design-system` | [Design system](reviews/phase-2.md) |
| 3 | `ux/phase-3-quick-actions` | [Quick actions](reviews/phase-3.md) |
| 4 | `ux/phase-4-home-feed` | [Home feed](reviews/phase-4.md) |
| 5 | `ux/phase-5-tab-screens` | [Tab screens](reviews/phase-5.md) |
| 6 | `ux/phase-6-polish` | [Polish](reviews/phase-6.md) |

The subsequent [section design refinement](section-design-refinement.md) simplifies Library cards, Club filters, and the profile hierarchy.
