# Wandering swordsman / reference-v3

**New candidate for human review. Unselected; no user approval is claimed.**

## Reference study

Before drawing, opened the supplied actual LordNeo and SolaarNoble reference PNGs. LordNeo informed the compact overlapping torso, broad stance and continuous hand/weapon relationship. SolaarNoble informed connected shoulder–elbow–wrist anatomy and the placement of two feet beneath a pelvis. Their clothing and pixels were not copied, sampled, extracted or included in these deliverables. The images remain outside `source`.

## Original character

The correction's navy robe, cream collar, rust sash and tied black hair supersede the earlier pale robe/teal sash description. This is an unarmoured Korean folklore swordsman with a small topknot, loose robe sleeves, overlapping collar, split robe skirts, cream cloth trousers and dark boots. There is no helmet, cuirass or samurai shoulder armour.

`idle_a` is 49 pixels tall, from topknot y12 to boot soles y60. The main head mass is about 14 pixels wide and 13 pixels high, excluding the small topknot. The shoulder/sleeve span is approximately 23 pixels. Both eyes are visible: the farther eye is one dark pixel and the nearer eye is a two-pixel cluster. Cheeks and jaw are rounded; the nose stays inside the face silhouette. The face is adult and beardless.

All eighteen grids were authored as explicit ASCII rows. No source frame was produced by moving, rotating, scaling, tweening or rasterizing another frame. Large unchanged identity clusters were explicitly written again where appropriate. Later corrections used named row replacements and short, individually chosen clusters. The renderer only decodes those rows; final PNGs, GIF frames and contact sheets retain native 64×64 cells.

## Explicit drawing decisions

- Upper-left light: large blue sleeve/shoulder planes, cream collar and trouser planes, skin forehead/cheek planes. Shadows collect under overlapping sleeves and on the lower/right robe. Highlights are connected masses rather than scattered skin dots.
- `idle_a/b/c`: distinct sleeve, chest, skirt, grip and blade clusters; boots remain grounded. The near arm bends through the sleeve to a roughly 5×5 skin hand. Tan grip, brass guard, outlined silver blade and hand share adjacent pixels. The other hand holds the tan scabbard across the sash.
- `windup`: lowered pelvis, bent knees, both hands close to the scabbard mouth, only the short exposed blade visible. The broad sleeve overlaps the torso at y34–39.
- `move`: forward shoulder/pelvis relationship, opened rear leg and planted forward boot. The right sleeve now meets the grip directly at y37–41; a preliminary detached hand was redrawn.
- `attack`: separate wide lunge with a horizontally extended sleeve, continuous wrist/grip and a short single-edged blade. Sword and hand rows y30–36 were redrawn to give the blade useful native length.
- `recover`: front elbow drops and the blade points diagonally down; the hips and knees return toward the idle stance.
- `hit`: recoil through shoulders, bent knees, open mouth and raised bent weapon arm, with the scabbard hand still attached to the opposite sleeve.
- `dead`: replaced the initial crouching collapse with an authored horizontal fallen torso, extended cloth legs, closed eyelids, released scabbard and blade on the ground. The full head identity remains visible; y60 contains the resting lower contours.
- `skill_a`: back/down blade draw with a split silver-blue flame cluster along the blade. Its root connects through the hand, tan grip and brass guard. The opposite hand braces the scabbard.
- `skill_b`: new forward stance and an anchored horizontal sword. The crescent grows from the sword tip toward the right edge, with uneven thickness and individually authored tapering ends; the body is not reduced to fit it.
- `skill_c`: re-sheathing posture, a short remaining blade highlight and three separate torn silver-blue remnants to the right. They are newly drawn fragments, not a scaled crescent.
- `poison_a/b`: stomach hand, lowered shoulders, strained face and progressively buckled knees. Gold-rimmed bubbles change number, size and location. They use the existing brass/cream/rust palette; the person retains the normal clothing and skin colours.
- `stun_a/b`: both sleeves hang, eyelids lower, mouth slackens, weapon points down. Individually drawn stars occupy different positions. The second cel has an asymmetric buckled knee and an independently redrawn boot; overlapping preliminary leg contours were removed at y53–60.
- `sleep_a/b`: closed eyes, slackened grip, lowered weapon and breathing changes in chest width, collar, sleeves, mouth and knees. No text or letter-shaped sleep symbol. The scabbard hangs from the waist hand in both cels.

The 18-symbol palette is shared by every frame. `.` is absent from the palette and decodes to alpha 0; all palette colours decode to alpha 255. No reference art enters the palette.

## Inspection and scope

Decoded all eighteen final grids and viewed their native contact sheet. Each file has 64 literal rows of 64 ASCII symbols. All ink lies within x1–62 and y1–60; actual minimum x is 8 and minimum y is 10. `idle_a` boot soles touch exactly y60. There are three empty bottom rows. Preview PNGs and eight GIFs are in `previews/`, with native light/dark contact sheets as well.

Only this candidate's `source` was written. No repository code, project store, brief, seed, human ledger, other candidate or old `motions-v1` was edited. No tests, gates, independent review or game integration was run. Renderer output is an inspection aid, not approval or a claim of animation quality.

## Remaining visual limitations for the human reviewer

- At native size the 5-pixel grips and cream collar junctions are dense; the two hands are clearest in preparation and recovery. Finger articulation is deliberately minimal.
- Poison bubbles share brass/rust colours to stay within eighteen colours. They may read as alchemical motes rather than green toxic vapour.
- The fallen pose compresses the robe and trousers into a shallow horizontal silhouette. It is a stylized collapse with the face still visible, rather than a realistic prone body.
- Crescent contact reaches x62, leaving only the required one transparent pixel at the right edge. Its ends are sharp and its contact cel is held for 160 ms; the reviewer may prefer a softer taper or shorter hold.
- This set contains discrete key poses. Dash movement, final gameplay timing and the match against the actual battle background remain for the external harness and human review.
