# Phase 2 forest protection producer evidence

Task: `st_01a07409`; parent/root session: `01a072aa-d666-7ef3-a123-c923fcda0392`.
Date: 2026-09-06. Worktree: `/home/main/z-project/rpg-zzu-house-protection-p2-forest`.
Branch: `agent/house-protection-p2-forest`.
Immutable production baseline: `e238eb1908b0f6fcdc32011d6e2419797f442704` (merged Phase 1).
Contract read from the primary Phase 2 worktree's `.omo/evidence/house-protection/p2/contract.md`.

Initial unit: `2b19732360cebbf143553b10fefe41fadbf4f8b8`. Its historical results
are retained below; the supervisor-requested tree-base follow-up is recorded at
the end with its own RED/GREEN and updated verification.

## Delivered boundary

- `src/editor/tools/forestComposition.ts`: capture `protectedHouseCells` before
  composition; preflight floor tone/litter, gap closure, edge feathering,
  undergrowth and complete 2x2 puddle candidates. Pass the same house exclusion
  to the existing autotile neighbor-write predicate (including outside the area).
- `src/editor/tools/placePropsDomain.ts`: the single-tile bush path now includes
  house metadata in its existing protected-cell set before either layer writes.
  This is narrowly necessary placement support: forest bushes use this path, not
  the already-protected tree scatter path.
- `test/houseProtectionForest.test.ts`: 15 deterministic tests. Production shared
  signatures, `placementTools.ts`, `houseProtection.ts`, `toolRunner.ts`,
  constructionTools, village code and wiki are unchanged.
- Evidence here includes the runnable tool-surface exercise and full command logs
  with terminal color escapes and trailing whitespace removed only. Every file edit used `apply_patch`
  (`/tmp/apply_patch`, the installed unified-diff wrapper).

No restore-after-mutation, bypass/force option, raw-wall completion inference,
project schema, global lock or final-guard weakening was introduced. The final
Phase 1 transaction guard remains the backstop after global postprocessing.
Geometry deliberately remains the existing metadata contract: the complete house
bbox and north ridge, recorded roof-deck attachment, and human stamp rectangles,
regardless of empty/passable cells or stack contents. Seeds remain deterministic.

## RED before production, then GREEN

`npm test -- test/houseProtectionForest.test.ts`

- Before production edits: exit **1**, **13 failed / 2 passed** (`red.log`).
  Every new direct-write case reached its real offending writer; there were no
  fixture/control failures. The two whole-tree candidate tests already passed
  against Phase 1, including `avoidProtected:false` and canopy-only intersections.
- After production edits: exit **0**, **15 passed** in one run (`green.log`).
- Direct tests observe writes through array proxies, so restoring old values after
  writing does not satisfy them. They also compare complete snapshots (both layers,
  absent/empty/ordered stacks) and call the unchanged final invariant.
- Each isolated direct-path case has an unowned control proving that the writer
  would act on the protected target, plus positive unowned placement assertions.
  Only the preceding prop-placement stage is stubbed for these tests. Reachability,
  real RNG, puddle selection and 4/8-neighbor autotiling execute normally. The tone
  case supplies an alternate vocabulary tile because shipped tone tiles are all
  excluded by the existing 1x1-grass filter. Full composition and public tool tests
  use no mocks.
- Puddle regression protects one corner of a selected 2x2 clearing and requires
  the whole candidate to remain untouched while another complete puddle is placed.
- Real dense/impassable compositions preserve roof ridge, empty upper/lower cells,
  wall/decor cells, roof-deck ladder, human stamps and all snapshot stack values.
- Public `place_props` calls succeed after real serialize/deserialize. Subsequent
  adversarial composition-plus-house mutation is rejected with
  `protected-house-write`, rolling back the entire transaction exactly.

## Related tests and immutable baseline comparison

Before production edits, the following command **without the new test file** ran
against baseline production: exit **1**, **158 passed / 7 failed**, 18 files
(`baseline-related.log`). After edits, the complete command below returned exit
**1**, **173 passed / 7 failed**, 19 files (`related.log`). Exact failing test
identities were compared programmatically and are identical: **zero new failures**.
No pre-existing test assertion was changed or skipped.

```sh
npm test -- test/houseProtectionForest.test.ts \
  test/forestDensity.test.ts test/forestDensityPriority.test.ts \
  test/forestFloorMix.test.ts test/forestTrunkLayers.test.ts \
  test/narrowForestRepro.test.ts test/densePackingPlacement.test.ts \
  test/placementStructure.test.ts test/placementScoring.test.ts \
  test/placementSurface.test.ts test/clusterRulePlacement.test.ts \
  test/villageTreePlacement.test.ts test/houseProtection.test.ts \
  test/toolHouseProtection.test.ts test/regionTaskHouseProtection.test.ts \
  test/applyProposedProjectHouseProtection.test.ts \
  test/clusterAiModalHouseProtection.test.ts test/placePropsZeroPlacement.test.ts \
  test/forestWrites.test.ts
```

Known baseline failures retained verbatim in both logs:

- `forestDensity.test.ts:227,298`: both dense passability assertions observe
  `0.3003472222222222`, exceeding the strict `< 0.3` threshold.
- `clusterRulePlacement.test.ts`: five pre-existing assertions for conifer/broadleaf
  painting, idempotent companion placement, and scatter tree layer/pair layout.
  Failures include expected `262`/`292` versus `-1`, and expected 3 conifer pairs
  versus 0. These are not reported as passing.

## Static and build verification

- LSP `all` diagnostics: **no diagnostics** for both changed production files,
  `test/houseProtectionForest.test.ts`, and `exercise.mts`.
