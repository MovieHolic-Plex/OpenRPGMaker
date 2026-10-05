# 방랑 검객 — new, unselected candidate

This source completes the supplied newly drawn Joseon swordsman: nine core poses and nine action/status poses. It is a candidate for visual judgment. No human acceptance, game registration, battle validation, or replacement of assets outside this source folder is claimed.

## Preserved design and authorship

The supplied `palette.json` and `poses/idle_a.pxgrid` were left byte-for-byte unchanged. Their recorded and final SHA-256 values are:

- Palette: `4ac80fed1442600a88cb1862f91616444431e48695417dbcd383f0e4a175c739`
- Idle A: `0285460045670e52800648b2eaaa0a1545e5a4be5234654879d8243150847b2c`

Only the supplied new base PNG and enlarged face PNG were studied. No retired swordsman, third-party sprite, extracted reference pixels, or alternate palette was used. The face study established two separate brow/eye groups, warm cheek planes, dark side hair, and a modest adult SD jaw. The base study established the gat crown and broad brim, gray-blue dopo, dark indigo sleeveless kweja, pale collar, rust sash, short black sheath, and separated black shoes.

All new colored pixels were chosen as literal ASCII row strings or explicitly listed short pixel runs. The final `.pxgrid` files each contain 64 literal rows of 64 palette symbols. The authoring helper only adds transparent padding to row strings; it does not read idle A, derive bodies, generate shading, shift whole frames, rotate, interpolate, or rasterize geometric silhouettes. Inspection resizing uses nearest sampling only for review images, never to create a source frame.

Coordinates below are zero-based native pixels. Light comes from the upper left. The unchanged 18-color palette uses `o/k/h` for outlines, hair, gat and shoes; `d/i/j` for the kweja; `s/c/l` for the dopo; `p/t/u/e` for skin and facial marks; `r/R` for the sash; and `w/m/v` for steel and pale energy. A dot is transparent. Native PNGs use opaque palette ink and transparent background.

## Core pose changes

| Pose | Explicit anatomical and material changes |
| --- | --- |
| `idle_a` | Supplied new design, preserved exactly. Both soles reach y60. |
| `idle_b` | Broader raised shoulder and collar transition at y29–33; left sleeve contour widens at y34–39; cuff folds widen around the fixed grip. Left robe edge opens at y47–53, with new pale cloth and indigo crease runs. Feet and readable eye groups remain stable. |
| `idle_c` | Shoulder/collar compression at y29–33; sleeve edge tucks inward through y35–40; cuff and finger contact are explicitly narrowed. Lower robe narrows and its indigo center fold straightens at y47–56. Hat and eyes stay steady during breathing. |
| `windup` | Crown and brim are redrawn lower, with the same adult face. Rounded elbows close toward the waist; the draw hand cups the hilt near y40–42 and the other hand braces the sheath at y44–46. A short steel section emerges up/right at x41–46, y37–40. Pelvis compresses and both knees bend under separately gathered robe folds; two planted shoes remain. |
| `move` | New leaning head/hat contours and forward collar; the rear sleeve trails left while the front arm lowers to a firm grip. The newly drawn blade rises from the wrist toward (52,33), above the separate short dark sheath. The rear leg trails to x12–19 and the forward foot plants at x28–38. Robe panels stretch between the two knees rather than retaining the idle hem. |
| `attack` | Lower crown and adult face at y12–30; torso turns into the cut. Pale shoulder, bent elbow, narrowed forearm cuff, warm fingers, and dark guard are connected. The fist is around x33–37, y35–37; guard at (38,36); the long horizontal steel reaches x62. Rear leg stretches left, front knee bends outward, and both shoes are separately planted. New hip folds and sash placement follow the wide stance. |
| `recover` | Upright head returns above a softer shoulder. Forearm drops below the chest; fingers hold the guard near the waist and the steel points down/right. Both robe panels settle into newly folded bent knees. The hem and two shoes differ from the attack's stretched stance. |
| `hit` | Head, gat and collar recoil left relative to the hips; cheek outline and jaw are redrawn. Two visible eyes remain, with strained brows and an open pale mouth. Elbow and wrist fall away from the torso, lowering the blade. Deep asymmetric knee folds and separated feet support the recoil. |
| `dead` | Actually fallen body occupies y39–60. Exposed dark hair surrounds a sideways warm face with two closed lids at y45. The gat is dropped to the left with a flattened angled crown and oblique broad brim at x2–24, y47–58. Shoulder, chest, sash, pelvis and independently folded legs form a horizontal body. One black shoe projects at upper right and another at lower right. The slack hand rests near the dropped steel along y60. This is not an upright crouch. |

