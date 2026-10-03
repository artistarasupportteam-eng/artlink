import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { getLink, listCatalog } from "@/lib/fns/api";
import type { CatalogItem, LinkDraft } from "@/lib/model";
import { PublicLinkView } from "@/components/public-link";
import { RequireUser } from "@/components/shell";
import { ErrorNote, Spinner } from "@/components/ui";

export const Route = createFileRoute("/preview/$id")({ component: PreviewPage });

function PreviewPage() {
  const { id } = Route.useParams();
  return (
    <RequireUser>
      <PreviewBody id={id} />
    </RequireUser>
  );
}

function PreviewBody({ id }: { id: string }) {
  const [draft, setDraft] = useState<LinkDraft | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    Promise.all([getLink({ data: { id } }), listCatalog()])
      .then(([link, items]) => {
        setDraft(link);
        setCatalog(items);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not preview."));
  }, [id]);
  return (
    <main className="min-h-dvh bg-bg px-4 py-6 text-fg">
      <div className="mx-auto mb-4 flex max-w-md items-center justify-between">
        <Link to="/edit/$id" params={{ id }} className="text-sm text-accent">Back to editor</Link>
        <span className="text-xs text-muted">Only you can see this preview</span>
      </div>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {!draft && !error ? <Spinner /> : null}
      {draft ? <PublicLinkView link={draft} catalog={catalog} preview /> : null}
    </main>
  );
}
