# 영역 기반 건축 팔레트 + 슬래시 스킬 IA — 설계 (합의)

- 작성일: 2026-07-07
- 작성자: Claude(Opus, 팀장) — 구현은 codex 위임, Claude는 audit/review/gate
- 대상 트리: `rpg-zzu-wt-6a` (branch `feat/phase-6a`), pm2 `rpg-zzu-dist` (localhost:9988)
- 브레인스토밍 확정 3결정: (1) 하이브리드 엔진 (2) 영역먼저+컨텍스트 팔레트 (3) 슬래시 팔레트

## 문제 (사용자 관찰)

1. **재시도 낭비** — 에이전트가 `get_map_region`/`clear_region`에 `{rect:{x,y,w,h}}`를 보내면 "필수 인자 누락: x" 로 실패하고 2~3회 재시도. 원인: v1 region 툴은 평면 `x,y,w,h`, v3 건축 툴은 중첩 `rect`/`at` — 관례 불일치를 모델이 섞는다.
2. **집짓기 지붕 실패** — 지붕 어휘가 `patternKind: overlay_detail`로 분류돼 `expandRoof`가 거부(`nine_slice_expandable`/`horizontal|vertical_expandable`만 지원). 게다가 벽→문→지붕을 묶는 오케스트레이터가 없어 모델이 중간에 멈춤.
3. **정보 과밀** — 건축 같은 기계적 작업까지 전부 AI 어시스턴트에 몰림. 헤더에 모드뱃지+스킬핀바+토글+드로어가 4곳에 흩어져 밀집.
4. **스킬 발견성** — 스킬이 헤더에 상주 노출돼 지저분. Cursor/Codex처럼 불러서 쓰는 방식이 필요.

## 해결 원칙

> **건축은 손으로(결정적 스탬프), 창작은 에이전트로(minimax).**

흔한 건축(집·길·강·지붕·NPC)은 LLM 없이 즉시 스탬프 → 재시도·비용 0. 자유서술/창작만 에이전트. 어시스턴트는 창작 전용으로 비우고, 스킬은 슬래시로 발견.

---

## A. arg 정규화 — 재시도 소멸 (양방향 rect↔평면)

**단일 수정 지점:** `src/editor/tools/jsonSchema.ts` — `coerceForSchema`(:24) / `normalizeArgsForSchema`(:57).

- 스키마가 평면 좌표(`x,y,w,h` 또는 `x,y`)를 요구하는데 args에 `rect`/`region`/`area`/`bounds`/`at`/`pos`/`point` 래퍼가 오면 **그 래퍼의 하위 키를 상위로 자동 평탄화**(상위에 이미 있으면 상위 우선).
- 역방향: 스키마가 `rect`/`at` 객체를 요구하는데 평면으로 오면 **자동 래핑**.
- 평탄화/래핑은 스키마 정의를 보고 결정(구조 인지). 기존 타입 관대화(JSON.parse, Number, 단일배열 언랩)와 공존.
- v1 region 툴(`queryTools.ts:98`, `mapTools.ts:683`, `visionQueryTools.ts:15`)의 검증 실패 메시지에 v3식 정답 예시(`failWithExample` 패턴) 부착 → 그래도 틀리면 자기교정.

**수용 기준:** 모델이 `{rect:{x,y,w,h}}`로 보내도 `get_map_region`/`clear_region`/`show_map_region` 1발 통과. 반대로 `build_wall`에 평면으로 보내도 통과. 기존 2272 테스트 불변 + 정규화 신규 테스트.

---

## B. 결정적 건축 팔레트 — 영역먼저 + 컨텍스트 팝업

**신규 모듈:** `src/editor/panels/buildPalette.ts`(+필요 헬퍼).

