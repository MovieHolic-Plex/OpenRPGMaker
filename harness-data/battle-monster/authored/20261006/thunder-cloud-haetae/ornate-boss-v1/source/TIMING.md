# Diagnostic animation timing

All coordinates are native 96px cell coordinates. Holds below are the actual durations serialized into `progress/*-native8.gif`; the GIFs enlarge native pixels by nearest neighbor to 768×768. These are suggested visual holds, **not verified gameplay damage or hit timing**.

| Preview | Pose order | Holds (ms) |
| --- | --- | --- |
| idle | idle_a → idle_b → idle_c → idle_b | 260, 260, 260, 260 |
| attack | idle_a → windup → move → attack → recover → idle_a | 360, 240, 140, 120, 220, 340 |
| hit | idle_a → hit → recover → idle_a | 450, 240, 220, 450 |
| dead | idle_a → hit → dead | 500, 180, 1400 |
| skill | idle_a → skill_a → skill_b → skill_c → idle_a | 350, 320, 160, 300, 450 |
| poison | poison_a → poison_b | 400, 400 |
| stun | stun_a → stun_b | 360, 360 |
| sleep | sleep_a → sleep_b | 600, 600 |

## Physical attack

- **windup:** neck and horn drawn backward; horn tip approximately (64,19). Shoulder and foreleg stay attached as weight gathers.
- **move:** broad near forepaw lifts and folds under the chest; toe tips approximately (74,84). Shoulder volume contracts, not a whole-body shift.
- **attack:** head/neck and single horn are drawn lower and forward. Horn-tip visual contact anchor approximately **(75,35)**; muzzle/nose front approximately **(79,55)**; near paw stomps onto the baseline at **(70,92)**. The forepaw contact and horn/shoulder thrust share this visual contact cel.
- **recover:** mane folds and jaw/neck anatomy recover before the quiet idle returns. Rear soles keep their native grounded contact.

## 뇌운포

- **skill_a, compression:** current gathers at the retracted horn tip approximately **(64,19)**; the bright core is around (66,19). A small bent gold/white current sits on the physical horn, with a second short current beside it. Front paw clouds gather separately around (47,86) and (88,85).
- **skill_b, cast/contact:** the physical horn endpoint is approximately **(80,25)**. Main current visibly attaches there, travels up/right to **(93,10)**, bends back through (84,21), then down/right through (91,24), (85,31) and (93,41). Its subordinate short branch breaks right near **(91,33)**. Two jade/blue cloud masses spread around the front-foot region, roughly (43,86) and (90,84). The character stays legible inside the cell.
- **skill_c, breakup/recovery:** only two detached residual currents remain, around **(84,18)** and **(90,30)**. Neck/cheek/mane clusters recover and paw clouds contract.

## Status motion

- Poison alternates a lowered strained face and bent foreknees with different toxic bubble heights and throat/cheek clusters; no whole-body tint.
- Stun alternates a limp jaw, heavy lids and mane folds, plus two distinct small gold star placements.
- Sleep alternates separately selected barrel/chin/tail breathing clusters. Both states keep narrow closed eyelids and folded paws.
- Death is a collapsed native silhouette with armor and mane on the lowered body; it is held rather than used as a standing blink.

The attack and skill GIFs were decoded again after writing: 6 and 5 frames respectively, with the durations above preserved. Their contact frames are also saved as `progress/attack-gif-contact.png` and `progress/skill-gif-contact.png` for actual encoded-frame inspection.
