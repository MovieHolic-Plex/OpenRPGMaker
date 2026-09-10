# Pi 강제와 `/` 스킬 — 제안

2026-09-10

제안 문서다. 승인 전에는 코드를 바꾸지 않는다.

> **2026-09-10 실행 결과 (아래 초안과 다른 부분).** 승인된 범위는 "Pi 로 전부 이관 + 노브는
> `/team` · `/loop N` · `/30m` 정도만" 이었다. 그대로 간 것은 §1a(라우트에서 `session` 제거),
> §1b(읽기 전용 배선), 그리고 §2 의 문법·전송 구조다. **§2e 의 도메인 스킬 7종은 만들지 않았다** —
> 대신 실행 노브(team·loop·시간 상한)만 넣었다. 추가로 다이얼→Pi 매핑(`resolvePiRunPlan`)이
> 들어갔다: 매핑이 없으면 읽기 전용·확인·예산·추론이 Pi 경로에서 조용히 무효가 된다.
> §1c(선택 영역 이관)는 보류 그대로이고, "세션 턴 경로 코드 삭제" 는 남은 작업이다.
> 실측·파일 목록은 `docs/pi-agent.md` 의 2026-09-10 표에 있다.

## 문제

Pi 경로(2026-09-09~10)가 들어온 뒤 컴포저에는 **두 개의 실행 루프**가 나란히 있다.

| 라우트 | 누가 돈다 | 루프 위치 |
|---|---|---|
| `session` 「조수」 | `AssistantSession` | 브라우저 (`src/ai/assistantSession.ts`, 5,433줄) |
| `pi-agent` · `pi-team` | `@oh-my-pi/pi-agent-core` | Bun 워커 (`scripts/lib/piAgentRuntime.ts`) |

기본값은 이미 Pi 다(`executionRoute.ts:24`, 2026-09-10). 그러나 사용자가 「경로」 셀렉트로 `조수` 를 고를 수 있고,
질문(자율성 읽기 전용)과 선택 영역 작업은 **코드가 강제로** 세션으로 되돌린다(`executionRoute.ts:47-49`).

그 결과:

1. **모델·프롬프트·툴 노출이 경로마다 다르다.** 같은 「집 한 채」가 경로에 따라 다른 결과를 낸다. 사용자가 무엇을 고른지 모르면 재현이 안 된다.
2. **Pi 로 옮긴 기능이 `/pi` 를 아는 사람만 쓴다.** 평문 지시는 라우트 셀렉트에 달렸고, 팀·도구 범위·턴 상한 같은 Pi 자산을 지시문 안에서 고를 방법이 없다.
3. 세션 루프의 정본 자산(제안 카드 승인, 작업 계획 체크리스트, 영역 하드 클립)은 세션에만 있어 Pi 경로가 그만큼 약하다 — 이 제안은 그 손실을 **명시**하고 좁힌다.

## 목표

- 컴포저에서 「조수」 경로를 없앤다. 지시·질문이 **항상 Pi**(단일 또는 팀)로 간다.
- `/` 로 부르는 **스킬**을 만든다. 스킬 = Pi 실행 프로파일(프롬프트 + 툴 범위 + 턴 상한 + 읽기 전용 여부 + 경로).

## 비목표

- `assistantSession.ts` 삭제. 영역 작업·DB AI 바·클러스터 모달·벤치마크가 아직 쓴다(`aiChatPanel.ts:811`, `clusterAiModal.ts:187`, `runRegionTask.ts:311`, `evals/runner.ts:50`).
- 스킬 마켓·공유·프로젝트 단위 저장. 팀 명세와 같은 층(localStorage)에서 시작한다.
- 게임 콘텐츠(맵·이벤트·데모) 저작. 이 문서는 순수 편집기 코드 변경이므로 `AGENTS.md` 의 Supabase 강제 조항은 발동하지 않는다.

## 1. Pi 강제

### 1a. 라우트 어휘에서 `session` 을 뺀다

