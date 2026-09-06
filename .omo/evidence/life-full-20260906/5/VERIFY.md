# Task5 independent Q1 re-verification

## Verdict: confirmed

Acceptance verdict: **0 (confirmed)**. Mandatory task5 blockers: **0**.

- Actual reviewed commit / HEAD: `f86474547028cddf795c8e431b2195b7edccd201`.
- Actual reviewed HEAD tree: `8386dd1efe4338f705d6a7accdbdefaa3b0beb6a`.
- Commit subject: `fix(audio): gate QA observation by player capability`.
- Worktree / branch: `/home/main/z-project/rpg-zzu-life-full-p2`, `agent/life-full-p2`.
- Verifier: `st_01a074b3`; parent/root: `01a0727b-398a-7481-b557-b198013542c1`; date: 2026-09-06.
- Original task5 implementation: `4e2d1762264533a5826c48686648093c3fe69ebd`, tree `234c0e9c391276f082efb61e2abff2e0a8d7e634`.
- B1/B2/B3 correction: `62c70a3093f6a891f209cc9c3d02a6140dccffed`, tree `e6fb5e9a92ad4c570420e4755880d78d532c7d68`.
- Confirmed task4 ancestor: `b7b02d97ad6cb3b493bd60691ec61970e8a0e37e`, tree `63ea1d26f87d4a82d9ff925071582abdae01b354`; its correction ancestor is `596eab9a865257197e67992cc0eec4e45239ad34`.

**Q1 is resolved at the actual reviewed commit.** Both explicitly QA-only audio globals are absent with the capability omitted and false, present/correct with true, and revoked by real shell teardown. Actual native BGM playback works in all three modes. Fresh real keyboard actions still produce accepted/rejected scene-local receipts, and actual imported snapshot/renderer/save authorities satisfy task5's read-only and non-persistence contracts. This confirms task5, not full Phase2 gates, later life features, editor Escape behavior, shipping, or the full51 journeys.

HEAD did not move during this verification. Entry was **not clean**: the producer had staged SUMMARY plus13 editor-followup artifacts. All product/test/script files equal HEAD; the follow-up is evidence-only and is explicitly reviewed as staged evidence at this HEAD, not falsely represented as committed. No staging, commit or product edit was performed here. The staged follow-up and supervisor artifacts remain preserved.

## Predecessor, scope and inspection

Read `4/VERIFY.md` first, then the complete `5/SUMMARY.md`, including newest Q1 correction and the editor follow-up. Upstream is confirmed with acceptance0/blockers0; `git merge-base --is-ancestor b7b02d97 HEAD` exited0. Its VERIFY SHA256 remained `766f31c0a0a11033e31d20c57303f8cfa951450af20088ad0694af2c3b68b494`. Real implementation exists, so the fail-fast absent/blocked-implementation condition did not apply.

Read the complete approved plan, including every Scope contract and assigned task5, AGENTS, quickstart, PROJECT_WIKI, focused INDEX/runtime routing/session/testing guidance and available systematic-debugging skill. All CLAUDE.md were ignored. The user-specific no-remote-write and ONLY VERIFY restrictions govern this verification.

Reviewed every task5 changed source/test/script/wiki diff against b7b02d97, and traced the actual called owners:

- Production: `src/player/runtimeDom.ts`, `playSceneMovement.ts`, `playSceneMapRuntime.ts`, `playSceneTestHooks.ts`, `player.ts`, `audio/audioEngine.ts`, `audio/index.ts`, and `src/testing/sceneTestRunner.ts`.
- Harness: `scripts/lib/runtimeQaRun.mjs`.
- Tests: `test/lifeQaObservability.test.ts`, `fixtures/life-full/qaObservability.ts`, `debugSession.test.ts`, `audioQaInstrumentation.test.ts`, `playerAudioQaLifecycle.test.ts`, `audioEnginePlaybackControls.test.ts`, `playBootRecovery.test.ts`, `playerKeydownSessionGuard.test.ts`, `playerOpenSaveMenu.test.ts`, `playerRunControls.test.ts`, `e2e/oprn-audio-test-dialog.spec.ts`.
- Wiki: `openwiki/runtime-sessions.md`, `testing.md`, generated `INDEX.md`.
- Additional ownership inspection: exportEntry -> renderPlayer -> createPlayGame registry -> PlayScene per-scene overlay/hooks; actual audio queue/unlock/play/stop/fade/public-state lifecycle; snapshot sync's off-path early return; save writer and failing actionDebounce fixture; producer public/browser programs and raw receipts.

