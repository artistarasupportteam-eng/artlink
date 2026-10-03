import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Bell,
  Home,
  Info,
  Library,
  LifeBuoy,
  LogOut,
  Mail,
  Menu,
  Plus,
  ScrollText,
  Settings,
  Shield,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { signOut } from "@/lib/auth/client";
import { hasGateSessionMarker } from "@/lib/auth/gate-session-marker";
import { getMe } from "@/lib/fns/api";
import type { Me } from "@/lib/model";
import { applyTheme } from "@/lib/theme";
import { Spinner } from "@/components/ui";

const NAV = [
  { to: "/", label: "Home", icon: Home },
  { to: "/create", label: "Create", icon: Plus },
  { to: "/library", label: "Library", icon: Library },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/profile", label: "Profile", icon: UserRound },
] as const;

const subscribe = () => () => {};

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (state) => state.location.pathname });
  const { user, isPending } = useCurrentUserState();
  const [me, setMe] = useState<Me | null>(null);
  const [menu, setMenu] = useState(false);
  const gate = useSyncExternalStore(subscribe, hasGateSessionMarker, () => false);

  useEffect(() => {
    if (!user) return;
    let live = true;
    getMe()
      .then((next) => {
        if (!live) return;
        setMe(next);
        applyTheme(next.theme);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (document.documentElement.dataset.choice === "system") applyTheme("system");
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const initial = (me?.artistName || user?.displayName || user?.primaryEmail || "A").slice(0, 1).toUpperCase();
  const photo = me?.avatarUrl || user?.profileImageUrl || "";

  return (
    <div className="min-h-dvh bg-bg text-fg md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-surface px-3 py-5 md:flex">
        <Link to="/" className="px-2 font-display text-2xl tracking-tight">
          ART<span className="text-accent">Link</span>
        </Link>
        <nav className="mt-8 grid gap-1" aria-label="Primary">
          {NAV.map((item) => (
            <NavLink key={item.to} {...item} path={path} />
          ))}
        </nav>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border bg-bg/95 px-4 backdrop-blur md:px-8">
          <Link to="/" className="font-display text-xl tracking-tight md:hidden">
            ART<span className="text-accent">Link</span>
          </Link>
          <p className="hidden text-sm text-muted md:block">Music links, without the noise.</p>
          <div className="ml-auto flex items-center gap-1">
            <Link to="/notifications" aria-label="Notifications" className="relative grid size-11 place-items-center rounded-md hover:bg-surface-2">
              <Bell className="size-5" />
              {me && me.unread > 0 ? (
                <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-accent" aria-label={`${me.unread} unread`} />
              ) : null}
            </Link>
            <button type="button" aria-label="Menu" className="grid size-11 place-items-center rounded-md hover:bg-surface-2" onClick={() => setMenu(true)}>
              <Menu className="size-5" />
            </button>
            {isPending ? (
              <span className="size-9 animate-pulse rounded-full bg-surface-2" />
            ) : user ? (
              <Link to="/profile" aria-label="Profile" className="grid size-9 place-items-center overflow-hidden rounded-full bg-surface-2 text-sm font-semibold">
                {photo ? <img src={photo} alt="" className="size-9 object-cover" /> : initial}
              </Link>
            ) : (
              <Link to="/login" className="inline-flex h-9 items-center rounded-md bg-accent px-3 text-sm font-medium text-accent-fg">
                Sign in
              </Link>
            )}
          </div>
        </header>
        {me?.suspended ? (
          <p className="bg-danger px-4 py-2 text-sm text-danger-fg">This account is suspended. You can still read your pages, but publishing is paused.</p>
        ) : null}
        <main className="mx-auto w-full max-w-5xl px-4 py-5 pb-24 md:px-8 md:py-8 md:pb-10">{children}</main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-surface md:hidden" aria-label="Primary">
        {NAV.map((item) => (
          <NavLink key={item.to} {...item} path={path} compact />
        ))}
      </nav>
      {menu ? (
        <div className="fixed inset-0 z-40 bg-fg/40" onClick={() => setMenu(false)}>
          <div className="ml-auto flex h-full w-[min(100%,20rem)] flex-col gap-1 overflow-y-auto border-l border-border bg-surface p-4" onClick={(event) => event.stopPropagation()} role="dialog" aria-label="Menu">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-display text-xl">Menu</p>
              <button type="button" aria-label="Close" className="grid size-11 place-items-center" onClick={() => setMenu(false)}>
                <X className="size-5" />
              </button>
            </div>
            <MenuLink to="/artist" icon={<UserRound className="size-4" />} label="My Artist Profile" onClick={() => setMenu(false)} />
            <MenuLink to="/audience" icon={<Users className="size-4" />} label="Audience" onClick={() => setMenu(false)} />
            <MenuLink to="/emails" icon={<Mail className="size-4" />} label="Collected Emails" onClick={() => setMenu(false)} />
            <MenuLink to="/notifications" icon={<Bell className="size-4" />} label="Notifications" onClick={() => setMenu(false)} />
            <MenuLink to="/settings" icon={<Settings className="size-4" />} label="Settings" onClick={() => setMenu(false)} />
            <MenuLink to="/help" icon={<LifeBuoy className="size-4" />} label="Help and Support" onClick={() => setMenu(false)} />
            <MenuLink to="/about" icon={<Info className="size-4" />} label="About ARTLink" onClick={() => setMenu(false)} />
            <MenuLink to="/privacy" icon={<Shield className="size-4" />} label="Privacy Policy" onClick={() => setMenu(false)} />
            <MenuLink to="/terms" icon={<ScrollText className="size-4" />} label="Terms and Conditions" onClick={() => setMenu(false)} />
            {me?.role === "admin" ? (
              <MenuLink to="/admin" icon={<Shield className="size-4" />} label="Admin Panel" onClick={() => setMenu(false)} />
            ) : null}
            {user && !gate ? (
              <button
                type="button"
                className="mt-2 inline-flex h-11 items-center gap-2 rounded-md px-2 text-sm hover:bg-surface-2"
                onClick={() => {
                  void signOut()
                    .then(() => {
                      window.location.href = "/";
                    })
                    .catch(() => undefined);
                }}
              >
                <LogOut className="size-4" /> Logout
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NavLink({ to, label, icon: Icon, path, compact }: { to: string; label: string; icon: typeof Home; path: string; compact?: boolean }) {
  const on = to === "/" ? path === "/" : path === to || path.startsWith(`${to}/`);
  return (
    <Link
      to={to}
      aria-current={on ? "page" : undefined}
      className={`flex items-center gap-2 rounded-md text-sm ${compact ? "h-14 flex-col justify-center gap-1 text-xs" : "h-11 px-2"} ${on ? "bg-surface-2 font-medium text-fg" : "text-muted hover:bg-surface-2 hover:text-fg"}`}
    >
      <Icon className="size-5" />
      {label}
    </Link>
  );
}

function MenuLink({ to, icon, label, onClick }: { to: string; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <Link to={to} onClick={onClick} className="inline-flex h-11 items-center gap-2 rounded-md px-2 text-sm hover:bg-surface-2">
      {icon}
      {label}
    </Link>
  );
}

export function RequireUser({ children }: { children: ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return <Spinner />;
  if (!user) return <RedirectToSignIn />;
  return children;
}
