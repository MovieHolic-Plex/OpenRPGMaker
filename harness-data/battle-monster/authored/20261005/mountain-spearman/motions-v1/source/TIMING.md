# Native GIF timing and anchors

Coordinates are zero-based native source pixels, x rightward and y downward. Preview GIFs use the authored 64×64 frames, transparency index 0 and disposal 2. Holds are milliseconds. These are pose previews; they do not apply gameplay damage or move an entire frame.

| GIF in review/ | Pose order | Holds |
| --- | --- | --- |
| idle.gif | idle_a → idle_b → idle_c → idle_b | 220, 220, 220, 220 |
| attack.gif | idle_a → windup → move → attack → recover → idle_b | 300, 180, 80, 90, 160, 220 |
| skill.gif | idle_a → skill_a → skill_b → skill_c → idle_a | 220, 280, 110, 200, 400 |
| poison.gif | poison_a → poison_b | 340, 340 |
| stun.gif | stun_a → stun_b | 280, 280 |
| sleep.gif | sleep_a → sleep_b | 600, 600 |
| hit.gif | idle_a → hit → recover → idle_a | 300, 160, 180, 300 |
| collapse.gif | idle_a → hit → dead | 300, 180, 1200 |

All previews loop. In gameplay the dead pose should remain held. Main sheet order is idle_a, idle_b, idle_c / windup, move, attack / recover, hit, dead. Action sheet order is skill_a, skill_b, skill_c / poison_a, poison_b, stun_a / stun_b, sleep_a, sleep_b.

## 삼단찌르기 anchors

| Frame | Rear hand | Forward hand | Mouth | Iron point / effect |
| --- | --- | --- | --- | --- |
| skill_a — preparation | (25,43) | (35,38) | (28,30) | point (51,33); compressed blue dots x=43…56, y=29…36 |
| skill_b — contact | (27,37) | (44,37) | (37,32) | point (57,35); contact pixels around x=58…60, y=36…38 |
| skill_c — withdrawal | (27,38) | (35,32) | (30,25) | point (47,24); isolated fading pixels x=49…54, y=22…29 |

The weapon is the emitting anchor. The mouth emits no projectile. Each pair of hands overlaps the wooden shaft and connects to sleeves. During contact the three manually drawn short traces occupy x=52…59 around y=31–33, 39–41 and 43–45. The point extends to the right while the stance remains low. If integrated, damage/contact belongs at the start of skill_b; do not trigger gameplay events from these preview GIFs.

## Status rhythm

Poison alternates a low sick hunch with a tighter mouth-covering posture and different bubble clusters. Stun alternates two loose backward slumps and star positions. Sleep holds closed eyes and a seated stance, changing chest and sleeve clusters for a slow inhale/exhale; it contains no floating letters. None of these clips is a tinted attack frame.
