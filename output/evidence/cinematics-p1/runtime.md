# Cinematics Phase 1 runtime delivery

Task: st_01a07542. Date: 2026-09-06.
Worktree: `/home/main/z-project/rpg-zzu-wish-cinematics-p1`.
Branch: `agent/wish-cinematics-p1`; phase base: `4c7cf588`.

## Commits and scope

- Model dependency: `4729ac5b5855b8a0056ab930a88ab1df795bdfb7`.
- Model evidence / runtime starting tree: `8bb02872`.
- Runtime implementation: **`d0187869c7d4d145a1b70326b58da35992e28d21`**,
  `feat(player): play cancellable opening and game-over cinematics`.
- This evidence is a separate documentation commit following that runtime commit;
  identify it with `git log -1 -- output/evidence/cinematics-p1/runtime.md`.

The exact persisted `system.opening` / `system.gameOver` model is consumed without
schema changes. Shared DOM playback has explicit `done` and `teardown`, requires
an AbortSignal and project, and is usable outside Phaser for future editor preview.
Fresh runs gate map boot through opening; load/test-here/selected-event paths stay
separate. Game over retains its existing modal testid around the sequence and
terminal menu, preserving existing input/time/movement consumers. Existing ending
and event-movie implementation files were not changed.

Focused companions: uploaded-video MIME resolution, cinematic key predicate,
shared runtime CSS import, built-CSS required-selector/import expectations, and
an additive event-driven cinematic QA operation. No framework/dependency changes,
editor DB UI changes, demo content, remote DB writes, push, PR, merge or main checkout.

## Assertion RED before production edits

All logs below are adjacent to this file; ANSI color codes and trailing whitespace
are removed for readable committed transcripts, with failure output preserved.
These are real assertion failures, not an absent test-file or import-resolution failure.

| Command / seam | Exit | Observed RED |
| --- | --- | --- |
| `npm test -- test/cinematicSequence.test.ts test/playerCinematics.test.ts` | 1 | 4 failed / 3 passed: shared API absent; New Game/autoStart boot immediately rather than waiting; teardown cannot prevent that early boot. `runtime-red.log` |
| `npm test -- test/playerCinematics.test.ts` after terminal seam cases | 1 | 6 failed / 3 passed: terminal/retry mounted before a sequence; no replacement/shutdown lifecycle; configured default ignored. `runtime-red-gameover.log` |
| `npm test -- test/cinematicSequence.test.ts` during media hardening | 1 | Narration retry remains `loading` instead of returning `ready`. `runtime-red-audio-retry.log` |
| Same shared suite, authored-error maximum cases | 1 | Native failure/missing reference cancel the authored maximum. `runtime-red-error-deadline.log` |

The last RED run also exposed a test-double mismatch: its alleged stalled load
returned a fulfilled `play()` promise (which browsers resolve after playback
starts). That fixture now leaves `play()` pending; production media error cleanup
is separated from the still-authoritative scene deadline. No assertion was removed.

An initial patch invocation failed because `apply_patch` was not installed; the
resulting no-test-files command was **not** counted as RED. Edits used a local
`apply_patch` shell wrapper generating unified diffs for `git apply`.

## Final verification

| Validator | Exit / result | Evidence |
| --- | --- | --- |
| Required three suites plus focused regressions below | **0; 16 files, 291 tests passed** | `runtime-focused-green.log` |
| `npm run typecheck:app` | **0** | `runtime-typecheck.log` |
| `npm run build` | **0**, including export/standalone-player builds | `runtime-build.log` |
| `npm run qa:runtime -- --scenario cinematic-sequences` | **0; 11/11 beats, no runtime errors** | `runtime-qa.log`, generated SUMMARY.md |
| TypeScript/JavaScript/MTS LSP on every changed source/test/script | No diagnostics returned | Tool results in this worker session; latest recheck includes the final media and QA changes |
| CSS LSP on both changed stylesheets | Unavailable: Biome executable not installed | Dependencies left unchanged as requested; actual built CSS and pointer guards ran |
| `git diff --check` / staged check | **0** | Checked before runtime commit |

Exact focused command:

```sh
npm test -- test/cinematicSettings.test.ts test/cinematicSequence.test.ts test/playerCinematics.test.ts test/checkpointEndingRuntime.test.ts test/titleScreen.test.ts test/titleScreenMenuLabels.test.ts test/titleScreenMusic.test.ts test/battleDefeatOutcome.test.ts test/playerRunControls.test.ts test/playBootRecovery.test.ts test/playerOpenSaveMenu.test.ts test/generatedAssetResourceResolver.test.ts test/playerInputCss.test.ts test/runtimeDomTitleGuard.test.ts test/runtimeQaGate.test.ts test/runtimeQaReport.test.ts
```

