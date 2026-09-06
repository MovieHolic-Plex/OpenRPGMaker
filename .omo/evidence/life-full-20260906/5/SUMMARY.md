# Task5 - QA-only life observability

## DoneClaim

Task5's scoped QA observation increment is implemented and verified. The existing public snapshot contracts now carry detached life owners, and actual synchronous field-action dispatch produces scene-local increasing receipts, including rejected farm attempts. Normal shipped-player boot exposes no QA mirror/debug hook/receipt. This is not completion of later life gameplay, asynchronous event execution, full51 journeys, full gates, or independent approval.

- Task: `st_01a07442`; parent/root: `01a0727b-398a-7481-b557-b198013542c1`.
- Worktree: `/home/main/z-project/rpg-zzu-life-full-p2`; branch: `agent/life-full-p2`.
- Entry/base commit: `b7b02d97ad6cb3b493bd60691ec61970e8a0e37e`.
- Base tree: `63ea1d26f87d4a82d9ff925071582abdae01b354`.
- Verified product/test/wiki tree, before adding this evidence: `7af5b113323de35ec5bd06d54bfce4f9bbe0caf9` (`git write-tree`, exit0). Product files in the final evidence-bearing commit are byte-identical to this tree. The atomic delivery commit is the commit introducing this SUMMARY, discoverable with `git log -1 --format='%H %T' -- .omo/evidence/life-full-20260906/5/SUMMARY.md`; its exact SHA/tree is reported after commit, rather than inventing a self-referential SHA inside this file.
- Commit subject: `test(runtime): expose gated life action evidence`.

## Mandatory predecessor gate and scope

Read the complete approved plan Scope/task5 and `.omo/evidence/life-full-20260906/4/VERIFY.md` before any product edit. VERIFY says **confirmed, acceptance0, mandatory blockers0**, reviewed HEAD b7b02d97. Both `git merge-base --is-ancestor b7b02d97ad6cb3b493bd60691ec61970e8a0e37e HEAD` and `git merge-base --is-ancestor 596eab9a865257197e67992cc0eec4e45239ad34 HEAD` exited0. Gate file SHA256: `766f31c0a0a11033e31d20c57303f8cfa951450af20088ad0694af2c3b68b494`; it was not edited. Tasks2/3/4 were not reimplemented. The pre-existing ignored task5 VERIFY from verifier st_01a07423 concerns the older blocked/no-implementation attempt at8c4f4f57, not this increment. It remains untouched and excluded from this commit (SHA256 `c5c17d236da4ceee9ca576be0a755bbecc9a2e9f3b88fd6c3bae2fecb3ea7102`). This DoneClaim does not override that verifier artifact; the parent must obtain fresh independent task5 verification.

Read AGENTS, quickstart, PROJECT_WIKI, focused runtime routing/session/testing guidance, and available programming/TypeScript/debugging skills. All CLAUDE.md files were ignored. Tool LSP found the snapshot/readState owners; because tool references were document-local, `diagnostics.mjs --references` used the actual TypeScript language service over the worktree tsconfig to resolve workspace consumers. `lsp-references.json` includes RuntimeDebugPanel/tests, snapshot type consumers, and the actual `handleAction` dispatch owner/consumers. That actual action choke point is why the minimal PlayScene instrumentation extension touches `playSceneMovement.ts`; no separate input framework or save instrumentation was added. Existing PlayScene boot gating and scene-local RuntimeDomOverlay construction were reused without editing PlayScene.ts.

## Implemented contract

