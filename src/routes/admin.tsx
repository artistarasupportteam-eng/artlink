import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  adminDeleteAd,
  adminDeleteNotification,
  adminGetSettings,
  adminListAds,
  adminListCatalog,
  adminListLinks,
  adminListNotifications,
  adminListReports,
  adminListUsers,
  adminModerateLink,
  adminOverview,
  adminResolveReport,
  adminSaveAd,
  adminSaveNotification,
  adminSaveSettings,
  adminSaveStore,
  adminSetUser,
  claimAdmin,
  getMe,
} from "@/lib/fns/api";
import { formatNumber, formatWhen } from "@/lib/format";
import { readArtwork, readVideo } from "@/lib/media";
import { AppShell, RequireUser } from "@/components/shell";
import { ActivityChart } from "@/components/chart";
import { Button, ErrorNote, Field, Spinner, areaClass, inputClass } from "@/components/ui";

export const Route = createFileRoute("/admin")({ component: AdminPage });

const TABS = ["Overview", "Users", "Links", "Ads", "Notifications", "Catalog", "Settings", "Reports"] as const;

function AdminPage() {
  return (
    <AppShell>
      <RequireUser>
        <AdminGate />
      </RequireUser>
    </AppShell>
  );
}

function AdminGate() {
  const [state, setState] = useState<"loading" | "admin" | "claim" | "denied">("loading");
  const [error, setError] = useState("");
  useEffect(() => {
    getMe().then((me) => setState(me.role === "admin" ? "admin" : me.adminExists ? "denied" : "claim")).catch(() => setState("denied"));
  }, []);
  if (state === "loading") return <Spinner />;
  if (state === "claim") {
    return (
      <div className="grid max-w-lg gap-3">
        <h1 className="font-display text-3xl">Administrator setup</h1>
        <p className="text-sm text-muted">No administrator exists. Claiming this role gives you server-checked control of users, links, ads, and announcements. Only the operator of ARTLink should continue.</p>
        <ErrorNote>{error}</ErrorNote>
        <Button variant="primary" onClick={() => claimAdmin().then(() => setState("admin")).catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not claim."))}>Claim administrator</Button>
      </div>
    );
  }
  if (state === "denied") return <p className="text-sm">Administrator access required.</p>;
  return <AdminPanel />;
}

function AdminPanel() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  return (
    <div className="grid gap-4">
      <h1 className="font-display text-3xl">Admin Panel</h1>
      <div className="flex gap-2 overflow-x-auto">
        {TABS.map((item) => (
          <button key={item} type="button" onClick={() => setTab(item)} className={`h-10 shrink-0 rounded-md px-3 text-sm ${tab === item ? "bg-accent text-accent-fg" : "bg-surface text-muted"}`}>{item}</button>
        ))}
      </div>
      {tab === "Overview" ? <Overview /> : null}
      {tab === "Users" ? <Users /> : null}
      {tab === "Links" ? <Links /> : null}
      {tab === "Ads" ? <Ads /> : null}
      {tab === "Notifications" ? <Notes /> : null}
      {tab === "Catalog" ? <Catalog /> : null}
      {tab === "Settings" ? <Settings /> : null}
      {tab === "Reports" ? <Reports /> : null}
    </div>
  );
}

