"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState, useSyncExternalStore } from "react";
import { signOut, useSession } from "next-auth/react";
import { Icon } from "@/app/components/icons";

const navigation = [
  { label: "Dashboard", href: "/", icon: "dashboard" as const },
  { label: "Students", href: "/students", icon: "students" as const },
  { label: "Teachers", href: "/teachers", icon: "students" as const },
  { label: "Classes", href: "/classes", icon: "building" as const },
  { label: "Subjects", href: "/subjects", icon: "building" as const },
  { label: "Fees", href: "/fees", icon: "building" as const },
  { label: "Performance", href: "/performance", icon: "attendance" as const },
  { label: "Risk Analysis", href: "/risk-analysis", icon: "filter" as const },
  { label: "Timetable", href: "/timetable", icon: "calendar" as const },
  { label: "Attendance", href: "/attendance", icon: "attendance" as const },
  { label: "Announcements", href: "/announcements", icon: "mail" as const },
  { label: "User Management", href: "/users", icon: "students" as const, adminOnly: true },
];

const subscribeToHydration = () => () => {};
const getClientHydration = () => true;
const getServerHydration = () => false;

function useHydrated(): boolean {
  return useSyncExternalStore(subscribeToHydration, getClientHydration, getServerHydration);
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const user = session?.user;

  if (pathname === "/login" || pathname === "/signup" || pathname === "/forbidden") return <>{children}</>;

  return (
    <div className="app-frame">
      {sidebarOpen && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <Link className="brand" href="/" onClick={() => setSidebarOpen(false)}>
          <span className="brand-mark"><Icon name="graduation" size={23} /></span>
          <span className="brand-copy"><strong>edu<span>manage</span></strong><small>STUDENT PORTAL</small></span>
        </Link>

        <div className="sidebar-menu">
          <div className="nav-caption">MENU</div>
          <Suspense fallback={<NavigationFallback closeSidebar={() => setSidebarOpen(false)} />}>
            <PathAwareNavigation
              closeSidebar={() => setSidebarOpen(false)}
              isAdmin={user?.role === "ADMIN"}
            />
          </Suspense>

          <div className="nav-caption nav-caption-bottom">PREFERENCES</div>
          {user?.role === "ADMIN" && (
            <Suspense fallback={<SettingsNavigationFallback closeSidebar={() => setSidebarOpen(false)} />}>
              <SettingsNavigation closeSidebar={() => setSidebarOpen(false)} />
            </Suspense>
          )}
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-help">
            <div className="help-icon"><Icon name="sparkles" size={19} /></div>
            <strong>Need a hand?</strong>
            <p>We’re here to help you keep things running smoothly.</p>
            <a href="mailto:support@edumanage.local">Contact support <Icon name="arrow" size={14} /></a>
          </div>
          <div className="profile-card">
            <div className="avatar avatar-navy">{user?.name?.slice(0, 2).toUpperCase() ?? "ED"}</div>
            <div className="profile-meta">
              <strong>{status === "loading" ? "Loading account…" : user?.name ?? "EduManage user"}</strong>
              <span>{user?.role === "ADMIN" ? "Administrator" : user?.role === "STAFF" ? "Staff" : ""}</span>
            </div>
            <button
              type="button"
              className="icon-button profile-more"
              aria-label="Sign out"
              title="Sign out"
              onClick={() => signOut({ redirectTo: "/login" })}
            >
              <Icon name="logout" size={18} />
            </button>
          </div>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Open navigation"
            onClick={() => setSidebarOpen(true)}
          >
            <Icon name="menu" />
          </button>
          <div className="breadcrumb"><span>Workspace</span><Icon name="chevron" size={15} /><Suspense fallback={<strong>EduManage</strong>}><PageBreadcrumb /></Suspense></div>
          <div className="topbar-right">
            <span className="today-pill"><span className="status-dot" /> Academic year 2025–26</span>
            <div className="avatar avatar-blue">{user?.name?.slice(0, 2).toUpperCase() ?? "ED"}</div>
          </div>
        </header>
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}

function PathAwareNavigation({ closeSidebar, isAdmin }: { closeSidebar: () => void; isAdmin: boolean }) {
  const pathname = usePathname();
  const hydrated = useHydrated();

  return (
    <nav className="side-nav" aria-label="Main navigation">
      {navigation.filter((item) => !item.adminOnly || isAdmin).map((item) => {
        const active = hydrated && (pathname === item.href || pathname.startsWith(`${item.href}/`));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-link ${active ? "nav-link-active" : ""}`}
            onClick={closeSidebar}
          >
            <Icon name={item.icon} size={19} />
            <span>{item.label}</span>
            {active && <span className="nav-active-mark" />}
          </Link>
        );
      })}
    </nav>
  );
}

function NavigationFallback({ closeSidebar }: { closeSidebar: () => void }) {
  return (
    <nav className="side-nav" aria-label="Main navigation">
      {navigation.filter((item) => !item.adminOnly).map((item) => (
        <Link key={item.href} href={item.href} className="nav-link" onClick={closeSidebar}>
          <Icon name={item.icon} size={19} />
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}

function SettingsNavigation({ closeSidebar }: { closeSidebar: () => void }) {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const active = hydrated && pathname === "/settings";
  return (
    <nav className="side-nav" aria-label="Preferences">
      <Link
        href="/settings"
        className={`nav-link ${active ? "nav-link-active" : ""}`}
        onClick={closeSidebar}
      >
        <Icon name="settings" size={19} />
        <span>Settings</span>
        {active && <span className="nav-active-mark" />}
      </Link>
    </nav>
  );
}

function SettingsNavigationFallback({ closeSidebar }: { closeSidebar: () => void }) {
  return (
    <nav className="side-nav" aria-label="Preferences">
      <Link href="/settings" className="nav-link" onClick={closeSidebar}>
        <Icon name="settings" size={19} />
        <span>Settings</span>
      </Link>
    </nav>
  );
}

function PageBreadcrumb() {
  const pathname = usePathname();
  const hydrated = useHydrated();
  return <strong>{hydrated ? getPageTitle(pathname) : "EduManage"}</strong>;
}

function getPageTitle(pathname: string): string {
  if (pathname.startsWith("/students")) return "Students";
  if (pathname.startsWith("/teachers")) return "Teachers";
  if (pathname.startsWith("/classes")) return "Classes";
  if (pathname.startsWith("/subjects")) return "Subjects";
  if (pathname.startsWith("/fees")) return "Fee Management";
  if (pathname.startsWith("/performance")) return "Performance";
  if (pathname.startsWith("/risk-analysis")) return "Risk Analysis";
  if (pathname.startsWith("/timetable")) return "Timetable";
  if (pathname.startsWith("/attendance")) return "Attendance";
  if (pathname.startsWith("/announcements")) return "Announcements";
  if (pathname.startsWith("/users")) return "User Management";
  if (pathname.startsWith("/settings")) return "Settings";
  return "Dashboard";
}
