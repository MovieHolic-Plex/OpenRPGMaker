# Final repaired-gate reason classification (st_01a07fe7)

## Outcome and authority

All 17 new reason records are accounted for; no introduced non-selector product regression is supported by the immutable source, complete inventories, and one matched narrow execution. This is not a green-gate finding. The assigned staged swap fixture still fails at the locked candidate. The commit probe has a substantive but explained native-contract change, not harmless already-red noise. Publication export still fails its original deadline in the candidate narrow run; that result is retained without retry.

- Baseline source: `/home/main/z-project/rpg-zzu-ai-acceptance-live-baseline`, `e05a99b915102de113ac4634f4a06a5bb3267788`.
- Candidate source: `/home/main/z-project/rpg-zzu-ai-acceptance-live-review`, `0798a67b36f8416c4f3526be40712c5fb31f51fc`.
- Full packs: baseline `output/evidence/acceptance-live-baseline`; final candidate `/home/main/z-project/rpg-zzu-ai-acceptance-live-qa/output/evidence/acceptance-live-candidate-final`.
- Evidence root for this task: `/home/main/z-project/rpg-zzu-ai-acceptance-live-baseline/output/evidence/acceptance-live-final-triage/st_01a07fe7/`. Helpers use explicit immutable root mappings, never derive a source root from their nesting.
- `case-level.json` contains all 17 original records with comparison indexes, multiplicity, original comparison reason, both raw assertion objects, exact statuses/durations, original stack/value strings, full-pack file timing/load samples, dispositions, identity paths, limitations, and probe receipts. ANSI, timestamps, random suffixes and substantive values are preserved in raw records.
- Reconciliation independently confirms raw JSON equals the all-case-statuses inventory as a **multiset**, on both sides. Candidate: 1829 files / 18363 cases / 18128 passed / 212 failed / 23 skipped. Baseline: 1826 / 18328 / 18089 / 216 / 23. `comparable=true`; zero new unhandled reason records. Both full commands exited 1.
- All 1829 candidate queued/end/raw-JSON file occurrences and the terminal count agree. Original lifecycle SHA256 independently matches `96aa4f42eaf8bbb082f1dbaaf0b97321a5eb6fa25518e819761017f1864bc3f1`. The preserved line-11562 undoHistory damage concerns an optional collected diagnostic; the intact appended start is recovered. No result record was ignored, reconstructed or declared invalid because of that line. `trace-recovery.json` and `summarize-recovered.py` remain the full-pack recovery authority.

## Identity, inputs and limits

`runtime-source-identity.json` records SHA256 for every file and a TypeScript-transpiled literal import/export/require/mock graph; type-only edges are removed, computed imports are explicitly listed. Every one of the 17 represented tests is byte-identical. All 88 tracked fixture/harness inputs examined are byte-identical, including the capture/minimal-command/probe-floor JSON inputs, project fixtures, Vitest config/wrapper and package manifests. Both source worktrees have empty tracked/index diffs.

| Entry | Runtime closure | Finding |
| --- | ---: | --- |
| placeConceptTool | 672 | Byte-identical; explicit scratch inn fixture and fixed seed sweep unchanged. |
| publicationExport | 287 | Byte-identical. Its computed esbuild entry is separately covered: releaseDependencyCollector has 129 byte-identical files. Collector build is `write:false`; fixture archive bytes/fetchBytes/VM DOM are local, not FakeDom. |
| supabaseProjectSync | 287 | Byte-identical; gallery generator, two-editor clones and in-memory SHA/PATCH protocol unchanged. |
| villageBuilder | 637 | Byte-identical; empty-project builder and all fixed seeds/tile sets/assertions unchanged. |
| storePersistence | 291 | Byte-identical; prior narrow evidence remains applicable. |
| autosave affected persistence entry | 290 | `src/project/store.ts` closure byte-identical. Whole test closure is larger because another case dynamically renders the editor. First case never installs FakeDom, mocks editor dependencies or imports the editor; it imports defaults/store and stubs the same resource-cache boundary. |
| databaseVillageView | 384 | **Not wholly identical:** only `test/fakeDom.ts` differs. All product render/model/catalog sources and test inputs are unchanged. |
| assistantDependencyRetry | 700 -> 701 | **Not wholly identical:** AssistantSession, intentDeclaration, intentDeclarationClient and new requestCoverage are reachable. Active-path equivalence below, not a false unchanged-closure claim. |
| eventEditorCommitProbe | 508 | Only FakeDom differs; every product form, fixture and probe algorithm is unchanged. |

