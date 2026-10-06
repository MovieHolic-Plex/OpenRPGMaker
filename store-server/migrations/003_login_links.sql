-- 2026-10-06 운영자 일회용 로그인 링크(서버에서 ssh 로만 발급). Google 로그인이 준비되기 전에도 운영자가 들어올 수 있게 한다.
create table if not exists store_login_links (
  token_hash text primary key,
  user_id bigint not null references store_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);
