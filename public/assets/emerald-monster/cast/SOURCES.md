# Emerald campaign generated cast

Original imagegen artwork generated for this project. Raw PNGs and exact generation/edit prompts: `assets/emerald-monster-v2/npc-generation.json` and `assets/emerald-monster-v2/source/`. Trainer-a records its original generation and background cleanup separately. No third-party game pixels are used in this pack.

The previous packing script confused the24×32 editor transport cell with Emerald native artwork. Its24×32 field/64×96 trainer results are historical and have been replaced.

Current registration: `scripts/content/register-pokemon-character-motion.mjs`, using the reviewed `pokemon-character-motion` lifecycle. Sixteen roles have192native16×32frames, at most15opaque colors per role across12poses. The24×32 editor adapter adds4transparent pixels on each side and copies every native pixel unchanged. Seventeen trainer views are64×64, with a newly generated waist-up player back; nurse and resident were regenerated to match field identity. Other fronts uniformly sample the earlier genuine generated source pixels. `catalog.json` hashes and metadata describe the current shared bytes.

Final small native files, exact prompts, immutable provenance, visual review evidence and build gates are in `public/assets/harnesses/pokemon-character-motion/emerald/`. Generation ledger: `generation.json` in that folder. This revision uses the builtin imagegen tool. Durable raw sources/candidates and exact prompts: `/home/main/z-project/pokemon-character-motion-review-20261004/`. The six-pose professor strip uses common SOURCE raster scale/phase; the earlier per-pose grid fitting warped otherwise equal body heights and was rejected. No code paints or substitutes character body parts. Original Emerald reference PNGs are external QA references and are not shipped.

Historical `field-cast-*.png` files were coordinate-generated placeholders. They are no longer the registered cast and must not be used as sources for the new pack.
