# 사교 술사 — original native pixel candidate

18 complete literal 64×64 ASCII grids: nine in `poses/`, nine in `actions/`.
Shared palette: 18 exact colors; `.` is transparent. Only this candidate's
`source/` was authored. References were viewed for proportions and vocabulary;
no reference pixels, templates, generated images or transformed frames were used.

## Identity and materials

- Tall elderly adult SD; bare warm forehead, small charcoal topknot, compact
  rightward eyes with separate warm brows, hooked nose and forked ivory beard.
- Dull moss-green broad sleeves, overlapping robe planes, red sleeve lining
  and red split skirt; visible separate charcoal shoes. Upper-left light.
- Bronze bell staff has a hollow crown, hanging lower bell and readable long
  two-tone shaft. The asymmetric left arm rests near the waist or chest while
  the right hand grips the staff.
- Green cloth uses broad lit planes and selected diagonal folds. Beard, warm
  skin, dark hair and shoes, red lining, bronze and turquoise souls each have
  their own chosen clusters; no procedural shading.

## Explicit pose choices and repairs

First authored `idle_a`, decoded `progress/idle.png`, and inspected native 1×,
nearest 8× and `progress/face.png` before authoring the remaining poses.
The initial narrow alternating cloth streaks were replaced with broad planes;
both pupils were moved to the right side of their eye whites.

Idle B/C have selected breathing, beard, sleeve and hem changes. Windup gathers
both forearms. Move opens a trailing sleeve and widens the stance. Attack opens
the shoulder line, extends the bell horizontally and expels green energy.
Recovery lowers wrists; hit bends the torso back and pinches the brows. Dead is
an independently drawn collapsed body, folded robe and sideways closed face.

Skill charge cups an ember in the left palm; contact opens the torso and casts
three different tongues from the forward bell; recovery lowers both arms and
leaves separated remnants. Poison alternates abdominal clutch and cough into
palm, with different hollow bubbles. Stun alternates shoulder/head sway and
open-mouth states with authored stars. Sleep uses closed lids, lowered staff,
chin nod and settling sleeve/hem changes.

Final inspection corrected forearm-to-wrist gaps and several grips whose
bronze pixels had strayed from the staff. Individually observed stray outline
pixels were erased. Fallen lids and stunned mouth were redrawn explicitly.
`author.py` records the literal row blocks and selected coordinate revisions;
its resizing and checker background are inspection helpers only.

## Inspection and remaining visual limits

Viewed all 18 decoded native sprites and nearest enlarged contact sheet in
`progress/suite.png`. Each grid is 64 rows × 64 columns, uses the shared palette,
has transparent borders and no ink below y60; idle soles touch y60. Every cel
differs. This is a candidate for independent review, with no human selection.

The bell opening is small in slanted recovery/status poses. Palm/bell overlap
and changes between those slants still need the independent animated review.
The outer skill branches approach x62, leaving limited room for longer flames.
Production GIF rendering and runtime battle timing were not evaluated here.

## 2026-10-06 — restricted transparent-defect repair

The sections above are the original documented draft history. This pass read
`QUALITY_REPAIR.md`, the existing literal source grids and all four supplied
reference images. The current-v1 sheet was the identity reference: compact
rightward face spacing, moss robe with red lining, ivory beard, bare topknot and
bronze bell staff. The other images were visual study only. No image supplied
source pixels.

Exactly four native pixels changed, with zero-based coordinates:

| Source | Coordinate | Change | Chosen cluster |
|---|---|---|---|
| `actions/skill_a.pxgrid` | (33,42) | `.` → `m` | Existing moss cloth plane beneath the cupping hand; joins the `m` directly below. |
| `actions/skill_a.pxgrid` | (34,42) | `.` → `g` | Existing deep green fold; continues the `g` directly below and closes the internal transparent gap. |
| `poses/dead.pxgrid` | (27,51) | `.` → `s` | Existing warm skin shadow joining the cheek to the short neck. |
| `poses/dead.pxgrid` | (28,51) | `.` → `t` | Existing neck skin tone, continuous with `t` above and below and bounded by the unchanged `o` at x29. |

`repair_quality.py` contains those four literal coordinate assignments. It
preserves source line endings and writes complete 64×64 ASCII grid files.
`author.py` was neither edited nor executed; it remains the original draft
helper and is not the repaired source's regeneration entry point.

The repair receipt in `progress/quality-repair/repair-receipt.txt` records the
before/after hashes and exactly those four differences. All other pixels in
the two repaired frames, the other 16 grid files, the 18-color palette and
`author.py` are unchanged byte-for-byte. Face spacing, sleep posture, staff
alignment, boots and the intentional arm negative space in `skill_b` remain
as authored. No additional action frames were authored in this restricted pass.

### This pass's inspection and remaining limits

Decoded all 18 current grids directly through the unchanged palette to new
native 64×64 RGBA PNGs under `progress/quality-repair/`. Opened the repaired
`skill_a.png`, `dead.png` and the 1:1 `suite-native.png` for visual inspection.
The repaired torso is solid under the hand, and the fallen cheek/neck no
longer has the two-pixel transparent slit. The renderer reads no image input
and performs no image resampling. Previous `progress/` images are retained
as draft previews; the new subfolder shows the repaired grids.

Source size/bounds inspection found 64 rows of 64 symbols for each of the 18
frames, only existing palette symbols, transparent outer borders and maximum
ink y60. The unchanged idle_a shoe soles still reach exactly y60. These are
file observations, not a test suite or an artistic approval.

The previously documented small slanted bell openings, palm/bell overlap and
tight right-edge room for the skill branches remain visual limits. The sleep
pose remains relatively upright. No further changes are authorized by the
four-pixel repair instruction. No GIF or runtime playback was inspected in
this pass; no tests/gates were run. No user Modify/Allow decision or user
approval is claimed.
