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
