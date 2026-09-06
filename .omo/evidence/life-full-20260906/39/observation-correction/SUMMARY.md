# Task39 parent-replay correction - title readiness setup

## Outcome

Only `test/lifePlayerSaveFailures.test.ts` changes in this correction. Both title refusal tests now finish their two synchronous navigation keys, assert that `title-load-game` is selected, then prearm the existing DOM observation before Enter. No player/codec/recovery/session changes, no longer timeout, no observer-success bypass, no skipped/deleted assertion and no replacement of a real player callback.

All original159 related cases remain; one deterministic deadline-placement regression makes the final suite **160 passed /0 failed /0 pending**, in one final-revision execution. Diagnostics, app typecheck, full build, public-module prelude and fresh four-case native Firefox proof also pass.

## Identity and parent failure retained

- Task `st_01a0759d`; parent/root `01a0727b-398a-7481-b557-b198013542c1`.
- Worktree `/home/main/z-project/rpg-zzu-life-full-load-errors`, branch `agent/life-full-load-errors`.
- Base HEAD `e9522cb11c4e09d09fddc45c18d805d53a61b976`; base tree `47999d20959f54014ac1526adba0b27aa5842edd`.
- Verified staged test-only tree before correction evidence: `44606f982e9f350f4fcae9f095e3efdd929ed5f6`.
- Final test SHA256: `be9b05decffb3c598ef0e8cac0fc27ca423b7af1e137ed4056836007f5684035`.
- Both product-file hashes remain exactly those in task39's initial native proof; the new native receipt checks them again.

Parent's ignored `../parent-failed-suite.json` reports158passed/1failed, `observeMessage:135` called at test187: the FIRST load-window await, not the subsequent refusal-message wait. Parent's original159suite/browser chain stopped before browser execution. The parent receipt did not capture original deadline-time DOM; this correction does not pretend to recover it or prove the original wall-clock scheduling retrospectively.

Parent-owned files were neither edited nor staged. Final cleanup verifies:

- `../parent-failed-suite.json`: SHA256 `0a20aaa0ef53f7da9f058fdafb30aaa3c8eb9217cd5a5fe2aadf73cc7a71dca8`.
- `../parent-browser-proof.mjs`: SHA256 `539b9a1d0dfd46da0755812e8a3ffdb36b8cc9155f1756a593e39d29a7f62549`.

## Diagnosis and deterministic RED

Inspected the actual title routing, not just the failed assertion. Every ArrowDown runs the current autosave reader/precheck and rerenders the title, which reads it again. Enter reads/prechecks current options, then schedules the real180ms title-confirm callback. The old test placed both large-slot navigation rerenders inside the1500ms window intended to await that callback's panel.

Happy DOM20.10.6's `MutationObserverListener.report` uses `window.queueMicrotask`, backed by Node's queueMicrotask. No deferred-timer observer delivery was demonstrated, so that hypothesis is NOT reported as the cause and the observer's success/deadline behavior is unchanged.

The controlled regression uses actual shell keyboard dispatch and actual title callback/rendering. Only the harness clock is controlled: after the second navigation handler has run, it advances the fake timer clock1500ms, modeling synchronous setup consuming the old wait budget. This explicitly tests timeout placement; it does not sleep, poll, simulate successful load, or fast-forward gameplay. Rejection handling is attached before running pending real title callbacks.

`exact-flow-red.log.gz`, exit1, with `controlled-red.test.ts.txt` retaining the complete old-flow test revision, shows:

```json
{
  "selector": "[data-testid='player-load-window']",
  "atDeadline": {"selectedTitle":"title-load-game","loadWindows":0,"startedSessions":0},
  "afterTrigger": {"selectedTitle":"title-load-game","loadWindows":0,"startedSessions":0},
  "current": {"selectedTitle":"title-load-game","loadWindows":0,"startedSessions":0}
}
```

Then the actual pending title callback runs: the assertions for **one real render call and one actual load window pass**, but the already-failed helper result remains false. This distinguishes the reproduced defect from stale title selection, wrong action routing, restored-session startup, or an observer failing to see an already-existing panel. Because the DOM is absent at the reproduced deadline, no immediate-state success workaround was added. Instead the two navigation keys are correctly treated as setup, outside the observed Enter action. An explicit selection assertion now catches any future wrong-title-state failure before activation. Diagnostic snapshots at deadline, after trigger and assertion remain in the helper so future failures identify their actual state.

