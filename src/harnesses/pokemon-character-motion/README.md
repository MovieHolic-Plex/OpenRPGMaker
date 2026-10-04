# Pokemon character motion

Reusable monster-collect CLI harness. Emerald native walking: 16×32, three poses × four directions. Native output48×128; editor output72×128 is exact x4padding, never a resize. Generated opening clips: default64×64 /15 opaque colors, six actual poses in a3×2 source atlas.

Start with `npm run harness -- pokemon-character-motion status`. Read [the focused workflow](../../../openwiki/harnesses/pokemon-character-motion.md) before import. Keep generated originals outside Git and preserve source/prompt hashes. Every shipping build requires current structural checks and supervisor visual review; portraits use a static1×/2×/3× preview.

`clip-import --role professor --source /path/atlas.png --prompt-file /path/prompt.txt --sandbox /path/review` starts the standalone generated clip lifecycle. Use the returned candidate path for check, preview, review, gate and build. No automatic artwork generation, project-store writes or runtime registration.

Focused adversarial verifier (add `--raster` for source sampling or `--references /path/external-emerald-reference` for original positive controls): `node src/harnesses/pokemon-character-motion/node/verify.mjs`.

`portrait-import --role hero_back --source /path/existing-generated64x96.png --prompt-file /path/original-prompt.txt --sandbox /path/review` starts the same check/preview/review/gate/build lifecycle for native64×64 trainer pictures. Existing pixels are uniformly nearest-fitted within62px ink, centered/bottom63, alpha128, shared15 opaque colors; no shapes are drawn. Accepted roles are the16 cast roles plus hero_back. Structural pass alone cannot build. Output: portrait.png, provenance/review/gate and motion.json; no field charset adapter or runtime registration. Dedicated negative/browser probe: `node src/harnesses/pokemon-character-motion/node/verify-portrait.mjs`.
