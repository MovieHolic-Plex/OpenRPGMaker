# AI 컨텍스트 압축 (Context Compaction)

대화 히스토리가 길어져 LLM의 컨텍스트 창 상한에 도달했을 때, 오래된 대화를 하나의 구조화된 요약 메시지로 교체하여 대화 기억을 이어가는 압축 계층이다.

`@code-yeongyu/senpi`의 컨텍스트 압축 메커니즘을 OpenAI 호환 `ChatMessage` 배열 구조로 이식했다.

## 대화 복원과 실행 체크포인트의 경계 (2026-09-09)

`oprn-ai-records`는 DB version 3에서 `runCheckpoints` 저장소를 추가한다.
기존 v1/v2 대화·인덱스와 v2 삭제 표식은 보존한다. 체크포인트 payload의
schemaVersion 1은 DB 버전과 별개이며, 메모리 backend는 durable=false다.
동일 run/epoch의 기록은 트랜잭션으로 교체하고 오래된 기록이나 종료된 실행의
활성화는 거부한다. 미확정 제안은 한 행에 하나만 보관한다.

대화 기록이나 압축된 transcript는 실행 권한이 아니다. 패널 부팅은 마지막
사용자 메시지를 자동 재전송하지 않는다. 저장된 수락·검증 화면 투영과 직렬화된
저장 영수증도 새 실행의 승인이나 현재 저장 증명으로 그대로 사용할 수 없다.
실제 실행 복원은 별도의 현재 프로젝트 대조·원장 복원·재검증을 필요로 한다.
저장 API만 추가됐다는 사실을 완전한 실행 복구나 분산 exactly-once로 설명하지 않는다.

---

## 1. 3개 예산·압축 계층의 분리와 실행 순서

대화 크기를 관리하는 3개 계층은 목적과 동작 대상이 서로 다르며 독립적으로 동작한다.

```
[턴 시작 / 툴 루프]
       │
       ▼
① 시스템 프롬프트 조립 (contextBuilder / tokenBudget)
   └─ src/ai/tokenBudget.ts:27, src/ai/contextBuilder.ts:39
   └─ 시스템 프롬프트 본문 크기만 제어 (12,000자 기준, LLM usage로 동적 보정)
       │
       ▼
② 컨텍스트 압축 (contextCompaction)
   └─ src/ai/assistantSession.ts:2072 (maybeCompactConversation)
   └─ 대화 배열(this.messages)을 평가하여 임계 초과 시 LLM 요약 1회 호출 후 앞부분을 요약본으로 실제 치환
       │
       ▼
③ 요청 메시지 클램프 (messageBudget)
   └─ src/ai/assistantSession.ts:2075 (compactMessagesForRequest)
   └─ 전송 직전 per-request 사본을 52,000자 안으로 자름 (this.messages 원본은 불변)
       │
       ▼
[LLM 호출]
```

### 계층별 책임 비교

| 계층 | 대상 모듈 | 동작 방식 | 원본 `this.messages` 변경 여부 | 목적 |
|---|---|---|---|---|
| **1. 시스템 프롬프트 예산** | `src/ai/tokenBudget.ts`<br>`src/ai/contextBuilder.ts` | 맵 요약, 리소스 카탈로그, 스타일 문서 등 시스템 프롬프트 각 섹션을 글자 수 예산 안에 맞춰 조립 | 미해당 (시스템 프롬프트 생성 시점) | 시스템 프롬프트가 대화 공간을 과도하게 차지하지 않도록 제어 |
| **2. 컨텍스트 압축** | `src/ai/contextCompaction.ts`<br>`src/ai/assistantSession.ts` | 전체 대화 토큰 추정/실측이 임계값을 넘으면 LLM 요약을 생성하여 앞부분 대화를 요약본 1개로 영구 치환 | **영구 치환 (`splice`)** | 대화가 길어져도 목표, 제약, 결정사항 기억을 유지 |
| **3. 요청 메시지 클램프** | `src/ai/messageBudget.ts` | 전송 직전 per-request 사본을 만들어 오래된 툴 결과 축약 및 이미지 제거, 필요 시 짝 맞춘 툴/어시스턴트 드롭 | **불변 (사본만 축소)** | CPEN/공급자의 64,000자(실측) 유효성 오류(422) 방지 |

---

## 2. 주요 상수 및 위치

