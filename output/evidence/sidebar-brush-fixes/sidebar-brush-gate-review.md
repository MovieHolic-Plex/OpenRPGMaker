# Sidebar / tile-brush gate review

recommendation: REJECT

Reviewed locked HEAD `574c9f784b6d883c4cada914f6f61f26851c39ae` against `d81ab7be`. Paths below are relative to the locked sidebar-review checkout unless prefixed `lead:`. No tests, builds, browsers, children, commits, or product edits were run/made. This report is the only write. No ulw plan applies; the requested fallback report location is used.

## originalIntent

Fix all seven approved sidebar/brush issues and three stamp candidates, verify the real editor, and deliver atomic commits and a PR without content authoring, remote project writes, theme redesign, deployment, or merge.

## desiredOutcome

The user's chosen brush size, material, layer, and stamp agree with the actual map changes; sparse strokes remain continuous and undoable; no-op input retains redo; all three sidebar modes retain usable controls, geometry, focus, and honest search feedback.

## blockers

### B1
- violatedCriterion: **C8 - custom source-coordinate drag creates a per-layer stamp and actual placement preserves its authored variants.**
- observation: Multi-cell stamps bypass autotile shaping and cluster expansion, but still execute built-in tree-pair repair. That repair interprets arbitrary custom-atlas IDs as bundled tree parts and can replace a selected stamp cell with an unselected ID.
- evidencePointer: `src/editor/TilePaintEngine.ts:276-292`; `src/editor/tileActions.ts:119-121,146-149,699-704`; `src/project/lint/repairTreePairs.ts:59-84`; `src/project/tilesetHarness/combinedTown.ts:100-109`.
- Concrete static trace (not claimed as an executed test): use a custom atlas with count >= 291, four source columns, and no forest replacement exemptions. Set priority 285/286 to upper and 289/290 to lower. Drag source 285 -> 290: `src/editor/tilePaletteStamp.ts:35-60` creates the 2x2 cells `[285,286,289,290]` with those layers. Place at map (5,5). Custom priority is authoritative (`src/editor/tileLayerClassification.ts:30-34`). The upper cells enable `repairTrees`; lower tile 290 at (6,6) is unconditionally recognized as a built-in trunk. Repair writes upper 260 at (6,5), replacing the stamp's authored upper 286. Expected selected-cell values `[285,286,289,290]`; statically derived result `[285,260,289,290]`.
- Why in scope: this is the newly enabled custom per-layer source-stamp placement contract, not an unrelated fence-routing failure or a hypothetical future feature. The source atlas is expressly arbitrary, with authored columns and priorities.
- Required correction: ensure custom source stamps preserve authored cell IDs/layers through the remaining tree-repair post-processing, without disabling ordinary bundled-tree behavior. Add a mixed-layer custom-atlas placement regression through the real engine for this case; supervisor owns execution.
- Why existing green does not refute it: `test/tileBrushState.test.ts:62-83` and `scripts/qa/sidebar-brush.mjs:283-326` use only lower-layer IDs 7/8/37/38, avoiding the tree-repair condition. `test/sidebarBrushUi.test.ts:106-126` checks mixed-layer stamp creation, not actual mixed-layer placement.

## userOutcomeReview

| Criterion | Review finding |
| --- | --- |
| C1 | Exact half-open N-by-N footprint is shared by paint/erase and hover; map writes clip bounds. Tests cover sizes 1-4 and clipped preview; browser receipts show 4/16 cells. No additional blocker found. `TilePaintEngine.ts:237-251`, `editSceneHoverPreview.ts:49-64`, `test/editScenePaintHistory.test.ts:90-110`. |
| C2 | Interpolated centers feed bulk edits, with one snapshot at the first real mutation. Forward/reverse/diagonal/edge regression cases inspect coordinates and undo/redo; browser receipt records 13 cells and one undo. `TilePaintEngine.ts:94-101,191-193,254-267`, `test/editScenePaintHistory.test.ts:112-150`. |
| C3 | Synchronous before/after comparison gates snapshot insertion for paint/fill/erase/shape and blocked stamps. Store update/updateMap clone before mutation (`src/project/store.ts:757-795`), matching the retained-reference assumption. `mapEditHistory.ts:186-207`, `DragOperationHandler.ts:201-214`; no-op regression tests exercise actual history. |
| C4 | Shared native size/status controls are mounted in all modes; direct-size tests include actual selection and keyboard focus survival. Nine JSON geometry rows have canvas widths 698-1152px and no overflow. Existing E2E source explicitly checks map-list >=108px and focus (`test/e2e/left-sidebar-adversarial.spec.ts:68-139`); its execution pass is supervisor-reported, not independently rerun. |
| C5 | Display-only representative projection keeps the original paint ID. Unmatched filter exemption and pressed/roving state use 363 for picked 423. `panels/tilePaletteGrid.ts:158-160`; browser receipt records 423/363. |
| C6 | Toolbar and right-click share lower-visible/upper-current policy, including EMPTY; explicit layer sampling remains separate. `TilePaintEngine.ts:181-228`; four policy rows plus explicit-pick test in `test/tileBrushState.test.ts:127-153`. |
| C7 | True match count, retained-selection explanation, and reset-focus path exist. `panels/basicTilePalette.ts:43-66`, `panels/basicLeftRail.ts:383-386`; browser receipt records zero matches and restored focus. |
| C8 | Kit-after-rect/round and B/1/Paint reset paths are corrected. Custom gesture creates source-coordinate per-layer cells and has bounded listener ownership, but placement still violates preservation for the concrete mixed-layer case above. |

