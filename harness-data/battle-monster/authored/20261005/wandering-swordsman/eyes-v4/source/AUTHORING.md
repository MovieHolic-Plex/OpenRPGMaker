# Wandering swordsman / eyes-v4

## Scope and reference study

This revision repairs only the eyes and upper lids of the eighteen copied original frames. The supplied original parent contact sheet, the existing native 64×64 idle/hit/dead/sleep images, and the supplied nearest-neighbour 8× face image were viewed before editing. The original face has a one-pixel far eye and a heavy two-pixel near eye; the status faces use still heavier dark runs. The repair keeps the existing face outline, nose, cheeks and jaw.

Every change is an explicitly chosen ASCII palette cell inside the user's permitted eye rectangle. Existing frame files were patched at their byte offsets; no frame was regenerated, transformed or interpolated. All nine pose files and all nine action files are retained. Existing action silhouettes, hands, weapons and effects were already present and were preserved.

`palette.json` and `TIMING.md` were not written. Hair, clothing, limbs, weapons, effects, canvas, transparent margins and grounding outside the eye rectangles were not written. No preview, reference, renderer, repository, store, ledger, brief or other candidate was written. Existing previews still depict the original eyes.

## Eye decisions

- Neutral idle, windup, move, attack, recover and skill: `H` (#292B37) is a single-pixel pupil in each eye. Both pupils sit toward the right side of their small eye spaces. Only the nearer eye has one `C` (#E9DFC5) sclera pixel immediately to the pupil's left. Single `s` (#AC755B) upper-lid pixels sit directly above the pupils. Two skin cells separate the eye groups across the bridge. The old near-eye `OO` bar is removed.
- Hit and poison: two connected warm `s` cells above each eye suggest strain. Each eye still has just one `H` pupil; the near eye has one `C` sclera cell. Pupils occupy the right end of each eye space, at the same height. The existing skin-coloured bridge is retained.
- Stun: a single warm lid above each softened `h` (#4A4D59) pupil reduces the contrast. The near eye retains one small `C` sclera cell. These eyes remain partly open and keep the shared rightward gaze.
- Sleep and dead: two short horizontal `ss` lids replace the black eye runs. There are no pupils or sclera in these closed eyes, no separate brows above them, and a two-cell skin gap remains over the bridge. Both closed lids share the same row.

No pure-black eye mask, white `I` highlight, extra eye, widened face or new decorative pixel was added. Skin/nose rows below the eye line remain literal originals.

## Exact before/after row fragments

Coordinates are zero-based. Each entry records the complete seven-cell fragment at `x_min ≤ x < x_max_exclusive` for one row `y`; cells that stay the same inside the fragment were not given a different value. Only the listed rows have changes.

| Source frame | y | x interval | Before | After |
|---|---:|---|---|---|
| `poses/idle_a.pxgrid` | 20 | [26, 33) | `FFFFSSS` | `FsFFSsS` |
| `poses/idle_a.pxgrid` | 21 | [26, 33) | `FOFSOOF` | `FHFSCHF` |
| `poses/idle_b.pxgrid` | 20 | [26, 33) | `FFFFSSS` | `FsFFSsS` |
| `poses/idle_b.pxgrid` | 21 | [26, 33) | `FOFSOOF` | `FHFSCHF` |
| `poses/idle_c.pxgrid` | 20 | [26, 33) | `FFFFSSS` | `FsFFSsS` |
| `poses/idle_c.pxgrid` | 21 | [26, 33) | `FOFSOOF` | `FHFSCHF` |
| `poses/windup.pxgrid` | 22 | [29, 36) | `FFFFSSS` | `FsFFSsS` |
| `poses/windup.pxgrid` | 23 | [29, 36) | `FOFSOOF` | `FHFSCHF` |
| `poses/move.pxgrid` | 21 | [34, 41) | `FFFFSSS` | `FsFFSsS` |
| `poses/move.pxgrid` | 22 | [34, 41) | `FOFSOOF` | `FHFSCHF` |
| `poses/attack.pxgrid` | 21 | [36, 43) | `FFFFSSS` | `FsFFSsS` |
| `poses/attack.pxgrid` | 22 | [36, 43) | `FOFSOOF` | `FHFSCHF` |
| `poses/recover.pxgrid` | 21 | [30, 37) | `FFFFSSS` | `FsFFSsS` |
| `poses/recover.pxgrid` | 22 | [30, 37) | `FOFSOOF` | `FHFSCHF` |
| `poses/hit.pxgrid` | 22 | [23, 30) | `FFFFSSS` | `FssFSss` |
| `poses/hit.pxgrid` | 23 | [23, 30) | `FOOFSSO` | `FFHFSCH` |
| `poses/dead.pxgrid` | 51 | [40, 47) | `FOOFSOO` | `FssFSss` |
| `actions/skill_a.pxgrid` | 20 | [28, 35) | `FFFFSSS` | `FsFFSsS` |
| `actions/skill_a.pxgrid` | 21 | [28, 35) | `FOFSOOF` | `FHFSCHF` |
| `actions/skill_b.pxgrid` | 20 | [30, 37) | `FFFFSSS` | `FsFFSsS` |
| `actions/skill_b.pxgrid` | 21 | [30, 37) | `FOFSOOF` | `FHFSCHF` |
| `actions/skill_c.pxgrid` | 22 | [28, 35) | `FFFFSSS` | `FsFFSsS` |
| `actions/skill_c.pxgrid` | 23 | [28, 35) | `FOFSOOF` | `FHFSCHF` |
| `actions/poison_a.pxgrid` | 24 | [28, 35) | `FFFFSSS` | `FssFSss` |
| `actions/poison_a.pxgrid` | 25 | [28, 35) | `FOOFSSO` | `FFHFSCH` |
| `actions/poison_b.pxgrid` | 28 | [29, 36) | `FFFFSSS` | `FssFSss` |
| `actions/poison_b.pxgrid` | 29 | [29, 36) | `FOOFSSO` | `FFHFSCH` |
| `actions/stun_a.pxgrid` | 25 | [28, 35) | `FFFFSSS` | `FFsFSSs` |
| `actions/stun_a.pxgrid` | 26 | [28, 35) | `FOOFSOO` | `FFhFSCh` |
| `actions/stun_b.pxgrid` | 26 | [28, 35) | `FFFFSSS` | `FFsFSSs` |
| `actions/stun_b.pxgrid` | 27 | [28, 35) | `FOOFSOO` | `FFhFSCh` |
| `actions/sleep_a.pxgrid` | 24 | [28, 35) | `FOOFSOO` | `FssFSss` |
| `actions/sleep_b.pxgrid` | 25 | [28, 35) | `FOOFSOO` | `FssFSss` |

## Remaining visual limits

- The permitted seven-cell strip leaves room for one-pixel pupils and restrained lids, not detailed irises or independent gaze angles. The far eye has no added sclera because the face is too small for another bright cluster.
- The original hit/status eye spaces sit one cell farther right within the face than the neutral eye spaces. Both eyes in each state share that placement; the nose and head silhouette were preserved.
- Warm closed lids and softened stun pupils have deliberately lower contrast than the original black blocks. Their readability against the actual battle background still needs human judgement at native size.
- Mouths, nose shading, skin planes and all dense collar/hand/weapon junctions retain their original limits. This repair does not alter those areas.
- No new previews were created, no tests or gates were run, and no battle playback or independent review was performed. This candidate is for the user's visual judgement; no user approval or successful battle verification is claimed.
