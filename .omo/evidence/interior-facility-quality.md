# Non-inn interior generation quality

## Scope

Improve the AI assistant's construction of house, shop, tavern, library,
smithy, church, warehouse, and guild interiors. Keep the inn output and
user-authored concept bundles intact.

The lead implemented the changes. OpenCodex Astra reviewed the generator
and interaction contracts; OpenCodex Luna independently inspected all
eight full-map images. No other provider was used for this work.

## Changes

| Facility | Composition change |
| --- | --- |
| House | Dining table on its rug, additional domestic seating, clock and bedroom rug |
| Shop | Two merchandise tables with a clear central sales aisle |
| Tavern | Additional seating, grouped rug/table placement and aligned seating rows |
| Library | Reading seats and a separate writing desk |
| Smithy | Paired forges, work table, work seat, tools and material staging |
| Church | Additional ceremonial seating around the existing focal furnishings |
| Warehouse | Six crates and four barrels in stock groups around the loading aisle |
| Guild | Records room and meeting room connected to reception, with working seats |

The grouped candidate rules apply only to the eight built-in non-inn facility
IDs. Object cells, wall grammar and doorway reservations are unchanged.
Single-cell prop candidates preserve reachable interaction approaches for
event, loot, sleep and transfer objects. A regression with nine crates and
loot in the fifth crate proves that stock cannot bury that interaction.

`get_concept_facility` now provides buildable reference plans for all eight.
These do not automatically replace the live template, resurrect deleted
furniture, migrate existing bundles, or rebuild existing maps.

## Verification

- Related tests: **110 passed in 6 files**, exit 0.
  - `test/conceptFacilityComposition.test.ts`
  - `test/conceptFacilityTemplates.test.ts`
  - `test/placeConceptTool.test.ts`
  - `test/placeConceptRender.test.ts`
  - `test/interiorRoomPipelineParity.test.ts`
  - `test/conceptOutdoorGates.test.ts`
- `npm run build`: **exit 0**, including application typecheck, editor,
  export-player and standalone bundles.
- Eight generated facilities: **zero placement/walkability warnings**.
- Independent final full-map visual inspection: **8/8 PASS**.
- Built export-player execution: **8/8 PASS**, no runtime errors, 1280 x 960.
- Final rendered-player visual verdict: **8/8 PASS**, all players inside their
  intended facilities, normal camera framing, no missing or malformed textures.
- Whole-repository baseline gate: **exit 1**, not claimed green. Typecheck and
  CSS passed; the broad Vitest run had 13,098 passes and 219 failures, and
  the event-editor surface snapshot gate failed.

### Broad gate comparison

The broad gate began before the final interaction/seat fixes and reported
those two intermediate composition failures; both passed in the final
110-test focused run.

For the other 32 newly flagged test files, a detached original HEAD
(`32ef1bcd`) and the final worktree were run with identical `--maxWorkers=4`
commands. Original: **202 passed, 43 failed**. Final: **210 passed, 35 failed**.
There were 33 identical failing assertions. The two final-only failures were
timeouts, checked separately on both trees with `--maxWorkers=1`:

- `databaseOverviewTab`: the same stored-tab test times out at 15 seconds on
  both original and final code.
- `databaseVillageView`: the gallery test passes on both trees in isolation.

The residual failures include existing event-editor image-queue/character
picker snapshot drift, database UI expectations, and load-sensitive timeouts.
Their tests and allowlists were not weakened or updated. Detailed comparison:
`interior-gate-comparison.json` beside this report.

The unchanged inn PNG SHA-256 before and after is:

```text
bff36090240a164c8703d91fe87f51c02bd9ee5d27ff633d70a5d14b16bba1b3
```

The pre-existing standalone inn fixture has an unlinked stair warning.
The inn was not redesigned or connected as part of this work.

## Evidence and reproduction

Evidence is under `output/evidence/facility-quality/verified/`:

- `<facility>.png`: unmarked full-map render from the real construction output.
- `manifest.json`: map sizes, rooms, start points and generation warnings.
- `player/SUMMARY.md`: actual exported-player execution report.
- `player/01-house.png` through `player/08-guild.png`: actual game screenshots.

```sh
node_modules/.bin/vite-node scripts/qa-facility-quality.mts verified
npm run build:player
node scripts/qa-facility-player.mjs verified
```

The QA script uses the built player and the runtime QA harness. Source-module
dev-server captures initially hit host `ERR_NETWORK_CHANGED` errors, including
localhost module requests; using the built export-player completed without
those errors. No failure filtering or retry loop was added.

An intermediate cross-map debug-teleport capture had stale framing. Final
captures boot each facility independently as a new game at its authored start,
without debug teleport or camera overrides. All eight replacement screenshots
were inspected again and passed.

These are test-only generator fixtures, not a shipped demo or a replacement
for a LegacyDb project. No user project data was written remotely.