| 상수명 | 기본값 | 소스 위치 | 역할 |
|---|---|---|---|
| `reserveTokens` | `16_384` | `src/ai/contextCompaction.ts:34` | 요약 생성 및 다음 응답 생성을 위해 남겨두는 여유 토큰 |
| `keepRecentTokens` | `20_000` | `src/ai/contextCompaction.ts:35` | 압축 시 요약하지 않고 원문 그대로 유지할 최근 대화 토큰 분량 |
| `DEFAULT_CONTEXT_WINDOW` | `128_000` | `src/ai/contextCompaction.ts:42` | 미지정 모델 대상 보수적 컨텍스트 창 기본값 |
| `AUTO_COMPACTION_TRIGGER_TOKENS` | `200_000` | `src/ai/contextCompaction.ts` | **자동 압축이 도는 지점**(제품 선택, 감독 지시 2026-08-30). 작업 창 상한이 여기서 파생된다 |
| `WORKING_CONTEXT_TOKEN_CAP` | `216_384` | `src/ai/messageBudget.ts` | 압축 문턱과 문자 클램프가 같이 보는 작업 창 = 지점 + 예비분 |
| `BASE64_RUN_RE` | `/[A-Za-z0-9+/=_-]{512,}/g` | `src/ai/contextCompaction.ts:84` | base64 런 판정 정규식 (512자 이상 연속 문자) |
| `BASE64_CHAR_WEIGHT` | `4` | `src/ai/contextCompaction.ts:85` | base64 런 문자당 가중치 (문자당 1토큰으로 보수적 평가) |
| `ESTIMATED_IMAGE_CHARS` | `4800` | `src/ai/contextCompaction.ts:77` | 원격/짧은 URL 이미지의 최소 등가 문자 수 바닥값 |
| `COMPACTION_SUMMARY_MARKER` | `"[context-compaction-summary]"` | `src/ai/contextCompaction.ts:247` | 압축 요약 메시지 식별용 구조 마커 |
| `TOOL_RESULT_MAX_CHARS` | `2000` | `src/ai/contextCompaction.ts:280` | 요약 직렬화 시 tool 결과 문자열 1개당 최대 보존 길이 |
| `REQUEST_MESSAGE_CHAR_BUDGET` | `52_000` | `src/ai/messageBudget.ts:10` | messageBudget 클램프 안전 상한 (CPEN 64,000자 대비 여유) |
| `DEFAULT_BUDGET_CHARS` | `12000` | `src/ai/contextBuilder.ts:39` | contextBuilder 시스템 프롬프트 기본 문자 예산 |

---

## 3. 핵심 알고리즘 및 엔진 동작 (`src/ai/contextCompaction.ts`)

### 토큰 추정 (`estimateMessageTokens`, `estimateContextTokens`)
- 산문 텍스트는 `chars / 4` 올림으로 계산한다 (`src/ai/contextCompaction.ts:127`).
- 512자 이상 연속된 base64 런은 4배 가중치를 적용하여 문자당 1토큰으로 계산한다 (`src/ai/contextCompaction.ts:87-93`).
- `image_url` 파트는 `Math.max(4800, weightedChars(url))`로 가격을 매긴다 (`src/ai/contextCompaction.ts:106`).
- Reasoning(생각 블록)과 tool_calls(이름 + 직렬화된 인자)도 가중 규칙을 거쳐 함께 합산한다 (`src/ai/contextCompaction.ts:120-126`).

### 압축 트리거 판정 (`shouldCompact`, `resolveThresholdContextTokens`)
- 모델 접두사에 따라 컨텍스트 윈도우를 계산한다 (`src/ai/contextCompaction.ts:48-69`). 예: `gemini-`는 1,048,576, `claude-`는 200,000, `gpt-5`/`codex`는 400,000.
- 트리거 임계값 = `창 - reserveTokens`. 여기서 "창" 은 **모델 창이 아니라 작업 창**이다 — `assistantSession.runCompaction` 은 `resolveWorkingContextTokens(config)`(= `min(모델 창, WORKING_CONTEXT_TOKEN_CAP)`, CPEN 경로 예외)를 넘긴다.
- 작업 창 상한이 `AUTO_COMPACTION_TRIGGER_TOKENS + reserveTokens = 216,384` 이므로 창이 넉넉한 모델(gemini 1,048,576 / gpt-5 400,000)의 **지점은 정확히 200,000 토큰**이다. 창이 그보다 좁은 모델(claude-/glm- 200,000)은 자기 창이 먼저 걸린다(`200,000 - 16,384 = 183,616`).
- 예전 상한은 `DEFAULT_CONTEXT_WINDOW`(128,000)여서 지점이 111,616 이었다. 창 1M 짜리 기본 모델이 **창의 11% 에서 앞부분 기억을 요약으로 바꿔 버렸다** — 창이 남는데도 이르게 잊었다. 반대로 모델 창을 그대로 쓰면 1,032,192 가 되어 사실상 압축이 없다. 200,000 은 그 사이에 명시한 지점이다.
- 게이지(`describeContextUsage`)도 같은 창을 받는다(`getContextUsage` 가 `contextWindow: resolveWorkingContextTokens(this.config)` 를 넘긴다). 모델 창으로 세면 gemini 에서 "맥락 3%" 인데 압축이 도는 모순이 보인다.
- 공급자가 보고한 실측 `lastPromptTokens`와 로컬 `estimateContextTokens` 중 큰 쪽을 기준으로 판정한다 (`src/ai/contextCompaction.ts:144-149`). 단, 공급자 캐시 스파이크로 과금 토큰이 로컬 추정치의 8배를 초과하고 추정치가 50,000 이상이면 로컬 추정을 신뢰한다.

