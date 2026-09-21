# `bAlt` parity — the separate review OPRN-OUT-017 deferred

Branch `agent/baltparity`, worktree `/home/main/z-project/rpg-zzu-baltparity`, dev port 9864.
Date 2026-09-10. Task `st_01a08ac6`.

## Verdict (one sentence)

**Ignoring `bAlt`/`aAlt` in hard-cluster expansion was a real, user-hittable authoring defect on
two independent tile families, so it is fixed with the narrowest change: the expander now asks the
validator's own predicate whether a companion cell already holds an accepted alternative, and if it
does, leaves that cell alone.**

## 1. What `bAlt` actually is (from source, not from its name)

`bAlt` is **not** a "preferred alternative art" hint and **not** a softening of a hard rule. It is
the set of tiles that may legally stand in the companion cell **instead of** the canonical `b`.
`aAlt` is its counterpart for the reverse (b→a) direction and is explicitly *not* permission to
skip the reverse check.

| Where | What it says |
|---|---|
| `src/project/lint/clusterRuleValidators.ts:172-189` | `adjacencyViolation` — `a` at a coord requires `b` **or any `bAlt`** at the relation neighbor; `b` requires `a` **or any `aAlt`** at the opposite neighbor. |
| `src/project/lint/clusterRuleValidators.ts:203-232` (new) | `acceptedCompanionTiles(params, "forward"\|"reverse")`, `adjacencyCompanionSatisfied(map, at, accepted)`, `clusterAdjacencyParams(params)` — the shared predicate both contracts now read. |
| `src/project/lint/clusterRuleValidators.ts:468-475` | `hasAnyTileAt` — the check is **layer-agnostic** (lower, upper and both tile stacks). That matters because canopy lives on `upper` and trunk on `lower`. |
| `src/project/tilesetHarness/combinedTownGroups.ts:671-675` | Dry tree, `stackableTop`: `{a:261, b:291, bAlt:[261], relation:"aAboveB"}` — "261 under 261 is fine, the chain ends in 291". Registered at `combinedTownGroups.ts:281-288`. |
| `src/project/tilesetHarness/combinedTownGroups.ts:700-724` | Broadleaf 2×2: right column and bottom row carry `bAlt:[262]` so atoms may overlap diagonally (+1,+1) and read as a forest. The comment is explicit that this is *not* softening: 262 must still satisfy its own rules, so overlap only holds where another complete atom begins. |
| `src/project/tilesetHarness/interiorRoomGroups.ts:141-159` | Long table, two rules: `{a:325,b:326,aAlt:[326],bAlt:[327]}` and `{a:326,b:327,aAlt:[325],bAlt:[326]}`. Together they express "left cap, any number of bodies, right cap". |
| `src/editor/tools/v3/rowArrangement.ts:427-453` | `hardAdjacencyViolation` (the procedural row painter's static check) **already read `bAlt`** (`rowArrangement.ts:437-443`) — so the row painter could build a width-5 table that the manual brush could not. |
| `src/editor/content/skyStairMaps.ts:1663` | Authored content relies on the broadleaf `bAlt:[262]` overlap. |
| `scripts/gen-combined-town-chipset-report.mts:629` | The chipset report documents `bAlt:[262]` as the diagonal-overlap permission. |

RM2K3 lineage: these are the standard chipset composites — a vertical tree/statue/pillar pair, a
2×2 broadleaf canopy, and a horizontal `cap · repeat body · cap` furniture run. RM2K3 lets the
author repeat the body arbitrarily and lets forest canopies interlock; `bAlt`/`aAlt` is how this
repo encodes exactly those two freedoms in data.

**Producers** are the three harness group factories above (plus any user-authored rule via
`set_cluster_rule`). **Consumers** were the validator and `rowArrangement.ts` — and, until this
change, *not* `expandHardClusterPlacement`, which parsed only `{a, b, relation}` and dropped both
alternative lists on the floor (old `adjacencyParams`, removed in this change).

## 2. Reproduction — two defects, both user-reachable

Written as `test/clusterAssistAltParity.test.ts`. At the pre-fix commit it failed **2 of 7** tests;
the browser harness failed **3 of 5** scenarios. Concrete coordinates:

### Defect A — dry-tree stack silently destroys the terrain under it

Combined Town tileset, blank grass map. Paint canopy 261 at (5,6), then (5,5), then (5,4):

```
expected (bAlt:[261] says 261-under-261 is legal)     actual before the fix
(5,4) upper=261  lower=240 grass                      (5,4) upper=261  lower=240
(5,5) upper=261  lower=240 grass                      (5,5) upper=261  lower=291  <- buried trunk
(5,6) upper=261  lower=240 grass                      (5,6) upper=261  lower=291  <- buried trunk
(5,7) lower=291  (single chain end)                   (5,7) lower=291
```

Every interior cell of the stack got a **trunk-bottom 291 stamped onto the lower layer**, wiping
the grass. It hid under the canopy above it, `validateClusterRules` reported **zero** violations
(the buried trunk satisfies its own rule because a 261 sits above it), and erasing a canopy in the
middle of the stack **exposed a trunk base standing in mid-air**. One "paint one canopy" gesture
also touched two cells, so it was not the one-cell edit the user asked for.

### Defect B — a long table cannot be extended past its closed 3-cell form

Interior tileset (`easyrpg_chipset_interior`, bundled group `harness-interior-house-v1-tavern-table`).
Paint 325 at (3,5): assist correctly builds `325 326 327`. Now drop a body tile 326 on (5,5) to
lengthen it:

```
rejected: "타일 326 (5,5): 동반 타일 325 자리 (4,5)의 덧그림에 다른 오브젝트가 있습니다
           — 규칙: 긴 탁자는 좌 325 · 몸통 326(가로 반복) · 우 327로 닫아야 합니다."
kind: occupied-upper, companion 325 at (4,5)
```

The expander demanded the canonical `a`=325 at (4,5) where a perfectly legal 326 (`aAlt:[326]`)
already stood. The target layout `325 326 326 327` is accepted by `validateClusterRules` and is an
explicitly asserted-legal row in the pre-existing `test/interiorLongTable.test.ts:55`
(`it.each([... [325,326,326,326,327] ...])("accepts a closed table %j")`), and the procedural row
painter builds width-5 tables (`interiorLongTable.test.ts:78`, "the real row painter expands a
closed width-%s table"). Only the manual
cluster-assist brush could not — the one surface a human actually uses.

### Hypothesis that did NOT reproduce (recorded so it is not retried)

The broadleaf diagonal overlap looked like the obvious third case: calling
`expandHardClusterPlacement` directly with `originLayer:"lower"` and tile 262 on an existing atom's
293 cell returns `plan-conflict`. **Through the real paint path it is not a defect** — `effectiveLayer`
resolves canopy 262 to `upper`, the existing trunk 293 stays on `lower`, and `lower=293 + upper=262`
in one cell *is* the documented intended forest overlap. No user-visible symptom, before or after.

## 3. The fix

| File | Change |
|---|---|
| `src/project/lint/clusterRuleValidators.ts` | Exported the validator's own decision as `acceptedCompanionTiles`, `adjacencyCompanionSatisfied`, `clusterAdjacencyParams` + type `ClusterAdjacencyParams`, and rewired `adjacencyViolation` to call them. Behavior identical; the list is now shared instead of duplicated. |
| `src/editor/tools/clusterRulePlacement.ts` | `HardAdjacencyContext` carries `aAlt`/`bAlt`; parsing uses `clusterAdjacencyParams` (the local `adjacencyParams`, `integerParam`, `relationParam` duplicates are deleted); the expansion loop skips a companion when `companionAlreadySatisfied` says the map already holds an accepted tile there. |

`companionAlreadySatisfied` deliberately does **not** count two cells as satisfied:
1. the origin cell the user clicked (its old content is being overwritten right now), and
2. any cell this same placement already planned (the plan wins over the map's past value, and
   `add()` still detects genuine plan conflicts).

**What stayed intact, by construction:**
- Groups without alternatives are byte-identical: conifer 290 still forces canopy 260 above.
- Empty cells still get the canonical companion (one table body → closed `325 326 327`).
- Exact placement's guardrails are untouched (`planExactPlacement` still refuses protected cells and
  foreign upper objects); no change to `tileActions.ts` or `clusterAssistRecovery.ts` at all.
- Each operation is still one undo/redo unit (asserted in both the unit test and the browser proof).
- The two independent contracts (`autoConnectMode` vs `clusterAssistMode`) are not touched.

## 4. Trap found while reproducing (recorded, deliberately NOT fixed)

The shipped sample fixture `src/project/defaults/fixtures/dew-village-demo.json` still carries the
**pre-`bAlt`** dry-tree rule `{a:261, b:291, relation:"aAboveB"}`, and
`preserveHarnessGroup` (`src/project/tilesetHarness/combinedTown.ts:309`) never upgrades a group
that already has any rules. So under `?freshProject=1` (which loads that fixture — see
`src/editor/devShowcaseProjects.ts:61`) the dry-tree stack is not permitted by the rule data in the
first place. That is a tileset **data migration** question, not this contract, and changing group
preservation would silently rewrite user-customized rules. Recorded in
`openwiki/editor-validation.md`; the browser evidence uses `?blankProject=1`, whose tilesets come
from the factory and do carry `bAlt`.

## 5. Verification (all run in this worktree)

```
npm run typecheck:app                                       # exit 0, no output
npx vitest run test/clusterAssistAltParity.test.ts --maxWorkers=2          # 7 passed (2 failed pre-fix)
npx vitest run <21 cluster/tree/table suites> --maxWorkers=2               # 199 passed / 21 files
npx vitest run test/interiorLongTable.test.ts --maxWorkers=2               # 25 failed/27 passed == baseline
node scripts/qa/cluster-alt-parity.mjs                                     # 5/5 PASS, page errors: none
```

Suites in the 199: `clusterAssistAltParity`, `clusterAssistRecovery`, `clusterAssistUi`,
`clusterRulePlacement`, `clusterRuleValidators`, `clusterRuleSurface`, `clusterRuleAuthoring`,
`clusterRuleCommitGate`, `dryTreeStack`, `tileLayerPolicyClusterRegression`,
`treePlacementNamespaces`, `tileActions.m1`, `autotileClusterRules`, `repairTreePairs`,
`villageTreePlacement`, `authorHouseTreeClearance`, `farmingStarterTree`, `comboBrushPlacement`,
`structureKitPlacementConditions`, `tilePaletteStamp`, `postTileVerify`. No existing cluster test
was weakened or deleted.

### Baseline (measured, red before my change)

- **Full `npm run typecheck`: red at baseline.** Captured the sorted `error TS` set with my source
  changes reverted and again with them applied: **1006 lines, byte-identical** (`diff` clean). All of
  it is `test/**` and `vite.config.ts`; none in my files.
- **`npm run gates`: red at baseline**, failing before any gate runs at
  `vitest JSON 리포트가 생성되지 않았다: .omo/gates-vitest-report.json (exit=1)` — the report is never
  written. `npm run gates -- --only css` runs and reports **1 pre-existing** budget regression
  (`check-css-budget.mjs exit=1`); I changed no CSS.
- **`test/interiorLongTable.test.ts`: 25 failed / 27 passed at baseline.** Proven pre-existing by
  capturing the failing-test-name set with and without my change: identical 25 names
  (`diff` clean). Its cluster-expansion test fails at baseline because the test builds its group
  from `interiorRoomTileGroups()`, which returns the legacy 2-tile group with no alternatives.
- **`test/projectLint.test.ts`: 1 failed / 14 passed**, inside `mapLocationReferences.ts` —
  reproduced identically with my source changes reverted. Unrelated to cluster rules.
- `test/aiClusterAssist.test.ts` passes; its unhandled rejection
  (`session.retireRun is not a function`, `aiTurnRunner.ts:580`) is the pre-existing one already
  recorded in `.omo/evidence/oprn-017/NOTES.md`.

### Browser evidence — `verify-shots/balt-parity/`

`DEV_SERVER_PORT=9864 npm run dev:worktree` + `node scripts/qa/cluster-alt-parity.mjs` (real
Chromium, `?blankProject=1`, remote persistence asserted disabled, no sleeps — every wait is a
store-subscription signal with a bounded timeout).

| Scenario | Observed |
|---|---|
| `A-dry-tree-stack-keeps-terrain` | canopies `[261,261,261]`, terrain under the stack `[240,240]`, single chain end 291 |
| `B-erasing-mid-stack-exposes-no-buried-trunk` | erased (2,8) → lower stays 240; one undo restores the canopy |
| `C-stacking-one-canopy-is-one-undo-unit` | changed cells `["U122"]` (exactly one), one undo + one redo round-trip |
| `D-conifer-without-alternatives-still-forces-companion` | trunk 290 at (7,9) → canopy 260 above, unchanged |
| `E-long-table-extends-past-three-cells` | `[325,326,327]` → `[325,326,326,327]`, zero table lint violations |

Page errors: none. `RESULTS-without-fix.json` in the same directory is the **same harness against
the reverted source**: 2/5 PASS, failing with exactly the defect signatures (`got [291,291]` buried
trunks, `2 !== 1` cells touched, table extension rejected). The screenshots show a tall dry tree
standing on unbroken grass and a continuous 4-cell table.

## 6. Incident to flag (my mistake, already repaired)

I used `git stash push -u` to measure the baseline. **The worktree pool shares one stash stack with
the main repo**, another agent (`agent/uievidence`) pushed onto it during my window, and my
`git stash pop` consumed *their* entry into my worktree. I recovered my own work from the dangling
stash commit (`93b83a98c`), reverted their file out of my worktree, and put their stash back on the
stack with `git stash store` (labelled with the reason). Remaining baselines were measured with
`git diff > patch` + `git apply` instead. **Never `git stash` in this worktree pool.**

## 7. Blockers

None. No authored map/event content and no LegacyDb persistence is involved — this is editor-engine
code with local-only QA fixtures. One note for whoever runs the QA script: the dev server reads the
main repo's `.env.local` through the node_modules junction, whose LegacyDb host makes
`store.load()` take the remote branch and leave `remotePersistenceEnabled === true`. Blanking the
three `VITE_LEGACY_DB_*` values in the worktree's own (gitignored) `.env.local` for the run makes it
deterministic; I restored the file afterwards. Also: an HMR update to
`clusterRulePlacement.ts`/`clusterRuleValidators.ts` leaves the *next* page load unable to enter the
dev session, so restart the dev server between source edits and QA runs.
