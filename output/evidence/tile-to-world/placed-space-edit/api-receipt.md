# Placed-space adapter API receipt

Owner: spatial-placed-space-edit, baseline 1efacf9765412fcf51a255eaea21ea2049280307.

Verified seam: `patchPlacedSpace(project, occurrenceId, patch)` in
`src/editor/spatial/placedSpaceEdits.ts`; existing `patchOccurrenceSpace` delegates
to it. Slot-wide placement/chip recipes affect surviving associated children;
named-port movement updates concrete coordinates without replacing IDs.
Metadata-only legacy edits retain the existing readable representation.

Verified controller API:
`previewPlacedSpaceEdit(controller, issuedDraft, { occurrenceId, compile, edit })`
returns `SpatialAuthoringResult<SpatialAuthoringPreview>`. Edits distinguish actual
member `{slotId,index}` move/chips/remove from slot-wide recipe/add/quantity.
`compile` is explicit: standalone root locally, containing authoring scope for
connected/nested content. No competing compilation scope helper is introduced.

Parent integration dependency: shared panel access must retain the returned exact
issued preview (including its controller-owned checkpoint). Copying its project
into an unrelated issued draft loses protected output and is not acceptable.
Parent/core owns `authoringScope.ts`; its current uncommitted implementation was
read in spatial-manual-build-core. This lane does not copy or commit another
worker's unfinished module. Nested room tests explicitly supply the known root.

Existing panel controls receive synchronized fixed coordinates, effective chips
and concrete ports through `spatialSpaceDraft.patchOccurrenceSpace` delegation.
`mutateSpaceDraft` now displays typed operation errors instead of letting them
escape. Source mode remains source-only.

Binding requirement for parent: structural Add/Delete/Quantity and actual member
selection must call `previewPlacedSpaceEdit`, retain its exact returned preview
in shared access, and use the shared scope resolver for nested rooms. The old
generic `(SpaceDesign)=>SpaceDesign` callback is slot-wide; it cannot encode a
selected repetition or controller lifecycle operation. Do not treat source-slot
tokens as actual children. Pure `patchPlacedSpace` is not a lifecycle substitute.

Verification receipt: sync RED 3 actual-state assertions; member/lifecycle RED 10
missing-API failures after real compiled fixture setup; panel-error RED 1 real
uncaught typed error. GREEN logs cover the full adapter, existing panel actions,
occurrence associations, frozen/source boundaries, quantity, requiredness and
known-root connected room output. `typecheck:app` exits 0. A focused browser ESM
bundle exits 0 (1.1MB size warning, hash in build.log); this is not a full product
Vite build or browser acceptance. All commands ran through the shared validation
lock and async monitor with original 180-second command deadlines.

Final exact-source gate: 38/38 across seven focused adapter/existing-panel files
in 67.82 seconds (`final-green.log`), plus 1/1 retained-template actual-empty
continuation regression (`empty.log`). No product code changed between these
gates. Product blob IDs and remaining acceptance boundaries are in `status.json`.

UI acceptance remains pending: no canvas, inspector, CSS or browser work is owned
or claimed by this adapter lane. No publication/provider/DB writes are involved.