All181 original assertion lines across the seven changed existing test files compare byte-equal after per-line strip. The new editor helper explicitly enables the real imported singleton; it does not fabricate state or weaken slider assertions. The four shell tests add only the needed mock member; the new shell lifecycle tests retain real player/audio/singleton/export-store modules. Their Phaser boot mock is not used as evidence for native audio or actual player gameplay: those were independently exercised below.

The original gameplay dispatcher ordering and return semantics remain intact. `handled` is synchronous input consumption, not asynchronous event/chest completion. Farming outcomes are returned by the actual authority, not inferred from changed state. No new framework, optional future types, save schema change, paid claim, clock progression or housing implementation is credited to task5.

## Fresh actual player surface: omitted / false / true

A separately written **no-file** Playwright stdin program imported this worktree's actual `startPlayerQaServer` and `performObservedAction`. One execution, under the required lock, with no timing retry:

- Surface: **http://127.0.0.1:37775/player.html**.
- Server: this worktree's `vite.player-qa.config.ts`, exported-player store shim; not editor play.
- Browser: Chromium **149.0.7827.55**, headless, `--no-sandbox --use-gl=swiftshader --disable-gpu`, viewport1280x960.
- Fixture: existing `5/project.json`, title `Life QA observability fixture`; SHA256 independently asserted as `f995e7c27d284593e5fb0101954872405b9eb7b68ffd5f5fd8e55b8181b4bbfc`.
- Only routed response: local `/__verify/project.json`; namespace `st_01a074b3`. No remote content/write and no runtime success-state injection.
- DOM listeners were installed before Enter/Escape. Scene readiness requires actual canvas plus loading-overlay removal; title/readiness failure deadline120000ms. Native media listeners were installed in init before engine construction. Before each actual keyboard z, the existing exact scene-host listener was installed with its10000ms bounded failure timeout. No fixed sleep, polling loop, frame-count settling or cache-prewarm command.

### Off is genuinely off, including both Q1 owners

Omitted and false each reached a real running scene through Enter, then Escape opened the real visible menu. Both yielded:

```json
{
  "globals": [],
  "allOprn": ["__oprnJuiceLog", "__oprnPlayBootLog", "__oprnRuntimeJuice"],
  "mirrors": 0,
  "markers": 0
}
```

The explicit own-property check covers all prior debug/input/camera/sprite/action/perf/emote hooks **plus** actor/media hooks **and both `__oprnAudioState` and `__oprnAudioObserved`**. An independent broad own-prefix collection is asserted to equal exactly the three legitimate production diagnostic/juice owners above; this is not the previous weak fixed allowlist. Both audio names are also checked with `Object.hasOwn` after actual native playback and public audio API import: both false, in both modes.

This preserves the production boot/juice owners rather than demanding indiscriminate prefix deletion. Their source files are byte-unchanged from the confirmed predecessor.

### True observes actual actions and actual audio

First real z tills2,3, receipt1, energy1->0. Second real z rejects, receipt2, handledfalse, with facing `missing-seed` then underfoot `insufficient-energy`. Actual receipts:

```json
{
  "first": {"kind":"action","mapId":"map_blank_start","handled":true,"farmAttempts":[{"kind":"tilled","x":2,"y":3,"itemId":"qa-hoe","energySpent":1,"xpAwarded":{},"affectedTiles":[{"x":2,"y":3,"kind":"tilled"}]}],"sequence":1},
  "second": {"kind":"action","mapId":"map_blank_start","handled":false,"farmAttempts":[{"kind":"ignored","x":2,"y":3,"reason":"missing-seed"},{"kind":"ignored","x":2,"y":2,"reason":"insufficient-energy"}],"sequence":2}
}
```

The whole public state excluding actionReceipt is deep-equal after rejection, including RNG/inventory/plots. Both synchronized mirror receipts equal their action receipts. Mutating a detached read's plot/sequence leaves fresh live reads unchanged. No absent recovery owner or future regrowDaysRemaining is synthesized.

