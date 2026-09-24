# 생성형 이미지 사용 단계 — 설계

날짜: 2026-09-25 · 상태: 사용자 검토 대기 · 개정 1(코드 대조 검증 반영)

## 목적

조수가 그림 생성(god-tibo-imagen 등)을 얼마나 쓸지 **프로젝트 단위로** 정한다. 네 단계:
최대 사용 · 적극 활용 · 부분 활용 · 아예 사용 안 함. 이 값은 게임의 화풍 결정이므로 개인 AI 설정이 아니라
프로젝트에 저장하고, 조수와 대화하는 도중에 보고 바꿀 수 있어야 한다. AI 설정 창에만 두지 않는다.

## 결정 (사용자 확정)

| 항목 | 결정 |
|---|---|
| 저장 위치 | 프로젝트마다 (`project.aiAuthoring`) |
| 적용 범위 | 조수의 판단만. 사람이 직접 누르는 「AI 생성」 버튼은 막지 않는다 |
| 비어 있을 때 | 「부분 활용」처럼 동작하고, 조수가 처음 생성이 필요할 때 대화에서 네 단계를 묻는다 |
| 「사용 안 함」과 기존 생성물 | **막는다.** 새로 생성하지 않을 뿐 아니라 이미 만들어진 생성형 타일·키트·자원도 조수가 고르지 않는다 |

## 1. 데이터

`src/project/aiAuthoring.ts` 의 `AiAuthoring` 에 필드 하나를 더한다. 이 칸은 이미 「프로젝트가 소유하는 저작 선호」이고
옛 프로젝트에 없어도 되며 스키마 버전을 올리지 않는다.

```ts
export const GENERATED_IMAGE_USE_LEVELS = ["max", "active", "partial", "off"] as const;
export type GeneratedImageUse = (typeof GENERATED_IMAGE_USE_LEVELS)[number];
// AiAuthoring
generatedImageUse?: GeneratedImageUse; // 없음 = 「안 정함」
```

- `normalizeAiAuthoring` 은 목록 밖 값을 버려 「안 정함」으로 만든다.
- 유효 단계 헬퍼 `effectiveGeneratedImageUse(project)` 는 없으면 `"partial"` 을 돌려주고, 「안 정함」 여부는
  `isGeneratedImageUseUnset(project)` 로 따로 묻는다.
- 칩·확인 카드·자료집이 모두 같은 필드를 쓰고, 일반 프로젝트 저장으로 정본(`project.sqlite`)에 남는다.

### 생성형 출처 표시

「사용 안 함」에서 기존 생성물을 막으려면 생성물을 코드가 판별할 수 있어야 한다. 지금은 타일에 태그 글자
「생성형 이미지」만 있고(숲성 마을 2145칸), 이미지 자원에는 출처 표시가 전혀 없다.

- `TileAiMetadata` 와 `ResourceProfile`(`src/project/types/base.ts`)에 `imageOrigin?: "generated" | "hand" | "chipset"` 를 더한다.
- 판별 헬퍼 `isGeneratedImageTile(tileset, tile)` · `isGeneratedImageResource(profile)`:
  `imageOrigin === "generated"` 이거나, 옛 자료 호환으로 `tags` 에 「생성형 이미지」가 있으면 생성형이다.
- 앞으로 생성 경로(3-0 의 네 도구와 자료집 생성 창)가 만드는 자원은
  `imageOrigin: "generated"` 를 붙인다. 사람이 버튼으로 만든 것도 붙인다 — 출처 표시는 누가 눌렀는지와 무관하다.
- `scripts/asset-gen/forest-harmony-buildings/publish_place.py` 는 타일 메타에 `imageOrigin` 을 함께 쓴다
  (생성형 → `generated`, 손 도트 → `hand`). 숲성 마을 저장본을 다시 굽는다.
- 한계: 이 변경 이전에 만든 자원 중 태그도 없는 것은 판별하지 못한다. 자료집 자원 칸에서 사람이 `imageOrigin` 을
  고칠 수 있게 한다(선택 한 칸).

## 2. 단계별 동작

| 단계 | 새 생성 | 기존 생성물 사용 | 확인 카드 |
|---|---|---|---|
| 최대 사용 `max` | 기존 키트가 있어도 고유한 그림을 위해 생성 | 사용 | 없음 |
| 적극 활용 `active` | 기존 타일·키트를 먼저 쓰고, 맞는 게 없으면 생성 | 사용 | 없음 |
| 부분 활용 `partial` | 사용자가 요청문에서 직접 시켰을 때만. 조수가 필요하다고 판단하면 카드로 묻는다 | 사용 | 조수 판단으로 생성할 때 |
| 안 정함 (필드 없음) | `partial` 과 같다 | 사용 | 첫 생성 때 네 단계 선택 카드 |
| 사용 안 함 `off` | 없음 | **사용 안 함** | 없음 |

