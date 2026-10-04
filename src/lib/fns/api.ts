import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql, type Sql } from "@/lib/db";
import {
  BIO_SECTIONS,
  reservedSlug,
  validEmail,
  validHttpUrl,
  validSlug,
  type CatalogItem,
  type Destination,
  type GalleryItem,
  type LinkDraft,
  type LinkStatus,
  type LinkSummary,
  type LinkType,
  type Me,
  type SectionPref,
  type SongItem,
  type ThemeChoice,
} from "@/lib/model";

const GLYPHS = new Set([
  "note", "play", "wave", "disc", "cloud", "bolt", "radio", "mic", "heart", "star",
  "hex", "diamond", "rings", "pulse", "cassette", "headphones", "mono",
]);

function nid(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

function num(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    return value;
  }
  return "";
}

function str(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function asObj(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid request.");
  return data as Record<string, unknown>;
}

function toTs(value: string): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return `${value}:00Z`;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error("Invalid date.");
  return parsed.toISOString();
}

function fromTs(value: unknown): string {
  const text = iso(value);
  if (!text) return "";
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

function imageOk(value: string, maxChars: number): boolean {
  if (!value) return true;
  if (value.length > maxChars) return false;
  return (
    value.startsWith("data:image/jpeg;base64,") ||
    value.startsWith("data:image/png;base64,") ||
    value.startsWith("data:image/webp;base64,")
  );
}

function videoOk(value: string, maxChars: number): boolean {
  if (!value) return true;
  if (validHttpUrl(value) && value.startsWith("https:")) return value.length < 2000;
  if (value.length > maxChars) return false;
  return value.startsWith("data:video/mp4;base64,") || value.startsWith("data:video/webm;base64,");
}

function safeDest(value: string): string {
  if (!value) return "";
  if (value.startsWith("/") && !value.startsWith("//")) return value.slice(0, 300);
  if (validHttpUrl(value)) return value.slice(0, 2000);
  throw new Error("Destination must be a site path or an http(s) URL.");
}

const DESIGNATED_ADMIN = "artistmusicresidency@gmail.com";

function adminEmails(): string[] {
  const fromEnv = (process.env.ARTLINK_ADMIN_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set([DESIGNATED_ADMIN, ...fromEnv])];
}

async function touchUser(sql: Sql, userId: string) {
  const users = await sql<{ email: string; name: string; image: string | null }>`
    select email, name, image from "user" where id = ${userId}
  `;
  const user = users[0] ?? null;
  await sql`insert into user_roles (user_id) values (${userId}) on conflict (user_id) do nothing`;
  await sql`
    insert into artist_profiles (user_id, artist_name)
    values (${userId}, ${user?.name ?? ""})
    on conflict (user_id) do nothing
  `;
  const allow = adminEmails();
  if (user?.email && allow.includes(user.email.toLowerCase())) {
    await sql`update user_roles set role = 'admin' where user_id = ${userId}`;
  }
  return user;
}

async function roleOf(sql: Sql, userId: string) {
  const rows = await sql<{ role: string; suspended: boolean }>`
    select role, suspended from user_roles where user_id = ${userId}
  `;
  return { role: rows[0]?.role === "admin" ? "admin" : "user", suspended: Boolean(rows[0]?.suspended) };
}

async function assertActive(sql: Sql, userId: string) {
  const role = await roleOf(sql, userId);
  if (role.suspended) throw new Error("This account is suspended.");
  return role.role === "admin";
}

async function assertAdmin(sql: Sql, userId: string) {
  const isAdmin = await assertActive(sql, userId);
  if (!isAdmin) throw new Error("Administrator access required.");
}

async function adminCount(sql: Sql) {
  const rows = await sql<{ n: number }>`select count(*)::int as n from user_roles where role = 'admin'`;
  return num(rows[0]?.n);
}

async function audit(sql: Sql, adminId: string, action: string, target: string, detail: string) {
  await sql`
    insert into audit_log (id, admin_id, action, target, detail)
    values (${nid()}, ${adminId}, ${action.slice(0, 80)}, ${target.slice(0, 120)}, ${detail.slice(0, 500)})
  `;
}

async function logActivity(sql: Sql, userId: string, message: string, href: string) {
  await sql`
    insert into activity (id, user_id, message, href)
    values (${nid()}, ${userId}, ${message.slice(0, 180)}, ${href.slice(0, 300)})
  `;
}

async function limits(sql: Sql) {
  const rows = await sql<{ key: string; value: string }>`select key, value from platform_settings`;
  const map = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  const image = Math.min(2_000_000, Math.max(200_000, num(map.image_max_bytes) || 1_200_000));
  const video = Math.min(8_000_000, Math.max(500_000, num(map.video_max_bytes) || 4_000_000));
  return {
    image,
    video,
    imageChars: Math.ceil(image * 1.45),
    videoChars: Math.ceil(video * 1.4),
    name: map.platform_name || "ARTLink",
    tagline: map.tagline || "",
    support: map.support_email || "",
    help: map.help_body || "",
  };
}

async function rateLimit(sql: Sql, bucket: string, limit: number, seconds: number) {
  await sql`delete from rate_hits where bucket = ${bucket} and created_at < now() - interval '2 days'`;
  const rows = await sql<{ n: number }>`
    select count(*)::int as n from rate_hits
    where bucket = ${bucket} and created_at > now() - (${String(seconds)} || ' seconds')::interval
  `;
  if (num(rows[0]?.n) >= limit) throw new Error("Too many requests. Try again shortly.");
  await sql`insert into rate_hits (bucket) values (${bucket})`;
}

function parseJsonArray(raw: string): unknown[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseSections(raw: string): SectionPref[] {
  const saved = parseJsonArray(raw);
  const ordered: SectionPref[] = [];
  const seen = new Set<string>();
  for (const item of saved) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const id = str(row.id, 40);
    const known = BIO_SECTIONS.find((section) => section.id === id);
    if (!known || seen.has(id)) continue;
    seen.add(id);
    ordered.push({ id, label: known.label, visible: row.visible !== false });
  }
  for (const section of BIO_SECTIONS) {
    if (!seen.has(section.id)) ordered.push({ ...section });
  }
  return ordered;
}

function parseGallery(value: unknown, maxChars: number): GalleryItem[] {
  if (!Array.isArray(value)) return [];
  const items: GalleryItem[] = [];
  for (const item of value.slice(0, 12)) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const url = str(row.url, maxChars);
    if (!url) continue;
    if (!imageOk(url, maxChars)) throw new Error("A gallery image is not an allowed file.");
    let id = str(row.id, 40);
    if (!/^[a-zA-Z0-9_-]{6,40}$/.test(id)) id = nid();
    items.push({ id, url, caption: str(row.caption, 120) });
  }
  return items;
}

function parseSongs(value: unknown, maxChars: number): SongItem[] {
  if (!Array.isArray(value)) return [];
  const items: SongItem[] = [];
  for (const item of value.slice(0, 12)) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const title = str(row.title, 120);
    const url = str(row.url, 2000);
    const cover = str(row.cover, maxChars);
    if (!title) continue;
    if (url && !validHttpUrl(url)) throw new Error(`Invalid URL for “${title}”.`);
    if (cover && !imageOk(cover, maxChars)) throw new Error("A release image is not an allowed file.");
    let id = str(row.id, 40);
    if (!/^[a-zA-Z0-9_-]{6,40}$/.test(id)) id = nid();
    items.push({ id, title, url, cover });
  }
  return items;
}

function parseDestinations(value: unknown): Destination[] {
  if (!Array.isArray(value)) return [];
  const items: Destination[] = [];
  let stores = 0;
  for (const item of value.slice(0, 90)) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const kind = row.kind === "social" || row.kind === "custom" ? row.kind : "store";
    const name = str(row.name, 80);
    const url = str(row.url, 2000);
    if (!name) continue;
    if (url && !validHttpUrl(url)) throw new Error(`Invalid URL for ${name}.`);
    if (kind === "store") stores += 1;
    if (stores > 50) throw new Error("A link can include up to 50 music stores.");
    let id = str(row.id, 40);
    if (!/^[a-zA-Z0-9_-]{6,40}$/.test(id)) id = nid();
    items.push({ id, kind, name, iconKey: str(row.iconKey, 60) || "custom", url, sort: items.length });
  }
  return items;
}

