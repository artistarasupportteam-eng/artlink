import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { BrandMark } from "@/lib/glyphs";
import { saveLink, setLinkStatus } from "@/lib/fns/api";
import { readArtwork } from "@/lib/media";
import { publicPath, slugify, type CatalogItem, type Destination, type LinkDraft, type SectionPref } from "@/lib/model";
import { PublicLinkView } from "@/components/public-link";
import { Button, ErrorNote, Field, areaClass, inputClass } from "@/components/ui";

function cid() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

export function Builder({ initial, catalog }: { initial: LinkDraft; catalog: CatalogItem[] }) {
  const navigate = useNavigate();
  const [draft, setDraft] = useState(initial);
  const [slugTouched, setSlugTouched] = useState(!initial.slug.startsWith("draft-"));
  const [query, setQuery] = useState("");
  const [customName, setCustomName] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"save" | "publish" | "">("");
  const stores = catalog.filter((item) => item.kind === "store");
  const socials = catalog.filter((item) => item.kind === "social");
  const filteredStores = useMemo(
    () => stores.filter((item) => item.name.toLowerCase().includes(query.toLowerCase())).slice(0, 12),
    [stores, query],
  );

  const patch = (partial: Partial<LinkDraft>) => setDraft((current) => ({ ...current, ...partial }));

  const addDest = (partial: Omit<Destination, "id" | "sort">) => {
    if (partial.kind === "store" && draft.destinations.filter((item) => item.kind === "store").length >= 50) {
      setError("You can add up to 50 music stores.");
      return;
    }
    patch({
      destinations: [...draft.destinations, { ...partial, id: cid(), sort: draft.destinations.length }],
    });
  };

  const upload = async (file: File | undefined, key: "coverUrl" | "bannerUrl") => {
    if (!file) return;
    try {
      const url = await readArtwork(file);
      patch({ [key]: url });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that image.");
    }
  };

  const persist = async () => {
    setError("");
    const saved = await saveLink({ data: draft });
    setDraft(saved);
    return saved;
  };

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="grid gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">{draft.type === "smart" ? "Smart Link" : draft.type === "presave" ? "Pre-Save Link" : "Bio Link"}</p>
            <h1 className="font-display text-3xl">{draft.title || "Untitled"}</h1>
          </div>
          <p className="text-sm text-muted">{draft.status}</p>
        </div>
        <ErrorNote>{error}</ErrorNote>

        <section className="grid gap-4 rounded-lg border border-border bg-surface p-4">
          <Field label={draft.type === "bio" ? "Profile image" : "Cover artwork"}>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void upload(event.target.files?.[0], "coverUrl")} />
          </Field>
          {draft.type === "bio" ? (
            <Field label="Banner image">
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void upload(event.target.files?.[0], "bannerUrl")} />
            </Field>
          ) : null}
          <Field label={draft.type === "bio" ? "Page title" : "Song title"}>
            <input
              className={inputClass}
              value={draft.title}
              onChange={(event) => {
                const title = event.target.value;
                patch({
                  title,
                  slug: !slugTouched && (draft.slug.startsWith("draft-") || !draft.slug) ? slugify(title) || draft.slug : draft.slug,
                });
              }}
            />
          </Field>
          <Field label="Artist name">
            <input className={inputClass} value={draft.artistName} onChange={(event) => patch({ artistName: event.target.value })} />
          </Field>
          {draft.type !== "bio" ? (
            <Field label="Featured artist" hint="Optional">
              <input className={inputClass} value={draft.featuredArtist} onChange={(event) => patch({ featuredArtist: event.target.value })} />
            </Field>
          ) : (
            <Field label="Username" hint="Shown on the page. Unique across ARTLink.">
              <input className={inputClass} value={draft.username} onChange={(event) => patch({ username: event.target.value.toLowerCase() })} />
            </Field>
          )}
          <Field label={draft.type === "bio" ? "Short line" : "Description"} hint="Optional">
            <textarea className={areaClass} value={draft.description} onChange={(event) => patch({ description: event.target.value })} />
          </Field>
          {draft.type === "bio" ? (
            <Field label="Biography">
              <textarea className={areaClass} value={draft.about} onChange={(event) => patch({ about: event.target.value })} />
            </Field>
          ) : null}
          {draft.type === "presave" ? (
            <>
              <Field label="Release date">
                <input className={inputClass} type="date" value={draft.releaseDate} onChange={(event) => patch({ releaseDate: event.target.value })} />
              </Field>
              <Field label="Pre-save button text">
                <input className={inputClass} value={draft.presaveLabel} onChange={(event) => patch({ presaveLabel: event.target.value })} />
              </Field>
              <Field label="Pre-save destination URL">
                <input className={inputClass} value={draft.presaveUrl} placeholder="https://" onChange={(event) => patch({ presaveUrl: event.target.value })} />
              </Field>
            </>
          ) : null}
        </section>

        <DestEditor
          title={draft.type === "presave" ? "Additional music stores" : "Music stores"}
          hint="Up to 50. Each button shows the store icon and name."
          items={draft.destinations.filter((item) => item.kind === "store")}
          onChange={(items) => patch({ destinations: [...items, ...draft.destinations.filter((item) => item.kind !== "store")] })}
          catalog={catalog}
          picker={
            <div className="grid gap-2">
              <input className={inputClass} placeholder="Search stores" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search stores" />
              <div className="grid max-h-48 gap-1 overflow-auto">
                {filteredStores.map((store) => (
                  <button key={store.id} type="button" className="flex h-11 items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-surface-2" onClick={() => addDest({ kind: "store", name: store.name, iconKey: store.id, url: "" })}>
                    <BrandMark {...store} name={store.name} />
                    {store.name}
                  </button>
                ))}
              </div>
            </div>
          }
        />

        <DestEditor
          title="Social links"
          items={draft.destinations.filter((item) => item.kind === "social")}
          onChange={(items) => patch({ destinations: [...draft.destinations.filter((item) => item.kind !== "social"), ...items] })}
          catalog={catalog}
          picker={
            <div className="flex flex-wrap gap-2">
              {socials.map((store) => (
                <button key={store.id} type="button" className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-2 text-sm" onClick={() => addDest({ kind: "social", name: store.name, iconKey: store.id, url: "" })}>
                  <BrandMark {...store} name={store.name} />
                  {store.name}
                </button>
              ))}
            </div>
          }
        />

        {draft.type === "bio" ? (
          <DestEditor
            title="Custom links"
            items={draft.destinations.filter((item) => item.kind === "custom")}
            onChange={(items) => patch({ destinations: [...draft.destinations.filter((item) => item.kind !== "custom"), ...items] })}
            catalog={catalog}
            picker={
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <input className={inputClass} placeholder="Name" value={customName} onChange={(event) => setCustomName(event.target.value)} aria-label="Custom link name" />
                <input className={inputClass} placeholder="https://" value={customUrl} onChange={(event) => setCustomUrl(event.target.value)} aria-label="Custom link URL" />
                <Button
                  type="button"
                  onClick={() => {
                    if (!customName.trim()) return;
                    addDest({ kind: "custom", name: customName.trim(), iconKey: "custom", url: customUrl.trim() });
                    setCustomName("");
                    setCustomUrl("");
                  }}
                >
                  Add
                </Button>
              </div>
            }
          />
        ) : null}

        {draft.type === "bio" ? <SectionOrder sections={draft.sections} onChange={(sections) => patch({ sections })} /> : null}
        {draft.type === "bio" ? <GalleryEditor draft={draft} onChange={patch} /> : null}

        <section className="grid gap-3 rounded-lg border border-border bg-surface p-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.emailEnabled} onChange={(event) => patch({ emailEnabled: event.target.checked })} />
            Collect email addresses
          </label>
          {draft.emailEnabled ? (
            <>
              <Field label="Heading">
                <input className={inputClass} value={draft.emailHeading} onChange={(event) => patch({ emailHeading: event.target.value })} />
              </Field>
              <Field label="Consent message">
                <textarea className={areaClass} value={draft.emailConsent} onChange={(event) => patch({ emailConsent: event.target.value })} />
              </Field>
            </>
          ) : null}
        </section>

        <section className="grid gap-3 rounded-lg border border-border bg-surface p-4">
          <Field label="Public URL" hint="Only changes when you edit it. Times for scheduling are UTC.">
            <input
              className={inputClass}
              value={draft.slug}
              onChange={(event) => {
                setSlugTouched(true);
                patch({ slug: event.target.value.toLowerCase() });
              }}
            />
          </Field>
          <p className="text-xs text-muted">{publicPath(draft.slug || "your-link")}</p>
          <Field label="Publish at" hint="Leave empty to publish immediately. A future time schedules the link.">
            <input className={inputClass} type="datetime-local" value={draft.publishAt} onChange={(event) => patch({ publishAt: event.target.value })} />
          </Field>
        </section>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            busy={busy === "save"}
            onClick={() => {
              setBusy("save");
              persist()
                .then(() => toast.success("Saved"))
                .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not save."))
                .finally(() => setBusy(""));
            }}
          >
            {draft.status === "published" || draft.status === "scheduled" ? "Save" : "Save draft"}
          </Button>
          <Button
            type="button"
            variant="primary"
            busy={busy === "publish"}
            onClick={() => {
              setBusy("publish");
              persist()
                .then(() => setLinkStatus({ data: { id: draft.id, status: "published" } }))
                .then((result) => {
                  patch({ status: result.status });
                  toast.success(result.status === "scheduled" ? "Scheduled" : "Published");
                })
                .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not publish."))
                .finally(() => setBusy(""));
            }}
          >
            Publish
          </Button>
          {draft.status === "published" || draft.status === "scheduled" ? (
            <Button
              type="button"
              onClick={() => {
                setLinkStatus({ data: { id: draft.id, status: "unpublished" } })
                  .then(() => patch({ status: "unpublished" }))
                  .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not unpublish."));
              }}
            >
              Unpublish
            </Button>
          ) : null}
          <Button type="button" variant="ghost" onClick={() => void navigate({ to: "/library" })}>
            Back to library
          </Button>
        </div>
      </div>
      <aside className="rounded-lg border border-border bg-bg p-3 lg:sticky lg:top-20">
        <PublicLinkView link={draft} catalog={catalog} preview />
      </aside>
    </div>
  );
}

