# DB AI 턴이 400 으로 죽는 경로 — 실측 (2026-09-16)

## 한 줄
편집기 AI 턴이 **레코드 준비(프로젝트 위키 추출)** 단계에서 `400 INVALID_ARGUMENT` 로 죽는다.
자격 문제가 아니다 — 같은 머신의 `agy` CLI 는 살아 있고, 앱도 Cloud Code Assist 에 **도달해서** 거부당한다.

## 재현
```bash
# 개발 서버를 띄운 뒤, 라이브 하네스로 실제 턴을 돌린다(가짜 모델 없음)
OUT_DIR=/tmp/live QA_BASE_URL=http://127.0.0.1:9835 \
  node scripts/qa/db-ai-review-live.mjs
# → TURN {"phase":"done","statusText":"끝났지만 답이 비어 있어요"} / CARDS [] / STORE_CHANGED {maxHp:false}
```
상태줄에는 잘린 문구만 보인다. 전문은 감사 항목을 자르지 않고 떠야 나온다
(`scripts/qa/db-ai-review-live.mjs` 의 `.slice(0, 140)` 를 제거한 사본으로 확인).

## 원인 후보 (증거가 가리키는 곳)
```
Cloud Code Assist API error (400): {"error":{"code":400,
  "message":"Request contains an invalid argument.","status":"INVALID_ARGUMENT"}}
raw-http-request=/home/main/.omp/logs/http-400-requests/<ts>-<id>.json
```
교통 정리 후 덤프를 보면 **실패한 요청은 전부 `requestType: agent` 이고 wire 모델이 effort 접미사를 달고 있다**:

| 시각 | 요청 모델 | wire 모델 | requestType |
|---|---|---|---|
| 07:06 | gemini-3.7-flash | `gemini-3.7-flash-low` | agent |
| 07:07 | gemini-3.8-flash | `gemini-3.8-flash-low` | agent |
| 07:08 | gemini-3.7-flash | `gemini-3.7-flash-low` | agent |

저장소 자체 기록도 같은 방향을 가리킨다 — `src/ai/modelCatalog.ts` 주석(실측 2026-08-26):
"`-high`/`-medium`/`-low` 는 독립 모델이 아니라 `gemini-3.7-flash` 의 `thinking.effortRouting`
대상 이름" 이고 그 ID 는 Cloud Code Assist 가 거부한다.

## 원인 확정 (같은 날 이어서) — 출력 토큰 예산이었다

접미사 모델도 시스템 프롬프트도 아니었다. **요청의 `max_tokens` 가 상한을 넘었다.**

같은 요청에서 `max_tokens` 만 바꾼 실측:

| max_tokens | 결과 |
|---|---|
| 65536 | **200** |
| 65535 | 200 |
| 100000 | **400** |
| 200000 (앱 기본값) | 400 |

대조 실험으로 배제한 것:
- **effort 접미사**: `-low` 든 `-high` 든 400 이었다(자율성을 바꿔 wire 모델을 바꿔도 동일).
- **시스템 프롬프트**: 같은 위키 프롬프트(3082자)를 낮은 `max_tokens` 로 보내면 200.
- **자격**: `agy` CLI 가 같은 머신에서 정상 동작하고, 앱도 Cloud Code Assist 에 도달한다.

앱 기본값은 `src/ai/llmClient.ts` 의 `DEFAULT_MAX_TOKENS = 200_000` 이고, 그 값이 **레코드 준비 호출**에 그대로 실려 나갔다.

## 고침과 그 효과 (실측)

고침: PR #861 — `providerCapability()` 에 이미 있던 `maxTokensCeiling` 자리를 Antigravity 경로에 채우고(65536), 초과분을 클램프한다.

수정 후 라이브 실행에서:
- `~/.omp/logs/http-400-requests/` 에 **새 덤프가 한 건도 생기지 않았다**(직전 400 은 수정 전 07:14).
- 실제 모델이 344초 동안 살아서 쓰기 툴 `upsert_enemy` 를 **13회** 호출했다.
- 최소 프롬프트 실행에서는 **`phase:review` 에 도달**하고 독립 검토가 실제 판정을 남겼다:
  `independent-review {"status":"changes_requested","revision":2,"summary":"슬라임(enemy_slime)의 최대 HP가 78에서 300으로 정상 변경되었으며..."}`

## 남은 벽 (이 400 과 다른 문제)

검토 뒤 세션이 **수리 루프**로 들어가고, 그때 툴 호출 예산이 바닥나 턴이 `max-tool-calls` 로 끝난다
(`balanced` 예산 16 · `max` 예산 48 로도 도달 못 함, 제안 13건). 배경: 툴 233개 노출 · 입력 토큰 43만.
즉 실모델이 **검토까지는 가지만**, 검토 가능한 초안으로 정착해 사용자가 적용/폐기를 누르는 지점은 아직 못 봤다.
