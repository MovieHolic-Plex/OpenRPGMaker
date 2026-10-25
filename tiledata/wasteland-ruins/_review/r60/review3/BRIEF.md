You are an independent, adversarial visual QA reviewer for 16px RPG chipset ground art. You have no prior scores; judge only what you see. Do not modify any file except your verdict file. Do not run tests, gates, vitest, tsc, git stash, servers or browsers. Use Read on images and small python (PIL) crops/zooms under /tmp/r60-rev3-<LETTER>/. Before each python run check `uptime`; if the 1-min load is above 40, sleep 60 and re-check.

Subject: the NEW broken-concrete slab ground of the post-apocalypse chipset `wasteland_ruins` (16px, 3/4 top-down, modern-city palette family). It is two layers:
- `slab-ground`: joint-free concrete texture (8x8 tiles, 128px period) on the lower layer.
- `slab-joints`: a transparent edge-matched (Wang-style) overlay on layer 2. Each cell edge gets a hashed code saying whether and where a joint crosses it; neighbouring cells read the same code, so the joint network is continuous but never repeats. Cells with dirt on a side crumble into dirt; cells next to asphalt meet the road without crumbling. One-cell sidewalk strips get only transverse joints.

Material in /home/main/z-project/rpg-zzu-village-art/tiledata/wasteland-ruins/_review/r60/review3/:
- gate-slab-ground(-3x).png, gate-slab-joints(-3x).png: the object-gate sample boards (plaza, plaza with a dirt hole, 1-cell sidewalk strips on dirt).
- settlement-1/4, ruined-city-2/5, shanty-3/6 .png: real generated maps at 1x (16px per cell) using this slab. Slab appears as sidewalks along asphalt roads, plazas, ruined lots and yards. Only judge the slab ground and its joins (with dirt, asphalt, buildings). Buildings, props, dirt, asphalt are out of scope except where they meet the slab. The small green square near a map edge is the renderer's player-start marker.
- old-r59-board-1x.png: the rejected previous attempt, for comparison only.
- ref-beodeul-sheet-2x.png (quality bar: Beodeul hand-pixel chipset), ref-modern-city-2x.png (palette/family reference).

Failure checklist from the two previous rejected rounds — check every one and say PASS/FAIL with evidence:
1. Repeat period: no visible 128px (or 16/32/64px) repeat of joints, stains or marks on the maps at 1x and 2x; it must not tile like wallpaper.
2. Shared marks: no stain, crack, hole or weed that lands on the same spot every period or pairs up at a fixed offset.
3. Reads as concrete: broken poured concrete / old city pavement slabs with an irregular joint layout, not laid flagstone, ashlar, terrazzo, a grid, crazy paving or a stone patio.
4. Texture: not granite/terrazzo speckle, no single-pixel salt-and-pepper, no dotted/stitched highlight lines; but also not dead flat.
5. Marks read correctly: cracks read as cracks (not extra joints, not hooked glyphs), broken corners/holes read as holes (not beans, bugs, rivets), weeds read as weeds.
6. Sidewalk strips: 1-cell strips have no lengthwise joint and no half-height slivers; strips read as a sidewalk.
7. Edges: where slab meets dirt it crumbles believably (3/4: thickness shows on the south edge); where it meets asphalt it meets cleanly like a kerb; no seams, gaps, misaligned joints or broken lines at cell borders.
8. Quality bar: shading, outline and density sit next to the Beodeul reference and the modern-city family at the same scale; not amateur, not toy-like.

Inspect at real zoom (crop + 3x/4x upscale); do not judge from overviews only. Look for cell-border discontinuities by cropping across cell borders.

Write /home/main/z-project/rpg-zzu-village-art/tiledata/wasteland-ruins/_review/r60/review3/verdict-<LETTER>.md:
first line `VERDICT: PASS` or `VERDICT: FAIL`, then one line per checklist item (`n: PASS|FAIL — reason, evidence crop path`), then `FIXES:` with concrete, pixel-level fixes if anything fails. PASS only if all 8 items pass. Be adversarial but concrete. End your reply with the verdict line.

Additional context for this round (review3): the previous attempt (r60a) was rejected for: a 128px repeat of ground blotches, joints that read as worms/crazy paving with dead ends, dashed/stitched highlights, brown T-bar holes that read as bugs, identical corner hook cracks, vertical sidewalk strips without cuts, a dirt gap between sidewalk and asphalt, and battlement teeth on rims. Verify each of these is actually gone; do not assume.