The dependency-retry fixture injects `fixedDeclarer({mode:'modify', needsPlan:true, ...})`, returning no `requestRequirements` and no `error` (`test/intentFixture.ts:6-32`; test:30-57). Therefore the new model audit is not called, the new coverage adoption branch at assistantSession:1901 is false, and cache success remains the old no-error case. The optional acceptance request argument is absent, so its nullish fallback uses exactly the old baseline/source. Moving the local functional array outside its conditional does not change this path; no functional requirements are provided. Both original retry/acceptance runs complete with every unchanged assertion in the matched pair. This does not assert that the entire AssistantSession implementation is unchanged.

The database gallery case is synchronous (`test:255-265`): every built-in card click snapshots, patches and rerenders the record, then `templateFromRecord` validates it. `databaseVillageView.ts:1082-1135` supplies the unchanged catalog loop and callback. It has no wait for a selection/event. FakeDom adoption/selection bookkeeping can add CPU cost; narrow B/C results are comparable, while full-pack load is much higher. The evidence does not numerically separate bookkeeping overhead from scheduling pressure.

## Case dispositions

Indexes below are zero-based original comparison indexes. Every multiplicity is 1; no cases are deduplicated or removed.

| Index | Family | Disposition |
| --- | --- | --- |
| 0 | assistantDependencyRetry bounds variations | Load-sensitive 15-second deadline; changed imports explicitly analyzed above. Narrow B/C pass. No retry/acceptance regression reproduced. |
| 1 | autosaveStatus pending/saving/saved | Existing completion-synchronization/load issue, not a new state transition contract. Details below. |
| 2 | databaseVillageView gallery contract | Load-sensitive synchronous deadline; product/input identity with explicit FakeDom exception. Narrow B/C pass. |
| 3 | devPlayerBundles | Same EROFS at test:20 before build; suffix `2pvD5D -> 23yZ0R` only. |
| 4 | eventEditorCommitProbe already-red snapshot | Native-invalid fixture correction exposing lost probe coverage; six floors analyzed below. Not a wiring regression and not presentation-only. |
| 5 | eventEditorStagedState swap | **Assigned fixture incompatibility remains:** selected event-a/event-b are not actual fixture events, so faithful selects commit empty IDs. Separate owner is seeding records; no moving-tree validation here. |
| 6 | eventEditorTrustLoop | Same missing KeyboardEvent at pageProps:340 via :282, test:235; FakeDom dispatch stack line 242 -> 319 only. |
| 7 | placeConceptTool seed sweep | Load-sensitive synchronous deadline. Seeds `[1,2,3,4,5,6,7,8,11,22,33]`, scratch bundle and `map_inn_seed_fit` unchanged. Narrow B/C pass. |
| 8 | publicationExport legacy false | Existing export performance/load sensitivity; identical main and computed collector closures. **Narrow candidate still times out**, baseline is near deadline. Exact slow hash/bootstrap stage unproven. |
| 9 | standaloneCli | Same EROFS at test:13 before CLI execution; suffix `XRpaGO -> caVxGW` only. |
| 10 | storePersistence before-load | Same one edit-activity POST vs expected zero; only `at` changes `2026-09-07T18:54:19.011Z -> 2026-09-08T06:14:19.001Z`. Not a Supabase project write. |
| 11 | storePersistence missing-row | Existing synchronization/spy-scope defect; **substantive** expected 1, received 3 -> 4. Prior matched narrow B/C both receive 4. Not normalized away. |
| 12 | supabaseProjectSync concurrent map tree | Load-sensitive 15-second deadline with identical local protocol. Same fixed new map IDs, `Promise.all` and exactly-three-PATCH assertion. Narrow B/C pass. |
| 13 | teamWorkflowUi | Same missing `window.addEventListener` at menu:340 during identity-save topbar rerender; FakeDom dispatch/click lines +77 only. |
| 14 | tilesetAiWorkspaceModal | Same missing `matching.matches` at accessibility:25 via modal:129,525, test:183; FakeDom dispatch/click lines +77 only. Matching unhandled remains pre-existing. |
| 15 | villageBuilder same-seed | Load-sensitive synchronous deadline; seeds `[7,7,8]` and tile/event/map/tree assertions unchanged. Narrow B/C pass. |
| 16 | villageBuilder road footprint | Load-sensitive synchronous deadline; seeds `[1,7,42,77]`, fixed road tiles and footprint/door assertions unchanged. Narrow B/C pass. |

Partition: 7 load/deadline records + 2 prior synchronization/load records + 6 presentation-only existing failures + 1 native-contract correction on already-red probe + 1 separately assigned selector fixture failure = 17. Six presentation comparisons are mechanically checked equal after **only** stripping ANSI/root spelling and substituting the specifically named suffix/timestamp/stack-line deltas; raw reasons remain untouched.

### Timing/status measurements