type LinkRow = {
  id: string;
  user_id: string;
  type: string;
  status: string;
  title: string;
  artist_name: string;
  featured_artist: string;
  description: string;
  cover_url: string;
  banner_url: string;
  username: string;
  slug: string;
  about: string;
  release_date: string;
  presave_label: string;
  presave_url: string;
  email_enabled: boolean;
  email_heading: string;
  email_consent: string;
  sections_json: string;
  gallery_json: string;
  songs_json: string;
  publish_at: unknown;
  created_at: unknown;
  updated_at: unknown;
};

function asType(value: string): LinkType {
  if (value === "presave" || value === "bio" || value === "smart") return value;
  return "smart";
}

function asStatus(value: string): LinkStatus {
  if (value === "published" || value === "unpublished" || value === "scheduled" || value === "draft") return value;
  return "draft";
}

async function destinationsFor(sql: Sql, linkId: string): Promise<Destination[]> {
  const rows = await sql<{
    id: string;
    kind: string;
    name: string;
    icon_key: string;
    url: string;
    sort_order: number;
  }>`
    select id, kind, name, icon_key, url, sort_order
    from destinations where link_id = ${linkId}
    order by sort_order asc, name asc
  `;
  return rows.map((row, index) => ({
    id: row.id,
    kind: row.kind === "social" || row.kind === "custom" ? row.kind : "store",
    name: row.name,
    iconKey: row.icon_key,
    url: row.url,
    sort: index,
  }));
}

function draftFrom(row: LinkRow, destinations: Destination[]): LinkDraft {
  return {
    id: row.id,
    type: asType(row.type),
    status: asStatus(row.status),
    title: row.title,
    artistName: row.artist_name,
    featuredArtist: row.featured_artist,
    description: row.description,
    coverUrl: row.cover_url,
    bannerUrl: row.banner_url,
    username: row.username,
    slug: row.slug,
    about: row.about,
    releaseDate: row.release_date,
    presaveLabel: row.presave_label || "Pre-Save",
    presaveUrl: row.presave_url,
    emailEnabled: Boolean(row.email_enabled),
    emailHeading: row.email_heading,
    emailConsent: row.email_consent,
    sections: parseSections(row.sections_json),
    gallery: parseGallery(parseJsonArray(row.gallery_json), 8_000_000),
    songs: parseSongs(parseJsonArray(row.songs_json), 8_000_000),
    publishAt: fromTs(row.publish_at),
    destinations,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

async function loadOwned(sql: Sql, userId: string, id: string) {
  const rows = await sql<LinkRow>`select * from links where id = ${id} and user_id = ${userId}`;
  const row = rows[0];
  if (!row) throw new Error("Link not found.");
  return draftFrom(row, await destinationsFor(sql, id));
}

async function slugTaken(sql: Sql, slug: string, exceptId: string) {
  const rows = await sql<{ id: string }>`
    select id from links where lower(slug) = lower(${slug}) and id <> ${exceptId} limit 1
  `;
  return Boolean(rows[0]);
}

async function usernameTaken(sql: Sql, username: string, exceptLinkId: string, exceptUserId: string) {
  if (!username) return false;
  const links = await sql<{ id: string }>`
    select id from links where lower(username) = lower(${username}) and id <> ${exceptLinkId} limit 1
  `;
  if (links[0]) return true;
  const profiles = await sql<{ user_id: string }>`
    select user_id from artist_profiles
    where lower(username) = lower(${username}) and user_id <> ${exceptUserId} limit 1
  `;
  return Boolean(profiles[0]);
}

type DraftInput = {
  id: string;
  title: string;
  artistName: string;
  featuredArtist: string;
  description: string;
  coverUrl: string;
  bannerUrl: string;
  username: string;
  slug: string;
  about: string;
  releaseDate: string;
  presaveLabel: string;
  presaveUrl: string;
  emailEnabled: boolean;
  emailHeading: string;
  emailConsent: string;
  sections: SectionPref[];
  gallery: GalleryItem[];
  songs: SongItem[];
  publishAt: string;
  destinations: Destination[];
};

function readDraftInput(data: unknown, caps: { imageChars: number }): DraftInput {
  const body = asObj(data);
  const sectionsRaw = Array.isArray(body.sections) ? body.sections : [];
  const sections = parseSections(JSON.stringify(sectionsRaw));
  const coverUrl = str(body.coverUrl, caps.imageChars);
  const bannerUrl = str(body.bannerUrl, caps.imageChars);
  if (!imageOk(coverUrl, caps.imageChars) || !imageOk(bannerUrl, caps.imageChars)) {
    throw new Error("Artwork must be a JPEG, PNG, or WebP image within the size limit.");
  }
  const username = slugifyLoose(str(body.username, 40));
  const slug = slugifyLoose(str(body.slug, 40));
  const releaseDate = str(body.releaseDate, 10);
  if (releaseDate && !/^\d{4}-\d{2}-\d{2}$/.test(releaseDate)) throw new Error("Release date is invalid.");
  return {
    id: str(body.id, 40),
    title: str(body.title, 140),
    artistName: str(body.artistName, 120),
    featuredArtist: str(body.featuredArtist, 120),
    description: str(body.description, 2000),
    coverUrl,
    bannerUrl,
    username,
    slug,
    about: str(body.about, 4000),
    releaseDate,
    presaveLabel: str(body.presaveLabel, 40) || "Pre-Save",
    presaveUrl: str(body.presaveUrl, 2000),
    emailEnabled: Boolean(body.emailEnabled),
    emailHeading: str(body.emailHeading, 140),
    emailConsent: str(body.emailConsent, 400),
    sections,
    gallery: parseGallery(body.gallery, caps.imageChars),
    songs: parseSongs(body.songs, caps.imageChars),
    publishAt: str(body.publishAt, 40),
    destinations: parseDestinations(body.destinations),
  };
}

function slugifyLoose(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

async function writeDestinations(sql: Sql, linkId: string, destinations: Destination[]) {
  await sql`delete from destinations where link_id = ${linkId}`;
  for (const dest of destinations) {
    await sql`
      insert into destinations (id, link_id, kind, name, icon_key, url, sort_order)
      values (${dest.id}, ${linkId}, ${dest.kind}, ${dest.name}, ${dest.iconKey}, ${dest.url}, ${dest.sort})
    `;
  }
}

function assertPublishable(draft: LinkDraft) {
  if (!validSlug(draft.slug) || reservedSlug(draft.slug)) {
    throw new Error("Choose a public URL using 3–40 letters, numbers, and hyphens.");
  }
  if (!draft.title) throw new Error("Add a title before publishing.");
  if (draft.type !== "bio" && !draft.artistName) throw new Error("Add the artist name before publishing.");
  if (draft.type === "bio" && !draft.artistName) throw new Error("Add the artist name before publishing.");
  if (draft.type === "smart") {
    const stores = draft.destinations.filter((item) => item.kind === "store" && item.url);
    if (!stores.length) throw new Error("Add at least one music-store link before publishing.");
  }
  if (draft.type === "presave") {
    if (!draft.releaseDate) throw new Error("Add a release date before publishing.");
    if (!draft.presaveUrl || !validHttpUrl(draft.presaveUrl)) {
      throw new Error("Add a valid pre-save destination before publishing.");
    }
  }
  if (draft.emailEnabled && (!draft.emailHeading || !draft.emailConsent)) {
    throw new Error("Email collection needs a heading and a consent message.");
  }
  if (draft.username && !validSlug(draft.username.replace(/_/g, ""))) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(draft.username)) {
      throw new Error("Username can use letters, numbers, and hyphens.");
    }
  }
}

async function visitor() {
  const { getRequest } = await import("@tanstack/react-start/server");
  const { createHash } = await import("node:crypto");
  const req = getRequest();
  const ua = req.headers.get("user-agent") ?? "";
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
  const rawCountry = req.headers.get("x-vercel-ip-country") || req.headers.get("cf-ipcountry") || "";
  const hash = createHash("sha256").update(`${ip}|${ua}`).digest("hex").slice(0, 32);
  let device = "Desktop";
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua)) device = "Tablet";
  else if (/Mobi|Android|iPhone/i.test(ua)) device = "Phone";
  return { hash, country: rawCountry && rawCountry !== "XX" ? rawCountry : "Unknown", device };
}

