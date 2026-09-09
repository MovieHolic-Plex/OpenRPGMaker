# Spaces canvas: actual placed members

The Database Spaces canvas edits one selected composition. Source mode still
patches `library.spaces`. Placed mode reads actual children from
`(parentId, parentSlot.slotId, parentSlot.index)` and never from frozen slot
recipes or source IDs.

## Binding

- Tokens: `[data-testid=spatial-member-<slotId>-<index>]` with opaque
  `occurrenceId`. Deleted indices stay absent. Source tokens remain
  `spatial-slot-<slotId>`.
- Move / chips / remove / add / quantity go through
  `previewPlacedSpaceEdit(controller, editAuthoringDraft(...).value, { occurrenceId, compile, edit })`.
  `retainAuthoringPreview` keeps that exact issued handle. Apply is the only
  adoption.
- `compile` is `spatialAuthoringCompileScope` of the selected occurrence.
  Nested rooms compile their containing root. Geography-root compiled-move is
  owned elsewhere.
- Required and slot recipes stay slot-wide. Quantity is persisted capacity, not
  surviving count. Chips edit the selected member only.
- Drop and focused-board Enter add one fixed member with a fresh opaque slot id.
- Clone selects the new occurrence and stays a bare clone (`초안`), not a
  compiled preview.

## Geometry

`SPACE_TILE_PX` (24) is shared by raster scale (`24/16`), token CSS, `tileOf`,
keyboard nudge and named ports. Interior art is translated by `-spaceLayout().room`
so local (0,0) matches the handle grid. No hardcoded 2/4 fixture origin.