function DestEditor({
  title,
  hint,
  items,
  onChange,
  catalog,
  picker,
}: {
  title: string;
  hint?: string;
  items: Destination[];
  onChange: (items: Destination[]) => void;
  catalog: CatalogItem[];
  picker: ReactNode;
}) {
  return (
    <section className="grid gap-3 rounded-lg border border-border bg-surface p-4">
      <div>
        <h2 className="font-medium">{title}</h2>
        {hint ? <p className="text-xs text-muted">{hint}</p> : null}
      </div>
      {picker}
      <div className="grid gap-2">
        {items.map((item, index) => {
          const mark = catalog.find((entry) => entry.id === item.iconKey);
          return (
            <div key={item.id} className="grid gap-2 rounded-md border border-border p-2 sm:grid-cols-[auto_1fr_auto]">
              <div className="flex items-center gap-2">
                <BrandMark color={mark?.color ?? "#3c4046"} ink={mark?.ink ?? "light"} glyph={mark?.glyph ?? "mono"} name={item.name} />
                <span className="text-sm">{item.name}</span>
              </div>
              <input className={inputClass} placeholder="https://" value={item.url} aria-label={`${item.name} URL`} onChange={(event) => onChange(items.map((entry) => entry.id === item.id ? { ...entry, url: event.target.value } : entry))} />
              <div className="flex">
                <button type="button" aria-label="Move up" className="grid size-11 place-items-center" onClick={() => onChange(moveList(items, index, -1))}><ArrowUp className="size-4" /></button>
                <button type="button" aria-label="Move down" className="grid size-11 place-items-center" onClick={() => onChange(moveList(items, index, 1))}><ArrowDown className="size-4" /></button>
                <button type="button" aria-label="Remove" className="grid size-11 place-items-center" onClick={() => onChange(items.filter((entry) => entry.id !== item.id))}><Trash2 className="size-4" /></button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function moveList(list: Destination[], index: number, dir: -1 | 1) {
  const next = list.slice();
  const target = index + dir;
  if (target < 0 || target >= next.length) return list;
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return next.map((entry, sort) => ({ ...entry, sort }));
}

function SectionOrder({ sections, onChange }: { sections: SectionPref[]; onChange: (sections: SectionPref[]) => void }) {
  return (
    <section className="grid gap-2 rounded-lg border border-border bg-surface p-4">
      <h2 className="font-medium">Page sections</h2>
      {sections.map((section, index) => (
        <div key={section.id} className="flex items-center gap-2">
          <label className="flex flex-1 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={section.visible}
              onChange={(event) => onChange(sections.map((item) => item.id === section.id ? { ...item, visible: event.target.checked } : item))}
            />
            {section.label}
          </label>
          <button type="button" aria-label={`Move ${section.label} up`} className="grid size-11 place-items-center" onClick={() => onChange(swap(sections, index, -1))}><ArrowUp className="size-4" /></button>
          <button type="button" aria-label={`Move ${section.label} down`} className="grid size-11 place-items-center" onClick={() => onChange(swap(sections, index, 1))}><ArrowDown className="size-4" /></button>
        </div>
      ))}
    </section>
  );
}

function swap<T>(list: T[], index: number, dir: -1 | 1) {
  const next = list.slice();
  const target = index + dir;
  if (target < 0 || target >= next.length) return list;
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return next;
}

function GalleryEditor({ draft, onChange }: { draft: LinkDraft; onChange: (partial: Partial<LinkDraft>) => void }) {
  return (
    <section className="grid gap-3 rounded-lg border border-border bg-surface p-4">
      <h2 className="font-medium">Gallery and releases</h2>
      <Field label="Gallery image">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            void readArtwork(file).then((url) => onChange({ gallery: [...draft.gallery, { id: cid(), url, caption: "" }] }));
          }}
        />
      </Field>
      {draft.gallery.map((item) => (
        <div key={item.id} className="flex items-center gap-2">
          <img src={item.url} alt="" className="size-12 rounded-md object-cover" />
          <input className={inputClass} placeholder="Caption" value={item.caption} onChange={(event) => onChange({ gallery: draft.gallery.map((entry) => entry.id === item.id ? { ...entry, caption: event.target.value } : entry) })} />
          <button type="button" aria-label="Remove image" className="grid size-11 place-items-center" onClick={() => onChange({ gallery: draft.gallery.filter((entry) => entry.id !== item.id) })}><Trash2 className="size-4" /></button>
        </div>
      ))}
      <div className="grid gap-2 sm:grid-cols-2">
        <input className={inputClass} placeholder="Release title" id="song-title" />
        <input className={inputClass} placeholder="https://" id="song-url" />
      </div>
      <Button
        type="button"
        onClick={() => {
          const title = (document.getElementById("song-title") as HTMLInputElement | null)?.value.trim() ?? "";
          const url = (document.getElementById("song-url") as HTMLInputElement | null)?.value.trim() ?? "";
          if (!title) return;
          onChange({ songs: [...draft.songs, { id: cid(), title, url, cover: "" }] });
          const titleEl = document.getElementById("song-title") as HTMLInputElement | null;
          const urlEl = document.getElementById("song-url") as HTMLInputElement | null;
          if (titleEl) titleEl.value = "";
          if (urlEl) urlEl.value = "";
        }}
      >
        <ImagePlus className="size-4" /> Add release
      </Button>
      {draft.songs.map((song) => (
        <div key={song.id} className="flex items-center justify-between text-sm">
          <span>{song.title}</span>
          <button type="button" aria-label="Remove release" className="grid size-11 place-items-center" onClick={() => onChange({ songs: draft.songs.filter((entry) => entry.id !== song.id) })}><Trash2 className="size-4" /></button>
        </div>
      ))}
    </section>
  );
}
