import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarPlus, Disc3, IdCard, Plus } from "lucide-react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { createDraft, getDashboard, getHomeAd, getPublicSettings } from "@/lib/fns/api";
import { formatNumber, formatWhen } from "@/lib/format";
import { typeLabel } from "@/lib/model";
import { AdSlot, type AdView } from "@/components/ads";
import { AppShell } from "@/components/shell";
import { Button } from "@/components/ui";

export const Route = createFileRoute("/")({ component: HomePage });

function HomePage() {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [tagline, setTagline] = useState("Smart links for released songs, upcoming music, and artist pages.");
  const [stats, setStats] = useState<{ views: number; clicks: number; published: number; audience: number; recent: { id: string; title: string; type: "smart" | "presave" | "bio"; status: string; coverUrl: string; views: number; clicks: number; updatedAt: string }[]; activity: { message: string; href: string; createdAt: string }[] } | null>(null);
  const [ad, setAd] = useState<AdView | null>(null);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    getPublicSettings().then((settings) => setTagline(settings.tagline || tagline)).catch(() => undefined);
    getHomeAd().then(setAd).catch(() => setAd(null));
  }, []);

  useEffect(() => {
    if (!user) return;
    getDashboard().then(setStats).catch(() => undefined);
  }, [user?.id]);

  const start = (type: "smart" | "presave" | "bio") => {
    if (!user) {
      void navigate({ to: "/login" });
      return;
    }
    setBusy(type);
    createDraft({ data: { type } })
      .then((result) => navigate({ to: "/edit/$id", params: { id: result.id } }))
      .catch(() => setBusy(""))
      .finally(() => setBusy(""));
  };

  const name = user?.displayName || "Artist";

  return (
    <AppShell>
      <div className="grid gap-6">
        <section className="grid gap-2">
          <h1 className="font-display text-3xl md:text-4xl">{user ? `Welcome back, ${name.split(" ")[0]}.` : "Welcome to ARTLink."}</h1>
          <p className="max-w-2xl text-muted">{tagline} Artists send listeners to the stores where the music already lives. ARTLink does not host songs.</p>
        </section>
        <Button variant="primary" className="w-full sm:w-auto" disabled={isPending || busy !== ""} onClick={() => void navigate({ to: user ? "/create" : "/login" })}>
          <Plus className="size-4" /> Create New Link
        </Button>
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Total Views" value={user ? formatNumber(stats?.views ?? 0) : "—"} />
          <Stat label="Total Clicks" value={user ? formatNumber(stats?.clicks ?? 0) : "—"} />
          <Stat label="Published Links" value={user ? formatNumber(stats?.published ?? 0) : "—"} />
          <Stat label="Audience" value={user ? formatNumber(stats?.audience ?? 0) : "—"} />
        </section>
        {!user && !isPending ? <p className="text-sm text-muted">Sign in to see your own numbers. Nothing here is sample data.</p> : null}
        <section className="grid gap-3 md:grid-cols-3">
          <Quick icon={<Disc3 className="size-5" />} title="Smart Link" body="A released song, with store buttons." busy={busy === "smart"} onClick={() => start("smart")} />
          <Quick icon={<CalendarPlus className="size-5" />} title="Pre-Save Link" body="An upcoming release and a pre-save action." busy={busy === "presave"} onClick={() => start("presave")} />
          <Quick icon={<IdCard className="size-5" />} title="Bio Link" body="Your artist page, music, and socials." busy={busy === "bio"} onClick={() => start("bio")} />
        </section>
        <AdSlot ad={ad} />
        <section className="grid gap-3">
          <h2 className="font-display text-2xl">Recent Links</h2>
          {user && stats && stats.recent.length === 0 ? <p className="text-sm text-muted">No links yet.</p> : null}
          {!user ? <p className="text-sm text-muted">Your links will show up here after you sign in.</p> : null}
          <div className="grid gap-2">
            {stats?.recent.map((link) => (
              <Link key={link.id} to="/edit/$id" params={{ id: link.id }} className="flex items-center gap-3 rounded-lg border border-border bg-surface p-2">
                {link.coverUrl ? <img src={link.coverUrl} alt="" className="size-14 rounded-md object-cover" /> : <span className="size-14 rounded-md bg-surface-2" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{link.title}</span>
                  <span className="text-xs text-muted">{typeLabel(link.type)} · {link.status} · {formatNumber(link.views)} views</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
        <section className="grid gap-2">
          <h2 className="font-display text-2xl">Recent Activity</h2>
          {user && stats && stats.activity.length === 0 ? <p className="text-sm text-muted">No activity yet.</p> : null}
          {!user ? <p className="text-sm text-muted">Publishes, saves, and edits are listed here.</p> : null}
          <ul className="grid gap-2">
            {stats?.activity.map((item, index) => (
              <li key={`${item.createdAt}-${index}`} className="flex items-baseline justify-between gap-3 text-sm">
                <span>{item.message}</span>
                <span className="shrink-0 text-xs text-muted">{formatWhen(item.createdAt)}</span>
              </li>
            ))}
          </ul>
        </section>
        <Link to="/library" className="text-sm font-medium text-accent">View All Links</Link>
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 font-display text-2xl tabular-nums">{value}</p>
    </div>
  );
}

function Quick({ icon, title, body, onClick, busy }: { icon: ReactNode; title: string; body: string; onClick: () => void; busy: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={busy} className="rounded-lg border border-border bg-surface p-4 text-left hover:bg-surface-2 disabled:opacity-60">
      <span className="text-accent">{icon}</span>
      <span className="mt-3 block font-medium">{title}</span>
      <span className="mt-1 block text-sm text-muted">{body}</span>
    </button>
  );
}
