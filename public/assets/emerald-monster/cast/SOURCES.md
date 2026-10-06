# Emerald campaign — directly authored native pixel cast

The current cast is original pixel artwork drawn directly by root in Python. Reproducible source: `scripts/asset-gen/pokemon-characters/{pixels,cast,field,portraits,build}.py`. Each image is created at its final native dimensions with integer pixel primitives and explicit head/wardrobe rows. No generated image, external game pixels, raster resize, palette quantization or automatic background cleanup is used. Display previews may enlarge pixels by integer nearest sampling; those previews are not shipping art.

Sixteen roles contain192 native16×32 walking poses. Seventeen trainer pictures are64×64, including a separately drawn waist-up hero back. Six professor64×64 opening poses contain actual eye/mouth/arm changes. Each role uses at most15 opaque colors plus transparent pixels. Native imports reject invalid dimensions, partial alpha or excess colors instead of repairing them.

Registration: `scripts/content/register-pokemon-character-motion.mjs`. All34 candidates require current structural gates and root visual reviews. The authoring manifest ties Python sources to each PNG; registration compares source and final RGBA byte for byte. The24×32 editor transport adds4 transparent pixels on either side only. `catalog.json` identifies the currently registered shared bytes. `public/assets/harnesses/pokemon-character-motion/emerald/authoring.json` and `generation.json` record source and gate hashes.

Durable authored source outputs/reviews: `/home/main/z-project/pokemon-hand-pixels-20261004/`. Rebuild: `python3 scripts/asset-gen/pokemon-characters/build.py --out /path/native-source`. Import/check/preview: `python3 scripts/asset-gen/pokemon-characters/prepare-review.py /path/native-source /path/review`. Import is not visual approval or canonical saving.

The previous imagegen art and sampled native revision are historical, rejected for their shrunken appearance. Raw generation history remains under `assets/emerald-monster-v2/`; it is not the source for this current pack. Historical coordinate placeholder `field-cast-*.png` files are also not current sources. Monster species candidate art is a separate human-selection workflow and is unchanged.

Limitations: fronts share anatomy and several stances; native field torsos are angular. Pixel and runtime checks do not establish the original game's artistic quality.
