# Introduce a warm literary design system and dark mode

Head: `ux/phase-2-design-system`  
Base: `ux/phase-1-shell`

Paper, ink, green and terracotta tokens replace the old palette. Existing next/font Fraunces/DM Sans are retained; shared covers, rings, avatar stacks and a bookmark ribbon support the identity. Appearance follows the system or a persisted Settings preference.

Validation: `npm run check` and `npm run test:ui` passed for this phase. The final cumulative suite also covers the expanded flows and screenshots. No database tests were required because database files did not change.

Assumptions: preserve all existing RPCs, validation and role/privacy behavior. Private notes need actual reading minutes; a standalone note endpoint and additional privacy-aware feed events are documented proposals only. No auth, invitation, rate-limit, schema, RLS or migration changes.

Overall before/after reference images, captured in phase 6 (not intermediate-phase screenshots):

- [Before Home](../screenshots/before-home.png)
- [After Home](../screenshots/home.png)
- [Library](../screenshots/library.png), [Club](../screenshots/club.png), [Me](../screenshots/me.png)
- [Quick actions](../screenshots/quick-action-sheet.png), [dark mode](../screenshots/home-dark.png)

See [UX review](../ux-review.md) and [backend proposals](../proposed-migrations.md). Existing Next.js security advisory remains outside this UX scope. Lighthouse and real-device haptics/keyboard behavior have not been measured.