function Overview() {
  const [data, setData] = useState<Awaited<ReturnType<typeof adminOverview>> | null>(null);
  useEffect(() => { adminOverview().then(setData).catch(() => undefined); }, []);
  if (!data) return <Spinner />;
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Registered users" value={formatNumber(data.users)} />
        <Stat label="Published links" value={formatNumber(data.published)} />
        <Stat label="Ad impressions" value={formatNumber(data.impressions)} />
        <Stat label="Ad clicks" value={formatNumber(data.adClicks)} />
      </div>
      <p className="text-sm text-muted">Smart {data.smart} · Pre-save {data.presave} · Bio {data.bio}</p>
      <h2 className="font-display text-2xl">Platform activity</h2>
      <ActivityChart days={data.days.map((day) => ({ day: day.day, views: day.n, clicks: 0 }))} />
      <h2 className="font-display text-2xl">Recent administrative activity</h2>
      <ul className="grid gap-1 text-sm">
        {data.audit.length === 0 ? <li className="text-muted">No admin actions yet.</li> : null}
        {data.audit.map((item, index) => (
          <li key={`${item.createdAt}-${index}`}>{formatWhen(item.createdAt)} · {item.email} · {item.action} · {item.detail}</li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-border bg-surface p-3"><p className="text-xs text-muted">{label}</p><p className="font-display text-2xl tabular-nums">{value}</p></div>;
}

function Users() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Awaited<ReturnType<typeof adminListUsers>>>([]);
  const [error, setError] = useState("");
  const load = () => adminListUsers({ data: { q } }).then(setRows).catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load users."));
  useEffect(() => { load(); }, [q]);
  const act = (userId: string, action: string) => {
    const reason = action === "suspend" ? window.prompt("Reason for suspension") ?? "" : "";
    if (action === "delete" && !window.confirm("Delete this account and its links?")) return;
    adminSetUser({ data: { userId, action, reason } }).then(load).catch((err: unknown) => setError(err instanceof Error ? err.message : "Action failed."));
  };
  return (
    <div className="grid gap-3">
      <input className={inputClass} placeholder="Search users" value={q} onChange={(event) => setQ(event.target.value)} aria-label="Search users" />
      <ErrorNote>{error}</ErrorNote>
      {rows.map((user) => (
        <article key={user.id} className="rounded-lg border border-border bg-surface p-3 text-sm">
          <p className="font-medium">{user.artistName || user.name || user.email}</p>
          <p className="text-muted">{user.email} · {user.role} · {user.links} links · {user.suspended ? "suspended" : "active"}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="button" onClick={() => act(user.id, user.suspended ? "restore" : "suspend")}>{user.suspended ? "Restore" : "Suspend"}</Button>
            <Button type="button" onClick={() => act(user.id, user.role === "admin" ? "demote" : "promote")}>{user.role === "admin" ? "Remove admin" : "Make admin"}</Button>
            <Button type="button" variant="danger" onClick={() => act(user.id, "delete")}>Delete</Button>
          </div>
        </article>
      ))}
    </div>
  );
}

function Links() {
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [rows, setRows] = useState<Awaited<ReturnType<typeof adminListLinks>>>([]);
  const [error, setError] = useState("");
  const load = () => adminListLinks({ data: { q, type } }).then(setRows).catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load links."));
  useEffect(() => { load(); }, [q, type]);
  const act = (id: string, action: string) => {
    if (action === "delete" && !window.confirm("Delete this link?")) return;
    adminModerateLink({ data: { id, action } }).then(load).catch((err: unknown) => setError(err instanceof Error ? err.message : "Action failed."));
  };
  return (
    <div className="grid gap-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <input className={inputClass} placeholder="Search links" value={q} onChange={(event) => setQ(event.target.value)} aria-label="Search links" />
        <select className={inputClass} value={type} aria-label="Link type" onChange={(event) => setType(event.target.value)}>
          <option value="all">All</option>
          <option value="smart">Smart</option>
          <option value="presave">Pre-save</option>
          <option value="bio">Bio</option>
        </select>
      </div>
      <ErrorNote>{error}</ErrorNote>
      {rows.map((link) => (
        <article key={link.id} className="rounded-lg border border-border bg-surface p-3 text-sm">
          <p className="font-medium">{link.title}</p>
          <p className="text-muted">{link.email} · {link.type} · {link.status} · {link.views} views · {link.clicks} clicks</p>
          <p className="text-xs text-muted">/l/{link.slug}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="button" onClick={() => act(link.id, "unpublish")}>Unpublish</Button>
            <Button type="button" onClick={() => act(link.id, "restore")}>Restore</Button>
            <Button type="button" variant="danger" onClick={() => act(link.id, "delete")}>Delete</Button>
          </div>
        </article>
      ))}
    </div>
  );
}

function Ads() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof adminListAds>>>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ id: "", kind: "banner", name: "", advertiser: "", destUrl: "", placement: "home_quick", imageUrl: "", videoUrl: "", startsAt: "", endsAt: "", active: false });
  const load = () => adminListAds().then(setRows).catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load ads."));
  useEffect(() => { load(); }, []);
  const set = (partial: Partial<typeof form>) => setForm((current) => ({ ...current, ...partial }));
  return (
    <div className="grid gap-4">
      <ErrorNote>{error}</ErrorNote>
      <form className="grid gap-3 rounded-lg border border-border bg-surface p-4" onSubmit={(event) => {
        event.preventDefault();
        adminSaveAd({ data: form }).then(() => { toast.success("Advertisement saved"); setForm({ id: "", kind: "banner", name: "", advertiser: "", destUrl: "", placement: "home_quick", imageUrl: "", videoUrl: "", startsAt: "", endsAt: "", active: false }); load(); }).catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not save ad."));
      }}>
        <h2 className="font-medium">{form.id ? "Edit advertisement" : "New advertisement"}</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Name"><input className={inputClass} value={form.name} onChange={(event) => set({ name: event.target.value })} /></Field>
          <Field label="Advertiser"><input className={inputClass} value={form.advertiser} onChange={(event) => set({ advertiser: event.target.value })} /></Field>
        </div>
        <Field label="Destination URL"><input className={inputClass} value={form.destUrl} onChange={(event) => set({ destUrl: event.target.value })} /></Field>
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Type">
            <select className={inputClass} value={form.kind} onChange={(event) => set({ kind: event.target.value, placement: event.target.value === "video" ? "public_video" : "home_quick" })}>
              <option value="banner">Banner</option>
              <option value="video">Video</option>
            </select>
          </Field>
          <Field label="Placement">
            <select className={inputClass} value={form.placement} onChange={(event) => set({ placement: event.target.value })}>
              <option value="home_quick">Home, after quick create</option>
              <option value="public_footer">Public page footer</option>
              <option value="public_video">Public page video</option>
            </select>
          </Field>
        </div>
        {form.kind === "banner" ? (
          <Field label="Banner image">
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              readArtwork(file).then((imageUrl) => set({ imageUrl })).catch((err: unknown) => setError(err instanceof Error ? err.message : "Image failed."));
            }} />
          </Field>
        ) : (
          <>
            <Field label="Video file">
              <input type="file" accept="video/mp4,video/webm" onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                readVideo(file, 4_000_000).then((videoUrl) => set({ videoUrl })).catch((err: unknown) => setError(err instanceof Error ? err.message : "Video failed."));
              }} />
            </Field>
            <Field label="Or HTTPS video URL"><input className={inputClass} value={form.videoUrl.startsWith("http") ? form.videoUrl : ""} onChange={(event) => set({ videoUrl: event.target.value })} /></Field>
          </>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Starts (UTC)"><input className={inputClass} type="datetime-local" value={form.startsAt} onChange={(event) => set({ startsAt: event.target.value })} /></Field>
          <Field label="Ends (UTC)"><input className={inputClass} type="datetime-local" value={form.endsAt} onChange={(event) => set({ endsAt: event.target.value })} /></Field>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(event) => set({ active: event.target.checked })} /> Active</label>
        {form.imageUrl ? <img src={form.imageUrl} alt="" className="max-h-32 rounded-md object-cover" /> : null}
        <Button type="submit" variant="primary">Save advertisement</Button>
      </form>
      {rows.map((ad) => (
        <article key={ad.id} className="rounded-lg border border-border p-3 text-sm">
          <p className="font-medium">{ad.name} · {ad.advertiser}</p>
          <p className="text-muted">{ad.kind} · {ad.placement} · {ad.active ? "active" : "inactive"} · {ad.impressions} impressions · {ad.clicks} clicks</p>
          <div className="mt-2 flex gap-2">
            <Button type="button" onClick={() => setForm({ id: ad.id, kind: ad.kind, name: ad.name, advertiser: ad.advertiser, destUrl: ad.destUrl, placement: ad.placement, imageUrl: ad.imageUrl, videoUrl: ad.videoUrl, startsAt: ad.startsAt, endsAt: ad.endsAt, active: ad.active })}>Edit</Button>
            <Button type="button" variant="danger" onClick={() => adminDeleteAd({ data: { id: ad.id } }).then(load)}>Delete</Button>
          </div>
        </article>
      ))}
    </div>
  );
}

