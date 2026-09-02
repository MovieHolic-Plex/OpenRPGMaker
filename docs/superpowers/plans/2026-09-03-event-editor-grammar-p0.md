# 이벤트 편집기 문법 고정(P0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (이 저장소는 서브에이전트 병렬 편집을 금지한다 — AGENTS.md). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 제안서 P0 — 코드 구조를 바꾸지 않고 이벤트 편집기의 시각 문법(글자 4종 · 라운딩 2종 · 버튼 ≤ 12종 · SVG 아이콘 · 대비 ≥ 4.5:1)과 탈출 규칙(팝오버 바깥 클릭 · 확인 문구)을 고정하고, 그것을 기계로 재는 게이트를 남긴다.

**Architecture:** 스타일은 캐스케이드 최종 승자인 `src/styles/editor/event-editor.balanced.css` 끝에 「문법 고정」 절을 **덧붙여** 이긴다(새 파일 금지 — CSS 예산 래칫의 파일 수 지표). 아이콘은 `tileToolbarIcons.ts` 의 `buildSvgIcon` 위에 이벤트 편집기 전용 `editorIcons.ts` 를 얹어 글리프 문자를 대체한다. 동작 수정(팝오버 · 확인 문구 · 헤더 · 원시 ID · 분기 끝 행)은 각 모듈 안에서 최소 변경. 측정은 `scripts/qa-event-editor-ux.mjs` 의 C7~C12 로 고정한다.

**Tech Stack:** TypeScript(vite, no framework) · vitest(happy-dom/fakeDom) · Playwright(측정 스크립트) · 표면 스냅샷 게이트(`npm run gates -- --only surface`) · CSS 예산 래칫(`npm run gates -- --only css`).

**Spec:** `docs/proposals/2026-09-03-event-editor-ux-redesign.html` §8 삭제 목록 · §13 시각 규격 · §14 지표 · §15 P0 행.

## Global Constraints

- CSS 파일 수 · hex 리터럴 수 · `!important` 수는 기준선(`.omo/css-budget-baseline.json`) 보다 **늘 수 없다**. 새 색은 기존 `--cmdcat-*` 값 교체로, 새 hex 가 필요하면 같은 시트의 다른 hex 를 `var()` 로 바꿔 상쇄한다.
- 표면 스냅샷 기준선(`test/fixtures/*Surface.baseline.json`)은 의도한 변경만 담아 **별도 커밋**으로 갱신한다(`SHELL_SURFACE_UPDATE=1` 등). 갱신 실행은 설계상 실패하므로 환경변수 없이 다시 돌려 초록을 확인한다.
- testid 는 전부 보존한다. `event-editor-aux-tools`(도구 ▾) 는 e2e 9개가 잡고 있어 P0 에서 제거하지 않는다.
- 글자 크기는 12 · 13 · 15 · 18px 만, 라운딩은 6px(바깥) · 4px(안쪽) · 50%(아바타 점) 만 쓴다.
- 이모지 · 글리프 문자를 아이콘으로 쓰지 않는다(DESIGN.md 「No emoji icons」). 텍스트로 뜻을 전하는 문자(«×» 닫기 등)도 SVG 로 바꾼다.
- 모든 커밋은 `type(scope): 한국어 문장한다` 형식, 트레일러 `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

### Task 1: 측정 게이트 C7~C12 를 먼저 늘리고 RED 를 기록한다

**Files:**
- Modify: `scripts/qa-event-editor-ux.mjs` (C3 뒤, 1440 으로 복귀한 뒤 측정)

**Interfaces:**
- Produces: results.json 항목 `C7`(버튼 시그니처 ≤ 12) `C8`(글자 크기 ⊆ {12,13,15,18}) `C9`(라운딩 ⊆ {6px,4px,50%}) `C10`(이모지·글리프 아이콘 버튼 0) `C11`(대비 < 4.5 텍스트 0) `C12`(팝오버 바깥 클릭 시 닫힘).

- [ ] **Step 1:** 측정 함수를 추가한다. 시그니처 = 배경 | 글자색 | 테두리 | 라운딩 | 글자 크기 | 굵기 | 높이. 대비는 텍스트 노드 색 vs 가장 가까운 불투명 조상 배경(WCAG). 이모지 판정은 `/[←-⇿⌀-➿⬀-⯿\u{1F000}-\u{1FAFF}]/u` 가 버튼 textContent 에 있고 SVG 자식이 없는 경우.
- [ ] **Step 2:** `QA_BASE_URL=http://127.0.0.1:9631 node scripts/qa-event-editor-ux.mjs --label p0-red` — C7~C12 가 FAIL 인 것을 확인한다(RED).
- [ ] **Step 3:** 커밋 `test(editor): 이벤트 편집기 UX 게이트에 문법 기준 C7~C12 를 더한다`.

