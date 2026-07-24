create table if not exists public.openrpg_posts (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('general', 'showcase', 'qna', 'feedback')),
  title text not null,
  body text not null default '',
  author text not null default 'anonymous',
  lang text not null default 'en',
  views integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.openrpg_comments (
  id uuid primary key default gen_random_uuid(),
  parent_type text not null check (parent_type in ('post', 'asset', 'game')),
  parent_id text not null,
  body text not null,
  author text not null default 'anonymous',
  created_at timestamptz not null default now()
);

create index if not exists openrpg_posts_category_idx on public.openrpg_posts (category, created_at desc);
create index if not exists openrpg_comments_parent_idx on public.openrpg_comments (parent_type, parent_id, created_at);

alter table public.openrpg_posts enable row level security;
alter table public.openrpg_comments enable row level security;

drop policy if exists openrpg_posts_read on public.openrpg_posts;
create policy openrpg_posts_read on public.openrpg_posts for select using (true);
drop policy if exists openrpg_comments_read on public.openrpg_comments;
create policy openrpg_comments_read on public.openrpg_comments for select using (true);

grant select on public.openrpg_posts to anon, authenticated;
grant select on public.openrpg_comments to anon, authenticated;

notify pgrst, 'reload schema';