- `npm run typecheck:app`: exit **0** (`typecheck.log`).
- `npm run build`: exit **0** (`build.log`), including app typecheck, editor bundle,
  player bundle/SDK manifest and standalone player bundle. Build output retains
  asset-resolution-at-runtime and large-chunk warnings; they were not suppressed.
- `git diff --check`: clean before staging.

## Real tool-surface exercise

```sh
node_modules/.bin/vite-node --config vitest.config.ts \
  .omo/evidence/house-protection/p2-forest/exercise.mts
```

Exit **0**, assertions and measured JSON in `exercise.log`:

| Map | House | Forest | Placed objects | Protected cells | Outcome |
| --- | --- | --- | ---: | ---: | --- |
| 50x50 | blue-stone, multiwing, linked interior, human stamp | dense | 1380 | 104 | exact preservation, save/load preservation, later erase rejected |
| 100x100 | bright-plaster, roof deck, linked interior, human stamp | impassable | 5702 | 68 | exact preservation, save/load preservation, later erase rejected |

These use actual `runTool` entry points: `create_map`, `author_house`,
`place_props`, `tile_erase`, with real project serialization between operations.
They are ephemeral verification fixtures, not authored/shared DB content.
An initial attempt to run the same exercise from `/tmp` failed module loading
outside Vite's worktree surface (`exercise-launch-failure.log`). Moving the
reproducer into this evidence directory corrected the launch path; no production
change or suppressed assertion was needed.

## Limits and handoff

This producer verifies forest and its necessary placement support only. It does
not claim integrated village snow/boulevard lifecycle, connected-road/browser QA,
LegacyDb content persistence, full repository gates, independent review or merge
approval. Those remain the supervisor/integration responsibilities in the Phase 2
contract. No push, PR, main merge or unrelated-file edit was performed.

Attribution:

Ultraworked with [omo](https://github.com/code-yeongyu/oh-my-openagent)

Co-authored-by: sisyphus-dev-ai <sisyphus-dev-ai@users.noreply.github.com>

## Initial unit verified source SHA-256

```text
dd3dda8292f82e78e2484dc18b4d2e03a072824a16fcd3dc970a1b77c3fba4ab  src/editor/tools/forestComposition.ts
9d327705d4c165e6b9398f14cbd04c8ff0f7c690bbe7db83062a63bf407afca8  src/editor/tools/placePropsDomain.ts
e512d8d228027de1fd83719d5fa0bf5038288cb1e876a8cba537cf533b7bc30e  test/houseProtectionForest.test.ts
55a1b98603fdc72b1d2dc5cb0caeab46f8e7c45e81ab7bbdc87897a0c4743b8a  .omo/evidence/house-protection/p2-forest/exercise.mts
```

## Supervisor follow-up: supported ungrouped tree-base boundary

The bundled labels for trunks 290/291/292/293 resolve to patterned conifer,
dry-tree or broadleaf groups with `preferGroup:true`; those already use Phase 1
whole-footprint rejection. Numeric tile IDs and group IDs were not made into new
material inputs.

However, `resolveMaterialByLabel` explicitly supports ungrouped tile metadata,
including soft-confirmed materials. Keeping the existing label/role for 290 and
removing only its containing groups in a fixture makes `침엽수 하단` resolve through
the real resolver to `{ status: "soft", kind: "tile", tileId: 290 }`. The public
`place_props` tool accepts that input. A runtime probe reproduced an atomic
`protected-house-write` failure at the repair canopy `(3,5)` after placing a trunk
at `(3,6)`, even though candidates `(7,6)` and `(8,6)` were viable.

The fix adds one existing trunk-ID predicate and a preflight for the cell one row
north to `placePropsDomain.ts`. A protected repair canopy rejects the candidate
before either layer's trunk write, leaving the count available for other targets.
This uses the existing house/event protection set. It does not change material
resolution, tree repair, shared signatures, or the Phase 1 final invariant.

One no-mock boundary regression verifies the real resolver result, the direct
placement path's untouched rejected trunk cells, two viable outside trunks, and
successful public tool commit with repaired outside canopies and exact house
layer/stack snapshots.

Verification of the follow-up (same commands as above):

- `tree-base-red.log`: exit **1**, **1 failed / 15 passed** before production edits;
  rejected candidate contained trunk **290**, expected unchanged grass **240**.
- `tree-base-green.log`: exit **0**, **16 passed** in one run after the preflight.
- `tree-base-related.log`: exit **1**, **174 passed / 7 failed**, 19 files. The exact
  seven failure identities match `baseline-related.log`; no new failures. The two
  density assertions still report `0.3003472222222222` versus `< 0.3`, and the five
  cluster-placement failures remain unchanged.
- LSP `all` diagnostics: none for `placePropsDomain.ts` or the updated test file.
- `tree-base-typecheck.log`: application typecheck exit **0**.
- `tree-base-build.log`: full build exit **0**, retaining asset/chunk warnings.
- `tree-base-exercise.log`: real 50x50/100x100 tool exercise exit **0**, with the
  same 1380/5702 objects placed and exact preservation/save-load/erase rejection.
- `git diff --check`: clean.

Latest changed-source SHA-256 (supersedes these two entries in the initial unit):

```text
bb201a5fc36a09ecde405ca60886e12de0ff5f374024205263043d2eac18b7e3  src/editor/tools/placePropsDomain.ts
4f765966e38ca8a312a453b4b3fc3218de20a02edf0efc60b68f7685ac61c2a0  test/houseProtectionForest.test.ts
```
