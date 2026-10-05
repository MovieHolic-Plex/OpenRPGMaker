# Native GIF timing and anchors

All holds are milliseconds. Review GIFs keep each source at 64 × 64 with its original palette and transparent background. No in-between frames or body transforms are added. These are candidate playback timings, not installed runtime configuration.

## Frame order

Pose sheet: `idle_a`, `idle_b`, `idle_c` / `windup`, `move`, `attack` / `recover`, `hit`, `dead`.

Action sheet: `skill_a`, `skill_b`, `skill_c` / `poison_a`, `poison_b`, `stun_a` / `stun_b`, `sleep_a`, `sleep_b`.

| GIF in review/ | Order and holds | Rhythm |
| --- | --- | --- |
| idle.gif | idle_a 220 → idle_b 220 → idle_c 220 → idle_b 220 | Loop, 880 ms; planted feet with shoulder breathing. |
| attack.gif | idle_a 440 → windup 240 → move 100 → attack 160 → recover 240 → idle_a 440 | Gather shoulders, drive right, hold the downward cut, retrieve the shield. |
| skill.gif | idle_a 440 → skill_a 360 → skill_b 180 → skill_c 320 → idle_a 440 | Longer raised-blade anticipation, short horizontal contact, protective recovery. |
| poison.gif | poison_a 360 → poison_b 360 | Coughing bend with changing toxic bubbles. |
| stun.gif | stun_a 260 → stun_b 260 | Slack posture and alternating star positions. |
| sleep.gif | sleep_a 700 → sleep_b 700 | Slow seated breathing; closed eyes throughout. |
| hit-dead.gif | idle_a 440 → hit 240 → dead 1000 | Review-only recoil/collapse loop. Dead can be held indefinitely in a game. |

The review GIFs loop. Impact timing is suggested at the first display of `attack` or `skill_b`; no gameplay damage or sound has been authored here.

## 난도질 anchors

Coordinates are zero-based native pixels. Palm and mouth locations are approximate cluster centers.

| Key | Sword hand | Mouth | Weapon / characteristic effect |
| --- | --- | --- | --- |
| skill_a | (20, 21) | (35, 27) | Grip joins the handle at (20, 19); raised iron edge runs through (20, 9). Readiness sparks are beside the blade, not emitted from the mouth. Shield arm is spread forward. |
| skill_b | (41, 32) | (37, 25) | Palm joins the hilt at (45, 32); broad iron edge reaches (53, 32). The red slash curves ahead of the blade and returns below it. This is the contact key. |
| skill_c | (37, 43) | (32, 23) | Lowered grip joins the hilt near (39, 46) and blade near (45, 49); red remnants are at y=51–52. The shield covers the chest during recovery. |

The blade effect follows the sword action. The mouth is listed as a character anchor and does not launch this skill. Poison bubbles, stun stars and sleep puffs have their own literal pixels in their status grids.
