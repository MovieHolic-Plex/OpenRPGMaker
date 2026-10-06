# 연못수귀 GIF timing

All cels are native 96×96. GIFs use the exact 18-color source palette, transparent index 0, disposal 2 and infinite diagnostic looping. PNG sheets `previews/poses.png` and `previews/actions.png` are transparent 3×3 native sheets. `previews/motion-*.png` are decoded GIF contact strips; their enlargement is diagnostic only.

| GIF in previews/ | Authored pose order | Holds in milliseconds |
|---|---|---|
| idle.gif | idle_a → idle_b → idle_c → idle_b | 240, 240, 240, 240 |
| attack.gif | idle_a → windup → move → attack → recover → idle_a | 240, 260, 130, 180, 240, 240 |
| hit.gif | idle_a → hit → recover → idle_a | 240, 220, 220, 240 |
| dead.gif | idle_a → hit → dead | 240, 180, 900 |
| skill.gif | skill_a → skill_b → skill_c → idle_a | 350, 260, 320, 240 |
| poison.gif | poison_a → poison_b | 420, 420 |
| stun.gif | stun_a → stun_b | 420, 420 |
| sleep.gif | sleep_a → sleep_b | 600, 600 |

## Attack anchors

Preparation gathers the two water hands behind x≈23, y≈51. The advance widens and bends the lower pushing forks while the shoulder leans forward. Contact comes from the front shoulder near (54,38), through the broad sleeve and wet forearm to the palm around (81,38). Short fingers extend toward x≈88…90. Recovery retracts the hand to around (57,50). These are separately authored clusters, not a translated or rotated body.

## 연수파 hand anchor

- `skill_a`, 350ms: connected palm/flower cup around (71,37), lotus nucleus around (75,32). The wrist links the broad sleeve to this cup.
- `skill_b`, 260ms: palm around (63,42); both streams split from the joined root around (70,42). The upper branch hooks up to y≈18 and returns along the right edge inside x=94. The heavier lower branch curls down to y≈67. The brief's hand, rather than the mouth or a detached aura, is the emission point.
- `skill_c`, 320ms: folded hand around (51,54); three explicit droplets occupy approximately (78,40), (86,51) and (72,62). They are intentionally detached spent water after the stream collapse.

## Status loops

Poison alternates a strained/closed eyelid, small abdominal cloth changes and different toxic-bubble clusters. Stun retains both hanging hands and the bent head while star tips and locations change. Sleep retains the same head, closed eyelid, tucked forks and relaxed palms; only the chest and lap fabric change for a small breath. Sleep is seated and distinct from the sideways, floor-level dead body.

The GIF re-read and exact holds are recorded in `previews/render-report.json`; no runtime battle or independent harness verdict is asserted by this timing file.
