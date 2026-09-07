# Object and space compilation

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
- Place/region/world compilation, explicit connections and transfer chips belong
  to subsequent connection-compiler work. This entry rejects them rather than
  creating a fake self-transfer. Non-transfer chip events reuse the existing
  event builder and may not silently relocate their anchor.

Numeric QA: `bun run scripts/qa/spatial-compile.mts --scenario spaces --seeds 7,19,31`.
It saves actual `GameMap` JSON, ownership/port contracts and access/rejection
receipts under `output/evidence/tile-to-world/task-8/backend-v2/`. These maps are
regression fixtures, not published content. No image generation or inspection is
part of this backend. Whole task8 still needs separate Grok 4.6 rendered approval.
