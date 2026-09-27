# Low stone well: accepted outline cleanup

Existing Tibo-derived low stone well; the attribution in `public/assets/ATTRIBUTION.md`
continues to apply. This edits the existing shared prop; it adds no new tile IDs.

- `palette-before-outline.png`: 32×32 input after the neutral-palette change.
- `outline-source.png`: built-in image_gen edit, 2026-09-28. Its colours and texture
  are not used in the shipped sprite; it supplies a silhouette reference only.
- `outline-native.png`: accepted border-cleaned native sprite.
- `stone-well-low.png`: current shipped sprite, identical to `outline-native.png`.
  Twenty RGB pixels differ from `palette-before-outline.png`; alpha, dimensions,
  inner masonry, water and ground shadow remain unchanged.
- `selected-source.png` and `rejected-selected-native.png`: the full replacement
  tried at the user's request, then rejected in favour of the previous version.
  These are historical inputs, not shipped artwork.

Reproduce with `node scripts/content/prepare-forest-well-outline.mjs`; add `--apply`
to copy the four native cells into their existing common sheets and update the
96×96 preview and reference image digest manifest. Historical digest keys are kept.
This follows `scripts/content/recolor-forest-stone-well.py` when starting with the
older blue-grey prop. No project database is modified.

## Previous outline generation prompt (historical, not the selected replacement)

Precise object edit of the provided sprite. Make a tiny cleanup pass to the outer
border ONLY. This is a short LOW wide stone well, NOT a tall cylindrical tower.
COPY THE INPUT almost exactly: identical camera angle, ellipse, well width and
height, shallow opening, SAME 32x32 logical pixel resolution (input is 3x
nearest-neighbor enlarged), same position in square canvas and transparent
background. The well fills almost entire canvas as in reference. Preserve all
interior stone textures and colors. Remove a few uneven jutting silhouette pixels
at the left/right wall and rim, join border segments with consistent one logical
pixel thickness and tidy stair steps. No taller walls, no deeper well, no added
realism, no extra stone shading. Output true transparent PNG, no text, just cleaned
version of input. If output higher resolution, make each 32x32 logical pixel a
uniform square block: no subpixel detail.

The generated image did not preserve the exact grid. Packing therefore discards
its texture, fits the opaque silhouette to the original 30×28 stone bounds, clips
it to the existing silhouette, and uses the original palette for the border.

## Final decision

The user preferred the prior outline-cleaned well after seeing the full attached
replacement in-game. The packer now copies `outline-native.png` directly and can
replace either previous palette cells or rejected replacement cells. It must not
resample `selected-source.png` into the shipped asset again.
