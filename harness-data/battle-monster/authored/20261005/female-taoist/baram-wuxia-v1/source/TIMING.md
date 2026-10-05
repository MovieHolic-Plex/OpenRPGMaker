# Pose order and animation intent

Production GIF holds are supplied by the parent harness. The values below are
authoring suggestions for previewing the source, not measured runtime combat
timing or evidence that the skill has been integrated into a game.

| Sequence | Grid order | Suggested hold in ms |
|---|---|---|
| Idle loop | idle_a → idle_b → idle_c → idle_b | 260 / 260 / 260 / 260 |
| Talisman shot | windup → move → attack → recover → idle_a | 180 / 110 / 150 / 220 / 260 |
| Recoil | hit → recover → idle_a | 180 / 220 / 260 |
| Fallen hold | hit → dead | 120 / 800; hold dead |
| 청련호신 | skill_a → skill_b → skill_c → idle_a | 300 / 340 / 260 / 260 |
| Poison loop | poison_a → poison_b | 420 / 380 |
| Stun loop | stun_a → stun_b | 380 / 420 |
| Sleep loop | sleep_a → sleep_b | 620 / 700 |

## 청련호신 anchors (native pixels, zero based)

- `skill_a`, gather: talisman x39..42/y30..33, small connected hand
  x39..42/y34..35. Jade begins on the paper edge and palm. Staff cap
  x47..51/y28..30; its bright gathering cluster sits at x47..52/y26..27.
  Staff grip wraps the shaft at x45..50/y39..40.
- `skill_b`, contact/protection: talisman x39..42/y32..35 and supporting
  hand x39..42/y36..37. Staff cap x48..52/y25..27, bright core x49..52/y23.
  Staff grip x46..51/y39..40. The right mantle touches this staff core and
  passes the grip; the lower rising sweep returns toward the cast hand.
  The left open curve surrounds the torso instead of shooting a flame forward.
  Two unequal upper petal tips remain open above the face.
- `skill_c`, release: lowered talisman x37..42/y46..49, hand x36..39/y44..45;
  staff cap x45..49/y29..31 and grip x43..48/y40..41. The paper retains
  its last jade edge. Separate remnants rise at x16..20/y7..20 and
  x52..58/y7..27 while the sleeve relaxes.

No mouth-emitted effect. The mouth only changes expression. Poison bubbles and
stun stars are status indicators, authored separately from the protective spell.
Sleep uses posture and closed eyes with no letters, bubbles or spell halo.
