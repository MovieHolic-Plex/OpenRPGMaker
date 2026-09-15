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

## 아직 증명 못 한 것 (추측 금지)
- **접미사가 원인이라고 단정할 수 없다.** 단순 completions 경로는 `reasoning=low/off/high` 모두 HTTP 200 이고,
  `/v1/agent/run` 프로브(`thinkingLevel=low|medium|high`)도 200 이었다. 즉 "wire 가 `-low`" 만으로 400 이 되지는 않는다.
  다른 인자(요청 본문의 `labels`/`sessionId`/`systemInstruction` 등)가 함께 문제일 수 있다.
- 따라서 **수정은 아직 하지 않았다.** 다음 라운드에서 덤프 본문을 이분 탐색해 어떤 인자가 거부되는지 좁혀야 한다.

## 이 발견이 막고 있는 것
목표의 "실모델로 DB 검토→적용/폐기 를 실제로 돌린다" 항목. 이 400 이 먼저 풀려야 턴이 `review` 단계에 닿는다.
브라우저 표면 검증(검토→적용→폐기, 스텁 모델)은 이미 통과해 있다(`.omo/evidence/db-ai-review/`).