True publishes both audio owners. QA state equals the actual imported public `audioStateSnapshot()`:

```json
{"volume":{"bgm":0.7,"se":0.8},"playbackRate":1,"pan":0,"fadeInMs":600}
```

The real observed request list contains `cc0-bgm-rtp-fld-003`. No audio method or media property was stubbed in this browser run.

### Normal audio and shell lifecycle

All three modes emitted the native `playing` event for `rtp-fld-003-amber-meadow-end-final_f5dafd12.mp3`, with looptrue, pausedfalse, readyState4, playbackRate1 and media errornull. This proves real browser decode/playback, not physical speaker audibility. The resource request array alone is not claimed as playback proof.

Real imported `teardownPlayer()` followed by ordinary `stopAllAudio()` leaves both audio globals absent and zero managed audio DOM elements in every context. Fresh engine/shell regression tests additionally prove:

- Default/false construction, queued play, unlock, normal controls and stop remain functional without observation.
- Revocation alone does not pause an existing track; subsequent off requests do not append to the old resource array.
- Repeated enable retains the same evidence, disable/enable creates a fresh array, and revocation deletes only identical publications it owns.
- True -> omitted/false shell replacement keeps the same audio singleton/public control state and removes QA publication; teardown and later true shell opt-in work.

All three navigations returned200. Page, console, HTTP and request errors were empty at the asserted pre-teardown boundary. **Final retained request arrays contain one BGM `net::ERR_ABORTED` after teardown/context close for omitted and false; true has none.** They were not erased or represented as zero final request failures. No native media error event occurred.

Measured milestones (not success delays): omitted title8242ms/scene15125ms/menu15735ms; false title5222ms/scene12658ms/menu13041ms; true title4288ms/scene9729ms/actions10368ms. Program exit0. Every context, browser and server was awaited closed in finally; fresh TCP37775 returned ECONNREFUSED111.

## Fresh independently imported state/action/save authorities

A second no-file Node/Vite SSR program imported the real builder, overlay, dispatcher, renderer sync, debug hook installer, session/fixture/export store and Save5 writer. happy-dom provided host/Storage only; no farming, builder, receipt, structuredClone or save authority was mocked.

- Six populated life owners are detached/deep-equal: farmPlots, energy, makerInstances, farmAnimals, farmBuildingPlacements, lifeRecovery. Mutation of each copied mutable owner leaves the whole live session unchanged.
- A past-due processing maker with a removed definition remains processing; recovery items are not paid. Actual renderer sync and public hook reads preserve the **whole** populated session.
- Empty input produces `{}`. Absent `regrowDaysRemaining` and `housingPlacementId` remain absent. Static test fixtures establish observation purity, not a fabricated gameplay success.
- Exact pre-action host subscription observes actual handleAction acceptance1 then rejection2. Rejection reports two insufficient-energy results after facing right and preserves the whole session.
- Event/mirror/public hook agree. Mutating an emitted receipt does not mutate the overlay's stored receipt.
- A separate scene/host starts receipt-free, then its real action produces receipt1. The first host gets zero cross-host events and retains receipt2. This is real module-level scene isolation, not an unexecuted browser scene-replacement claim.
- Real `createSaveSnapshot` returns schemaVersion5 with no actionReceipt; PlaySession also has no actionReceipt. Counter ownership is private to RuntimeDomOverlay, not saved/global. Recovery's separately specified persistent nextSequence is unchanged.
- Shutdown removes debug/input hooks. Off overlay plus actual dispatch/sync emits zero action events, retains no receipt and creates no mirror.

Actual output, **exit0**:

```json
{"builderOwners":6,"readRenderPure":true,"absentFutureFields":true,"actualSequences":[1,2,1],"crossHostEvents":0,"wholeRejectedSessionUnchanged":true,"saveSchema":5,"saveCounter":false,"overlayOff":{"events":0,"receipt":null,"mirror":null},"scope":"actual imported authorities, no fabricated receipts"}
```

