# Bounded spatial geography compiler

Task10 backend-v2 extends the accepted overview association contract at
`8be8780e667a0784dbc7a7041a3616b026d37cfe`. It does not replace the task34 diagnostic
fixtures or introduce another traversal schema. The old blocked investigation is
historical evidence, not the current compiler.

## Public path

`compileSpatialOccurrence(project, { occurrenceId })` dispatches regions to
`compileRegions` and worlds to `compileWorlds`. Both use `compileGeography` for
bounded raster assembly, then the actual place/region child compiler. Input is
cloned and validated; there is no store, history, SQL, remote write or publication.
The project start map/position is preserved. The world's selected entry determines
its mandatory overview-access check, not permission to reset the project spawn.

- Frozen snapshot definitions, actual occurrence positions and exact opaque
  occurrence/port IDs are authoritative. Live library edits do not supply terrain.
- A region uses its authored orthogonal route polyline, including bends. Endpoints
  must match the actual overview coordinates. A world connection has no polyline
  field in the accepted schema: it uses horizontal-then-vertical bounded crossings.
- All contained children compile. Only authored route endpoints and the explicit
  world entry selector create markers. Containment alone never creates a portal.
- An overview marker uses the child's overview x/y. Its target resolves through
  the ordinary single compiled child port, on the child's own map. No duplicate
  ordinary port binding is introduced.
- Canonical `overviewRoute` IDs are retained without rewriting connections.
  `overviewEntries` owns exact enter/return event pairs from the house adapter;
  `validateOverviewAccess` and full serializer IO validate the completed project.

## Terrain and structures

Only the supported bundled World atlas (`easyrpg_chipset_world`) is accepted.
Overview terrain defaults come from its World generation profile and canonical
World coast/terrain mappings, not the old generic path number (360 is World
forest). Maps use one atlas each; child town/interior maps keep their own atlases.

Supported material names are `ground`, `water`, and the canonical World terrain
keys: `dirt`, `sand`, `marsh`, `snow`, `tall-grass`, `snow-forest`, `snow-mountain`,
`forest`, `mountain`, `metal-pit`, `rock-pit`. Ordered rectangles/polygons paint
actual terrain and existing autotile resolution shapes it. Unknown materials and
incompatible/grafted source bindings are rejected rather than substituted.

A rectangular `mountain:grass`, `mountain:dirt`, or `mountain:snow` area invokes
`author_world_mountain`: the rectangle is one tier, with its stair at the center
x coordinate and the primitive's wall/landing footprint below it. This bounded
adapter rejects polygonal mountain structures; it does not invent a schema for
arbitrary tier configuration. Bare `mountain` is blocked terrain, not a staircase.

A straight authored path crossing water invokes `author_world_bridge` for its
water span. Horizontal bridges retain their support row; vertical bridges retain
north/south passage. Water corners, missing banks, overlapping structures and
unsupported spans reject through the existing primitive. Paths cannot erase
blocked terrain, stair walls, directional stairs or bridge supports. Structures
use the primitive's map-private World atlas; shared atlas metadata is not patched.

One-way overview links and nonzero overview child levels are unsupported and
reject. Polylines, markers, terrain areas and structure landings must remain
bounded. Every mandatory port/marker must be reachable before a proposal returns.

## Settlement regions (2026-09-12)

A `RegionDesign` may carry `settlement: { presetId, seed }` — the region is then a
정주지 whose map body is built by the village pipeline instead of the World
terrain raster. `spatialAuthoring` library parse accepts the field via
`guards.ts`; unknown fields still reject.

- Settlement terrain must use the combined-town atlas
  (`easyrpg_chipset_combined_town`). `settlementTerrain()` in
  `geographyTerrain.ts` produces a grass-filled map; `geographyTerrain()` still
  rejects non-World tilesets, so the two paths stay separate.
- `compileGeography` stamps `buildVillageDomain(project, { mapId, presetId,
  seed, interior: false })` onto the region raster. Authored `routes` on a
  settlement region reject — village roads are generated, not drawn.
- Recompile idempotency: retained `ev_village_`/`ev_house_*`/`ev_entrance_`/
  `ev_exit_` events are stripped before stamping, and a retained
  `village-harness` `layoutPlan` is dropped — `protectedHouseCells` reads it and
  would otherwise block the rebuilt house sites, splitting placement between
  runs. The builder writes a fresh plan.