const LIVE = `(
  l.status = 'published'
  or (l.status = 'scheduled' and l.publish_at is not null and l.publish_at <= now())
) and not exists (
  select 1 from user_roles r where r.user_id = l.user_id and r.suspended
)`;

async function analyticsFor(sql: Sql, ownerId: string, linkId: string | null) {
  const linkClause = linkId ? "and e.link_id = $2" : "";
  const linkClauseL = linkId ? "and l.id = $2" : "";
  const params = linkId ? [ownerId, linkId] : [ownerId];
  const viewsRows = await sql.query<{ views: number; clicks: number; uniques: number }>(
    `select
      count(*) filter (where e.kind = 'view')::int as views,
      count(*) filter (where e.kind = 'click')::int as clicks,
      count(distinct e.visitor_hash) filter (where e.kind = 'view' and e.visitor_hash <> '')::int as uniques
     from events e
     where e.owner_id = $1 ${linkClause}`,
    params,
  );
  const returningRows = await sql.query<{ n: number }>(
    `select count(*)::int as n from (
      select visitor_hash from events e
      where e.owner_id = $1 and e.kind = 'view' and e.visitor_hash <> '' ${linkClause}
      group by visitor_hash
      having count(distinct to_char(e.created_at at time zone 'utc', 'YYYY-MM-DD')) > 1
    ) t`,
    params,
  );
  const emailRows = await sql.query<{ n: number }>(
    linkId
      ? `select count(*)::int as n from email_signups where owner_id = $1 and link_id = $2`
      : `select count(*)::int as n from email_signups where owner_id = $1`,
    params,
  );
  const typeRows = await sql.query<{ type: string; links: number; views: number; clicks: number }>(
    `select l.type,
        count(distinct l.id)::int as links,
        count(e.id) filter (where e.kind = 'view')::int as views,
        count(e.id) filter (where e.kind = 'click')::int as clicks
     from links l
     left join events e on e.link_id = l.id
     where l.user_id = $1 ${linkClauseL}
     group by l.type`,
    params,
  );
  const targetRows = await sql.query<{ target: string; n: number }>(
    `select target, count(*)::int as n from events e
     where e.owner_id = $1 and e.kind = 'click' ${linkClause}
     group by target order by n desc limit 40`,
    params,
  );
  const dayRows = await sql.query<{ day: string; views: number; clicks: number }>(
    `select to_char(e.created_at at time zone 'utc', 'YYYY-MM-DD') as day,
        count(*) filter (where e.kind = 'view')::int as views,
        count(*) filter (where e.kind = 'click')::int as clicks
     from events e
     where e.owner_id = $1 and e.created_at > now() - interval '14 days' ${linkClause}
     group by 1 order by 1`,
    params,
  );
  const countryRows = await sql.query<{ name: string; visitors: number }>(
    `select country as name, count(distinct visitor_hash)::int as visitors
     from events e
     where e.owner_id = $1 and e.kind = 'view' ${linkClause}
     group by country order by visitors desc limit 12`,
    params,
  );
  const deviceRows = await sql.query<{ name: string; visitors: number }>(
    `select device as name, count(distinct visitor_hash)::int as visitors
     from events e
     where e.owner_id = $1 and e.kind = 'view' ${linkClause}
     group by device order by visitors desc`,
    params,
  );
  const stores: { name: string; clicks: number }[] = [];
  const socials: { name: string; clicks: number }[] = [];
  const customs: { name: string; clicks: number }[] = [];
  let presaveClicks = 0;
  for (const row of targetRows) {
    const [kind, ...rest] = String(row.target).split("|");
    const name = rest.join("|") || kind;
    const clicks = num(row.n);
    if (kind === "store") stores.push({ name, clicks });
    else if (kind === "social") socials.push({ name, clicks });
    else if (kind === "custom") customs.push({ name, clicks });
    else if (kind === "presave") presaveClicks += clicks;
  }
  const views = num(viewsRows[0]?.views);
  const clicks = num(viewsRows[0]?.clicks);
  const byDay = new Map(dayRows.map((row) => [row.day, { views: num(row.views), clicks: num(row.clicks) }]));
  const days: { day: string; views: number; clicks: number }[] = [];
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - 13);
  for (let i = 0; i < 14; i += 1) {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() + i);
    const key = day.toISOString().slice(0, 10);
    const found = byDay.get(key);
    days.push({ day: key, views: found?.views ?? 0, clicks: found?.clicks ?? 0 });
  }
  return {
    views,
    clicks,
    uniqueVisitors: num(viewsRows[0]?.uniques),
    returning: num(returningRows[0]?.n),
    emails: num(emailRows[0]?.n),
    ctr: views ? Math.round((clicks / views) * 1000) / 10 : 0,
    byType: typeRows.map((row) => ({
      type: row.type,
      links: num(row.links),
      views: num(row.views),
      clicks: num(row.clicks),
    })),
    stores,
    socials,
    customs,
    presaveClicks,
    days,
    countries: countryRows.map((row) => ({ name: row.name || "Unknown", visitors: num(row.visitors) })),
    devices: deviceRows.map((row) => ({ name: row.name || "Unknown", visitors: num(row.visitors) })),
  };
}

export type AnalyticsBundle = Awaited<ReturnType<typeof analyticsFor>>;

async function findLive(sql: Sql, slug: string) {
  const rows = await sql.query<LinkRow>(
    `select l.* from links l where lower(l.slug) = lower($1) and ${LIVE} limit 1`,
    [slug],
  );
  return rows[0] ?? null;
}

export const getMe = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<Me> => {
    const sql = await getSql();
    const user = await touchUser(sql, context.userId);
    const role = await roleOf(sql, context.userId);
    const profiles = await sql<{
      artist_name: string;
      username: string;
      about: string;
      avatar_url: string;
      banner_url: string;
      theme: string;
    }>`select artist_name, username, about, avatar_url, banner_url, theme from artist_profiles where user_id = ${context.userId}`;
    const profile = profiles[0];
    const unreadRows = await sql<{ n: number }>`
      select count(*)::int as n
      from notifications n
      left join notification_reads r on r.notification_id = n.id and r.user_id = ${context.userId}
      where n.published = true
        and r.user_id is null
        and (n.user_id is null or n.user_id = ${context.userId})
        and (n.starts_at is null or n.starts_at <= now())
    `;
    const theme: ThemeChoice = profile?.theme === "light" || profile?.theme === "system" ? profile.theme : "dark";
    return {
      userId: context.userId,
      email: user?.email ?? "",
      name: user?.name ?? "",
      image: user?.image ?? "",
      artistName: profile?.artist_name ?? "",
      username: profile?.username ?? "",
      about: profile?.about ?? "",
      avatarUrl: profile?.avatar_url ?? "",
      bannerUrl: profile?.banner_url ?? "",
      theme,
      role: role.role === "admin" ? "admin" : "user",
      suspended: role.suspended,
      adminExists: (await adminCount(sql)) > 0,
      canClaimAdmin:
        role.role !== "admin" &&
        Boolean(user?.email && adminEmails().includes(user.email.toLowerCase())),
      unread: num(unreadRows[0]?.n),
    };
  });

export const saveProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => data)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await touchUser(sql, context.userId);
    await assertActive(sql, context.userId);
    const body = asObj(data);
    const caps = await limits(sql);
    const artistName = str(body.artistName, 120);
    const username = slugifyLoose(str(body.username, 40));
    const about = str(body.about, 2000);
    const avatarUrl = str(body.avatarUrl, caps.imageChars);
    const bannerUrl = str(body.bannerUrl, caps.imageChars);
    if (!imageOk(avatarUrl, caps.imageChars) || !imageOk(bannerUrl, caps.imageChars)) {
      throw new Error("Profile images must be JPEG, PNG, or WebP within the size limit.");
    }
    if (username && (!validSlug(username) || reservedSlug(username))) {
      throw new Error("Username must be 3–40 letters, numbers, or hyphens.");
    }
    if (await usernameTaken(sql, username, "", context.userId)) throw new Error("That username is taken.");
    await sql`
      update artist_profiles
      set artist_name = ${artistName}, username = ${username}, about = ${about},
          avatar_url = ${avatarUrl}, banner_url = ${bannerUrl}, updated_at = now()
      where user_id = ${context.userId}
    `;
    return { ok: true };
  });

