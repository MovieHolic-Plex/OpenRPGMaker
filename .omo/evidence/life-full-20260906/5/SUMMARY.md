# Task5 Q1 correction - gate real audio QA owners

## Outcome and revision binding (st_01a07495)

Q1 is corrected: the actual exported player with `qaInstrumentation` omitted or false publishes neither `__oprnAudioState` nor `__oprnAudioObserved`; true retains detached state and resource-request observation. Normal playback and the public internal audio APIs remain operational. The prior B1/B2/B3 correction and tasks2/3/4 were not redone. This is a correction claim with executed evidence, not independent acceptance or completion of the full life-system plan.

- Worktree/branch: `/home/main/z-project/rpg-zzu-life-full-p2`, `agent/life-full-p2`.
- Entry/reviewed commit: `62c70a3093f6a891f209cc9c3d02a6140dccffed`; tree `e6fb5e9a92ad4c570420e4755880d78d532c7d68`.
- Verified product/test/wiki tree before adding correction evidence: `be75ff0fc01771669cb8b07da9f4d4d29fceb238`, actual `git write-tree` exit0. `q1/verified-files.json` binds every changed source/test/wiki file by SHA256. Product/test/wiki content was not changed after these validators.
- Delivery is one new commit, subject `fix(audio): gate QA observation by player capability`. Its exact final SHA/tree is printed by the post-commit check and can be obtained with `git log -1 --format='%H %T' -- .omo/evidence/life-full-20260906/5/SUMMARY.md`. The self-containing final commit hash is not fabricated in this file.
- Parent/root: `01a0727b-398a-7481-b557-b198013542c1`. Evidence root: `.omo/evidence/life-full-20260906/5/q1/`; paths below are relative to it unless stated otherwise.

Read full current `5/VERIFY.md` first, full approved Scope/task5, AGENTS, quickstart, PROJECT_WIKI, focused INDEX/runtime/testing pages and programming/TypeScript/debugging skills. Full predecessor `4/VERIFY.md` confirms b7b02d97/acceptance0/blockers0; `git merge-base --is-ancestor b7b02d97 HEAD` exited0. All CLAUDE.md were ignored. Current VERIFY remains unchanged and still contains the independent needs-fix finding at the prior revision; this producer summary does not overwrite that review.

## Smallest ownership correction

Only three production files change:

1. `audio/audioEngine.ts`: default constructor capability is off. An explicit true capability installs an engine-owned function/array; `play()` records requests only while that observation owner exists. Revocation deletes only identical owned publications and drops recording, without stopping playback, resetting controls or changing `audioStateSnapshot()`. Repeated enable does not erase evidence; disable then enable starts a fresh array. The removed unguarded helper is replaced by this capability-controlled publication, not blanket global deletion.
2. `audio/index.ts`: existing singleton construction accepts the explicit capability, and explicit subsequent configuration updates that same engine. Ordinary no-argument consumers retain the current capability and all existing play/stop/resume/public-state call contracts.
3. `player.ts`: the existing shell configures that singleton before any title audio and revokes observation on shell teardown/replacement. Scene creation alone would be too late. Stop-all, map changes and returning to title do not end the shell's observation lifetime. No speculative multi-player framework, new audio engine, per-scene owner, dependency or save state is introduced.

`playBootDiagnostics.ts` and `runtimeJuice.ts` are byte-unchanged. Normal boot still exposes their legitimate three observed globals. The public engine controls, queue/unlock, looping/one-shot, fades, pan, volume and stop paths are preserved. The resource list proves request dispatch (including queued requests), not audible sound.

Two focused tests add real-engine and real-shell lifecycle coverage. The existing audio controls test explicitly opts in only for its QA-hook case; all 34 original assertion lines remain. The editor audio-dialog browser test explicitly opts in before using its QA hook, preserving all 54 assertions. Four shell tests receive only the newly required audio mock member; their existing 76 assertion lines remain. Those mocks are not used as evidence for audio integration: the new shell test keeps real player/audio/singleton/export-store modules. `audio.json` records the byte-equal assertion audit (164 lines across six changed existing tests).

## RED first, then a single final GREEN

`run.mjs` records exact argv/cwd/parent HEAD/tree, timestamps, real child status/signal, stdout+stderr, output SHA256 and tracked-diff SHA256. The tests were initially untracked; that diff hash is **not** represented as a hash of their source. Actual failure output, final committed assertions, and the explicitly described cleanup-only change bind the regression. There was no separate RED commit.

