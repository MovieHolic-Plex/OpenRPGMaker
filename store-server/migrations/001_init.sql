-- OPRN 에셋 스토어 스키마 v1. 표 이름은 store_ 접두사(공유 Postgres 에 다른 앱 표와 섞여도 구분된다).
-- 판본(store_versions)은 고칠 수도 지울 수도 없다 — 트리거가 막는다.

create table if not exists store_users (
  id bigserial primary key,
  email text not null unique,
  display_name text not null,
  google_sub text unique,
  role text not null default 'user' check (role in ('user', 'admin')),
  blocked boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists store_sessions (
  token_hash text primary key,
  user_id bigint not null references store_users(id) on delete cascade,
  csrf text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table if not exists store_device_codes (
  device_hash text primary key,
  user_code text not null unique,
  client_name text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied', 'consumed')),
  user_id bigint references store_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table if not exists store_tokens (
  token_hash text primary key,
  user_id bigint not null references store_users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create table if not exists store_blobs (
  sha256 text primary key check (sha256 ~ '^[0-9a-f]{64}$'),
  mime text not null,
  bytes bigint not null check (bytes > 0),
  uploaded_by bigint references store_users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists store_items (
  id bigserial primary key,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'),
  author_id bigint not null references store_users(id),
  title text not null,
  summary text not null default '',
  description text not null default '',
  credits text not null default '',
  kind text not null,
  grade text not null check (grade in ('single', 'pack')),
  license text not null,
  ai_generated boolean not null,
  tags text[] not null default '{}',
  status text not null check (status in ('pending', 'visible', 'hidden', 'removed')),
  -- 숨긴 주체. 작가가 숨긴 것만 작가가 되돌릴 수 있다.
  hidden_by text check (hidden_by in ('author', 'reports', 'admin')),
  first_visible_at timestamptz,
  latest_version integer not null default 1,
  cover_sha text references store_blobs(sha256),
  previews text[] not null default '{}',
  counts jsonb not null default '{}'::jsonb,
  downloads integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists store_items_status_updated on store_items (status, updated_at desc);
create index if not exists store_items_author on store_items (author_id);

create table if not exists store_versions (
  item_id bigint not null references store_items(id),
  version integer not null check (version > 0),
  manifest jsonb not null,
  manifest_sha256 text not null,
  total_bytes bigint not null,
  created_at timestamptz not null default now(),
  primary key (item_id, version)
);

create table if not exists store_version_blobs (
  item_id bigint not null,
  version integer not null,
  sha256 text not null references store_blobs(sha256),
  primary key (item_id, version, sha256),
  foreign key (item_id, version) references store_versions(item_id, version)
);
create index if not exists store_version_blobs_sha on store_version_blobs (sha256);

create or replace function store_versions_immutable() returns trigger language plpgsql as $$
begin
  raise exception 'store_versions rows are immutable';
end $$;
drop trigger if exists store_versions_no_update on store_versions;
create trigger store_versions_no_update before update or delete on store_versions
  for each row execute function store_versions_immutable();
drop trigger if exists store_version_blobs_no_update on store_version_blobs;
create trigger store_version_blobs_no_update before update or delete on store_version_blobs
  for each row execute function store_versions_immutable();

create table if not exists store_reports (
  id bigserial primary key,
  item_id bigint not null references store_items(id),
  reporter_key text not null,
  reason text not null check (reason in ('copyright', 'inappropriate', 'broken', 'spam', 'other')),
  detail text not null default '',
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  unique (item_id, reporter_key)
);

create table if not exists store_downloads (
  item_id bigint not null references store_items(id),
  client_key text not null,
  day date not null default current_date,
  primary key (item_id, client_key, day)
);

create table if not exists store_audit (
  id bigserial primary key,
  actor_id bigint references store_users(id),
  action text not null,
  item_id bigint references store_items(id),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists store_schema_version (version integer primary key);
insert into store_schema_version values (1) on conflict do nothing;
