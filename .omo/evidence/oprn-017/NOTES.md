# OPRN-OUT-017 — Keep manual painting recoverable when hard-cluster validation rejects

Branch `agent/oprn017`, worktree `/home/main/z-project/rpg-zzu-oprn017`, dev port 9852.
Date 2026-09-10.

## What changed

| File | Role |
|---|---|
| `src/editor/tools/clusterRulePlacement.ts` | Structured `HardClusterRejection` (kind, companion tile + coords, origin, rule id/message, group) beside the legacy `reason` string; rule attribution keeps the rule that first created the blocked cell. |
| `src/editor/tileActions.ts` | New `exactPlacement` and `onRejected` paint options; `planExactPlacement` guards protected cells and foreign upper objects; exact writes skip tree-pair repair; protected-cell computation split into a non-caching `computeProtectedClusterCells`. |
| `src/editor/clusterAssistRecovery.ts` (new) | Owns the recovery contract: `clusterRecoveryOffer` (pure), `presentClusterRecovery` (toast + `cluster-exact-place` action), `applyExactPlacement` (one undo unit), `freehandPaintOptions`, `clusterAssistCopy`, `toggleClusterAssistMode`. |
| `src/editor/editorState.ts` | New `clusterAssistMode` (default **true**), independent of `autoConnectMode`. |
| `src/editor/TilePaintEngine.ts` | Freehand paint routes through `freehandPaintOptions`; first rejection per stroke presents the recovery offer. |
| `src/editor/panels/tilePalettePreviewPanel.ts` | Second `.tile-brush-cluster-row` with `cluster-assist-mode-toggle`; neighbor-connection copy now points at the separate cluster contract. |
| `src/editor/panels/tilePalette.ts` | Hoists both rows into the paint options bar. |
| `src/styles/editor/left-sidebar.modern.css` | Geometry for the new row (same touch-target rule as the neighbor row). |
| `openwiki/editor-validation.md`, `openwiki/editor-pre-edit-routing.md`, `openwiki/INDEX.md` | Recorded the two independent contracts, the rejection payload, the exact-placement guardrails, the protected-cell cache trap, and the out-of-scope `bAlt` candidate. |
| `test/clusterAssistRecovery.test.ts`, `test/clusterAssistUi.test.ts` (new), `test/tileActions.m1.test.ts` | Regression coverage (see below). |
| `scripts/qa/cluster-assist-recovery.mjs` (new), `verify-shots/oprn-017/` | Real-Chromium browser proof. |

## Proving commands

```
npm run typecheck:app                      # exit 0, no output
npx vitest run test/clusterAssistRecovery.test.ts --maxWorkers=2      # 24 passed
npx vitest run test/clusterAssistUi.test.ts --maxWorkers=2            #  6 passed
npx vitest run <15 related suites> --maxWorkers=2                     # 181 passed / 15 files
DEV_SERVER_PORT=9852 npm run dev:worktree  +  node scripts/qa/cluster-assist-recovery.mjs
                                                                      #  6/6 PASS, page errors: none
npm run gates -- --only css                # css exit=0 budget=0 graph=0, no regression vs baseline
```

Baseline notes (measured in this worktree, `git stash -u` at `859ebc5ee`):
- `npm run gates` (full) fails before any gate reports, at `vitest JSON 리포트가 생성되지 않았다 (exit=1)`,
  **identically with and without this change** — pre-existing infrastructure red.
- `test/interiorLongTable.test.ts`: 25 failed / 27 passed at baseline, unchanged by this work.
- `test/aiClusterAssist.test.ts`: all tests pass; an unrelated unhandled rejection
  (`session.retireRun is not a function`, `aiTurnRunner.ts:556`) is pre-existing.
- Full `npm run typecheck` is red at baseline (`test/` type errors); no errors in my files.

## Acceptance criteria

### 1. A user can place or repair an exact tile 290, 291, or 292 even when assisted expansion cannot succeed — **MET**
Unit: `test/clusterAssistRecovery.test.ts` → "맵 위쪽 경계에서 밑동 %i 은 보조 배치가 거부되지만
정확 배치로 놓을 수 있다", "위 칸이 다른 덧그림 오브젝트일 때…", "보호셀이 동반 타일 자리인…"
(each `it.each([290,291,292])`). All 24 tests pass in one run.
Browser: `verify-shots/oprn-017/B-{290,291,292}-rejection-offers-exact-place.png` + `RESULTS.json`,
e.g. 292 → exact placement wrote 292 at (54,51) while the blocking object at (54,50) survived.

### 2. Assisted mode still places valid tree companions atomically — **MET**
Unit: "정상 공터에서 보조 배치가 밑동 %i 과 수관을 함께 놓는다" (290→260, 291→261, 292→262 plus
the 2×2 right column 293/263), with `validateClusterRules` returning `[]`.
Browser: `A2-assisted-places-companion-atomically.png`, observed `{trunk:290, canopy:260}`.

