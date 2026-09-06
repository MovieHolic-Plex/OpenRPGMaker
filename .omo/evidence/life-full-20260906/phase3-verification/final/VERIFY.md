# Phase 3 tasks6..10 independent verification

**Status: confirmed for the assigned Phase 3 scope. Mandatory product corrections: 0.**

The completed field-input implementation and its integrated XP, crop, tool-authoring and maker-clock predecessors satisfy the assigned boundaries at the frozen source below. This is independent scoped verification, **not task33 ultrabrain approval, a whole-project green verdict, or completion of the six-phase/51-feature goal**. Native image viewing was unavailable; screenshots and exact pixel measurements are retained without image-level approval.

## Source identity, handoff and isolation

- Verifier/task: `st_01a07748`; parent/root `01a0727b-398a-7481-b557-b198013542c1`.
- Producer: `/home/main/z-project/rpg-zzu-life-full-field-input`, branch `agent/life-full-field-input`.
- Actual completed producer HEAD: **`bbaf9464cad3768da057ef9909338b5cfb25aa8c`**.
- Actual tree: **`c62153444c0e05855be01628c534c4e0f9f15bbe`**.
- Task10 implementation: `038ff8b47b127e604dad6a5c5cb50597ef543c20`; accepted-large-date correction: `bbaf9464c`. Both actual source changes and completed `10/SUMMARY.md` / `10/date-fix/SUMMARY.md` were read. Historical blocked/partial reports were not treated as completion.
- Read the original approved plan at `/home/main/.herdr/worktrees/rpg-zzu/wish-html/.omo/plans/life-systems-full-implementation.md`, its complete task10 contract, and `phase3-handoffs/task10.json`. The handoff's base is `fb0588d9383f2b3c85a421bfe706a56e8c40742b`; its `confirmed` means predecessor readiness, not task10 implementation. The later actual producer source supplies that implementation.
- Read all task6..10 SUMMARY/VERIFY records present at entry, including historical task6 partial status, task7/8 parent summaries, task8 independent tools verification, and task10 date-fix completion. Read canonical AGENTS (byte-identical to this checkout), quickstart, INDEX/PROJECT_WIKI, worktree guidance and relevant runtime/session/testing wiki contracts. No CLAUDE.md was read.
- Later parent-only `10/parent/SUMMARY.md` was read after notification, and is recorded separately below; it did not substitute for this verifier's executions.

Exactly one detached verification worktree was created from the completed HEAD, then immediately locked. Actual setup commands, exit0:

```sh
git -C /home/main/z-project/rpg-zzu-life-full-field-input worktree add --detach /home/main/z-project/rpg-zzu-life-full-field-verify bbaf9464cad3768da057ef9909338b5cfb25aa8c
git -C /home/main/z-project/rpg-zzu-life-full-field-input worktree lock --reason 'st_01a07748 independent Phase3 verification; parent owns archival/removal' /home/main/z-project/rpg-zzu-life-full-field-verify
# From /home/main/z-project/rpg-zzu:
npm run wt -- adopt life-full-field-verify --path /home/main/z-project/rpg-zzu-life-full-field-verify
```

Canonical adoption provisioned the dependency symlink and ignored `.env.local`; no dependency installation occurred. Its port9841 was already occupied by foreign PID2252417. That listener was not stopped or reused. An actual socket bind to port0 allocated free **127.0.0.1:58163**, which was stored only in this tree's ignored configuration and used explicitly by both strict-port servers. Node `v24.11.1`, npm `11.6.2`. All validation ran in `/home/main/z-project/rpg-zzu-life-full-field-verify`, not in the producer/integration trees.

`source.json` records SHA256/Git blobs for all **25 Phase3 changed source/test paths**, identified by `git diff 48195f575^..HEAD --name-only -- src test`. Every file equals the producer's actual bytes after verification. `identity.json` and `cleanup.json` record clean producer status, unchanged HEAD/tree and empty tracked/index diffs. Actual ancestor checks returned0 for task6 `48195f575`, task7 `9cb85be84`, task8 `98b099f8d`, task9 `27db0af00` and initial task10 `038ff8b47`. Package manifests/lockfile and explicit `lifeSkillProgress.ts` are byte-unchanged from the Phase3 base.

## Findings by assigned boundary

All rows below are **confirmed** at the stated evidence surface; a module/HappyDOM result is not relabeled as native gameplay.

