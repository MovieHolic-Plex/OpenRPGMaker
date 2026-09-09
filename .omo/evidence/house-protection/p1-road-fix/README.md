# Phase 1 road compatibility fix

Task: st_01a072e2. Worktree: /home/main/z-project/rpg-zzu-house-protection-p1-roads.
Base: 02b496ae. Branch: agent/house-protection-p1-roads; no upstream.
All six original regressions pass. The final house invariant is unchanged.

## Production scope

- Seed road obstacles from the same accepted ownership geometry as the invariant:
  bbox gaps, empty full-width ridge, deck attachment and recorded human rectangles.
- Road-only autotile callers pass an optional write predicate to existing engines.
  Other callers, including fill, retain previous behavior.
- Equal-length BFS detours prefer south/front over north/ridge. Routing remains
  deterministic and shortest, and the original locality assertion passes unchanged.
- Supervisor-approved exception: only the road template receives fence protection.
  It uses exact recorded geometry, not general road collision or inferred locks.
  Fence rails/corners are independent single-cell units; each unit is skipped before
  emission if protected. The unprotected corner still emits. No other props changed.

## Exact RED/GREEN

| Command / state | Exit | Result | Evidence |
| --- | --- | --- | --- |
| npm test -- test/roadObstacleAvoidance.test.ts, untouched base | 1 | 6 failed, 7 passed; all six protected-house-write | red.log |
| Same suite with new tests, before production fix | 1 | 12 failed, 7 passed | observed before implementation |
| Requested three suites after initial road fix | 1 | 1 failed, 53 passed after south-first tie-break | fence-only blocker identified |
| npm test -- test/roadObstacleAvoidance.test.ts -t stamp_structure, before approved fence fix | 1 | 1 failed, 18 unselected | fence-red.log |
| Full focused command below, final implementation | 0 | 75 passed in 5 files | green.log |

Final command (single successful run, no skipped tests):

    npm test -- test/roadObstacleAvoidance.test.ts test/houseProtection.test.ts test/toolHouseProtection.test.ts test/autotileEngine.test.ts test/rmTypeExpanderV3.test.ts

Road suite: 19/19; house geometry: 23/23; house transactions: 12/12;
autotile engine: 15/15; v3 expander: 6/6. Original assertions are retained.
Added coverage checks full house equality (both layers, emptiness and stacks),
protected passable geometry, dirt/sand/v3 autotile neighbors and atomic rejection
of disconnected metadata barriers. Connected paint_road and lay_path detours pass.

## Other verification

- npm run typecheck:app: exit 0.
- npm run build:app: exit 0, 1m 32s. Vite reports its >500 kB chunk warning.
- Fresh TypeScript LSP: nine changed TS files, zero syntax/semantic/suggestion
  diagnostics. Persistent LSP tool timed out on three edited documents, so a fresh
  typescript-language-server --stdio process opened current file contents and used
  workspace/executeCommand -> typescript.tsserverRequest with
  syntacticDiagnosticsSync, semanticDiagnosticsSync and suggestionDiagnosticsSync.
  Every request awaited its exact response under a bounded 120s timeout; no polling.
  Raw responses: diagnostics.log.
- Real runTool smoke: paint_road, lay_path and stamp_structure all succeed and retain
  exact captured house values. The two detour tools report disconnectedSegments=0.
- git diff --check: exit 0. Validation output and smoke results: validation.log.

The fence RED was upper tile 379 at x=1..10,y=15, replacing EMPTY over the jittered
house bbox x=1,y=14,w=10,h=8. Its lower roads already skipped the house. The narrow
approved fence predicate fixes the producer instead of restoring or exempting writes.

Contract read from /home/main/z-project/rpg-zzu-house-protection-p1/.omo/evidence/house-protection/contract.md
(the isolated checkout did not contain that file). No village stages, fill, UI or
unrelated tests changed. No push, PR or merge.
