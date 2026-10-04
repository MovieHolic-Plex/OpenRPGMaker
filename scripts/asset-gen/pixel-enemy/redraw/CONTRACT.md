# All remaining monsters: direct pixel redraw + nine battle poses

The user accepted the teal hydra and the four native64 kappa/wolf/bat/skeleton studies, then requested all remaining monsters. The earlier `refresh` art was rejected for poor quality. This batch replaces those remaining 135 drawings, including their nine combat cells. Never describe the old refresh as approved.

## Shared output contract

- Sources: `redraw/<group>.py`, optionally modules prefixed `<group>_`. Export function `draw(slug, pose, cell) -> RGBA PIL.Image`. Use `redraw/manifest.json` for species and final cell. All remaining former48 cells are **newly drawn at native64**; former96 stay96. No bitmap resampling, tracing, generated images, or imagegen. Integer final pixel grid, alpha0/255, at most32 visible colors.
- Nine poses in exact order: idle_a, idle_b, idle_c, windup, move, attack, recover, hit, dead. Feet stay within cell-4; all opaque pixels have at least one pixel side/top margin. All nine pictures must be distinct.
- Transform authored body part coordinates before rasterizing, or draw new contours per pose. Whole finished picture movement/rotation is insufficient. Attack needs a meaningful jaw/hand/weapon/wing/appendage change; dead is separately drawn lying/collapsed geometry. Three idle cells have body part movement, not whole sprite bobbing alone.
- Use substantial anatomy with a complete silhouette, 3-4 value ramps, shaded planes, selective highlights, clustered material texture, explicit face: nose/snout/beak, visible eye, mouth or teeth. Near and far limbs are distinct, thicker than stick figures. Dense tailored anatomy like approved studies. Low level drawing helpers may be shared; anatomy cannot be a universal humanoid or quadruped template with recolors.
- Close variants share family anatomy only when species has distinct contour, head, armor/appendages/material and motion. Do not render slugs into identical idle drawings. Slimes still need deliberate organic asymmetry, translucence, face/body structure, surface reflection; giant bosses need mass and expression.
- Face right in three quarter side view for RM2003. No external battle illustration/backdrop/hero. The five retained species are immutable.
- Each source includes a species table with short accurate Korean feature descriptions; also save `<group>-descriptions.json` for integration.

## Evidence and integration ownership

- `redraw/export.py <group>` writes public sheets, portraits, all nine raw cells, detailed pose boards and gallery contacts in your **own isolated worktree**. It asserts dimensions, palette, binary alpha, margins, pose uniqueness and PNG reload.
- Inspect accepted references, then inspect your own contact pages and pose boards. Correct crude, flat, clipped, disconnected or duplicate looking drawings before returning. Numeric format checks do not prove quality.
- Root owns the shared registry, manifest promotion, TypeScript metadata, catalog, bounds, runtime QA, docs and final gallery. Do not change these in an agent tree.
- No commits, merges, push, PR, stash, gates, vitest, whole typecheck or remote/project database writes. User stopped publication earlier. Keep files in isolated tree.
- Return source/evidence paths, exact species count, details of remaining concerns in at most25 lines. No huge source in messages. Do not stop at a few examples; complete your whole assigned group.