## 3. 조수에게 적용

### 3-0. 코드 대조로 확인한 현재 상태 (개정 1)

프로브(`.omo/probe/image-tools-probe.mts`, vite-node)와 코드 읽기로 확인했다.

| 사실 | 근거 |
|---|---|
| 조수 대화 루프는 Pi 하나다 | `src/ai/piAgent/executionRoute.ts` 머리말(2026-09-11), `aiChatPanel.ts` 전송은 `runPiTurn` |
| 조수 생성 도구는 **넷**이다: `generate_image_asset` · `generate_opening_image` · `generate_game_over_image` · `generate_character_appearance` | `sessionTools.ts` `SESSION_WRITE_TOOL_NAMES` |
| 넷 다 레지스트리에 `mode: "read"` 로 등록돼 **읽기 전용 Pi 실행에도 노출**된다 | 프로브: `piExposed:true, piReadOnlyExposed:true` |
| Pi 에서 넷 다 `status:"ui-required"` 쪽지(「생성에는 편집기가 필요하며 아직 등록되지 않았습니다」)만 돌려준다. 쪽지를 받아 실제로 생성하는 곳이 **없다** — Pi 런타임이 실제 실행으로 갈아 끼우는 도구는 `web_search` 하나다 | 프로브 결과, `scripts/lib/piAgentRuntime.ts` `shapeFor`, `ui-required` 소비처 검색 0건 |
| 실제 생성은 옛 세션 루프에만 있다 | `assistantSession.ts:5164–5219` (`generateImageAsset` 등) |
| Pi 도구 거름은 `selectPiToolDefinitions` · `resolvePiToolShape` 에서 한다 | `src/ai/piAgent/toolAdapter.ts:77,161` |

즉 **지금 조수는 대화 중에 그림을 실제로 만들지 못한다.** 이 설정은 「생성 이행」 경로를 먼저 세워야 뜻이 있다.

### 3-1. 생성 이행 브로커 = 확인 카드 (Pi 워커 ↔ 편집기)

`scripts/lib/piCheckpointBroker.ts` 와 같은 모양의 `scripts/lib/piImageGenerationBroker.ts` 를 둔다.
확인과 이행을 **한 왕복**으로 묶는다.

1. Pi 런타임이 네 생성 도구를 `shapeFor` 에서 실제 실행으로 갈아 끼운다(`web_search` 와 같은 자리).
2. 도구가 불리면 워커가 `{ type: "image-generation", requestId, tool, args, level, needsConsent, unset }` 이벤트를 내보내고 기다린다.
   시간 제한 30분, 런 중단 시 거절(체크포인트 브로커와 같음).
3. 패널이 이벤트를 받는다.
   - `needsConsent` 면 대화에 확인 카드를 먼저 띄운다(아래). 거절이면 `{ ok:false, reason:"declined" }`.
   - 승인이거나 확인이 필요 없으면 편집기 쪽 기존 생성 함수(`generateImageAsset` · `openingImageGeneration` · `characterAppearanceGeneration`)로
     만들고, 자원을 등록한 뒤 `{ ok:true, resourceId }` 를 돌려준다. 자격(Codex 로그인)은 지금처럼 편집기 쪽 경로가 쓴다.
4. 워커는 결과를 도구 응답으로 모델에 준다. 모델은 같은 턴에 `resourceId` 를 레코드에 연결할 수 있다.

`needsConsent` 규칙: 단계가 `partial` 또는 「안 정함」이고, 이번 턴 사용자 메시지에 생성 요청 표현이 없을 때.
조수가 붙이는 `userRequested` 는 믿지 않고 세션이 사용자 원문으로 판정한다(표현 목록은 구현 계획에서 확정: 「생성해서」, 「그려서」, 「이미지로 만들어」 등).

카드:

- `partial`: 「이 ○○은 기존 타일로 만들기 어렵습니다. 생성형 이미지로 만들까요? 품질이 떨어질 수 있습니다.」
  [이번만 생성] [기존 타일로] [앞으로 자동 생성 (적극 활용)]
- 「안 정함」: 같은 설명 아래 네 단계 버튼과 각 한 줄 설명. 고른 값을 프로젝트에 저장하고 이번 호출에 그대로 적용한다
  (`off` 를 고르면 이번 호출도 거부).
- [기존 타일로] 는 도구에 거부를 돌려주고 조수가 기존 타일로 이어 가게 한다.

### 3-2. 도구 노출 게이트 (결정론)

