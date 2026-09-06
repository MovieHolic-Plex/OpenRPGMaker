# Phase 2 gate attribution - task st_01a07475

## Outcome and acceptance boundary

Every one of the **25 explicit baseline-new files** has been executed and attributed, and **all nine surface test axes plus CSS-live** have been checked on the actual Phase2 base and frozen current commit.

- **17 files / 24 assertions:** pre-existing failures, reproduced with identical complete console messages and expected/received values on both pinned trees.
- **1 file / 1 assertion (`moveRouteCatalogPersistence`):** pre-existing timeout actually reproduced on the Phase2 base. Current focused pass does not make it fixed.
- **7 files / 18 original failed assertions:** unresolved full-suite timing/order failures; both pinned focused executions pass. `debugSession` additionally has a confirmed Phase2 import-graph expansion, but the original timeout's causal contribution remains unquantified.
- **Confirmed introduced test regressions: none in this comparison. Unresolved cases: seven, not zero.** No baseline-pass/current-fail case occurred in the matched focused runs. Therefore there is no evidence-backed introduced-regression patch to recommend from those runs. The debug setup recommendation below addresses a demonstrated timing hazard, not a claimed reproduction of the historical timeout.
- **Surface:** all six failed assertions, across five axes, are pre-existing; their complete original/base/current messages and received diffs are identical. Four test axes pass, CSS-live passes. The gate still exits **1**; this report does not turn it green or grant blanket acceptance.

Original supplied full run: **13624 total / 13422 passed / 187 failed / 15 pending; 97 failed files**. Only the explicit 25-file set is under file-level attribution here, not all 97. Within that set the original collected **183 tests: 43 failed / 140 passed / 0 pending or skipped**, verified from the hash-matched full report in `original-25-counts.json`. The tracked gate-baseline's filename comparison is a triage signal, not proof of regression relative to the verified Phase2 base. Historical 185 failures do not waive any new or unresolved failure. No full-suite rerun, product fix, test edit, baseline update, build, browser journey or Phase2 acceptance is claimed by task28.

## Pinned inputs, environment and scope

- Baseline: `/home/main/z-project/rpg-zzu-life-full-p2-gate-base`, HEAD **87de73785d1c309bbbe975636414f70bbc73a4b9**, branch `agent/life-full-p2-gate-base`.
- Current: `/home/main/z-project/rpg-zzu-life-full-p2-gate-current`, HEAD **4e2d1762264533a5826c48686648093c3fe69ebd**, branch `agent/life-full-p2-gate-current`.
- Shared installed dependency target: `/home/main/z-project/rpg-zzu/node_modules`; Node **v24.11.1**, npm **11.6.2**, Vitest **3.2.4**, Linux x86_64, 32 logical CPUs. Both trees have the required `.env.local`; literal `.env` is absent, as it is in the provisioning source. No credential values are recorded. `environment.json` is authoritative for observed versions and hashes.
- `npm run wt -- create life-full-p2-gate-{base,current} --base <SHA>` was invoked from the existing Phase2 worktree only after registration inspection. That script prefixes the **calling cwd basename**, so it initially created duplicated `rpg-zzu-life-full-p2-life-full-p2-gate-*` names; recorded `git worktree move` calls placed them at the required sibling paths without changing HEAD.
- Provisioning copied existing `DEV_SERVER_PORT=9841` instead of allocating because `provision()` only allocates if the copied file has no port. No environment file was manually edited. Every comparison command explicitly assigns verified-free, registration-unique **9801 baseline / 9802 current**; these are runtime overrides, not a claim the copied files contain unique ports. No development server was started or borrowed.
- All 25 named test files were checked as real files in both trees **before execution**. Both result sets contain exactly those 25 files and **183 tests**, with no pending/skipped tests. No absent filter was counted as a pass. The missing CSS file in row4 is an actual failing assertion.
- Read approved root plan `Scope` and verification strategy at `/home/main/.herdr/worktrees/rpg-zzu/wish-html/.omo/plans/life-systems-full-implementation.md`, AGENTS, quickstart, agent-worktrees, PROJECT_WIKI, INDEX, testing guidance and actual affected tests/owners. All CLAUDE.md files ignored.
- `input-selected.json` was kernel-filtered from the supplied 97-record input, not a text dump. Its selected assertion lists contain **only failures** and are preserved as historical failure data, not collection-count evidence. `original-25-counts.json` binds all original per-file counts to the full report path and SHA256; `assertion-comparison.json` now contains all 183 original assertion summaries, including the 140 passes. Its input/full-report SHA256 values and `environment.json` verify the supplied full report still matched its recorded hash at capture. `original-gate.stdout.txt` preserves the supplied gate receipt, including exit1.
- Product/test source in all trees remained read-only for this task. The moving main Phase2 tree was used only for evidence output, registration tooling and read-only coordination; **no comparison tests ran there**. Evidence text and preserved receipts were written with `/tmp/apply_patch` through `runner.py`.