SSR used configFilefalse, task-specific cache, exact store alias to exportProjectStoreShim, normal @->src, optimizeDeps noDiscovery/include[], middleware mode, appTypecustom. Finally cleared Storage, closed happy-dom/Vite and restored globals. No producer probe was executed in place because its filesystem writes would overwrite producer evidence.

## Fresh commands and real exits

All commands ran in the named worktree at the unchanged exact HEAD/tree above. **Every heavyweight execution was serial and prefixed with**:

```sh
flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock
```

No test command was repeated for timing luck. Shell wrappers captured and printed the actual exit; Python command wrappers used subprocess.returncode, retaining the first failure rather than substituting the last command or a pipe's status.

Required command:

```sh
flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock npm test -- test/lifeQaObservability.test.ts
```

**Exit0;1 file/7 passed/0 failed/0 skipped.** Start12:13:06, duration10.56s, Vitest3.2.4.

Focused affected command, including all original task5 related files and actual audio/lifecycle regressions:

```sh
flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock npm test -- test/audioQaInstrumentation.test.ts test/playerAudioQaLifecycle.test.ts test/audioEnginePlaybackControls.test.ts test/audioEngine.test.ts test/cc0AudioPlayback.test.ts test/battleAudio.test.ts test/runtimeAudioIndicator.test.ts test/playerRuntimeAudioIds.test.ts test/playAudioCommandBody.test.ts test/runtimeJuice.test.ts test/playBootDiagnostics.test.ts test/playBootRecovery.test.ts test/playerRunControls.test.ts test/playerKeydownSessionGuard.test.ts test/playerOpenSaveMenu.test.ts test/runtimeQaInstrumentationBoundary.test.ts test/runtimeQaReport.test.ts test/runtimeQaGate.test.ts test/sceneTestRunner.test.ts test/debugSession.test.ts test/runtimeDebugPanel.test.ts test/playSceneFarmFeedback.test.ts test/npcActionFacing.test.ts test/runtimeMovementStability.test.ts test/actionDebounceFootprint.test.ts test/lifeSaveVersion.test.ts test/lifeRecoveryPersistence.test.ts test/p0SessionPersistence.test.ts test/p2SpatialPersistence.test.ts test/autosave.test.ts
```

**Exit1;29 files passed/1 failed;337 passed/2 failed/0 skipped.** Start12:13:45, duration19.75s. All audio/lifecycle, required boundary, debugSession4, save-version18, recovery-persistence40 and autosave16 cases passed. The two preserved unrelated fixture failures are still failures, not a green related suite:

```text
FAIL test/actionDebounceFootprint.test.ts:145 and :158
TypeError: Cannot read properties of undefined (reading 'registry')
  syncCutsceneHudVisibility src/player/playSceneMapRuntime.ts:657:27
  syncRuntimeState src/player/playSceneMapRuntime.ts:563:3
  captureScene test/actionDebounceFootprint.test.ts:139:5
```

Read the fixture: its mock scene omits game.registry. The pre-product characterization already records these same failures at old source line655; unchanged test and unchanged registry access confirm that these are not task5 regressions. No test deletion, skip, baseline update or unrelated fix was made.

| Exact command after the lock prefix | Actual result |
| --- | --- |
| `node --input-type=module` (independent TypeScript-language-service stdin validator) | Exit0; all19 changed TS files, zero syntactic/semantic diagnostics, before build. Files derived from actual `git diff --name-only b7b02d97 HEAD -- src test`; full file-by-file output in verifier execution record. |
| `npm run build` | Exit0; app tsc/Vite, exported player/SDK and standalone completed. SDK Project schema4 retained. |
| `env VITE_CACHE_DIR=.omo/evidence/life-full-20260906/5/verify-st_01a074b3-browser-cache node --input-type=module` (independent player stdin program) | Exit0; omitted/false/true, actual37775 surface and native playback/actions above. |
| `node --input-type=module` (independent public-module stdin program) | Exit0; actual builder/read/render/dispatch/scene isolation/Save5 assertions above. |
| `npm run typecheck:app` | Exit0; separately executed actual app tsc, not just inferred from build. |
| `npm run openwiki:index -- --check` | Exit0; final evidence-inclusive tracked set is current. No generation/staging here. |
| `npm run openwiki:verify` | Exit0; failures[]. |

