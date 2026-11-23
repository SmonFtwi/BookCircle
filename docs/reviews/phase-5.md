# Simplify Library, Club and Me screens

Head: `ux/phase-5-tab-screens`  
Base: `ux/phase-4-home-feed`

Library has search, Club books/My shelves, shelf filters and book details. Me contains personal reading, notes, goals and history, with commitments/partner access. Profile/security controls live in Settings; a skippable Read/Reflect/Meet introduction welcomes first-time members.

Validation: `npm run check` and `npm run test:ui` passed for this phase. The final cumulative suite also covers the expanded flows and screenshots. No database tests were required because database files did not change.

Assumptions: preserve all existing RPCs, validation and role/privacy behavior. Private notes need actual reading minutes; a standalone note endpoint and additional privacy-aware feed events are documented proposals only. No auth, invitation, rate-limit, schema, RLS or migration changes.

Overall before/after reference images, captured in phase 6 (not intermediate-phase screenshots):

- [Before Home](../screenshots/before-home.png)
- [After Home](../screenshots/home.png)
- [Library](../screenshots/library.png), [Club](../screenshots/club.png), [Me](../screenshots/me.png)
- [Quick actions](../screenshots/quick-action-sheet.png), [dark mode](../screenshots/home-dark.png)

See [UX review](../ux-review.md) and [backend proposals](../proposed-migrations.md). Existing Next.js security advisory remains outside this UX scope. Lighthouse and real-device haptics/keyboard behavior have not been measured.
