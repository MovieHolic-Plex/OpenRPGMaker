# Cinematic post-start stall and pending retry recovery

Task: `st_01a07598` (2026-09-06). Result: **reproduced and fixed**.

- Worktree: `/home/main/z-project/rpg-zzu-wish-cinematics-stall`
- Branch: `agent/wish-cinematics-stall` (no upstream configured)
- Base: `f5337e24be7cdcd6063bf289b150f219bc612199`
- Implementation commit: the commit containing this report; identify with
  `git log -1 --format='%H %s' -- output/evidence/cinematics-stall.md`.
- Reviewer input: the parent's `phase1-review.md` described this branch as
  **UNVERIFIED**, not an already established failure. This report settles it.

## Mechanism and minimal change

`player.ts` waits for shared playback completion before opening a fresh run;
`playSceneOverlays.ts` waits before rendering the game-over terminal menu. Both
therefore depend on `cinematicSequence.ts` exposing a usable completion path.
Previously, native `playing` disabled confirm continuation, no `waiting` or
`stalled` listener restored it, and the initial watchdog only examined `loading`.
A zero-duration unskippable video could consequently retain input capture forever.

The shared player now handles native `waiting` and unbuffered `stalled` by showing
status and immediately enabling Z/Enter/Space continuation. It does not pause or
release the media on those events, so normal buffering recovery remains possible.
Native `playing` clears the status and disables confirm continuation again.
A `stalled` event with `readyState >= HAVE_FUTURE_DATA` does not unlock a healthy
buffered video. No arbitrary healthy-playback duration cap was added.

Initial video load and every R retry now share a fresh 10-second load deadline
and a nonempty continuation status. A still-pending retry can be continued
immediately, or reaches recoverable error and releases media at its deadline.
Repeated waiting events do not extend that deadline. Successful playback cancels
it. Authored positive duration remains a separate maximum and survives media
failure. Escape still skips only authored skippable sequences.

Only the shared player, its focused test, this report, and the relevant runtime
wiki paragraph are committed. No other production modules, CSS, schema, editor UI,
shipping fixtures, dependency/configuration files, or remote project data changed.
Native exact-edit tools were used; Git history conventions and omo attribution
were followed. No push, PR, merge, full build, or full gates were performed.

## Deterministic RED before production edits

Before the RED command, `git diff --exit-code -- src/player/cinematicSequence.ts`
returned zero: production was still identical to the requested base.

```sh
npm test -- test/cinematicSequence.test.ts test/playerCinematics.test.ts
```

Exit **1**: **10 failed / 43 passed**, 53 tests. Raw local receipt:
`cinematics-stall/unit-red.log`.

Six cases dispatched native DOM media events through the existing narrow
HTMLMediaElement boundary mock: unskippable video, duration 0, `playing`, exhaust
10,000ms of the original watchdog with fake time, then `waiting` or `stalled`.
Each event was paired separately with distinct Enter, Z, and Space presses. All
six failed at the actual transition assertion:

```text
AssertionError: expected 'video' to be 'text'
Expected: "text"
Received: "video"
```

The other four failures established:

- Pending retry after the original watchdog expired had empty status:
  `AssertionError: expected 0 to be greater than 0`.
- Pending retry still reported `loading`, not `error`, after another 10,000ms.
- Native waiting after start retained `playing`, not a recovery state.
- Retry armed zero timers instead of one.

The retry finding is specifically missing visible guidance and an unarmed
deadline; it is not a claim that blocked autoplay had lost its internal confirm
permission. The post-start six-case failure is the proven keyboard trap.

## Focused verification

| Validator | Final result |
| --- | --- |
| `npm test -- test/cinematicSequence.test.ts test/playerCinematics.test.ts` | **exit 0, 56/56** (47 shared playback + 9 shell integration), 13.84s |
| `npm run typecheck:app` | **exit 0** |
| TypeScript LSP, shared player and changed test, severity all | **No diagnostics found** |
| `git diff --check` | **exit 0** |
| Actual exported-player negative-case probe | **exit 0**, native playback, injected stall, visible continuation, one-press recovery, cleanup |

The final test command passed in one complete invocation; no tests were deleted,
skipped, or rerun selectively. Added coverage includes all three confirm keys,
repeat/Escape restrictions, no input fallthrough, resumed playback, buffered
network stalls, initial/retry deadlines, repeated waiting, authored maxima,
late events/promises, source release, and abort/skip/detach cleanup. It asserts
state and nonempty status, not exact prose. Fake-clock advancement tests the
actual deadline contract; no fixed sleeps or polling were added.

Verification issues were retained rather than hidden:

- The first post-edit invocation was **55 passed / 1 failed**. The new buffered
  playback case exposed happy-dom's missing static `HAVE_FUTURE_DATA` constant
  (`undefined`; verified directly with `new Window()`). The test boundary now
  supplies the native value 3 and restores its original descriptor after the
  suite. Production was not weakened to accommodate the mock. Receipt:
  `cinematics-stall/unit-green.log`.
