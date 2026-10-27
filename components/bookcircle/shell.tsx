"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useState } from "react";
import { useQuery, useAuth } from "@/lib/supabase/hooks";
import { api } from "@/lib/supabase/api";
import {
  Home,
  BookOpen,
  MessageCircle,
  Trophy,
  User,
  Sprout,
  Calendar,
  Vote,
  HeartHandshake,
  ShieldCheck,
  ArrowRight,
  Menu,
  LogOut,
} from "lucide-react";
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
  { href: "/reading", label: "Reading", icon: BookOpen },
  { href: "/forum", label: "Forum", icon: MessageCircle },
  { href: "/challenges", label: "Challenges", icon: Trophy },
  { href: "/profile", label: "Profile", icon: User },
];
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
      <aside className="sidebar">
        <Link href="/home">
          <Logo />
        </Link>
        <p className="nav-label">YOUR CIRCLE</p>
        <nav className="side-nav">
          {nav.slice(0, 4).map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`nav-item ${pathname === n.href ? "active" : ""}`}
            >
              <n.icon size={19} />
              {n.label}
            </Link>
          ))}
          <Link
            href="/community"
            className={`nav-item ${pathname === "/community" ? "active" : ""}`}
          >
            <Sprout size={19} />
            Community
          </Link>
        </nav>
        <p className="nav-label spaced">GROW TOGETHER</p>
        <nav className="side-nav">
          {[
            { href: "/meetings", label: "Meetings", icon: Calendar },
            { href: "/voting", label: "Book voting", icon: Vote },
            {
              href: "/accountability",
              label: "Accountability",
              icon: HeartHandshake,
            },
          ].map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`nav-item ${pathname === n.href ? "active" : ""}`}
            >
              <n.icon size={18} />
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="circle-note">
          <Sprout size={21} />
          <strong>One page at a time.</strong>
          <p>A little consistency goes a long way. We’re glad you’re here.</p>
        </div>
        <div className="sidebar-bottom">
          <Link
            href="/profile"
            className={`nav-item ${pathname === "/profile" ? "active" : ""}`}
          >
            <User size={18} />
            My profile
          </Link>
          {member.membership.role !== "member" && (
            <Link
              className={`nav-item ${pathname === "/admin" ? "active" : ""}`}
              href="/admin"
            >
              <ShieldCheck size={18} />
              {member.membership.role === "admin"
                ? "Admin tools"
                : "Content tools"}
            </Link>
          )}
          <button
            type="button"
            className="nav-item sign-out-btn"
            onClick={() => authClient.signOut().then(() => router.push("/"))}
          >
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </aside>
      <div className="app-main">
        <div className="topbar">
          <div className="flex items-center gap-3">
            <Modal
              open={menuOpen}
              onOpenChange={setMenuOpen}
              title="Circle navigation"
              trigger={
                <button
                  className="mobile-menu-btn"
                  aria-label="Open navigation menu"
                >
                  <Menu size={20} />
                </button>
              }
            >
              <div className="side-nav mt-3">
                <p className="nav-label">YOUR CIRCLE</p>
                {nav.map((n) => (
                  <Link
                    key={n.href}
                    href={n.href}
                    onClick={() => setMenuOpen(false)}
                    className={`nav-item ${pathname === n.href ? "active" : ""}`}
                  >
                    <n.icon size={19} />
                    {n.label}
                  </Link>
                ))}
                <Link
                  href="/community"
                  onClick={() => setMenuOpen(false)}
                  className={`nav-item ${pathname === "/community" ? "active" : ""}`}
                >
                  <Sprout size={19} />
                  Community
                </Link>

                <p className="nav-label spaced">GROW TOGETHER</p>
                {[
                  { href: "/meetings", label: "Meetings", icon: Calendar },
                  { href: "/voting", label: "Book voting", icon: Vote },
                  {
                    href: "/accountability",
                    label: "Accountability",
                    icon: HeartHandshake,
                  },
                ].map((n) => (
                  <Link
                    key={n.href}
                    href={n.href}
                    onClick={() => setMenuOpen(false)}
                    className={`nav-item ${pathname === n.href ? "active" : ""}`}
                  >
                    <n.icon size={18} />
                    {n.label}
                  </Link>
                ))}

                <p className="nav-label spaced">YOUR ACCOUNT</p>
                <Link
                  href="/profile"
                  onClick={() => setMenuOpen(false)}
                  className={`nav-item ${pathname === "/profile" ? "active" : ""}`}
                >
                  <User size={18} />
                  My profile
                </Link>
                {member.membership.role !== "member" && (
                  <Link
                    className={`nav-item ${pathname === "/admin" ? "active" : ""}`}
                    href="/admin"
                    onClick={() => setMenuOpen(false)}
                  >
                    <ShieldCheck size={18} />
                    {member.membership.role === "admin"
                      ? "Admin tools"
                      : "Content tools"}
                  </Link>
                )}
                <Button
                  variant="ghost"
                  className="w-full justify-start mt-2"
                  onClick={() => {
                    setMenuOpen(false);
                    authClient.signOut().then(() => router.push("/"));
                  }}
                >
                  <LogOut size={16} className="mr-2" />
                  Sign out
                </Button>
              </div>
            </Modal>
            <span className="topbar-label">
              {member.club.name} <span className="mx-2">/</span> A little
              better, together
            </span>
            <Link href="/home" className="mobile-logo">
              <Logo />
            </Link>
          </div>
          <div className="topbar-actions">
            <Notifications />
            <Link href="/profile" className="avatar" aria-label="Your profile">
              {member.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={member.avatarUrl} alt="" className="avatar-img" />
              ) : (
                member.profile.name
                  .split(" ")
                  .map((s) => s[0])
                  .slice(0, 2)
                  .join("")
              )}
            </Link>
          </div>
        </div>
        <main className="content">{children}</main>
      </div>
      <nav className="bottom-nav" aria-label="Main navigation">
        {nav.map((n) => (
          <Link
            key={n.href}
            className={pathname === n.href ? "active" : ""}
            href={n.href}
          >
            <n.icon size={21} />
            {n.label}
          </Link>
        ))}
      </nav>
    </MemberContext.Provider>
  );
}