The new suites contain 23 shared-player tests and 9 shell/terminal seam tests.
Media/Phaser boundaries are mocked only in unit tests; project store shim, real DOM,
keyboard routing, terminal cursor and lifecycle code execute together. Unit timers
are controlled explicitly for authored durations, load/title deadlines and their
cancellation. No new test/scenario sleeps or polling were introduced.

### Supplemental CSS failure is pre-existing, not hidden

The same command **plus `test/playerRuntimeCss.test.ts`** exits **1**, with
**296 passed / 1 failed** (`runtime-focused-with-css.log`). The failing test is:

```
exported player runtime CSS > detects an omitted required import in a disposable built entry
expected true to be false
expect(hasCssSelector(fixtureCss, ".action-hud")).toBe(false)
```

Untouched `8bb02872:src/styles` bytes were extracted with `git archive` into an
isolated disposable directory, built with only `actionHud.css` omitted, and the
same selector predicate still returned **true** (`runtime-css-baseline.log`, exit 1).
The surviving rule is `.play-stage.cutscene-hud-hidden .action-hud` in the baseline
`playSurface.css`. The original failing assertion was preserved. Required cinematic
selectors and the new shared import expectation pass in that built-CSS run.

Build warnings about existing unresolved generated icon URLs and large bundles
remain in the build log. Full application `npm run gates` is lead-owned and was not
run by this worker.

## Exported-player and lifecycle receipts

Actual surface: `player.html`, export store/app-mode shims, Chromium, 1024x768.
No editor shell was traversed. Scenario fixture is a generated blank project with
one checkpoint/kill command pair. `test/fixtures/cinematics/contract.webm` is a
5,067-byte synthetic 32x24 color movie; its source command was:

```sh
ffmpeg -f lavfi -i 'color=c=0x243852:s=32x24:r=1:d=120' -c:v libvpx -threads 1 -an contract.webm
```

Narration is a generated quiet PCM WAV. Fixture JSON is roundtrip-validated before
browser boot, uses a unique `.omo/runtime-qa/cinematics-*` directory per process,
and is removed by the process exit handler even if fixture generation fails.

| Behavior | Evidence |
| --- | --- |
| Opening before map | QA input receipt has `canvas:false`, no runtime-state-json/menu; shell test records no startPlayGame call before completion |
| Rejected autoplay and retry | Browser injects one NotAllowedError at native media play; real R retry transitions blocked -> ready |
| Native video completion | Browser subscribes to ended and map DOM before seeking the real decoded video near its end; native ended boots the map and sources are released |
| Missing/broken/stalled media | Unit missing-resource/load-deadline cases; browser dispatches native error after successful decode/play, then unskippable defeat continues |
| Authored maximum survives media failure | Separate RED/GREEN native-error and missing-reference cases |
| No fallthrough / repeat / pointer | Browser receipt: `escaped:0`, all seven held-key events consumed, pointer blocked, scene unchanged; unit final-press handoff does not retry/checkpoint or open menu |
| Reduced motion | Browser computed animationName is none; image is decoded at 320x240; unit JS motion flag is none |
| Terminal labels and message precedence | Actual visible labels match authored fixture; event message overrides configured fallback |
| Checkpoint and repeated defeat | Retry restores (4,4) without opening; a second defeat plays and returns cleanly to title |
| Abort/shutdown/host detach | Unit explicit abort, teardown, shutdown and repeated replacement; browser host teardown yields `paused:true, source:null` |
| Timers/listeners | Unit timer counts return to zero, stale ended/play rejection cannot affect next scene, terminal lifecycle listeners removed |
| Bounds | Browser-measured caption/hint/panel rectangles are inside the stage; terminal panel is 666x408.89 screen pixels |

Last final scenario completed with no errors and removed
`.omo/runtime-qa/cinematics-LkMJHp`. The CLI's finally block closed its browser and
QA Vite server; no `scripts/runtime-qa.mjs` process remained and `.omo/runtime-qa`
contained no fixture directories. An existing port-9841 development server was
not started by this worker and was left untouched.

One earlier fixture lacked a required event graphic; the generator now includes
it and validates the roundtrip before boot. One later concurrent validation run
hit the harness's initial-title timeout; a diagnostic exported-player probe found
the title reachable with no reported page errors, and subsequent final scenario
runs passed. The timeout's cause was not established; it is not claimed fixed.

## Visual review limitation / handoff

Read `verify-shots/runtime-qa/cinematic-sequences/SUMMARY.md` first. It reports
11/11 passing beats and seven screenshots. Review especially:

- `01-opening-text.png`
- `02-opening-image.png`
- `03-opening-video.png`
- `06-game-over-video-error.png`
- `07-terminal.png`

This worker attempted image reads, but the tool returned **"Current model does not
support images"**. Therefore this report does **not** claim visual approval.
Browser image decode, bounds, visible-text and input checks are verified; the
planned independent QA worker must inspect the actual PNGs. Screenshots remain
in the generated QA directory, not committed as temporary images.
