# Phase 3 final gate review - task33

## Findings first

**No blocking Phase3 product defect or mandatory scoped evidence gap found. Required product corrections: 0.**

The following are retained findings and limits, not fixes, ignored failures, or passing gates:

1. **The whole-project gate is not green.** The full wrapper exited **124** at 1200 seconds during its first surface subprocess. Its completed Vitest run exited **1**: **13,910 total / 13,676 passed / 219 failed / 15 pending**. The separate surface gate exited **1**, with six complete failure bodies matching the retained base comparison. CSS and app typecheck exited 0. These results must accompany the phase handoff.
2. **The completed failure comparison narrows attribution; it does not certify every original failure as inherited.** Both sides exercised 113 files / 1,251 cases: current 1,088 pass / 163 fail; exact Phase2 base 1,089 pass / 162 fail. All 162 shared complete printed assertion diagnostics match after only four explicit source-position/timestamp mappings. The 57 original failures that pass both controlled runs have no established cause and are neither fixed nor proven inherited.
3. **The sole paired status delta is consistent with the independently reproduced existing audit-queue observer interference, not a changed LegacyDb clean-flush behavior.** The failing observation at `test/storePersistence.test.ts:254` is an unexpected POST to `/__oprn/edit-activity`. The unchanged clean early return is at `src/project/store.ts:809-825`; the unchanged deferred mirror resolves global `fetch` when its callback runs in `src/editor/editActivityLog.ts:422-451`. The parent exercised that callback and the actual clean flush on both heads; the existing reset prevents the request on both. This is a controlled causal reproduction, **not a replay of the entire preceding test sequence**. The original test remains nondeterministic and unfixed.
4. **Native aesthetic/image approval is absent.** Firefox keyboard, DOM/state and numerical PNG evidence support behavior and localized marker refresh. They do not establish visual-model inspection, overall readability, or aesthetic approval. Public clock/regrowth/priority probes are real-module/Storage/HappyDOM checks, not complete native game journeys.
5. **Task12 has a concrete later integration obligation.** `src/player/farming.ts:191-201` now calls `canOccupySpatialFootprint` before farm actions. `src/project/spatialOccupancy.ts:51-88` currently omits farm-plot occupancy. When task12 adds that occupancy for placement, it must reject placement over plots without making watering/harvesting reject their own plot. This is not a present Phase3 blocker.

## Verdict

**APPROVE - scoped Phase3 readiness, tasks6-10 only.**

The actual Phase2-to-Phase3 source diff implements the assigned transaction, input, authoring and clock contracts, and the reused parent/independent checks exercise those authorities on product bytes identical to this review tree. I found no reproducible Phase3 regression requiring correction. The repository's baseline-relative policy permits this scoped decision with the red-gate disposition explicitly attached; it does not permit relabeling the gate as passed or completing the full life-systems goal.

This is the single final task33 review, not an additional panel and not F1-F4. It permits the parent's reviewed Phase3 stacked-PR handoff against the verified Phase2 branch. **It authorizes no remote merge** and does not claim that a PR was created by this reviewer.

## Reviewed identity and scope

| Field | Exact value |
| --- | --- |
| Reviewer task | `st_01a077e8` |
| Parent/root session | `01a0727b-398a-7481-b557-b198013542c1` |
| Dedicated review tree | `/home/main/z-project/rpg-zzu-life-full-p3-final-01a0727b` |
| Reviewed HEAD | **`bd81a933cbecfeb8b25ef15bf57bc24911011aa8`** |
| Reviewed Git tree | `c6ef7deb0e531f92cc6428a87921a4faee1a7369` |
| Phase2 base | `e33c93afbd1b0d8824f273c62d234d66c8802323` |
| Tested product commit | `bbaf9464cad3768da057ef9909338b5cfb25aa8c` |
| Isolation | Detached and locked; parent-created/canonically adopted, parent owns archival/removal |

I read canonical `AGENTS.md`, `openwiki/quickstart.md`, `openwiki/INDEX.md`, `openwiki/PROJECT_WIKI.md`, the complete approved plan at `/home/main/.herdr/worktrees/rpg-zzu/wish-html/.omo/plans/life-systems-full-implementation.md`, and the review context. No `CLAUDE.md` was read.

I reviewed the actual source/test diff against the exact base: **17 production files and 8 test files**, together with affected caller implementations and the focused wiki diff. The base is an actual ancestor. `git diff --exit-code bbaf9464c HEAD -- src test package.json package-lock.json` returned 0. All 25 independent source-manifest hashes match this checkout; the parent's 9 source hashes and 7 receipt hashes also match. This is product-byte identity, not a claim that every evidence/document byte stayed frozen during QA. The full gate began at `d107ac24e`; a documentation-only follow-up occurred while it ran.