## Direct remove-ai-slops / programming pass

Loaded `/home/main/.claude/skills/remove-ai-slops/SKILL.md`, its `references/slop-categories.md`, and `/home/main/.claude/skills/programming/SKILL.md`, `references/philosophy.md`, and `references/typescript/README.md`. Applied them as review criteria, not permission to refactor.

- Reviewed the complete production/test diff and immediate contracts. Shared brush controls and gesture lifetime extraction have actual callers/responsibilities; no speculative parsing or normalization layer was introduced. The history comparison is necessary because store writes clone even for unchanged values, though it serializes the map until the first mutation.
- No added skipped/deleted failing tests, type suppression directives, deletion-only tests, or tests merely asserting removal were found. Overflow tests now assert positive direct reachability/uniqueness; keyboard tests assert navigation and focus rather than merely adjusting counts. Eraser copy comparison is shipped-copy equality, not prose pinning.
- Overfit/false-confidence NOTE: footprint expected-value loops closely resemble production loops; mixed-layer creation and all-lower placement tests leave the C8 post-processing intersection untested. This is a concrete coverage weakness, not grounds to discard otherwise useful regressions.
- Resource/lifetime review: custom pointer listeners and MutationObserver clean up on release, cancellation, scrolling, blur, and detachment; pointer IDs and containment prevent replacement-sheet commits. The browser harness records failures rather than suppressing them and closes its context in `finally` after setup. No new remote-writing product path was found.
- Async-test NOTE: the new QA harness uses double requestAnimationFrame waits at lines 65 and 232 instead of subscribing to the exact layout condition. The existing E2E resize helper does subscribe before resizing. This is a determinism concern, not independent evidence of a C1-C8 product failure.
- Programming NOTE: new tests use partial Phaser stand-ins cast `as never`; graphics are mocked while state, placement, and history remain real. No assertion/normalization refactor is warranted solely to satisfy stylistic preferences in this bounded audit.
- Report-coverage gap: `lead:output/evidence/sidebar-brush-fixes/core-REPORT.md` and `ui-REPORT.md` describe behavior/tests but do **not** explicitly record the same remove-ai-slops/programming perspective or enumerate excessive/useless, deletion-only, tautological, implementation-mirroring tests and unnecessary extraction/parsing/normalization. This direct review supplies the check; the missing upstream checklist is a NOTE, not a C1-C8 blocker.

## Checked artifacts and exact evidence limits

- Full `git diff d81ab7be` for the 16 changed production files, six changed test files, `scripts/qa/sidebar-brush.mjs`, `DESIGN.md`, and `openwiki/editor-pre-edit-routing.md`; locked HEAD and initially clean checkout confirmed.
- `lead:.omo/evidence/sidebar-brush-core.md`, `lead:.omo/evidence/sidebar-brush-ui.md`.
- `output/evidence/sidebar-brush-fixes/summary.json`, `red/results.json`, `red-stamps/results.json`, `verified/results.json`, `stamp-verified/results.json` read in full. A read-only metadata comparison reproduced that summary rows equal 11 PASS rows from verified plus C8a PASS from stamp-verified. Verified's stale-DOM C8a failure remains visible, not silently converted to PASS. Both final JSON receipts record cleanup=true and errors=[].
- All 11 committed PNG files named in summary: bytes, PNG signature, width, and height independently matched metadata. Pixels were not inspected; no aesthetic approval is claimed. Some scenario-row screenshot names are not among the committed 11; those rows were reviewed as JSON/behavior evidence, not inspected images.
- `lead:output/evidence/sidebar-brush-fixes/core-REPORT.md`, `ui-REPORT.md`, `core-tests.log`, `ui-final-tests.log`; `/tmp/ulw-20260906-160440.3NgH3D.md`.
- `core-tests.log` contains 79 passing tests and typecheck exit 0. `ui-final-tests.log` is the earlier isolated-worker 98-test run, not the supervisor's final 95-test run. The final 95 UI / 81 stamp-default tests, build, CSS gate, and E2E success remain supervisor-reported through the provided evidence markdown/task, not independently reproduced terminal runs here. No claim that all final raw logs were supplied.
- Full repository `npm run gates -- --json` is **pending external supervisor classification**. The known unchanged-source layerRouting fence mismatch is not a blocker for this change. No full-suite pass is inferred.
- Atomic commits/PR delivery remain supervisor-owned; this is the requested code-and-scenario gate, not certification that PR creation or cleanup of all supervisor resources has completed.

The sole rejection is the demonstrated C8 code-path defect. Evidence/report limitations and maintenance preferences above are not additional blockers.
