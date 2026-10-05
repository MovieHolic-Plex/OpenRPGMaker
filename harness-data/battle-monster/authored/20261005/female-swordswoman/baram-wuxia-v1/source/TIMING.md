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