`src/ai/piAgent/executionRoute.ts`:

```ts
export const EXECUTION_ROUTES = ["pi-agent", "pi-team"] as const;
export const DEFAULT_EXECUTION_ROUTE: ExecutionRoute = "pi-agent";
```

`resolveExecutionRoute` 는 입력이 셋뿐이 된다.

| 입력 | 경로 |
|---|---|
| `/pi …` `/pi team …` | 파서가 정한다 (종전 그대로) |
| `/스킬 …` | 스킬이 경로·범위를 정한다 (§2) |
| 그 외 | 셀렉트가 정한 경로 |

영향: `aiComposer.ts:310-314`(셀렉트 옵션 축소), `aiSettingsModal.ts:314-319`,
`aiChatPanel.ts:2548-2553`(routeChips), 저장값 파싱 `llmClient.ts:274` — 옛 blob 의 `"session"` 은
`DEFAULT_EXECUTION_ROUTE` 로 떨어진다(마이그레이션 코드 불필요, 기존 폴백이 그대로 삼킨다).

### 1b. 질문(읽기 전용)을 Pi 가 받게 한다 — 프로토콜 한 칸

자율성 다이얼 `readonly` 는 컴포저에서 `ask` 를 유도한다(`aiChatPanel.ts:522`). 지금은 그 신호가
`resolveExecutionRoute` 에서 세션 고정을 만든다(`executionRoute.ts:47`). 이걸 Pi 로 옮기려면 **쓰기 툴을
주지 않는 실행**이 필요하다. 워커에는 이미 있지만 배선이 없다:

- `RunPiAgentOptions.readOnlyTools` 는 있고 `createPiToolset({ readOnly })` 로 들어간다(`piAgentRuntime.ts:24,62`).
- 정작 워커는 `{ apiKey, signal, onEvent }` 만 넘긴다(`oh-my-pi-worker.ts:53`).
- `PiAgentRequest` 에 그 칸이 없다(`protocol.ts:15-33`).

추가:

```ts
/** 읽기 전용 실행: 쓰기 툴을 주지 않고 조회·설명만 한다. 자율성 「읽기 전용」이 이걸 쓴다. */
readonly readOnly?: boolean;
```

- 워커: `{ apiKey, signal, onEvent, readOnlyTools: agentRequest.readOnly === true }`
- 런타임: `readOnly` 면 시스템 프롬프트에 「쓰기 금지, 조회한 사실과 근거만 보고, 고칠 제안은 문장으로만」 한 줄을 붙인다.
- 패널: `resolveExecutionRoute` 의 ask 분기를 지우고, ask 턴을 `readOnly: true` 로 보낸다.

`ask` 는 세션에서 **하드 레일**(쓰기 스키마 미노출 + 호출 거부)이었다. Pi 쪽에서 같은 강도는
"쓰기 툴 자체를 안 준다" 이므로 오히려 더 세다 (스키마 미노출 = 모델이 부를 수 없음). 다만 커밋 게이트가
아니라 툴 목록이 막는 것이므로, 읽기 전용 실행에서는 `changedKeys` 가 비어야 한다는 **회귀 테스트**를 건다.

### 1c. 선택 영역 작업은 이번 범위 밖 (근거)

`sendSelectionRegionTask`(`aiChatPanel.ts:1887`)는 세션 파이프라인이다: 컨텍스트 footer 로 구간 격리 →
`clipMapCellsToRegion` 하드 클립 → blend 분석/폴리시 → 고스트 프리뷰 → pending apply → 선택 해제
(`runRegionTask.ts:1-7,52-55`).

Pi 로 옮기면 잃는 것: 적용 전 하드 클립, 블렌드 폴리시, 고스트 프리뷰, 선택 해제 계약. 얻는 것: 에이전트가
맵 전체를 보므로 맥락이 넓다.