### 절단점 탐색 (`findCompactionCutPoint`)
- 메시지 배열의 뒤(최신)에서 앞(과거)으로 순회하며 추정 토큰을 누적한다 (`src/ai/contextCompaction.ts:197-205`).
- 누적 토큰이 `keepRecentTokens`(20,000)에 도달하면, 해당 지점 이후의 가장 가까운 유효 절단점(`user` 또는 `assistant` 메시지)으로 스냅한다.
- `role: "tool"`은 단독 절단점이 될 수 없으며, 인덱스 0(시스템 프롬프트)도 절단 대상이 아니다 (`src/ai/contextCompaction.ts:170-174`).

### 잔존 꼬리 수리 (`repairRetainedTail`)
- 절단점 이후 보존되는 메시지 중 `role: "tool"` 메시지는 창 내부에 선행하는 `assistant.tool_calls` 짝이 존재하는 경우에만 남긴다 (`src/ai/contextCompaction.ts:229-242`).
- 선두에 위치하거나 짝을 잃은 tool 응답은 제거하여 공급자(Cloud Code Assist / Gemini 등)의 400 에러를 방지한다.

### 요약 프롬프트 및 요청 구성 (`buildSummarizationRequest`)
- 시스템 프롬프트: `SUMMARIZATION_SYSTEM_PROMPT` (`src/ai/contextCompaction.ts:275`).
- 이전 요약이 없을 때: `SUMMARIZATION_PROMPT` (`src/ai/contextCompaction.ts:325`).
- 이전 요약이 존재할 때: `<previous-summary>` 태그와 함께 정보를 누적 갱신하는 `UPDATE_SUMMARIZATION_PROMPT` (`src/ai/contextCompaction.ts:359`).
- 요약 출력은 `## Goal`, `## Constraints & Preferences`, `## Progress (Done / In Progress / Blocked)`, `## Key Decisions`, `## Next Steps`, `## Critical Context`의 6개 고정 섹션 마크다운 형식을 강제한다.
- 요약 메시지는 `role: "user"`로 대화에 삽입된다 (`src/ai/contextCompaction.ts:258-260`). 이는 잔존 꼬리가 `assistant(tool_calls)`로 시작할 때 발생할 수 있는 400 에러(`function call turn comes immediately after a user turn`)를 충족하기 위함이다.

---

## 4. 세션 통합 및 실패 방어 (`src/ai/assistantSession.ts`)

### 호출 위치
- 툴 실행 루프의 매 라운드 전송 직전, `compactMessagesForRequest` 바로 앞에서 `await this.maybeCompactConversation(onEvent, signal)`가 실행된다 (`src/ai/assistantSession.ts:2072`).

### 턴당 실패 캡 (`compactionFailedThisTurn`)
- 턴이 시작될 때 `this.compactionFailedThisTurn = false`로 초기화된다 (`src/ai/assistantSession.ts:1013`).
- 요약 LLM 호출 도중 실패, 중단, 빈 응답이 발생하면 `this.compactionFailedThisTurn = true`로 설정되어 해당 턴 내 추가 라운드에서 중복 요약 시도를 차단한다 (`src/ai/assistantSession.ts:1686, 1691, 1696`).
- 성공한 압축은 횟수 제한 없이 여러 번 동작할 수 있다.

### 실측 사용량 기록 (`recordPromptUsage`)
- 매 LLM 응답 후 `result.usage.prompt_tokens`를 `this.lastPromptTokens`에 저장한다 (`src/ai/assistantSession.ts:1646`).
- 이 값은 다음 라운드의 `resolveThresholdContextTokens`에서 판정 기준으로 활용된다 (`src/ai/assistantSession.ts:1664`).

