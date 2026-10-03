import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, LifeBuoy, LogOut, ScrollText, Settings, Shield, SunMoon, UserRound } from "lucide-react";
import { signOut } from "@/lib/auth/client";
import { hasGateSessionMarker } from "@/lib/auth/gate-session-marker";
import { getMe } from "@/lib/fns/api";
import type { Me } from "@/lib/model";
import { AppShell, RequireUser } from "@/components/shell";
import { Spinner } from "@/components/ui";

export const Route = createFileRoute("/profile")({ component: ProfilePage });
const subscribe = () => () => {};

function ProfilePage() {
  return (
    <AppShell>
      <RequireUser>
        <ProfileBody />
      </RequireUser>
    </AppShell>
  );
}

function ProfileBody() {
  const [me, setMe] = useState<Me | null>(null);
  const gate = useSyncExternalStore(subscribe, hasGateSessionMarker, () => false);
  useEffect(() => {
    getMe().then(setMe).catch(() => undefined);
  }, []);
  if (!me) return <Spinner />;
  const photo = me.avatarUrl || me.image;
  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3">
        {photo ? <img src={photo} alt="" className="size-16 rounded-lg object-cover" /> : <span className="grid size-16 place-items-center rounded-lg bg-surface-2 font-display text-2xl">{(me.artistName || me.name || "A").slice(0, 1)}</span>}
        <div>
          <h1 className="font-display text-3xl">{me.artistName || me.name || "Artist"}</h1>
          <p className="text-sm text-muted">{me.username ? `@${me.username}` : me.email}</p>
        </div>
      </div>
      {me.about ? <p className="text-sm text-muted">{me.about}</p> : <p className="text-sm text-muted">Add a short bio on your artist profile.</p>}
      <div className="grid gap-1">
        <Row to="/artist" icon={<UserRound className="size-4" />} label="Edit Profile" />
        <Row to="/settings" icon={<Settings className="size-4" />} label="Account Settings" />
        <Row to="/notifications" icon={<Bell className="size-4" />} label="Notifications" />
        <Row to="/privacy" icon={<Shield className="size-4" />} label="Privacy Policy" />
        <Row to="/terms" icon={<ScrollText className="size-4" />} label="Terms and Conditions" />
        <Row to="/help" icon={<LifeBuoy className="size-4" />} label="Help and Support" />
        <Row to="/settings" icon={<SunMoon className="size-4" />} label="Theme preference" />
      </div>
      {!gate ? (
        <button type="button" className="inline-flex h-11 items-center gap-2 text-sm" onClick={() => void signOut().then(() => { window.location.href = "/"; })}>
          <LogOut className="size-4" /> Logout
        </button>
      ) : null}
      <Link to="/settings" className="text-sm text-danger">Delete Account</Link>
    </div>
  );
}

function Row({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
  return (
    <Link to={to} className="inline-flex h-11 items-center gap-2 rounded-md px-1 text-sm hover:bg-surface">
      {icon} {label}
    </Link>
  );
}
