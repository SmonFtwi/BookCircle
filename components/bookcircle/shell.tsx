"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useState, Fragment } from "react";
import { useQuery, useAuth } from "@/lib/supabase/hooks";
import { api } from "@/lib/supabase/api";
import {
  Home,
  BookOpen,
  MessageCircle,
  User,
  ArrowRight,
  Plus,
} from "lucide-react";
import { LogReading } from "./reading";
import { ShareInsight } from "./community";
import { AskQuestion } from "./forum";
import { Notifications } from "./notifications";
import { Logo, Loading, Modal } from "./primitives";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
type Member = NonNullable<Awaited<ReturnType<typeof api.profiles.me>>>;
const MemberContext = createContext<Member | null>(null);
export function useMember() {
  const m = useContext(MemberContext);
  if (!m) throw new Error("Member context missing");
  return m;
}
const nav = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/library", label: "Library", icon: BookOpen },
  { href: "/club/discuss", label: "Club", icon: MessageCircle },
  { href: "/me", label: "Me", icon: User },
];
function isActive(path: string, href: string) {
  return href.startsWith("/club")
    ? path.startsWith("/club") || path.startsWith("/forum/")
    : href === "/me"
      ? path.startsWith("/me")
      : path === href;
}
export function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isLoading, isAuthenticated } = useAuth();
  const member = useQuery(api.profiles.me, isAuthenticated ? {} : "skip");
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  if (isLoading || (isAuthenticated && member === undefined))
    return (
      <main className="content">
        <Loading />
      </main>
    );
  if (!isAuthenticated)
    return (
      <main className="welcome">
        <div className="auth-card">
          <Logo />
          <h1 className="spaced">Your circle is waiting.</h1>
          <p>Sign in to access your private reading community.</p>
          <Link href="/" className="primary-link">
            Sign in <ArrowRight size={17} />
          </Link>
        </div>
      </main>
    );
  if (!member)
    return (
      <main className="welcome">
        <div className="auth-card">
          <h1>Membership unavailable.</h1>
          <p>
            Your account does not have an active club membership. Contact your
            administrator.
          </p>
          <Button
            onClick={() => authClient.signOut().then(() => router.push("/"))}
          >
            Sign out
          </Button>
        </div>
      </main>
    );
  return (
    <MemberContext.Provider value={member}>
      <aside className="circle-rail">
        <Link href="/home" aria-label="BookCircle home">
          <Logo />
        </Link>
        <button
          className="quick-action-launch"
          aria-label="Quick actions"
          onClick={() => setMenuOpen(true)}
        >
          <Plus size={24} />
          <span>Create</span>
        </button>
        <nav aria-label="Desktop navigation">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={isActive(pathname, n.href) ? "page" : undefined}
              className={isActive(pathname, n.href) ? "active" : ""}
            >
              <n.icon size={24} />
              {n.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="app-main">
        <header className="circle-topbar">
          <Link href="/home">
            <Logo />
          </Link>
          <Notifications />
        </header>
        <main className="content">{children}</main>
      </div>
      <nav className="circle-tabs" aria-label="Main navigation">
        {nav.map((n, index) => (
          <Fragment key={n.href}>
            {index === 2 && (
              <button
                className="quick-action-launch"
                aria-label="Quick actions"
                onClick={() => setMenuOpen(true)}
              >
                <Plus size={26} />
              </button>
            )}
            <Link
              href={n.href}
              aria-current={isActive(pathname, n.href) ? "page" : undefined}
              className={isActive(pathname, n.href) ? "active" : ""}
            >
              <n.icon size={24} strokeWidth={1.75} />
              {n.label}
            </Link>
          </Fragment>
        ))}
      </nav>
      <Modal
        title="A little step today"
        open={menuOpen}
        onOpenChange={setMenuOpen}
      >
        <div className="stack quick-action-options">
          <LogReading />
          <ShareInsight />
          <AskQuestion />
          <Button asChild variant="outline">
            <Link href="/club/challenges" onClick={() => setMenuOpen(false)}>
              Challenge check-in
            </Link>
          </Button>
        </div>
      </Modal>
    </MemberContext.Provider>
  );
}