- `runtimeDom.ts`: shared pure `buildLifeRuntimeSnapshot` copies present `farmPlots`, `energy`, `makerInstances`, `farmAnimals`, `farmBuildingPlacements`, and `lifeRecovery`. Deep copying separates observer writes from live state. Reads neither reconcile nor progress makers nor pay claims. Missing optional fields stay absent, including future regrowth remaining and linked-housing fields; no dependent future types were invented.
- `playSceneMapRuntime.ts`, `playSceneTestHooks.ts`, `sceneTestRunner.ts`: existing DOM snapshot, `__oprnDebug.readState()`, and runner final state use that same builder. No new debug global.
- `handleAction`: the original dispatcher and its return behavior remain intact. QA-on collects its actual ordered farm attempt results and one receipt per dispatched input; QA-off allocates no attempt collection or receipt. Accepted farm results and explicit `ignored` reasons are returned by the real farming authority, not inferred from changed state.
- The scene's existing RuntimeDomOverlay owns the receipt sequence. `recordAction` records it, synchronizes the real mirror, then emits `oprn:action` on the scene's host. Reads/event details are detached. New scenes begin without receipts. Neither PlaySession nor SaveSnapshot contains the counter.
- `handled` is **input consumption**, not the completion of an asynchronous NPC/chest event and not a fabricated acceptance signal for future menu/fishing/housing actions. Such surfaces retain their own completion obligations. The receipt's `farmAttempts` reports the real synchronous outcomes, including facing then underfoot rejection.
- `runtimeQaRun.mjs`: `performObservedAction` installs its exact scene-host listener before triggering real input, waits with a bounded failure timeout, returns receipt + fresh public state + synchronized mirror, and removes listener/timer/JS handle on completion/cancellation. `{kind:'action', observe:true}` reuses this for scenario inputs. The manifest retains actual optional life owners and receipts. Hook readiness now follows the boot/mirror DOM mutation rather than polling. No existing life scenario with sleep waits was present; the focused new journeys use prearmed signals exclusively, and unrelated scenario waits were not rewritten.
- Matching runtime/testing wiki sections and generated INDEX updated. No product/save schema, dependencies, WISH, baseline file, root task state, or full51 coverage changes.

## RED and characterization chronology

Every `run.mjs` receipt records the exact argument array, cwd, entry HEAD/tree, timestamp, stdout+stderr, actual child exit/signal, and SHA256. Text logs normalize per-line trailing whitespace and excess blank lines at EOF; JSON retains exact captured output. An initial staged `git diff --cached --check` exited2 on blank EOF lines in six captured text logs; normalizing that presentation fixed it without altering the raw JSON receipts or test output content. Commands below ran from the named worktree, prefixed with `node .omo/evidence/life-full-20260906/5/run.mjs <label>`.

1. `characterization`: `npm test -- test/lifeQaObservability.test.ts test/runtimeQaInstrumentationBoundary.test.ts test/actionDebounceFootprint.test.ts` -> **exit1, 7 passed/3 failed**. My initial minimal fixture used `width/height` instead of the repository Rect's `w/h`; the actual public farming probe returned `not-farmable`. Corrected only that fixture (also removed unused unsupported fixture properties). This is **not** credited as behavioral RED. The other two failures were already-existing actionDebounce snapshot fixtures missing `scene.game.registry`; they were not edited or excluded from final related execution.
2. `baseline`: `npm test -- test/lifeQaObservability.test.ts test/runtimeQaInstrumentationBoundary.test.ts` -> **exit0, 5 passed**, before product changes. Real till spends one energy; subsequent real action rejects with whole-session equality; normal overlay has no mirror.
3. `red`: `npm test -- test/lifeQaObservability.test.ts` -> **exit1, 4 failed/3 passed**, before any product edit. Actual failures: missing shared snapshot builder (two tests), missing prearmed action receipt (bounded timeout), absent runner energy. Baseline action behavior remained green. This is the accepted RED.
4. `diagnostics-initial`: real TypeScript language service -> **exit1, one diagnostic**: my animal test record omitted required `name`. Added the required fixture name, without changing an assertion or production contract. Tool LSP had reported no diagnostics; the full workspace language service caught this and its failure remains visible.
5. `green`: **the first and only post-implementation execution** of `npm test -- test/lifeQaObservability.test.ts` -> **exit0, 7 passed/0 failed/0 skipped**, 10:25:18, 11.53s. No retries or test weakening.

## Verification commands and real exits

