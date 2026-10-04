# Native gabled roofs and shorter normal sunlight

The flat cap was produced by repeating the manor roof middle without the authored `bd-mpart-gable`. Narrowing the sample's eaves alone did not fix this shape.

## Changes

- New Beodeul half-timber houses use the existing five-column/four-row pointed gable. Its native pixels remain intact; hip roofs remain selectable. Log houses retain their own roof.
- The diagonal gable cap replaces a full upper cell. Where it overlaps the middle roof band, native precomposed caps from `bd-manor-small` preserve the roof behind it, removing the two triangular gaps. Narrow roofs retain their native side caps. New kits use `_joined_gable`; older `_gable` kits remain editable.
- Editor house controls and assistant place/roof-resize tools share `roofForm: gable | hip`. Width-only resizing preserves an existing roof's form. Form conversion preserves wall/window/door world coordinates, floor count and placement ID.
- New sunlight settings default to altitude 65°, enabled **false**. Explicitly authored low sun remains available and is preserved. The QA sample previously used 35°; the new sample uses 65°.

## Evidence to open first

- `before.png`: previous 11-column hip roof and sun 35°.
- `gable-low.png`: pointed roof at the same sun 35°, isolating the roof change.
- `after.png`: pointed roof and sun 65°. All three use the actual common native renderer, crop (15,36), 22×16 cells.
- `editor/03-gable-controls.png`: shipped editor's native roof form selector.
- `editor/06-reloaded.png`: real editor after SQLite save and reload.
- `player/sun-65.png`: separate shipped `player.html`, no editor shell.

## Checks and persistence

`contracts.json` records seven focused contracts: legacy IDs/art, boundary widths/floors, exact protected roof conversion, rejection of a changed wall, preserved form during width-only resize, clean gable→hip restoration, repaint rejection, plus default off/authored sun preservation.

The isolated canonical folder is `.vite-cache/gabled-roof/project`, project ID `3422b7dc-4b8d-4f56-b611-f921f561b6c9`. `canonical-proof.json` records the initial tool save/reopen at revision 2; `join-proof.json` records the final native seam correction, and `editor/observations.json` records the later native UI save/reload revision. Wall tiles, events, relief and other maps are preserved. The user's original project (ID `c779e278-8cec-4da4-9c2f-df423460b60d`) was read only; its revision remained 339 and its map digest remained `f8bfbb0c4e28a394801e0738268524517613eeef413d51b551819a4354628e23`.

`editor/observations.json` and `player/observations.json` record native silhouette activation and browser errors. Player checks include visibly different 35°/65° frames, no idle rebake, and off cleanup. The editor's 2× recording is delivered separately, not committed.

Validation used the focused author/QA scripts, packaged editor, and shipped player. No gates, Vitest, full typecheck or stash was run, as required by this session's AGENTS instructions. Tile art was read from the current QA project's Beodeul reference documents and native part images. No new tile art or project-only reference was introduced.