| Boundary | Actual authority and independent evidence |
| --- | --- |
| Real field input, not runner-only success | `playSceneMovement.ts:467+` calls the real `interactWithLifeField` between chest and farm at each coordinate. `lifeFieldInteraction.ts` calls the actual collector/catch transactions. The final native Firefox run uses `player.html` and the shipping `exportProjectStoreShim`, five real Z inputs, no direct catch/collect invocation or successful-outcome injection. |
| Event -> chest -> forage -> fish -> farm, at both coordinates | Independent `priority.mjs` constructs overlapping targets and executes real `handleAction` through all five winners at front and feet. Events are resolved by the real event lookup; the event execution endpoint only records dispatch. Chest uses the actual `tryChestInteraction` and real rendered chest UI, not the producer test's chest stub. State is unchanged for event/chest dispatch; forage wins over fish, then fish over untouched farm plots, then farm tills only after higher targets are absent. See `priority-state.json`. |
| Front -> feet is coordinate priority, not a global event-first pass | Independent priority probe proves front farming beats an underfoot event. The real-input suite proves front fishing beats an underfoot event, a non-target front falls back to feet fish/forage, and an explicit front refusal cannot execute the feet event or harvest its mature crop. |
| Refusal consumes input without attack | Explicit forage/fish failures return true from `handleAction`. `updatePlayScene` calls `tryActionCombatSwing` only when `!interacted` (`playSceneMovement.ts:110-111`). Native scenarios enable action combat and assert zero swing cooldown, stamina100, and no durable `easyrpg-sound-attack1` audio receipt. Repeated energy0 and authored-tool refusal preserve the entire readable QA state except its action receipt. Unit/public failures compare complete sessions, including inventory, owner and RNG fields. |
| Successful native catch and date-generated forage | Native Z catches exactly one fish and spends energy3 -> 0. Native underfoot authored sleep advances day1 -> day2, signals an authored switch after sleep completion, and generates the actual forage owner; the following Z grants berry0 -> 1 and removes its marker. Initial fixture contains no reward items or generated forage. |
| No invented fish tool requirement | `attemptFishingCatch` requires the shared resolver only when an authored fish row exists. Native empty inventory/no authored fish rule catches successfully. Unit real-input cases exercise itemId-before-kind catch authorization and authored `requiresFarmable:true` refusal; native missing-tool rule refuses without RNG/inventory mutation. |
| Failure conservation: energy, bounds, expiry, missing species/definition, inventory, overlap | All45 `lifeFieldInteraction` cases pass. They cover energy0, no species, full inventory, disabled systems, fractional/out-of-map forage, out-of-map authored fish regions, stale/expired/season-old forage and event/chest overlap, with whole-session or owner-identity checks as appropriate. Explicit forage refusal cannot fall through to overlapping fishing. Task8 parity cases retain wall/static occupancy and tree/rock-under-chest refusal. There is no new claim that fishing enforces unrequested live-body placement restrictions. |
| Accepted extreme dates | The byte-identical parent `forage-date.mjs` was copied into this evidence directory and re-executed without overwriting either parent RED or GREEN. At year1 and year9007199254740991, day1/lifetime1 forage refuses on day3, pays0 and preserves complete state. Independent `priority.mjs` additionally exercises actual handleAction at live days1/2/3 with lifetime2 for both years: day1/day2 grant1, day3 refuses without mutation or fishing fallback. The45-case suite also verifies exact expiry, future dates, overlay hiding, adjacent/duplicate/backward cursors, three-day cadence, and28/99-day year boundaries. |
| Exact date arithmetic stays private | `seasonalForage.ts:dayOrdinal` converts each validated date component to bigint before multiplication/addition. Generator ordering, expiry and cadence use that same exact ordinal. No arbitrary year cap or persisted BigInt field was introduced. Current forage SHA256 is `5c80ae0b3e413b0fac294c4ab50c821c07a4b14f3d804046465263399189e09d`, matching independent probe and native source receipts. |
| Actual graphics, refresh and fallback | Native before/after screenshots independently differ by3408 RGBA pixels, only x128..191/y188..259 at the pickup marker. The valid generated pickup really renders and disappears after input. The authored forage entry has no graphics field; `playScenePlaceables` uses the existing Object2 gem marker, without inventing schema/artwork. Actual renderer tests verify missing-definition fallback/warning, hidden expired forage, non-mutating rendering and warning survival through real event-only refresh. Missing-definition repair itself is module/recording-renderer evidence, not a native edited-content journey. |
| Disabled automatic XP remains separated from harvest | All49 task6 cases execute actual crop, rock, tree, fish and date-generated forage authorities for enabled/disabled/omitted XP, invalid enabled rewards and capacity; applicable energy refusals preserve all state/RNG. Explicit XP APIs still refuse when disabled, and fishing minSkill qualification is not bypassed. Native catch/forage additionally pass with progression disabled. |
| Zero yield, exact regrowth and remaining7 Storage | All30 crop cases pass, including normal/zero yields, full/empty inventory, enabled/disabled XP, exact10 qualifying ticks after growth2, stage projection, refusal timer preservation, dry/dead/out-of-season/duplicate-day behavior and malformed saved countdown refusal. Independently replayed `regrowth.mjs` records19 public scenarios, including real Node file-backed Storage write/read/apply at remaining7, continued growth to zero, and raw-byte preservation. No inferred legacy harvest history. Save5 and Project4 remain distinct. |
| Authored false/default/replacement/priority | All44 tool parity cases and14 real database-view cases pass. Native editor verifies first Add materializes four real defaults plus the new first row, Ctrl+Z/Y, Space stores explicit false, checkbox undo/redo, keyboard End chooses harvest, local Project4 roundtrip/displayed false, and subsequent Add appends without merging. ItemId-first/ordered matching, conditionless non-consumable farm tools excluding seeds/consumables, integer bounds, terrain/static occupancy and wide-tool atomic costs are independently exercised in the focused suite. |
| Maker game-clock contracts | All28 task9 cases pass, including actual updateGameTime split frames29,000+999+1ms, large multi-day/residual deltas, menu-open non-progression, zero-minute owner identity, command/set/sleep/load paths, ready non-regression, frozen payouts, duplicates/capacity, invalid clocks and later-stage rollback. Independent `clock.mjs` starts jobs through the actual rendered ledger and replays five public clock/ledger/Storage paths, preserving the frozen3-input ->2-output+1-bonus promise and refusing duplicate/full-inventory collection. Controlled frame delta is the behavior under test; no wall-clock waiting or native maker journey is claimed. |
| Runner alignment without overstating its chest result | `sceneTestRunner.ts` uses the same life helper and hand intent, with front/feet per-coordinate order. Runner tests pass for catch, energy refusal, generated forage and chest priority. Chest runner logging means consumed/open dispatch, not a fabricated deposit/withdraw success. Native input and independent actual chest DOM evidence stand separately. |

