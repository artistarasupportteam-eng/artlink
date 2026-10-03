import { useEffect, useState } from "react";
import { BrandMark } from "@/lib/glyphs";
import { recordClick, submitEmail } from "@/lib/fns/api";
import { releaseLabel } from "@/lib/format";
import type { CatalogItem, Destination, LinkDraft } from "@/lib/model";
import { AdSlot, type AdView } from "@/components/ads";
import { Button, ErrorNote, inputClass } from "@/components/ui";

function findMark(catalog: CatalogItem[], dest: Destination): CatalogItem {
  return (
    catalog.find((item) => item.id === dest.iconKey) ?? {
      id: dest.iconKey,
      name: dest.name,
      kind: dest.kind === "social" ? "social" : "store",
      color: "#3c4046",
      ink: "light",
      glyph: "mono",
      enabled: true,
      sort: 0,
      custom: true,
    }
  );
}

export function PublicLinkView({
  link,
  catalog,
  preview,
  banner,
  video,
}: {
  link: LinkDraft;
  catalog: CatalogItem[];
  preview?: boolean;
  banner?: AdView | null;
  video?: AdView | null;
}) {
  const stores = link.destinations.filter((item) => item.kind === "store" && item.url);
  const socials = link.destinations.filter((item) => item.kind === "social" && item.url);
  const custom = link.destinations.filter((item) => item.kind === "custom" && item.url);
  const visible = (id: string) => link.type !== "bio" || link.sections.find((section) => section.id === id)?.visible !== false;

  const go = (dest: Destination) => {
    if (!preview) void recordClick({ data: { slug: link.slug, destinationId: dest.id } }).catch(() => undefined);
    window.open(dest.url, "_blank", "noopener,noreferrer");
  };

  return (
    <article className={`mx-auto grid w-full gap-5 ${link.type === "bio" ? "max-w-xl" : "max-w-md"}`}>
      {preview ? <p className="text-center text-xs font-medium uppercase tracking-wide text-muted">Preview</p> : null}
      {link.type === "bio" ? (
        <BioHero link={link} />
      ) : (
        <>
          <Cover src={link.coverUrl} title={link.title} />
          <header className="text-center">
            <h1 className="font-display text-3xl">{link.title || "Untitled"}</h1>
            <p className="mt-1 text-muted">
              {link.artistName || "Artist"}
              {link.featuredArtist ? ` · feat. ${link.featuredArtist}` : ""}
            </p>
            {link.type === "presave" ? <p className="mt-3 text-sm font-medium text-accent">{releaseLabel(link.releaseDate)}</p> : null}
            {link.description ? <p className="mt-3 text-sm text-muted">{link.description}</p> : null}
          </header>
        </>
      )}

      {link.type === "presave" && link.presaveUrl ? (
        <Button
          variant="primary"
          className="w-full"
          onClick={() => {
            if (!preview) void recordClick({ data: { slug: link.slug, presave: true } }).catch(() => undefined);
            window.open(link.presaveUrl, "_blank", "noopener,noreferrer");
          }}
        >
          {link.presaveLabel || "Pre-Save"}
        </Button>
      ) : null}

      {visible("about") && link.type === "bio" && link.about ? <p className="text-sm leading-6 text-muted">{link.about}</p> : null}
      {visible("about") && link.type === "bio" && link.description ? <p className="text-sm leading-6">{link.description}</p> : null}

      {visible("music") && stores.length ? (
        <section className="grid gap-2">
          {link.type === "bio" ? <h2 className="text-sm font-medium">Listen</h2> : null}
          {stores.map((dest) => (
            <DestButton key={dest.id} dest={dest} catalog={catalog} onClick={() => go(dest)} />
          ))}
        </section>
      ) : null}

      {visible("songs") && link.songs.length ? (
        <section className="grid gap-2">
          <h2 className="text-sm font-medium">Releases</h2>
          {link.songs.map((song) => (
            <a key={song.id} href={song.url || undefined} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-lg border border-border bg-surface p-2">
              {song.cover ? <img src={song.cover} alt="" className="size-12 rounded-md object-cover" /> : <span className="size-12 rounded-md bg-surface-2" />}
              <span className="text-sm font-medium">{song.title}</span>
            </a>
          ))}
        </section>
      ) : null}

      {visible("social") && socials.length ? (
        <section className="grid gap-2">
          <h2 className="text-sm font-medium">Social</h2>
          {socials.map((dest) => (
            <DestButton key={dest.id} dest={dest} catalog={catalog} onClick={() => go(dest)} />
          ))}
        </section>
      ) : null}

      {visible("custom") && custom.length ? (
        <section className="grid gap-2">
          <h2 className="text-sm font-medium">Links</h2>
          {custom.map((dest) => (
            <DestButton key={dest.id} dest={dest} catalog={catalog} onClick={() => go(dest)} />
          ))}
        </section>
      ) : null}

      {visible("gallery") && link.gallery.length ? (
        <section className="grid grid-cols-2 gap-2">
          {link.gallery.map((item) => (
            <figure key={item.id} className="overflow-hidden rounded-lg border border-border">
              <img src={item.url} alt={item.caption || ""} className="aspect-square w-full object-cover" />
              {item.caption ? <figcaption className="px-2 py-1 text-xs text-muted">{item.caption}</figcaption> : null}
            </figure>
          ))}
        </section>
      ) : null}

      {visible("email") && link.emailEnabled ? (
        <EmailBox link={link} preview={preview} />
      ) : null}

      <AdSlot ad={video} />
      <AdSlot ad={banner} />
      <p className="text-center text-xs text-muted">
        <a href="/" className="hover:text-fg">ARTLink</a>
      </p>
    </article>
  );
}

