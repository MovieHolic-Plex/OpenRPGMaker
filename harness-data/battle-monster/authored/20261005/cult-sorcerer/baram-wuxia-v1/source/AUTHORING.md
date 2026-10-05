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
