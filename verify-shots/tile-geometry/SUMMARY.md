# Tile geometry browser observations

- Editor: 32×32 source frame (tile 2 starts at x=64); real pointer painted cell (5,4), tile 2. No page errors.
- Export player (player.html with export store shim): (2,2) feet = (80,96), one right step = (112,96). A second right step was blocked by the solid tile at (4,2).
- Native action-triggered transfer: 32px → 16px map (2,2) feet = (40,48), then 16px → 32px map (14,10) feet = (464,352). No page errors.
- This is a minimal geometry fixture, not authored demo content. Full suites/typecheck were not run.

즉시 확인: editor32.png, runtime32-transfer.png, runtime16-transfer.png.
Raw observations: editor-observation.json, runtime-observation.json.