- The first app typecheck exceeded the tool's 120-second command deadline and
  produced no diagnostic. It was rerun with a 600-second command allowance and
  exited zero. Receipts: `typecheck.log`, `typecheck-complete.log` in the local
  evidence directory.
- Markdown LSP is not configured; its invocation reported that limitation.
  Markdown is not presented as LSP-verified.

## Actual player.html failure-path proof

Command, executed from this worktree (not the parent's tree):

```sh
cd /home/main/z-project/rpg-zzu-wish-cinematics-stall
node output/evidence/cinematics-stall/probe.mjs
```

The probe uses this tree's existing `startPlayerQaServer` export and
`cinematicQaOp` event-driven keyboard transition. Its transient engine-contract
project is generated with the existing cinematic fixture generator and supplied
to the real `player.html` boot URL. It does not route through the editor or call
the shared player directly. No remote authored content is involved.

At 1024x768, Chromium decoded the existing synthetic WebM and emitted native
`playing`. Recorded preconditions were `state=playing`, `readyState=4`,
`paused=false`, `videoWidth=32`, `videoHeight=24`, `error=null`, `ended=false`.

**This was deliberate fault injection, NOT a real network stall.** After real
playback was proven, the probe paused the video, modeled buffer exhaustion with
native `readyState=HAVE_CURRENT_DATA`, and dispatched a native-boundary `stalled`
event. Fixture-only looping prevented natural `ended` from masking the fault.

Observed result:

```json
{
  "after": "waiting",
  "visible": true,
  "statusRect": { "x": 266.234375, "y": 543, "width": 491.484375, "height": 64.5 },
  "recovery": {
    "scene": "recovered", "source": null, "paused": true,
    "fallthrough": 0, "canvas": false, "menu": false, "editor": false
  },
  "errors": [],
  "pass": true,
  "cleanup": { "browserClosed": true, "serverClosed": true }
}
```

Status visibly offered Z/Enter/Space continuation. Escape left the unskippable
video in place. One distinct real Enter press reached the text sentinel, without
also advancing it or starting the map/menu. The old video was paused and its
source removed; deliberately late playing/waiting/stalled/error/ended events
could not change the sentinel. Native events/DOM transitions were subscribed
before actions, with bounded failure timeouts rather than sleeps or polling.

Browser environment issues and their resolution:

1. Default Chromium transport failed before title mount with
   `net::ERR_NETWORK_CHANGED`. No cinematic result is claimed for that attempt.
2. The documented workaround forwarded only this owned QA server's GET responses
   through Node fetch, retaining original server bytes. All recovery assertions
   passed, but the overall probe still failed on Vite WebSocket
   `ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS` console errors.
3. With that same transport and the existing QA launch flag
   `--disable-features=LocalNetworkAccessChecks`, the complete probe exited zero
   with no page/console/request errors. No application code or assertions were
   changed for these infrastructure issues. Every attempt closed its browser and
   QA server in `finally`.

PNG files were captured and an image read was attempted, but this worker's model
cannot receive images. Visibility above is the browser's computed-style and
geometry assertion, not a human visual approval. Real-network stall generation,
other browsers, and pending-retry browser timing are not claimed; pending retries
and all three keys are covered deterministically at the media boundary.

## Preserved local artifacts

Raw receipts, the replayable probe, and PNGs are preserved under
`output/evidence/cinematics-stall/` in this worktree. They remain gitignored local
artifacts rather than extra files in the scoped cherry-pick; this report embeds
the result needed by the integrator.

- `unit-red.log`, `unit-green.log`, `unit-green-complete.log`
- `typecheck.log`, `typecheck-complete.log`
- `probe.mjs`, `browser.json`, `browser-green.log`
- Failed browser receipts: `browser.log`, `browser-network-failed.json`,
  `browser-complete.log`, `browser-local-access-failed.json`
- `stall-continuation.png`, `stall-recovered.png`

SHA-256 receipts:

```text
f00c49c96216fd4d0ef32f7db38b96ba65e7093a475626ae94e553b0a9a9865e  unit-red.log
478ca6da643f1c87d836c2ca5377c3c8ae709ef054e024a7a229a010ffeee7d4  unit-green-complete.log
9e2e881b46f10347e10261b098fd6171273d8f45b9a5d52fc81a8473a713bdfe  typecheck-complete.log
eb62e1eb30e78bb20a35005e8c1711ca4d70660319e51aff07ac0820d32fb727  probe.mjs
4420fc0133d74aa3e637b4f7f2ca1daa826b8d59804e873d778d59cd5362a6f8  browser.json
0b0b66031dae7ec3638663e0b77b026c0b8f0198bc9d75c7edf418f80171c7d1  stall-continuation.png
7a8faf12812ea7326a1d5ec52fb8e2dc3897654e5884bef48ee640f0ce8f33a2  stall-recovered.png
```
