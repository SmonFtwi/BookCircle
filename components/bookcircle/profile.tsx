"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "@/lib/supabase/hooks";
import { api } from "@/lib/supabase/api";
import { authClient } from "@/lib/auth-client";
import { useMember } from "./shell";
import {
  PageHeading,
  ActionForm,
  Field,
  value,
  Modal,
  useFeedback,
  dayInZone,
} from "./primitives";
import { Goals } from "./reading";
import { Button } from "@/components/ui/button";
import { ShieldCheck, LogOut, Upload } from "lucide-react";
export function ProfilePage() {
  const router = useRouter();
  const { profile, membership, avatarUrl } = useMember();
  const save = useMutation(api.profiles.update);
  const password = useMutation(api.profiles.changePassword);
  const uploadUrl = useMutation(api.profiles.uploadUrl);
  const setAvatar = useMutation(api.profiles.setAvatar);
  const stats = useQuery(api.reading.stats, {
    today: dayInZone(profile.timezone),
  });
  const reflections = useQuery(api.reading.reflections);
  const { run, feedback, busy } = useFeedback();
  return (
    <>
      <PageHeading
        eyebrow="YOUR OWN PACE. YOUR OWN STORY."
        title="My profile"
        description={`A member of the circle since ${new Date(profile.joinedAt).toLocaleDateString()}`}
      />
      <div className="grid-main">
        <div className="stack">
          <section className="panel">
            <div className="row mb-6">
              <span
                className="avatar"
                style={{
                  width: 60,
                  height: 60,
                  backgroundImage: avatarUrl ? `url(${avatarUrl})` : undefined,
                  backgroundSize: "cover",
                }}
              >
                {!avatarUrl && profile.name[0]}
              </span>
              <div>
                <h2>{profile.name}</h2>
                <p className="meta">{profile.email}</p>
              </div>
            </div>
            <ActionForm
              onSubmit={(d) =>
                save({
                  name: value(d, "name"),
                  timezone: value(d, "timezone"),
                  shareReadingDetails: d.get("share") === "on",
                  notificationsEnabled: d.get("notifications") === "on",
                })
              }
            >
              <Field label="Full name">
                <input
                  name="name"
                  defaultValue={profile.name}
                  maxLength={80}
                  required
                />
              </Field>
              <Field
                label="Timezone"
                hint="Reading days and streaks follow this timezone."
              >
                <select name="timezone" defaultValue={profile.timezone}>
                  {Array.from(
                    new Set([
                      profile.timezone,
                      ...Intl.supportedValuesOf("timeZone"),
                    ]),
                  ).map((z) => (
                    <option key={z}>{z}</option>
                  ))}
                </select>
              </Field>
              <label className="check-field">
                <input
                  type="checkbox"
                  name="share"
                  defaultChecked={profile.shareReadingDetails}
                />
                Share exact reading logs with my accountability partner
              </label>
              <label className="check-field">
                <input
                  type="checkbox"
                  name="notifications"
                  defaultChecked={profile.notificationsEnabled}
                />
                Receive in-app notifications
              </label>
            </ActionForm>
            <div className="spaced">
              <Field label="Profile image (PNG, JPEG or WebP, under 2 MB)">
                <input
                  aria-label="Upload avatar"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={busy}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    run(async () => {
                      if (file.size > 2 * 1024 * 1024)
                        throw new Error("Use an image smaller than 2 MB.");
                      const url = await uploadUrl();
                      const response = await fetch(url, {
                        method: "POST",
                        headers: { "Content-Type": file.type },
                        body: file,
                      });
                      if (!response.ok) throw new Error("Upload failed.");
                      const { storageId } = await response.json();
                      await setAvatar({ storageId });
                    });
                  }}
                />
              </Field>
              <Upload size={16} className="mt-2 text-primary" />
              {feedback}
            </div>
          </section>
          <section className="panel">
            <h2 className="mb-5">Private reflections</h2>
            {reflections?.length ? (
              reflections.map((r) => (
                <div className="list-item" key={r._id}>
                  <p className="meta">{r.date}</p>
                  <p className="prose">{r.body}</p>
                </div>
              ))
            ) : (
              <p className="muted text-sm">
                Your reflections from Read → Reflect → Apply will appear here.
              </p>
            )}
          </section>
        </div>
        <aside className="stack">
          <section className="panel">
            <h2 className="mb-4">Your story so far</h2>
            <div className="list-item row between">
              <span>Books completed</span>
              <strong>{stats?.totals.books ?? 0}</strong>
            </div>
            <div className="list-item row between">
              <span>Reading days</span>
              <strong>{stats?.totals.days ?? 0}</strong>
            </div>
            <div className="list-item row between">
              <span>Current streak</span>
              <strong>{stats?.streak ?? 0}</strong>
            </div>
            <div className="list-item row between">
              <span>Minutes read</span>
              <strong>{stats?.totals.minutes ?? 0}</strong>
            </div>
            <div className="mt-5">
              <Goals />
            </div>
          </section>
          <section className="panel">
            <h2 className="mb-4">Your circle</h2>
            <nav className="side-nav">
              <Link className="nav-item" href="/community">
                Community insights →
              </Link>
              <Link className="nav-item" href="/meetings">
                Meetings & reviews →
              </Link>
              <Link className="nav-item" href="/voting">
                Book voting →
              </Link>
              <Link className="nav-item" href="/accountability">
                Accountability →
              </Link>
              {membership.role === "admin" && (
                <Link className="nav-item" href="/admin">
                  <ShieldCheck size={18} />
                  Admin tools
                </Link>
              )}
            </nav>
          </section>
          <section className="panel">
            <h2 className="mb-4">Account security</h2>
            <Modal
              title="Change password"
              trigger={<Button variant="outline">Change password</Button>}
            >
              <ActionForm
                onSubmit={(d) => {
                  if (value(d, "new") !== value(d, "confirm"))
                    throw new Error("Passwords do not match.");
                  return password({
                    currentPassword: value(d, "current"),
                    newPassword: value(d, "new"),
                  });
                }}
              >
                <Field label="Current password">
                  <input
                    name="current"
                    type="password"
                    required
                    autoComplete="current-password"
                  />
                </Field>
                <Field label="New password">
                  <input
                    name="new"
                    type="password"
                    required
                    minLength={12}
                    autoComplete="new-password"
                  />
                </Field>
                <Field label="Confirm password">
                  <input
                    name="confirm"
                    type="password"
                    required
                    autoComplete="new-password"
                  />
                </Field>
              </ActionForm>
            </Modal>
            <Button
              className="mt-4"
              variant="ghost"
              onClick={() =>
                run(async () => {
                  await authClient.signOut();
                  router.push("/");
                })
              }
            >
              <LogOut />
              Sign out
            </Button>
          </section>
        </aside>
      </div>
    </>
  );
}