export const saveTheme = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => data)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await touchUser(sql, context.userId);
    const body = asObj(data);
    const theme = body.theme === "light" || body.theme === "system" ? body.theme : "dark";
    await sql`update artist_profiles set theme = ${theme}, updated_at = now() where user_id = ${context.userId}`;
    return { theme };
  });

export const claimAdmin = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const user = await touchUser(sql, context.userId);
    await assertActive(sql, context.userId);
    const email = (user?.email ?? "").toLowerCase();
    if (!adminEmails().includes(email)) {
      throw new Error("Administrator access is reserved for the ARTLink operator account.");
    }
    if ((await roleOf(sql, context.userId)).role === "admin") return { ok: true };
    if ((await adminCount(sql)) > 0) throw new Error("An administrator already exists.");
    await sql`update user_roles set role = 'admin' where user_id = ${context.userId}`;
    await audit(sql, context.userId, "claim-admin", context.userId, "Initial administrator claimed.");
    return { ok: true };
  });

export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => data)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const body = asObj(data);
    if (str(body.confirm, 20) !== "DELETE") throw new Error("Type DELETE to confirm.");
    const role = await roleOf(sql, context.userId);
    if (role.role === "admin" && (await adminCount(sql)) <= 1) {
      throw new Error("Appoint another administrator before deleting this account.");
    }
    await sql`delete from events where owner_id = ${context.userId}`;
    await sql`delete from email_signups where owner_id = ${context.userId}`;
    await sql`delete from activity where user_id = ${context.userId}`;
    await sql`delete from links where user_id = ${context.userId}`;
    await sql`delete from notification_reads where user_id = ${context.userId}`;
    await sql`delete from notifications where user_id = ${context.userId}`;
    await sql`delete from support_reports where user_id = ${context.userId}`;
    await sql`delete from artist_profiles where user_id = ${context.userId}`;
    await sql`delete from user_roles where user_id = ${context.userId}`;
    await sql`delete from "session" where "userId" = ${context.userId}`;
    await sql`delete from "account" where "userId" = ${context.userId}`;
    await sql`delete from "user" where id = ${context.userId}`;
    return { ok: true };
  });

export const submitReport = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => data)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await touchUser(sql, context.userId);
    await assertActive(sql, context.userId);
    await rateLimit(sql, `report:${context.userId}`, 5, 3600);
    const body = asObj(data);
    const subject = str(body.subject, 140);
    const message = str(body.body, 4000);
    if (subject.length < 3 || message.length < 8) throw new Error("Add a subject and a short message.");
    await sql`
      insert into support_reports (id, user_id, subject, body)
      values (${nid()}, ${context.userId}, ${subject}, ${message})
    `;
    return { ok: true };
  });

export const listCatalog = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    name: string;
    kind: string;
    color: string;
    ink: string;
    glyph: string;
    enabled: boolean;
    sort_order: number;
    custom: boolean;
  }>`
    select id, name, kind, color, ink, glyph, enabled, sort_order, custom
    from store_catalog where enabled = true
    order by kind asc, sort_order asc, name asc
  `;
  return rows.map(toCatalog);
});

function toCatalog(row: {
  id: string;
  name: string;
  kind: string;
  color: string;
  ink: string;
  glyph: string;
  enabled: boolean;
  sort_order: number;
  custom: boolean;
}): CatalogItem {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind === "social" ? "social" : "store",
    color: row.color,
    ink: row.ink === "dark" ? "dark" : "light",
    glyph: row.glyph,
    enabled: Boolean(row.enabled),
    sort: num(row.sort_order),
    custom: Boolean(row.custom),
  };
}

export const getPublicSettings = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  const caps = await limits(sql);
  return { name: caps.name, tagline: caps.tagline, support: caps.support, help: caps.help };
});

export const createDraft = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => data)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await touchUser(sql, context.userId);
    await assertActive(sql, context.userId);
    const body = asObj(data);
    const type: LinkType = body.type === "presave" || body.type === "bio" ? body.type : "smart";
    const profiles = await sql<{ artist_name: string; username: string; about: string; avatar_url: string; banner_url: string }>`
      select artist_name, username, about, avatar_url, banner_url from artist_profiles where user_id = ${context.userId}
    `;
    const profile = profiles[0];
    const id = nid();
    let slug = `draft-${id.slice(0, 8)}`;
    if (await slugTaken(sql, slug, "")) slug = `draft-${nid().slice(0, 8)}`;
    const artist = profile?.artist_name || "";
    await sql`
      insert into links (
        id, user_id, type, status, title, artist_name, slug, about, username, cover_url, banner_url,
        presave_label, email_heading, email_consent, sections_json
      ) values (
        ${id}, ${context.userId}, ${type}, 'draft', ${""}, ${artist}, ${slug},
        ${type === "bio" ? profile?.about ?? "" : ""},
        ${type === "bio" ? profile?.username ?? "" : ""},
        ${type === "bio" ? profile?.avatar_url ?? "" : ""},
        ${type === "bio" ? profile?.banner_url ?? "" : ""},
        'Pre-Save',
        'Get release updates',
        'I agree to receive email updates about this music and I can opt out at any time.',
        ${JSON.stringify(BIO_SECTIONS)}
      )
    `;
    await logActivity(sql, context.userId, `Started a ${type === "smart" ? "smart link" : type === "presave" ? "pre-save" : "bio link"}.`, `/edit/${id}`);
    return { id };
  });

export const getLink = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((data: unknown) => data)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await touchUser(sql, context.userId);
    const id = str(asObj(data).id, 40);
    return loadOwned(sql, context.userId, id);
  });

export const saveLink = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => data)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await touchUser(sql, context.userId);
    await assertActive(sql, context.userId);
    const caps = await limits(sql);
    const input = readDraftInput(data, caps);
    const current = await loadOwned(sql, context.userId, input.id);
    if (!validSlug(input.slug) || reservedSlug(input.slug)) {
      throw new Error("The public URL needs 3–40 letters, numbers, and hyphens.");
    }
    if (await slugTaken(sql, input.slug, current.id)) throw new Error("That public URL is already taken.");
    if (input.username && (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.username) || reservedSlug(input.username))) {
      throw new Error("Username must use 3–40 letters, numbers, or hyphens.");
    }
    if (await usernameTaken(sql, input.username, current.id, context.userId)) {
      throw new Error("That username is taken.");
    }
    if (input.presaveUrl && !validHttpUrl(input.presaveUrl)) throw new Error("Pre-save URL is invalid.");
    await sql`
      update links set
        title = ${input.title},
        artist_name = ${input.artistName},
        featured_artist = ${input.featuredArtist},
        description = ${input.description},
        cover_url = ${input.coverUrl},
        banner_url = ${input.bannerUrl},
        username = ${input.username},
        slug = ${input.slug},
        about = ${input.about},
        release_date = ${input.releaseDate},
        presave_label = ${input.presaveLabel},
        presave_url = ${input.presaveUrl},
        email_enabled = ${input.emailEnabled},
        email_heading = ${input.emailHeading},
        email_consent = ${input.emailConsent},
        sections_json = ${JSON.stringify(input.sections)},
        gallery_json = ${JSON.stringify(input.gallery)},
        songs_json = ${JSON.stringify(input.songs)},
        publish_at = ${toTs(input.publishAt)},
        updated_at = now()
      where id = ${current.id} and user_id = ${context.userId}
    `;
    await writeDestinations(sql, current.id, input.destinations);
    await logActivity(sql, context.userId, `Saved “${input.title || "Untitled"}”.`, `/edit/${current.id}`);
    return loadOwned(sql, context.userId, current.id);
  });

export const setLinkStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => data)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await touchUser(sql, context.userId);
    await assertActive(sql, context.userId);
    const body = asObj(data);
    const id = str(body.id, 40);
    const next = str(body.status, 20);
    const draft = await loadOwned(sql, context.userId, id);
    let status: LinkStatus = "draft";
    if (next === "published") {
      assertPublishable({ ...draft, slug: draft.slug });
      const when = draft.publishAt ? new Date(toTs(draft.publishAt) ?? "") : null;
      status = when && when.getTime() > Date.now() ? "scheduled" : "published";
    } else if (next === "unpublished") status = "unpublished";
    else if (next === "draft") status = "draft";
    else throw new Error("Unknown status.");
    await sql`
      update links set status = ${status}, updated_at = now()
      where id = ${id} and user_id = ${context.userId}
    `;
    await logActivity(
      sql,
      context.userId,
      `${status === "published" ? "Published" : status === "scheduled" ? "Scheduled" : status === "unpublished" ? "Unpublished" : "Moved to draft"} “${draft.title || "Untitled"}”.`,
      `/edit/${id}`,
    );
    return { status };
  });

