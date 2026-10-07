-- 검열 1단계(2026-10-07). 마이그레이션은 시작할 때마다 다시 돌므로 모두 멱등이다.
-- reviewed_version: 운영자가 본 마지막 판본. latest_version 보다 작으면 「사후 확인」 목록에 오른다(바로 공개된 상품도 운영자가 나중에 본다).
-- 서버는 새 행에 항상 값을 넣는다 — null 은 이 열이 생기기 전 상품뿐이고, 그것들은 본 것으로 친다.
alter table store_items add column if not exists reviewed_version int;
update store_items set reviewed_version = latest_version where reviewed_version is null;
-- held_reason: 보류 낱말에 걸려 확인 대기로 간 이유(운영 화면에 보인다).
alter table store_items add column if not exists held_reason text;