**대안 설계(실행한다면 이 모양):** Pi 는 맵 단위로 돌리되, 병합 단계에서 `clipMapCellsToRegion` 과 같은
함수로 사각형 밖 셀 변경을 버리고 `spills` 로 보고한다. 즉 클립을 "실행 전 제약"이 아니라 "적용 시 필터"로
내린다. 폴리시·고스트는 포기한다.

→ **권고: 보류.** 1a·1b·2 를 먼저 내고, 영역은 실사용 빈도를 본 뒤 별도 변경으로 다룬다. 이때
컴포저에 남는 세션 표면은 영역 작업 하나이며, 문서에 그 사실을 적는다.

## 2. `/` 스킬

### 2a. 정의

스킬은 **Pi 실행 프로파일**이다. 팀 명세(`teamSpec.ts`)가 "누가 하는가"라면 스킬은 "어떻게 시킬 것인가"다.

```ts
export interface PiSkill {
  readonly id: string;          // 영문·숫자·-_, 소문자 시작 (팀원 id 와 같은 규칙)
  readonly label: string;       // 컴포저에 보이는 이름
  readonly summary: string;     // 한 줄 설명 (팝오버)
  readonly prompt: string;      // 범위·절차 문장 뒤에 붙는 역할 지시
  readonly mode: PiAgentMode;   // "single" | "team"
  readonly toolDomains: readonly ToolDomain[];  // 비우면 레지스트리 전부
  readonly maxTurns: number;
  readonly readOnly?: boolean;
  readonly model?: string;      // 비우면 세션 모델
  readonly thinkingLevel?: PiAgentThinkingLevel;
  readonly enabled: boolean;
}
```

새 파일:

| 위치 | 역할 |
|---|---|
| `src/ai/piAgent/skills.ts` | 정규화·파싱·프롬프트 합성 (순수, 팀 명세와 같은 층) |
| `src/ai/piAgent/builtinSkills.ts` | 내장 목록 (코드 리뷰 대상, 테스트 대상) |
| `src/ai/piAgent/skillStore.ts` | `localStorage("oprn:pi-skills")` 읽기/쓰기 (`teamSpecStore.ts` 와 동형) |
| `src/editor/panels/aiSkillPopover.ts` | `/` 목록 UI |
| `src/editor/panels/aiSkillCommand.ts` | `/<id> [맵목록] 지시` 파서 → 요청 조립 (`aiPiAgentCommand.ts` 와 동형) |

### 2b. 문법

```
/집                     지시 없이 부르면 사용법 한 줄 (오늘의 /pi 와 같은 태도)
/집 집 한 채와 마당     현재 맵
/집 map_a,map_b 집 세 채  맵마다 에이전트 하나씩 병렬
/물어 이 맵에 뭐가 있나  읽기 전용 실행
/팀마을 마을 셋          팀 모드
```

`splitMapList(`aiPiAgentCommand.ts:43`)` 를 그대로 재사용한다 — 맵 토큰은 프로젝트에 있는 id 일 때만 인정.

**모르는 `/이름` 은 오늘처럼 평문이다.** 스킬 목록에 없으면 명령이 아니다(오작동 방지). 이 규칙이
"`/` 는 평범한 텍스트" 라는 현재 계약(`openwiki/editor-ai-panel.md:1386`)과 충돌하지 않게, 목록에 있는
id 만 명령으로 승격한다.

### 2c. UI

- **`/` 팝오버**: 입력이 `/` 로 시작하면 열리고, 타이핑에 따라 좁힌다. 항목 = `label` + `summary` + 툴 도메인 칩.
  `Enter`/클릭 = `/<id> ` 삽입 후 포커스 유지(전송하지 않는다). `Esc` = 닫기.
- 컴포저 팝오버 기계를 재사용한다(`ComposerPopover`, `aiComposer.ts:38-40`). **주의:** 지금
  `positionPopover` 는 `toggleOf(kind)` 가 null 이면 아무것도 안 한다(`aiComposer.ts:408-410`). 슬래시
  팝오버는 토글 버튼이 아니라 **입력창**에 붙으므로, `anchorOf(kind)` 를 도입해 입력창을 앵커로 돌려준다.