## Executions and limits

| Receipt | Files | Passed | Failed | Pending/skipped | Real exit |
| --- | ---: | ---: | ---: | ---: | ---: |
| `base-25` | 25 (18 fail / 7 pass) | 158 | 25 | 0 | 1 |
| `current-25` | 25 (17 fail / 8 pass) | 159 | 24 | 0 | 1 |
| `base-surface` | 9 (5 fail / 4 pass) | 107 | 6 | 0 | 1 |
| `current-surface` | 9 (5 fail / 4 pass) | 107 | 6 | 0 | 1 |

Each command ran once. The paired focused commands use the **same 25 explicit filters**, `--maxWorkers=4 --no-cache`, and verbose plus JSON reporters. The surface command is exactly `npm run gates -- --only surface --json`, with environment/serialization wrappers only; its runner launches the nine named axes and CSS-live. Every heavy command uses the required **flock --timeout 900** lock, outer1500s bound and inner600s execution bound (kill grace15s). No deadline was increased inside a test, no sleep/poll was added, and no authority/mock/test was modified.

The 4-worker focused context is not the original 13624-test scheduling context. The lock prevents contention among cooperating holders, not unrelated machine activity. Run order was base25 -> base surface -> current25 -> current surface; filesystem/kernel/module transform caches and unrelated host load are not an experimental constant. Therefore the timing differences below are observations, not a speedup claim. `STACK_TRACE_ERROR` in the supplied JSON is a runner-created failure stack, not itself a timeout message; threshold-adjacent durations support timing diagnosis, and only the reproduced move-route console explicitly confirms its timeout.

## Exhaustive 25-file table

Counts are **failed / collected** in **original / baseline-focused / current-focused** order. Original denominators come from `original-25-counts.json`, not the failure-only filtered input. All row evidence is in `assertion-comparison.json`; complete non-collapsed baseline/current received values are in `console-values-comparison.json` and the raw `.stderr.txt` files. Every one of the 24 shared failing assertion signatures compares equal after replacing only the worktree prefix. No expected values, offender names or counts were normalized away.

