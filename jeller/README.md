# 조선을 다시 위대하게 — Make Chosun Great Again (MCGA)

AI가 군주, 사람이 신하. 동아시아 역사 제국들(조선·명·여진·왜·류큐·안남·참파·몽골) 틈에서 살아남아 천하를 통일하라.
3~5분 접속, 사약·반정·망명이 도는 지속형 멀티 웹게임. GPT 5.4 mini 기반.

> 기획 문서: [`../docs/specs/2026-06-25-mcga-design.md`](../docs/specs/2026-06-25-mcga-design.md)

## 아키텍처

```
브라우저 (SVG 클라이언트, Vite)
  └─ REST 폴링 (수 초)
     │
자체 호스팅 Supabase (192.168.100.121)
  ├─ Postgres (스키마 mcga): 세계 상태 = 단일 진실
  ├─ pg_cron: 세계 틱 자동 (5분)
  └─ Edge Functions (Deno): bot-step / (submit-action, king-judgment, fetch-shorts — STEP 2~3)
```

GPT API 키는 Edge Function 시크릿으로만 — 클라이언트에 노출 안 됨.

## 개발

```bash
npm install
npm run dev      # Vite — http://localhost:5174 (Supabase proxy /db, /fn)
npm run build    # tsc --noEmit + vite build
npm run test     # 단위 테스트
npm run typecheck
```

### 환경변수
`.env.local` 복사 후 값 채우기 (`.env.example` 참고):
```
VITE_SUPABASE_URL=http://192.168.100.121:8000
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_KING_MODEL=gpt-5.4-mini
```

⚠️ API 키(`MCGA_OPENAI_KEY`)는 Edge Function 환경변수로만. `.env.local`에 두지 말 것.

### DB 마이그레이션
```bash
# 자체 호스팅 Supabase에 적용
supabase db push --db-url "postgresql://postgres:postgres@192.168.100.121:5432/postgres"
```
스크립트 내 `app.mcga_function_baseurl` 설정 필요 (pg_cron → bot-step 호출용).

## 구현 단계

| 단계 | 내용 | 상태 |
|---|---|---|
| STEP 1 | 기반 + 결정론적 엔진 (봇만, GPT 없이 세계 자동 진행) | ✅ |
| STEP 2 | 플레이어 참여 (행동 제출, 숏 경험) | ⏳ |
| STEP 3 | AI 왕 판결 (GPT 5.4 mini, 사약 안전장치) | ⏳ |
| STEP 4 | 시즌 & 통일 & 정산 | ⏳ |
| STEP 5 | 숏폼 폴리싱 & 어그로 | ⏳ |

## 폴더
```
src/         클라이언트 (TS/SVG)
  engine.ts     결정론적 엔진 (순수 함수, 테스트 대상)
  types.ts      공통 도메인 타입
  api/          Supabase REST 클라이언트
  render/       SVG 헥스 도우미
  ui/           맵 뷰 / (숏 피드·신분·현황 — STEP 2+)
supabase/
  migrations/   스키마 + 시드
  functions/    Edge Functions (Deno)
test/        단위 테스트 (Vitest)
```