### 3. Exact placement changes only the selected cell and layer, never silently overwriting another upper object or protected cell — **MET**
Unit: "보조를 끈 손붓은 밑동 %i 을 경계에서 그대로 놓고…" asserts the neighbouring cells on both
layers are untouched; "정확 배치도 보호셀 자체는 덮지 않고, 그 사실을 복구 불가로 말한다"
(`recoverable:false`, cell unchanged); "정확 배치는 이웃의 완성된 나무를 조각내지 않는다".
Browser: each `B-*` scenario asserts `changed.length === 1` across both layers.

### 4. Any hard-cluster violation created by exact placement stays visible with its rule, required companion and coordinates — **MET**
Unit: same test asserts `cluster-rule:adjacency:` code, `rule.message` containing the required
canopy id, and the coordinate in `coords`.
Browser: `C-exact-mode-paints-boundary-and-lint-shows-debt.png`, observed violation
`cluster-rule:adjacency:harness-combined-town-dry-tree` at `44,39`.

### 5. Neighbor auto-connection and hard-cluster assistance are independently represented in behavior and UI copy — **MET**
Behavior: `clusterAssistMode` is a separate state; unit test "구조 보조 토글은 이웃 연결 상태를
건드리지 않는다" and "보조 배치는 기본 켜짐이고 이웃 연결과 별개 상태다".
Copy: `test/clusterAssistUi.test.ts` → two distinct toggles/testids/aria-pressed, neighbor title
containing "지형 연결만" + "구조 보조", and different on/off cluster copy.
Browser: `A1-two-independent-controls.png` shows「이웃 연결 수동」and「구조 보조 보조」as two rows;
`RESULTS.json` records both titles verbatim.

### 6. Rejection presents an actionable recovery path rather than only leaving the operation unchanged — **MET**
Unit: `test/clusterAssistUi.test.ts` → "경계 거부 토스트에 규칙 문장과 정확 배치 버튼이 함께 있고,
누르면 그 칸이 칠해진다" (clicks the real `cluster-exact-place` button, asserts the tile),
and the unrecoverable case shows a next-step hint instead of a dead button.
Browser: `B-{290,291,292}-rejection-toast.png` — e.g. 292 toast reads
「보조 배치 실패 — 타일 292 (54,51): 동반 타일 262 자리 (54,50)의 덧그림에 다른 오브젝트가 있습니다
— 규칙: 활엽수 왼쪽 열은 상단(262)이 하단(292) 바로 위에 있어야 합니다.」with the action button
「이 칸만 정확히 배치 (292)」.

### 7. Tests cover 290, 291, 292 at a map boundary, under an occupied upper cell, next to a protected cell, and in a valid open area — **MET**
All four situations are `it.each([290, 291, 292])` in `test/clusterAssistRecovery.test.ts`
(24 tests, single run, no sleeps/polling — the toast path is exercised through real DOM events).

### 8. Undo and redo treat each assisted or exact operation as one coherent author action — **MET**
Unit: "보조 배치 한 번은 되돌리기 한 번으로 동반 타일까지 사라지고 다시 실행으로 되돌아온다"
(map JSON equality against the pre-edit snapshot) and "복구 정확 배치(밑동 %i)도 되돌리기 한
번짜리 행동이다" for all three tiles; rejected paints record no history at all.
Browser: each `B-*` scenario undoes once, checks the cell reverted, redoes once, checks it returned.

### 9. Existing AI tools, structure-kit validation and multi-cell stamp behavior remain unchanged — **MET**
No AI tool, changeset or structure-kit file was modified. `exactPlacement` is opt-in and only the
freehand engine passes it; `clusterExpand:false` semantics are byte-identical for stamps.
Unit: "여러 칸 스탬프는 여전히 동반 확장 없이 고른 그대로 찍고…"; suites `aiClusterAssist`,
`clusterRulePlacement`, `structureKitBrushConditions`, `tilePaletteStamp`, `postTileVerify`,
`clusterRuleCommitGate`, `villageTreePlacement`, `authorHouseTreeClearance`, `farmingStarterTree`
all pass unchanged.

### 10. The `bAlt` parity candidate is tested and reviewed separately before any scope expansion — **MET (deliberately deferred, untouched)**
`expandHardClusterPlacement` still ignores `bAlt`. No behavior, test or copy in this change
depends on alternative-tile parity. Recorded as out of scope in
`openwiki/editor-validation.md` ("`bAlt` 패리티 … 범위 밖이며 별 회귀와 승인이 필요하다").

## Incidental defect found and fixed inside scope

Computing the recovery preview must not populate the protected-cell cache: `protectedClusterCells`
is not invalidated by tile-only store changes, so a warmed cache made later-created events
invisible as protected cells. Exact placement now uses the non-caching
`computeProtectedClusterCells`. Regression: "복구 가능 여부를 미리 계산해도 보호셀 판정이
낡지 않는다" — verified to fail when the fix is reverted and pass with it.

## Blockers

None. Content/Supabase persistence is not applicable: this is editor-engine + UI code with
local-only QA fixtures (`?freshProject=1`, remote persistence asserted disabled), no authored
map/event content.
