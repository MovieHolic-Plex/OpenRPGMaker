# retro2003 skill effects

Original pixel-coordinate art authored for OPRN Studio with Python 3 and Pillow.
No AI image generation, source-image tracing, resizing or antialiasing is used.

Run `python3 scripts/asset-gen/pixel-fx/fire.py` for one strip, or
`python3 scripts/asset-gen/pixel-fx/fx_lib.py` for all seventeen strips.
The output is `public/assets/generated/pixel-fx/<name>.png`: 64×64 cells,
eight horizontal frames, five opaque colours plus transparent. Generation asserts
binary alpha and at most twelve RGBA colours. The runtime renders at exactly 2×.

The PNGs use the repository's artwork licensing terms. Associated sounds are the
existing EasyRPG RTP assets; their attribution remains in `assets/easyrpg/AUTHORS.md`.

## Class skill sheets (hero · guardian)

`lib_hero.py` draws the class_hero and class_guardian layer sheets listed in
`src/assets/retroClassSkills.ts` (22 keys, including the shared `hero_dust`).
Each `<key>.py` holds one sheet's frame formulas; `python3 <key>.py` rebuilds
that sheet and `python3 lib_hero.py` rebuilds all 22. Frame size and count are
read back from the contract file and asserted before writing.

Shapes are aliased PIL masks painted on a palette-index canvas, so alpha is 0/255
and each sheet stays within its palette (at most 12 colours). Shading comes from
mask dilation and erosion, and fades use a checker dither. The build prints and
asserts size, alpha, colour count, non-empty frames and frame-to-frame change.
Review images (4× previews, 2× GIFs on #202840, per-class sheet and battler
composite) go to `.omo/pixel-fx/` and are not committed.

## Class skill sheets (samurai · ninja)

`lib_samurai.py` draws the 28 class_samurai / class_ninja layer sheets (reusing the
`lib_scout.py` cel, checks and review boards). Samurai keeps to indigo night, white steel
and sakura pink; ninja to violet shadow and iron grey, with the element ink of each jutsu
added on top. `python3 lib_samurai.py` rebuilds all 28 plus `.omo/pixel-fx/samurai-*` and
`ninja-*` boards; `python3 <key>.py` rebuilds one. Anchor, frame size and count are read
back from `src/assets/retroClassSkills.ts` and a mismatch aborts before writing.
