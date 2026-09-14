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

## Shared interior shell and activity zones (2026-09-14)

An interior `SpaceDesign` may contain `zones: [{id,name,x,y,width,height,floor}]`. Coordinates are relative to its floor origin, not shell padding. Zones are nonoverlapping rectangles within the floor bounds; the shell shape can clip them, but an entirely empty zone is rejected. They paint floor materials and constrain furnishings without adding walls, ceilings, doors or extra maps. Uncovered floor retains the space material. Ordinary homes should start with one shared shell; separate space children express actually enclosed rooms.

`SpatialObjectSlot.zoneId` optionally selects a zone for automatic furniture. Fixed coordinates remain relative to the whole space and retain explicit-authoring precedence. `compileSpaces` uses frozen zone geometry, slot associations and graphic identities, composes each zone against the full shared floor for access, then composes unassigned objects. Material painting precedes furniture, preserving its multi-layer cells and rugs. Zone boundaries cannot act as imaginary north walls. Required and port-bearing objects retain their placement contract.

The strict project parser, AI upsert schema, frozen snapshots and load/save path preserve these optional fields. Old documents need no rewrite. Duplicate/overlapping/out-of-bounds zones and dangling slot zone IDs are rejected. Changing an editor draft to outdoor removes interior zone assignments; staying interior preserves them. Legacy room-template adapters reject zoned sources with a canonical-build instruction. Regression evidence: `test/openInteriorZones.test.ts` plus the space compiler and house suites.