- **Accepted Q1 RED**, before any production edit: `red.json`/`.txt`, 11:43:00, exit1, 4 failed/12 passed across the new five engine cases and all eleven original audio controls cases. Real `new AudioEngine()` and `new AudioEngine({qaInstrumentation:false})` each expose the state hook at construction and both globals after an actual queued play/unlock. All playback/public-state assertions in those off cases still ran via soft absence assertions. The true case and all original controls cases pass. Two new lifecycle cases also fail because the capability method does not exist. This reproduces Q1, not an import/fixture error.
- `lifecycle-red.json`/`.txt`, 11:44:06, exit1, three failures before production edit. The pre-fix singleton does not publish the requested enabled function/array pair reliably across shell lifetimes; these cases stop at their initial publication assertion, so they are not misreported as independently reaching teardown failure. The exact off-global RED above is the decisive regression.
- Product correction then applied. New engine-test teardown was strengthened to revoke its owned observation as well as stop audio; no assertion was removed or changed.
- **First and only final focused run:** `green.json`/`.txt`, 11:47:37, exit0, 26 passed/0 failed/0 skipped: new engine5, real shell3, unchanged controls11, prior life observability7. No timing retries, sleeps, polling, raised timeout or cache prewarm.

All heavy executions below were serial and used `flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock`. The wrapper itself was invoked as `node .omo/evidence/life-full-20260906/5/q1/run.mjs <label> <exact command below>`.

```sh
# red -> exit1, 4 failed/12 passed
flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock npm test -- test/audioQaInstrumentation.test.ts test/audioEnginePlaybackControls.test.ts
# lifecycle-red -> exit1, 3 failed
flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock npm test -- test/playerAudioQaLifecycle.test.ts
# green -> exit0, 26 passed
flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock npm test -- test/audioQaInstrumentation.test.ts test/playerAudioQaLifecycle.test.ts test/audioEnginePlaybackControls.test.ts test/lifeQaObservability.test.ts
# related -> exit1, 318 passed/2 pre-existing failures; no skips
flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock npm test -- test/audioEngine.test.ts test/cc0AudioPlayback.test.ts test/battleAudio.test.ts test/runtimeAudioIndicator.test.ts test/playerRuntimeAudioIds.test.ts test/playAudioCommandBody.test.ts test/runtimeJuice.test.ts test/playBootDiagnostics.test.ts test/playBootRecovery.test.ts test/playerRunControls.test.ts test/playerKeydownSessionGuard.test.ts test/playerOpenSaveMenu.test.ts test/runtimeQaInstrumentationBoundary.test.ts test/runtimeQaReport.test.ts test/runtimeQaGate.test.ts test/sceneTestRunner.test.ts test/debugSession.test.ts test/runtimeDebugPanel.test.ts test/playSceneFarmFeedback.test.ts test/npcActionFacing.test.ts test/runtimeMovementStability.test.ts test/actionDebounceFootprint.test.ts test/lifeSaveVersion.test.ts test/lifeRecoveryPersistence.test.ts test/p0SessionPersistence.test.ts test/p2SpatialPersistence.test.ts test/autosave.test.ts
```

The related run at11:48:05 is **not green**. Its only two failures are the preserved `actionDebounceFootprint.test.ts:145,158` fixtures: `TypeError: Cannot read properties of undefined (reading 'registry')`, `syncCutsceneHudVisibility` at `playSceneMapRuntime.ts:657:27`, via `syncRuntimeState:563` and `captureScene:139`. These are the exact independently documented prior errors. Their test/source and the baseline were not modified, excluded, weakened or skipped. All related audio, task5, shell and save cases otherwise pass. Full gates and task28 unresolved timing/order findings were not rerun or relabeled resolved.