The broader user objective remains **all 20 implementation tasks, all 51 life-feature rows, F01-F13, final F1-F4, isolated LegacyDb save/reload, reviewed phase PRs and a main rollup PR**. Later housing, live placement, economy, full authoring/player journeys, remote persistence and final completion remain open. Their absence is not silently substituted with this phase's local fixtures.

The Phase3 diff does not alter package manifests or add dependencies/services. It does not replace the approved explicit building-instance housing or proved-resource-only recovery policies. The Save4-to-Save5 reader/writer separation, v5 key families, legacy raw preservation and Project4 policy are retained; this review checks the incremental countdown/clock changes, not a fresh certification of every Phase2 compatibility scenario.

## Source and affected-caller assessment

| Boundary | Reviewed behavior and why it satisfies this phase |
| --- | --- |
| Task6: automatic versus explicit XP | `farming.ts:254-278`, `fishing.ts:66-70`, and `seasonalForage.ts:107-119` gate only incidental XP on `skillSystem.enabled === true`. Harvest ownership, energy, inventory and RNG remain draft-atomic. The explicit `lifeSkillProgress.ts` API is unchanged; disabled explicit calls still fail, and fishing qualification still checks earned skill rather than bypassing `minSkillLevel`. Enabled invalid reward failures still abort the harvest. |
| Task7: zero yield and exact regrowth | `farming.ts:336-363` uses nullish fallback and permits count 0. Successful regrowing harvests initialize `regrowDaysRemaining`; readiness and overlay projection use that timer rather than shortening it to initial growth. Only living, in-season, watered growth ticks decrement it. Failed harvests do not commit a timer reset. The shared session type and save validation preserve non-negative safe integers, including 0, reject malformed countdowns, and do not infer legacy harvest history. |
| Task8: authored tools | `toolActions.ts` retains full-replacement ordered tables and itemId priority within a row. Conditionless rules match valid non-consumable farm tools, not seeds/consumables. `databaseLifeCraftingView.ts` materializes four defaults only on first custom-table creation, prepends the new row, appends later rows without merging, and stores explicit false while displaying the effective default. Farming consumes authored till/water/harvest authority; false releases the region restriction, not integer bounds, terrain or static occupancy. The target tree/rock alone is exempt from placeable occupancy. Authored harvest rules are enforced, while no-rule legacy harvest remains available. |
| Task9: maker clocks and rollback | `dayTransition.ts`, `playSceneTime.ts`, `makers.ts` and `saveSlots.ts` connect natural completed minutes, authored advances, set-time, sleep and restore to the existing authored active-day clock. Prior-clock reconciliation precedes clock mutation, including cancellation in the frozen original basis. Ready jobs are not demoted by backward set-time. Zero-minute operations retain owners; ledger render and paused menu elapsed time do not advance jobs or pay outputs. Ordinary multi-day frames and authored multi-day failures discard/restore their session transaction; enabled clock errors remain failures. Present malformed saved maker clocks cannot be dropped while retaining their dependent jobs. |
| Task10: real coordinate priority | `playSceneMovement.ts:467-560` and `lifeFieldInteraction.ts` execute event -> chest -> explicit generated forage -> authored fishing region -> farm at the front coordinate, then the feet. The shared helper calls actual transactions, not runner-only substitutes. Forage/fishing success and refusal consume the action, preventing lower-priority harvest/event fallback and the `!interacted` attack branch at `playSceneMovement.ts:110-111`. Farming's existing ignored/not-a-target fallback is intentionally retained; the new consumed-refusal claim is for the explicit forage/fishing targets, not a claim that every legacy farming `ignored` result changed. |
| Task10: catch/forage eligibility | Catch validates integer map bounds, existing species/time/season/weather/skill conditions, and authored fish-tool rules when present; no new rod requirement is invented when absent. Collection revalidates owner location, definition, promised item and current date before payout. Failures leave the source owner, inventory, energy and RNG unchanged. |
| Renderer and warnings | `playScenePlaceables.ts:51-94` reuses the bundled pickup marker because forage entries have no authored graphics field. Expired/disabled generated forage is hidden; stale/missing definitions retain fallback and warning. `playSceneMapRuntime.ts:504` restores forage warnings after event-only rebuild clears the warning set. Rendering is read-only; successful interaction refreshes the existing surfaces. |
| Accepted-date arithmetic | `seasonalForage.ts:157-162` converts each validated component to bigint before arithmetic. The same exact ordinal drives expiry, ordering and spawn cadence; Number.MAX_SAFE_INTEGER years do not lose adjacent days. No arbitrary year cap, persisted bigint or new schema version was introduced. This fixes the retained parent RED, not an inherited exception. |
| Runner alignment | `sceneTestRunner.ts` uses the shared life helper and hand intent, and the clock/set-time authorities. It preserves residual minutes when beginning exactly at day end and restores the session on failed compound time operations. Chest logging means consumed open dispatch only; it is not a fabricated deposit/withdraw result. |

