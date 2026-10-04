# Emerald campaign generated cast

Original imagegen artwork generated for this project. Raw PNGs and exact generation/edit prompts: `assets/emerald-monster-v2/npc-generation.json` and `assets/emerald-monster-v2/source/`. Trainer-a records its original generation and background cleanup separately. No third-party game pixels are used in this pack.

The packing script `scripts/content/emerald-art-v2-pack.mjs` uses the monster harness to extract transparency, reduce the palette, and fit existing generated pixels. It does not draw characters. Sixteen roles each have twelve field frames, with native24×32 cells and foot anchor31. Seventeen battle views are64×96. `catalog.json` hashes the currently registered shared bytes.

Historical `field-cast-*.png` files were coordinate-generated placeholders. They are no longer the registered cast and must not be used as sources for the new pack.
