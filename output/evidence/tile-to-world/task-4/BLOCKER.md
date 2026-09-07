# Task 4: blocked before production conversion

Base: a0b0bab693023a6d588fe11cc6edb1c35fc9369c.
Lane: feat/spatial-legacy-import, /home/main/z-project/rpg-zzu-spatial-legacy.

## Blocking asset contract

The input is a legitimate raw legacy snapshot with
`tilesets.easyrpg_chipset_interior.structureKits: []` and missing
`scratchConceptBundles`. `resolveInteriorRoomVocab` in
`src/editor/interiorRoomVocab.ts:89-102` supplies the actual 55-object catalog
when there are zero furniture kits. `liveBundlesForTileset` in
`src/editor/conceptBundleResolve.ts:110-116` supplies the 19 facilities and
59 qualified spaces when the interior bundles field is missing. Explicit
`scratchConceptBundles: []` supplies zero bundles instead.

The task-3 `ObjectDesign.graphic` type permits only `{tilesetId, kitId}`.
`src/project/spatial/references.ts:37-39` requires that kit to exist in the
referenced tileset's `structureKits`. Every one of the 55 real fallback IDs
fails this check against the unmodified existing tileset; the first is:

```
spatialAuthoring.library.objects.legacy.graphic.kitId: missing reference bed_h
```

Injecting catalog data into the caller is not sufficient: the validator has
no separate catalog asset context. Materializing kits in the existing
`structureKits: []` changes an existing raw value. A made-up kit reference,
unvalidated marker, nested alternate asset authority, or a project-to-editor
catalog import would weaken explicit task invariants. None was implemented.

**Required contract decision:** authorize an explicit, typed materialization
location for fallback graphic kits, with a documented relationship to the
original qualified tileset identity. The preferred direction is an additive
asset record that never changes any existing raw tileset value, supported by
the schema/asset owner and compiler. Whether a cloned tileset under a fresh
ID is permitted must be settled explicitly; this lane does not reinterpret
"raw tilesets unchanged" or silently redirect graphic identities. Then the
converter can accept caller-supplied real catalog cells and use the agreed
asset reference. No raster cells need guessing.

## Additional schema gap

Custom `interiorRoomKinds` remain recoverable in the raw archive and original
tileset. There is no typed canonical legacy-constraint field in
`SpaceDesign`, `SpatialProvenance`, or the receipt. A candidate carrying the
actual authored constraints is rejected at
`spatialAuthoring.library.spaces.archive.legacyConstraints: unsupported field`.
If task 4 requires these constraints to remain directly consumable rather
than archive-only, the schema owner must add an explicit typed field and
parser contract. This probe does not encode structured constraints as tags,
names, or overloaded provenance strings.

## Verified, non-production scope

- CLI uses the real legacy resolvers, catalog exports, spatial guards and
  reference validator; it is clearly labeled a contract probe, not a converter.
- All 55 object IDs/cell sources, 19 qualified facilities, and 59 qualified
  spaces are recorded in `source-inventory.json`; none were guessed/pruned.
- Synthetic raw root plus a newer map overlay remains byte-identical before
  and after the probe; SHA-256 is recorded in `conversion-diff.json`.
- A legacy shop command lacking modern fields acquires fields only in a
  separate deserialized copy. Raw commands remain untouched.
- Archive-only controls preserve raw JSON bytes/digest (including nonempty
  retired fields at root and tileset owners) through real compact/pretty IO
  and repeated reload. This is archive idempotence, not converter idempotence.
- Malformed graphic reference is rejected with no source mutation.
- No active remote project, SQL, map, event, lore, UI or production code changed.

## Evidence interpretation

`red.log` is the reproduced contract block with CLI exit 1, not a missing
import and not a converter TDD RED. No production converter was written, so
no production line shipped without a converter-seam failing test.
`green.log` is four passing characterization/schema test files (91 tests),
not an assertion of task-4 completion. `initial-fixture-failure.log` is retained
as invalid acceptance history: the initial synthetic event used only root
commands, which this loader does not normalize; the corrected fixture uses
an ordinary event page. `initial-probes-typecheck.log` records an omitted Vite
ambient declaration in the local validation config; the corrected scoped
check includes the existing declaration and passes.

Unimplemented: full conversion, qualified mapping, custom conversion,
converter idempotence, full package export, activation/concurrent writer
behavior. No task-4 checkmark is earned. Existing test/io.test.ts failure
belongs to task 28 and was neither edited nor weakened here.
