-- Community site PostgreSQL schema; this separate application is outside the editor migration.
-- Assets are editor UploadedAsset-shaped (dataUrl + meta) so the editor can import them directly.
-- Games are stored as base64 of the editor .rpgzzu stored-zip package.

create table if not exists public.openrpg_assets (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  kind text not null check (kind in (
    'chipset','charset','battle','battleCharset','battleWeapon','backdrop',
    'gameOver','monster','faceset','picture','system','system2','title','music','sound','tileset','sprite'
  )),
  description text not null default '',
  author text not null default 'anonymous',
  tags text[] not null default '{}',
  data_url text not null,
  meta jsonb not null default '{}'::jsonb,
  downloads integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.openrpg_games (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text not null default '',
  author text not null default 'anonymous',
  tags text[] not null default '{}',
  package_base64 text not null,
  map_count integer not null default 0,
  asset_count integer not null default 0,
  downloads integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists openrpg_assets_kind_idx on public.openrpg_assets (kind);
create index if not exists openrpg_assets_created_idx on public.openrpg_assets (created_at desc);
create index if not exists openrpg_games_created_idx on public.openrpg_games (created_at desc);

-- Community sharing policy: anyone reads, anyone posts, download counter is the only mutation.
alter table public.openrpg_assets enable row level security;
alter table public.openrpg_games enable row level security;

drop policy if exists openrpg_assets_read on public.openrpg_assets;
create policy openrpg_assets_read on public.openrpg_assets for select using (true);
drop policy if exists openrpg_assets_insert on public.openrpg_assets;
create policy openrpg_assets_insert on public.openrpg_assets for insert with check (true);
drop policy if exists openrpg_assets_downloads on public.openrpg_assets;
create policy openrpg_assets_downloads on public.openrpg_assets for update using (true) with check (true);

drop policy if exists openrpg_games_read on public.openrpg_games;
create policy openrpg_games_read on public.openrpg_games for select using (true);
drop policy if exists openrpg_games_insert on public.openrpg_games;
create policy openrpg_games_insert on public.openrpg_games for insert with check (true);
drop policy if exists openrpg_games_downloads on public.openrpg_games;
create policy openrpg_games_downloads on public.openrpg_games for update using (true) with check (true);

grant select, insert on public.openrpg_assets to anon, authenticated;
grant select, insert on public.openrpg_games to anon, authenticated;
grant update (downloads) on public.openrpg_assets to anon, authenticated;
grant update (downloads) on public.openrpg_games to anon, authenticated;

notify pgrst, 'reload schema';
