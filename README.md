# BookCircle

A private reading community built around **Read → Reflect → Apply**.

Next.js App Router, TypeScript, React, Tailwind, shadcn/ui, Supabase Auth/Postgres/Storage/Realtime, React Hook Form, Zod, Lucide, and Recharts.

## Run locally

Use Node.js 22 or 24 LTS.

```sh
npm ci
cp .env.example .env.local # only for a new checkout; this workspace is already configured
npm run dev
```

Open http://localhost:3000. The existing workspace `.env` and `.env.local` connect to the BookCircle Supabase project. Both are ignored by Git.

| Variable                        | Purpose                                                                   |
| ------------------------------- | ------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project API URL                                                  |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable API key (the variable name is retained for SDK compatibility) |
| `NEXT_PUBLIC_SITE_URL`          | App origin; localhost for development, deployment URL in production       |

No service-role key or Supabase access token is required by the app. Never expose either in browser environment variables.

## Features

- Invitation-only registration, email/password sign-in, password recovery, profile settings, private avatar storage, and active-member authorization.
- Club library, personal shelves, reading logs, timezone-aware streaks, weekly goals, private reflections, and action commitments.
- Community insights, comments, reactions, searchable forum, anonymous questions/answers, nested replies, accepted answers, reports, and moderation.
- Accountability partners, encouragement, weekly reviews, challenges, book voting, meetings, RSVPs, and three-lesson book reviews.
- Admin member/invitation management, categories, prompts, library, challenges, voting, and meetings.
- In-app notifications, hourly reminders, Realtime refresh, responsive navigation, and an offline PWA fallback.

## Roles

| Role | Access |
| --- | --- |
| Member | Personal reading activity and normal club participation |
| Moderator | Shared content tools, library, forum moderation, insights, challenges, voting, meetings, prompts, categories, and partner pairing |
| Admin | All moderator tools plus invitations, member activation, and role assignment |

Admins assign roles in **Admin tools → Members → Role**. A user cannot change their own role from this screen, and the database prevents demoting the last active administrator. Moderators cannot invite users, change account access, or assign roles. Private reading records and reflections remain personal. Administrators and moderators can identify anonymous forum authors for moderation.

## Database and security

The live schema has already been applied. `supabase/migrations/` is the source of truth. For another project, link it with the Supabase CLI and run `supabase db push`.

All public tables have RLS. Raw application-table privileges are revoked; authenticated RPCs scope every operation to an active club membership and enforce ownership/admin checks. Anonymous forum DTOs exclude author IDs. Realtime publishes only a club revision counter, never raw author or reading records.

An Auth signup trigger locks and validates a hashed invitation, creates the profile and membership, and consumes the invitation in one transaction. Clients cannot choose their role. The first administrator invitation is issued by a deployment operator with `bootstrap=true`, not by a public endpoint. The current BookCircle administrator account is already active.

Avatars use a private bucket with a 2 MB limit and JPEG/PNG/WebP restrictions. The upload route validates file signatures and uses the member's authenticated session. In-app write requests are rate-limited; Supabase Auth supplies its own authentication rate limits.

## Authentication email and deployment

Supabase Auth handles confirmation and recovery email. Before inviting a production audience, configure a verified SMTP sender in the Supabase dashboard; the default sender restricts delivery. Set Auth **Site URL** to the deployed origin and allow the exact `/auth/callback` and `/auth/callback?next=/reset-password` redirects for your environments. Enable leaked-password protection if available on your Supabase plan.

Deploy this Next.js app to Vercel with the three variables above. `vercel.json` runs `npm run build`; database migrations are applied separately. HTTPS is required for installable PWA behavior. No Vercel deployment has been created by this task.

## Checks

```sh
npm run check        # TypeScript, ESLint, unit tests, production build
npm run test:db      # requires psql and DATABASE_URL; fixtures roll back
```

Alternatively run `supabase/tests/application.sql` in the Supabase SQL editor. It exercises real RPCs under the authenticated role, signup/invitation consumption, reading, insights, anonymous discussions, partner privacy, challenges, voting, meetings, and cross-club/inactive-member rejection. All fixtures roll back.

The checked-in migrations and code contain no private access credentials. Keep `.env*`, local setup files, and database connection passwords out of Git.