| Label / exact command after wrapper | Actual result |
| --- | --- |
| diagnostics: `flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock node .omo/evidence/life-full-20260906/5/q1/diagnostics.mjs` | Exit0; real TS language service, all11 changed TS files, zero syntactic/semantic diagnostics, **before typecheck/build**. |
| typecheck: `flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock npm run typecheck:app` | Exit0. |
| build: `flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock npm run build` | Exit0; app tsc/Vite, exported player/SDK and standalone completed. Existing circular record-picker, mixed-import, asset-resolution and large-chunk warnings retained. |
| browser-execution: `flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock env VITE_CACHE_DIR=.omo/evidence/life-full-20260906/5/q1/browser-cache node .omo/evidence/life-full-20260906/5/q1/browser-proof.mjs` | Exit0; one actual omitted/false/true run, after build, no overlap or retry. |
| cleanup-execution: `node .omo/evidence/life-full-20260906/5/q1/cleanup.mjs` | Exit0; real ownership/hash/port/removal checks, `cleanup.json`. |
| audio-audit: `node .omo/evidence/life-full-20260906/5/q1/audit.mjs` | Exit0; original assertions, raw receipt hashes/log normalization, actual audio observations and protected-input diff, `audio.json`. |
| final-syntax: `bash -c 'for file in .omo/evidence/life-full-20260906/5/q1/*.mjs; do node --check "$file" || exit $?; done'` | Exit0; all authored correction programs. |

## Actual player and audio evidence

Dedicated `startPlayerQaServer`, `vite.player-qa.config.ts`, actual exported-store shim, **http://127.0.0.1:44517/player.html**, Chromium **149.0.7827.55**, headless `--no-sandbox --use-gl=swiftshader --disable-gpu`, viewport1280x960. The unchanged original local fixture `5/project.json` SHA256 is `f995e7c27d284593e5fb0101954872405b9eb7b68ffd5f5fd8e55b8181b4bbfc`. No editor shell, successful state injection, fabricated event or remote content is used.

- **Omitted and false:** actual Enter starts the game; a prearmed DOM observer then Escape opens the real menu. The prior eight-name QA enumeration is extended to include both audio owners and actor/media hooks (none removed); own-property assertions give globals[], mirrors0, markers0. Broad own `__oprn*` collection reports exactly `__oprnRuntimeJuice`, `__oprnJuiceLog`, `__oprnPlayBootLog`, preserving their legitimate owners instead of deleting by prefix.
- **True:** actual keyboard z after prearmed `oprn:action` tills2,3/energy1->0 with receipt1. Second z yields receipt2/handledfalse/missing-seed then insufficient-energy. All prior rejection whole-public-state, mirror equality, optional absence and detached-read assertions remain and pass. QA audio state equals the real imported public `audioStateSnapshot()` (bgm0.7/se0.8/rate1/pan0/fade600), and resource observation includes `cc0-bgm-rtp-fld-003`.
- **Actual native playback, all three modes:** listeners were armed in init before any engine/audio construction, not after input. The authored start BGM `rtp-fld-003-amber-meadow-end-final_f5dafd12.mp3` emits native `playing`, `paused:false`, `readyState:4`, `playbackRate:1`, no media error. Samples include currentTime0/0.001423 and in-progress fade volume0.096..0.154; they are observations, not stable-time assertions. This is actual browser decode/playback evidence. It does **not** claim audible output from physical speakers.
- **Lifecycle:** real imported `teardownPlayer()` plus ordinary stop-all cleanup leaves neither QA audio global nor audio DOM element in all three contexts. Unit/public-shell tests additionally prove observation-only revocation does not pause playing elements, old resource arrays stop recording, enable starts a new list, and the same singleton survives true->omitted/false replacement.
- All pre-teardown page/console/HTTP/request-error assertions pass. The retained live request-failure arrays subsequently contain one BGM `net::ERR_ABORTED` per context after that assertion during explicit teardown/context close; those are **not erased or reported as zero final failures**. `audio.json` distinguishes post-assertion aborts from the passed playback/error boundary. Native audio error arrays contain no error event.
- Actual scene readiness at5141/4150/3933ms and title at2587/1661/1640ms are measurements, not waits. Original120000ms DOM failure deadlines and existing10000ms action deadline remain. The single server's normal reuse across three contexts is not a cache-warmup command.

`browser.json` contains complete observations; `browser-execution.json`/`.txt` contain the exact actual exit/output. Captures are `player-omitted.png`, `player-false.png`, `player-on.png`. The image tool reports this model does not support viewing images; visual-quality adjudication is explicitly unverified. The editor audio-dialog spec's opt-in change is diagnostic-checked and preserves its assertions; its full editor-only journey was not rerun under this runtime-focused correction.

## Cleanup, preservation, index and limits