| # | File | O / B / C failures | Classification | Actual evidence and attribution |
| ---: | --- | --- | --- | --- |
| 1 | `test/aiActivityLiveRow.test.ts` | 2/3 / 2/3 / 2/3 | Pre-existing failure | Both failing cases observe runner calls **0**, expected **1** (`:220`, `:292`). Real panel/AI source and tests are identical. Fixed microtask-count flushing and a fake window that drops timer callbacks are existing test risks; the runs do not establish a product failure cause. |
| 2 | `test/aiChatObservability.test.ts` | 2/9 / 2/9 / 2/9 | Pre-existing failure | Reasoning DOM is **null** (`:216`); ghost observations are **[]**, expected `live_project_diff` on `map_live_ghost`, bounds x0/y0/w6/h5 (`:303`). Same complete expected/received values. Existing counted microtask flushing is not a completion signal. |
| 3 | `test/aiChatPanelTransportError.test.ts` | 1/2 / 1/2 / 1/2 | Pre-existing failure | Network-throw case has **null** `ai-error-open-settings` after the test advances eight retry intervals (`:68`); 401 case passes on both. Same real panel and same test. Existing timer/flush-count coupling remains a test risk. |
| 4 | `test/aiSelectionChipScope.test.ts` | 2/5 / 2/5 / 2/5 | Pre-existing failure | Plain idle chip display is **block**, expected **none** (`:133`); `14-assistant-ux-repair.css` is absent on both (`:143`). This missing CSS is a tested failure, not an absent test filter. All five tests collected. Existing helper also contains fixed 5ms sleeps; not edited or relied on to dismiss either failure. |
| 5 | `test/databaseItemInspector.test.ts` | 1/26 / 1/26 / 1/26 | Pre-existing failure | Equipment redirect renders `착용 장비는 별도 항목으로 만듭니다...장비 목록에서 새로 만들기`, not expected substring `장비 탭` (`:486`). Same full received copy in both console receipts; control still exists. This is an unchanged prose-pinning assertion, not a Phase2 UI change. |
| 6 | `test/databaseModalDirtySession.test.ts` | 1/5 / 0/5 / 0/5 | Unresolved timing/order | Original saturated-history case takes **48568.8ms**, beyond its existing **45000ms** budget, JSON `STACK_TRACE_ERROR`; baseline passes **42186.2ms**, frozen current **23509.3ms**. It creates 55 full-project snapshots and drains undo (`:76-106`). No Phase2 editor/history diff. Passing here does not settle historical contention or performance attribution. |
| 7 | `test/databaseNavMode.test.ts` | 1/4 / 1/4 / 1/4 | Pre-existing failure | World-group label is **맵**, expected **세계** (`:80`), on both. `database.ts` and test unchanged. No behavioral conclusions beyond this stale exact-copy assertion. |
| 8 | `test/databaseOverviewDashboard.test.ts` | 8/11 / 0/11 / 0/11 | Unresolved timing/order | Original eight cases each reach **15015.6-15085.1ms**, JSON `STACK_TRACE_ERROR`; all 11 now pass on each tree. Those eight bodies take baseline **1591.1-3098.5ms**, current **2671.1-3437.9ms**. `vi.resetModules()` before every case plus dynamic database/store imports and idle-chart work; identical editor code. No measured boundary in the original failure proves where it stalled. |
| 9 | `test/databaseOverviewTab.test.ts` | 5/8 / 0/8 / 0/8 | Unresolved timing/order | Original five cases reach **15008.5-15091.1ms**, JSON `STACK_TRACE_ERROR`; all eight now pass. Those five bodies take baseline **2450.6-5410.7ms**, current **2305.8-3028.8ms**. Module resets/reimports deliberately re-evaluate persisted activeTab. Same test/editor source; original full-suite ordering/load remains unresolved. |
| 10 | `test/databaseRadioCustomGuard.test.ts` | 1/4 / 1/4 / 1/4 | Pre-existing failure | Exact offender is `src/styles/database/growth-tree.css:38 .database-modal-backdrop .database-modal-window .database-modal-body .growth-studio :is(button, input, textarea, select):focus-visible`, not []. Both complete offender lists are equal, not merely the same failing filename. |
| 11 | `test/databaseSidebarKeyboard.test.ts` | 2/4 / 2/4 / 2/4 | Pre-existing failure | Both order assertions have expected **undefined** where real DOM has **db-tab-promotion-tree** and **db-tab-skill-trees** (`:122`, `:195`). Test TAB_TESTID map omits these two IDs while unchanged `database.ts:96-97,145` registers them; full ordered diff identical. |
| 12 | `test/databaseSidebarNav.test.ts` | 1/7 / 1/7 / 1/7 | Pre-existing failure | Real rail count **39**, test expected **37** (`:132`). Both same; assertion stops before checking the later ordered list, so no claim that later assertions executed. |
| 13 | `test/databaseTabIcons.test.ts` | 2/6 / 2/6 / 2/6 | Pre-existing failure | Both registry and rendered rail count **39**, expected **38** (`:67`, `:128`). All other four cases pass on both; same icon/catalog/test source. |
| 14 | `test/debugSession.test.ts` | 1/4 / 0/4 / 0/4 | Unresolved timing/order; Phase2 import-cost risk | Original first case **15012.8ms**, JSON `STACK_TRACE_ERROR`; baseline **4287.7ms** and pinned current **1577.2ms**, both pass 4/4. Confirmed new runtimeDom/store import edge is relevant but these timings do not prove it caused the original timeout. Task5 diagnostic evidence and smallest setup correction are discussed below; its moving-tree correction is NOT substituted for this frozen result. |
| 15 | `test/editorProjectE2EBridge.test.ts` | 1/5 / 0/5 / 0/5 | Unresolved timing/order | Authorized initialize/reload case originally **15026.6ms**, JSON `STACK_TRACE_ERROR`; baseline **7204.7ms**, current **2827.0ms**, both pass 5/5. `loadBridgeModule` resets modules, hashes a test key, imports editorToolHook/store, and constructs/serializes projects before mocked remote methods. No observed boundary distinguishes import from serialization in original run. |
| 16 | `test/eventEditorM2Surface.baseline.test.ts` | 1/11 / 1/11 / 1/11 | Pre-existing failure | Same two queue additions in `m2-025-change-actor-faceset` and `m2-069-change-parallax-back`. Exact original/base/current surface messages and values agree; all details below. |
| 17 | `test/eventEditorPortalSurface.baseline.test.ts` | 1/15 / 1/15 / 1/15 | Pre-existing failure | Same commandPickerTab3 tag decreases and npcGraphic teaching controls/classes/label/count changes. Exact original/base/current surface messages and values agree; all details below. |
| 18 | `test/forestDensity.test.ts` | 2/25 / 2/25 / 2/25 | Pre-existing deterministic failure | Both failed assertions return **0.3003472222222222**, expected **<0.3** (`:227`, `:298`). Explicit seeded paths (plant seed1; place_props seed3), same 24x24 area and unchanged forest/collision/defaults code. Not classified as random fluctuation merely because the miss is small. |
| 19 | `test/gen1DemoContent.test.ts` | 1/3 / 1/3 / 1/3 | Pre-existing failure | Species-referenced skill lookup yields **undefined maxPp**, expected a number >0 (`:55`), on both. Defaults, species/demo source and test identical. Assertion does not print the skill ID; no ID invented here. |
| 20 | `test/modalEscapeLayerGate.test.ts` | 2/3 / 2/3 / 2/3 | Pre-existing failure | Complete two offender lists match: unregistered lexical body-overlay scan **[panels/newProjectDialog.ts]**; required-registration scan **[panels/worldPanel.ts]** (`:90`, `:124`). The tests scan literal registerModal text, so these findings alone do not prove runtime Escape behavior. |
| 21 | `test/moveRouteCatalogPersistence.test.ts` | 1/3 / 1/3 / 0/3 | Pre-existing timeout; timing remains variable | Original per-command roundtrip sweep **15963.5ms**; baseline reproduces **Test timed out in 15000ms**, actual **17844.7ms**; frozen current passes **9077.4ms**. Exact same case `:82`, 44-command project serialize/deserialize loop. This proves a pre-Phase2 timing failure exists; current pass is not a fix or proof of absence under full-suite load. |
| 22 | `test/noLocalProjectDb.test.ts` | 1/2 / 1/2 / 1/2 | Pre-existing failure | Full offender list is **[src/editor/panels/aiChatPanel.ts: indexedDB]** on both. The unchanged source `:349` checks conversation durability, while this lexical guard scans all editor/project text; do not misreport it as evidence Phase2 added a project DB fallback. |
| 23 | `test/regionSelectionPastePreview.test.ts` | 1/12 / 0/12 / 0/12 | Unresolved timing/order | First action-chip case originally **15049.7ms**, JSON `STACK_TRACE_ERROR`; baseline **2721.0ms**, current **2999.1ms**, both pass 12/12. Its dynamic selectionActionChips import (`:193-195`) occurs in the test body. No editor/chips/test change; exact original stall boundary unmeasured. |
| 24 | `test/roleNameComparisonGate.test.ts` | 1/3 / 1/3 / 1/3 | Pre-existing failure | Exact two offenders on both: `src/project/lint/postTileVerify.ts:129 role !== "wall"` and `:138 role !== "roof"`. New recovery/session files add no reported offender. Full lists, not only count or test name, were compared. |
| 25 | `test/uxcLoadFailure.test.ts` | 1/3 / 0/3 / 0/3 | Unresolved timing/order | Original first boot/fallback case **15105.9ms**, JSON `STACK_TRACE_ERROR`; baseline **3216.7ms**, current **2431.1ms**, both pass 3/3. Boot helper imports app/mode inside test (`:105`); later existing cases use vi.waitFor. No added polling, sleeps, budget changes, or mock edits; passing does not identify the historical stall. |