The task12 integration constraint remains a **later dependency, not a current defect**: adding farm-plot occupancy to `canOccupySpatialFootprint` must not make farming reject its own plot. Live-body placement safety and the full later-phase housing/economy/remote journeys were not implemented or approved here.

## Commands and actual exits

`run.mjs` captures the real `spawnSync().status`, complete stdout/stderr, argv, cwd, UTC start/end and before/after HEAD in `<label>.json` / `<label>.log`. All heavyweight commands used this exact shared lock and fixed budgets:

```sh
flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock \
  timeout --signal=TERM --kill-after=15s <300s-or-600s> <command>
```

Environment explicitly supplied `DEV_SERVER_PORT=58163`, `DEV_SERVER_NO_TLS=1`, `E2E_FREEZE_DEV_SERVER=1` and a verifier-owned VITE cache path. Native/editor/public servers used their own cache paths and closed in finally.

| Receipt | Command after wrapper | Budget | Actual result |
| --- | --- | --- | --- |
| `focused` | Exact10-file command below | 300s | **exit0;233 passed/0 failed/0 skipped,10 files; first and only run** |
| `diagnostics` | `node E/diagnostics.mjs` | 300s | **exit0; zero TypeScript syntactic/semantic diagnostics on all25 Phase3 changed source/test files**, before app typecheck/build |
| `typecheck` | `npm run typecheck:app` | 300s | **exit0** |
| `build` | `npm run build` | 600s | **exit0; app, export-player/SDK and standalone bundles built** |
| `native` | `node E/player.mjs` | 300s | **exit0;3 native player scenarios,5 real Z inputs** |
| `editor` | `node E/editor.mjs` | 300s | **exit0;8 native editor mutations and local Project4 roundtrip** |
| `regrowth` | `node --experimental-webstorage --localstorage-file=E/native-storage E/regrowth.mjs` | 300s | **exit0;19 public/native-file-Storage scenarios** |
| `clock` | `node E/clock.mjs` | 300s | **exit0;5 public clock/ledger/Storage paths** |
| `forage-date` | `node E/forage-date.mjs` | 300s | **exit0; identical parent regression probe, normal/extreme expired refusal** |
| `pixels` | `node E/pixels.mjs` | 300s | **exit0;3408 changed pixels confined to marker region** |
| `priority` | `node E/priority.mjs` | 300s | **exit0;both5-step priority chains, front-farm/feet-event order and6 accepted-date controls** |

