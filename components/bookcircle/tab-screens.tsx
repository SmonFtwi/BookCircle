"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import {
  MessageCircle,
  Vote,
  CalendarDays,
  Trophy,
  ArrowLeft,
} from "lucide-react";
import { ReadingHistory } from "./reading";
import { AppearanceSettings } from "./appearance";
import { ForumPage } from "./forum";
import { CommunityPage } from "./community";
import { MeetingsPage, VotingPage } from "./events";
import { ChallengesPage } from "./challenges";
import { ProfileOverview, ProfileSettings, PrivateNotes } from "./profile";
import { AccountabilityPage } from "./accountability";
import { AdminPage } from "./admin";
import { useMember } from "./shell";
import { Loading, PageHeading } from "./primitives";

const sections = [
  ["discuss", "Discuss", MessageCircle],
  ["vote", "Vote", Vote],
  ["meetings", "Meetings", CalendarDays],
  ["challenges", "Challenges", Trophy],
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
      {(section === "discuss" || section === "insights") && (
        <nav className="discussion-views" aria-label="Discussion views">
          <Link
            href="/club/discuss"
            aria-current={section === "discuss" ? "page" : undefined}
          >
            Questions
          </Link>
          <Link
            href="/club/insights"
            aria-current={section === "insights" ? "page" : undefined}
          >
            Shared insights
          </Link>
        </nav>
      )}
      {section === "vote" ? (
        <VotingPage />
      ) : section === "meetings" ? (
        <MeetingsPage />
      ) : section === "challenges" ? (
        <ChallengesPage />
      ) : section === "insights" ? (
        <CommunityPage />
      ) : (
        <ForumPage />
      )}
    </>
  );
}
function MeContent() {
  const params = useSearchParams();
  const section = params.get("section");
  if (!section || !["notes", "reading", "accountability"].includes(section))
    return <ProfileOverview />;
  return (
    <>
      <Link className="section-back" href="/me">
        <ArrowLeft size={17} aria-hidden="true" />
        My profile
      </Link>
      {section === "accountability" ? (
        <AccountabilityPage />
      ) : section === "notes" ? (
        <>
          <PageHeading
            eyebrow="ONLY YOU CAN SEE THESE"
            title="Private notes"
            description="The ideas you want to carry with you."
          />
          <PrivateNotes />
        </>
      ) : (
        <>
          <PageHeading
            title="Reading history"
            description="Every little session adds to your story."
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
  return (
    <>
      <Link className="section-back" href="/me">
        <ArrowLeft size={17} aria-hidden="true" />
        My profile
      </Link>
      <PageHeading title="Settings" description="Make yourself at home." />
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
              ["partners", "Partner pairing"],
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