## Skill and status changes

| Pose | Explicit changes and effects |
| --- | --- |
| `skill_a` | New compact bent-knee charge, closed elbows and lowered rearward grip. The blade runs from the left wrist down/back to (5,54). Uneven white/blue edge clusters and a small curled gathering-light branch attach to the actual steel. The right hand braces near the rust sash and short sheath. |
| `skill_b` | New forward cutting stance with a diagonal shoulder–elbow–wrist chain, a newly spread robe, and unequal forward/rear knees. Grip around (43,36), guard (45,35), blade tip (54,27). A literal blue bridge at x55–60, y27 connects that tip to the silver-blue crescent. The outer crescent curves down the right edge into a narrowing lower tail; it is attached to the weapon, not a detached screen-side effect. |
| `skill_c` | Hand and collar lower into a distinct partial sheathing recovery. Draw hand at (37,42), guard near (40,43), support hand around (39,44). Short pale steel runs at x42–44, y44–47 toward the dark sheath mouth. Robe flares left before settling. The former crescent is replaced by three differently shaped, disconnected fading tears at the upper right; these fragments are intentional. |
| `poison_a` | Shoulders droop, one hand presses the abdomen and the other hangs beside the hip; a strained two-eye face and pale open mouth accompany bent knees. Blade points down/right. Rust/pale alchemical bubbles sit left of the face and right of the shoulder. No body tint is applied. |
| `poison_b` | A deeper bowed head/hat, lower collar, shifted elbow and a hand raised across the stomach. The other hand holds the blade lower across the front fold. Knee compression and hem bunching change. Round motes reappear above/right and below/left in different positions and sizes. |
| `stun_a` | Loose arms hang on both sides with visible hand ends; shoulders slump and the face retains two unfocused visible eyes. Blade hangs from the right fist. Bent legs and robe folds support the limp stance. Two warm irregular stars appear above the gat, with no lettering. |
| `stun_b` | Lower hat and jaw, deeper right sleeve, lowered wrist, and asymmetric knee compression. The front shoe sits differently from stun A. Both stars have new silhouettes and positions, rather than being mechanically shifted copies. |
| `sleep_a` | Bowed head with a sloping brim, two closed warm `e` lid groups at y26, relaxed cheek and mouth. One hand rests across the sash; the other holds a low blade. Compressed shoulders and folded knees carry a quiet standing doze. |
| `sleep_b` | Same closed-lid identity with independently widened breathing shoulder/sleeve contours, cuff folds and left robe volume. New lower indigo crease runs and expanded hem lead back to the fixed shoes; the blade stays lowered. |

## Inspection and refinements

`inspection/` contains transparent native PNGs, nearest 6× individual previews, sheets showing both 1× and 3× on checker/light/dark backgrounds, and seven timed review GIFs. These are local previews, not screenshots from battle.

The native and enlarged sheets were inspected for readable facial pairs, clothing layers, inter-limb spaces, hat identity, and hand/weapon continuity. Focused enlarged review covered the slash, moving blade, low charging blade, connected crescent, and fallen body. Specific follow-up pixel changes were:

- Added exposed steel and guard contact during windup and the forward step.
- Added an uneven connected gathering-light curl along the charge blade.
- Replaced fallen leg ends with two distinct black shoes and flattened the dropped gat crown.
- Rewrote the attack forearm, fist, guard and blade rows to lengthen the exposed horizontal steel and retain the right transparent margin.

All frame ink lies within x1–62 and y1–60; the preserved idle A soles are at y60. Intentional transparent gaps separate limbs, the dropped hat, and detached residual/status motes. No tests, gates, game stores, repository integration, ledger updates, or battle playback were run.

## Remaining visual limitations

- The gat and shoes have low contrast on very dark backgrounds; their restrained material colors are preserved from the new palette.
- Pale blade edges and the crescent lose contrast on cream/light backgrounds.
- The horizontal blade and the compact crescent are constrained by the 64px cell. The blade's exposed length differs with pose and perspective.
- Poison uses rust/pale alchemical bubbles because the shared palette has no green. At 1× these can read as small potion flecks before their round highlights are noticed.
- The fallen pose compresses cloth, pelvis and knees into a dense cluster. The two shoes and detached hat help readability, but the exact bent-leg arrangement is clearer enlarged.
- These are sparse key poses. Blade angle and stance change sharply between draw, step, slash and recovery; the supplied timing is a review proposal, not an engine-proven animation.

No human approval is recorded. These limitations and the previews are provided for the user's visual judgment.