### Task 2: SVG 아이콘 모듈과 글리프 대체

**Files:**
- Create: `src/editor/panels/eventEditor/editorIcons.ts`
- Test: `test/editorIcons.test.ts`
- Modify: `storyboardView.ts`(↑↓✎✕), `content.ts`(toolbarButton 글리프 · 검색 × · ✧), `modal.ts`(× ⛶), `modalFullscreen.ts`(❐/⛶), `commandInspector.ts`(×), `commandPicker.ts`(★☆ · △ ! · 탭 글리프), `commandList.ts`(`::` 핸들 · 카테고리 아이콘 · ↑↓x), `commandCategoryIcons.ts`(`icon` 필드), `subdialog.ts`(×), `aiAssist.ts`(✧), `inline.ts`(✕)

**Interfaces:**
- Produces: `export type EditorIconName = "chat"|"choice"|"branch"|"switch"|"variable"|"route"|"clock"|"door"|"coin"|"cart"|"sound"|"image"|"spark"|"search"|"plus"|"close"|"undo"|"redo"|"arrowUp"|"arrowDown"|"pencil"|"trash"|"copy"|"cut"|"star"|"starFilled"|"warning"|"info"|"drag"|"expand"|"collapse"|"person"|"sword"|"party"|"growth"|"gear"|"tool"|"sun"|"picture"|"flow"|"list"`; `export function renderEditorIcon(name: EditorIconName, opts?: { readonly label?: string; readonly size?: 16 }): Element` — DOM 에 `createElementNS` 가 없으면(fakeDom) `<span class="ee-icon ee-icon-fallback" aria-hidden>` 를 돌려준다. `CategoryVisual` 에 `readonly icon: EditorIconName` 추가, `export function renderCategoryIcon(visual: CategoryVisual): Element`.

- [ ] **Step 1:** 실패 테스트 — `renderEditorIcon("close")` 가 happy-dom 에서 `svg` 태그 · `aria-hidden="true"` · `class="ee-icon"` 을 갖고, 라벨을 주면 `role="img"` + `aria-label` 이 붙는다. `commandCategoryVisual({kind:"text",body:""}).icon === "chat"`.
- [ ] **Step 2:** 구현. 아이콘 경로는 16×16 viewBox, stroke 1.5, `currentColor`. `buildSvgIcon` 을 쓰거나 같은 규약의 로컬 빌더.
- [ ] **Step 3:** 호출처의 글리프 문자를 아이콘 노드로 바꾼다. 버튼은 `children: [icon, el("span",{class:"ee-label", text})]` 형태. testid · aria-label · title 은 그대로.
- [ ] **Step 4:** `npx vitest run test/editorIcons.test.ts test/eventEditorViewToggle.test.ts test/eventEditorUiDensity.test.ts test/eventEditorModal.test.ts` 통과. 표면 스냅샷 축은 Task 8 에서 갱신.
- [ ] **Step 5:** 커밋 `feat(editor): 이벤트 편집기의 글리프 아이콘을 SVG 세트로 바꾼다`.

### Task 3: 팝오버는 바깥 클릭에 닫힌다

**Files:**
- Modify: `src/editor/panels/eventEditor/content.ts` `makePopoverEscapable`
- Test: `test/eventEditorPopoverDismiss.test.ts` (happy-dom)