I inspected the new behavioral tests and the existing-test edits. The changed duplicate-ID test still checks the actually selected appended row after default materialization; it was not weakened into a default-row assertion. The two large-clock fixtures now use an accepted safe-integer year to continue testing absolute-minute overflow independently of malformed-date rejection. The P2 forage fixture sets its live date before collection, and its readonly fixture fixes retain assertions. No test deletion, skip, baseline absorption, error suppression, or new prose-pinning test is part of this diff. New async clock tests arm bounded completion/refusal signals; controlled time is the behavior being tested, not a timing retry.

## Evidence examined and verification result

Paths in this section are relative to `.omo/evidence/life-full-20260906/` in the reviewed tree. Parent executions and independent executions are attributed separately; this reviewer did **not** rerun product tests, builds, whole gates, browsers or remote calls.

| Evidence | Actual result / surface |
| --- | --- |
| `10/parent/SUMMARY.md`, `10/parent/integration-check/focused.json` | Parent's exact combined selection: **233 passed / 10 files / exit0**, including the five required task6-10 suites. This overlaps other selections and is not added to their counts. |
| `10/parent/integration-check/diagnostics.json` | Empty syntactic/semantic diagnostics for all **25 changed source/test paths**, exit0. |
| `10/parent/typecheck.json`, `build.json` | Direct app typecheck and complete build exit0 on the tested product. Build stdout includes app/export-player/standalone outputs; unresolved asset, mixed import, circular reexport and large-chunk warnings remain in stderr. |
| `10/parent/integration-check/regrowth.mjs`, `regrowth.json`, `regrowth-state.json` | **19 public scenarios**, real farming/day authorities and file-backed native Storage: zero yield, remaining7 Save5/Project4 roundtrip, exact ten qualifying ticks, dry/dead/failed-day behavior, malformed raw preservation. Not native keyboard farming. |
| `10/parent/integration-check/clock.mjs`, `clock-paths.json` | **Five public clock paths**, actual ledger DOM start/collection and Storage. Camera/render endpoints are substituted. Processing29 -> ready30, frozen payout, pause, no render-side progress, capacity/duplicate refusal. Load uses direct collection after actual restore; it is labeled accordingly. |
| `10/parent/integration-check/priority.mjs`, `priority-state.json` | Real `handleAction`, actual chest DOM and actual life authorities. Both five-step coordinate chains, front farm before feet event, six normal/extreme date controls. Event execution and scene render endpoints are recording substitutes. |
| `10/parent/player.mjs`, `10/parent/native/player.json` | Native Firefox **player.html**, export store shim, **three scenarios / five real Z inputs**. Catch grants one fish, energy3 -> 0; energy/tool refusals preserve readable state except the receipt; authored sleep generates forage and subsequent input collects it. Zero page errors, failed requests or observed writes; full stamina, zero swing cooldown and no durable attack-audio observation. Source hashes match this review. |
| `10/parent/native/pixels.json` | **3,408 changed RGBA pixels** confined to x128..191/y188..259, the removed forage-marker region. Numerical proof only. |
| `10/parent/integration-check/editor.mjs`, `editor-state.json` | Actual Firefox editor keyboard add/checkbox/action controls, Ctrl+Z/Y, **eight mutations**, first-table defaults and local Project4 roundtrip retaining false. Captures at 1440x900 and 1024x768. Existing Life-group navigation is pointer-only. Remote persistence is false throughout; no nonlocal writes. This is not the production remote save/import-dialog journey. |
| `phase3-verification/final/VERIFY.md` and supporting receipts | Independent scoped confirmation with zero mandatory corrections, including separate native/editor/public probes and the identical accepted-date regression probe. I checked all **51 artifact lengths/hashes** and all **25 source hashes**, rather than adopting the confirmation label alone. |
| `10/parent/related.json` | Broader selection: **283 passed / 2 failed / 285 total / exit1**. Both `actionDebounceFootprint.test.ts` snapshot cases throw `TypeError: Cannot read properties of undefined (reading 'registry')` at `syncCutsceneHudVisibility`. Their unchanged failing body and exact shifted source frames are included in the base comparison. |
| `phase3-gates/{full.json,vitest-report.json,surface.json,surface-comparison.json,css.json}` | Full and separate gate exits as listed in findings. I parsed the original Vitest report: all **234 cases in all 8 changed Phase3 test files passed**, including the changed existing tests. This does not convert the 219 failures or wrapper timeout to success. |
| `phase3-gate-triage/{FINAL.md,common-comparison.md,common-comparison.json,parent-comparison-verification.json,audit-candidate-conclusion.json}` and raw pair reports/streams | Completed read-only/no-network/one-worker comparison and controlled audit proof, with their actual exits and limits. The parent's comparison completion is not gate approval. |