`entry.json` hashes320 prior evidence files before changes. `cleanup.json` proves all320 remained byte-identical at cleanup, including every VERIFY, parent supervisor output and prior SUMMARY. This new section is prepended later; the entire prior SUMMARY remains verbatim below, including accepted and rejected historical receipts/claims. Those historical narrow off-global claims are superseded by Q1's expanded observation, not rewritten as broad proof.

Each context/browser/server was awaited closed in finally; fresh TCP check44517 returned ECONNREFUSED. Cleanup removed exactly task-created non-symlink/untracked `dist` and `5/q1/browser-cache`. Shared lock file, node_modules, pre-existing caches, supervisor artifacts and old evidence were untouched. New engine-test cleanup revokes observation/stops tracks. No temporary build/server/cache remains; committed evidence/screenshots are intentionally retained.

Protected-input `git diff --exit-code 62c70a30 -- WISH.md package.json package-lock.json vitest.config.ts .omo/gates-baseline.json test/actionDebounceFootprint.test.ts test/fixtures/life-full/coverage.json src/player/runtimeJuice.ts src/player/playBootDiagnostics.ts src/player/saveSlots.ts src/project/session.ts scripts/lib/runtimeQaRun.mjs` exited0. `git diff --check` and pre-evidence `git diff --cached --check` exited0. No dependency install, remote write, push, PR, merge, history rewrite or task2/3/4 reimplementation.

Final `openwiki/INDEX.md` generation occurs only after staging the complete evidence-inclusive tracked file set; exact generation/check/wiki/diff commands, raw outputs and exits are retained together in `q1/finalization.json`. The post-commit command checks INDEX again and prints the actual final commit/tree plus protected hashes and clean tracked status. This task stops at the verified Q1 correction commit; later gameplay, full51 journeys, parent full gates, independent acceptance and physical-audio/visual-quality adjudication are not claimed.

---

# Task5 - QA-only life observability

## Correction DoneClaim - B1/B2/B3 (st_01a07471)

This correction preserves the task5 implementation and addresses its verification blockers with deterministic test setup, retained startup diagnostics, serial real-player proof, and final-tracked-set index regeneration. It does not assert independent approval or a proven cause for the historical browser timeout. No production source, runtime harness, save code, existing actionDebounce test, dependency, baseline, WISH, VERIFY, parent supervisor output, or root task state is changed.

- Worktree/branch: `/home/main/z-project/rpg-zzu-life-full-p2`, `agent/life-full-p2`.
- Entry/reviewed commit: `4e2d1762264533a5826c48686648093c3fe69ebd`; tree `234c0e9c391276f082efb61e2abff2e0a8d7e634`.
- Parent/root: `01a0727b-398a-7481-b557-b198013542c1`. Correction evidence: `.omo/evidence/life-full-20260906/5/correction/` (all paths below are relative to that directory unless stated otherwise).
- Read the full fresh task5 VERIFY from `st_01a0745d` at the actual `5/VERIFY.md` and current SUMMARY, full approved Scope/task5, AGENTS/quickstart/PROJECT_WIKI/INDEX and focused runtime/testing guidance. There is no directory literally named fresh5 in this worktree. All CLAUDE.md files were ignored.
- Predecessor gate: full `4/VERIFY.md` says confirmed/acceptance0/blockers0 at `b7b02d97ad6cb3b493bd60691ec61970e8a0e37e`; actual `git merge-base --is-ancestor b7b02d97ad6cb3b493bd60691ec61970e8a0e37e HEAD` exited0 before edits. No product edit was needed in this correction.
- The new atomic correction commit is the latest commit touching this SUMMARY, obtainable with `git log -1 --format='%H %T' -- .omo/evidence/life-full-20260906/5/SUMMARY.md`; exact new SHA/tree and post-commit index check are reported in the final execution receipt. This is a new commit, not an amend. Subject: `test(runtime): stabilize life QA verification setup`.

### B1 - Failure retained; readiness and diagnostics reconciled

Independent review failed before title at port40501, and supervisor attempt1 failed before title at port35531 during concurrent full validation. Neither retained enough failure observations to prove a cause. The supervisor's diagnostic replay at port33519 passed the same 120000ms DOM deadlines and real off/on keyboard assertions after full tests finished. **That replay is a success, not a root-cause fix or evidence that contention caused the failure.** No such attribution is made here.