- Ctrl+K 명령 팔레트(`commandPalette.ts`)에 「스킬」 섹션을 더한다. 전역 발견 경로 하나.
- 슬래시 목록은 **입력이 `/` 로 시작할 때만** 뜬다 — 상시 노출되는 스킬 표면을 만들지 않는다.

### 2d. 전송 배선

`PiAgentRequest` 에 한 칸 더:

```ts
/** 스킬 프롬프트. 런타임이 기본 프롬프트 뒤에 붙인다(대체가 아니다). */
readonly systemPromptAppend?: readonly string[];
```

`systemPrompt`(대체)를 브라우저에서 조립해 보내는 방법도 되지만, 그러면 헤드리스 CLI
(`scripts/pi-agent.mts`)가 같은 조립을 중복 구현하고 두 출처가 갈라진다 — 이 저장소가 이미 겪은
사고 유형이다(`evals/llmSuite.eval.ts:6-10` 의 모델 기본값 고아 문자열). **합성은 런타임 한 곳**
(`piAgentRuntime.ts:71`)에서 한다:

```
systemPrompt = request.systemPrompt ?? buildPiAgentSystemPrompt(project, mapIds)
             + (request.systemPromptAppend ?? [])
```

CLI 에도 `--skill <id>` 를 붙인다 (같은 순수 레지스트리를 import 하므로 내장 스킬은 자동으로 같다).

### 2e. 내장 스킬 (초안 7개)

도메인 어휘는 `ToolDomain`(`src/editor/tools/types.ts:58`) 그대로다. 프롬프트는 각 도메인의 실제 툴 이름을
부른다(툴 설명이 정본이므로 역할·순서만 말한다).

| `/` | label | mode | domains | turns | 하는 일 |
|---|---|---|---|---|---|
| `/마을` | 마을 | single | core, tile, map, world | 60 | 길·광장·집 배치, 마을 단위 시공 |
| `/집` | 집 | single | core, tile, map | 40 | 집 한 채(+ 필요한 실내) |
| `/숲` | 숲 | single | core, tile, map | 40 | 자연 지형·수목 산포 |
| `/이벤트` | 이벤트 | single | core, event, database | 40 | 이벤트 페이지·NPC 대사·상점 |
| `/데이터` | 데이터 | single | core, database | 30 | DB 레코드 업서트(아이템·몬스터·스킬) |
| `/검수` | 검수 | single | — (읽기만) | 10 | `readOnly`. `run_lint`·`get_map_region` 로 지적만 |
| `/물어` | 질문 | single | — (읽기만) | 4 | `readOnly`. 자율성 읽기 전용과 같은 레일 |
| `/팀마을` | 마을(팀) | team | — | — | 팀 명세로 마을 시공·검수 |

`/검수`·`/물어` 가 1b 의 `readOnly` 필드를 그대로 쓴다 — 한 번의 프로토콜 추가로 두 기능이 선다.

## 잃는 것 / 리스크

| 잃는 것 | 영향 | 대응 |
|---|---|---|
| 세션 루프의 제안 카드·작업 계획 체크리스트·의도 선언·독립 리뷰 | 지시 경로에서 사라진다 | Pi 는 이미 검토 카드 + 팀 보드 + 커밋 게이트를 쓴다(`aiPiAgentCommand.ts:188-201`). 계획 체크리스트가 필요한 워크플로가 있으면 그때 별도 판단 |
| 세션 고정 질문의 답변 품질 | `ask` 레일은 읽기 전용 조회만 한다 | Pi 읽기 전용은 같은 툴 범위 + 넓은 맥락. 실측으로 비교 (§검증) |
| **Pi 는 동반 서비스가 필수** | Bun 워커 + OAuth. 없으면 조수가 아예 안 뜬다 | 오늘도 AI 완성은 Bun 을 요구한다(`quickstart.md:76-77`). 다만 "세션이 대체 경로" 라는 종전 안전망은 사라짐 — 실패 메시지가 그 사실을 말해야 한다(`ensureConfigReadyForSend`) |
| 스킬 팝오버가 만드는 새 표면 | 위키가 명시적으로 금지한 적이 있다 | 아래 문서 갱신 |

