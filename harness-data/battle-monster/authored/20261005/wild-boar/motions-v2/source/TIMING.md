# Wild boar — proposed GIF timing and anchors

These are intended review-strip timings. No GIF or runtime sequence was built
or installed in this source-only authoring task. Each hold below is a multiple
of 10 ms for GIF centisecond delays. Coordinates are zero based in a 64 × 64
cell; facing is right and the ground baseline is y60.

## Pose order and holds

| Strip | Order with per-frame holds | Playback |
| --- | --- | --- |
| Existing idle | `poses/idle_a` 190 ms → `poses/idle_b` 190 ms → `poses/idle_c` 190 ms | Loop, 570 ms. Existing pixels preserved. |
| Additional skill: 돌진박치기 | `poses/idle_a` 190 ms → `actions/skill_a` 240 ms → `actions/skill_b` 90 ms → `actions/skill_c` 220 ms → `poses/idle_a` 380 ms | 1120 ms review loop with a clear pause between rams. In gameplay the skill should play once. |
| Poison | `actions/poison_a` 430 ms → `actions/poison_b` 380 ms | Loop, 810 ms. The second pose emphasizes nausea and drool. |
| Stun | `actions/stun_a` 180 ms → `actions/stun_b` 220 ms | Loop, 400 ms. Quick, uneven sway with alternating authored stars. |
| Sleep | `actions/sleep_a` 760 ms → `actions/sleep_b` 900 ms | Loop, 1660 ms. Low chest/exhalation followed by expanded chest/inhalation. Keep the head and folded hooves anchored. |

The proposed skill strip enters contact at 430 ms and holds it until 520 ms.
This describes only local pose exposure. It does not establish a runtime hit
schedule or authorize damage application.

## Skill mouth and natural weapon anchors

The boar has no hands or carried weapon. Its attached snout, jaw and paired
tusks are the skill weapon. Do not add a floating tool or treat the bright
contact pixels as a projectile.

| Phase | Anchor and relationship |
| --- | --- |
| `skill_a`: preparation | Snout/nose region x49–53, y42–45; tusk roots remain against the cheek/jaw around x42–47, y46–48. Eye at (46,39). Shoulder and forelegs compress while the rear leg braces. Hoof dust is ground debris, not a mouth emission. |
| `skill_b`: ram contact | Nose dark point (51,42); leading snout contour at (55,43–44). Near tusk ridge runs through x49–51, y43–45 and joins the lower jaw highlights. Contact bridge (56,44) is adjacent to the snout outline (55,44); the authored flash continues through x57–62, y42–48. Use approximately (55,44) as the local contact anchor, not the cell center. |
| `skill_c`: recovery | Nose dark point (51,41); leading muzzle around x53–55, y40–42. Small discontinuous breath curls at x55–61, y41–45 dissipate ahead of the mouth. No lingering contact flash. The near forehoof settles at x35–39, y58–60. |

If a player-side dash path is attached later, keep the ram's mouth/tusk anchor
aligned with the target at `skill_b`. Translation along that path belongs to
the runtime, not to generation of these source frames. Preserve the short
contact hold before the longer recovery.

## Status anatomy and effects

- Poison: half-lidded eye at x45–46, y40–42; lowered head with individually
  placed hollow toxic bubbles. In `poison_b` the dark open mouth at x48–50,
  y49 connects to the ochre drool strand below it. These are sickness poses,
  not ram poses with a color replacement.
- Stun: unsupported-looking head and buckled knees; stars remain separate
  above the head. Star locations change between the two literal grids, and
  the leg splay changes with the sway.
- Sleep: closed eye line x44–46, y45 stays identical between frames. The
  lowered snout at x48–54, y47–50 and attached tusks rest above folded legs.
  Breathing edits the back/flank clusters and small mouth curls while keeping
  head and feet steady. There are no generated letters or text effects.
