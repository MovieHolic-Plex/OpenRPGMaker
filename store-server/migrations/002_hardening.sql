-- 2026-10-06 보안 검토 반영: 앱 토큰 만료, 자동 숨김에 세는 신고 구분.
alter table store_tokens add column if not exists expires_at timestamptz not null default now() + interval '180 days';
alter table store_reports add column if not exists counts boolean not null default true;
create index if not exists store_blobs_created on store_blobs (created_at);