Durations below are milliseconds; raw floating values remain in JSON. Deadlines were not changed: 15000 ms globally and explicitly in autosave's first test. The autosave `vi.waitFor` additionally has its existing separate 1000-ms real deadline and 50-ms interval.

| Index | Full B | Full C | Narrow B | Narrow C |
| --- | ---: | ---: | ---: | ---: |
| 0 | 6440.035 | 15491.803 timeout | 7635.444 pass | 7891.338 pass |
| 1 | 1767.659 | 7171.134 saving != saved | 2909.826 pass | 2659.227 pass |
| 2 | 5667.919 | 26976.990 timeout | 10570.912 pass | 10201.122 pass |
| 7 | 2857.485 | 15411.421 timeout | 7200.747 pass | 6061.411 pass |
| 8 | 10205.485 | 15293.212 timeout | 14225.303 pass | 15374.968 timeout |
| 12 | 3057.879 | 15224.260 timeout | 7029.686 pass | 7229.991 pass |
| 15 | 4172.616 | 17178.453 timeout | 9117.809 pass | 9791.348 pass |
| 16 | 6918.219 | 20401.472 timeout | 8355.814 pass | 9195.515 pass |

Full candidate file-interval one-minute load ranges: dependency retry 130.67-143.33 vs B 48.10-50.06; gallery 151.67-172.94 vs 38.60-41.09; seed sweep 153.11-172.94 vs 38.60; concurrent map tree 127.44-134.07 vs 38.84; village builds 127.44-149.88 vs 37.75-38.84; publication 65.85-96.31 vs 37.92-41.29. Autosave's nearest sample is 102.75 vs 38.44. These are file-interval/nearest samples, **not invented exact per-test start load**. Raw samples/epochs are linked in JSON. The matched pair started together at load 78.02 and used separate four-worker pools on the 32-core host.

Installed Vitest runner `chunk-hooks.js:1875-1885` checks elapsed wall time even after a synchronous body completes; a timeout in a synchronous gallery/build/seed test does not imply a missing promise or event. Async timeout evidence does not locate an exact suspended await. The repeated candidate publication timeout is still red; unchanged source/input closures and a baseline within 775 ms of the deadline support pre-existing load sensitivity, not a candidate timing guarantee. No higher limit or unrelated product performance edit is justified here.

### Autosave and persistence mechanism

Autosave's first case (`test/autosaveStatus.test.ts:21-48`) subscribes to collect states but waits for completion by polling, after one `Promise.resolve()` checkpoint and resolving the **first fetch**, not the actual saved event. `vi.waitFor` uses safe real timers (installed `vi.bdSIJ99Y.js:3707-3754`), advances fake time per poll, and rejects with the last `saving != saved` assertion after 1000 ms. It does not share the test's 15000-ms deadline.

`store.ts:1147-1185` publishes saving before `persistCurrent`; that method awaits full save/child-row work and then hashes a persistence receipt (`store.ts:1214-1247`, `supabaseProjectSync.ts:258-280`, `sha256.ts:74-88`). Only completion publishes saved. Resolving the fetch latch does not complete those real async operations. The first fetch can also be telemetry because the 1500-ms mirror timer fires during the 3999-ms advance. The controlled stub accepts later fetches, so this is not a newly missing stub response. Full evidence does not identify the exact pending operation; both narrow cases reach the exact pending/saving/saved sequence. The old poll/checkpoint design is synchronization debt, not a newly proven product liveness regression. No polling test was added or edited.

For storePersistence, the unchanged mirror has a 1500-ms callback that calls the then-current global fetch (`editActivityLog.ts:422-451`). Test cleanup restores spies/globals, but `vi.resetModules` does not cancel older module instances' mirror timers. The missing-row all-fetch count consequently varies 3/4; prior immutable narrow results reproduce 4 on both sides. Before-load's one telemetry POST is a different, timestamp-only delta. Prior evidence reused: baseline `output/evidence/acceptance-live-delta-triage/st_01a07f65/REPORT.md`, runtime identity, baseline/candidate-json JSON and receipts (absolute paths/hashes in case JSON). No new execution of these already-explained families was necessary.

## Commit probe native-contract analysis

The baseline already fails at `surfaceGateSupport.ts:280` for four kind-level differences against its older stored snapshot: changeFace/showPicture added prompt controls, and giveMonster/evolveMonster selecting `species_aqualing` instead of stored `species_cave_bat`. These same differences remain; they are not all new candidate behavior. Candidate instead fails the earlier floor check at `surfaceGateSupport.ts:272`, and reports 22 kind-level surface groups (first 20 printed). The matched pair reproduces this exact change.

