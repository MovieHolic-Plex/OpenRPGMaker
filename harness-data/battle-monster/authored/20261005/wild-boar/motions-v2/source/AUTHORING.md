# Wild boar — additional native actions

## Scope and source

Authored nine complete 64 × 64 ASCII palette-index grids in `actions/`:
`skill_a`, `skill_b`, `skill_c`, `poison_a`, `poison_b`, `stun_a`,
`stun_b`, `sleep_a`, `sleep_b`. Coordinates below are zero based.

The supplied reference and existing native rows guide the long, low torso,
right-facing snout, ivory tusks, bristled back and four short legs. Light remains
at the upper left. Fur uses broad `l/m/d/s` clusters, the muzzle `r/p`, tusks
`t/i`, hooves `u`, and contact/stun light `e/t/i`.

Every ink-bearing row was explicitly authored as native ASCII pixels. Shared
fur regions were retained by writing their literal rows; changed ears, heads,
legs and effects were individually drawn. The only canvas initialization was
transparent pixels. Row-ending corrections only added or removed transparent
padding. No image generation, geometry rasterization, automatic shading,
whole-frame transforms, pose interpolation or image tracing was used.

## Explicit changes

| Frame | Authored silhouette, material and effect changes |
| --- | --- |
| `skill_a` | Ears tighten at y26–30; neck and shoulder taper down into the lowered head at y38–48. The eye is at (46,39). Rear limbs brace diagonally through x7–19, y49–60; front limbs compress beneath the shoulder. Two irregular earth chips at x46–53, y55–60 accompany the hoof push. |
| `skill_b` | Flattened ears and shoulder at y27–38; the muzzle projects to x55 at y42–44. Rear hock extends toward x6, with folded far legs visible beneath the belly; the near foreleg catches forward at x45–49, y56–60. A small, jagged gold/ivory contact cluster at x56–62, y42–48 joins the snout through (56,44). This is a new shoulder ram silhouette, not the existing attack frame plus a spark. |
| `skill_c` | Head rises through y37–44; front leg bends back toward x35–39 and replants at y60. Two broken breath curls at x55–61, y41–45 replace the impact cluster; dust disappears. Jaw and tusk highlights contract rather than enlarging the contact light. |
| `poison_a` | Hunched upper back and drooping ears at y29–38; a half-lidded eye cluster at x45–46, y40–41. The muzzle and tusks hang below the healthy idle head. Sagging belly, compressed far legs and a bent rear knee support a sick stance. Hollow amber bubbles have deliberately separate rims, glints, transparent centers and dark lower edges: x48–55, y22–27; x56–60, y27–31; x46–51, y54–58. |
| `poison_b` | Chest and head collapse further; the eye moves within the redrawn head to y41–42. The muzzle opens a dark mouth at x48–50, y49, followed by a short connected ochre saliva strand through y54. The large bubble is newly shaped at x43–50, y25–30; the smaller upper bubble is at x53–57, y20–24; the lower bubble is at x48–52, y57–60. Bubble positions and interiors differ from `poison_a`. |
| `stun_a` | Ears flatten; eye becomes a short dazed lid at x44–45, y37. Both knees buckle toward the right: rear shin at x14–20 and forward shin at x35–42. Two individually drawn stars occupy x41–45, y18–22 and x53–59, y25–29. |
| `stun_b` | Upper back and ear contour sag differently; disconnected dark eye points at x44 and x46, y37 give a dazed stare. Rear knee splays left to x9 while the foreleg bends outward to x40–44. Star silhouettes exchange height and position: x51–57, y18–22 and x38–42, y25–29. The body was not shifted as a unit. |
| `sleep_a` | Rounded resting torso begins at y32; four legs fold under the belly at y54–60, retaining separated hoof clusters. Eye is a closed three-pixel line at x44–46, y45. Head and natural tusk weapon rest low at y47–51. Short, dull breath curls sit at x55–58, y50–52. This retains a full boar body rather than the flattened dead silhouette. |
| `sleep_b` | Inhalation raises/rounds the upper back at x11–33, y33–40 and broadens selected flank clusters at y50–54. Head, closed eye and folded hoof contacts stay anchored. The breath curl opens at x57–59, y48–52. Torso changes are literal cluster edits, not a translation or scale of `sleep_a`. |

## Inspection and preservation

All new files contain 64 rows of 64 ASCII symbols and use only the existing
14-color palette plus transparent `.`. Their first/last columns and first row
are transparent; all ink ends at or above y60. All nine additional grids differ.
The source was viewed at native size and in a checkerboard enlargement held
in memory; no preview files or GIFs were saved.

SHA-256 comparison with the bytes read before authoring found `palette.json`
and every file in `poses/` unchanged. Only `actions/*.pxgrid`, this note and
`TIMING.md` were written. No tests, repository gates, ledger decisions, game
store writes, packing or installation were performed. These are authored
candidate frames; no user approval or independent reviewer decision is claimed.

## Remaining visual problems and limits

- The locked palette has no green or violet. Poison uses hollow ochre bubbles,
  a drooping face and saliva; the effect may need the game's status indicator
  to identify it immediately. It deliberately adds no palette tint.
- Small dark eyes have limited readability at 1×. Sleep has a continuous closed
  lid; poison has a drooping lid; stun alternates a short lid and separated
  dazed points. Those distinctions are clearer with posture and animation.
- Broad, angular fur clusters retain the reference's hard bristled appearance.
  The long muzzle, tusks and visible leg gaps are the principal animal cues.
- Two-frame status loops cannot show a smooth collapse or a full breathing cycle.
  The timing below is a proposal, not an observed GIF playback result.
- The compact contact flash gives local contact geometry. Actual dash travel,
  target overlap, damage timing and sound still require player-side review.
