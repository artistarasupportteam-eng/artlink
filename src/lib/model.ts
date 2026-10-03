export type LinkType = "smart" | "presave" | "bio";
export type LinkStatus = "draft" | "published" | "unpublished" | "scheduled";
export type DestKind = "store" | "social" | "custom";
export type ThemeChoice = "dark" | "light" | "system";

export type Destination = {
  id: string;
  kind: DestKind;
  name: string;
  iconKey: string;
  url: string;
  sort: number;
};

export type SectionPref = { id: string; label: string; visible: boolean };
export type GalleryItem = { id: string; url: string; caption: string };
export type SongItem = { id: string; title: string; url: string; cover: string };

export type LinkDraft = {
  id: string;
  type: LinkType;
  status: LinkStatus;
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
  createdAt: string;
  updatedAt: string;
};

export type LinkSummary = {
  id: string;
  type: LinkType;
  status: LinkStatus;
  title: string;
  artistName: string;
  slug: string;
  coverUrl: string;
  views: number;
  clicks: number;
  createdAt: string;
  updatedAt: string;
};

export type CatalogItem = {
  id: string;
  name: string;
  kind: "store" | "social";
  color: string;
  ink: "light" | "dark";
  glyph: string;
  enabled: boolean;
  sort: number;
  custom: boolean;
};

export type Me = {
  userId: string;
  email: string;
  name: string;
  image: string;
  artistName: string;
  username: string;
  about: string;
  avatarUrl: string;
  bannerUrl: string;
  theme: ThemeChoice;
  role: "admin" | "user";
  suspended: boolean;
  adminExists: boolean;
  unread: number;
};

export const BIO_SECTIONS: SectionPref[] = [
  { id: "about", label: "About", visible: true },
  { id: "music", label: "Music stores", visible: true },
  { id: "social", label: "Social", visible: true },
  { id: "custom", label: "Custom links", visible: true },
  { id: "songs", label: "Releases", visible: true },
  { id: "gallery", label: "Gallery", visible: true },
  { id: "email", label: "Email collection", visible: true },
];

export const SECTION_IDS = BIO_SECTIONS.map((s) => s.id);

export function typeLabel(type: LinkType): string {
  if (type === "smart") return "Smart Link";
  if (type === "presave") return "Pre-Save Link";
  return "Bio Link";
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function validSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length >= 3 && slug.length <= 40;
}

export function validHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 180;
}

export function publicPath(slug: string): string {
  return `/l/${slug}`;
}

const RESERVED = new Set([
  "admin",
  "api",
  "login",
  "create",
  "library",
  "analytics",
  "profile",
  "settings",
  "help",
  "about",
  "privacy",
  "terms",
  "artlink",
  "www",
]);

export function reservedSlug(slug: string): boolean {
  return RESERVED.has(slug);
}