## Surface gate: all axes and all failure details

All required files are present; **skippedAxes=[]** on baseline, current and supplied original. `surface-comparison.json` compares the six complete failure blocks including received-array diffs and reports `allSixOriginalBaselineCurrentMessagesAndValuesEqual=true`. This is stronger than comparing filenames/counts. Both raw decoded reports are preserved.

| Axis / file under test/ | Baseline | Current | Attribution |
| --- | --- | --- | --- |
| `surfaceGateSupport.test.ts` | 13 pass | 13 pass | No failure |
| `eventEditorFormSurface.baseline.test.ts` | 6 pass / 1 fail | 6 pass / 1 fail | Same four snapshot differences, pre-existing |
| `eventEditorM2Surface.baseline.test.ts` | 10 pass / 1 fail | 10 pass / 1 fail | Same two snapshot differences, pre-existing |
| `eventEditorShellSurface.baseline.test.ts` | 22 pass | 22 pass | No failure |
| `eventEditorCommitProbe.baseline.test.ts` | 11 pass / 2 fail | 11 pass / 2 fail | Same four commit differences and two no-commit controls, pre-existing |
| `eventEditorConditionSurface.baseline.test.ts` | 11 pass | 11 pass | No failure |
| `eventEditorPortalSurface.baseline.test.ts` | 14 pass / 1 fail | 14 pass / 1 fail | Same two portal differences, pre-existing |
| `eventEditorInteractionSurface.baseline.test.ts` | 6 pass / 1 fail | 6 pass / 1 fail | Same four differences, pre-existing |
| `eventEditorStagedState.test.ts` | 14 pass | 14 pass | No failure |
| CSS-live subprocess | Pass | Pass | Same 973 protected classes / 7643 properties retained / 119 unstyled; 10 value-change classes are explicitly informational, not failures |

