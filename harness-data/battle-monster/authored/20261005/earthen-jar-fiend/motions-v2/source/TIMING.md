# Earthen jar fiend — GIF timing and anchors

The following literal-frame orders and holds match the existing
`battle-monster/node/motions.py` scene definitions read during authoring.
This file describes playback; no GIF was encoded in this source-only pass.
No interpolation, whole-character movement, palette cycling, or extra
effect frames are needed to play these rows. Holds are milliseconds.

| GIF | Frame order | Holds in the same order | Loop duration |
| --- | --- | --- | --- |
| Idle | `idle_a → idle_b → idle_c → idle_b` | `280, 280, 280, 280` | 1120 ms |
| Attack | `idle_a → windup → move → attack → recover → idle_a` | `600, 200, 100, 120, 220, 900` | 2140 ms |
| Hit | `idle_a → hit → idle_a` | `700, 180, 900` | 1780 ms |
| Dead | `idle_a → hit → dead` | `700, 150, 1700` | 2550 ms |
| Skill: lid closure | `idle_a → skill_a → skill_b → skill_c → idle_a` | `700, 260, 160, 240, 900` | 2260 ms |
| Poison | `poison_a → poison_b` | `420, 420` | 840 ms |
| Stun | `stun_a → stun_b` | `300, 300` | 600 ms |
| Sleep | `sleep_a → sleep_b` | `650, 650` | 1300 ms |

The harness loops these GIFs. Core pose files are unchanged.

## Skill hand, mouth, and lid anchors

Coordinates are native zero-based pixels in the 64×64 cell. Feet stay on
y=60, centered beneath the body around x=33. The right side is the side
facing the allies. There is no separate weapon or projectile.

| Stage | Hand and prop anchor | Mouth/face anchor | Effect and action |
| --- | --- | --- | --- |
| `skill_a`, preparation, 260 ms | Left grip at (24–25,31); right grip at (41–43,31). Bent arms connect each grip to its shoulder. Lid crown occupies x=29–38/y=26; its lower edge is at y=30–31. | Black cavity is x=27–39/y=37–39, with the eyes at y=38–39. | Both hands hold the raised lid above the open jar. No attack extension. |
| `skill_b`, cast/self-contact, 160 ms | Pressing hands occupy approximately x=21–25 and x=39–44/y=38–42. Contact is the rim seam around (33,39). | The opening is completely covered by the brown lid and dark sealing seam. No open eyes or mouth pixels remain. | Self-defense begins on entry to this cel, after the 700 ms idle and 260 ms preparation (960 ms into the displayed loop). Protective gold brackets follow the body's sides, with the brightest glints above the rim. Contact is lid-to-jar, not enemy-to-ally. |
| `skill_c`, recovery, 240 ms | Relaxed left hand at x=17–20/y=46–47 and right hand at x=46–49/y=46–47; both link back to the jar at y=48–49. Lid crown returns to x=30–37/y=30. | Open black cavity returns at x=27–40/y=35–38; eyes are at y=36–37. | Protection breaks into two flecks near (19,52) and (48,52). Hands lower and the lid rests. |

The skill sequence is stationary defensive closure. It must not borrow
the core `move` or `attack` frames or introduce a forward hop. The anchor
above is a visual contact cue; damage, defense values, sounds, and status
application were not implemented here.

## Status loops

- Poison alternates a sagging jar with small bubbles and a more compressed
  posture with a burst and a larger upper-right bubble. Closed and burst
  clusters are explicitly different, not one bubble moved as a unit.
- Stun alternates tilted lids, unequal eye heights, low hands, and different
  star silhouettes/locations. The body remains on its feet.
- Sleep alternates exhale and inhale shoulder/belly rows, with lowered
  hands and both eyes closed throughout. Neutral puffs near the mouth in
  `sleep_a` dissipate above the right rim in `sleep_b`; no text is drawn.

Actual GIF rhythm and in-battle readability remain for downstream review.
This timing note does not claim user approval.