function Notes() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof adminListNotifications>>>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ id: "", title: "", body: "", imageUrl: "", destUrl: "", published: false, startsAt: "" });
  const load = () => adminListNotifications().then(setRows).catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load notifications."));
  useEffect(() => { load(); }, []);
  const set = (partial: Partial<typeof form>) => setForm((current) => ({ ...current, ...partial }));
  return (
    <div className="grid gap-4">
      <ErrorNote>{error}</ErrorNote>
      <form className="grid gap-3 rounded-lg border border-border bg-surface p-4" onSubmit={(event) => {
        event.preventDefault();
        adminSaveNotification({ data: form }).then(() => { toast.success(form.published ? "Notification published" : "Notification saved"); setForm({ id: "", title: "", body: "", imageUrl: "", destUrl: "", published: false, startsAt: "" }); load(); }).catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not save."));
      }}>
        <h2 className="font-medium">Platform notification</h2>
        <Field label="Title"><input className={inputClass} value={form.title} onChange={(event) => set({ title: event.target.value })} /></Field>
        <Field label="Content"><textarea className={areaClass} value={form.body} onChange={(event) => set({ body: event.target.value })} /></Field>
        <Field label="Optional image"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) readArtwork(file).then((imageUrl) => set({ imageUrl })).catch((err: unknown) => setError(err instanceof Error ? err.message : "Image failed.")); }} /></Field>
        <Field label="Optional destination"><input className={inputClass} value={form.destUrl} onChange={(event) => set({ destUrl: event.target.value })} placeholder="/help or https://" /></Field>
        <Field label="Show after (UTC)"><input className={inputClass} type="datetime-local" value={form.startsAt} onChange={(event) => set({ startsAt: event.target.value })} /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.published} onChange={(event) => set({ published: event.target.checked })} /> Published</label>
        {form.title ? <div className="rounded-md border border-border p-3 text-sm"><p className="text-xs uppercase text-muted">Preview</p><p className="font-medium">{form.title}</p><p className="text-muted">{form.body}</p></div> : null}
        <Button type="submit" variant="primary">Save notification</Button>
      </form>
      {rows.map((note) => (
        <article key={note.id} className="rounded-lg border border-border p-3 text-sm">
          <p className="font-medium">{note.title}</p>
          <p className="text-muted">{note.published ? "Published" : "Unpublished"} · {formatWhen(note.createdAt)}</p>
          <div className="mt-2 flex gap-2">
            <Button type="button" onClick={() => setForm(note)}>Edit</Button>
            <Button type="button" onClick={() => adminSaveNotification({ data: { ...note, published: !note.published } }).then(load)}>{note.published ? "Unpublish" : "Publish"}</Button>
            <Button type="button" variant="danger" onClick={() => adminDeleteNotification({ data: { id: note.id } }).then(load)}>Delete</Button>
          </div>
        </article>
      ))}
    </div>
  );
}