Here `E` is `.omo/evidence/life-full-20260906/phase3-verification/final` relative to the verifier worktree. The JSON receipts contain expanded exact argv, not this shorthand.

```sh
npm test -- test/lifeSkillDisabledHarvest.test.ts test/cropRegrowthContract.test.ts test/toolActionAuthoringParity.test.ts test/makerClockIntegration.test.ts test/lifeFieldInteraction.test.ts test/databaseLifeCraftingView.test.ts test/playSceneFarmFeedback.test.ts test/playScenePlaceableOverlay.test.ts test/npcActionFacing.test.ts test/seasonalForage.test.ts
```

The five required suites contribute196 cases. The37 related cases cover changed editor authoring, existing feedback semantics, placeable drawing, event-facing behavior in the modified router, and seasonal generation. No failing case was deleted/skipped/weakened; there was no unchanged retry, timeout increase, dependency install, baseline change or full13k gate rerun. Evidence-script `node --check`, source/test whitespace checks and clean tracked/index comparisons all returned0.

## Native evidence and observation limits

The native fixture derives from the checked-in task5 engine-test fixture before boot, not remote authored content. The reviewed task10 native probe and task8 editor probe were copied to this verifier's owned evidence with only owned paths/port/key and all-origin observation changes; they were actually re-executed on the frozen source. `priority.mjs` is an additional independent verifier probe. Their receipts are not copied producer success reports.

- Player: `http://127.0.0.1:58163/player.html`, Firefox,1280x960. It asserts no editor toolbar. `performObservedAction` arms the exact `oprn:action` signal before input; title/readiness and completed day2+post-sleep switch+`running=false` use prearmed DOM mutation signals. No fixed sleeps/polling or injected reward/ready state. The authored noon start avoids unrelated dawn-tint motion for a deterministic exact pixel comparison.
- Captures: `native/fish-caught.png`, `native/catch-energy-refusal.png`, `native/authored-tool-refusal.png`, `native/forage-generated.png`, `native/forage-picked.png`. Full receipts/state/source hashes: `native/player.json`; pixel result: `native/pixels.json`.
- Editor: `http://127.0.0.1:58163/?blankProject=1`, Firefox. Boot waits for actual `perf-metrics-json.initialEditRenderMs`. Store subscriptions are installed before each authored keyboard mutation. Existing pointer-only Life group navigation uses its actual pointer control; authored controls/undo/redo use native keyboard events. Captures `editor-1440.png` and `editor-1024.png`; actions, bounds and displayed state in `editor-state.json`.
- The editor roundtrip uses actual serialize -> uniquely owned native localStorage key -> deserialize -> store replacement. It proves Project4 stability and displayed false, **not remote save or an import-dialog journey**. Initial/post-replace/final remote persistence are all false.
- Requests are observed at the browser context across **all actual origins** with service workers blocked. No invalid `**/supabase/**` filter is used. Native player observes only this owned origin and0 writes/0 page errors/0 failed requests. Editor observes8 POSTs:5 to its owned `/__oprn/edit-activity` endpoint and3 to optional loopback17831 `/v1/browser/hello`. The latter fail with `NS_ERROR_DOM_BAD_URI`; these are retained in the receipt and are not remote project saves. No nonlocal write attempt was observed, and the context guard would abort one. No remote content-write command was run.
- Image reads for the generated-forage and1024 editor PNGs explicitly returned **`Current model does not support images`**. No aesthetic/readability/pixel-level visual approval is claimed. The RGBA comparison is numerical evidence of localized native refresh, not visual-model inspection.
- Native QA state comparison covers the complete readable snapshot except the monotonically advancing action receipt. Complete hidden session/owner preservation is established separately by real transaction/handleAction tests and public probes; the limited QA mirror is not claimed to expose every owner.

