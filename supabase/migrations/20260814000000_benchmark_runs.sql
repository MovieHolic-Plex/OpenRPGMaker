-- 벤치마크 실행 결과 리더보드 테이블 (tileset-vision-benchmark).
-- 원본 모델 응답/프롬프트/API 키는 절대 저장하지 않는다:
-- raw_answers_hash 컬럼은 원문의 sha256 해시만 보관한다 (todo 10a).
CREATE TABLE IF NOT EXISTS public.benchmark_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name text NOT NULL,
  model_provider text,
  benchmark_version text NOT NULL,
  prompt_version int NOT NULL,
  run_at timestamptz NOT NULL DEFAULT now(),
  scores jsonb NOT NULL,
  raw_answers_hash text NOT NULL,
  input_seed int NOT NULL,
  site_version text
);

-- 리더보드 등록/조회는 사이트 방문자(anon, REST)가 직접 수행하므로 행 수준 보안을 켠다.
ALTER TABLE public.benchmark_runs ENABLE ROW LEVEL SECURITY;

-- anon INSERT 정책: 벤치마크 실행 결과를 사이트에서 저장할 수 있어야 한다.
-- WITH CHECK (true) — 스키마가 이미 원문 응답/키를 배제하므로 추가 행 조건은 없다.
-- anon 에게 부여하는 쓰기는 INSERT 뿐이다 (아래 UPDATE/DELETE 정책 없음).
create policy benchmark_runs_insert on public.benchmark_runs
  for insert to anon
  with check (true);

-- anon SELECT 정책: 리더보드가 모든 실행 결과를 공개 조회한다 (전체 공개 리더보드가 의도된 동작).
-- USING (true) — 공개 리더보드 조회를 허용.
-- UPDATE/DELETE 정책은 의도적으로 만들지 않는다: anon 은 삽입/조회만 가능하고 수정·삭제는 차단된다.
create policy benchmark_runs_select on public.benchmark_runs
  for select to anon
  using (true);
