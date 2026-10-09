-- 상품 글의 다른 언어판(en·ja·zh·ko). 기본 글은 title·summary·description 에 그대로 있다.
alter table store_items add column if not exists locales jsonb not null default '{}'::jsonb;