The full stdin program bodies and outputs are retained in this verifier's tool execution record; no extra repository script/log was authored under the ONLY VERIFY restriction. The browser program independently constructs its listeners/assertions rather than importing producer success results. The TypeScript validator uses the actual repository tsconfig and real language service, not status labels or a diagnostic baseline.

Additional lightweight commands, actual exit0 each: `node --check scripts/lib/runtimeQaRun.mjs`; `git diff --check`; `git diff --cached --check`; `git merge-base --is-ancestor b7b02d97 HEAD`; `git diff --exit-code HEAD -- src test scripts`; Python receipt/hash/assertion/trace audit; Python guarded cleanup.

Protected-input command, exit0:

```sh
git diff --exit-code b7b02d97 HEAD -- WISH.md package.json package-lock.json .omo/gates-baseline.json test/fixtures/life-full/coverage.json src/project/session.ts src/player/saveSlots.ts test/actionDebounceFootprint.test.ts src/player/runtimeJuice.ts src/player/playBootDiagnostics.ts
```

Build warnings were retained: circular record-picker chunks, mixed static/dynamic imports, runtime-resolved asset URLs and large chunks. The same warning classes are present in historical build output. No warnings/types/tests were suppressed. Full gates were not rerun or claimed green; parent task28's unresolved full-suite timing/order cases are not silently waived by task5 confirmation.

## Producer evidence and RED chronology audit

Independently parsed47 raw command receipts from original/correction/q1, verified every output SHA256 and every matching readable text log using the producer's documented per-line trailing-whitespace/EOF normalization. Read the actual RED assertion output, diagnostics, typecheck/build exit and cleanup observations, not just filenames or SUMMARY labels.

- Original characterization: exit1,7 passes/3 failures. Wrong rectangle fixture plus the two old registry failures; not accepted as behavioral RED.
- Pre-product baseline: exit0,5 passes. Actual till/energy/rejection characterized before observability edits.
- Original accepted RED at10:15:38: exit1,4 failed/3 passed. Missing real builder(two), bounded missing action receipt, missing runner energy. Initial diagnostic TS2322 (missing animal name) remains in raw history; final fixture supplies name without weakening assertions.
- Original required GREEN: exit0,7 passes. Original related exit1,249/2; setup correction before/after related remain exit1,249/2. Neither is relabeled full-suite green.
- Q1 accepted engine RED at11:43:00: exit1,4 failed/12 passed. Real default/false engines expose state immediately and both owners after queued play/unlock. True and all11 original control tests pass. Other two failures are absent capability method. This is the exact Q1 regression, not an import/fixture error.
- Q1 shell RED at11:44:06: exit1,3 failed. All stop at initial enabled-publication assertions; they do not independently prove a later teardown failure. The actual engine off RED is decisive.
- Q1 final focused GREEN: exit0,26 passes; related exit1,318 passes/2 old registry failures. Fresh current7 and337/2 runs corroborate the delivered code without retry.
- Q1 diagnostics11files/0, actual typecheck and complete build all exit0. Browser44517 records actual omitted/false/true/native audio, cleanup refusal/removal and post-teardown BGM aborts. These historical producer results are not substituted for fresh37775 evidence.
- Receipts name parent commits because edits were uncommitted during execution; no separate RED commit exists. Hash-valid historical logs plus inspected committed code and fresh current executions establish chronology and current correctness, not a fabricated witnessed pre-edit run.

### Existing editor follow-up: failed full spec, affected helper verified

Read staged `q1/editor-followup/execution.json`, actual report, raw-artifacts and original trace ZIP. Exact recorded command at the same f8647454 commit/tree:

```sh
flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock env DEV_SERVER_PORT=41331 DEV_SERVER_NO_TLS=1 E2E_FREEZE_DEV_SERVER=1 E2E_RETRIES=0 node .omo/evidence/life-full-20260906/5/q1/editor-followup/run.mjs
# child:
npm run test:e2e -- --config .omo/evidence/life-full-20260906/5/q1/editor-followup/playwright.config.ts test/e2e/oprn-audio-test-dialog.spec.ts --project=chromium --workers=1 --retries=0
```

