# Pokemon reference sprite provenance

Mode: built-in `image_gen` image editing, using the user-supplied reference. Output PNGs were copied unchanged into `public/assets/generated/battle-skins/sprites/`.

## reference-cocoon-front.png initial prompt

Use case: background-extraction. Asset type: transparent pixel-art game battle sprite. Input image is the exact visual reference. Reproduce ONLY the green Metapod cocoon creature at the upper right, facing left, faithfully retaining its angular silhouette, pointed top, white narrowed eye, lime-green upper plates and dark moss-green underside. Remove the oval ground, cast shadow, UI, stripes and all other imagery completely. One isolated sprite on a genuinely transparent background. Match the reference's low-resolution pixel grid and limited palette exactly, not a modern illustration or smooth vector. Center the full creature with small transparent margins. No added anatomy, no text, no outline glow. Output a square PNG with transparency, a single creature. This is a production sprite, fidelity to the supplied image is the top priority.

## reference-seed-back.png initial prompt

Use case: background-extraction. Asset type: transparent pixel-art rear-view battle sprite. Input image is the exact visual reference. Reproduce ONLY the Bulbasaur back-view visible at the lower left: large lime-green pointed seed bulb dominates left and center, teal blue-green rear/head silhouette on the right, black/dark pixel outline, facing away from viewer toward the upper right opponent. Faithfully match the exact silhouette, proportions, visible teal pointed ear and lime bulb shading of the reference. Keep the same back-facing camera angle; DO NOT show eyes or face. Reconstruct only a minimal complete lower edge below the reference crop so the game may crop it again. Remove oval ground, UI, text, cast shadow and striped background entirely. Single isolated sprite on genuinely transparent background with small transparent margins. Crisp low-resolution pixel art with limited palette and nearest-neighbor square pixels, not smooth or rendered. Square PNG, no text. Reference fidelity is the top priority.

## Cleanup prompt

For each initial sprite, the following prompt was used with its own image as reference. The bracketed anatomy phrase differed by creature.

Edit this exact sprite for production game use. Preserve the creature's exact pose, silhouette and [green cocoon plates and single eye / lime bulb and teal body, absolutely NO face or eyes, rear view] unchanged. Make it strict hard-edged pixel art using a uniform logical 64×64 pixel grid with nearest-neighbor enlarged square pixels and a small flat palette of no more than 12 opaque colors. Remove ALL gradients, noise, grain, stray pixels, translucent haze and antialiasing. Every pixel must be either fully transparent (alpha 0) or fully opaque (alpha 255). Background must be genuinely fully transparent and contain no ground/shadow/UI. Tightly frame the creature to fill 90 percent of image height with 5 percent transparent padding at top and bottom; center horizontally. Return a single transparent PNG, no text. This is cleanup of the given sprite, not redesign.

The model did not perfectly obey the palette/alpha constraints: these are visual approximations, not lossless extracted original sprites. No numeric 95% similarity claim is supported by these generated assets.

