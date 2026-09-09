# Association-correct placed-space edits

`src/editor/spatial/placedSpaceEdits.ts` owns detached placed-space proposals.
`placedSpaceMembers.ts` owns frozen fixed-object materialization and association
reads. Neither module owns maps, history, session state or source refresh.

## Controller API

`previewPlacedSpaceEdit(controller, issuedDraft, request)` returns the existing
`SpatialAuthoringResult<SpatialAuthoringPreview>`. The request contains:

- `occurrenceId`: the actual selected space, never a source or local slot ID.
- `compile`: the compilation owner's `SpatialCompileRequest`. The parent/shared
  authoring boundary supplies this through `spatialAuthoringCompileScope`; a
  connected nested room must compile its containing root, not the selected leaf.
- `edit`: one of the following explicitly different intents.

| Kind | Input | Meaning |
| --- | --- | --- |
| `move` | `member: {slotId,index}`, `position: {x,y}` | Move one surviving fixed member in space-local coordinates. |
| `chips` | `member`, `chips` | Change that actual child's effective frozen actions, not the shared slot recipe. |
| `remove` | `member` | Exact controller deletion with external connections rejected. Retain the legitimate template gap. |
| `add` | `slot` with fresh ID, fixed placement, quantity 1 | Add exactly one associated fixed object. Never re-expand siblings. |
| `quantity` | `slotId`, `quantity`, `positions` | Grow capacity with exactly one explicit position per new index, or delete indices outside reduced capacity. Zero removes the slot. |
| `recipe` | complete frozen root `space` | Edit required/shape/size/ports or slot-wide placement/chips; remove/shrink recipes via lifecycle deletion. Add/growth needs the explicit operations above. |

Quantity growth starts at the previous capacity, not the first absent repetition.
For example, a slot with capacity 3 and actual indices 0 and 2 grows to 4 by
adding index 3. Index 1 stays absent. Per-member edits never rewrite slot placement
or sibling effective chips. Slot-wide recipes intentionally affect all surviving
members in that slot; moving every required repetition to the same fixed cell
can correctly fail the existing occupancy guard.

`patchPlacedSpace(project, occurrenceId, patch)` is the pure synchronization seam
used by existing `spatialSpaceDraft.patchOccurrenceSpace`. It updates selected
slot recipe coordinates/actions in the associated children and named-port
coordinates in the concrete ports. Structural lifecycle work belongs to the
controller API, not arbitrary project mutation. Metadata-only historical edits
remain readable; identity-dependent edits require persisted associations.

## Frozen authority and atomicity

- Read child identity using actual `parentId` plus `parentSlot.slotId/index`.
  Read ports using `localPortId`; preserve concrete IDs and array order.
- Existing captured object definitions and `kitCells` win over live source edits.
  A novel explicitly added source alone resolves live. A conflicting frozen
  identity returns `frozen-closure-conflict`, never last-write-wins merging.
- Additional repetitions derive closed snapshots from the parent's captured
  object recipe, so source deletion cannot force an implicit refresh. Fresh
  child/port identities are allocated only for explicitly added members.
- Removing a recipe prunes its now-unreachable frozen definitions and raster
  snapshots. Empty actual composition compiles without generated object events.
- Deletion uses controller lifecycle operations and continuation; the final
  compilation retains original baseline, impact and protected output. Apply
  alone adopts it as one project-history transaction.
- `association-required`, `missing`, `fixed-required`, `positions-required` and
  `frozen-closure-conflict` are returned in typed authoring error feedback.
  Compiler ownership/atlas/blocked/port guards are unchanged. No manual raster
  overwrite, automatic source refresh or projection-derived erasure is added.

## UI integration boundary

The exact issued preview must be retained by shared authoring access. Do not copy
its maps/bindings into an unrelated draft or introduce panel-local history.
Bind actual tokens to `{slotId,index}` rather than assuming source slot index 0.
The containing compilation-scope resolver and shared preview/session handoff are
parent/core dependencies; this lane does not own those modules.

UI acceptance is pending: no canvas/inspector/gesture/browser changes are claimed
here. The adapter regressions use real controller/compiler/store/history calls,
not permissive handle mocks or fixture re-instantiation as the action:
the focused `placedSpace*.test.ts` files, including actual-empty composition
with the frozen repetition template still present. Evidence is under
`output/evidence/tile-to-world/placed-space-edit`.
