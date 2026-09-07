# Task12 placement safety: verified nonvisual core only

## Outcome and identity

Implemented the approved persistent/live occupancy split, call-scoped full-body transaction checks, adjacent full-body targeting, last-local-exit protection, and the narrow farming self-plot exemption. This does **not** complete task12: no actual scene/UI adapter, browser/native QA, renderer fix, or aesthetic approval is claimed.

- Worktree: `/home/main/z-project/rpg-zzu-life-full-placement-core`
- Branch: `agent/life-full-placement-core`
- Integration base, checked before edits: `961135f8dccb240faf938df664af8b5413bbbdad`
- Core source identity: `source.sha256` records all four changed production modules, the new test, the sole wiki page, and public probe. The single commit containing this summary is the core deliverable; resolve it with `git log -1 --format=%H -- .omo/evidence/life-full-20260906/12/core/SUMMARY.md`. Its exact SHA is also reported in the child handoff.
- Read approved `EXECUTED_PLAN.md` and parent `11/VERIFY.md` and `14/VERIFY.md` at `/home/main/z-project/rpg-zzu-life-full-p4/.omo/evidence/life-full-20260906/`. Both upstream verifications confirmed their separate scopes. Initial branch/index/source were clean after the parent's setup recovery. No old setup-failure evidence was removed or overwritten.

## Minimal Grok adapter handoff

Exports in `src/project/spatialOccupancy.ts`:

```ts
type SpatialLiveActor = {
  readonly mapId: string;
  readonly x: number; // foot anchor, not top-left
  readonly y: number;
  readonly footprint: CharacterFootprint; // FULL resolved body size
  readonly passRows?: number; // movement only, never placement body size
};
type SpatialLiveContext = {
  readonly player: SpatialLiveActor;
  readonly npcs: readonly SpatialLiveActor[];
};
type SpatialLiveContextReader = () => SpatialLiveContext;
```

1. Implement one reader in the actual scene adapter. On **each invocation**, resolve the current player body and active NPC/event bodies from the existing runtime authorities and actual live event positions. Do not substitute passage dimensions for full body dimensions. Do not close over a preview snapshot. Core code has no DOM/Phaser globals or scene imports.
2. Target placement/move with `adjacentSpatialPosition(player, direction, footprint, orientation)`. The return is `{mapId,x,y,orientation}`. The oriented footprint supplies W/H; up=`body.top-H`, down=`body.bottom+1`, left=`body.left-W`, right=`body.right+1`. The other coordinate aligns with body.left/body.top. Outside-map targets are returned naturally and refused by occupancy; no silent clamping.
3. Preview with `canPlaceSpatialFootprint(project, session, position, footprint, readLive, exclude?, blocksMovement=true)`. For a moved/rotated/upgraded instance, pass `{kind:"farmBuilding"|"homeDecoration",instanceId}`; for decor, pass its actual `blocksMovement` flag. Use the complete next-level/oriented footprint, not the old footprint.
4. Pass the same **reader function**, not its preview result, as the new final optional argument to **all six** public mutation APIs in `spatialPlacementTransactions.ts`: `placeFarmBuilding`, `moveFarmBuilding`, `upgradeFarmBuilding`, `placeHomeDecoration`, `moveHomeDecoration`, `rotateHomeDecoration`. Each actual synchronous transaction runs the fresh check before spending or changing state. Refusal stays `{ok:false,reason:"blocked"}`. Demolition/removal signatures and policies are unchanged.
5. Reader omission intentionally preserves the legacy/static public API. Until the adapter supplies it on every live mutation, existing UI callers do **not** gain full live safety. No core-only claim should be relabeled as scene completion.
6. Never store this reader/context on NewSpatialPlacement, PlaySession, Project session, or SaveSnapshot. New placement construction explicitly whitelists the six persistent fields, including when a structurally typed caller carries extra live data.