- [ ] **Step 1:** 실패 테스트 — 렌더 후 `event-command-edit-menu` 의 summary 를 클릭해 열고, `document.body` 에 `pointerdown` 을 보내면 `details.open === false`; 팝오버 안쪽 버튼에 `pointerdown` 을 보내면 열린 채다.
- [ ] **Step 2:** 구현 — toggle 로 열릴 때 `document.addEventListener("pointerdown", onOutside, { capture: true })`, 닫힐 때 제거. `onOutside`: `details.contains(event.target)` 이면 무시, 아니면 `details.open = false`.
- [ ] **Step 3:** 테스트 통과 → 커밋 `fix(editor): 툴바 팝오버가 바깥을 누르면 닫힌다`.

### Task 4: 닫기 확인 문구가 실제 버튼 이름을 말한다

**Files:**
- Modify: `src/editor/panels/eventEditor/modal.ts:151-156`
- Test: `test/eventEditorModal.test.ts` (기존 confirm 테스트 옆)

- [ ] **Step 1:** 실패 테스트 — 변경이 있는 상태에서 `requestClose` 경로(헤더 × 클릭)로 뜬 확인창의 본문이 `[적용]`·`[저장하고 닫기]` 를 언급하고 `[반영하고` 를 포함하지 않는다.
- [ ] **Step 2:** 문구를 `"적용하지 않은 변경이 있어요. 버리고 닫을까요?\n반영하려면 [계속 편집]을 누른 뒤 아래 [적용] 또는 [저장하고 닫기]를 누르세요."` 로 바꾼다. 버튼 라벨 · testid · danger 는 그대로(e2e 계약).
- [ ] **Step 3:** 커밋 `fix(editor): 닫기 확인창이 존재하지 않는 버튼 대신 실제 푸터 버튼을 가리킨다`.

### Task 5: 헤더는 맵 이름을 말하고, 없는 것은 말하지 않는다

**Files:**
- Modify: `src/editor/panels/eventEditor/modal.ts renderModalHeader`
- Test: `test/eventEditorModal.test.ts:338-342, 490-495`

- [ ] **Step 1:** 테스트 갱신 — `event-editor-map-name` 이 맵 이름을 담고 좌표 앞에 온다; `characterId` 가 없으면 `event-editor-npc-chip` 이 렌더되지 않는다(있으면 이름); `event-editor-header-page-count` 는 더 이상 렌더되지 않고 `event-editor-name` 의 aria-label `페이지 이름 (2/2)` 가 그 정보를 담는다.
- [ ] **Step 2:** 구현 — `map?.name` 스팬(testid `event-editor-map-name`) 추가, NPC 칩은 `characterId` 있을 때만, 페이지 카운터 스팬 제거(`refreshHeaderPageSegments` 의 카운터 갱신 분기도 제거).
- [ ] **Step 3:** 커밋 `fix(editor): 이벤트 편집기 헤더가 맵 이름을 말하고 «NPC 없음»·중복 페이지 수를 뺀다`.

### Task 6: 원시 ID 를 이름으로 읽는다

**Files:**
- Modify: `src/editor/panels/eventEditor/commandSummary.ts:169-181` (moveEvent · setEventGraphicPattern), `moveRouteDialog.ts` (대상 입력 옆 이름 라벨)
- Test: `test/commandSummaryEventName.test.ts`

- [ ] **Step 1:** 실패 테스트 — 현재 맵에 `{id:"ev_a", pages:[{name:"대장장이"}]}` 가 있을 때 `moveEvent{eventId:"ev_a"}` 요약이 `대장장이` 를 담고 `ev_a` 를 담지 않는다; 자기 자신은 `이 이벤트`, `@player` 는 `주인공`, 모르는 id 는 `ev_x (없음)`.
- [ ] **Step 2:** 구현 — `eventNameForSummary(eventId)`: `editorState.currentMapId` 의 이벤트에서 `eventDisplayName()`; 못 찾으면 전 맵 검색; 그래도 없으면 `${id} (없음)`.
- [ ] **Step 3:** 커밋 `fix(editor): 명령 요약과 이동 경로 대상이 이벤트 ID 대신 이름을 보인다`.

### Task 7: 「선택 끝」「분기 끝」 행을 목록에서 뺀다

**Files:**
- Modify: `src/editor/panels/eventEditor/commandList.ts:374-378`
- Test: `test/commandListBranchEnd.test.ts`