The parent's original `5-supervisor/attempt1-execution.json` and `browser-attempt2.json` remain byte-identical. Exact archival copies are `supervisor-attempt1.json` and `supervisor-attempt2.json`; `cleanup.json` verifies original SHA256 respectively `d4aa30974669d959a38f8f411ae62c21513b74f87eb7ec03c87be5bfa0ada321` and `7f2feca0d9b0965690479d99b1f242f618fe03ff885f601bada279ecef381c75`. No writes were made under `5-supervisor`.

The correction-only browser probe starts collection before navigation, retains a run record before attempting boot, records navigation/title/scene-ready milestones, page/console/HTTP/request errors, and pending requests plus DOM/title/screenshot if it fails. Title observation subscribes then checks existing DOM (no lost already-present signal). Before Enter, one observer now requires both the real canvas and disappearance of the loading overlay; canvas creation alone cannot falsely establish ready. Before Escape it observes the real menu; before each z it arms the actual scene-host receipt via the existing `performObservedAction`. No sleep, polling, timeout increase, network route workaround, mocked boot result, or retry loop is added. The only routed response is the same local minimal fixture. The missing-title cause remains unproven; the corrected diagnostics failure branch was not artificially forced during this successful run.

Fresh serial browser proof, **one execution**, after tests, diagnostics, typecheck and build completed:

```sh
VITE_CACHE_DIR=.omo/evidence/life-full-20260906/5/correction/browser-cache node .omo/evidence/life-full-20260906/5/correction/run.mjs browser-execution node .omo/evidence/life-full-20260906/5/correction/browser-proof.mjs
```

Exit0. Chromium `149.0.7827.55`, headless, `--no-sandbox --use-gl=swiftshader --disable-gpu`, viewport1280x960, this worktree's dedicated `startPlayerQaServer` / `vite.player-qa.config.ts` / exportProjectStoreShim at **http://127.0.0.1:42457/player.html**, not editor play. Actual project `Life QA observability fixture`, start `map_blank_start` at2,2, original `5/project.json` SHA256 `f995e7c27d284593e5fb0101954872405b9eb7b68ffd5f5fd8e55b8181b4bbfc` (public regenerated copy is identical).

- Off uses the **omitted** capability flag. Enter starts a real game; prearmed Escape opens its real menu. Globals[], mirrors0, markers0. No QA hook was used for off readiness.
- On: real z tills2,3 with receipt1 and energy1->0; second real z yields receipt2, handledfalse, facing missing-seed and underfoot insufficient-energy. All public state excluding actionReceipt, including RNG/inventory/plots, is deep-equal after rejection. Mirror receipt equals public receipt. Detached-read mutation does not affect live state.
- Both contexts: HTTP200 navigation; page/console/HTTP/request errors all empty. Off title at8240.69ms and scene-ready14507.36ms; on title4185.64ms and scene-ready9220.68ms, measured from each context's probe start, not arbitrary delays. Same120s DOM deadlines and default navigation deadline; no cache prewarming command.
- Full observations: `browser.json`; real exit/raw stdout/stderr: `browser-execution.json`/`.txt`; captures: `player-off.png`, `player-on.png`. The image tool cannot display images to this model, so visual-quality adjudication is explicitly unverified.

Fresh dedicated runner proof then executed serially with a separate cold cache:

```sh
VITE_CACHE_DIR=.omo/evidence/life-full-20260906/5/correction/harness-cache node .omo/evidence/life-full-20260906/5/correction/run.mjs harness node .omo/evidence/life-full-20260906/5/correction/harness-proof.mjs
```

Exit0; Chromium149.0.7827.55, **http://127.0.0.1:37003/player.html**, runner viewport1024x768. Real Enter then two existing Input edge `{kind:'action',observe:true}` operations; receipts1/2, till then rejection,2 beats/0 failures/errors. `runtime/SUMMARY.md`, `runtime/manifest.json`, `runtime/01-till.png`, `runtime/02-reject.png` retained. This is browser input evidence, unlike the separately named public-module probe.

### B2 - Actual import cost measured; setup separated from operations

Review RED is retained in the untouched `5/VERIFY.md` (SHA256 `58e4fb3abe153835b92c599b706823476c1c3811bcfb427a73effb4b5f279b7e`): first async debug test exceeded15000ms (15068ms), related suite248 passed/3 failed. Original producer related run249/2 took8285ms in that test. This correction does **not** claim to reproduce the original timeout or recover its missing timing measurements.