- **트리거:** `editorState.selection`(이미 존재: select 툴 + 마퀴 드래그, `DragOperationHandler.ts`)이 잡히면 영역 옆 팝업 렌더. 기존 우클릭 "이 영역에 AI 작업"(`EditScene.ts:329`, `mapSelectionContextMenu`)을 이 팔레트로 승격/통합.
- **프리미티브 (결정적 스탬프, LLM 미사용):** 🏠집 · 🌊강 · 🛣️길 · 🔺지붕 · 🧍NPC · 🌲나무 · 🪑소품. 기존 `stampBuildHouse`(mapTools) / `rmTypeExpander` / v3 확장기 재사용.
- **🏠집 = 벽→문→지붕 오케스트레이터** — 선택 영역 크기에 맞춰 벽 시공 → 하단 중앙 문 → 지붕까지 한 번에. ("집짓기에 지붕 추가" 해결)
- **어휘 자동선택 프리셋:** 역할별(wall/door/window/roof/path/water/tree/prop) 기본 어휘 id 프리셋. 선택 어휘가 미승인이면 팔레트가 자동 propose+자동 approve(결정적이라 사용자 승인 불필요) → "매번 승인" 마찰 제거. 프리셋은 **지붕 역할을 반드시 전개 가능 패턴(`nine_slice_expandable` 등)으로** 보장.
- **툴바:** `src/editor/panels/editorZoomToolbar.ts`에 `[🏗️건축▾]` 토글 추가(팝업 자동표시 on/off). 확대·저장 옆.

**지붕 버그 수정(2중):**
1. 프리셋이 지붕 어휘를 `overlay_detail`로 두지 않게 보장(전개 가능 패턴 지정).
2. 안전망: `src/editor/tools/v3/rmTypeExpander.ts:203` `expandRoof`가 `overlay_detail`을 만나면 throw 대신 장식 오버레이 경로로 우회(또는 상위 그룹에서 전개 가능한 형제 파트 선택). 승인 시 `patternGrammar.parts` 미도출 갭(`vocabularyTools.ts:253`)도 보정.

**D. AI-fill (✨) 통합:** 팔레트 "✨ AI로 채우기" = 선택 영역 좌표를 프롬프트에 자동 주입 → `set_build_spec` 자동 밑그림 → minimax 에이전트 위임. 기존 region-task 경로 재사용(가능하면 `aiChatPanel` 수정 없이).

**수용 기준:** 영역 드래그 → 팝업 → 🏠집 클릭 → 벽+문+지붕 즉시 시공(LLM 호출 0, 재시도 0, 되돌리기 가능). 길/강/NPC 동일. Playwright E2E로 실측.

---

## C. 슬래시 팔레트 + 어시스턴트 경량화

**대상:** `src/editor/panels/aiChatPanel.ts`, `aiSkillDrawer.ts`, `slashHost`.

- 헤더에서 **모드뱃지(`ai-mode-badge`, :1768) · 스킬핀바(`ai-skill-pinbar`, :1483) 제거** → 헤더 = 제목 + 상태(status/abort)만.
- `/` 슬래시 메뉴 확장(`slashHost` 재사용): 스킬 검색 + 각 항목 설명/예시(레시피). 평소 숨김, `/`로 소환. 스킬 토글 "+"는 슬래시로 통합/제거.
- 스킬 드로어는 유지하되 슬래시의 "전체 보기"로만 진입.
- 모델 정책: 모든 LLM `minimax/minimax-m3` 유지. 테스트가 옛 모델 기대하면 테스트를 minimax로 고칠 것(코드 되돌리기 금지).

**수용 기준:** 헤더에 뱃지/핀바 없음. `/`로 스킬 목록 검색·소환. 기존 2272 테스트 불변(모드뱃지/핀바 관련 테스트는 신 IA에 맞게 수정).

---

## 위임 분할 (codex 병렬, 파일 겹침 최소)

- **T1 (arg 정규화):** `jsonSchema.ts` + v1 region 툴 3개 에러예시 + 테스트. (A)
- **T2 (건축 팔레트+지붕):** `buildPalette.ts`(신규) + `EditScene.ts` + `editorZoomToolbar.ts` + `rmTypeExpander.ts` + 어휘 프리셋 + `mapSelectionContextMenu`. (B+D)
- **T3 (슬래시 IA):** `aiChatPanel.ts` + `aiSkillDrawer.ts` + slash 확장. (C)

교차 파일 없음(T1=툴층, T2=에디터/씬층, T3=AI패널층). 각 워크트리 독립. 팀장(Claude)이 워크트리 생성 → codex 파일수정 → diff audit(특히 minimax 정책 위반 폐기) → commit → 병합 → tsc + 전체 테스트 게이트 → build + pm2 restart.

## 검증

1. `npx tsc --noEmit` 0, `npx vitest run` 2272 passed 유지(+신규).
2. Playwright E2E: 영역 드래그→집/길 결정적 스탬프(LLM 0), arg 재시도 0, 슬래시 스킬 소환.
3. 스크린샷으로 지붕 포함 집 완성 확인.
