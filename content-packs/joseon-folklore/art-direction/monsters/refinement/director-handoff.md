# Director handoff

Output root: `/home/main/z-project/rpg-zzu-codex-joseon-dialogue-codex-jf-content/content-packs/joseon-folklore/art-direction/monsters/refinement/`

Ready for integration review:

- `sprites/wild-boar.png`
- `sprites/straw-dokkaebi.png`
- `sprites/maiden-ghost.png`

Each is 192×192 transparent RGBA, nine native64 frames, row-major:
`idle_a,idle_b,idle_c / windup,move,attack / recover,hit,dead`.

The matching `portraits/SLUG.png` files are exactly each sheet's `idle_a` cell. `source/SLUG/` holds 9 full native ASCII grids and the original palette. `bake.py` assigns pixels directly.

Review `review/idle-comparison.png`, `review/SLUG-poses.png`, and `REVIEW.md`. `result.json` records SHA256 hashes, native frame bounding boxes, bottom pixels, alpha values, color counts and uniqueness. `progress.json` contains final phase and absolute inspection paths.

All 27 frame hashes are unique within their monster's sheet; idle foot baselines are unchanged across the 3 breathing frames. Every occupied pixel has y≤60. These are contract observations, not visual approval. Please capture actual battles and solicit user steering before accepting the artwork. No forest, map, engine, database, pack record, tracked file or previous output was changed.
