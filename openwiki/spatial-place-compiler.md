# Nested spatial place compiler (task9 backend)

Entry: `src/editor/spatial/compileSpatialOccurrence.ts`. A place request returns a
fully schema-validated detached proposal; it never applies to store/history or
publishes to a database. UI, persistence and visual approval remain separate.

The compiler uses persisted occurrence/slot/port associations, frozen rasters and
actual child coordinates. `placeLayout.ts` selects existing floor/space adapters
and frozen exteriors; `placeCanvases.ts` groups outdoor atlas/level planes;
`placeOwnership.ts` preflights digest-scoped cleanup; `compileConnections.ts`
resolves exact ports and emits declared transfer events. Container projections
never grant cleanup authority. Map-tree placement uses real map nodes so ordinary
serializer reload preserves it. See `src/editor/spatial/README.md` for coordinates,
port scope, conflict behavior and the automatic-slot placeholder convention.

Reproduction, in a private network namespace with a private Vite cache:

```sh
unshare -Urn bun run scripts/qa/spatial-compile.mts --scenario nested-places --seeds 7,19,31
unshare -Urn bun run scripts/qa/spatial-compile.mts --scenario nested-places --seeds 7 --fault blocked-port
```

The second command intentionally exits 1. It is the actual compiler failure path,
not the archived pre-task33 RED witness. Receipts include real map/port JSON,
engine-checked walking paths and executed interpreter transfer requests. They do
not claim a Phaser scene load, rendered image approval or remote publication.
Task33's `spatialConnectionSceneFixture.ts` remains the single shared base fixture.

## Houses with a yard and four floors (2026-09-12)

`src/project/spatial/facilityLevels.ts` owns the shared facility child-level policy:
floors 1–4 retain the existing space/place composition contract; level 0 additionally
accepts a direct **outdoor space**. Indoor spaces and nested places at level 0 still
reject, as do floors below 0 or above 4. Reference validation applies the same rule
to live libraries and frozen snapshots; editor child insertion and placed-child
editing use the same helper. No serialized field or version changed.

A transparent house exterior is an object, not a walkable exterior map. For the
reviewed house catalog, an outdoor yard space stamps that object at a fixed position
and supplies ground, a path, and a door-approach port. The facility groups this yard
with indoor floor spaces and declares the bidirectional door/stair connections.
`PlaceDesign.exterior` remains optional: directly assigning it would double-paint
these houses, and its exact graphic rectangle cannot supply an out-of-bounds landing.
An object's anchor may extend beyond its graphic, provided the containing space
reserves the whole extent. Interior port coordinates gain the existing `(2,4)` shell
offset; use compiled bindings when verifying navigation.

`test/spatialFacilityLevels.test.ts` compiles a fourth floor, saves/reloads frozen
definitions, accepts an outdoor yard, and rejects an indoor yard and invalid floors.
`scripts/register-house-spatial-catalog.mts` first checks all 15 reviewed places through
the registered get/preview/apply tools, then uses raw activation and CAS publication
for `rpg-zzu-house-template-gallery`. It reuses imported object identities, preserves
the reviewed graphics and existing maps, and checks idempotent registration.
The separate `house-spatial-catalog` and `house-spatial-catalog-4f` runtime QA scenarios
walk the reloaded examples through fresh exported-player sessions, including return
trips. Setup teleport is limited to each yard; doors and stairs use actual movement.