export const deleteLink = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => data)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await touchUser(sql, context.userId);
    await assertActive(sql, context.userId);
    const id = str(asObj(data).id, 40);
    const draft = await loadOwned(sql, context.userId, id);
    await sql`delete from events where link_id = ${id}`;
    await sql`delete from email_signups where link_id = ${id}`;
    await sql`delete from links where id = ${id} and user_id = ${context.userId}`;
    await logActivity(sql, context.userId, `Deleted “${draft.title || "Untitled"}”.`, "/library");
    return { ok: true };
  });

export const listLinks = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((data: unknown) => data)
  .handler(async ({ context, data }): Promise<LinkSummary[]> => {
    const sql = await getSql();
    await touchUser(sql, context.userId);
    const body = asObj(data ?? {});
    const tab = str(body.tab, 20);
    const status = str(body.status, 20);
    const q = str(body.q, 80).replace(/[%_]/g, "");
    const sort = str(body.sort, 20);
    const order =
      sort === "title" ? "l.title asc" :
      sort === "views" ? "views desc, l.updated_at desc" :
      sort === "clicks" ? "clicks desc, l.updated_at desc" :
      sort === "created" ? "l.created_at desc" :
      "l.updated_at desc";
    const params: unknown[] = [context.userId];
    let where = "l.user_id = $1";
    if (tab === "smart" || tab === "presave" || tab === "bio") {
      params.push(tab);
      where += ` and l.type = $${params.length}`;
    }
    if (status === "draft" || status === "published" || status === "unpublished" || status === "scheduled") {
      params.push(status);
      where += ` and l.status = $${params.length}`;
    }
    if (q) {
      params.push(`%${q}%`);
      const p = `$${params.length}`;
      where += ` and (l.title ilike ${p} or l.artist_name ilike ${p} or l.slug ilike ${p})`;
    }
    const rows = await sql.query<{
      id: string;
      type: string;
      status: string;
      title: string;
      artist_name: string;
      slug: string;
      cover_url: string;
      views: number;
      clicks: number;
      created_at: unknown;
      updated_at: unknown;
    }>(
      `select l.id, l.type, l.status, l.title, l.artist_name, l.slug, l.cover_url,
        l.created_at, l.updated_at,
        (select count(*)::int from events e where e.link_id = l.id and e.kind = 'view') as views,
        (select count(*)::int from events e where e.link_id = l.id and e.kind = 'click') as clicks
       from links l
       where ${where}
       order by ${order}
       limit 100`,
      params,
    );
    return rows.map((row) => ({
      id: row.id,
      type: asType(row.type),
      status: asStatus(row.status),
      title: row.title || "Untitled",
      artistName: row.artist_name,
      slug: row.slug,
      coverUrl: row.cover_url,
      views: num(row.views),
      clicks: num(row.clicks),
      createdAt: iso(row.created_at),
      updatedAt: iso(row.updated_at),
    }));
  });

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await touchUser(sql, context.userId);
    const stats = await sql<{ views: number; clicks: number; published: number; audience: number }>`
      select
        (select count(*)::int from events e where e.owner_id = ${context.userId} and e.kind = 'view') as views,
        (select count(*)::int from events e where e.owner_id = ${context.userId} and e.kind = 'click') as clicks,
        (select count(*)::int from links l where l.user_id = ${context.userId} and l.status = 'published') as published,
        (select count(distinct e.visitor_hash)::int from events e where e.owner_id = ${context.userId} and e.kind = 'view' and e.visitor_hash <> '') as audience
    `;
    const row = stats[0];
    const recentRows = await sql<{
      id: string;
      type: string;
      status: string;
      title: string;
      artist_name: string;
      slug: string;
      cover_url: string;
      created_at: unknown;
      updated_at: unknown;
      views: number;
      clicks: number;
    }>`
      select l.id, l.type, l.status, l.title, l.artist_name, l.slug, l.cover_url, l.created_at, l.updated_at,
        (select count(*)::int from events e where e.link_id = l.id and e.kind = 'view') as views,
        (select count(*)::int from events e where e.link_id = l.id and e.kind = 'click') as clicks
      from links l where l.user_id = ${context.userId}
      order by l.updated_at desc limit 4
    `;
    const activity = await sql<{ message: string; href: string; created_at: unknown }>`
      select message, href, created_at from activity
      where user_id = ${context.userId}
      order by created_at desc limit 8
    `;
    return {
      views: num(row?.views),
      clicks: num(row?.clicks),
      published: num(row?.published),
      audience: num(row?.audience),
      recent: recentRows.map((item) => ({
        id: item.id,
        type: asType(item.type),
        status: asStatus(item.status),
        title: item.title || "Untitled",
        artistName: item.artist_name,
        slug: item.slug,
        coverUrl: item.cover_url,
        views: num(item.views),
        clicks: num(item.clicks),
        createdAt: iso(item.created_at),
        updatedAt: iso(item.updated_at),
      })),
      activity: activity.map((item) => ({
        message: item.message,
        href: item.href,
        createdAt: iso(item.created_at),
      })),
    };
  });

export const getAnalytics = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((data: unknown) => data)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await touchUser(sql, context.userId);
    const id = str(asObj(data ?? {}).id, 40);
    if (id) await loadOwned(sql, context.userId, id);
    return analyticsFor(sql, context.userId, id || null);
  });

export const listEmails = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await touchUser(sql, context.userId);
    const rows = await sql<{
      id: string;
      email: string;
      consent_text: string;
      created_at: unknown;
      title: string;
      type: string;
      slug: string;
    }>`
      select s.id, s.email, s.consent_text, s.created_at, l.title, l.type, l.slug
      from email_signups s
      join links l on l.id = s.link_id
      where s.owner_id = ${context.userId}
      order by s.created_at desc
      limit 500
    `;
    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      consent: row.consent_text,
      createdAt: iso(row.created_at),
      linkTitle: row.title || "Untitled",
      linkType: asType(row.type),
      slug: row.slug,
    }));
  });

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await touchUser(sql, context.userId);
    const rows = await sql<{
      id: string;
      title: string;
      body: string;
      image_url: string;
      dest_url: string;
      created_at: unknown;
      read: boolean;
    }>`
      select n.id, n.title, n.body, n.image_url, n.dest_url, n.created_at,
        (r.user_id is not null) as read
      from notifications n
      left join notification_reads r on r.notification_id = n.id and r.user_id = ${context.userId}
      where n.published = true
        and (n.user_id is null or n.user_id = ${context.userId})
        and (n.starts_at is null or n.starts_at <= now())
      order by n.created_at desc
      limit 50
    `;
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      imageUrl: row.image_url,
      destUrl: row.dest_url,
      createdAt: iso(row.created_at),
      read: Boolean(row.read),
    }));
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => data)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const id = str(asObj(data).id, 40);
    const rows = await sql<{ id: string }>`
      select id from notifications
      where id = ${id} and published = true and (user_id is null or user_id = ${context.userId})
    `;
    if (!rows[0]) throw new Error("Notification not found.");
    await sql`
      insert into notification_reads (user_id, notification_id)
      values (${context.userId}, ${id})
      on conflict do nothing
    `;
    return { ok: true };
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await sql`
      insert into notification_reads (user_id, notification_id)
      select ${context.userId}, n.id from notifications n
      where n.published = true
        and (n.user_id is null or n.user_id = ${context.userId})
        and (n.starts_at is null or n.starts_at <= now())
      on conflict do nothing
    `;
    return { ok: true };
  });

export const getPublicLink = createServerFn({ method: "GET" })
  .validator((data: unknown) => data)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const slug = str(asObj(data).slug, 40);
    const row = await findLive(sql, slug);
    if (!row) return null;
    const draft = draftFrom(row, await destinationsFor(sql, row.id));
    const banner = await activeAd(sql, "public_footer");
    const video = await activeAd(sql, "public_video");
    return { link: draft, banner, video };
  });