Before the setup correction, diagnostic-only instrumentation was added to the existing test's import completion, fixture and operation boundaries. Original and instrumented sources are retained as `debugSession-before.ts` and `debugSession-measured-before.ts`. `related-before.json`/`.txt` records a fresh real run: exit1,249 passed/2 failed, the unchanged two registry-fixture errors. First-test imports completed at session1173.67ms, debugSession2260.09ms, emberQuestGame6575.32ms, **playSceneTestHooks10334.34ms**; fixture78.22ms; operations and assertions2.32ms. This is diagnosis evidence, not a fabricated RED or timing retry presented as a fix.

`dependency-graph.mjs` emits TypeScript's runtime static import/export closure (type imports removed, local src only; dynamic/external modules excluded) against actual predecessor b7b02d97 and reviewed HEAD4e2d1762. Hooks closure: **81 ->276 local modules (+195)**, via newly imported runtimeDom -> resourceDisplay/store -> editor/defaults/IO modules. `dependency-graph.json` retains both complete adjacency lists; `graph.json` records exit0. This is the hooks closure, not a claim that all195 were newly unique in the union of all four test imports.

The smallest correction is in `test/debugSession.test.ts`: use normal static imports during collection and synchronous tests for synchronous authorities. No first operation now awaits an unrelated hooks import. All four tests and17 exact assertions are preserved; live-session replacement and finally-restored window still run. This is deterministic test setup, **not** a cache-warmup hook, timeout increase, production dependency optimization, mock, test deletion or skip. Production graph cost remains visible and unchanged.

The first and only post-correction affected run includes `timing-reporter.mjs`, using Vitest's real module/test diagnostics: collection6512.50ms; all four test bodies239.95ms; first body81.97ms; retries0, repeats0, flakyfalse. Full non-externalized import timings are in `debug-timing-after.json` (runtimeDom4449.32ms, hooks4489.28ms, store4282.42ms inclusive in this execution). No claim of faster imports or a machine-independent performance bound is made.

Both fresh before/after related commands include **all** original15 files. They each exit1,249 passed/2 failed/0 skipped,14 files passed/1 failed. The unchanged failures are `TypeError: Cannot read properties of undefined (reading 'registry')`, `syncCutsceneHudVisibility` at playSceneMapRuntime.ts:657, via captureScene at actionDebounceFootprint.test.ts:139, cases145 and158. The earlier pre-product characterization records the same errors at old line655. Neither fixture/assertion nor baseline JSON is changed. Parent owns unrelated full-gates25-new-file baseline triage; this correction neither ran full gates nor labels them resolved.

### Commands, true exits and ordering

All commands execute in the named worktree at reviewed HEAD4e2d1762/tree234c0e9c with the scoped test edit uncommitted. Wrapper `node .omo/evidence/life-full-20260906/5/correction/run.mjs <label> <command...>` captures child status/signal, exact argv/cwd/head/tree/time/output and output SHA256. No piped status is substituted. Heavyweight commands were awaited serially; unrelated other-worktree test processes observed on the shared host were not killed or presented as this correction's work.

```sh
# related-before (exit1), same file list as below plus --silent=false
npm test -- test/runtimeQaInstrumentationBoundary.test.ts test/runtimeQaReport.test.ts test/runtimeQaGate.test.ts test/sceneTestRunner.test.ts test/debugSession.test.ts test/runtimeDebugPanel.test.ts test/playSceneFarmFeedback.test.ts test/npcActionFacing.test.ts test/runtimeMovementStability.test.ts test/actionDebounceFootprint.test.ts test/lifeSaveVersion.test.ts test/lifeRecoveryPersistence.test.ts test/p0SessionPersistence.test.ts test/p2SpatialPersistence.test.ts test/autosave.test.ts --silent=false

# green (exit0), one final run, 7/7 passed, start11:06:45, duration8.26s
npm test -- test/lifeQaObservability.test.ts

# related-after (exit1), 249 passed/2 unchanged failures, start11:06:54, duration14.50s
npm test -- test/runtimeQaInstrumentationBoundary.test.ts test/runtimeQaReport.test.ts test/runtimeQaGate.test.ts test/sceneTestRunner.test.ts test/debugSession.test.ts test/runtimeDebugPanel.test.ts test/playSceneFarmFeedback.test.ts test/npcActionFacing.test.ts test/runtimeMovementStability.test.ts test/actionDebounceFootprint.test.ts test/lifeSaveVersion.test.ts test/lifeRecoveryPersistence.test.ts test/p0SessionPersistence.test.ts test/p2SpatialPersistence.test.ts test/autosave.test.ts --reporter=default --reporter=./.omo/evidence/life-full-20260906/5/correction/timing-reporter.mjs
```

