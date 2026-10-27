VERDICT: oil-stain-a=PASS, oil-stain-b=FAIL, scorch-a=FAIL, scorch-b=FAIL, crop-bed-b=PASS, crop-bed-c=PASS
oil-stain-a 1: PASS — flat elongated smear, no standing face or side wall (oil-stain-a-3x.png, 10x crop of 1x cell).
oil-stain-a 2: PASS — horizontal dark lens with a cool blue-grey sheen in the core and a soft brown halo reads as a fluid smear soaked into the dirt; at 1x in settlement-1 21_25 and ruined-city-2 2_16 it reads as a stain, not a pit. Weak point: the near-black core is narrow and slit-like at 10x.
oil-stain-a 3: PASS — 3-4 value steps (halo, mid, core, sheen), halo fades into dirt, no cell-shaped outline.
oil-stain-a 4: PASS — beside drums/generator shed (shanty-3 7_10), drums and crates (ruined-city-2 2_16), road edge by drums (settlement-1 21_25); no cell seam, no repeated stamp rows visible.
oil-stain-a 5: PASS — reads as a subtle ground detail, not toy-like.
oil-stain-b 1: PASS — flat, no side face.
oil-stain-b 2: FAIL — round blob with a near-black core plus a single orange-red pixel on its lower edge (oil-stain-b-L10 crop, lower-left of core). The red pixel reads as an ember and the round dark core reads as a burrow hole; at 4x in settlement-1 7_23 (between van and jeep) it is practically the same silhouette and value as scorch-b next to it at 11_23, so oil and scorch are not distinguishable.
oil-stain-b 3: PASS — soft halo, several steps, no hard square.
oil-stain-b 4: PASS — next to van/jeep (settlement-1 7_23), rusted dome shelter (settlement-4 37_12); no seams.
oil-stain-b 5: PASS — not toy-like, just misread.
scorch-a 1: PASS — no standing face.
scorch-a 2: FAIL — 10x crop: a closed near-black ring with a light grey X/cross in the centre and two red pixels; reads as a small crater/pit (dark rim, light floor) or a spider/beetle at 1x (spiky ~10 px dot, shanty-6 30_11 and settlement-1 2_12 crops). No readable soot spread or charred sticks; it is a compact object, not a burnt patch.
scorch-a 3: FAIL — single-pixel black spikes radiating from the ring are salt-and-pepper noise; hard black rim instead of a soot falloff into dirt; ash centre is a flat grey cross.
scorch-a 4: PASS — beside brick ruin (settlement-1 2_12) and rubble mound (shanty-6 30_11); no seam.
scorch-a 5: FAIL — the spiky-dot / bug look is amateur next to Beodeul ground details.
scorch-b 1: PASS — flat.
scorch-b 2: FAIL — same structure as scorch-a: dark spiky ring, lighter grey core, one red pixel; light-centre-dark-rim reads as a pit/burrow or sea-urchin, not a burnt patch (scorch-b-R10 crop; settlement-1 11_23 at 4x looks like a hole beside the rubble).
scorch-b 3: FAIL — isolated black rim pixels (salt-and-pepper), no graded soot halo (only ~2 value steps between ring and dirt), patch is only ~10x9 px.
scorch-b 4: PASS — beside rubble/crates and jeep (settlement-1 11_23); no seam.
scorch-b 5: PASS — less bug-like than scorch-a, not toy-like as such.
crop-bed-b 1: PASS — frame drawn as a top-down rectangle with a thin darker front edge on the bottom rail; plants are leaf rosettes seen from above (crop-bed-b-3x, 8x crop).
crop-bed-b 2: PASS — three tilled brown ridges with dark furrow shadows, 10 green plants in rows; reads as a planted bed, not a crate or grille.
crop-bed-b 3: PASS — plants 3 greens + dark shadow, ridges 3 browns, frame light/mid/dark grey with posts; no noise. Minor: all plants are the same two sprites.
crop-bed-b 4: PASS — settlement-4 41_26: inside the garden plot between two fence rails with corner posts, next to crates/drum, offset from bed-c; dirt around is irregular, no seam.
crop-bed-b 5: PASS — on par with Beodeul garden props.
crop-bed-c 1: PASS — same top-down frame, plants seen from above.
crop-bed-c 2: PASS — ridges plus plants with red fruit dots (tomato/beet) clearly a different crop from bed-b; reads as garden bed.
crop-bed-c 3: PASS — same shading depth as bed-b; red fruit 2 tones; no flat fills.
crop-bed-c 4: PASS — settlement-4 35_24: inside the fenced plot, separated from bed-b by the crate/drum cell and offset vertically as specified. Note: the plot's left/right sides are only posts, not closed fence, but it reads as a fenced garden.
crop-bed-c 5: PASS.
FIXES:
- oil-stain-b: delete the orange-red pixel on the lower edge (no warm colours in oil). Flatten the shape: make it wider than tall (about 11x6 px) with an irregular drip lobe on one side; lower the core from near-black to a dark brown-black and add a 2-3 px cool sheen streak (dark blue-grey + one purple/teal pixel) across the core instead of a single blue dot; widen the soft brown halo by 1 px with 50% dither so it is clearly a soaked-in smear, not a round hole.
- scorch-a: remove the grey X and the black radial spike pixels. Rebuild as an irregular 12-14 px patch: outer ring of 1-2 px dithered dark-brown soot fading into dirt, inner zone dark grey-black that is NOT darker at the rim than in the centre (avoid the crater read: darkest value in the middle, lighter towards the edge), sprinkle 3-4 light grey ash pixels clustered, and add 2 short charred sticks (2-3 px dark brown/black lines with a 1 px lighter top highlight) crossing the patch; keep at most one dim red ember pixel inside a stick.
- scorch-b: same rule: invert the value gradient (dark centre, lighter soot rim), replace the isolated black rim spikes with a 2-step dithered soot halo, enlarge to ~13x10 px with an irregular lobed outline, add a charred stick or two and light ash flecks so it reads as a burnt patch rather than a pit.