The capture project truncates catalogs to three records, but never seeds the arbitrary IDs in MINIMAL_COMMANDS. It contains `map_blank_start`, actors beginning `actor_hero/actor_guardian/actor_mage`, real class/troop/species IDs, **not** `map1/actor1/class1/troop1/species1`; commonEvents are empty and the blank map has no event fixture. Default system has no craftRecipes/itemUpgrades, the project has no endings, and uploaded assets are empty. `listMovieResources` enumerates uploaded movie assets; the sample preview clip is expressly not a selectable project resource.

- Old FakeDom stores any select.value string, even when no option has that ID. New FakeDom uses the matching option index, so invalid assignment yields `selectedIndex=-1`, `value=''` (`fakeDom.ts:177-185`). This is the native contract, covered by the completed `fakeDomSelectContracts` inventory; no rollback to accepting nonexistent IDs is appropriate.
- `selectMarker` (`eventEditorCommitProbe.ts:285-293`) filters out options equal to current value. With a sole empty placeholder and now-empty current value, it returns null; manipulation records **single-option**, never dispatches, and the commit count falls. This is a fixture/probe coverage loss, not a missing product listener.
- New floors: callCommonEvent **0 < 1**, callMapEvent **0 < 1**, craftRecipe **0 < 1**, applyItemUpgrade **0 < 1**, triggerEnding **0 < 1**; each offers only the empty placeholder because the capture fixture lacks a valid record. playMovie **2 < 3**: movie selection becomes single-option while wait and skippable still commit.
- Invalid selected companion fields become empty during other controls' commits: changeTile mapId; battleProcessing troopId; learnSkill/changeExp/changeLevel/promoteActor/changeEquipment/changeActorHp/changeActorMp/enterHeroName/changeParty actorId; giveMonster speciesId. Those substantive values are preserved in raw JSON, not dismissed as line-number changes.
- Optional destinations/companions become undefined/omitted as their unchanged forms specify: promoteActor toClassId, evolveMonster toSpeciesId, addFollower actorId. Both old and new runs still choose the same valid last species option `species_aqualing`; that older stored-snapshot difference is distinct from clearing invalid `species1` on sibling controls.
- The two groups omitted by the raw prose's print limit are explained by the explicit playMovie/triggerEnding floors and source: movie resource control and ending control become single-option; movie toggles read the empty resource ID. These are source-derived explanations, not fabricated expanded raw output.

Thus the already-red probe is **documented native-contract correction exposing pre-existing invalid fixture and weakened exercised coverage**. Do not approve it as merely cosmetic, and do not lower floors or blindly refresh the whole snapshot to hide it. A future lead-owned coverage repair should seed valid/selectable capture records (including movie/common/map events, recipes, upgrades and endings) and valid initial command IDs while retaining branch/wiring assertions. No product form change is warranted by this record. That separate debt was not edited or folded into the single assigned staged-selector fixture change.

## Commands, exits and verification boundaries

Exact complete argv, environment, root mapping and sandbox mounts are in `baseline/receipt.json` and `candidate/receipt.json`; `probe.py` constructs them from original comparison names. Each side ran once: the same 9 selected cases in 8 files, default+JSON reporters, `--configLoader bundle --pool threads --maxWorkers 4 --minWorkers 1`. No custom external reporter or alternate fixture was loaded. The original test-name filter creates 172 **filtered** skips per narrow report; these are not changes to the 23 full-gate skips.

- `node identity.cjs runtime`: exit **0**, including the explicit store/collector entries and 88 fixture/harness hashes. Re-extraction only, not a test rerun.
- `python3 probe.py baseline`: exit **1**, 8 passed / 1 failed, 65.173 seconds. Failure is the old four-group commit-probe snapshot assertion.
- `python3 probe.py candidate`: exit **1**, 7 passed / 2 failed, 67.825 seconds. Failures are the six-floor commit probe and publication export's original 15000-ms timeout. Neither is suppressed or retried.
- `python3 summarize.py`: exit **0**, full multiset/trace/source reconciliation; `reconciliation.log`.
- `python3 classify.py`: exit **0**, 17-record accounting, six exact named-difference presentation checks, prior raw probe links; `classification.log`.
- Final `validate.py`: receipt and invariants in `validation.json`; checks all record multiplicities/dispositions, identities, unchanged heads/tracked files, raw inventory equality, exact probe counts and artifact hashes.

Both narrow executions use bwrap with root filesystem read-only, private network and device mounts, and writes only to fresh evidence leaves/caches mounted from this allowed evidence root. Shared installed node_modules are read through immutable worktree links. No source/test/tracked-evidence edits, installs, full-suite reruns, network/DB writes, commits, PR, push or merge occurred. The implementation tree was never tested or edited. No unchanged full-suite pass, precise scheduler attribution, new selector-fixture success or production liveness proof is claimed. Lead retains the followup PR and final review.
