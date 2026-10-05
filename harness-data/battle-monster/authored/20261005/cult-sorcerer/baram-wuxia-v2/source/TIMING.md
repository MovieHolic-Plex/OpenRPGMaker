# Pose order and timing intent

These are **artist preview hold suggestions**, not measured runtime timing or
production GIF timings. The harness supplies production GIF durations.
Coordinates are zero-based native source pixels.

| Preview | Suggested pose order and holds |
|---|---|
| Idle | idle_a 220 ms → idle_b 220 ms → idle_c 220 ms → idle_b 220 ms |
| Shot | windup 200 ms → move 120 ms → attack 140 ms → recover 200 ms → idle_a 220 ms |
| Hit | hit 180 ms → recover 200 ms → idle_a 220 ms |
| Fall | hit 140 ms → dead 700 ms, hold fallen |
| 망혼진 | skill_a 280 ms → skill_b 160 ms → skill_c 240 ms → idle_a 220 ms |
| Poison | poison_a 300 ms → poison_b 300 ms, loop |
| Stun | stun_a 260 ms → stun_b 260 ms, loop |
| Sleep | sleep_a 450 ms → sleep_b 450 ms, loop |

## 망혼진 anchors

- **Charge / skill_a:** left cupping hand around (32,39), compact turquoise ember
  above it around (31,36). Right grip crosses the standing shaft at (48,39).
  No mouth emission.
- **Cast/contact / skill_b:** right grip around (44,35) holds the forward-sloping
  shaft at (46,35). Three branches attach to the bell's front edge around
  (55,22): hooked upper tongue toward (61,12), broad middle crest toward
  (62,23), torn lower tongue toward (62,32). These are separate literal clusters,
  not resized rings. The left hand opens near the breast around (33,35).
- **Recovery / skill_c:** right hand lowers beside the shaft around (50,41),
  left hand rests at the waist. Remnants near (53,14), (61,22), (56,30) and
  (60,36) are detached and explicitly chosen; the staff no longer emits a stream.

The contact frame marks the artistic peak only. Damage, sound, effect lifespan
and actual runtime synchronization remain the harness/runtime's responsibility.

## 2026-10-06 repair timing record

The original order, suggested holds and hand/mouth/weapon anchors above are
retained. This repair changes only the two cloth pixels beneath the charge
hand in `skill_a` and two cheek/neck pixels in `dead`. No hand, mouth, staff,
bell, soul-flame, status effect or foot anchor was moved. `skill_a` still has
no mouth emission; the three cast branches still originate at the bell in
`skill_b`, followed by detached remnants in `skill_c`.

This pass rendered native PNGs for inspection only. No GIF was created or
played, and none of the suggested durations was measured or installed in
the runtime. The original timing text is draft history and preview intent;
it does not record a user selection or approval.
