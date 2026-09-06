# Phase 2 integrated house protection

Task `st_01a0741d`, parent/root `01a072aa-d666-7ef3-a123-c923fcda0392`.
Date: 2026-09-06. Only integration worktree:
`/home/main/z-project/rpg-zzu-house-protection-p2`, branch
`agent/house-protection-p2`. Immutable baseline:
`e238eb1908b0f6fcdc32011d6e2419797f442704` (Phase 1 / PR608).

## Integrated producers

Read both producer READMEs, commits and complete production/test diffs before
merging only the two authorized branches. Both merges were conflict-free:

- Fill: implementation `552ee4d83a2919a7af2edfe52ab87aa5e7946e20`, evidence
  `b92bb9d6`; merge `c3b5bea3`.
- Forest: implementation `2b19732360cebbf143553b10fefe41fadbf4f8b8` plus
  ungrouped repair-canopy correction `3662c6da`; merge `a140b513`.

No producer production/test file required an integration correction. Their
existing evidence remains under sibling `p2-fill/` and `p2-forest/` directories.

## Delivered contract

- Village house-owned doors, ridge/roof/deck, wall banners/signs and linked
  interiors finish before metadata publication and roads/terrain/environment.
  `finishVillageHouseDecor` is separate from environmental decoration.
- One local set of exact copied layer/stack snapshots per builder invocation
  survives every subsequent stage. Assertions follow roads, fences, terrain,
  decor, landscape, cleanup, NPCs and snow; road sub-stages assert before retry
  rollback. No post-environment door/ridge restoration remains.
- The standalone registration WeakMap is unchanged. Village does not put its
  seals there: discarded pipeline maps cannot leave stale project-wide seals.
- Preexisting metadata houses/human stamp geometry excludes candidates and
  direct roads/plaza/decor/landscape/snow writes, including neighbor autotiles.
  All old layout regions survive; IDs remain unique. Existing custom roof-deck
  templates get the existing `roof-deck` tag. Geometry is bbox + north ridge +
  recorded ladder attachment, never the whole yard.
- An additional demonstrated facade boundary defect is prevented at its cause:
  a new house cannot cover the accepted start, which the existing-target facade
  later restores. This prevents a sealed door being reopened after the builder.
- The placement scrub receives a narrow optional write predicate from the
  builder. Other callers keep existing semantics. Protected corruption is
  rejected before scrub, not scrubbed back into an accepted snapshot.
- Fill preserves both layers/stacks, clearUpper and neighbor reshapes, checking
  both-layer structure fallback without inventing metadata. Its receipt retains
  `filled`, adds final distinct `mutatedCells`, and reports skipped candidates.
- Forest protects direct floor/bush/closure/feather/undergrowth/puddle writes and
  whole tree footprints, including supported ungrouped trunks' repair canopies.
- No Phase 1 guard change, schema, UI, shared DB content, force option, human
  brush restriction, or changes to exact/best-effort/connected-road contracts.

## RED before production; GREEN afterward

1. `npm test -- test/houseProtectionLifecycle.test.ts --maxWorkers=2` before any
   village production edit: **7 failed / 7**, exit 1 (`lifecycle-red.log`). Road
   entry saw **zero** metadata owners rather than 4; each real environmental
   stage plus adversarial door damage still returned `ok:true` on the baseline.
2. `npm test -- test/villageHouseProtection.test.ts --maxWorkers=2` before any
   village production edit: **9 failed / 9**, exit 1 (`exclusion-red.log`). Array
   proxies observed protected writes; metadata-only candidates were reused and
   previous non-house regions disappeared.
3. After production: both new files **16 passed / 16**, exit 0
   (`initial-green.log`).
4. Additional facade start repro, before its candidate fix: sealed door at
   `(6,44)` changed **146 -> 240**, exit 1 (`start-red.log`). After the candidate
   exclusion: **1 passed**, exit 0 (`start-green.log`; `-t` selects that repro).
5. Final complete primary command, no test filtering/skips, exit **0**:

   ```sh
   npm test -- test/houseProtectionFill.test.ts test/houseProtectionForest.test.ts \
     test/houseProtectionLifecycle.test.ts test/villageHouseProtection.test.ts --maxWorkers=2
   ```

   **62 passed**, four files, 59.94s (`primary-final.log`): fill 20, forest 16,
   lifecycle 17, village direct exclusion 9. All six kits, multiwing, linked
   two-story house, deck/ladder, 50x50/100x100 snow, real serialization and later
   fill/forest are covered. Real road/fence/terrain/decor/landscape/scrub stages
   run before injected damage; rejection occurs before restoration. A real
   failed-look attempt is discarded and the next succeeds without stale seals.

Tests use no sleeps/polling, snapshots are never refreshed after damage, and
array proxies reject even a transient write followed by restoration. Existing
regression assertions were not edited or skipped to pass.