### Reviewer's independent evidence-integrity check

Using a bounded read-only Python check under `flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock` and `timeout --signal=TERM --kill-after=15s 60s`, I independently verified:

- **11 input SHA256 hashes, 1,772 exact byte-range references and 1,099 JSON pointers** in the common comparison.
- Every original failed case maps once: **219 = 162 shared failures + 57 both-pass non-reproductions**; both full paired report keysets have **1,251 cases / 113 files** and the sole status delta is the named clean-flush observer case.
- All **162 complete human diagnostic bodies**, with **156 raw-equal / 158 root-only-equal / 162 equal after the four narrowly justified mappings**. No truncated JSON headline was substituted for expected/received bodies.
- Only CF001/CF002 source frames in `playSceneMapRuntime`, CF066 source-line coordinates in `playSceneMovement`, and CF134's one audit timestamp require mappings. The source hashes and corresponding current/base source lines match those explanations.
- The actual sole-delta failure body contains the system normalization audit entry POST to `/__oprn/edit-activity`, not a LegacyDb request. I also read the parent probe, its two results, the unchanged clean flush/mirror code, and the existing test reset precedent.

The check returned exit0. It was an evidence check, not another product gate run. Source/test/package whitespace check and unchanged tested-byte comparisons also returned 0.

## Explicit remaining limits and later obligations

- Two current-only case-attributed audit console lines remain unexplained; warning order differs around a common 15000ms timeout. The existing CSS fixture reports different elapsed build times with the same emitted names/sizes. None was normalized away as a fix.
- The pair was network-restricted. Matching DB-unavailable/live-AI errors do not prove working remote integration or establish the cause of every failure. Both runs retain **two identical unhandled errors**: invalid Response status204 in `mapEditLockScratchSession.test.ts:74` and a worker `onTaskUpdate` timeout. Vitest's false-positive warning still applies.
- Full diagnostic equality covers all printed values, not matcher-elided runtime objects. The original 57 non-reproductions remain unresolved. High host load is recorded, not promoted to a proven cause.
- The parent editor receipt retains optional loopback bridge CORS failures, WebGL fallback warnings and offline autosave error logs. Its local Project4 roundtrip is not remote save success. The native player receipt is separate and has no page errors/failed requests.
- Native image reads were unavailable in the supplied QA. This reviewer did not supply aesthetic image approval. The plan explicitly allows that limitation to be recorded; full later task18/F3 visual/journey obligations remain open.
- Original transcript trailing whitespace and the literal unified-diff context space remain untouched. A clean product diff is not a claim that retained raw transcripts pass whitespace lint.
- Tasks11-20, F1-F4 and the final rollup remain obligations. In particular, keep explicit `housingPlacementId` semantics, no inferred historical-resource refunds, claim/raw preservation, Save4/Save5/new-key separation and Project4; complete task12's self-plot integration, task18's full journeys and task19's isolated LegacyDb save/reload without overwriting the existing demo. No later obligation is certified complete here.

## Parent action and effort

1. Archive this verdict with the frozen HEAD and attach the complete red-gate disposition to the Phase3 stacked PR. **Quick**; no Phase3 product correction is required by this review.
2. Keep that PR open under `--make-pr`; do not merge remotely. Carry the limitations and explicit task12 caller obligation into the next approved phase rather than declaring the all51 goal complete.

## Cleanup receipt

- This reviewer reused the single assigned tree; no new worktree, branch, dependency installation, application server, browser, build, cache, real network/DB write or paid call was created.
- The only reviewer-authored artifact is `.omo/evidence/life-full-20260906/phase3-final-review/VERDICT.md`, created using the installed native `apply_patch` entry point. No product/test/config/wiki or prior evidence file was edited.
- Entry and pre-artifact checks show empty tracked/index diffs, the exact HEAD/tree above, no untracked product files, no review-tree runtime processes, and no `dist` directory. Canonical adoption files are present; credential values were not read.
- Supplied parent/independent cleanup receipts record closed contexts/browsers/servers, removed owned Storage/build/cache scratch and no pair cleanup errors. Those receipts were inspected, not replaced by an invented fresh runtime check.
- The verdict remains unstaged. No stage, commit, merge, push, PR creation or external message was performed. The detached review tree remains locked with reason `life-full task33 final review; parent owns archival and cleanup`; the parent owns preserving this artifact and removing the tree.

**Final decision: APPROVE for Phase3 tasks6-10 at bd81a933cbecfeb8b25ef15bf57bc24911011aa8, with the exact evidence limits above. Whole-project gate status remains failing/incomplete; overall goal completion remains unapproved.**