The regression runs against the same `openTitleLoadPanel` used by both original title tests; its old body is the original three-key trigger, not a reimplemented success body. The new body keeps every key and panel assertion, but only Enter is inside the prearmed observation. All subsequent slot-refusal, guidance-count, exception, disk/live and no-restore assertions remain intact.

Historical parent causality limitation: the source ordering defect and an identical first-await failure are deterministically demonstrated. The parent's missing DOM/scheduling capture means we cannot claim its exact elapsed key-processing time or rule out every other unrecorded environmental event.

### Exploratory failures are not valid RED proof

All diagnostic runs are retained. Initial `red`, `controlled-diagnostic`, and `trigger-diagnostic` probes forwarded window timers to the already-shared global fake-timer spy and caused a RangeError recursion; they do not prove a product or helper failure. `controlled-diagnostic-visible` was unintentionally run unchanged after its preceding patch was rejected; it remained RED and supplies no independent finding. The forwarding mock was removed after the captured RangeError identified it. `deadline-red` and then `exact-flow-red` execute the real title callback successfully and establish the actual test-ordering failure above. No failed run was deleted or represented as a pass.

## Exact verification

From the worktree above, every heavy child command uses `flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock` and the fixed bounded child timeout. Raw logs are losslessly stored as `.log.gz` (`gzip -dc`); compression was checked against original bytes with `cmp`. No warning/failure text was sanitized.

```sh
# Controlled RED (each diagnostic revision used this target; no code-level skips)
flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock timeout 300 npm test -- test/lifePlayerSaveFailures.test.ts -t 'does not spend the title readiness deadline' --maxWorkers=2 --minWorkers=1 --no-cache
# Exact-flow revision: exit1 at the readiness-result assertion, after real render/window assertions passed.

# Diagnostics before typecheck/build: exit0, all three TS files checked, zero diagnostics
flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock timeout 300 node .omo/evidence/life-full-20260906/39/diagnostics.mjs

# Final suite: one execution, exit0, 9 files/160 tests
flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock timeout 300 npm test -- test/lifePlayerSaveFailures.test.ts test/playerOpenSaveMenu.test.ts test/playerSaveSlotLoadGuard.test.ts test/playerSaveSlotLegacyFace.test.ts test/autosave.test.ts test/lifeSaveVersion.test.ts test/lifeRecoveryPersistence.test.ts test/lifeRecovery.test.ts test/checkpointEndingRuntime.test.ts --maxWorkers=2 --minWorkers=1 --no-cache

# Isolated runner; each <name>.json records exact expanded flock argv, times, exit, HEAD/tree.
node .omo/evidence/life-full-20260906/39/observation-correction/run.mjs typecheck
node .omo/evidence/life-full-20260906/39/observation-correction/run.mjs build
node .omo/evidence/life-full-20260906/39/observation-correction/run.mjs firefox
node .omo/evidence/life-full-20260906/39/observation-correction/run.mjs index
# All exit0; respective child deadlines300/600/600/120 seconds, unchanged.
flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock timeout 120 node .omo/evidence/life-full-20260906/39/observation-correction/cleanup.mjs
# exit0; evidence scripts also pass node --check.
```

Fresh native proof: `firefox/browser-results.json`, Firefox151.0, actual free-port `http://127.0.0.1:42507/player.html`, all four manual/auto title/running failure cases pass. One text-only guidance node per refusal, unchanged current/legacy disk bytes, no restored scene from title, unchanged QA state and identical canvas/debug identity in the running game. Zero page/console/HTTP/request failures. Public-module/Storage prelude also passes. Screenshots in `firefox/` are authentic1280x960 captures; visual review remains unavailable to this child. Manual-save proof remains the actual shell/controller/Storage unit fixture, not a native-save claim. Prior Chromium network and Firefox harness failures remain untouched in the initial evidence.

`cleanup.json` records no own runtime leaks, closed native port (ECONNREFUSED in browser receipt), removed own dist/cache output, unchanged tracked caches, and unchanged parent-owned files. Shared INDEX is unchanged; final index check exit0. No doc correction, task40/integration/root-state change, remote write, dependency install, push, merge or amend. Only the corrected test, this owned evidence directory and an appended task39 summary pointer are staged.
