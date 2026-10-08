-- 컨셉 피드 카드(oprn-concept/1, 2026-10-07). 마이그레이션은 시작할 때마다 다시 돌므로 모두 멱등이다.
-- 공식 컨셉은 author_id null. 그림은 store_blobs 의 sha256 두 개(큰 그림·카드 그림).
create table if not exists store_concepts (
  id bigserial primary key,
  slug text not null unique,
  author_id bigint references store_users(id),
  body jsonb not null,
  tags text[] not null default '{}',
  preset_id text not null,
  full_sha text not null references store_blobs(sha256),
  card_sha text not null references store_blobs(sha256),
  status text not null default 'visible' check (status in ('visible', 'hidden', 'pending')),
  rank integer not null default 1000,
  made_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists store_concepts_feed on store_concepts (status, rank, id);
-- 「이걸로 만들었다」는 손님(로그인 사용자 또는 IP 묶음)·컨셉마다 하루 한 번만 센다.
create table if not exists store_concept_made (
  concept_id bigint not null references store_concepts(id) on delete cascade,
  client_key text not null,
  day date not null default current_date,
  primary key (concept_id, client_key, day)
);
