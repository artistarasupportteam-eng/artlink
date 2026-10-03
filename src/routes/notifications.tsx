import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { listNotifications, markAllNotificationsRead, markNotificationRead } from "@/lib/fns/api";
import { formatWhen } from "@/lib/format";
import { AppShell, RequireUser } from "@/components/shell";
import { Button, EmptyState, ErrorNote, Spinner } from "@/components/ui";

export const Route = createFileRoute("/notifications")({ component: NotesPage });

type Note = { id: string; title: string; body: string; imageUrl: string; destUrl: string; createdAt: string; read: boolean };

function NotesPage() {
  return (
    <AppShell>
      <RequireUser>
        <NotesBody />
      </RequireUser>
    </AppShell>
  );
}

function NotesBody() {
  const [rows, setRows] = useState<Note[] | null>(null);
  const [error, setError] = useState("");
  const load = () => listNotifications().then(setRows).catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load notifications."));
  useEffect(() => { load(); }, []);
  const open = (note: Note) => {
    markNotificationRead({ data: { id: note.id } }).then(load).catch(() => undefined);
    if (!note.destUrl) return;
    window.location.href = note.destUrl;
  };
  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-3xl">Notifications</h1>
        <Button type="button" onClick={() => markAllNotificationsRead().then(load).catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not update."))}>Mark all as read</Button>
      </div>
      <ErrorNote>{error}</ErrorNote>
      {!rows && !error ? <Spinner /> : null}
      {rows && rows.length === 0 ? <EmptyState title="You’re caught up" body="Platform announcements from ARTLink show up here." /> : null}
      <div className="grid gap-2">
        {rows?.map((note) => (
          <button key={note.id} type="button" onClick={() => open(note)} className={`rounded-lg border border-border p-3 text-left ${note.read ? "bg-bg" : "bg-surface"}`}>
            {note.imageUrl ? <img src={note.imageUrl} alt="" className="mb-2 max-h-36 w-full rounded-md object-cover" /> : null}
            <span className="block font-medium">{note.title}</span>
            <span className="mt-1 block text-sm text-muted">{note.body}</span>
            <span className="mt-2 block text-xs text-muted">{formatWhen(note.createdAt)}{note.read ? "" : " · Unread"}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
