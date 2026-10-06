# 뇌운 해태 — ornate-boss-v1

## Source and anatomy

- Original Joseon folklore fantasy lion-beast, viewed toward the right in three-quarter side view; upper-left light. References were visually inspected only.
- Native cell: **96×96**, shared **18-color** ASCII palette. `.` is transparent and absent from `palette.json`. All 18 delivered grids contain exactly 96 literal rows of 96 symbols.
- Final idle creature without foot clouds occupies **x=4..89, y=15..92**: **86px wide × 78px high**. Small foot clouds extend to x=92. Genuine rear and front soles reach y=92. Every frame keeps a transparent outer border and all ink stays at y≤92.
- One curved gold horn, a broad short muzzle with a blunt dark nose and warm eye, a compact blue-grey barrel, four connected claw paws, muscular rear haunches, and a curled jade tail.
- Broad mint-lit jade mane curls frame the head and neck. Three substantial gold armor plates, jade armor inlay, a bronze/gold neck collar and pendant, and bronze wrist/hock bands concentrate ornament into readable material planes.

## Explicit authored changes

1. Replaced the initial narrow face and lean leg layout with a wider muzzle, deeper torso, separate far paws and connected foreleg shoulders.
2. Enlarged rear thighs through individually selected native rows; broadened their soles and metal bands.
3. Added a hanging jade-inlaid shoulder plate and maintained its material patches through idle breathing states.
4. Authored a retracted neck/horn, raised folded forepaw, lowered forward contact head, planted broad forepaw and mane recovery. No complete frame was translated, rotated, scaled or interpolated.
5. Authored collapsed and reclining bodies separately. Death has collapsed shoulders/neck and a closed slack eye; sleep has one-row closed eyelids, folded paws and an independently selected breathing variant.
6. Poison lowers the neck and bends the front knees; two different violet/jade fumes emerge beside the muzzle. Stun uses a limp jaw/neck, braced knees and two separately selected star layouts.
7. Horn charge is a compact bent current at the real horn tip. Cast uses a thick angled main lightning trunk, a short subordinate branch and two separated paw clouds. Recovery has exactly two small residual current pieces.

## Deliverables and method

- `poses/`: idle_a, idle_b, idle_c, windup, move, attack, recover, hit, dead.
- `actions/`: skill_a, skill_b, skill_c, poison_a, poison_b, stun_a, stun_b, sleep_a, sleep_b.
- `.pxgrid` files are the complete literal native sources. `design.py`, `pose_rows.py`, `rest_rows.py`, `magic_rows.py`, and `refinements.py` preserve the chosen row strings and coordinate patches. `author.py` only serializes those rows, pads chosen patches and decodes them. No masks, line rasterizers, tracing, generated silhouettes, procedural shading or palette extraction were used.
- `progress/idle.png` is the final 1× decoded idle; `idle-4x.png` is diagnostic nearest enlargement. Each delivered grid also has its own decoded 1×/4× PNG.
- `render.py` decodes the delivered grids into native review sheets and eight 8× diagnostic GIFs. GIF background is an opaque neutral viewing mat; native PNG/source transparency remains binary alpha.
- All 18 complete grids are distinct. Palette, row dimensions, native margins and baseline were inspected during decoding. This was source inspection; no repository tests or gates were run.

## Visual review and remaining limitations

Actual decoded native idle and its 4× enlargement were viewed before remaining pose authoring. Both final pose sheets and action sheets were inspected, and the encoded attack/skill GIF contact frames were opened at 8×. Disconnected far-foreleg stumps and old lifted-paw fragments found in the first sheets were repaired with explicit shoulder/erase rows. Sleep/death eyes were revised into narrow closed lids.

Remaining visual limitations: the far front leg uses a pronounced elbow angle in the braced states; the face retains some canine angularity alongside the heavy lion jaw. Idle breathing is intentionally subtle at 1×. Far-side claws are partly occluded by the near feet. The 96px skill box confines the main bolt to an upward/right bend; it is a contained cast demonstration, not a long-range battlefield projectile.

**Independent review was not executed:** the separate reviewer spawn failed with `no thread with id`. The inspection described here is the author's own review and must not be represented as independent approval. No user approval, installation, pack selection or gameplay synchronization is claimed.

All writes for this task are inside this candidate's `source/` directory.
