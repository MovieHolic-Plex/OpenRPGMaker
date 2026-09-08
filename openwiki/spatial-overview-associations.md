# Spatial overview route and entry associations

Project schema remains v4; `spatialAuthoring.version` remains 1. This is an additive
association contract, not a geography generator, runtime renderer, or second graph.

## Persisted identities

An optional `SpatialConnection.overviewRoute` contains `occurrenceId` and
`localConnectionId`. It identifies one exact route in that region/world occurrence's
frozen snapshot. Fresh instantiation populates it. Ordered endpoints and direction
must match persisted direct-child/local-port associations. Equal-endpoint routes
remain distinct. Loading, duplicating, or refreshing an old record never guesses
missing provenance from IDs, endpoints, coordinates, array order, or live designs.

An optional, nonempty `SpatialOwnedBinding.overviewEntries` contains records with:

- `target: { occurrenceId, portId }`: the exact ordinary child port;
- `x`, `y`: the map-absolute marker cell (owner rectangle origin plus child placement);
- `eventId`, `returnEventId`: the exact entering and returning event IDs.

There is one marker per target tuple, shared by incident routes and a world's
explicit entry selector. Region containment alone never authorizes a portal.
Standalone worlds may select one child without any logical routes. Self-selected
world entry uses an ordinary own port instead of a synthetic child marker.

Entries are references, not ports or ownership. Projections may not carry them,
even as an empty array. Ordinary concrete ports remain singly bound. Destination
map/cell comes only from that binding. The source event belongs to the overview
raster; the return event belongs to the existing raster owner at the landing,
which may be a descendant space. Distinct automatic markers/returns may not
compete at the same cell. Existing coincident nonowning projections remain legal.

## Validation and compiler boundaries

`validateSpatialReferences` checks frozen provenance, ordinary-port uniqueness,
exclusive rectangles/events, exact target/marker/return ownership, and complete
route bookkeeping. A world's entry selector cannot hide an implemented route's
missing `connectionIds` record.

The actual full-project IO boundary calls `validateSpatialProject`. Every recorded
pair requires exactly one fixed, unconditional player-touch/below transfer page
and exactly one enabled player/NPC mapConnection for each event. Missing,
redirected, conditional, contradictory, or competing implementations reject.
Shape validation alone does not prove collision passability or reachability.

`resolveCompiledPort` retains its ordinary destination meaning.
`resolveOverviewEntry` is a separate source lookup. `validateOverviewAccess` checks
complete frozen-route associations, selected world entry, passable landings, and
collision reachability from the supplied overview start. It rejects unsupported
one-way walking acceptance; old one-way documents remain readable. It does not
implement route geometry generation or preview/apply.

The ordinary connection compiler skips overview-provenance routes instead of
turning child-to-child logical links into direct teleports. Partial recompiles
that would release an outside overview's landing/return ownership reject before
cleanup. Detached output is not automatically adopted.

## Lifecycle and compatibility

`inspectSpatialOccurrenceDeletion().overviewEntries` exposes exact source binding,
source event, target tuple, reverse event, reverse map, reverse owner, and reverse
binding index. This includes world-entry-only dependencies and other marker pairs
orphaned by removal of a route. Those impacts do not make a surviving overview's
whole raster deletable. `inspectOverviewEntryChanges` also reports landing changes
when comparing explicit logical proposals.

Deletion with `externalConnections: "reject"` blocks incoming entries even without
a logical link. Explicit domain removal prunes dependent entries/bookkeeping to
a fixed point, preserving markers supported by surviving routes/world selection.
Domain deletion never mutates maps, events, or mapConnections. Detach clears the
selected bindings and dependent proof, preserving logical routes, provenance and
map output. Retained events become unmanaged when their actual ownership is
released. Duplication clears copied bindings, remaps the declaring overview and
endpoints, and preserves each local route ID. Explicit boundary copies whose
owner is outside the copy omit provenance on the new ordinary link only.

The raster digest algorithm is unchanged: owned tiles/stacks/events/ports are
hashed; associations and connection bookkeeping are not another raster. Absent
fields stay absent; explicit undefined/null/malformed fields reject at direct
parser boundaries. Compact/pretty serialization preserves opaque identities and
archive bytes. The new reader accepts old documents; old strict readers do not
understand new fields. There is no digest migration or provenance backfill.

Task11 still owns atomic application-side event cleanup, owner-digest preflight,
exact mapConnection cleanup, and full logical preview-baseline stale checks.
Metadata-only association changes can leave the raster digest unchanged. Neither
those future APIs nor geography generation are claimed here.

## Reproduction

From the isolated worktree, with existing dependencies available:

```sh
CI=1 unshare -Urn node scripts/run-vitest.mjs run test/spatialOverview*.test.ts \
  --configLoader bundle --maxWorkers=1 --minWorkers=1 --no-file-parallelism
unshare -Urn bun run scripts/qa/spatial-geography-contract.mts \
  --seeds 109 --require-complete --evidence output/evidence/tile-to-world/task-34/witness
```

Add `--independent <task10-adversarial/independent-witness-directory>` to exercise
the retained `complete-43.json` and `complete-271.json` rejected witnesses. Their
association proposal uses reviewed literal IDs, not a generic legacy importer.
The CLI retains exact source hashes, numeric maps, full pair/traversal receipts,
and original rejections. `--incomplete-input` must exit nonzero at full project IO.
The hand-assembled witnesses use real task9 child maps and the supported World
raster generator; they are not published geography/compiler output or visual QA.