| Label / exact command (after run.mjs label) | Result |
| --- | --- |
| `green`: `npm test -- test/lifeQaObservability.test.ts` | Exit0; 7/7 passed in one final run. |
| `related`: `npm test -- test/runtimeQaInstrumentationBoundary.test.ts test/runtimeQaReport.test.ts test/runtimeQaGate.test.ts test/sceneTestRunner.test.ts test/debugSession.test.ts test/runtimeDebugPanel.test.ts test/playSceneFarmFeedback.test.ts test/npcActionFacing.test.ts test/runtimeMovementStability.test.ts test/actionDebounceFootprint.test.ts test/lifeSaveVersion.test.ts test/lifeRecoveryPersistence.test.ts test/p0SessionPersistence.test.ts test/p2SpatialPersistence.test.ts test/autosave.test.ts` | **Exit1; 249 passed, 2 failed, 0 skipped; 14 files passed/1 failed.** The same two pre-product actionDebounce fixture failures; no new failure or changed message. Full output retained, not absorbed into a baseline. |
| `public`: `node .omo/evidence/life-full-20260906/5/public-probe.mjs` | Exit0; actual builder + scene dispatcher + snapshot sync + debug hooks + save writer assertions. |
| `browser-chromium`: `VITE_CACHE_DIR=.omo/evidence/life-full-20260906/5/browser-cache node .omo/evidence/life-full-20260906/5/run.mjs browser-chromium node .omo/evidence/life-full-20260906/5/browser-proof.mjs` | Exit0; actual keyboard, shipped player, off/on; zero page errors and failed requests. Full invocation shown here includes its wrapper/environment. |
| `harness`: `VITE_CACHE_DIR=.omo/evidence/life-full-20260906/5/browser-cache node .omo/evidence/life-full-20260906/5/run.mjs harness node .omo/evidence/life-full-20260906/5/harness-proof.mjs` | Exit0; actual runtime scenario action op with observe:true, 2 beats, 0 failures/errors. |
| `lsp-references`: `node .omo/evidence/life-full-20260906/5/diagnostics.mjs --references` | Exit0; workspace symbol ownership/references. |
| `diagnostics`: `node .omo/evidence/life-full-20260906/5/diagnostics.mjs` | Exit0; all7 changed TS files, zero syntactic/semantic diagnostics. All8 source/test/script paths also returned no diagnostics through the LSP tool. Both ran before typecheck/build. |
| `syntax`: `node --check scripts/lib/runtimeQaRun.mjs` | Exit0. |
| `typecheck`: `npm run typecheck:app` | Exit0. |
| `build`: `npm run build` | Exit0; app tsc/app Vite/export player+SDK/standalone all complete. |
| `wiki-index`: `npm run openwiki:index` | Exit0; generated index. |
| `wiki-check`: `npm run openwiki:index -- --check` | Exit0. |
| `wiki-verify`: `npm run openwiki:verify` | Exit0; no failures. |
| `diff-check`: `git diff --check`; subsequent `git diff --cached --check` | Both exit0. |
| `git diff --exit-code b7b02d97 -- WISH.md package.json package-lock.json .omo/gates-baseline.json test/fixtures/life-full/coverage.json` | Exit0; protected inputs unchanged. |

The two related-suite errors are exactly `TypeError: Cannot read properties of undefined (reading 'registry')`, from `syncCutsceneHudVisibility` called by `captureScene` at actionDebounceFootprint.test.ts:139; cases at145 and158. Pre-product stack was playSceneMapRuntime.ts:655, final stack657 because the new snapshot fields added two lines. No assertions in existing tests were removed, changed, skipped or filtered. Fixing those unrelated baseline fixtures is outside this scoped increment. Full `npm run gates` was not run; no full-gates-green claim is made.

Build output retains existing circular record-picker chunk, mixed static/dynamic import, runtime-resolved asset URL, and chunk-size warnings, also documented in predecessor verification. No warning suppression or unrelated fixes.

## Public-module evidence (not player gameplay)

`public-probe.mjs` imports the actual snapshot builder, exported-player store shim, real handleAction, real scene sync, real debug hook installer and real Save5 writer using Vite SSR. It uses happy-dom only for the DOM host and no farming/snapshot/action mocks. The fixture has one hoe, one starting energy, a bounded farm rectangle, no authored event, and no time system.