## Preserved failures and inherited gate limitations

There were **no failed assigned validation commands in this independent run**. Exploratory discovery did produce an exit2 for a nonexistent evidence directory and guessed source paths, and one ENOENT read for the guessed `forage-date-probe.mjs`; the actual file is `forage-date.mjs`. These are discovery errors, not product GREEN/RED or silently retried validators. All executed validators and all their warnings remain in raw logs.

The completed producer and subsequent parent broader selection are **not wholly green**:17 files,283 passed/2 failed, exit1. Both failures are the independently established historical `actionDebounceFootprint.test.ts` snapshot-fixture failures:

```text
__oprnDebug snapshots: 3x3 + passRows1 body/pass rectangle case
__oprnDebug snapshots: absent footprint identity case
TypeError: Cannot read properties of undefined (reading 'registry')
  at syncCutsceneHudVisibility (src/player/playSceneMapRuntime.ts)
  at syncRuntimeState (...)
  at captureScene (test/actionDebounceFootprint.test.ts:139)
```

Exact original test names/stacks are retained in `10/inherited-failures.json` and original Phase2 triage evidence; corrected-source raw related output is `10/date-fix/related.txt.gz`. The test file is byte-unchanged from the Phase3 base. The changed map-runtime diff adds only the forage warning synchronization call, not a modification to the failing function. The parent also directly reran the17-file suite and retained its actual exit1 at `/home/main/z-project/rpg-zzu-life-full-field-input/.omo/evidence/life-full-20260906/10/parent/related.json`. That parent's native/diagnostics/typecheck/build results corroborate this report but are not counted as independent executions here. This verifier did not rerun the broader failing suite or reclassify it as green.

All producer RED/intermediate failures remain untouched, especially the accepted-large-date expiry defect's original parent RED, the corrected GREEN, the original dawn-tint pixel failure and diagnosed fixture corrections. The large-date defect was a real task10 issue, now directly verified corrected; it is not a baseline exception.

Build warnings remain in `build.log`: unresolved-at-build runtime font/starter assets, mixed dynamic/static imports, circular reexport/chunk warnings and large chunks. Editor optional bridge/WebGL/offline-fixture warnings and Node experimental Storage warning remain visible. No warning threshold or type error was suppressed.

Inherited Phase2 limits remain outstanding: **two1200s whole-Vitest/gate timeouts (exit124), unknown current whole-suite regression status and six matched pre-existing surface failures**. This scoped confirmation does not remove them. Parent owns phase-wide gates and final review; tasks18/19 and later final verifiers still own complete native authoring/life/save/remote journeys.

## Cleanup and delivery

`cleanup.json` contains actual checks and cleanup accounting:

- All three native contexts, editor context, browsers, Vite servers and HappyDOM windows closed; exact action/DOM subscriptions are bounded and removed by their owners. No owned Node/Firefox/Chromium runtime process remains.
- `ss -ltnp 'sport = :58163'` exit0 returns only the header: no listener. The foreign9841 listener was never touched.
- Removed only this newly created tree's generated `dist` (1981 files/244586321 bytes), local editor activity output (3 files/3169 bytes), and exclusive cleared native Storage file (24576 bytes). Each removal first checked for tracked files/symlinks. All exclusive build/editor/public/player cache paths are absent.
- Tracked `.vite-cache/deps`, shared dependencies/caches, ignored `.env.local`, all inherited producer/parent failures and other trees remain untouched.
- Producer and verifier still have the same frozen HEAD/tree; all25 verified source/test files match both HEAD and actual producer bytes. Tracked/index diffs are empty. No product/test/wiki/root-state edit, stage, commit, branch creation, merge, push, PR, remote authored-content write or producer/integration-tree modification occurred.
- This report and uniquely owned supporting evidence are **unstaged**. The nested evidence path is ignored, so clean `git status` does not mean the report is absent. `evidence-sha256.json` records the delivered artifact hashes.
- The sole verification tree remains **detached and locked** at `/home/main/z-project/rpg-zzu-life-full-field-verify`. Parent owns archival and tree removal.

**Final verdict: confirmed for tasks6..10 at bbaf9464c, mandatory corrections0, with the explicit native-image and inherited whole-gate limitations above. Task33 approval and the six-phase goal remain separate.**
