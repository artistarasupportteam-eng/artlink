import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { getAnalytics, type AnalyticsBundle } from "@/lib/fns/api";
import { formatNumber } from "@/lib/format";
import { ActivityChart } from "@/components/chart";
import { AppShell, RequireUser } from "@/components/shell";
import { ErrorNote, Spinner } from "@/components/ui";

export const Route = createFileRoute("/analytics")({ component: AnalyticsPage });

function AnalyticsPage() {
  return (
    <AppShell>
      <RequireUser>
        <AnalyticsBody />
      </RequireUser>
    </AppShell>
  );
}

export function AnalyticsBody({ linkId }: { linkId?: string }) {
  const [data, setData] = useState<AnalyticsBundle | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    getAnalytics({ data: { id: linkId ?? "" } })
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load analytics."));
  }, [linkId]);
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data) return <Spinner />;
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-display text-3xl">{linkId ? "Link analytics" : "Analytics"}</h1>
        <p className="mt-1 text-sm text-muted">Views are page loads. Clicks are store, social, custom, and pre-save actions. Unique visitors are estimated from network and browser, not a signed-in identity. Country appears only when the host provides it.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Views" value={formatNumber(data.views)} />
        <Metric label="Clicks" value={formatNumber(data.clicks)} />
        <Metric label="Click-through" value={`${data.ctr}%`} />
        <Metric label="Email signups" value={formatNumber(data.emails)} />
      </div>
      <section id="overview" className="grid gap-2">
        <h2 className="font-display text-2xl">Daily activity</h2>
        <ActivityChart days={data.days} />
        <p className="text-xs text-muted">Brass bars are views. Stone bars are clicks. Last 14 days, UTC.</p>
      </section>
      <section id="audience" className="grid gap-3">
        <h2 className="font-display text-2xl">Audience</h2>
        <div className="grid grid-cols-2 gap-3">
          <Metric label="Estimated unique visitors" value={formatNumber(data.uniqueVisitors)} />
          <Metric label="Returning visitors" value={formatNumber(data.returning)} />
        </div>
        <Split title="Country" rows={data.countries} />
        <Split title="Device" rows={data.devices} />
      </section>
      {!linkId ? (
        <section className="grid gap-2">
          <h2 className="font-display text-2xl">By link type</h2>
          {data.byType.length === 0 ? <p className="text-sm text-muted">No links yet.</p> : null}
          {data.byType.map((row) => (
            <p key={row.type} className="text-sm">{row.type} · {row.links} links · {formatNumber(row.views)} views · {formatNumber(row.clicks)} clicks</p>
          ))}
        </section>
      ) : null}
      <section id="stores">
        <h2 className="font-display text-2xl">Music store clicks</h2>
        <Rows rows={data.stores} empty="No store clicks yet." />
      </section>
      <section id="social">
        <h2 className="font-display text-2xl">Social clicks</h2>
        <Rows rows={data.socials} empty="No social clicks yet." />
      </section>
      <section>
        <h2 className="font-display text-2xl">Custom link clicks</h2>
        <Rows rows={data.customs} empty="No custom link clicks yet." />
      </section>
      <section>
        <h2 className="font-display text-2xl">Pre-save clicks</h2>
        <p className="text-sm tabular-nums">{formatNumber(data.presaveClicks)}</p>
      </section>
      {!linkId ? <Link to="/audience" className="text-sm font-medium text-accent">Open audience</Link> : <Link to="/analytics" className="text-sm font-medium text-accent">All analytics</Link>}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 font-display text-2xl tabular-nums">{value}</p>
    </div>
  );
}

function Rows({ rows, empty }: { rows: { name: string; clicks: number }[]; empty: string }) {
  if (!rows.length) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <ul className="mt-2 grid gap-1">
      {rows.map((row) => (
        <li key={row.name} className="flex justify-between text-sm"><span>{row.name}</span><span className="tabular-nums">{formatNumber(row.clicks)}</span></li>
      ))}
    </ul>
  );
}

function Split({ title, rows }: { title: string; rows: { name: string; visitors: number }[] }) {
  return (
    <div>
      <h3 className="text-sm font-medium">{title}</h3>
      {rows.length === 0 ? <p className="text-sm text-muted">No visits yet.</p> : (
        <ul className="mt-1 grid gap-1">
          {rows.map((row) => (
            <li key={row.name} className="flex justify-between text-sm"><span>{row.name}</span><span className="tabular-nums">{formatNumber(row.visitors)}</span></li>
          ))}
        </ul>
      )}
    </div>
  );
}
