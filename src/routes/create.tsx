import { useState, type ReactNode } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CalendarPlus, Disc3, IdCard } from "lucide-react";
import { createDraft } from "@/lib/fns/api";
import { AppShell, RequireUser } from "@/components/shell";
import { ErrorNote } from "@/components/ui";

export const Route = createFileRoute("/create")({ component: CreatePage });

function CreatePage() {
  return (
    <AppShell>
      <RequireUser>
        <CreateBody />
      </RequireUser>
    </AppShell>
  );
}

function CreateBody() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const start = (type: "smart" | "presave" | "bio") => {
    setBusy(type);
    setError("");
    createDraft({ data: { type } })
      .then((result) => navigate({ to: "/edit/$id", params: { id: result.id } }))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not start that link."))
      .finally(() => setBusy(""));
  };
  return (
    <div className="grid gap-4">
      <h1 className="font-display text-3xl">Create</h1>
      <p className="text-muted">Choose one link type. You can save a draft and publish when it is ready.</p>
      <ErrorNote>{error}</ErrorNote>
      <div className="grid gap-3">
        <Choice icon={<Disc3 className="size-5" />} title="Smart Link" body="For a song that is already out. Artwork, store buttons, socials, and optional email signup." disabled={busy !== ""} onClick={() => start("smart")} />
        <Choice icon={<CalendarPlus className="size-5" />} title="Pre-Save Link" body="For a song that is not out yet. Release date, a pre-save button, and optional extra stores." disabled={busy !== ""} onClick={() => start("presave")} />
        <Choice icon={<IdCard className="size-5" />} title="Bio Link" body="An artist landing page: identity, music, socials, custom links, and a gallery." disabled={busy !== ""} onClick={() => start("bio")} />
      </div>
    </div>
  );
}

function Choice({ icon, title, body, onClick, disabled }: { icon: ReactNode; title: string; body: string; onClick: () => void; disabled: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className="flex gap-3 rounded-lg border border-border bg-surface p-4 text-left hover:bg-surface-2 disabled:opacity-60">
      <span className="text-accent">{icon}</span>
      <span>
        <span className="block font-medium">{title}</span>
        <span className="mt-1 block text-sm text-muted">{body}</span>
      </span>
    </button>
  );
}
