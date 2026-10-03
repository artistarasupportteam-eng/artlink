import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { getLink, listCatalog } from "@/lib/fns/api";
import type { CatalogItem, LinkDraft } from "@/lib/model";
import { Builder } from "@/components/builder";
import { AppShell, RequireUser } from "@/components/shell";
import { ErrorNote, Spinner } from "@/components/ui";

export const Route = createFileRoute("/edit/$id")({ component: EditPage });

function EditPage() {
  const { id } = Route.useParams();
  return (
    <AppShell>
      <RequireUser>
        <EditBody id={id} />
      </RequireUser>
    </AppShell>
  );
}

function EditBody({ id }: { id: string }) {
  const [draft, setDraft] = useState<LinkDraft | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    Promise.all([getLink({ data: { id } }), listCatalog()])
      .then(([link, items]) => {
        setDraft(link);
        setCatalog(items);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not open this link."));
  }, [id]);
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!draft) return <Spinner />;
  return <Builder initial={draft} catalog={catalog} />;
}