`canOccupySpatialFootprint` remains the persistent authority: terrain, all oriented building/decor footprints, placeables, chests, actual plots. Restoration and forage remain static. Actual plots block construction/forage, but farmable area metadata alone does not reserve space. Farming excludes only its current plot from its temporary occupancy view; overlapping buildings/chests/other assets remain blocking.

Local exit protection compares current and proposed one-tile player movement neighbors using `canMoveFootprint` and passage geometry. NPC passage rectangles, buildings, blocking decorations, placeables and chests constrain walking; plots/nonblocking rugs do not. A blocking placement may not close the final existing neighbor. A move may open a different neighbor. Pre-existing confinement or body overhang at an edge does not globally prohibit unrelated construction. This is not global pathfinding or a guarantee of reaching a distant map exit.

## Verification: actual runs, not estimates

Logs named `.log` below are committed as lossless `.log.gz` files (`gzip -cd <file>.log.gz`); readable originals remain locally ignored. This preserves exact raw output, including upstream trailing whitespace/blank lines that otherwise make the staged whitespace validator fail. No output was trimmed. Evidence staging required `git add --sparse` for this explicitly requested, sparse-excluded evidence directory; no sparse patterns changed.

All heavy commands used bounded `timeout` and the shared lock `/tmp/rpg-zzu-life-full-qa-01a0727b.lock` (180-second bounded lock acquisition). Tests used at most two workers. Every `.exit` is the command status captured before displaying log tails, not a pipeline's status. No sleep, polling, retry configuration, test deletion, `.skip`, weakened assertion, dependency addition, remote write, or full13k gate was introduced.

| Evidence | Actual result |
| --- | --- |
| `legacy.log/.exit` | Before production edits: existing spatial transaction and persistence characterization, **6/6**, 2 files, exit0. |
| `red.log/.exit` | First new-test run on unchanged base: 7 failed/1 passed, exit1. Four intended behavioral failures, two unavailable-new-export errors, and one probe-fixture error (`session.player` rather than existing `session.x/y`). The last three are explicitly **not** behavioral RED proof. Original output retained. |
| `red-behavior.log/.exit` | After correcting the fixture, still before production edits: selected six cases using existing public APIs, **4 intended failures/2 passes**, exit1. Failures: full3x3 body, move/expansion, last-local-exit closure, actual plot occupancy. The `-t` selection did not execute the two future-export tests (Vitest labels them skipped); no test was deleted or marked skip, and all are included in GREEN. |
| `green.log/.exit` | First full corrected behavioral implementation run: **269/269**, 15 files, exit0. Subsequent diagnostics caught an optional `placeables` type in a newly added test; corrected with `?? {}` without changing assertions. |
| `final-green.log/.exit` | Final source/test bytes through the normal npm test runner: **269/269**, 15 files, exit0. |
| `cache-isolated-green.log/.exit` | Same final bytes/selection, direct repository runner with `--configLoader runner --cache=false`: **269/269**, 15 files, exit0, no skipped/pending tests. This environmental correction avoids the repository Vitest default shared results cache; it was not a retry of failing tests. |
| `diagnostics.json/.exit`, `diagnostics.mjs` | Before app typecheck/build: actual TS compiler syntactic+semantic diagnostics for four production files, new test and public probe in tsconfig.json context: **0**, exit0. Language-server checks also clean on production files/test. The evidence probe's standalone inferred LSP context could not resolve aliases; relative imports and this configured compiler check resolved that tooling boundary. |
| `public-probe.mts/.log/.exit` | Actual vite-node imports of public placement/restore/farming/save modules: **exit0**. Full-body adjacent targeting; successful preview then moved-NPC refusal with entire session equality; accepted construction/rug; static restore under actor overlap; public till/plant/water/day-growth/water/day-growth/harvest; Save5 storage parse/apply roundtrip; invalid direct apply refused while prior raw slot remained unchanged; no live context serialized. No mocked transaction/restore/farming APIs. |
| `public-probe-fixture-failure.log/.exit` | Preserved first probe exit1: the chosen farming-demo construction target was not accepted by preflight. Corrected fixture design uses blank terrain for spatial APIs and the actual farming demo/session for farming, rather than assuming the demo's construction space is empty. No product change or assertion removal was made to pass this probe. |
| `typecheck.log/.exit` | `npm run typecheck:app`: **exit0**. |
| `build.log/.exit`, `build-wrapper.exit` | `npm run build`: **exit0**, app + exported player/SDK + standalone. Existing warning classes retained in raw output, including unresolved runtime asset URLs and large chunks. |
| `source.sha256`, `cleanup.json` | Exact verified source hashes and owned temporary-output cleanup. `git diff --check`: exit0 before commit. |