- Contract: `test/spatialSettlementRegion.test.ts` — stamping, byte-identical
  recompile, io round-trip, route and tileset rejection.

## Ownership and regeneration

Regeneration verifies original owned digests across the whole write set before
releasing entry pairs. Entry cleanup uses `(mapId,eventId)`, never event spelling
alone. A same-ID event in an unrelated map is preserved. Manual events, unmanaged
maps and unrelated bindings remain outside generated ownership. Partial child
recompiles with an overview return pair reject through the shared write-set API.

An existing geography binding must be the compiler's one exact full-map owner.
Different map identities or resized existing maps reject rather than orphaning
old ownership. Manual edits of owned raster/events reject; there is no automatic
merge. Stable event/connection order is restored before owned digests are finalized,
so serializer reload and repeat compilation retain exact project values.

Each geography owner now retires only its own entry pairs, retaining descendant
metadata until that child's compiler can capture its saved identities. Release
first validates full old pair/event/projection contracts and subtree-owned digests,
then returns a private proven-pair value to the emitter. Existing opaque saved
enter/return IDs are retained instead of being derived again. Unchanged pair
payloads are preserved exactly; changed endpoints receive freshly built transfer
commands. This also applies after the shared controller's protected compiled-motion
preparation; see [the controller contract](spatial-authoring-controller.md).

## Contract fixtures and proof

`test/support/spatialGeographyRecipes.ts` defines six differentiated 128x96 region
rasters and two 96x64 three-region topologies:

- lake-country: lake bridge; deep-forest: authored forest detour;
  harbor-coast: polygonal coast and sand.
- snow-frontier: snow/snow-forest; high-pass: real mountain stair;
  ancient-ruins: rock-pit detour.
- lake-kingdom: lake-country <-> deep-forest <-> harbor-coast.
- northern-frontier: snow-frontier <-> high-pass <-> ancient-ruins.

These are **contract fixtures, not task18 catalog content or task19 samples**.
Place slot identities match the plan, but their compiled children deliberately
reuse the real task9 nested-place fixture with its authored square/facility/three
floor transfers. They do not claim finished art/layouts for the eight shipped
place designs, northern barracks/dormitory content, or sample publication.

```sh
flock /home/main/z-project/rpg-zzu/.omo/ulw-execute/tile-to-world/validation.lock \
  npm test -- test/spatialGeographyCompiler.test.ts test/spatialGeographyRecipes.test.ts \
  test/spatialGeographySafety.test.ts test/spatialGeographyOwnership.test.ts \
  test/spatialGeographyRepeat.test.ts --maxWorkers=1 --no-file-parallelism
flock /home/main/z-project/rpg-zzu/.omo/ulw-execute/tile-to-world/validation.lock \
  unshare -Urn bun run scripts/qa/spatial-compile.mts --scenario geography --seeds 7,19,31
```

Start heavy commands through the plan's monitor, as required by
`.omo/ulw-execute/tile-to-world/execution-policy.md`. Evidence lives at
`output/evidence/tile-to-world/task-10/backend-v2/`: exact source hashes, serialized
projects, actual map arrays, authored route cells, production `canMove` walking,
and generated command-page interpreter transfers. `--fault blocked-route` exits
nonzero; the normal scenario also checks rejection with an unchanged caller.

Build integration belongs to the lead. Unchanged broad-suite deadline limits
remain inherited failures, not green results. Visual/native-player approval,
Grok-rendered evidence, UI, catalog expansion and remote sample publication remain
separate tasks; none is claimed by this backend receipt. No browser/server/live
resource is created by this lane.

For saved-object settlements, the same preset now owns object selection, exact exterior-floor quota
and tight clustering. After digest and map-extent checks, `compileGeography` temporarily releases
only its own root binding in the private rebuild draft; other owned bindings still block the village
builder. This enables byte-identical recompilation while rejecting manual raster edits.
`test/smallVillageDesign.test.ts` covers this alongside the legacy settlement tests.
See [the small-village contract](small-village-generation.md) for provenance and persistence.

Compact region rebuilds seed the temporary player location at the shared plaza centre before
construction. Otherwise the previous final spawn becomes an extra protected vegetation cell and
shifts the seeded placement stream. The real passable start is selected again after construction.
`plazaLayout.ts` is a pure geometry leaf; do not import the material catalog into geography draft
creation, which would close the house-kit initialization cycle.
