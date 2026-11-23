"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ForumPage } from "./forum";
import { CommunityPage } from "./community";
import { MeetingsPage, VotingPage } from "./events";
import { ChallengesPage } from "./challenges";
import { ProfilePage } from "./profile";
import { AccountabilityPage } from "./accountability";
import { AdminPage } from "./admin";
import { useMember } from "./shell";
import { Loading, PageHeading } from "./primitives";

const sections = [
  ["discuss", "Discuss"],
  ["vote", "Vote"],
  ["meetings", "Meetings"],
  ["challenges", "Challenges"],
];
export function ClubScreen({ section }: { section: string }) {
  return (
    <>
      <nav className="segment-control" aria-label="Club sections">
        {sections.map(([id, label]) => (
          <Link
            key={id}
            href={`/club/${id}`}
            aria-current={
              section === id || (id === "discuss" && section === "insights")
                ? "page"
                : undefined
            }
          >
            {label}
          </Link>
        ))}
      </nav>
      {(section === "discuss" || section === "insights") && (
        <div className="pill-row mb-6">
          <Link className="section-link" href="/club/discuss">
            Questions
          </Link>
          <Link className="section-link" href="/club/insights">
            Shared insights
          </Link>
        </div>
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
  return (
    <>
      <nav className="segment-control" aria-label="Me sections">
        <Link
          href="/me"
          aria-current={!params.get("section") ? "page" : undefined}
        >
          My reading
        </Link>
        <Link
          href="/me?section=accountability"
          aria-current={
            params.get("section") === "accountability" ? "page" : undefined
          }
        >
          Commitments & partner
        </Link>
        <Link href="/me/settings">Settings</Link>
      </nav>
      {params.get("section") === "accountability" ? (
        <AccountabilityPage />
      ) : (
        <ProfilePage />
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
      <Link className="section-link" href="/me">
        ← Me
      </Link>
      <PageHeading title="Settings" description="Make yourself at home." />
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
      <p className="muted mt-6">
        Account details, password and sign out are available in{" "}
        <Link className="section-link" href="/me">
          Me
        </Link>
        .
      </p>
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