function Cover({ src, title }: { src: string; title: string }) {
  if (!src) return <div className="aspect-square w-full rounded-lg border border-border bg-surface-2" role="img" aria-label={title || "Cover"} />;
  return <img src={src} alt="" className="aspect-square w-full rounded-lg border border-border object-cover" />;
}

function BioHero({ link }: { link: LinkDraft }) {
  return (
    <header className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="h-28 bg-surface-2">
        {link.bannerUrl ? <img src={link.bannerUrl} alt="" className="h-28 w-full object-cover" /> : null}
      </div>
      <div className="-mt-8 px-4 pb-4">
        {link.coverUrl ? (
          <img src={link.coverUrl} alt="" className="size-16 rounded-lg border border-border object-cover" />
        ) : (
          <div className="size-16 rounded-lg border border-border bg-bg" />
        )}
        <h1 className="mt-3 font-display text-3xl">{link.artistName || link.title || "Artist"}</h1>
        {link.username ? <p className="text-sm text-muted">@{link.username}</p> : null}
      </div>
    </header>
  );
}

function DestButton({ dest, catalog, onClick }: { dest: Destination; catalog: CatalogItem[]; onClick: () => void }) {
  const mark = findMark(catalog, dest);
  return (
    <button type="button" onClick={onClick} className="flex h-12 w-full items-center gap-3 rounded-lg border border-border bg-surface px-3 text-left hover:bg-surface-2">
      <BrandMark color={mark.color} ink={mark.ink} glyph={mark.glyph} name={dest.name} />
      <span className="text-sm font-medium">{dest.name}</span>
    </button>
  );
}

function EmailBox({ link, preview }: { link: LinkDraft; preview?: boolean }) {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setMessage("");
    setError("");
  }, [link.id]);

  return (
    <form
      className="grid gap-3 rounded-lg border border-border bg-surface p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (preview) return;
        setBusy(true);
        setError("");
        submitEmail({ data: { slug: link.slug, email, consent } })
          .then((result) => setMessage(result.already ? "You’re already on the list." : "Saved. Thank you."))
          .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not save that email."))
          .finally(() => setBusy(false));
      }}
    >
      <h2 className="font-medium">{link.emailHeading || "Get updates"}</h2>
      <input className={inputClass} type="email" required value={email} placeholder="Email address" onChange={(event) => setEmail(event.target.value)} aria-label="Email address" />
      <label className="flex items-start gap-2 text-xs text-muted">
        <input type="checkbox" className="mt-0.5" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
        <span>{link.emailConsent}</span>
      </label>
      <ErrorNote>{error}</ErrorNote>
      {message ? <p className="text-sm text-ok">{message}</p> : null}
      <Button type="submit" variant="primary" busy={busy} disabled={preview || !consent}>
        {preview ? "Available when published" : "Submit"}
      </Button>
    </form>
  );
}