Below **old -> observed** means each axis's checked-in snapshot versus the measured surface, **not Phase2 base -> current**. Every listed difference already occurs on the Phase2 base and stays identical on current.

1. **Commit snapshot assertion (`eventEditorCommitProbe...:93`) - four differences:**
   - `changeFace`: extra `event-command-face-ai-prompt` control.
   - `giveMonster`: `give-monster-species-select` commits speciesId **species_cave_bat -> species_aqualing**; kind giveMonster, level5, nickname `<undefined>` unchanged.
   - `evolveMonster`: `evolve-monster-species-select` commits toSpeciesId **species_cave_bat -> species_aqualing**; instanceId monster_1, kind evolveMonster, successBranch[]/failureBranch[] unchanged.
   - `showPicture`: extra `show-picture-ai-prompt` control.
2. **No-commit ratchet assertion (`eventEditorCommitProbe...:401`) - complete offender list:** `changeFace :: event-command-face-ai-prompt`, `showPicture :: show-picture-ai-prompt`. Branch-preservation contracts still pass; do not infer lost branches from the snapshot failure.
3. **Form snapshot assertion (`eventEditorFormSurface...:258`) - four differences:**
   - `changeFace`: new testids event-command-face-ai-{generate,prompt,queue,queue-list}; buttons117->118, div127->130, input2->3, p1->2; two controls generate/prompt; label `AI로 만들기`; classes ai-image-queue, ai-image-queue-composer, ai-image-queue-empty, ai-image-queue-list, page3-resource-row.
   - `giveMonster`: changed give-monster-species-select options, four before/four observed (not a count increase).
   - `evolveMonster`: changed evolve-monster-species-select options, four before/four observed.
   - `showPicture`: new testids show-picture-ai-{generate,prompt,queue,queue-list}; buttons6->7, div27->32, input8->9, p3->4; generate/prompt controls; label `AI로 만들기`; the four ai-image-queue classes above.