## 문서 갱신 (같은 변경에서)

- `openwiki/editor-ai-panel.md:1386,897` — 「assistant skills removed … Do not reintroduce skill surfaces」 는
  **세션 컴포저**의 스킬을 금지한 기록이다. Pi 스킬은 다른 층이므로 그 문장을 "세션 컴포저에는 스킬 표면을
  두지 않는다. Pi 경로의 스킬은 `/` 로만 뜬다" 로 좁혀 다시 쓴다. 이걸 안 하면 다음 에이전트가 회귀로 읽는다.
- `docs/pi-agent.md` — 「기본 경로가 Pi 다」 절에 `/스킬` 행과 「세션 경로는 컴포저에 없다」 를 반영.
  2026-09-10 실측 표에 스킬 실행 1줄 추가.
- `openwiki/INDEX.md` — 페이지 크기/절 좌표가 바뀌면 `npm run openwiki:index` 재생성.

## 테스트·검증 계획

**순수 계약 (실패부터)**

- `skills.ts`: 정규화(깨진 항목 버림), `/이름` 파싱(모르는 이름 → null, 맵 토큰 인정 규칙), 프롬프트 합성 순서.
- `resolveExecutionRoute`: `session` 제거 후 표 3행, ask → `{ route: "pi-agent", readOnly: true }`.
- 요청 조립: 스킬 → `toolDomains`/`maxTurns`/`readOnly`/`systemPromptAppend` 매핑.

**게이트**

- `npm run typecheck:app` 초록.
- 영향 테스트: `aiComposerDeck`, `aiComposerEffortPanel`, `aiAutonomyDialSettings`, `aiSettingsEntryParity`,
  `aiChatPanelComposerMode`, `piAgent*` 계열. `test/aiComposerModeSession.test.ts` 는 세션 무변경이므로
  **그대로 통과해야 한다**(세션을 안 건드렸다는 증거).
- `npm run gates` 는 기준선 대비 **새 실패 0** 만 본다.

**표면 증거 (편집기 UI — `test/e2e` + `scripts/capture-*`)**

- `/` 팝오버 열림·필터·삽입 스크린샷, 셀렉트에서 「조수」 가 사라진 스크린샷.

**실측 (실제 실행 — 통과해야 "된다" 고 말한다)**

| 경로 | 기대 |
|---|---|
| 브라우저 `/집` 한 줄 → 검토 카드 → 적용 | 프로젝트에 집이 생긴다 |
| 브라우저 `/검수` | 쓰기 0 (`changedKeys` 비어 있음), 지적 목록만 |
| 자율성 「읽기 전용」 + 평문 「집 지어줘」 | 조회만 하고 아무것도 만들지 않는다 |
| 브라우저 `/팀마을` | 팀 보드 3행, 검수 통과 |
| 헤드리스 `bun scripts/pi-agent.mts --skill 검수 --project …` | 쓰기 0, 종료 코드 0 |

## 열린 결정

1. **영역 작업을 Pi 로 옮기는 시점** — 권고: 보류(1c). 옮긴다면 클립을 적용 시 필터로 내리는 설계로.
2. **`/pi` 를 남기는가** — 권고: 남긴다. `/pi` 는 "스킬 없이 날것으로 돌린다" 는 탈출구이고, 맵 병렬
   문법이 이미 그 위에 있다. 스킬과 문법이 겹치지 않는다(`/집` = 프로파일, `/pi` = 원시 실행).
3. **스킬 편집 UI 를 지금 만드는가** — 권고: 내장 7개만 코드로 내고, 사용자 편집 UI 는 팀 패널처럼
   접힌 막대가 실제로 필요해질 때 붙인다. 저장 계층(`skillStore`)만 먼저 둔다.
