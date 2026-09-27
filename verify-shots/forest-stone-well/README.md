# Stone well palette — 2026-09-28

- `game-before.png`: prior runtime capture from `four-layer-ai/runtime-after/03-control-grass.png`.
- `game-after.png`: final assets captured through `player.html` by the runtime harness, same map and camera beat.
- Source: AI-generated forest village fixture, repaired for the previous tree-shadow issue. This is not evidence of a canonical project database write.
- Capture command: `node scripts/runtime-qa.mjs --scenario four-layer-trunk --project /tmp/four-layer-ai/run1.after-well.project.json --out /tmp/four-layer-ai/runtime-well-final`.
- Harness reported 7 beats completed, no runtime errors. These assertions do not assess artistic quality.
- Pixel comparison against HEAD confirmed all 29 changed PNGs retain their dimensions. Every changed 16×16 atlas cell matched an original well cell; the separate 96×96 object preview was regenerated.
- Visual review: blue-grey stone changed to neutral grey, shading biased toward the upper left, translucent contact shadow added. The opaque outline and tile footprint are preserved.

The exported fixture and temporary runtime report are session-local. The screenshots are durable evidence; reproducing the complete AI map requires the original fixture. Uploaded copies of an old atlas are not migrated by this asset-only change.

## Follow-up: outline cleanup

- `game-before-outline.png`: previous palette result, identical to `game-after.png`.
- `game-after-outline.png`: capture after all bundled sheets were updated, from
  `/tmp/four-layer-ai/runtime-well-outline-shipped/03-control-grass.png` using the
  same fixture and runtime scenario above.
- Native sprite comparison: 20 RGB pixels changed; zero alpha changes. Inner
  masonry, water and contact shadow remain unchanged. Source and exact prompt:
  `tiledata/forest-stone-well/README.md`.
- Pixel audit against HEAD: 28 source/sheet PNGs each change exactly the four
  original well cells and match the final native sprite. No unrelated tile changes;
  the 29th image is the regenerated preview. Dimensions remain unchanged.

## User-selected full sprite replacement

`game-after-selected.png` is the rejected replacement, captured only after all 28 sheets
and the preview were updated. Capture directory:
`/tmp/four-layer-ai/runtime-well-selected`, same scenario and fixture as above.
Compare against `game-after-outline.png` for the previous version.
The uploaded source was trimmed and sampled nearest-neighbour to 30×29 inside
32×32. This is the full selected image, not the prior border-only edit.
A pixel audit confirmed the same four well cells are the only atlas changes
relative to HEAD, and all match the current native sprite.

## Restored version

The user preferred the previous version. All shared well cells and the preview
were restored to `outline-native.png`; `game-after-outline.png` shows the accepted
version. `game-after-selected.png` remains historical comparison evidence only.
