# Placed-place child editing

## Scope and ownership

`src/editor/spatial/placedPlaceEdits.ts` owns association-based placed-child proposals.
It uses the real `SpatialAuthoringController`; it never adopts projects, records history,
refreshes siblings, changes live designs, or edits connection/binding bookkeeping.

This is the adapter/regression slice of tasks 11/13/14/15, gap G6/G8/G11 and
R6/R8/R12. Full canvas/inspector/gesture/drill-back acceptance remains parent-owned.
No browser, image, CSS, provider, DB or publication acceptance is claimed here.

## Mutation contract

Call `previewPlacedPlaceEdit(controller, issuedDraft, {edit, compile})`.
`compile` must come from the shared authoring-scope owner. This module does not choose
an owner; it checks that the supplied actual subtree contains the edited parent.
The isolated tests supply their known village root explicitly. Nested room/place edits
must not substitute a leaf compiler for the owning containment write set.

- `move`: `{parentId, slot:{slotId,index}, position:{x,y,level}}`. Resolve the actual
  child by persisted `parentSlot`. Synchronize its position and the selected frozen
  slot, including moving an actual override back to unchanged template coordinates.
  Facility children require integer levels 1..3 through existing canonical validation.
- `add`: `{parentId, slot, rootId, seed, generatorVersion}`. Instantiate only the
  explicitly selected reusable subtree in an issued detached preview, continue that
  preview, attach its new root with `parentId`/`parentSlot:{slotId:slot.id,index:0}`,
  remove that root from `rootOccurrenceIds`, and compile the supplied owner.
  Merge only closed frozen dependencies. Shared-descendant DAGs and repeated
  same-source slots work; conflicting frozen definitions/rasters reject instead of
  overwriting the existing closure. No existing sibling is re-expanded.
- `delete`: `{parentId, slot:{slotId,index}, externalConnections:"reject"|"remove"}`.
  Resolve the actual child, then use the existing exact `delete-occurrence` operation
  with explicit compilation. Keep frozen template gaps; actual empty composition
  compiles empty rather than resurrecting children. External removal remains explicit.

The result is the exact issued `SpatialAuthoringPreview`, not a reconstructed handle.
The input draft and live store remain unchanged on rejection. Apply the final preview
once for one project-history step; normal `continueDraft` composes later operations.

`patchPlacedPlace` is the pure existing-property/slot-position seam used by
`spatialPlaceDraft.patchOccurrencePlace`. It is not an add/delete/link API. New child
picker/removal controls must bind to `previewPlacedPlaceEdit`, not append/remove frozen
slots and expect the compiler to materialize them. Connection controls must use the
separately owned `edit-connection` controller operation with concrete endpoint IDs.

## Actual read models and lifecycle data

- `placedPlaceChildren(project,parentId)` returns readonly actual surviving child rows:
  persisted slot/index, opaque occurrence identity, actual x/y/level, frozen source/name,
  and `{tab:"spaces"|"places",mode:"instances",occurrenceId}` drill destination.
  It does not read live source payloads, parse generated IDs, or synthesize deleted slots.
  Parent UI owns breadcrumb/camera/back behavior and consumes these exact destinations.
- `spatialPlaceQuery.previewPlaceDelete` now returns exact
  `inspectSpatialOccurrenceDeletion` data in `occurrence` for placed targets, including
  owned artifacts, non-owning projections, affected connections and external impacts.
  Existing source-reference preview fields remain available.
- `placedPlaceCloneProposal({occurrenceId,rootId})` returns the canonical bare-clone
  request, exact destination, and an explicit later compile target. The existing placed
  Duplicate command selects the new proposed occurrence only after preview succeeds.
  The clone is deliberately uncompiled; do not present it as a compiled duplicate.
  Remembered created-design chrome state cannot override explicit occurrence selection.

## Verification

Evidence: `output/evidence/tile-to-world/placed-place-edits/`.
The focused controller/compiler/store/history tests are `test/placedPlace*.test.ts`;
the related existing `test/spatialPlaceActions.test.ts` remains unchanged.
New tests use actual controller operations as the action, not fixture re-instantiation
or permissive mocks. Regressions cover opaque moved identity, retained overrides/gaps,
exact subtree add/delete, empty actual composition, explicit floors, clone selection,
deletion impacts, association-incomplete history, missing/ancestor/conflicting sources,
incorrect compile scope, and fresh manual-raster ownership rejection.

UI acceptance is pending: parent binds the actual child rows and typed add/delete/move
proposals into the shared proposal/session and drives the real canvas, floor controls,
drill/back navigation and connected room edit through the browser. The parent also owns
combined build and integration acceptance under the shared validation-lock policy.
