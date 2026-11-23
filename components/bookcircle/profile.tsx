"use client";
import Link from "next/link";
import { ProgressRing } from "./signature";
import { launchQuickAction } from "./quick-actions";
import { InstallGuideButton } from "./install-guide";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@/lib/supabase/hooks";
import { api } from "@/lib/supabase/api";
import { authClient } from "@/lib/auth-client";
import { useMember } from "./shell";
import {
  PageHeading,
  Loading,
  Empty,
  ActionForm,
  Field,
  value,
  Modal,
  useFeedback,
  dayInZone,
} from "./primitives";
import { Goals } from "./reading";
import { Button } from "@/components/ui/button";
import {
  LogOut,
  Upload,
  Settings,
  Feather,
  BookOpen,
  HeartHandshake,
  ChevronRight,
  Flame,
  LockKeyhole,
} from "lucide-react";
export function ProfileSettings() {
  const router = useRouter();
  const { profile, avatarUrl } = useMember();
  const save = useMutation(api.profiles.update);
  const password = useMutation(api.profiles.changePassword);
  const uploadUrl = useMutation(api.profiles.uploadUrl);
  const setAvatar = useMutation(api.profiles.setAvatar);
  const { run, feedback, busy } = useFeedback();
  return (
    <div className="settings-stack">
      <div>
        <InstallGuideButton />
      </div>
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
    </div>
  );
}

export function ProfileOverview() {
  const { profile, avatarUrl } = useMember();
  const stats = useQuery(api.reading.stats, {
    today: dayInZone(profile.timezone),
  });
  if (!stats) return <Loading />;
  return (
    <>
      <PageHeading eyebrow="YOUR LITTLE CORNER OF THE CIRCLE" title="Me" />
      <section className="profile-identity">
        <span
          className="profile-avatar"
          style={
            avatarUrl
              ? { backgroundImage: `url(${JSON.stringify(avatarUrl)})` }
              : undefined
          }
          aria-hidden="true"
        >
          {!avatarUrl &&
            profile.name
              .split(" ")
              .map((part) => part[0])
              .slice(0, 2)
              .join("")}
        </span>
        <div>
          <h2>{profile.name}</h2>
          <p>
            In the circle since{" "}
            {new Date(profile.joinedAt).toLocaleDateString(undefined, {
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>
        <Link
          className="profile-settings-link"
          href="/me/settings"
          aria-label="Settings"
        >
          <Settings size={21} />
          <span>Settings</span>
        </Link>
      </section>
      <section className="profile-stat-strip" aria-label="Your reading totals">
        {[
          [stats.totals.books, "Books finished"],
          [stats.totals.days, "Reading days"],
          [stats.totals.minutes, "Minutes read"],
        ].map(([number, label]) => (
          <div key={label}>
            <strong>{Number(number).toLocaleString()}</strong>
            <span>{label}</span>
          </div>
        ))}
      </section>
      <div className="section-head profile-collection-heading">
        <h2>Your reading space</h2>
      </div>
      <nav className="profile-destinations" aria-label="Your personal space">
        {[
          {
            href: "/me?section=notes",
            title: "Private notes",
            description: "Ideas and reflections, just for you.",
            icon: Feather,
          },
          {
            href: "/me?section=reading",
            title: "Reading history",
            description: "Your sessions, progress and reading rhythm.",
            icon: BookOpen,
          },
          {
            href: "/me?section=accountability",
            title: "Commitments & partner",
            description: "Put an idea into practice, together.",
            icon: HeartHandshake,
          },
        ].map((item) => (
          <Link key={item.href} href={item.href}>
            <span className="profile-destination-icon">
              <item.icon size={22} strokeWidth={1.75} />
            </span>
            <span>
              <strong>{item.title}</strong>
              <small>{item.description}</small>
            </span>
            <ChevronRight size={19} aria-hidden="true" />
          </Link>
        ))}
      </nav>
      <section className="profile-week panel">
        <div className="row between">
          <div>
            <span className="section-kicker">THIS WEEK</span>
            <h2>A little consistency.</h2>
            <p className="muted">
              {stats.week.minutes} of {stats.goals.minutes} reading minutes
            </p>
          </div>
          <ProgressRing
            value={
              stats.goals.minutes
                ? (stats.week.minutes / stats.goals.minutes) * 100
                : 0
            }
            label="Your weekly reading goal"
            size={72}
          />
        </div>
        <div className="profile-week-footer">
          <span>
            <Flame size={17} aria-hidden="true" />
            {stats.streak
              ? `${stats.streak}-day streak`
              : "A fresh start, any day"}
          </span>
          <Goals />
        </div>
      </section>
    </>
  );
}
export function PrivateNotes() {
  const reflections = useQuery(api.reading.reflections);
  const library = useQuery(api.reading.library);
  if (!reflections || !library) return <Loading />;
  return (
    <div className="stack">
      {reflections.length ? (
        reflections.map((note) => (
          <article className="panel private-note" key={note._id}>
            <div className="row between">
              <span className="book-category">
                {library.find((book) => book._id === note.bookId)?.title ??
                  "A reading reflection"}
              </span>
              <span className="meta">{note.date}</span>
            </div>
            <p className="prose">{note.body}</p>
            <p className="meta">
              <LockKeyhole size={13} aria-hidden="true" />
              Only you
            </p>
          </article>
        ))
      ) : (
        <section className="panel">
          <Empty
            title="Keep your first good idea"
            description="Your private notes live here. A sentence is a lovely place to start."
            action={
              <Button onClick={() => launchQuickAction({ action: "note" })}>
                <Feather size={18} />
                Add a note
              </Button>
            }
          />
        </section>
      )}
    </div>
  );
}
