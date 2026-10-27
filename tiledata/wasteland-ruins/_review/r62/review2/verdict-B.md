VERDICT: oil-stain-a=PASS, oil-stain-b=PASS, scorch-a=FAIL, scorch-b=PASS, crop-bed-b=PASS, crop-bed-c=PASS

oil-stain-a 1: PASS — flat horizontal almond smear, no standing face or side wall; lies on the dirt (oil-stain-a-3x, /tmp 10x zoom).
oil-stain-a 2: PASS — dark brown-black soak with a soft mid-brown halo and a 3-4 px blue-grey sheen streak; at 1x it reads as a wet dark stain, not a pit (no lit rim / shadowed far wall) and not water (sheen is tiny, body is dark brown). At 10x the centred sheen inside a dark almond is slightly eye-like, but not at 1x.
oil-stain-a 3: PASS — 4 steps (halo, mid, core, sheen), no flat fill, no single-pixel speckle, halo dithers into the dirt with no square edge on either dirt-c or dirt-d.
oil-stain-a 4: PASS — beside drums/shacks (settlement-1 21_25 by drum, shanty-3 7_10 by shack+drum, ruined-city-5 22_34 by car wreck); no cell seam, no stamp rows visible.
oil-stain-a 5: PASS — subtle, game-like, not toy-like.
oil-stain-b 1: PASS — flat compact smear, top-down.
oil-stain-b 2: PASS — same oil language as a, more compact; dark soak with sheen, reads as oil, not a hole.
oil-stain-b 3: PASS — 4 tones, soft halo, no outline. Note: very close in silhouette to oil-stain-a (both horizontal almonds with centred blue sheen); variants are weakly distinct but this is not a fail.
oil-stain-b 4: PASS — settlement-4 16_15 by drum, ruined-city-2 37_36 by car wreck, shanty-3 33_26 just below the wrecked van on the road (a bit far, ~2 cells, acceptable). No cell cut.
oil-stain-b 5: PASS.
scorch-a 1: PASS — flat on ground, no side face.
scorch-a 2: FAIL — near-circular, symmetric blob with a near-black centre and a ring of light-grey single pixels around the dark core: at 1x (settlement-1 2_12 beside the brick ruin; shanty-6 30_11 beside the rubble pile) it reads as a small burrow hole / pit with pebbles on its rim, not a burnt patch. No charred-stick or soot-streak shape, no ash gradient fanning outward.
scorch-a 3: FAIL — the grey "ash/stones" are isolated single pixels scattered on black = salt-and-pepper noise; the core is one flat near-black fill (~6x4 px) with a hard dark ring, so the shape has a ring outline rather than fading.
scorch-a 4: PASS — placement by ruins/rubble is sensible, no seams.
scorch-a 5: FAIL — round dotted hole reads as a generic placeholder, weaker than scorch-b.
scorch-b 1: PASS — flat elongated patch, top-down.
scorch-b 2: PASS — elongated black core with 2-3 px grey stick shapes and a single ember pixel reads as charred sticks/ash on burnt ground (settlement-1 11_23 beside rubble/crates).
scorch-b 3: PASS — 4-5 tones (brown halo, dark brown, black, grey sticks, ember), sticks are multi-pixel strokes not noise, halo fades into dirt. Core is still fairly flat black but acceptable.
scorch-b 4: PASS — beside rubble/ruin, no cell edge.
scorch-b 5: PASS.
crop-bed-b 1: PASS — rectangular frame seen from above with a slightly heavier bottom lip; rows and rosettes read top-down.
crop-bed-b 2: PASS — tilled dark-brown ridge rows with 3x3 grid of green rosettes reads as a planted bed, not a crate/grille. Frame reads as grey scrap metal/concrete rails with rust dots rather than wooden planks (brief says plank frame) — plausible for wasteland, not a fail.
crop-bed-b 3: PASS — soil ridges 3 tones, leaves 3-4 greens with highlight, frame highlight/mid/dark; no salt-and-pepper, edges sit on dirt cleanly. Frame joints at x=16/32 align with cell boundaries but read as rail joints.
crop-bed-b 4: PASS — settlement-4 41_26, between the two fence runs, separated from bed-c by crates/drum, offset vertically as specified. Plot sides are open (concrete posts only), so "fenced" is only top/bottom — minor.
crop-bed-b 5: PASS.
crop-bed-c 1: PASS — top-down, same frame language.
crop-bed-c 2: PASS — different planting (leafy rosettes with red fruit pixels, tomato-like) and a blue-grey left rail; clearly a second garden bed, not a duplicate.
crop-bed-c 3: PASS — same shading depth as b; red fruit are 1-2 px clusters on leaves, read as fruit not noise.
crop-bed-c 4: PASS — settlement-4 35_24 inside the fenced strip next to fence top run; pairs with b.
crop-bed-c 5: PASS.

FIXES:
scorch-a: break the circular symmetry — make the patch an irregular, wider-than-tall smudge (~12x7) with one lobe trailing to a side; replace the hard near-black ring with a 3-step falloff (dark brown halo dithered 1-2 px into dirt -> charcoal brown -> black only in a 2-3 px off-centre core); remove all isolated single light-grey pixels and instead draw 2-3 short grey-ash/charred-stick strokes (2-3 px lines, dark grey with one light-grey tip, like scorch-b) crossing the core; add 1-2 warm ash pixels (desaturated tan-grey) at the halo edge so it reads as ash, not a pit rim. Keep it clearly different in silhouette from scorch-b (e.g. scorch-a = soot fan/streak from a burnt wall, no sticks, but greyer ash gradient).
Optional (non-blocking): oil-stain-b — vary silhouette from oil-stain-a (e.g. a drip trail or two-lobe splash) and shift the sheen off-centre to avoid the eye-like centred highlight; crop beds — if "plank" is required, tint the rails warm brown with grain lines.

VERDICT: oil-stain-a=PASS, oil-stain-b=PASS, scorch-a=FAIL, scorch-b=PASS, crop-bed-b=PASS, crop-bed-c=PASS
