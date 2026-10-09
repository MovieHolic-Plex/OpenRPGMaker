# Object, space and nested place compilation

`compileSpatialOccurrence(project, { occurrenceId, target? })` returns a detached,
fully project-validated `Project`. It does not access store, history, remote state,
or the editor canvas. Acceptance remains a separate operation.

- Space input is the stored occurrence tree. `parentSlot` and `localPortId` resolve
  identities; missing repetitions remain deleted. Frozen design selections, chips
  and raster cells are authoritative. No live kit is read to replace these cells.
- An interior floor retains its authored dimensions and rect/l/alcove footprint.
  The existing shell pipeline adds two side cells, four north cells and two south
  cells. The first authored port is the entry; a portless room uses the backend's
  south-center entry convention. Logical occurrence coordinates never change.
- Fixed objects use their stored coordinates relative to that floor. Automatic
  objects use the existing concept parser, frozen-row vocabulary adapter and
  concept composer. No legacy room-kind program or filler runs. Frozen kits do
  not contain snap metadata; the vocabulary adapter's floor default applies,
  rather than looking up today's kit metadata or inferring behavior from names.
- Outdoor floor materials use existing material-slot IDs (for example `ground`,
  `path`, `shore`, `water`), their current atlas metadata and the existing terrain
  autotiler. `floor` is the base coverage; explicit floor areas overlay it in
  authored order. Polygon integer cell centers and edges are included. Outdoor
  wall material is `none`; unsupported materials are concrete errors.
- A standalone object requires `target: { mapId, rect, entry }`. The compatible
  map/rectangle is explicit. The object origin is the rectangle's top-left;
  `entry` is the existing map's access origin, not a relocated object anchor.
  Clipping, blocked cells, stacks and occupied event cells reject before stamping.
- The space owns the generated raster/events. Child projections own no artifacts.
  Their extent includes outside-footprint anchors, including negative local
  coordinates; the raster origin stays fixed. Adapter-local symbols prevent the
  legacy concept parser from trimming opaque occurrence IDs.
  Every named port must be bound at its translated coordinate, passable and
  reachable. All painted cells are checked against the frozen raster; every
  required object's interaction anchor must be reachable or adjacent.
- Same-input compilation is deterministic, including event IDs. Recompilation
  checks the owned raster digest first, preserving manual/unmanaged edits through
  rejection. Digests canonicalize object keys and include tiles, stacks, events
  and ports. Project IO cannot create a false stale result through key ordering.
- Missing mandatory objects/entries/ports return no partial proposal. Optional
  unplaced objects retain their occurrence but have no binding. A named port is
  mandatory even on an optional object.
- Place compilation walks actual associated children, not live or frozen slot
  quantities. Facility, settlement and natural places use the same containment
  traversal. Navigation cycles do not enter that traversal.
- Outdoor spaces and frozen exteriors share a canvas only when atlas and level
  agree. Child x/y/level accumulate below the requested root's local origin;
  negative canvas extents receive one common translation. Interior children keep
  distinct maps with the existing floor/shell adapter's local coordinates. Frozen
  exterior cells come from snapshot resolution's house/section adapter, never a
  new random house or a live kit lookup. An exterior cannot invent ground for an
  authored blocked landing.
- Spaces/exteriors own exclusive raster rectangles and their generated events.
  Containers and object children project coordinates without owning pixels.
  Place ports resolve through persisted local-port associations to an exact
  passable, reachable outdoor cell on their declared plane; ambiguous surfaces
  reject. Different-map interiors connect only through explicit named ports.
- Ordinary explicit connections emit deterministic house-step events and mapConnections
  in the requested direction(s). Transfer chips require a declared connection;
  containment never emits a transfer. Every emitting endpoint must have a raster
  owner in the requested subtree; a destination can already be compiled outside
  it. Use the encompassing place when both source owners need recompilation.
  Overview-provenance routes are not direct child-to-child teleports; they are
  excluded from this compiler. Entry metadata cannot authorize cross-map cleanup,
  and partial writes to externally referenced overview landings reject.
  See [overview associations](../../../openwiki/spatial-overview-associations.md).
- Place recompilation checks all owned digests before releasing any pixels or
  events. Unmanaged maps, events, mapConnections, metadata and existing tree
  placement survive. Missing/edited owned transfer projections reject. Map-tree
  hierarchy uses real maps, because ordinary serializer reload does not retain
  folder metadata. Repeated compilation after serialize/deserialize is stable.
- Automatic object slots retain the established 0,0 unplaced convention. Actual
  nonzero object coordinates override it; fixed slots always use actual x/y.
  Regions/worlds remain unsupported. No schema, persistence or store hook changes
  are part of this compiler.

Numeric QA: `bun run scripts/qa/spatial-compile.mts --scenario spaces --seeds 7,19,31`.
It saves actual `GameMap` JSON, ownership/port contracts and access/rejection
receipts under `output/evidence/tile-to-world/task-8/backend-v2/`. These maps are
regression fixtures, not published content. No image generation or inspection is
part of this backend. Visual approval is a separate Grok 4.6 lane.

Nested backend QA:
`bun run scripts/qa/spatial-compile.mts --scenario nested-places --seeds 7,19,31`.
The driver writes actual maps, complete proposals, exact ports, reconstructed
walking routes checked with `canMove`, and executed interpreter transfer results.
`--fault blocked-port --seeds 7` must exit 1 with `rejection.json` and no proposal.
The interpreter receipt is not a browser/Phaser scene-load or visual receipt.
The old deliberately RED output-contract script is archived under
`.omo/evidence/task-9/backend-v2/historical/`, not active success tooling.

## Direct mixed compositions

When the frozen closure contains optional `composition`, `compileMixedComposition`
uses one explicit canvas. Tiles form the base edits; direct children stamp in authored
order and keep their identities as projection bindings. Existing space recipes still
produce their floor/walls and legacy object placements. Root ownership covers the
whole result, with preflight validation and protection against manual map changes.
This canvas currently requires one atlas and level zero. Multilevel children and
legacy overview routes reject instead of silently losing navigation semantics.
Unchanged legacy trees remain on the original compilers above.
