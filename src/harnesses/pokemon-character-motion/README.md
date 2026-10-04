# Pokemon character motion

Reusable monster-collect CLI harness. Walking: 24×32, three poses × four directions. Generated opening clips: default64×96, six actual poses in a3×2 source atlas.

Start with `npm run harness -- pokemon-character-motion status`. Read [the focused workflow](../../../openwiki/harnesses/pokemon-character-motion.md) before import. Keep generated originals outside Git and preserve source/prompt hashes. Every shipping build requires current structural checks and supervisor animated visual review.

`clip-import --role professor --source /path/atlas.png --prompt-file /path/prompt.txt --sandbox /path/review` starts the standalone generated clip lifecycle. Use the returned candidate path for check, preview, review, gate and build. No automatic artwork generation, project-store writes or runtime registration.

Focused adversarial verifier: `node src/harnesses/pokemon-character-motion/node/verify.mjs`.
