# Polish the PWA, accessibility and mobile review coverage

Head: `ux/phase-6-polish`  
Base: `ux/phase-5-tab-screens`

Brand PWA icons/colors, mobile drawers, reduced-motion handling, haptics, offline feedback and visual refinements finish the experience. Production browser tests cover privacy defaults, anonymous-author disclosure, drawer check-in, realtime refresh, theme persistence, rendered contrast and console/overflow checks. README includes 390px review screenshots.

Validation: `npm run check` and `npm run test:ui` passed for this phase. The final cumulative suite also covers the expanded flows and screenshots. No database tests were required because database files did not change.

Assumptions: preserve all existing RPCs, validation and role/privacy behavior. Private notes need actual reading minutes; a standalone note endpoint and additional privacy-aware feed events are documented proposals only. No auth, invitation, rate-limit, schema, RLS or migration changes.

Overall before/after reference images, captured in phase 6 (not intermediate-phase screenshots):

- [Before Home](../screenshots/before-home.png)
- [After Home](../screenshots/home.png)
- [Library](../screenshots/library.png), [Club](../screenshots/club.png), [Me](../screenshots/me.png)
- [Quick actions](../screenshots/quick-action-sheet.png), [dark mode](../screenshots/home-dark.png)

See [UX review](../ux-review.md) and [backend proposals](../proposed-migrations.md). Existing Next.js security advisory remains outside this UX scope. Lighthouse and real-device haptics/keyboard behavior have not been measured.
