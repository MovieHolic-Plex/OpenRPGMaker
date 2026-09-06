# Event command repair evidence

Base: `d1d5e7e98dd0c6c5ef837db2a1456e280359be42`.
This records verified repair increments, not an assertion that every legacy M2 command has full runtime support.

## Map effects

- RED: `test/eventCommandMapRepairs.test.ts` had 22 failures and 5 passing compatibility controls. Failures were assertions, not import or fixture failures.
- GREEN: 34 repair cases and 65 adjacent movement/execution cases passed in the supervisor's 99-test run.
- Real player RED: `LOCATION COMPLETE` appeared, but the event remained at tile X=5 instead of X=8.
- Real player GREEN: the same keyboard-driven scenario observed tile X=8 and sprite X=136; swap produced A at X=10 and B at X=8 without exchanging facing. System resource IDs survived, weather recorded `snow,0.7`, snow was visible, and field input resumed.
- Both browser runs used `player.html` and the export store shim, not editor play mode. Their `report.json` receipts record closed browsers and servers.
- Supervisor `typecheck:app` and `build:player` passed. Existing unresolved public-asset and bundle-size warnings were retained.

Reproduce:

```bash
npm test -- test/eventCommandMapRepairs.test.ts \
  test/runtimeMovementStability.test.ts test/eventRuntimeExecution.test.ts \
  test/runtimeMoveRouteCommands.test.ts --maxWorkers=1

node scripts/qa-event-command-repairs.mjs --scenario map-effects --phase green
```

Raw local evidence is under `output/evidence/event-command-repairs/map/red/` and `map/green/`. Start with `SUMMARY.md`; unit JSON and actual sprite/state observations are separate from the screenshot's basic visual contents.

### Preserved boundaries

- Relocation writes session state, not authored event coordinates.
- Current live/saved positions are used for swaps; spawned templates and map membership survive cross-map relocation.
- Affected motion is cancelled in foreground and parallel hosts, including hop/push state, before refreshed rendering.
- Headless execution consumes the relocation handoff without pretending to render.
- Present `resourceId`, including an empty string, wins over legacy `value`.
- System BGM/SE retain their IDs and volume metadata. Their generic schema does not select a system-cue slot, so no invented immediate playback or full-support claim is made.
- Explicit weather intensity, including zero, overrides embedded legacy strength. Omitted intensity keeps legacy recording/defaults.

## Sound Layer

- RED: the original 12 cases failed on channel, per-track gain, ambient restore and save parsing. Expanded mixer/save coverage was also observed failing before its implementation; fade-out mute had a separate failing regression.
- GREEN: the supervisor ran 134 tests, including 27 repair cases, with no failures.
- The real player decoded and played independent test PCM tones. Observed HTMLAudioElement state was BGM `0.7`, simultaneous BGS `0.441`, SE `0.504` with `loop=false`, and ambient `0` then `0.175`. The user mixer remained `0.7`/`0.8`.
- Saving through the real save menu and loading through the real load panel restored BGM/BGS/ambient with their gains. The saved one-shot was not replayed; field keyboard control returned.
- Browser/server cleanup receipts are true. Supervisor app typecheck and player build passed.

```bash
npm test -- test/eventCommandAudioRepairs.test.ts test/audioEngine.test.ts \
  test/audioEnginePlaybackControls.test.ts test/cc0AudioPlayback.test.ts \
  test/saveAndReferences.test.ts test/autosave.test.ts test/interpreter.test.ts \
  --maxWorkers=1

node scripts/qa-event-command-repairs.mjs --scenario audio-layers --phase green
```

Evidence: `output/evidence/event-command-repairs/audio/red/` and `audio/green/`.
Media `playing`/`ended`, current time, loop and gain observations are captured in `report.json`; a static screenshot alone is not an audio proof.

## Battle choices and terminal control

- RED: 66 of the original 69 runtime cases failed before implementation. Separate host, session, simulation and ownership regressions were also captured before their changes.
- Supervisor GREEN: 188 battle tests passed. The integrated battle/map/audio run passed 316 tests. A newly detected map-choice cancellation regression was captured and fixed; its 16-test adjacent run passed.
- A fresh compiler pass checked 30 changed/new TypeScript roots without diagnostics. App typecheck and the exported-player build passed.
- The supervisor completed all 20 real-player runs in one full invocation: gauge/strict, second-option Enter/Z, disallowed/mapped/branch cancellation, four terminal commands, pending-context teardown and restart.
- No branch executes before a choice response. Nested caller/page tails execute once after a valid selection, and terminal tails stay zero. Non-browser simulations now report `BATTLE_EVENT_INPUT_REQUIRED` instead of inventing a choice.
- The browser matrix observes battle-local values through authored prompt substitutions, then verifies actual session write-back. It never invokes the runtime's response method or injects effect results.
- All 20 contexts closed with no pending observers/pages; browser and server closed. In-document replacement safety is covered by the real host/session integration tests, not claimed from browser-context restart alone.

```bash
node scripts/qa-event-command-repairs.mjs --scenario battle-flow \
  --out output/evidence/event-command-repairs/battle-flow-stable
```

Start with `battle-flow-stable/SUMMARY.md`, `summary.json` and `cleanup.json`.
An earlier run stopped after 15 passing cases because a local asset GET reset the connection; that attempt is retained and is not accepted as a complete run. Transparent local request forwarding now handles connection-reset retries for idempotent asset reads only; scenario failures are never retried or hidden.

The gauge force-escape result screenshot initially preceded its entrance animation. The capture now awaits actual visibility, and the focused `battle-flow-visible` run confirms the visible result and confirmation control.

## Battle friendship, level and HUD

- RED: the expanded state suite had seven failures and one nonreturning-defeat control. The existing-row HUD test separately observed level 7 instead of 11.
- Supervisor GREEN: all 43 state/HUD/reward/relationship/active-slot tests passed after integration. Changed-file diagnostics, app typecheck and player build passed.
- Real player: Guard triggered level 7 to 11 and maximum HP 700 to 1100 without healing current HP 300 or MP 20. After forced escape, the session retained level 11, maximum HP 1100 and friendship 56 instead of its initial 37. Field keyboard movement resumed.
- Screenshots visibly show level 7 then 11 and current HP 300. Maximum HP is verified through actual DOM/session state: the existing VX Ace skin intentionally hides the denominator.
- The friendship write-set preserves unrelated concurrent session keys; permitted defeat/victory/escape return changes, while nonreturning defeat does not.
- Browser/server cleanup receipts are true; the run reported no runtime errors.

```bash
npm test -- test/battleEventRepairState.test.ts test/battleEventRepairHud.test.ts \
  test/battleRewardsToSession.test.ts test/relationshipBattleWriteBack.test.ts \
  test/battleActiveSlotsEvents.test.ts --maxWorkers=1
node scripts/qa-event-command-repairs.mjs --scenario battle-state --phase green
```

Evidence: `output/evidence/event-command-repairs/battle-state/{red,green}/`.