### 무중단 실패 정책
- `maybeCompactConversation`은 절대 예외를 던지지 않는다.
- 요약 실패, 사용자 중단, 빈 문자열 응답 시 대화 배열(`this.messages`)을 전혀 수정하지 않고 건너뜀 감사 로그(`대화 압축 건너뜀: ...`)를 기록한다 (`src/ai/assistantSession.ts:1687, 1692, 1697`).
- 압축이 건너뛰어져도 전송 직전의 3계층 클램프(`compactMessagesForRequest`)가 안전하게 메시지를 축약하므로 턴은 정상 진행된다.

---

## 5. 실측 데이터 (Real-HTTP Proof)

루프백 HTTP 서버 기반 실증 스크립트(`scripts/compaction-http-proof.mts`) 실행 증거(`.omo/evidence/ai-compaction/http-surface-pass.txt`):

1. **뷰포트 스크린샷 가중치 실측**
   - 6장의 base64 뷰포트 스크린샷이 실린 대화는 실제 요청 본문 115,957 바이트에 달했다.
   - 이미지 파트를 단순 4,800자로 고정 평가할 경우 토큰 추정치가 46,418 토큰에 불과하여 임계값(111,616 토큰)에 도달하지 못해 압축이 전혀 발동하지 않는 문제가 있었다.
   - 따라서 `image_url` 파트는 `Math.max(4800, weightedChars(url))`로 가중 계산하여 컨텍스트 초과를 정확히 감지한다.

2. **압축 효율 및 감사 로그 실측**
   - 33개 메시지, 195,324 추정 토큰 크기의 대화가 8개 메시지, 27,165 토큰으로 압축되었다.
   - 감사 로그: `대화 압축: 195327 -> 27161 토큰 (요약 1건)`
   - 요약 생성 요청은 `tools: 0` (툴 스키마 미포함)으로 발행되어 불필요한 툴 호출을 원천 차단했다.

---

## 6. 업스트림(Senpi) 대비 설계 및 의도적 차이점

- **업스트림 소스 코드 위치**:
  - `/home/main/.npm-global/lib/node_modules/omo-ai/node_modules/@code-yeongyu/senpi/dist/core/compaction/compaction.js`
  - `/home/main/.npm-global/lib/node_modules/omo-ai/node_modules/@code-yeongyu/senpi/dist/core/compaction/utils.js`
  - `/home/main/.npm-global/lib/node_modules/omo-ai/node_modules/@code-yeongyu/senpi/dist/core/extensions/builtin/compaction/retained-message-safety.js`
  - `/home/main/.npm-global/lib/node_modules/omo-ai/node_modules/@code-yeongyu/senpi/dist/core/extensions/builtin/compaction/per-turn-cap.js`
  - `/home/main/.npm-global/lib/node_modules/omo-ai/node_modules/@code-yeongyu/senpi/dist/core/extensions/builtin/compaction/circuit-breaker.js`

- **의도적 차이점 1: `image_url` data-URL 페이로드 가중 계산**
  - 업스트림 Senpi의 image 블록은 공급자 네이티브 첨부 파일이므로 4,800자 고정값을 사용한다.
  - rpg-zzu 에디터의 `image_url`은 base64 데이터 URL이 요청 본문에 직접 직렬화되므로 페이로드 길이에 비례해 가중 계산한다.

- **의도적 차이점 2: `assistant` 텍스트 블록의 base64 가중치 적용**
  - 업스트림 Senpi는 어시스턴트가 base64를 생성하지 않는다고 가정하고 assistant 텍스트에 가중치를 두지 않는다.
  - rpg-zzu 에디터는 어시스턴트가 툴 호출 인자로 타일 배열이나 데이터 URL을 반환하므로 모든 역할을 동일하게 가중 평가한다.

---

## 7. 계약 테스트 및 검증 스크립트

- `test/contextCompaction.test.ts`: 토큰 추정 휴리스틱, base64 가중치, 절단점 스냅, 툴 응답 짝 수리, 요약 프롬프트 조립 계약 검증.
- `test/assistantSessionCompaction.test.ts`: AssistantSession 내 실측 usage 연동, 임계 도달 시 압축 발동, 요약 실패 시 대화 보존 및 턴당 1회 실패 캡 검증.
- `scripts/compaction-http-proof.mts`: 실제 루프백 HTTP 서버를 구동해 실 와이어 페이로드와 압축 전후 메시지 구조를 검증하는 종단 증명 스크립트.