4. **Interaction snapshot assertion (`eventEditorInteractionSurface...:313`) - four differences:**
   - `changeFace`: four ai-image-queue classes added after interaction; initial event-command-face-ai-{queue,queue-list} testids, div129->131, p1->2, same four new classes.
   - `giveMonster`: initial give-monster-species-select option values differ (4->4).
   - `evolveMonster`: initial evolve-monster-species-select option values differ (4->4).
   - `showPicture`: four queue classes added after interaction; initial show-picture-ai-{queue,queue-list} testids, div31->33, p3->4, same four new classes.
5. **M2 snapshot assertion (`eventEditorM2Surface...:188`) - two differences:**
   - `m2-025-change-actor-faceset`: change-actor-faceset-ai-{queue,queue-list} testids; div132->134, p3->4; four ai-image-queue classes.
   - `m2-069-change-parallax-back`: change-parallax-back-ai-{queue,queue-list} testids; div15->17, p4->5; same four classes.
6. **Portal snapshot assertion (`eventEditorPortalSurface...:284`) - two differences:**
   - `commandPickerTab3`: circle18->16, div60->59, path102->101, span125->124, svg101->100.
   - `npcGraphic`: testids npc-charset-label-input, npc-charset-tags-input, npc-charset-teach, npc-charset-teach-save, npc-charset-teach-status; classes npc-charset-teach, npc-charset-teach-heading, npc-charset-teach-status; controls label-input/tags-input/teach-save; removed label `캐릭터 슬롯 #`; button32->33, div15->16, input8->10, p0->2; testidCount46->51, controlCount40->43, classCount34->37.

No additional gate infrastructure failure is hidden: the only aggregate failure on each run is `표면 스냅샷 축 실패 (vitest exit=1)`. The gate treats any surface failure as a regression irrespective of the outer stored baseline; that exit policy remains unchanged even though these six failures predate Phase2. Snapshot regeneration/allowlisting was not performed or recommended as automatic acceptance.

## Relevant diff and unresolved diagnosis

`phase2-code.diff` preserves the actual pinned product/test/script diff. `source-equality.json` records exact `git diff --exit-code` commands **and verified git object IDs**, so nonexistent paths cannot masquerade as equal files. All 25 tests are byte-identical. Entire `src/editor`, `src/ai`, `src/styles`, `src/project/defaults`, `src/project/io`, forest collision/lint owner files, test/surface fixtures and gate/test runner/package configuration compared there are unchanged. This rules out new CSS selectors, editor tab registrations, AI-panel branches, snapshot updates or forest/default-data edits in Phase2; it does not rule out performance effects through changed shared session dependencies.

Phase2 changes shared `session.ts`, save/reconciliation/maker/day-transition code and QA snapshot consumers. In particular:

