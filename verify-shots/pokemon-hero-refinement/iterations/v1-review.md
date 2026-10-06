# Hero v1 hostile review

**REJECT:69/100.** Fixed threshold85; anatomy and walking also fail their axis minima. No critical-failure IDs assigned: this is an identifiable human with coherent costume and genuine leg alternation, but its art is not finished.

Reviewer:hero_hostile_review; author:root.
RubricSHA256:`2cf097d80cc9d8f17110fcebd21b7493b7320bc101596126cebd5cff66dcd5ec`.
PNG SHA256:`f6241fca9929d5ef54aef2c4772b0e1f7fa712f0c6961943758108bf93d91775`.
GIF SHA256:`e551b80538b81ef370d5ab4826a9fac76d5b911ff62223f05afe62895dbd6252`.

## Full-frame evidence

Decoded all4GIF frames, each140ms, infinite loop; frames1/3 are identical. Viewed complete twelve-pose native sheet and all GIF frames at1x/4x. Browser playback was not claimed. Paths, file/decoded-frame hashes and bboxes are in v1-review.json.

## Scores

|Axis|Score/max|
|---|---:|
|silhouette|14/20|
|anatomy|12/20|
|walking|12/20|
|pixelCraft|11/15|
|identity|12/15|
|directionContinuity|4/5|
|loop|4/5|

## Findings

**silhouette**: A compact human now reads at1x, but the broad cap and pointed lower head dominate a very short torso. The profile has a mushroom head/stump body balance rather than an intentional adventurer silhouette.

**anatomy**: Jaw tapers directly into a narrow collar; front shoulders and vest compress into a six-row block. At side stepA the cream sleeve/skin projection and leg root are hard to parse. Two-row legs have little distinction between thigh, knee and ankle, and merged profile idle feet form one broad wedge.

**walking**: StepA/B exchange lower shoe contact and opposed arms, so real alternation exists. The stride still reads as abrupt spreading/rejoining of short legs with shoe replacement rather than weight transfer; profile idle shoe mass jumps to separated soles in steps. The1px body bob is coherent but does not solve this.

**pixelCraft**: Main clusters are much cleaner than the baseline, but layered cap highlight pixels and several similar dark blues spend palette budget on weak volume. Thin stair outlines in cheek/neck and sleeve/hand contacts remain diagrammatic.

**identity**: Red cap, blue vest and gold-red pack are consistently present, including actual side bag volume. The full-width red cap rim still reads more like a mushroom/helmet than a distinct cap brim; pack attachment/straps are compressed and back pack is a flat plaque.

**directionContinuity**: All four directions are unambiguous and retain the same costume/proportions. Profiles are mechanically mirrored and offer limited convincing depth.

**loop**: All four GIF frames decode at140ms, frames1/3 match, and the intentional1px step bob repeats without a file-level seam. Foot shape/contact changes remain visually abrupt.

## Necessary corrections
- Redraw front/profile lower head and collar to produce a clear jaw-neck-shoulder transition; reduce cap dominance or increase readable torso proportion without violating native bounds.
- Make cap brim a distinct directional projection instead of an uninterrupted full-width dark-red rim; simplify cap highlight cluster.
- Resolve profile sleeve, elbow/hand and shorts-to-leg attachment so limb roots are readable at native size; the right stepA region roughlyx8..11/y23..28 currently interleaves these forms.
- Redraw the entire hip-to-foot sequence with a stable shoe design and contact plane; retain distinct support/swing roles, avoid idle broad black wedge versus sudden separated step soles.
- Give the gold-red back pack a clearer edge/strap attachment and modest depth; do not lose the improved profile bag mass.

The rubric is unchanged. Relative improvement over the rejected baseline did not affect the pass criterion.