`instrumentation.json` proves acceptance sequence1 tills2,3/energy1->0; prearmed rejection sequence2 reports insufficient-energy at3,2 then2,2 and preserves the **whole** session. At event delivery, public readState and DOM mirror agree with the receipt and real plots. Mutating the detached builder result cannot alter live plots. SaveSnapshot/session have no actionReceipt. Shutdown removes installed read/input hooks. An off overlay emits no event or mirror even when the actual dispatcher and sync execute. Node exited0 and closed Storage, happy-dom, SSR server and restored temporary globals in finally.

The new Vitest cases additionally populate maker/animal/building/recovery owners, assert their exact detached values and absent future fields, preserve a past-due processing maker unchanged, and show no claim collection on reading.

## Actual shipped-player/browser evidence

1. `browser-proof.mjs`: **Chromium149.0.7827.55**, headless, **1280x960**, dedicated `startPlayerQaServer` / `vite.player-qa.config.ts`, **http://127.0.0.1:43201/player.html** from this worktree. Not editor play. Boot uses the shipped exportProjectStoreShim path. Local route project title `Life QA observability fixture`, start map `map_blank_start`, position2,2. Fixture path `5/project.json`, SHA256 `f995e7c27d284593e5fb0101954872405b9eb7b68ffd5f5fd8e55b8181b4bbfc`; generated from the checked-in minimal contract fixture with actual project defaults, not a remote demo.
   - **Off context:** Enter starts new game; prearmed exact DOM signal then Escape opens the real player menu. Observed globals[], mirrors0, markers0. No debug state used to establish off readiness.
   - **On context:** Enter starts new game. Before each real `page.keyboard.press('z')`, `performObservedAction` subscribes on that scene host. First receipt sequence1: tilled2,3, energySpent1, state energy0. Second sequence2: handledfalse, facing missing-seed, underfoot insufficient-energy. Public state excluding the receipt is deep-equal before/after rejection, including inventory and every RNG stream. Mirror receipt equals public receipt synchronously. Observer attempts to modify returned plot/receipt leave live reads unchanged.
   - `browser.json` stores both full action observations, actual URL/port/browser/actions, zero page errors/failed requests, and closure receipt. `player-off.png` and `player-on.png` are captured artifacts. The image tool reported this model cannot inspect images, so **visual quality is not adjudicated**; the DOM/state assertions above are actually executed browser evidence, not a screenshot-based visual verdict.
2. `harness-proof.mjs`: same Chromium version, dedicated **http://127.0.0.1:43429/player.html**, runtime runner default **1024x768**. Calls real `runRuntimeQa` with Enter then two `{kind:'action',observe:true}` ops; these use the existing real Input edge, not direct farming module calls. `5/runtime/SUMMARY.md` and `manifest.json` report2/2 beats and0 errors; independent assertions verify actual manifest energy/plots/sequence/rejection. `01-till.png` and `02-reject.png` remain visual-review-pending. No result items, ready makers, recovery receipts or successful states were injected.

No sleeps/polling or fixed frame-count settling was authored for these actions. Bounded setTimeout calls are failure deadlines, not success delays. No remote project was created/read/written, and the existing Stardew demo was untouched.

## Cleanup and boundaries

`cleanup.json` records actual exit0 cleanup: build-created untracked `dist` and task-created browser cache removed only after non-symlink/untracked checks; module-cache absent. Sockets43201/43429 refused connections after browser/server shutdown. Each public/browser probe closes its own resources in finally. Shared node_modules and pre-existing caches were left intact. A preliminary no-file SSR fixture-diagnosis command omitted the isolated-cache option and logged dependency re-optimization; no cross-worktree failure was observed, and no shared cache was deleted to conceal it. Subsequent probes explicitly isolated/disabled optimization.

Entry and all validator receipts name b7b02d97 because changes were deliberately uncommitted during validation. The verified product tree above binds the final code; evidence-bearing commit SHA/tree is obtained after the atomic commit. No push, PR, merge, dependency install, WISH edit, VERIFY edit or root task-state edit. All51 coverage rows remain `not-run` (asserted count51/status in cleanup). Evidence and screenshots are deliberately retained. This task stops at its scoped atomic commit; independent review and later full life journeys remain unclaimed.
