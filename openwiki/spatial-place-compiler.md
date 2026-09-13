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

## Compact one-floor household (2026-09-13)

The reviewed `house-catalog:room:single` space is now an 8×6 divided floor,
replacing its previous 12×10 floor with only two furniture slots. Eight fixed slots
provide cooking, dining, sleeping and storage. An optional `interiorLayout` of floor-local room rectangles and doorways separates a combined kitchen/living room from the bedroom on the same map. The
partition occupies local x=4, y=0..2 and y=4..5, leaving one doorway at (4,3);
the entrance is (3,5). Blocking the doorway must disconnect the two rooms.
Existing single-floor places reference the same space ID.
Previously frozen examples keep their old snapshots until explicitly refreshed.

`scripts/lib/compactHouseInterior.mts` authors the revised space and two reviewed
furniture objects: an upper-layer cabinet (148/178, preserving the floor) and a stove with
its wall backing (105 behind upper 21, lower 51 below). It leaves old imported kits
and other placed maps alone. Do not move the frozen stove into open floor without
its backing: its existing north-wall surface rule still applies. Moving the wardrobe
one row down leaves the floor beside the bed accessible; merely reaching each
furniture anchor would miss that isolated empty corner.

`publish-compact-house-interior.mts --apply` checks remote authority, registers the
source, uses the actual spatial get/preview/apply or explicit refresh tool, validates
cluster rules and **every passable floor cell**, and CAS-saves/reloads. Example:
`compact-interior:example:cottage` (yard + one interior). Project start and unrelated
maps are preserved. The large multi-storey examples are not silently rebuilt.
`qa/compact-house-interior.mts` verifies 48 floor cells / 32 connected walkable cells;
`qa:runtime -- --scenario compact-house-interior` enters the door, walks to four
furniture areas and returns to the yard through actual player movement.
`placeCanvases` refreshes generated `roomHarnessPlan` metadata alongside interior
raster replacement; retaining the old plan left the old door coordinate inside a
new wall after moving the entrance. Unrelated map metadata remains preserved.
Evidence: `.omo/evidence/compact-interior/` (open plan) and
`.omo/evidence/partitioned-interior/` (first divided version), and
`.omo/evidence/unified-interior-walls/` (connected structural walls). These are registered tool-path checks,
not an LLM provider conversation run.

### Structural partitions (2026-09-13 correction)

Do not stamp partition arms as furniture: adding bare 430 cells after the shell
pass leaves the ceiling border unshaped and its north end disconnected from the
outer wall. `SpaceDesign` interior variants may store `interiorLayout` with
`rooms: [{id, name, x, y, width, height}]` and `doorways: [{x,y}]`, relative to the
floor. The optional field is parsed in library and frozen snapshots, survives
project serialization, and leaves old single-room designs unchanged. At least two
uniquely named IDs and an in-bounds rectangular envelope are required.

`spaceLayout` translates these boxes and doorways to the existing room harness;
its wall grammar generates the outer wall, shared partitions, wall faces and
ceiling borders together. Only the resulting passable floor is available for
furniture, so automatic placement cannot occupy a partition. The compact example
uses adjacent 5×6 and 3×6 boxes, sharing a partition at local x=4. Old partition
objects remain available for existing frozen content but are no longer placed.
`upsert_spatial_design` exposes this optional layout in its tool schema and explains
shared-edge/doorway semantics, so AI authors use the same structural path.
`test/spatialInteriorLayout.test.ts` proves registered AI upsert, save/load/recompile, ceiling connection,
shape idempotence, doorway-only reachability, bounds rejection and old-plan compatibility.

### Compact furniture arrangement

The small single-person household keeps eight objects, grouped by use. Cooking
storage and water align along the north kitchen wall. A two-cell table/chair
assembly (`compact-interior:single-dining`, upper 328/298) sits at local (1,4),
leaving both a west route around it and the east entrance aisle. A three-cell
meal assembly at (0,4) traps the bottom-left floor behind the exit trigger; the
walking QA must avoid that trigger except on the final exit, not just run plain BFS.
The bed sits in the northeast corner (7,0), with a bedside table (6,0; upper 328)
and plant (5,0). The wardrobe occupies the southeast corner (7,4). The doorway
and 8×6 envelope are unchanged; all 30 passable floor cells remain reachable.
Furniture art uses existing atlas tiles. Both new assemblies are registered
objects referenced by the canonical space, saved via explicit occurrence refresh.
Evidence: `.omo/evidence/furnished-interior/`.

### Furniture overlapping the north wall

