import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { listEmails } from "@/lib/fns/api";
import { formatWhen } from "@/lib/format";
import { typeLabel } from "@/lib/model";
import { AppShell, RequireUser } from "@/components/shell";
import { Button, EmptyState, ErrorNote, Spinner } from "@/components/ui";

export const Route = createFileRoute("/emails")({ component: EmailsPage });

type Row = { id: string; email: string; consent: string; createdAt: string; linkTitle: string; linkType: "smart" | "presave" | "bio"; slug: string };

function EmailsPage() {
  return (
    <AppShell>
      <RequireUser>
        <EmailsBody />
      </RequireUser>
    </AppShell>
  );
}

function EmailsBody() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    listEmails().then(setRows).catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load emails."));
  }, []);
  const download = () => {
    if (!rows) return;
    const header = "email,link,type,consent,created";
    const body = rows.map((row) => [row.email, row.linkTitle, row.linkType, row.consent, row.createdAt].map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([`${header}\n${body}`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "artlink-emails.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-3xl">Collected Emails</h1>
        <Button type="button" onClick={download} disabled={!rows?.length}><Download className="size-4" /> Download CSV</Button>
      </div>
      <p className="text-sm text-muted">Only addresses people submitted on your links, with the consent text they agreed to.</p>
      <ErrorNote>{error}</ErrorNote>
      {!rows && !error ? <Spinner /> : null}
      {rows && rows.length === 0 ? <EmptyState title="No emails yet" body="Turn on email collection on a published link to start a list." /> : null}
      <div className="grid gap-2">
        {rows?.map((row) => (
          <article key={row.id} className="rounded-lg border border-border bg-surface p-3">
            <p className="font-medium">{row.email}</p>
            <p className="text-xs text-muted">{row.linkTitle} · {typeLabel(row.linkType)} · {formatWhen(row.createdAt)}</p>
            <p className="mt-1 text-xs text-muted">{row.consent}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
