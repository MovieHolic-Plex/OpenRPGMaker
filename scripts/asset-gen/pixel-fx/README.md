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
