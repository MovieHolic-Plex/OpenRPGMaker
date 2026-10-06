# Hero v3 hostile review

**REDO:77/100.** Frozen minimum85. All axis minima met; no critical failures. Cap/face/shoe repairs are real, but walking articulation and head/body cluster craft remain insufficient for excellent finished art.

Reviewer:hero_hostile_review; author:root.
Rubric SHA256:`2cf097d80cc9d8f17110fcebd21b7493b7320bc101596126cebd5cff66dcd5ec`.
Sheet SHA256:`742c46a5cb015399c376623a5a80813a8b937ced9c543caa14d2fa5c93c3f8c1`.
GIF SHA256:`5ce1971f0f3571254a27e39b9940ef3c331b1cbbcca9c33dc727c8681dac3d54`.

## Evidence

All12native poses and4decoded GIF frames inspected at native/4x. Four140ms frames, loop0(infinite), frames1/3 identical. No browser playback claim. Root quality-pack hashes agree with the reviewed files. Contact paths/SHA and per-frame decoded hashes are in v3-review.json.

## Scores

|Axis|Score/max|
|---|---:|
|silhouette|15/20|
|anatomy|15/20|
|walking|14/20|
|pixelCraft|12/15|
|identity|13/15|
|directionContinuity|4/5|
|loop|4/5|

## Findings

**silhouette**: Cap taper and temple hair now produce a clear compact person instead of a mushroom helmet. Overall form remains a large rounded head above a boxy torso; the front shoulders/arms and shorts have little expressive contour.

**anatomy**: Jaw/neck transition and profile nose are now legible; sleeve/hand/waist no longer form the previous cream angular block. At native size wrist and lower arm clusters remain difficult to distinguish from skin beside the shorts. Thigh/knee/shin differentiation in up/down steps is still weak.

**walking**: Real support/swing exchange persists and profile idle soles are now visibly separated. Up/down steps mostly splay into straight diagonal skin columns, with little convincing bent swing knee or weight transfer; wrist motion reads as tiny skin flicker at the waist rather than strong opposed arm action. The repeated1px bob is regular but does not replace articulated steps.

**pixelCraft**: Cleaner cap/face and bag contacts are serviceable. Profile crown still sits above a long flat dark-red underside band; scattered orange crown highlights and several nearly adjacent navy shades fragment head volume. Vest/shorts remain flat blue clusters with ambiguous arm contact pixels.

**identity**: Cap/vest/gold-red pack are coherent and identifiable in all directions. The cap now has a brim but its crown/underside/hair read as layered color bands rather than confident cap volume; backpack remains a mostly flat gold/red plaque from behind.

**directionContinuity**: All directions retain matching proportions and costume, with a meaningful side nose and coherent pack position. Profile/front head shading still describes different degrees of depth.

**loop**: All four140ms frames repeat coherently, idle1/3 are identical, no unexplained root jump or file-level seam. Splayed-to-idle leg silhouettes and weak wrist changes make the cycle mechanical.

## Required corrections
- Redesign up/down stepA/B as one planted leg and one compact bent swing leg, retaining anatomically connected knees and a coherent shoe cluster. Current rows27..29 primarily spread straight skin columns outward.
- Make opposed arm action read as attached sleeve-forearm-hand clusters at native size. Current front/back wrist pixels aroundy24..26 disappear into skin beside the waist/shorts; avoid merely toggling individual tan pixels.
- Simplify cap highlight and dark-blue hair clusters to show one crown volume and a shorter selective brim/underside. The profile long dark-red horizontal underside currently competes with the nose and eye for defining the heading.
- Give torso/shorts and back bag selective contour/attachment depth rather than adding more tiny color patches. Keep the now-correct jaw/nose, idle shoe gap and gold-red bag placement.

The rubric remains unchanged. The next improvement should be an intentional walking-pose redesign and simplification of head/torso clusters, not another one-pixel parameter adjustment.