function Catalog() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof adminListCatalog>>>([]);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("store");
  const [color, setColor] = useState("#3c4046");
  const [error, setError] = useState("");
  const load = () => adminListCatalog().then(setRows).catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load catalog."));
  useEffect(() => { load(); }, []);
  return (
    <div className="grid gap-3">
      <ErrorNote>{error}</ErrorNote>
      <form className="grid gap-2 sm:grid-cols-[1fr_8rem_8rem_auto]" onSubmit={(event) => {
        event.preventDefault();
        adminSaveStore({ data: { name, kind, color, ink: "light", glyph: "mono", enabled: true } }).then(() => { setName(""); load(); }).catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not add store."));
      }}>
        <input className={inputClass} placeholder="Custom store or social name" value={name} onChange={(event) => setName(event.target.value)} aria-label="Name" />
        <select className={inputClass} value={kind} onChange={(event) => setKind(event.target.value)} aria-label="Kind"><option value="store">Store</option><option value="social">Social</option></select>
        <input className={inputClass} value={color} onChange={(event) => setColor(event.target.value)} aria-label="Color" />
        <Button type="submit">Add</Button>
      </form>
      <div className="grid gap-2">
        {rows.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-2 text-sm">
            <span>{item.name} · {item.kind}{item.enabled ? "" : " · hidden"}</span>
            <span className="flex gap-2">
              <button type="button" className="text-accent" onClick={() => adminSaveStore({ data: { id: item.id, name: item.name, kind: item.kind, color: item.color, ink: item.ink, glyph: item.glyph, enabled: !item.enabled } }).then(load)}> {item.enabled ? "Disable" : "Enable"}</button>
              {item.custom ? <button type="button" className="text-danger" onClick={() => adminSaveStore({ data: { action: "delete", id: item.id } }).then(load)}>Delete</button> : null}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Settings() {
  const [form, setForm] = useState({ name: "", tagline: "", support: "", help: "", image: 1200000, video: 4000000 });
  const [error, setError] = useState("");
  useEffect(() => {
    adminGetSettings().then((caps) => setForm({ name: caps.name, tagline: caps.tagline, support: caps.support, help: caps.help, image: caps.image, video: caps.video })).catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load settings."));
  }, []);
  return (
    <form className="grid max-w-xl gap-3" onSubmit={(event) => {
      event.preventDefault();
      adminSaveSettings({ data: form }).then(() => toast.success("Settings saved")).catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not save."));
    }}>
      <ErrorNote>{error}</ErrorNote>
      <Field label="Platform name"><input className={inputClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
      <Field label="Tagline"><input className={inputClass} value={form.tagline} onChange={(event) => setForm({ ...form, tagline: event.target.value })} /></Field>
      <Field label="Support email"><input className={inputClass} value={form.support} onChange={(event) => setForm({ ...form, support: event.target.value })} /></Field>
      <Field label="Help text"><textarea className={areaClass} value={form.help} onChange={(event) => setForm({ ...form, help: event.target.value })} /></Field>
      <Field label="Image limit (bytes)"><input className={inputClass} type="number" value={form.image} onChange={(event) => setForm({ ...form, image: Number(event.target.value) })} /></Field>
      <Field label="Video limit (bytes)"><input className={inputClass} type="number" value={form.video} onChange={(event) => setForm({ ...form, video: Number(event.target.value) })} /></Field>
      <Button type="submit" variant="primary">Save settings</Button>
    </form>
  );
}

function Reports() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof adminListReports>>>([]);
  useEffect(() => { adminListReports().then(setRows).catch(() => undefined); }, []);
  return (
    <div className="grid gap-2">
      {rows.length === 0 ? <p className="text-sm text-muted">No support messages.</p> : null}
      {rows.map((row) => (
        <article key={row.id} className="rounded-lg border border-border bg-surface p-3 text-sm">
          <p className="font-medium">{row.subject}</p>
          <p className="text-muted">{row.email} · {row.status} · {formatWhen(row.createdAt)}</p>
          <p className="mt-1 whitespace-pre-wrap">{row.body}</p>
          {row.status !== "resolved" ? <Button className="mt-2" type="button" onClick={() => adminResolveReport({ data: { id: row.id } }).then(() => adminListReports().then(setRows))}>Mark resolved</Button> : null}
        </article>
      ))}
    </div>
  );
}
