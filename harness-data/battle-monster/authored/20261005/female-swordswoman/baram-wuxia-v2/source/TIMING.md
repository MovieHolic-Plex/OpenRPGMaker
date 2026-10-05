# Animation intent and anchors

Coordinates below are zero-based native pixels. These holds describe artist-intended inspection rhythm. Production GIF holds are supplied by the harness; this file is not evidence of runtime battle timing. No GIF or game playback was run here.

| Sequence | Pose order | Intended holds (ms) |
|---|---|---|
| Idle | idle_a → idle_b → idle_c → idle_b | 220 / 220 / 220 / 220 (brief idle interval) |
| Dash cut | idle_a → windup → move → attack → recover → idle_a | 220 / 180 / 100 / 140 / 180 / 220 |
| Hit | idle_a → hit → recover → idle_a | 220 / 180 / 160 / 220 |
| Fallen | hit → dead | 180 / 700; hold dead |
| 청풍참 | skill_a → skill_b → skill_c → idle_a | 260 / 120 / 240 / 220 |
| Poison | poison_a ↔ poison_b | 320 / 360 |
| Stun | stun_a ↔ stun_b | 300 / 300 |
| Sleep | sleep_a ↔ sleep_b | 500 / 560 |

## 청풍참 anchors

- `skill_a`: raised grip/palm near (31,31–33); connected blade runs up-left to the tip near (14,13). The small turquoise compression cluster around (12–16,11–15) touches that tip. The other hand remains by the hip.
- `skill_b`: forward gripping hand near (42,34), guard near (44,33); steel continues up-right to (55,22). Both energy branches begin at that actual tip: the upper branch tapers toward (61,12), the lower fork bends toward (62,32). The waist and wide legs turn into the release.
- `skill_c`: retracted hand near (40,38), lowered steel begins near (43,40) and ends near (59,57). Separated remnants near (55–58,24–26), (49–52,28–30), and (59–61,32–34) fade beyond the previous cut; they are afterimages, not a new emitter.
- No mouth casting or lettering. Effect contact is represented by `skill_b`; actual damage/impact scheduling belongs to the runtime/harness.


## Bounded repair timing and revised anchors — 2026-10-06

The original timing table and 청풍참 notes above are preserved. No hold values or pose order changed. The nine skill/status grids already existed; only the two sleeping grids were repaired, while the three skill grids, both poison grids, and both stun grids remain byte-identical. These are still intended GIF holds, not measured runtime scheduling; no GIF or game playback was run.

- Dash draw: `idle_a (220 ms) → windup (180 ms) → move (100 ms) → attack (140 ms) → recover (180 ms) → idle_a (220 ms)`. In windup the drawn-back elbow is at x20–24/y34–36, the gripping palm highlights at (31,34) and (32,35), and the dark hilt at (32,34) → (33,35) → (34,36). The guard spans x33–36/y37. The short emerging blade continues down-right through the bright edge at (37,38) → (38,39) → (39,40) into the waist sheath mouth at x39–41/y41. The bracing palm is near (38,41), and the compact sheath follows the same down-right axis through y46. No mouth emission occurs.
- Sleep: `sleep_a (500 ms) → sleep_b (560 ms) → sleep_a`, repeating. Sleep_a uses a narrow shaded neck and slightly higher relaxed cuff, sleep_b a deeper tucked neck and fuller lower shoulder. The preserved head, knee, and hem differences supply the original nod/breath cycle; there is no frame translation or new text effect.
- Sleep_a sword palm: x43–46/y45–46, hilt (48,46), guard x46–50/y47, steel x48–50/y48, tip (54,60). Spare hand: x28–30/y42–43. Closed lids remain at their original y24 spacing.
- Sleep_b sword palm: x44–47/y46–47, hilt (49,47), guard x48–52/y48, steel x49–51/y49, tip (53,60). Spare hand: x28–30/y43–44. Closed lids remain at their original y25 spacing. Both sets of original soles still meet y60.
- 청풍참 remains `skill_a (260 ms) → skill_b (120 ms) → skill_c (240 ms) → idle_a (220 ms)`. The existing preparation palm/blade-tip compression, actual tip-born two-branch contact effect, recovery hand/steel, and separated remnants retain the anchors documented above. No mouth casting, letters, or substitute attack frame was introduced.

The repair PNGs are static inspection evidence. The eventual harness GIF should be reviewed for the transition from the compact sheathed draw to the raised moving blade and for the short downward sleeping blade; this note makes no user approval claim.
