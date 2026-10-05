# Mountain spearman — complete source candidate

Status: authored for user judgment; no user approval is claimed. No repository files, stores, ledger, brief, or other candidates were edited. No tests or gates were run.

## Literal pixel source

The source folders were empty when this turn began. All nine main poses and nine action poses were authored as ASCII palette-index row strings. Each final pxgrid contains 64 literal rows of 64 symbols. The palette has 18 opaque colors; `.` is transparent and is absent from palette.json. Blank canvas padding only supplies transparent pixels. No shape drawing, generated imagery, tracing, frame transforms, interpolation, or calculated shading was used.

Native PNGs and GIFs under `review/` decode these rows directly. GIFs retain the authored palette, with no color reduction. They are review artifacts, not evidence of runtime installation or user selection.

## Silhouette and materials

- Broad, low conical straw hat with pale upper-left straw facets, a darker underside, and a visible face below its brim.
- Slender ochre durumagi, long split skirt, navy sash and trousers, straw shoes. The robe's bright left folds and brown right folds were placed explicitly in each posture.
- A narrow wooden spear with light upper edge, dark lower edge, and pale iron head. Idle grips are near (33,29) and (24,39); the long shaft passes through both hands.
- Right-facing three-quarter face: lit cheek, dark visible eye, projecting nose, and small shadowed jaw. No letter or text effects appear in any sprite.

## Main motion changes

- `idle_a/b/c`: fixed grounded shoes; individually changed chest fullness, sleeve contour, lower grip and spear-head pixels. `idle_a` shoes touch y=60.
- `windup`: lower hat and bent knees; two hands collect the spear close to the waist, pulling the iron point back to x=44.
- `move`: torso pitches forward, trailing coat opens, legs separate into a forward step, and both grips stay on the diagonal shaft.
- `attack`: waist turns, sleeves extend to two distinct grips, spear becomes horizontal, front leg plants and rear leg braces. Iron point reaches x=58.
- `recover`: elbows fold and spear returns to the rising diagonal; legs narrow from the lunge.
- `hit`: head leans back, chest opens, near arm drops and spear lowers while remaining in both grips.
- `dead`: original low horizontal body drawing with folded robe, navy sash, exposed hand, displaced hat and dropped spear. It is not a rotated standing frame.

## Skill and status changes

- `skill_a`: deeper crouch with gathered hands and compressed blue dot clusters around the iron point.
- `skill_b`: independent low thrust posture, two connected grips at x≈27 and x≈44, iron contact point and three short straight blue traces at y=31–33, 39–41 and 43–45. The middle trace was explicitly added during visual revision.
- `skill_c`: elbows draw back, the shaft rises, and only separated blue fragments remain near the point.
- `poison_a/b`: hunched head and shoulders, one hand at the mouth and the other supporting a lowered spear. Separate hollow green bubbles grow, break and change position. The shaft behind the lower grip was extended with explicit row edits.
- `stun_a/b`: backward-slumped torso, loose arms and sagging diagonal spear; authored five-point straw-gold stars exchange positions around the head. The hat and face contours differ between frames.
- `sleep_a/b`: seated folded legs, closed-eye bars and horizontal low spear supported across the lap. Chest, sleeve, near hand and shaft-end clusters change for breathing while the seated feet remain fixed.

## Source readback and visual review

The final source rows were read back. All 18 canvases are 64×64. Ink lies within x=5…61 and y=7…60 across the set, leaving the entire outer border transparent and rows 61–63 clear. `idle_a` reaches exactly y=60. Native main and action sheets were opened for visual review. No tests or gates were run.

## Remaining visual limitations

- The slender 64px design leaves the face and individual fingers very small; eye closure and grip shapes benefit from close viewing.
- Idle breathing is restrained and the three idle frames have deliberately small differences.
- Three short skill cels communicate preparation, simultaneous triple traces and withdrawal; they do not show three separately timed thrust contacts.
- The collapse has one terminal cel, so the preview cuts from recoil to the fallen body.
- Runtime dash movement, damage, sound and status application have not been previewed here. These files are a complete art candidate for human review.
