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