| Subsequent exact command (relative worktree path) | Actual result |
| --- | --- |
| `node .omo/evidence/life-full-20260906/5/correction/public-probe.mjs` | Exit0; actual builder/dispatch/hooks/save writer, prearmed acceptance and rejection, whole rejected session unchanged, detached reads, no saved receipt, off events0/mirror absent; **module evidence, not player gameplay**. |
| `node .omo/evidence/life-full-20260906/5/correction/diagnostics.mjs` | Exit0; actual TS language service8 files/0 diagnostics, including corrected debug test and original task5 TS paths. Tool LSP also returned zero for changed test. Both before typecheck/build. |
| `npm run typecheck:app` | Exit0. |
| `npm run build` | Exit0; app tsc/app Vite/player/SDK/standalone completed; visible existing circular record-picker, mixed-import, runtime asset and large-chunk warnings retained. |
| Browser and harness commands above | Exit0 each, after build; no overlap or rerun. |
| `node .omo/evidence/life-full-20260906/5/correction/cleanup.mjs` | Exit0, detailed assertions below. |
| `bash -c 'for file in .omo/evidence/life-full-20260906/5/correction/*.mjs scripts/lib/runtimeQaRun.mjs; do node --check "$file" || exit $?; done'` | Exit0; all correction scripts and unchanged runtime harness syntax. |
| `npm run openwiki:verify` | Exit0, failures[]. |

### B3 - Evidence-inclusive generated index

Fresh pre-correction `npm run openwiki:index -- --check` exited1 (`index-red.json`/`.txt`), confirming the final-tree stale-index blocker. Its concrete cause is that the generator's basename checks include `git ls-files`; the original pre-evidence generation/check missed newly tracked project.json/browser-proof.mjs/harness-proof.mjs. The matching testing wiki now documents setup/diagnostic/serial-validation boundaries. INDEX is generated, never hand-edited. `npm run openwiki:index` and `npm run openwiki:index -- --check` both exited0 after staging the correction evidence (`index-generation.json`, `index-green.json`). Final generation/check use those same already-tracked receipt paths after all evidence-inclusive staging, including `delivery-set.json`, which records the exact scoped change list and SHA256 of the entire NUL-delimited tracked path set. The post-commit check additionally reports the exact final SHA/tree rather than pretending a pre-commit tree is the delivered tree. `git diff --cached --check` exited0.

### Cleanup, preservation and limitations

`cleanup.json`/`cleanup-execution.json` record exit0: contexts/browser/server closed in probe finally blocks; one real connection per port42457/37003 returned ECONNREFUSED. Build output `dist` and correction-created browser/harness caches were non-symlink, contained no tracked files, and were removed; correction module-cache was absent. Shared node_modules, prior caches, parent supervisor files and original task5 artifacts were not cleaned or overwritten. The generated correction fixture was byte-compared to the original, then removed as a duplicate rather than adding another183477-line project dump. `cleanup-final.json` retains that additional cleanup exit0; the public probe regenerates it when executed, and the cleanup probe verifies equality before removing it. No demo/remote content was authored.

Protected gate/review/supervisor hashes were rechecked; actual `git diff --exit-code 4e2d1762 -- src scripts WISH.md package.json package-lock.json vitest.config.ts .omo/gates-baseline.json test/actionDebounceFootprint.test.ts test/fixtures/life-full/coverage.json` exited0. Exact old/new expect lines compare equal (17); all four test cases execute. All51 coverage entries remain `not-run`; no later journeys, independent approval, full-gates success or visual-quality verdict is claimed. No VERIFY is staged. No push/PR/merge/history rewrite or dependency install.

## Historical implementation DoneClaim (4e2d1762)

The following original implementation record is retained for chronology. Its pre-evidence index-green claim and references to an older task5 VERIFY are historical, not current approval; the correction and fresh st_01a0745d review above supersede those delivery claims.

### Original DoneClaim

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
