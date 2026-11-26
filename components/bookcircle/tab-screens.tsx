"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { MessageCircle, Vote, CalendarDays, ArrowLeft } from "lucide-react";
import { ReadingHistory } from "./reading";
import { AppearanceSettings } from "./appearance";
import { Discussions } from "./discussions";
import { MeetingsPage, VotingPage } from "./events";
import { ProfileOverview, ProfileSettings, PrivateNotes } from "./profile";
import { AdminPage } from "./admin";
import { useMember } from "./shell";
import { Loading, PageHeading } from "./primitives";

const sections = [
  ["discuss", "Discussions", MessageCircle],
  ["vote", "Vote", Vote],
  ["meetings", "Meetings", CalendarDays],
] as const;

export function ClubScreen({ section }: { section: string }) {
  return (
    <>
      <nav
        className="segment-control club-navigation"
        aria-label="Club sections"
      >
        {sections.map(([id, label, Icon]) => (
          <Link
            key={id}
            href={`/club/${id}`}
            aria-current={
              section === id || (id === "discuss" && section === "insights")
                ? "page"
                : undefined
            }
          >
            <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
            {label}
          </Link>
        ))}
      </nav>
      {section === "vote" ? (
        <VotingPage />
      ) : section === "meetings" ? (
        <MeetingsPage />
      ) : (
        <Discussions />
      )}
    </>
  );
}
function MeContent() {
  const params = useSearchParams();
  const section = params.get("section");
  if (!section || !["notes", "reading"].includes(section))
    return <ProfileOverview />;
  return (
    <>
      <Link className="section-back" href="/me">
        <ArrowLeft size={17} aria-hidden="true" />
        My profile
      </Link>
      {section === "notes" ? (
        <>
          <PageHeading
            title="Private notes"
            description="Only you can see these notes."
          />
          <PrivateNotes />
        </>
      ) : (
        <>
          <PageHeading
            title="Reading history"
            description="Your saved reading sessions."
          />
          <ReadingHistory />
        </>
      )}
    </>
  );
}
export function MeScreen() {
  return (
    <Suspense fallback={<Loading />}>
      <MeContent />
    </Suspense>
  );
}
function SettingsContent() {
  const { membership } = useMember();
  const params = useSearchParams();
  if (params.get("section") === "management" && membership.role !== "member")
    return (
      <>
        <Link className="section-back" href="/me/settings">
          <ArrowLeft size={17} /> Settings
        </Link>
        <AdminPage />
      </>
    );
  return (
    <>
      <Link className="section-back" href="/me">
        <ArrowLeft size={17} aria-hidden="true" />
        My profile
      </Link>
      <PageHeading title="Settings" />
      <AppearanceSettings />
      <ProfileSettings />
      {membership.role !== "member" && (
        <section className="panel">
          <h2>Club management</h2>
          <nav className="management-rows" aria-label="Club management">
            {[
              ...(membership.role === "admin"
                ? [
                    ["members", "Members"],
                    ["invitations", "Invitations"],
                  ]
                : []),
              ["library", "Library"],
              ["prompts", "Prompts"],
              ["categories", "Categories"],
              ["moderation", "Moderation"],
            ].map(([id, label]) => (
              <Link key={id} href={`/me/settings?section=management#${id}`}>
                {label}
                <span aria-hidden="true">→</span>
              </Link>
            ))}
          </nav>
        </section>
      )}
      {params.get("section") === "management" &&
        membership.role !== "member" && <AdminPage />}
    </>
  );
}
export function SettingsScreen() {
  return (
    <Suspense fallback={<Loading />}>
      <SettingsContent />
    </Suspense>
  );
}
