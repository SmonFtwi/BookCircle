import { spawnSync } from "node:child_process";
if (!process.env.DATABASE_URL) {
  console.error(
    "Set DATABASE_URL to a test Supabase Postgres connection, or run supabase/tests/application.sql in the Supabase SQL editor. All fixtures roll back.",
  );
  process.exit(1);
}
const result = spawnSync(
  "psql",
  ["--set", "ON_ERROR_STOP=1", "--file", "supabase/tests/application.sql"],
  {
    stdio: "inherit",
    env: { ...process.env, PGDATABASE: process.env.DATABASE_URL },
  },
);
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
