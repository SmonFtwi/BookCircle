# Next.js security upgrade

23 November 2026

Next.js and `eslint-config-next` are pinned to **16.4.6** in `package.json` and `package-lock.json`, replacing the installed 16.4.3 framework release. The matching Next.js environment, compiler and ESLint plugin packages are updated in the lockfile. React and application code are unchanged.

The [official November security release](https://nextjs.org/blog/november-2026-security-release) identifies 16.4.5 as the patched minimum. [16.4.6](https://github.com/vercel/next.js/releases/tag/v16.4.6) is the current npm stable release verified during this upgrade and includes the subsequent patch fixes.

Validation:

- `npm run check`: type checking, lint, 10 unit tests, and production build pass on 16.4.6, with no Next.js vulnerability reminder.
- `npm run test:ui`: 11 passed, one optional capture skipped; production browser regression suite; the optional original-app screenshot capture is skipped because no baseline server is requested for this upgrade.
- `npm audit --omit=dev`: zero reported vulnerabilities.
- Full `npm audit`: seven moderate findings remain in the TypeScript ESLint/minimatch development dependency chain. Next.js is not listed. No blanket audit fix or unrelated dependency upgrade was applied.

Database, authentication, invitation, privacy, and environment files are unchanged. The upgrade is local and requires deployment to update a hosted app.
