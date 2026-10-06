# Suggested review timing — 96px native sources

Coordinates are zero-based. Holds are authored review suggestions only; no gameplay damage / sound synchronization has been verified.

| GIF group | Pose order | Holds (ms) |
|---|---|---|
| Idle | idle_a → idle_b → idle_c | 280, 280, 280 |
| Attack | idle_a → windup → move → attack → recover → idle_a | 280, 180, 100, 120, 200, 280 |
| Hit | idle_a → hit → recover → idle_a | 280, 160, 220, 280 |
| Dead | idle_a → hit → dead | 280, 200, 900 |
| Skill | idle_a → skill_a → skill_b → skill_c → idle_a | 280, 240, 200, 240, 280 |
| Poison | poison_a → poison_b | 420, 420 |
| Stun | stun_a → stun_b | 360, 360 |
| Sleep | sleep_a → sleep_b | 600, 600 |

## Physical attack anchors

- `windup`: hands gathered near (64,47), broad sleeves cross the torso.
- `move`: extended gold cuff and fingers near (77,42), actual forearm attached to the upper sleeve. Waist and lower flames change with the push.
- `attack`: fingers near (82,42), sharp silk edge at (93,45). The connected torn flame tongue curls through (89,53) toward (94,48). Contact suggestion is the 120ms attack hold.
- `recover`: elbows and sleeve return inward, lower flames reopen. Head identity is retained without moving an entire frame.

## 업화연화 anchors

- `skill_a`: folded bud around (70,46), one hand near (68,44), opposite supporting fingers near (76,47). Both connect through cuff / sleeve pixels.
- `skill_b`: supporting hands near (70,42) and (70,52); gold lotus nucleus near (79,46). Petals open above, right and below on separate curved planes, all within the 1px margin. The 200ms cast hold is the suggested contact display.
- `skill_c`: arms loosen; residual core near (81,46), separated upper petal near (84,33) and lower petal near (87,58). Two petal pieces have actually broken away.

## Review outputs

Eight `progress/<group>-1x.gif` files show native pixels against a dark inspection background. Their matching `-8x.gif` files use nearest-neighbor enlargement only. PNG sources retain binary transparency. GIF loops (including death) are inspection loops, not runtime animation-state definitions.
