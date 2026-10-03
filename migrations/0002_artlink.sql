-- ARTLink application schema. Auth tables live in 0001_auth.sql.

create table if not exists artist_profiles (
  user_id text primary key,
  artist_name text not null default '',
  username text not null default '',
  about text not null default '',
  avatar_url text not null default '',
  banner_url text not null default '',
  theme text not null default 'dark',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists artist_profiles_username_idx
  on artist_profiles (lower(username))
  where username <> '';

create table if not exists user_roles (
  user_id text primary key,
  role text not null default 'user',
  suspended boolean not null default false,
  suspended_reason text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists links (
  id text primary key,
  user_id text not null,
  type text not null,
  status text not null default 'draft',
  title text not null default '',
  artist_name text not null default '',
  featured_artist text not null default '',
  description text not null default '',
  cover_url text not null default '',
  banner_url text not null default '',
  username text not null default '',
  slug text not null,
  about text not null default '',
  release_date text not null default '',
  presave_label text not null default 'Pre-Save',
  presave_url text not null default '',
  email_enabled boolean not null default false,
  email_heading text not null default '',
  email_consent text not null default '',
  sections_json text not null default '[]',
  gallery_json text not null default '[]',
  songs_json text not null default '[]',
  publish_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists links_slug_idx on links (lower(slug));
create index if not exists links_user_idx on links (user_id, updated_at desc);
create index if not exists links_status_idx on links (status);

create table if not exists destinations (
  id text primary key,
  link_id text not null references links (id) on delete cascade,
  kind text not null,
  name text not null,
  icon_key text not null default '',
  url text not null default '',
  sort_order integer not null default 0
);

create index if not exists destinations_link_idx on destinations (link_id, sort_order);

create table if not exists email_signups (
  id text primary key,
  link_id text not null,
  owner_id text not null,
  email text not null,
  consent_text text not null default '',
  created_at timestamptz not null default now()
);

create unique index if not exists email_signups_link_email_idx
  on email_signups (link_id, lower(email));
create index if not exists email_signups_owner_idx on email_signups (owner_id, created_at desc);

create table if not exists events (
  id bigserial primary key,
  link_id text not null,
  owner_id text not null,
  kind text not null,
  target text not null default '',
  visitor_hash text not null default '',
  country text not null default '',
  device text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists events_owner_idx on events (owner_id, created_at desc);
create index if not exists events_link_idx on events (link_id, kind, created_at desc);

create table if not exists activity (
  id text primary key,
  user_id text not null,
  message text not null,
  href text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists activity_user_idx on activity (user_id, created_at desc);

create table if not exists notifications (
  id text primary key,
  user_id text,
  title text not null,
  body text not null default '',
  image_url text not null default '',
  dest_url text not null default '',
  published boolean not null default false,
  created_by text not null,
  starts_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notifications_feed_idx on notifications (published, created_at desc);

create table if not exists notification_reads (
  user_id text not null,
  notification_id text not null references notifications (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, notification_id)
);

create table if not exists ads (
  id text primary key,
  kind text not null,
  name text not null,
  advertiser text not null default '',
  image_url text not null default '',
  video_url text not null default '',
  dest_url text not null default '',
  placement text not null,
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ads_placement_idx on ads (placement, active);

create table if not exists ad_events (
  id bigserial primary key,
  ad_id text not null,
  kind text not null,
  created_at timestamptz not null default now()
);

create index if not exists ad_events_ad_idx on ad_events (ad_id, kind);

create table if not exists platform_settings (
  key text primary key,
  value text not null
);

create table if not exists support_reports (
  id text primary key,
  user_id text not null,
  subject text not null,
  body text not null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table if not exists audit_log (
  id text primary key,
  admin_id text not null,
  action text not null,
  target text not null default '',
  detail text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists audit_log_created_idx on audit_log (created_at desc);

create table if not exists store_catalog (
  id text primary key,
  name text not null,
  kind text not null,
  color text not null,
  ink text not null default 'light',
  glyph text not null,
  enabled boolean not null default true,
  sort_order integer not null default 0,
  custom boolean not null default false
);

create table if not exists rate_hits (
  id bigserial primary key,
  bucket text not null,
  created_at timestamptz not null default now()
);

create index if not exists rate_hits_bucket_idx on rate_hits (bucket, created_at desc);

insert into platform_settings (key, value) values
  ('platform_name', 'ARTLink'),
  ('tagline', 'Smart links for released songs, upcoming music, and artist pages.'),
  ('support_email', ''),
  ('help_body', ''),
  ('image_max_bytes', '1200000'),
  ('video_max_bytes', '4000000')
on conflict (key) do nothing;