**Historical producer exit1:3 passed/1 failed/0 skipped/0 flaky. Not freshly rerun here.** Real layout/play/stop/close, real slider/public-state/media propagation, and filtering pass. This exercises the changed import/opt-in helper through the editor's actual singleton, including before-state volume1/rate1/pan0 and after0.4/1.35/-0.4/fade4000 with matching media volume/rate.

The unchanged Escape case fails at line41 waiting for edit-canvas60000ms, **before the added helper at44 or Escape input**. Independently opened and hash-validated original trace ZIP `673337fae0fd4aaf61410ae6de7ad8d00585b8f7d0a37fc9d1451b990a1b1f6e`:202 ERR_NETWORK_CHANGED records (101 console +101 network), zero runtime evaluate calls. Actual failed report is63272ms. No exact host-interface cause or resolved Escape behavior is claimed. Fresh socket41331 refuses; producer owner/server/cache cleanup is recorded. No rerun, timeout increase, network bypass, test exclusion or baseline update hid the failure.

This is not an outstanding mandatory task5 deliverable: the changed audio helper and task5/Q1 player/audio boundaries have direct evidence; unrelated editor Escape behavior was not changed and remains explicitly unverified by that failed case. Confirmation does not assert that the full editor spec or later task18 is green.

## Previous verdict disposition and scope limits

Prior st_01a07484 VERIFY at62c70a30/treee6fb5e9a was correctly needs-fix for Q1; its last-file SHA256 before replacement was `814beb568df4613d4d6617b89a732ada2dd6109ef1d092dc63c29905d793b881`. It had already confirmed old B1/B2/B3 resolved. This re-verification does not redo completed implementation:

- B1: current real scenes boot and actions execute. The earlier missing-title cause remains unproven; current success is not a invented historical root cause.
- B2: static collection imports and synchronous operations retain all17 debugSession assertions; fresh4/4 pass without retries. No claim of reducing the production import graph.
- B3: fresh evidence-inclusive INDEX check exits0.
- Q1: actual audio capability/lifecycle correction and fresh expanded off/on/native audio proof now resolve the exact sole blocker.

Save5 namespace/version/original-retention policy and Project4 remain unchanged; the related save regressions and actual writer assertion pass. No full51 feature, future regrowth/linked housing/clock integration, remote authored-content or final shipping claim. No new screenshot was written under ONLY VERIFY; existing screenshots remain preserved. Visual-quality adjudication and physical speaker audibility are not claimed. Task5 acceptance is based on executed DOM/native-media/state/action observations, not screenshot inference.

## Cleanup and preservation

All verifier test, diagnostic, build and probe processes completed. Module/browser finally cleanup ran; a fresh single TCP check returned ECONNREFUSED111 for our37775 and existing producer/supervisor41331,44517,33943. No polling for teardown or process killing was used.

Guarded cleanup (exit0) asserted non-symlink directories with no tracked files before removing exactly:

- `dist`, absent at entry and created by the fresh build.
- `.omo/evidence/life-full-20260906/5/verify-st_01a074b3-browser-cache`.

The verifier module-cache was already absent. Shared node_modules, pre-existing caches, lock file and all producer/supervisor output remain.1121 tracked evidence files, including the producer's staged follow-up, equal their preserved index blobs. The five supervisor file hashes independently match the producer final-check receipt. SUMMARY hash remains `a72708e1ced44373ff0bc7ef7cd07486eb0db757455793830bc4e4f5fb076c95`; predecessor VERIFY hash remains unchanged.

Only this `5/VERIFY.md` is deliberately written, with an exact unified diff passed to the inspected `/tmp/apply_patch` wrapper (`patch -p1 --forward`). No product/test/wiki edits, test deletion/weakening/skip, dependency installation, remote write, commit, push, PR or merge. The initial broad discovery ended exit1 because apply_patch was not on PATH; a later source search named nonexistent src/player-main.ts, then actual exportEntry was read. Neither was a behavioral test failure or a timing retry.

**Final decision: confirmed(0), mandatory task5 blockers0 at f86474547028cddf795c8e431b2195b7edccd201 / tree8386dd1efe4338f705d6a7accdbdefaa3b0beb6a.** Q1 is resolved; known unrelated test failures and unexecuted later-task obligations remain honestly separate from this scoped acceptance.
