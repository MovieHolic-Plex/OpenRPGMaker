-- R2 에 같은 파일이 올라가 있으면 그 시각. 비어 있으면 아직 서버 디스크에만 있다(app.ts 가 뒤에서 올린다).
alter table store_blobs add column if not exists r2_at timestamptz;