## Related regression comparison

`related.log` and `baseline-related.log` contain the same complete 30-file
command and output. Both ran with `--maxWorkers=2`; baseline ran in the clean
immutable Phase 1 worktree. Both: **378 passed / 6 failed**, 384 tests. Both also
reported **2 Vitest RPC `Timeout calling "onTaskUpdate"` errors**. These commands
are red, not passes. Test IDs and assertion messages/expected/received values
were compared programmatically: identical, no new failures or value changes.

The six baseline failures are four `authorHouseFacade` cases (exterior-only
fixture/invalid-wing/clearance-warning/yard-shortfall contracts) and two
`houseLotTools` cases (missing `꽃` material, zero-placement yard). No fix was
attempted outside this increment. Passing suites include villageBuilder (also
real multi-turn `run_village_session`), authorVillageFacade (100x100 snow 20
houses/50 NPCs), villageProducerProtection, roadObstacleAvoidance, houseKit,
houseDoorOpen, region/live/cluster guards and pipeline map pruning.

`producer-related.log`: **158 passed / 7 failed**, 165 tests across 20 files,
exit 1. The seven assertion messages and values exactly match the forest
producer's immutable `p2-forest/baseline-related.log`: five cluster placement
layout failures, two forest passability ratios **0.3003472222222222 >= 0.3**.
The producer fill and forest primary tests also pass in the final primary run.

## Actual tool-surface exercise

```sh
node_modules/.bin/vite-node --config vitest.config.ts \
  .omo/evidence/house-protection/p2/exercise.mts
```

Exit **0** (`exercise.log`), no mocked tools/stages:
`create_map -> author_house(linked roof-deck) -> human stamp -> serialize/deserialize
-> author_village(existing, snow, exact) -> reload -> fill_region -> place_props
-> rejected tile_erase`. Every stage retains the old and newly accepted snapshots.

| Map | New houses | NPCs | Protected owners/cells | Filled / mutated | Forest placed | Road components |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 50x50 | 4 | 6 | 6 / 294 | 26 / 26 | 1200 | 1 |
| 100x100 | 20 | 50 | 22 / 1099 | 27 / 27 | 4800 | 1 |

Both keep all old/new house fronts passable, retained region IDs unique, ordered
and empty human stack entries exact, and the recorded deck ladder intact. Later
protected erases reject atomically with `protected-house-write`. This is code QA
using ephemeral fixtures, not authored/shared project content; no DB writes.

## Static/build verification and execution notes

- LSP `all`: no diagnostics on all 11 changed TypeScript production files, all
  four primary test files and the exercise script.
- `npm run typecheck:app`: exit 0 (`app-typecheck.log`). Final full build also
  reruns application typecheck on the final production source.
- TypeScript `createProgram` using tsconfig options, `src/vite-env.d.ts` and all
  four primary test roots: **0 diagnostics**, exit 0 (`scoped-typecheck.log`).
- Final `npm run build`: exit **0** (`build.log`), app typecheck, editor bundle,
  player/SDK and standalone bundle. Existing circular reexport, mixed imports,
  runtime asset-resolution and chunk-size warnings remain visible.
- An initial build launch was bounded at 300s and timed out during standalone
  transformation after editor/player had completed. The final full command used
  a 900s process bound, without changing test deadlines or build configuration.
- Exploratory test setup mistakes were corrected, not treated as passes: door
  trigger is `{kind:"playerTouch"}` (not a string); a human placement's `before`
  arrays must match its 3x3 area or IO drops the invalid fixture. A failed exact
  patch precondition applied no changes; its following selected repro stayed red.
- A one-house two-story `author_village` exploratory fixture hit its existing
  facade direct-exterior-link scope restriction for floor 2. The kit matrix
  exercises the same real multi-story builder through `build_village`; public
  facade linked single-story and existing 100x100 exact-count paths are separately
  verified. This increment does not alter facade map-scope policy.
- `npm run openwiki:verify`: exit 0, no failures. Generated INDEX was applied
  through `apply_patch`; `node scripts/openwiki-index.mjs --check`: exit 0.
- `git diff --check` was clean during verification. All source/test/wiki/evidence
  edits used `/tmp/apply_patch` (unified-diff wrapper). No push, PR or main merge.

Supervisor-owned aggregate checks remain full baseline/candidate gates, actual
browser village/landscaping proof and independent review/approval. The matching
testing wiki records the required identical pool environment:
`VITEST_MAX_FORKS=2 VITEST_MIN_FORKS=1 VITEST_MAX_THREADS=2 VITEST_MIN_THREADS=1 npm run gates`.
No producer work is deferred from this integration increment.

Ultraworked with [omo](https://github.com/code-yeongyu/oh-my-openagent)

Co-authored-by: sisyphus-dev-ai <sisyphus-dev-ai@users.noreply.github.com>