export const getHomeAd = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  return activeAd(sql, "home_quick");
});

type AdDto = {
  id: string;
  kind: "banner" | "video";
  name: string;
  advertiser: string;
  imageUrl: string;
  videoUrl: string;
  destUrl: string;
  placement: string;
};

async function activeAd(sql: Sql, placement: string): Promise<AdDto | null> {
  const rows = await sql<{
    id: string;
    kind: string;
    name: string;
    advertiser: string;
    image_url: string;
    video_url: string;
    dest_url: string;
    placement: string;
  }>`
    select id, kind, name, advertiser, image_url, video_url, dest_url, placement
    from ads
    where active = true and placement = ${placement}
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at >= now())
    order by updated_at desc
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    kind: row.kind === "video" ? "video" : "banner",
    name: row.name,
    advertiser: row.advertiser,
    imageUrl: row.image_url,
    videoUrl: row.video_url,
    destUrl: row.dest_url,
    placement: row.placement,
  };
}

export const recordView = createServerFn({ method: "POST" })
  .validator((data: unknown) => data)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const slug = str(asObj(data).slug, 40);
    const row = await findLive(sql, slug);
    if (!row) return { ok: false };
    const who = await visitor();
    await rateLimit(sql, `view:${row.id}:${who.hash}`, 12, 60);
    await sql`
      insert into events (link_id, owner_id, kind, target, visitor_hash, country, device)
      values (${row.id}, ${row.user_id}, 'view', '', ${who.hash}, ${who.country}, ${who.device})
    `;
    return { ok: true };
  });

export const recordClick = createServerFn({ method: "POST" })
  .validator((data: unknown) => data)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const body = asObj(data);
    const slug = str(body.slug, 40);
    const row = await findLive(sql, slug);
    if (!row) return { ok: false };
    const who = await visitor();
    await rateLimit(sql, `click:${row.id}:${who.hash}`, 40, 60);
    let target = "";
    if (body.presave === true) {
      target = `presave|${row.presave_label || "Pre-Save"}`;
    } else {
      const destId = str(body.destinationId, 40);
      const dest = await sql<{ kind: string; name: string }>`
        select kind, name from destinations where id = ${destId} and link_id = ${row.id}
      `;
      if (!dest[0]) return { ok: false };
      target = `${dest[0].kind}|${dest[0].name}`;
    }
    await sql`
      insert into events (link_id, owner_id, kind, target, visitor_hash, country, device)
      values (${row.id}, ${row.user_id}, 'click', ${target}, ${who.hash}, ${who.country}, ${who.device})
    `;
    return { ok: true };
  });

export const submitEmail = createServerFn({ method: "POST" })
  .validator((data: unknown) => data)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const body = asObj(data);
    const slug = str(body.slug, 40);
    const email = str(body.email, 180).toLowerCase();
    if (!validEmail(email)) throw new Error("Enter a valid email address.");
    if (body.consent !== true) throw new Error("Consent is required.");
    const row = await findLive(sql, slug);
    if (!row || !row.email_enabled) throw new Error("This page is not collecting email.");
    const who = await visitor();
    await rateLimit(sql, `email:${row.id}:${who.hash}`, 5, 3600);
    const existing = await sql<{ id: string }>`
      select id from email_signups where link_id = ${row.id} and lower(email) = ${email} limit 1
    `;
    if (existing[0]) return { ok: true, already: true };
    await sql`
      insert into email_signups (id, link_id, owner_id, email, consent_text)
      values (${nid()}, ${row.id}, ${row.user_id}, ${email}, ${row.email_consent})
    `;
    await sql`
      insert into events (link_id, owner_id, kind, target, visitor_hash, country, device)
      values (${row.id}, ${row.user_id}, 'email', 'email', ${who.hash}, ${who.country}, ${who.device})
    `;
    return { ok: true, already: false };
  });

export const recordAdEvent = createServerFn({ method: "POST" })
  .validator((data: unknown) => data)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const body = asObj(data);
    const id = str(body.id, 40);
    const kind = body.kind === "click" ? "click" : "impression";
    const rows = await sql<{ id: string }>`
      select id from ads
      where id = ${id} and active = true
        and (starts_at is null or starts_at <= now())
        and (ends_at is null or ends_at >= now())
    `;
    if (!rows[0]) return { ok: false };
    const who = await visitor();
    await rateLimit(sql, `ad:${kind}:${id}:${who.hash}`, kind === "impression" ? 2 : 8, 3600);
    await sql`insert into ad_events (ad_id, kind) values (${id}, ${kind})`;
    return { ok: true };
  });

function mapAd(row: {
  id: string;
  kind: string;
  name: string;
  advertiser: string;
  image_url: string;
  video_url: string;
  dest_url: string;
  placement: string;
  active: boolean;
  starts_at: unknown;
  ends_at: unknown;
  impressions: number;
  clicks: number;
}) {
  return {
    id: row.id,
    kind: row.kind === "video" ? "video" as const : "banner" as const,
    name: row.name,
    advertiser: row.advertiser,
    imageUrl: row.image_url,
    videoUrl: row.video_url,
    destUrl: row.dest_url,
    placement: row.placement,
    active: Boolean(row.active),
    startsAt: fromTs(row.starts_at),
    endsAt: fromTs(row.ends_at),
    impressions: num(row.impressions),
    clicks: num(row.clicks),
  };
}

const AD_SELECT = `
  select a.*,
    (select count(*)::int from ad_events e where e.ad_id = a.id and e.kind = 'impression') as impressions,
    (select count(*)::int from ad_events e where e.ad_id = a.id and e.kind = 'click') as clicks
  from ads a
`;

export const adminOverview = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await touchUser(sql, context.userId);
    await assertAdmin(sql, context.userId);
    const counts = await sql<{
      users: number;
      links: number;
      smart: number;
      presave: number;
      bio: number;
      impressions: number;
      ad_clicks: number;
    }>`
      select
        (select count(*)::int from "user") as users,
        (select count(*)::int from links where status = 'published') as links,
        (select count(*)::int from links where type = 'smart') as smart,
        (select count(*)::int from links where type = 'presave') as presave,
        (select count(*)::int from links where type = 'bio') as bio,
        (select count(*)::int from ad_events where kind = 'impression') as impressions,
        (select count(*)::int from ad_events where kind = 'click') as ad_clicks
    `;
    const days = await sql<{ day: string; n: number }>`
      select to_char(created_at at time zone 'utc', 'YYYY-MM-DD') as day, count(*)::int as n
      from events
      where created_at > now() - interval '14 days'
      group by 1 order by 1
    `;
    const auditRows = await sql<{ action: string; target: string; detail: string; created_at: unknown; email: string }>`
      select a.action, a.target, a.detail, a.created_at, coalesce(u.email, a.admin_id) as email
      from audit_log a
      left join "user" u on u.id = a.admin_id
      order by a.created_at desc limit 8
    `;
    const row = counts[0];
    return {
      users: num(row?.users),
      published: num(row?.links),
      smart: num(row?.smart),
      presave: num(row?.presave),
      bio: num(row?.bio),
      impressions: num(row?.impressions),
      adClicks: num(row?.ad_clicks),
      days: days.map((item) => ({ day: item.day, n: num(item.n) })),
      audit: auditRows.map((item) => ({
        action: item.action,
        target: item.target,
        detail: item.detail,
        email: item.email,
        createdAt: iso(item.created_at),
      })),
    };
  });

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((data: unknown) => data)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await touchUser(sql, context.userId);
    await assertAdmin(sql, context.userId);
    const q = str(asObj(data ?? {}).q, 80).replace(/[%_]/g, "");
    const like = `%${q}%`;
    const rows = await sql.query<{
      id: string;
      email: string;
      name: string;
      artist_name: string;
      role: string;
      suspended: boolean;
      links: number;
      created_at: unknown;
    }>(
      `select u.id, u.email, u.name,
          coalesce(p.artist_name, '') as artist_name,
          coalesce(r.role, 'user') as role,
          coalesce(r.suspended, false) as suspended,
          (select count(*)::int from links l where l.user_id = u.id) as links,
          u."createdAt" as created_at
       from "user" u
       left join artist_profiles p on p.user_id = u.id
       left join user_roles r on r.user_id = u.id
       where ($1 = '%%' or u.email ilike $1 or u.name ilike $1 or coalesce(p.artist_name,'') ilike $1)
       order by u."createdAt" desc
       limit 100`,
      [like],
    );
    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      artistName: row.artist_name,
      role: row.role === "admin" ? "admin" as const : "user" as const,
      suspended: Boolean(row.suspended),
      links: num(row.links),
      createdAt: iso(row.created_at),
    }));
  });

export const adminSetUser = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => data)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await touchUser(sql, context.userId);
    await assertAdmin(sql, context.userId);
    const body = asObj(data);
    const userId = str(body.userId, 80);
    const action = str(body.action, 20);
    if (!userId) throw new Error("Missing user.");
    if (userId === context.userId && (action === "suspend" || action === "demote" || action === "delete")) {
      throw new Error("Use account settings for changes to your own account.");
    }
    await sql`insert into user_roles (user_id) values (${userId}) on conflict (user_id) do nothing`;
    if (action === "suspend") {
      const reason = str(body.reason, 200) || "Suspended by an administrator.";
      await sql`update user_roles set suspended = true, suspended_reason = ${reason} where user_id = ${userId}`;
      await audit(sql, context.userId, "suspend-user", userId, reason);
    } else if (action === "restore") {
      await sql`update user_roles set suspended = false, suspended_reason = '' where user_id = ${userId}`;
      await audit(sql, context.userId, "restore-user", userId, "Account restored.");
    } else if (action === "promote") {
      await sql`update user_roles set role = 'admin' where user_id = ${userId}`;
      await audit(sql, context.userId, "promote-admin", userId, "Granted administrator.");
    } else if (action === "demote") {
      if ((await adminCount(sql)) <= 1) throw new Error("Keep at least one administrator.");
      await sql`update user_roles set role = 'user' where user_id = ${userId}`;
      await audit(sql, context.userId, "demote-admin", userId, "Removed administrator.");
    } else if (action === "delete") {
      const roles = await sql<{ role: string }>`select role from user_roles where user_id = ${userId}`;
      if (roles[0]?.role === "admin" && (await adminCount(sql)) <= 1) {
        throw new Error("Cannot delete the last administrator.");
      }
      await sql`delete from events where owner_id = ${userId}`;
      await sql`delete from email_signups where owner_id = ${userId}`;
      await sql`delete from activity where user_id = ${userId}`;
      await sql`delete from links where user_id = ${userId}`;
      await sql`delete from notification_reads where user_id = ${userId}`;
      await sql`delete from notifications where user_id = ${userId}`;
      await sql`delete from support_reports where user_id = ${userId}`;
      await sql`delete from artist_profiles where user_id = ${userId}`;
      await sql`delete from user_roles where user_id = ${userId}`;
      await sql`delete from "session" where "userId" = ${userId}`;
      await sql`delete from "account" where "userId" = ${userId}`;
      await sql`delete from "user" where id = ${userId}`;
      await audit(sql, context.userId, "delete-user", userId, "Account deleted.");
    } else throw new Error("Unknown action.");
    return { ok: true };
  });

export const adminListLinks = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((data: unknown) => data)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await touchUser(sql, context.userId);
    await assertAdmin(sql, context.userId);
    const body = asObj(data ?? {});
    const q = str(body.q, 80).replace(/[%_]/g, "");
    const type = str(body.type, 20);
    const params: unknown[] = [`%${q}%`];
    let where = `($1 = '%%' or l.title ilike $1 or l.slug ilike $1 or u.email ilike $1)`;
    if (type === "smart" || type === "presave" || type === "bio") {
      params.push(type);
      where += ` and l.type = $${params.length}`;
    }
    const rows = await sql.query<{
      id: string;
      type: string;
      status: string;
      title: string;
      slug: string;
      email: string;
      views: number;
      clicks: number;
      updated_at: unknown;
    }>(
      `select l.id, l.type, l.status, l.title, l.slug, u.email, l.updated_at,
          (select count(*)::int from events e where e.link_id = l.id and e.kind = 'view') as views,
          (select count(*)::int from events e where e.link_id = l.id and e.kind = 'click') as clicks
       from links l join "user" u on u.id = l.user_id
       where ${where}
       order by l.updated_at desc
       limit 100`,
      params,
    );
    return rows.map((row) => ({
      id: row.id,
      type: asType(row.type),
      status: asStatus(row.status),
      title: row.title || "Untitled",
      slug: row.slug,
      email: row.email,
      views: num(row.views),
      clicks: num(row.clicks),
      updatedAt: iso(row.updated_at),
    }));
  });

export const adminModerateLink = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => data)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await touchUser(sql, context.userId);
    await assertAdmin(sql, context.userId);
    const body = asObj(data);
    const id = str(body.id, 40);
    const action = str(body.action, 20);
    const rows = await sql<{ user_id: string; title: string; status: string }>`
      select user_id, title, status from links where id = ${id}
    `;
    const link = rows[0];
    if (!link) throw new Error("Link not found.");
    if (action === "unpublish") {
      await sql`update links set status = 'unpublished', updated_at = now() where id = ${id}`;
      await sql`
        insert into notifications (id, user_id, title, body, dest_url, published, created_by)
        values (
          ${nid()}, ${link.user_id}, ${"A link was unpublished"},
          ${`“${link.title || "Untitled"}” was unpublished by ARTLink because it did not follow the platform rules.`},
          '/library', true, ${context.userId}
        )
      `;
      await audit(sql, context.userId, "unpublish-link", id, link.title);
    } else if (action === "restore") {
      await sql`update links set status = 'published', updated_at = now() where id = ${id}`;
      await audit(sql, context.userId, "restore-link", id, link.title);
    } else if (action === "delete") {
      await sql`delete from events where link_id = ${id}`;
      await sql`delete from email_signups where link_id = ${id}`;
      await sql`delete from links where id = ${id}`;
      await audit(sql, context.userId, "delete-link", id, link.title);
    } else throw new Error("Unknown action.");
    return { ok: true };
  });

export const adminListAds = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await touchUser(sql, context.userId);
    await assertAdmin(sql, context.userId);
    const rows = await sql.query<Parameters<typeof mapAd>[0]>(`${AD_SELECT} order by a.updated_at desc limit 50`);
    return rows.map(mapAd);
  });

export const adminSaveAd = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => data)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await touchUser(sql, context.userId);
    await assertAdmin(sql, context.userId);
    const caps = await limits(sql);
    const body = asObj(data);
    const kind = body.kind === "video" ? "video" : "banner";
    const name = str(body.name, 120);
    const advertiser = str(body.advertiser, 120);
    const destUrl = str(body.destUrl, 2000);
    const placement = str(body.placement, 40);
    const placements = new Set(["home_quick", "public_footer", "public_video"]);
    if (!name || !advertiser) throw new Error("Name and advertiser are required.");
    if (!validHttpUrl(destUrl)) throw new Error("Advertisements need an http(s) destination.");
    if (!placements.has(placement)) throw new Error("Choose a placement.");
    if (kind === "banner" && placement === "public_video") throw new Error("Banner ads cannot use the video placement.");
    if (kind === "video" && placement !== "public_video") throw new Error("Video ads use the public-page video placement.");
    const imageUrl = str(body.imageUrl, caps.imageChars);
    const videoUrl = str(body.videoUrl, caps.videoChars);
    if (kind === "banner" && !imageOk(imageUrl, caps.imageChars)) throw new Error("Upload a banner image.");
    if (kind === "banner" && !imageUrl) throw new Error("Upload a banner image.");
    if (kind === "video" && !videoOk(videoUrl, caps.videoChars)) throw new Error("Add an MP4, WebM, or HTTPS video.");
    if (kind === "video" && !videoUrl) throw new Error("Add a video file or HTTPS URL.");
    const id = str(body.id, 40) || nid();
    const startsAt = toTs(str(body.startsAt, 40));
    const endsAt = toTs(str(body.endsAt, 40));
    const active = Boolean(body.active);
    const existing = await sql<{ id: string }>`select id from ads where id = ${id}`;
    if (existing[0]) {
      await sql`
        update ads set kind = ${kind}, name = ${name}, advertiser = ${advertiser},
          image_url = ${imageUrl}, video_url = ${videoUrl}, dest_url = ${destUrl},
          placement = ${placement}, starts_at = ${startsAt}, ends_at = ${endsAt},
          active = ${active}, updated_at = now()
        where id = ${id}
      `;
      await audit(sql, context.userId, "update-ad", id, name);
    } else {
      await sql`
        insert into ads (id, kind, name, advertiser, image_url, video_url, dest_url, placement, starts_at, ends_at, active)
        values (${id}, ${kind}, ${name}, ${advertiser}, ${imageUrl}, ${videoUrl}, ${destUrl}, ${placement}, ${startsAt}, ${endsAt}, ${active})
      `;
      await audit(sql, context.userId, "create-ad", id, name);
    }
    return { id };
  });

export const adminDeleteAd = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => data)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await touchUser(sql, context.userId);
    await assertAdmin(sql, context.userId);
    const id = str(asObj(data).id, 40);
    await sql`delete from ad_events where ad_id = ${id}`;
    await sql`delete from ads where id = ${id}`;
    await audit(sql, context.userId, "delete-ad", id, "Advertisement deleted.");
    return { ok: true };
  });

export const adminListNotifications = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await touchUser(sql, context.userId);
    await assertAdmin(sql, context.userId);
    const rows = await sql<{
      id: string;
      title: string;
      body: string;
      image_url: string;
      dest_url: string;
      published: boolean;
      starts_at: unknown;
      created_at: unknown;
      user_id: string | null;
    }>`
      select id, title, body, image_url, dest_url, published, starts_at, created_at, user_id
      from notifications
      where user_id is null
      order by created_at desc
      limit 50
    `;
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      imageUrl: row.image_url,
      destUrl: row.dest_url,
      published: Boolean(row.published),
      startsAt: fromTs(row.starts_at),
      createdAt: iso(row.created_at),
    }));
  });

export const adminSaveNotification = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => data)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await touchUser(sql, context.userId);
    await assertAdmin(sql, context.userId);
    const caps = await limits(sql);
    const body = asObj(data);
    const title = str(body.title, 140);
    const message = str(body.body, 2000);
    if (title.length < 2) throw new Error("Add a notification title.");
    const imageUrl = str(body.imageUrl, caps.imageChars);
    if (!imageOk(imageUrl, caps.imageChars)) throw new Error("Notification image is not allowed.");
    const destUrl = safeDest(str(body.destUrl, 2000));
    const published = Boolean(body.published);
    const startsAt = toTs(str(body.startsAt, 40));
    const id = str(body.id, 40) || nid();
    const existing = await sql<{ id: string }>`select id from notifications where id = ${id} and user_id is null`;
    if (existing[0]) {
      await sql`
        update notifications set title = ${title}, body = ${message}, image_url = ${imageUrl},
          dest_url = ${destUrl}, published = ${published}, starts_at = ${startsAt}, updated_at = now()
        where id = ${id} and user_id is null
      `;
      await audit(sql, context.userId, "update-notification", id, title);
    } else {
      await sql`
        insert into notifications (id, user_id, title, body, image_url, dest_url, published, created_by, starts_at)
        values (${id}, null, ${title}, ${message}, ${imageUrl}, ${destUrl}, ${published}, ${context.userId}, ${startsAt})
      `;
      await audit(sql, context.userId, "create-notification", id, title);
    }
    return { id };
  });

export const adminDeleteNotification = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => data)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await touchUser(sql, context.userId);
    await assertAdmin(sql, context.userId);
    const id = str(asObj(data).id, 40);
    await sql`delete from notifications where id = ${id} and user_id is null`;
    await audit(sql, context.userId, "delete-notification", id, "Notification deleted.");
    return { ok: true };
  });

export const adminListCatalog = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await touchUser(sql, context.userId);
    await assertAdmin(sql, context.userId);
    const rows = await sql<{
      id: string; name: string; kind: string; color: string; ink: string; glyph: string;
      enabled: boolean; sort_order: number; custom: boolean;
    }>`select * from store_catalog order by kind, sort_order, name`;
    return rows.map(toCatalog);
  });

export const adminSaveStore = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => data)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await touchUser(sql, context.userId);
    await assertAdmin(sql, context.userId);
    const body = asObj(data);
    const action = str(body.action, 20) || "save";
    const id = str(body.id, 40);
    if (action === "delete") {
      const rows = await sql<{ custom: boolean; name: string }>`select custom, name from store_catalog where id = ${id}`;
      if (!rows[0]?.custom) throw new Error("Built-in stores can be disabled, not deleted.");
      await sql`delete from store_catalog where id = ${id}`;
      await audit(sql, context.userId, "delete-store", id, rows[0].name);
      return { ok: true };
    }
    const name = str(body.name, 80);
    const kind = body.kind === "social" ? "social" : "store";
    const color = str(body.color, 7);
    const ink = body.ink === "dark" ? "dark" : "light";
    const glyph = GLYPHS.has(str(body.glyph, 20)) ? str(body.glyph, 20) : "mono";
    const enabled = body.enabled !== false;
    if (!name || !/^#[0-9a-fA-F]{6}$/.test(color)) throw new Error("Name and a #RRGGBB color are required.");
    if (id) {
      await sql`
        update store_catalog set name = ${name}, kind = ${kind}, color = ${color}, ink = ${ink},
          glyph = ${glyph}, enabled = ${enabled}
        where id = ${id}
      `;
      await audit(sql, context.userId, "update-store", id, name);
      return { id };
    }
    const newId = `custom-${nid().slice(0, 8)}`;
    const sortRows = await sql<{ n: number }>`select coalesce(max(sort_order), 0)::int as n from store_catalog where kind = ${kind}`;
    await sql`
      insert into store_catalog (id, name, kind, color, ink, glyph, enabled, sort_order, custom)
      values (${newId}, ${name}, ${kind}, ${color}, ${ink}, ${glyph}, ${enabled}, ${num(sortRows[0]?.n) + 1}, true)
    `;
    await audit(sql, context.userId, "create-store", newId, name);
    return { id: newId };
  });

export const adminGetSettings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await touchUser(sql, context.userId);
    await assertAdmin(sql, context.userId);
    const caps = await limits(sql);
    return caps;
  });

export const adminSaveSettings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => data)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await touchUser(sql, context.userId);
    await assertAdmin(sql, context.userId);
    const body = asObj(data);
    const name = str(body.name, 40) || "ARTLink";
    const tagline = str(body.tagline, 180);
    const support = str(body.support, 180);
    if (support && !validEmail(support)) throw new Error("Support email is invalid.");
    const help = str(body.help, 8000);
    const image = Math.min(2_000_000, Math.max(200_000, num(body.image) || 1_200_000));
    const video = Math.min(8_000_000, Math.max(500_000, num(body.video) || 4_000_000));
    const entries: [string, string][] = [
      ["platform_name", name],
      ["tagline", tagline],
      ["support_email", support],
      ["help_body", help],
      ["image_max_bytes", String(image)],
      ["video_max_bytes", String(video)],
    ];
    for (const [key, value] of entries) {
      await sql`
        insert into platform_settings (key, value) values (${key}, ${value})
        on conflict (key) do update set value = ${value}
      `;
    }
    await audit(sql, context.userId, "update-settings", "platform", name);
    return { ok: true };
  });

export const adminListReports = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await touchUser(sql, context.userId);
    await assertAdmin(sql, context.userId);
    const rows = await sql<{
      id: string; subject: string; body: string; status: string; created_at: unknown; email: string;
    }>`
      select s.id, s.subject, s.body, s.status, s.created_at, u.email
      from support_reports s join "user" u on u.id = s.user_id
      order by s.created_at desc limit 100
    `;
    return rows.map((row) => ({
      id: row.id,
      subject: row.subject,
      body: row.body,
      status: row.status,
      email: row.email,
      createdAt: iso(row.created_at),
    }));
  });

export const adminResolveReport = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => data)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await touchUser(sql, context.userId);
    await assertAdmin(sql, context.userId);
    const id = str(asObj(data).id, 40);
    await sql`update support_reports set status = 'resolved' where id = ${id}`;
    await audit(sql, context.userId, "resolve-report", id, "Marked resolved.");
    return { ok: true };
  });