- `playSceneTestHooks.ts:2` now value-imports `buildLifeRuntimeSnapshot` from `runtimeDom.ts`; before it had no runtimeDom value dependency. `runtimeDom.ts:20` imports the real project store; its picture/resource helpers add more graph edges. `debugSession.test.ts:4-11` awaits hooks alongside three other imports **inside the first test's 15s budget**.
- **Coordination with task5:** read-only copies of its real `dependency-graph.json`, `related-before.json`, `related-after.json`, `debug-timing-after.json` are retained as `task5-*`; original paths and SHA256 are in `task5-external-provenance.json`. These are explicitly **external worker, moving-tree diagnostic/correction receipts**, not replacement baseline/current comparison runs. Its graph compares task5 predecessor b7b02d97 to frozen4e2d1762: hooks static local closure81->276 (+195), excluding type/dynamic/external imports. Not all195 are necessarily new to the union of all four test imports.
- That worker's pre-correction measured run completed hooks import at10334.34ms, fixture78.22ms, operations/assertions2.32ms. Its setup-only static-import correction shifts work to collection (6512.50ms), with four bodies239.95ms. Both external related suites still exit1 for two unrelated registry fixtures. This isolates a real setup/operation boundary problem without reproducing the historical15s failure.
- **Smallest recommendation for this timing hazard:** normal static imports for synchronous debug authorities and synchronous test bodies, preserving all assertions and real modules, as task5 owns. Do not raise deadlines or mock the runtime/store authority. A production dependency split would be a separate optimization, not something this evidence proves necessary. Task28 implemented neither. The frozen row remains unresolved for historical full-suite attribution and is not marked repaired by another tree's focused success.
- For the other six unresolved files, exact timing/ordering evidence is insufficient to choose between host scheduling, module-reset/import cost, large-project work and an indirect Phase2 performance contribution. Existing tests demonstrate specific hazards (repeated module resets; 55 deep snapshots; in-body dynamic imports), but no new timing probes were spliced into protected tests. Recommendation is explicit completion/boundary diagnostics and appropriate static setup where module re-evaluation is not the behavior under test; preserve the activeTab reload contract where it is. No blanket rewrite, fixed delay, timeout increase or assertion removal is justified.
- The three AI async failures reproduce before and after and remain **pre-existing failures**, not claimed deterministic product regressions. Existing finite microtask/timer flushing is a nondeterministic test design, and exact completion subscriptions would be required before treating a focused pass as proof of repair.

## Exact commands and raw receipts

Each `*.receipt.json` contains cwd, argv, UTC start/end and the real `subprocess.run.returncode`; no pipeline/tee exit is substituted. Matching `.stdout.txt` / `.stderr.txt` preserve command output; `*-25.report.json` extracts the JSON reporter object, and `*-surface.report.json` / `.decoded.txt` expose the nested gate output. Execution receipts are the primary evidence; extracted comparisons do not replace them.

### `base-25`: exit 1

UTC 2026-09-06T02:08:43.593656+00:00 to 2026-09-06T02:11:09.082070+00:00.

```sh
cd /home/main/z-project/rpg-zzu-life-full-p2-gate-base
timeout --kill-after=15 1500 flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock timeout --kill-after=15 600 env DEV_SERVER_PORT=9801 VITE_CACHE_DIR=/home/main/z-project/rpg-zzu-life-full-p2/.omo/evidence/life-full-20260906/28/cache-base npm test -- test/aiActivityLiveRow.test.ts test/aiChatObservability.test.ts test/aiChatPanelTransportError.test.ts test/aiSelectionChipScope.test.ts test/databaseItemInspector.test.ts test/databaseModalDirtySession.test.ts test/databaseNavMode.test.ts test/databaseOverviewDashboard.test.ts test/databaseOverviewTab.test.ts test/databaseRadioCustomGuard.test.ts test/databaseSidebarKeyboard.test.ts test/databaseSidebarNav.test.ts test/databaseTabIcons.test.ts test/debugSession.test.ts test/editorProjectE2EBridge.test.ts test/eventEditorM2Surface.baseline.test.ts test/eventEditorPortalSurface.baseline.test.ts test/forestDensity.test.ts test/gen1DemoContent.test.ts test/modalEscapeLayerGate.test.ts test/moveRouteCatalogPersistence.test.ts test/noLocalProjectDb.test.ts test/regionSelectionPastePreview.test.ts test/roleNameComparisonGate.test.ts test/uxcLoadFailure.test.ts --maxWorkers=4 --no-cache --reporter=verbose --reporter=json
```

