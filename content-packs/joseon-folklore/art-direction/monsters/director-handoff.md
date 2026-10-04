# Director handoff

Three corrected static idle candidates are ready for USER visual steering.

Output root:
`/home/main/z-project/rpg-zzu-codex-joseon-dialogue-codex-jf-content/content-packs/joseon-folklore/art-direction/monsters/`

- `candidates/wild-boar.png`: native 64×64 RGBA, 42×32 occupied silhouette, 14 colors.
- `candidates/straw-dokkaebi.png`: native 64×64 RGBA, 41×41 occupied silhouette, 17 colors.
- `candidates/maiden-ghost.png`: native 64×64 RGBA, 29×45 occupied silhouette, 14 colors.
- `review-sheet.png`: new and old portraits at 1×/3× alongside an original 24×32 Actor1 reference.
- `source/*.pxgrid` / `source/*.palette.json`: complete native ASCII grids and palettes.
- `bake.py`: direct per-pixel Pillow baking, plus review sheet assembly.
- `result.json`: absolute paths, SHA256 hashes, measurements, visual review notes and candidate status.
- `REVIEW.md`: observations and specific remaining limitations.

Image inspection and one visual revision are complete. These candidates have not been accepted or integrated. Please use the review sheet for user steering before any expansion or animation.
