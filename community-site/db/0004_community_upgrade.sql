alter table public.openrpg_assets add column if not exists license text not null default 'CC0';
alter table public.openrpg_assets add column if not exists likes integer not null default 0;
alter table public.openrpg_assets add column if not exists status text not null default 'visible';

alter table public.openrpg_games add column if not exists license text not null default 'CC0';
alter table public.openrpg_games add column if not exists likes integer not null default 0;
alter table public.openrpg_games add column if not exists status text not null default 'visible';
alter table public.openrpg_games add column if not exists cover_data_url text;

alter table public.openrpg_posts add column if not exists likes integer not null default 0;
alter table public.openrpg_posts add column if not exists status text not null default 'visible';

create table if not exists public.openrpg_reports (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('post', 'comment', 'asset', 'game')),
  target_id text not null,
  reason text not null default '',
  created_at timestamptz not null default now()
);

alter table public.openrpg_reports enable row level security;
drop policy if exists openrpg_reports_read on public.openrpg_reports;
create policy openrpg_reports_read on public.openrpg_reports for select using (true);
grant select on public.openrpg_reports to anon, authenticated;

notify pgrst, 'reload schema';
