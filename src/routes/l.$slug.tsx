import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { getPublicLink, listCatalog, recordView } from "@/lib/fns/api";
import type { CatalogItem, LinkDraft } from "@/lib/model";
import type { AdView } from "@/components/ads";
import { PublicLinkView } from "@/components/public-link";
import { Spinner } from "@/components/ui";

export const Route = createFileRoute("/l/$slug")({ component: PublicPage });

function PublicPage() {
  const { slug } = Route.useParams();
  const [link, setLink] = useState<LinkDraft | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [banner, setBanner] = useState<AdView | null>(null);
  const [video, setVideo] = useState<AdView | null>(null);
  const [missing, setMissing] = useState(false);
  const tracked = useRef("");

  useEffect(() => {
    let live = true;
    setMissing(false);
    setLink(null);
    Promise.all([getPublicLink({ data: { slug } }), listCatalog()])
      .then(([payload, items]) => {
        if (!live) return;
        setCatalog(items);
        if (!payload) {
          setMissing(true);
          return;
        }
        setLink(payload.link);
        setBanner(payload.banner);
        setVideo(payload.video);
      })
      .catch(() => {
        if (live) setMissing(true);
      });
    return () => {
      live = false;
    };
  }, [slug]);

  useEffect(() => {
    if (!link || tracked.current === slug) return;
    tracked.current = slug;
    void recordView({ data: { slug } }).catch(() => undefined);
  }, [link, slug]);

  return (
    <main className="min-h-dvh bg-bg px-4 py-8 text-fg">
      {missing ? (
        <div className="mx-auto max-w-md text-center">
          <h1 className="font-display text-3xl">Link not available</h1>
          <p className="mt-2 text-sm text-muted">This ARTLink page is unpublished or does not exist.</p>
        </div>
      ) : null}
      {!link && !missing ? <div className="grid place-items-center py-20"><Spinner /></div> : null}
      {link ? <PublicLinkView link={link} catalog={catalog} banner={banner} video={video} /> : null}
    </main>
  );
}