### `base-surface`: exit 1

UTC 2026-09-06T02:11:09.091179+00:00 to 2026-09-06T02:12:21.579201+00:00.

```sh
cd /home/main/z-project/rpg-zzu-life-full-p2-gate-base
timeout --kill-after=15 1500 flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock timeout --kill-after=15 600 env DEV_SERVER_PORT=9801 VITE_CACHE_DIR=/home/main/z-project/rpg-zzu-life-full-p2/.omo/evidence/life-full-20260906/28/cache-base npm run gates -- --only surface --json
```

### `current-25`: exit 1

UTC 2026-09-06T02:12:21.594707+00:00 to 2026-09-06T02:14:23.104234+00:00.

```sh
cd /home/main/z-project/rpg-zzu-life-full-p2-gate-current
timeout --kill-after=15 1500 flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock timeout --kill-after=15 600 env DEV_SERVER_PORT=9802 VITE_CACHE_DIR=/home/main/z-project/rpg-zzu-life-full-p2/.omo/evidence/life-full-20260906/28/cache-current npm test -- test/aiActivityLiveRow.test.ts test/aiChatObservability.test.ts test/aiChatPanelTransportError.test.ts test/aiSelectionChipScope.test.ts test/databaseItemInspector.test.ts test/databaseModalDirtySession.test.ts test/databaseNavMode.test.ts test/databaseOverviewDashboard.test.ts test/databaseOverviewTab.test.ts test/databaseRadioCustomGuard.test.ts test/databaseSidebarKeyboard.test.ts test/databaseSidebarNav.test.ts test/databaseTabIcons.test.ts test/debugSession.test.ts test/editorProjectE2EBridge.test.ts test/eventEditorM2Surface.baseline.test.ts test/eventEditorPortalSurface.baseline.test.ts test/forestDensity.test.ts test/gen1DemoContent.test.ts test/modalEscapeLayerGate.test.ts test/moveRouteCatalogPersistence.test.ts test/noLocalProjectDb.test.ts test/regionSelectionPastePreview.test.ts test/roleNameComparisonGate.test.ts test/uxcLoadFailure.test.ts --maxWorkers=4 --no-cache --reporter=verbose --reporter=json
```

### `current-surface`: exit 1

UTC 2026-09-06T02:14:23.112976+00:00 to 2026-09-06T02:15:30.555551+00:00.

```sh
cd /home/main/z-project/rpg-zzu-life-full-p2-gate-current
timeout --kill-after=15 1500 flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock timeout --kill-after=15 600 env DEV_SERVER_PORT=9802 VITE_CACHE_DIR=/home/main/z-project/rpg-zzu-life-full-p2/.omo/evidence/life-full-20260906/28/cache-current npm run gates -- --only surface --json
```

## Cleanup and retained artifacts

Both pinned worktrees are intentionally retained for parent review/cleanup at the exact paths above. No commit, push, PR, merge, remote DB write command, source/test edit, baseline write, dependency installation, browser, dev server or independent live-data probe was performed by task28. Existing unit tests' in-memory fixtures/mocks ran unmodified; this is not a network-traffic audit.

`cleanup.json` records final pinned HEADs, clean tracked status, exited comparison supervisor/process group, unused assigned ports, and task-owned Python cache removal. The two `.vite-cache/deps` files in each tree are **tracked baseline files**; they were not created by these tests and were retained. The requested `VITE_CACHE_DIR` paths under28 were not created: vitest.config.ts does not consume that Vite env override. The exact surface runner automatically updated a pre-existing **shared** node_modules/.vite Vitest result cache (which contains unrelated test records). That cache is not task-owned; it was deliberately not deleted or reset. No task-created browser/Vite cache remains. Evidence stays outside both temporary trees under28.

The stop condition is exhaustive attribution, not a green gate. All25 rows, all surface axes and all six surface failures are accounted for, and no task28 test/server process remains. Seven historical full-suite timing/order attributions remain explicitly unresolved for acceptance; the preserved red evidence must not be erased by these focused passes.