The 15-file selection includes the new **11-case** `lifePlacementSafety`, spatial transactions/persistence/schema/references, linkedAnimalHousing, spatialPaymentReceipts, lifeRecoveryPersistence, seasonalForage, toolActionAuthoringParity, p2LifeRuntime, p2HostileAudit, lifeFieldInteraction, lifeSkillDisabledHarvest and p2SessionPersistence. H1/H2, 4096-claim voluntary demolition, paid-resource recovery and restore regressions pass unchanged.

New tests cover every cell of a full3x3 body with one passage row; all four adjacent targeting directions; moved NPC context between preview/apply; moved/rotated/expanded footprints; rotated boundary refusal; edge body overhang; last-exit refusal with whole-session/cost equality and save roundtrip; plot blocking versus self-water/harvest; plot-blocked forage generation; rug/building restoration under transient overlap; whitelisted nonpersisted context; persistent plot incompatibility with exactly-once proved-cost recovery and valid save roundtrip.

## Commands and limits

Reproduce from the specified worktree with the existing dependency link:

```sh
# Prefix heavy commands with timeout and the shared flock noted above.
node scripts/run-vitest.mjs run --configLoader runner --cache=false \
  test/lifePlacementSafety.test.ts test/p2SpatialTransactions.test.ts \
  test/p2SpatialPersistence.test.ts test/p2SpatialSchema.test.ts \
  test/p2SpatialReferenceIntegrity.test.ts test/linkedAnimalHousing.test.ts \
  test/spatialPaymentReceipts.test.ts test/lifeRecoveryPersistence.test.ts \
  test/seasonalForage.test.ts test/toolActionAuthoringParity.test.ts \
  test/p2LifeRuntime.test.ts test/p2HostileAudit.test.ts \
  test/lifeFieldInteraction.test.ts test/lifeSkillDisabledHarvest.test.ts \
  test/p2SessionPersistence.test.ts --maxWorkers=2 --minWorkers=1
node .omo/evidence/life-full-20260906/12/core/diagnostics.mjs
node node_modules/vite-node/vite-node.mjs --config vitest.config.ts \
  .omo/evidence/life-full-20260906/12/core/public-probe.mts
npm run typecheck:app
npm run build
```

TMPDIR and app Vite cache were owned under `/dev/shm/st_01a0791b/`; `dist` was a checked-new symlink to owned tmpfs output (238MB before cleanup). Earlier npm Vitest runs used the repository's default shared results cache despite VITE_CACHE_DIR (the test config does not consume that variable); final verification disabled that cache and used the runner loader. Shared dependency/cache state was not deleted. No sparse paths or product configs changed to mask missing files. Wiki edit is only `runtime-project-schema.md`; parent integration owns any generated INDEX refresh.

Whole-project baseline limitations remain inherited, not waived: parent task11 records prior whole-wrapper timeout124, Vitest exit1 with 219 failures/15 pending and surface exit1, with attribution limits. This child did not rerun or claim to resolve those gates. Tasks45/46 renderer/source bugs and task12's actual scene adapter/native QA remain outside this core. Parent alone merges; no push, PR or merge is part of this deliverable.