Fixed object slots accept optional `placement.wallOverlap: 1 | 2`. Their x/y
coordinates locate the first floor row, and only the graphic origin is lifted.
The live definition, frozen slot, parser and AI upsert schema share this contract.
`compileSpaces` authorizes only upper-layer cells over actual cream wall-face tiles,
with floor support and a painted base beneath each overlapping column. The
standard stamp preflight still rejects upper collisions, stacks and events;
lower wall tiles are never replaced. Outdoor use and unsupported wall/ceiling
positions are rejected. Legacy placements without the field remain floor-only.

The compact kitchen cabinet uses (1,0) with one overlapping row; the bedroom
wardrobe moves to (5,0) with the same support. Their upper 148 tiles cover the wall
and lower 178 pieces sit on the first floor row. The plant moves to kitchen (3,0).
All 32 passable floor cells connect without crossing the exit trigger.
`test/spatialWallOverlap.test.ts` covers exact layer placement, save/load/recompile,
legacy behavior, missing support, lower-wall overwrite, object collision, and AI upsert.
Evidence: `.omo/evidence/wall-overlap-interior/`.

## Reviewed interior space catalog (2026-09-13)

`rpg-zzu-house-template-gallery` contains 101 interior spaces: 93 reviewed existing
records (including retained legacy facility-context identities) and eight new
physically divided small interiors. `scripts/lib/reviewedInteriorCatalog.mts`
authors the library; `scripts/publish-reviewed-interiors.mts --apply` fresh-loads,
refreshes the cottage/3-floor inn/4-floor workshop through `edit_spatial_occurrence`,
CAS-saves to Supabase, and compares the full reloaded project. Unrelated maps and
start position are preserved. Registration is idempotent. Facade catalog replay
must preserve an existing `interiorLayout` instead of resetting it to 12×10.

- Existing bedrooms/storage remain room components, usually 5×3 or 7×4. Halls
  and reading/chapel rooms are sized for their furniture; stretched context copies
  use their original room dimensions. The three multi-floor house spaces now use
  an 8×6 divided plan and preserve the `entry`/`down`/`up` port identities.
- Eight `reviewed-interior:*` spaces (family, scholar, herbalist, craftsman,
  inn-suite, clinic, farmhouse, watchhouse) use 9×6 or 10×7 floor plans, structural
  partitions and fixed functional furnishing groups. The compiler adds shell
  padding, so the displayed map/composition dimensions are larger than the floor.
- Imported object identities and investigation/loot/sleep chips survive compact
  graphic replacements. Cabinets use the reviewed transparent upper-layer kit.
  Overlarge table assemblies use small tables/seating appropriate to these rooms.
- Unbound imported `transfer` chips are replaced at the **space slot** with a
  stair graphic and a named space port. The original object is retained. A place
  must connect that port to a real destination; standalone spaces do not invent
  self-transfers. This review does not author the legacy inn's whole connection graph.

### Frozen placement vocabulary

New `SpatialKitSnapshot.interior?` freezes `{id,snap,role}` from the resolved
interior kit along with its pixels. Previously the synthetic occurrence ID lost
all snap/role metadata, so windows and bookshelves were scattered on the floor.
Wall-any objects freeze the upper-layer raster that the existing wall composer
actually paints. The compiler does not consult live kit metadata after freezing.
Older snapshots without this optional field retain their original floor behavior;
explicit refresh captures the new semantics. Automatic wall investigations use
an approachable floor anchor; fixed/standalone anchors remain unchanged.

Automatic placement also preserves access to previously stamped required objects.
Small corner props and tall wall objects must preserve reachable floor, just like
large floor furniture. This prevents an optional crate or repeated beds from
closing the only approach to an already placed object.

Verification tools: `scripts/audit-interior-catalog.mts <project.json> <suffix> [seed]`
compiles every interior through the actual compiler, reports missing objects,
cluster errors and unreachable floor; `scripts/qa/render-interior-catalog.mjs`
uses the native tile renderer for full contact sheets. `interior-catalog-editor.mjs`
checks the real remote editor's space shelf. Runtime uses the dedicated
`interior-catalog` scenario and `interior-catalog-routes.mts` for actual 3/4-floor
stairs and bedroom visits; use `qa:runtime`, never editor play mode.

Run each runtime example in a fresh player session with
`QA_INTERIOR_HOUSE=inn-3f` (default) and `QA_INTERIOR_HOUSE=workshop-4f`.
The first combined QA teleported during the preceding house exit and carried
transition/route state into the next case. Independent sessions preserve actual
walking assertions; they pass 12 and 15 beats, with no runtime errors.