- 생성 도구 이름 목록 상수 `GENERATED_IMAGE_TOOLS`(위 넷)를 둔다. `mode` 로 판정하지 않는다 — 넷 다 `"read"` 라서
  읽기 전용 거름에 걸리지 않는다. 새 생성 도구는 이 목록에 넣어야 한다(도구 카탈로그 테스트로 강제).
- `off` 이면 `selectPiToolDefinitions` · `resolvePiToolShape` 가 이 목록을 빼고, 이름으로 불러도 거부한다
  (「이 프로젝트는 생성형 이미지를 쓰지 않도록 설정되어 있습니다. 기존 타일로 만들거나 설정을 바꿔 주세요.」).
- 읽기 전용 실행(자율성 「읽기 전용」·계획 턴)에서도 이 목록을 뺀다. 생성은 자원을 등록하는 쓰기다 — 지금 노출되는 것은 결함이다.

### 3-3. 기존 생성물 차단 (`off`) — 한 초크포인트

타일을 놓는 도구가 많다(`paint_tiles`, `stamp_structure`, 마을·실내 저작 도구 등). 도구마다 검사를 넣으면 새 도구가 빠진다.
그래서 **Pi 체크포인트 적용 지점**에서 한 번 검사한다: 적용 전 초안과 기준 프로젝트를 비교해,
**새로 들어간 칸**의 타일이 `isGeneratedImageTile` 이거나 **새로 연결된** 자원이 `isGeneratedImageResource` 면 체크포인트를 거부하고
거부 사유를 조수에게 돌려준다. 이미 맵에 있던 칸·연결은 건드리지 않는다.

조회 도구(`list_resources`, 타일 검색, `list_structure_kits`, `read_region_reference`)는 `off` 일 때 생성형 항목에
「사용 금지 · 생성형 이미지」를 붙여 돌려준다. 숲성 마을처럼 생성형 건물이 있는 장소는 배치·지형 참고는 되지만 그 건물 타일은
쓸 수 없다고 결과에 적는다.

### 3-4. 맥락 한 줄 (판단 유도)

`src/ai/contextBuilder.ts` 가 조수 맥락에 현재 단계와 뜻을 한 줄 싣는다. 예:
「그림 단계: 적극 활용 — 기존 타일·키트를 먼저 쓰고, 맞는 게 없을 때만 생성」.

## 4. 화면 — 입구 세 곳

| 입구 | 모습 | 역할 |
|---|---|---|
| 조수 입력창 칩 | 「작업 설정」 옆에 `그림 · 적극 활용` (안 정했으면 `그림 · 안 정함`) | 대화 중 늘 보인다. 누르면 네 단계와 설명이 뜨는 작은 창. 바꾸면 프로젝트에 저장 |
| 대화 확인 카드 | 3-1 의 카드 | 생성하는 순간 묻는다. 단계를 올리는 입구 |
| 자료집 → 시스템 | 「생성형 이미지 사용」 한 칸과 설명 | 정식 거처. AI 설정 창에는 현재 값과 이리로 가는 링크만 |

- 칩은 `src/editor/panels/aiComposer.ts` 의 지시줄에 만든다. 「작업 설정」 창 안에 넣지 않는다 — 중요한 설정이라
  숨기지 않는다는 요구다.
- 사람이 누르는 생성 버튼은 막지 않는다. `off` 일 때만 버튼 옆에 「이 프로젝트는 조수가 생성형 이미지를 쓰지 않도록
  설정됨」 한 줄을 띄운다.
- 문구·툴팁은 `openwiki/delayed-tooltip.md` 규칙을 따른다.

## 5. 검증

- 단위: 단계 정규화 · 판별 헬퍼(필드·옛 태그) · `off`·읽기 전용에서 생성 도구 미노출과 이름 호출 거부 ·
  체크포인트 초크포인트의 생성형 새 칸 거부(기존 칸 통과) · 브로커 승인/거절/중단/시간 제한 · 이행 후 `resourceId` 반환 ·
  사용자 원문 판정.
- 브라우저: 칩으로 단계 변경 → 새로고침 뒤 유지 · 「안 정함」에서 첫 생성 요청 시 카드 → 선택값 저장 ·
  `off` 에서 조수가 숲성 마을 건물을 쓰지 않는지(모델 없이 목 스트림으로).
- 테스트·게이트는 사용자가 그 메시지에서 시킬 때만 돌린다(AGENTS.md).
- 같은 변경에서 `openwiki/editor-ai-tools.md` · `openwiki/editor-ai-panel.md` 를 갱신한다.

## 범위 밖

- 생성 품질 자체(소품 4차 수정 등)는 이 작업이 아니다.
- 숲성 마을 키트를 프로젝트로 가져오는 경로는 별도 작업이다. 이 설계는 그 경로가 생기면 판별 헬퍼를 그대로 쓴다.
