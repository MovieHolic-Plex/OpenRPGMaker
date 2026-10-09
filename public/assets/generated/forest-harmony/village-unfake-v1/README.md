# Reviewed village props

Eleven existing Tibo-generated props processed with unfake.js 1.3.0, upstream
`https://github.com/jenissimo/unfake.js`, commit
`b2bee10c1c3b211a2532baca9088857b19480dca` (MIT tooling).
No unfake source or WASM is vendored here.

Native sprite footprints are multiples of the 16×16 tile unit. Original processing used binary alpha.
See `metrics.json` for dimensions, connected components and palette counts;
`review.json` records GPT-6 Astra's individual processing-regression review.
That review is not a blanket approval of perspective or every artistic choice.

On 2026-09-28, `stone-well-low.png` received a neutral stone palette,
directional shading and a translucent contact shadow. Its 32×32 footprint
and opaque silhouette remain unchanged. `metrics.json` and `review.json`
describe the earlier unfake processing, not this subsequent recolour.
The reproducible edit is `scripts/content/recolor-forest-stone-well.py`;
its current runtime evidence is in `verify-shots/forest-stone-well/`.
The subsequent border cleanup changes 20 RGB pixels, preserving alpha and internal
masonry. Run `scripts/content/prepare-forest-well-outline.mjs --apply` after the
palette step; its source and generation prompt are in `tiledata/forest-stone-well/`.

Eight props use Dominant24; scarecrow and fruit basket use nearest24.
Birdhouse preserves the prior native silhouette and changes only seven RGB
pixels using manualScale=1 / maxColors=20. It was not resampled from the large
original. These final files, not initial failed candidates, are shipped.

The rejected clay oven is absent and banned by
`scripts/asset-gen/village-prop-banlist.json`. Do not reintroduce it.
The complete atlas, tile grouping and seven non-repeating object kits are in
`public/assets/region-references/forest-cliff-village.oprn.json`.

Existing map terrain/building attribution remains in `public/assets/ATTRIBUTION.md`.

A full generated replacement was tried and rejected. The current
`stone-well-low.png` is restored to `tiledata/forest-stone-well/outline-native.png`,
the palette-corrected sprite with the 20-pixel outline cleanup described above.
