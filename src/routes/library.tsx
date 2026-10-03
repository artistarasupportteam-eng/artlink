import { useEffect, useState, type ReactNode } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { BarChart3, Copy, Eye, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteLink, listLinks, setLinkStatus } from "@/lib/fns/api";
import { formatNumber, formatWhen } from "@/lib/format";
import { publicPath, typeLabel, type LinkSummary } from "@/lib/model";
import { AppShell, RequireUser } from "@/components/shell";
import { Button, EmptyState, ErrorNote, Modal, inputClass } from "@/components/ui";

export const Route = createFileRoute("/library")({ component: LibraryPage });

function LibraryPage() {
  return (
    <AppShell>
      <RequireUser>
        <LibraryBody />
      </RequireUser>
    </AppShell>
  );
}

function LibraryBody() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("updated");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<LinkSummary[]>([]);
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<LinkSummary | null>(null);

  const load = () => {
    listLinks({ data: { tab, status, q, sort } })
      .then(setRows)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load links."));
  };

  useEffect(() => {
    load();
  }, [tab, status, q, sort]);

  const copy = async (row: LinkSummary) => {
    const url = `${window.location.origin}${publicPath(row.slug)}`;
    await navigator.clipboard.writeText(url);
    toast.success(row.status === "published" || row.status === "scheduled" ? "Link copied" : "Copied. Publish the link before it is public.");
  };

  return (
    <div className="grid gap-4">
      <h1 className="font-display text-3xl">Library</h1>
      <div className="flex flex-wrap gap-2">
        {[
          ["all", "All Links"],
          ["smart", "Smart Links"],
          ["presave", "Pre-Save Links"],
          ["bio", "Bio Links"],
        ].map(([id, label]) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={`h-10 rounded-md px-3 text-sm ${tab === id ? "bg-accent text-accent-fg" : "bg-surface text-muted"}`}>{label}</button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <input className={inputClass} placeholder="Search" value={q} onChange={(event) => setQ(event.target.value)} aria-label="Search links" />
        <select className={inputClass} value={status} aria-label="Status" onChange={(event) => setStatus(event.target.value)}>
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="unpublished">Unpublished</option>
          <option value="scheduled">Scheduled</option>
        </select>
        <select className={inputClass} value={sort} aria-label="Sort" onChange={(event) => setSort(event.target.value)}>
          <option value="updated">Recently updated</option>
          <option value="created">Newest</option>
          <option value="title">Title</option>
          <option value="views">Views</option>
          <option value="clicks">Clicks</option>
        </select>
      </div>
      <ErrorNote>{error}</ErrorNote>
      {rows.length === 0 ? <EmptyState title="Nothing in this view" body="Create a smart link, pre-save, or bio link to fill the library." /> : null}
      <div className="grid gap-3">
        {rows.map((row) => (
          <article key={row.id} className="grid gap-3 rounded-lg border border-border bg-surface p-3 sm:grid-cols-[auto_1fr]">
            {row.coverUrl ? <img src={row.coverUrl} alt="" className="size-16 rounded-md object-cover" /> : <span className="size-16 rounded-md bg-surface-2" />}
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-2">
                <h2 className="font-medium">{row.title}</h2>
                <span className="text-xs text-muted">{typeLabel(row.type)} · {row.status}</span>
              </div>
              <p className="text-xs text-muted">Created {formatWhen(row.createdAt)} · {formatNumber(row.views)} views · {formatNumber(row.clicks)} clicks</p>
              <p className="truncate text-xs text-muted">{publicPath(row.slug)}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                <IconAct label="Copy URL" onClick={() => void copy(row)}><Copy className="size-4" /></IconAct>
                <IconAct label="Preview" onClick={() => void navigate({ to: "/preview/$id", params: { id: row.id } })}><Eye className="size-4" /></IconAct>
                <IconAct label="Edit" onClick={() => void navigate({ to: "/edit/$id", params: { id: row.id } })}><Pencil className="size-4" /></IconAct>
                <IconAct label="Analytics" onClick={() => void navigate({ to: "/analytics/$id", params: { id: row.id } })}><BarChart3 className="size-4" /></IconAct>
                <Button type="button" className="h-10" onClick={() => {
                  const next = row.status === "published" || row.status === "scheduled" ? "unpublished" : "published";
                  setLinkStatus({ data: { id: row.id, status: next } }).then(load).catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not update status."));
                }}>{row.status === "published" || row.status === "scheduled" ? "Unpublish" : "Publish"}</Button>
                <IconAct label="Delete" onClick={() => setPendingDelete(row)}><Trash2 className="size-4" /></IconAct>
              </div>
            </div>
          </article>
        ))}
      </div>
      <Modal open={Boolean(pendingDelete)} title="Delete this link?" onClose={() => setPendingDelete(null)}>
        <p>This removes “{pendingDelete?.title}”, its public URL, and its analytics. This cannot be undone.</p>
        <div className="mt-4 flex gap-2">
          <Button variant="danger" onClick={() => {
            if (!pendingDelete) return;
            deleteLink({ data: { id: pendingDelete.id } }).then(() => {
              setPendingDelete(null);
              load();
            }).catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not delete."));
          }}>Delete</Button>
          <Button onClick={() => setPendingDelete(null)}>Cancel</Button>
        </div>
      </Modal>
      <Link to="/create" className="text-sm font-medium text-accent">Create a link</Link>
    </div>
  );
}

function IconAct({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="grid size-10 place-items-center rounded-md border border-border">
      {children}
    </button>
  );
}
