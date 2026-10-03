import { useEffect, useRef } from "react";
import { recordAdEvent } from "@/lib/fns/api";

export type AdView = {
  id: string;
  kind: "banner" | "video";
  name: string;
  advertiser: string;
  imageUrl: string;
  videoUrl: string;
  destUrl: string;
  placement: string;
};

export function AdSlot({ ad }: { ad: AdView | null | undefined }) {
  const seen = useRef("");
  useEffect(() => {
    if (!ad || seen.current === ad.id) return;
    seen.current = ad.id;
    void recordAdEvent({ data: { id: ad.id, kind: "impression" } }).catch(() => undefined);
  }, [ad]);

  if (!ad) return null;
  const open = () => {
    void recordAdEvent({ data: { id: ad.id, kind: "click" } }).catch(() => undefined);
    window.open(ad.destUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <section className="grid gap-2" aria-label="Advertisement">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">Advertisement</p>
      {ad.kind === "video" && ad.videoUrl ? (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <video className="aspect-video w-full bg-bg" controls preload="metadata" playsInline src={ad.videoUrl}>
            <track kind="captions" />
          </video>
          <div className="flex items-center justify-between gap-3 px-3 py-2">
            <p className="text-xs text-muted">{ad.advertiser}</p>
            <button type="button" onClick={open} className="text-sm font-medium text-accent">
              Visit
            </button>
          </div>
        </div>
      ) : ad.imageUrl ? (
        <button type="button" onClick={open} className="block overflow-hidden rounded-lg border border-border text-left">
          <img src={ad.imageUrl} alt="" className="max-h-48 w-full object-cover" />
          <span className="block px-3 py-2 text-xs text-muted">{ad.advertiser} · Sponsored</span>
        </button>
      ) : null}
    </section>
  );
}