- [ ] **Step 1:** 실패 테스트 — choices/fork 를 렌더한 목록에 `.cmd-line-marker` 텍스트가 `끝` 으로 끝나는 행이 없고, 분기 머리 행과 명령 행은 그대로다.
- [ ] **Step 2:** `branchGroupEndLabel` 호출 블록을 제거한다(함수 자체는 다른 표면에서 쓰지 않으면 함께 제거).
- [ ] **Step 3:** 커밋 `fix(editor): 명령 목록의 «분기 끝» 마커 행을 없앤다 — 들여쓰기가 이미 구조를 말한다`.

### Task 8: CSS 문법 고정 절

**Files:**
- Modify: `src/styles/editor/event-editor.balanced.css` (끝에 `/* ── 문법 고정 (2026-09-03) ── */` 절), `src/styles/editor/event-editor.modernize.css:6-15` (`--cmdcat-*` 값)

- [ ] **Step 1:** 글자 크기 — 인벤토리(§2)의 10 · 10.5 · 11 · 11.5px 클래스를 12px 로, 14px 보조 텍스트를 13px 로. 라운딩 — 5 · 7 · 8 · 10px 을 6px, 2 · 3 · 999px 을 4px 로. 대비 — `--text-3` 를 쓰는 틴트 위 텍스트를 `--text-2` 로. 버튼 — primary / secondary / ghost / icon / danger-text / chip 여섯 묶음으로 배경 · 테두리 · 라운딩 · 글자 · 높이 통일. 레일 그룹 헤더 버튼의 UA 기본 테두리 · 바탕을 명시적으로 지운다.
- [ ] **Step 2:** `--cmdcat-*` 를 6색으로: dialogue `var(--accent)`, flow `var(--warning)`, reward `var(--success)`, map `#0F7490`, screen · sound `#7A3E9D`, system · battle · actor · modern `var(--text-3)`. 새 hex 2개는 balanced.css 의 하드코딩 hex 2개 이상을 `var()` 로 바꿔 상쇄한다.
- [ ] **Step 3:** `npm run gates -- --only css` 통과(hex · important · 파일 수 증가 없음). `QA_BASE_URL=http://127.0.0.1:9631 node scripts/qa-event-editor-ux.mjs --label p0-green` 으로 C1~C12 PASS.
- [ ] **Step 4:** 커밋 `style(editor): 이벤트 편집기 문법을 고정한다 — 글자 4종·라운딩 2종·버튼 6묶음·대비 4.5`.

### Task 9: 표면 기준선 갱신과 게이트

- [ ] **Step 1:** `npm run gates -- --only surface` 로 어떤 축이 바뀌었는지 본다. 바뀐 항목이 Task 2 · 7 의 의도(글리프 → SVG, 끝 행 제거, 새 클래스)와 일치하는지 diff 로 확인한다.
- [ ] **Step 2:** `SHELL_SURFACE_UPDATE=1 npx vitest run test/eventEditorShellSurface.baseline.test.ts` 등 바뀐 축만 갱신, 환경변수 없이 재실행해 초록 확인. `CSS_LIVE_BASELINE_UPDATE=1 node scripts/check-css-live-classes.mjs --save-baseline` 은 클래스가 속성을 잃었을 때만.
- [ ] **Step 3:** `npm run gates` 전체 — 기준선 대비 새 실패 0. 커밋 `test(surface): 문법 고정 뒤 표면·CSS 라이브 기준선을 다시 뜬다`.

### Task 10: 문서

- [ ] **Step 1:** `DESIGN.md` 이벤트 편집기 절에 「문법 고정(2026-09-03)」— 글자 4종 · 라운딩 2종 · 버튼 6묶음 · 아이콘 세트 · `--cmdcat-*` 6색 · 게이트 C7~C12.
- [ ] **Step 2:** `openwiki/editor-event-authoring.md` 에 절 추가 — 팝오버 · 확인 문구 · 헤더 · 원시 ID · 끝 행 · 측정 방법.
- [ ] **Step 3:** 커밋 `docs(editor): 이벤트 편집기 문법 고정을 DESIGN.md 와 위키에 적는다`.
