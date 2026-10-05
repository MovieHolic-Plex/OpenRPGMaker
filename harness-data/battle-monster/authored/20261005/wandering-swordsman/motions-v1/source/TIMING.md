# Native GIF timing proposal

All source cels are 64 × 64. Render every cel pixel-for-pixel, with binary transparency, in the same fixed canvas. Durations below are milliseconds. No extra poses, frame shifts, rotations or interpolated bodies are needed. This is a playback proposal; it does not record user approval.

## Orders and holds

| Preview | Pose order and holds | Playback |
| --- | --- | --- |
| Idle | idle_a 220 → idle_b 220 → idle_c 220 → idle_b 220 | Loop; stable feet and small cloth breathing |
| Attack | idle_a 220 → windup 200 → move 90 → attack 100 → recover 180 → idle_a 260 | Loop with a clear rest between attacks |
| Hit | idle_a 300 → hit 130 → recover 150 → idle_a 320 | Loop; brief backward recoil |
| Dead | idle_a 260 → hit 120 → dead 1400 | Hold dead at the end; a comparison GIF may restart after the hold |
| Skill | idle_a 220 → skill_a 340 → skill_b 130 → skill_c 280 → idle_a 300 | Loop; contact occurs in skill_b |
| Poison | poison_a 420 → poison_b 420 | Loop; inward cough/stomach motion and changing bubbles |
| Stun | stun_a 330 → stun_b 330 | Loop; head slackens while stars change placement |
| Sleep | sleep_a 650 → sleep_b 650 | Loop; relaxed exhalation/inhalation |

## Skill anchors

Coordinates are (x, y), zero-based, in the native source canvas.

| Cel | Right sword hand and weapon | Left hand / scabbard | Effect anchor |
| --- | --- | --- | --- |
| skill_a | Fingers around (32,35); tang around (35,36); blade runs back/down through (30,37), (21,40), (12,43) to tip (6,46) | Fingers around (26,42), mouth around (23,44), sheath descends left | Silver-blue clusters touch the backwards tip at (6,46); a small near-grip glint sits around (39,34) |
| skill_b | Fingers around (37,28); guard (40,28); exposed blade runs from (42,28) through (49,26) toward (59,24) | Fingers around (19,36), mouth around (16,38), sheath descends left | The crescent intersects the blade at (58–61,24–26). Its upper tip is around (45,10), convex right edge around x=61, and lower tip around (44,46) |
| skill_c | Fingers around (34,33); guard around (36,34); exposed blade follows (34,35), (31,36), (29,37) toward (25,39) | Fingers around (25,38) wrap the scabbard mouth at (23,40) | A few disconnected short remnants around (45,17), (50,22), (51,37) and (46,42); the long crescent is gone |

The skill originates in the sword hand and weapon, not the mouth. The face remains visible through the preparation, contact and recovery. The mouth is a face feature only; poison and sleep place small status/breath clusters nearby.

## Contact-sheet order

- poses-native.png: idle_a, idle_b, idle_c / windup, move, attack / recover, hit, dead.
- actions-native.png: skill_a, skill_b, skill_c / poison_a, poison_b, stun_a / stun_b, sleep_a, sleep_b.

A hold repeats the same already-authored cel in time; it does not require duplicating a source grid. These timing notes are for the harness renderer and are not a claim of an in-game animation review.
