# 산적 칼잡이 — native64 candidate

User correction: **follow the silhouette and action brief**.
No existing source grids were present at the start. This is a complete new candidate for user judgement.

## Source and materials

- `palette.json`: 18 ASCII symbols; `.` is absent and represents transparency.
- `poses/`: nine independently authored 64 × 64 literal grids.
- `actions/`: nine independently authored 64 × 64 literal grids, including the full character and effect pixels.
- Every final source row is literal ASCII. Hand-chosen row fragments were expanded with transparent padding only. Character shapes, shading, poses and effects were authored as explicit pixel clusters.
- Light comes from the upper left. `b/t/d` describe the short brown jeogori; `p/l/s` describe skin; `i/I/m` describe iron; `w/W` describe wooden shield boards; `n/q` describe trousers. Hair, red headband and waist tie stay consistent.
- Ink stays inside the transparent border and ends by y=60. `idle_a` soles are explicitly drawn on y=60. Coordinates below are zero-based.

## Explicit silhouette and pose work

| Frame | Authored change |
| --- | --- |
| idle_a | Topknot at (28–32, 8–11), red headband and trailing ends, broad shoulders, diagonal jacket overlap, bent knees, short broad iron sword and round plank shield with iron boss. |
| idle_b | Raised and expanded shoulder/chest rows, a changed shield rim and grip, adjusted sword/hand clusters; feet stay planted. |
| idle_c | Settled chest, lowered head clusters and altered shield outline; boots retain the grounded stance. |
| windup | Sword raised across the crown, gripping hand joined to the bent arm; shoulders gather and shield drops against the rear hip. |
| move | Forward leaning chest and head, independently redrawn wide stride, leading sword hand and horizontally carried blade. |
| attack | Extended shoulder, elbow and wrist; broad blade runs down toward the forward foot. The arm and blade are connected. |
| recover | Torso straightens, blade draws back and shield moves toward the forward side. |
| hit | Head recoils left, eye closes, jacket folds compress and the sword arm loses its high guard. |
| dead | Collapsed horizontal head/torso and folded legs. Added explicit wooden shield rows at x=29–42, y=47–60 so the fallen character retains its other weapon. Sword lies below the body. |

## Skill and status clusters

- **skill_a:** independently raised sword on the rear side, spread arms, exposed forward shield. Short red readiness sparks sit beside the upper blade at x=11–14, y=12–14.
- **skill_b:** torso drives right; fist, hilt and horizontal iron blade form a connected chain. Short red slash clusters curl ahead of and below the cutting edge over y=25–40; these are hand-written arcs, not a generated effect mask.
- **skill_c:** blade lowers and the shield covers the chest. Two small red remnants at y=51–52 fade near the lowered cutting edge.
- **poison_a/b:** bowed head, coughing hand at the mouth, bent torso, low shield and dropped sword guard. Green bubbles change outline, highlight and location; the second frame bends further and adds a small bubble near the mouth. Skin and clothing are not tinted.
- **stun_a/b:** closed eye, low tilted head, slack sword arm and hanging shield. Hand-authored warm stars exchange positions around the head while neck and shoulder rows change. This is a different posture from the coughing poison frames.
- **sleep_a/b:** seated folded legs, closed eyelid, resting shield and relaxed sword arm. The final arm repair joins the palm at y=46–49 through the hilt to the lowered blade at y=51–58. Chest and head contours breathe, with small pale breath puffs by the mouth; no letters are drawn.

## Visual review and remaining limitations

Native PNGs and the dark/light contact sheets in `review/` were opened for visual review. Sheets read left to right, top to bottom in the pose/action orders listed in TIMING.md. The GIFs use the same native source pixels and source palette.

Remaining visual problems for user review:

- The shield reads largely face-on; its shallow three-quarter thickness is compressed into the dark right rim.
- Fingers and facial expressions are abbreviated at this resolution; the sword grip and closed eyelids use small clusters.
- The dead shield leans prominently against the fallen body and partly hides its waist.
- The three skill keys make the large swing abrupt; timing supplies the anticipation/contact/recovery rhythm, with no intermediate poses.

User judgement is pending. This document records authorship and visual limitations, not user approval.
