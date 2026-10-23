# Fresh adversarial Opus reviewer — final verdict (r55)

Piece(s): husk-c husk-d husk-e wall-h2 wall-h3 rubble-pile-b. Reviewer had no prior scores in context; board = this folder. Text below is the reviewer's final message, verbatim.

Judged image(s): r55 after one redraw (husk-c 81a480cf8f21, husk-d d8d35c90ec65, husk-e e4a7c8810f77, wall-h2 cebb5dcf9593, wall-h3 61bbfaa35a2a, rubble-pile-b 126849a5326c), next to existing husks.

---

Of the six new pieces, only husk-e and wall-h2 pass. The other four have fixable problems.

- **husk-c: FAIL.** The collapsed corner is a straight 45° band from the top edge down to the right corner. It reads as a slanted roof or ramp, not a collapse. The band also sits over the right front face where the floor-2 and floor-3 windows would be, so it is unclear whether it is a top plane or the front. Only the top-left room shows a roofless interior. Fixes:
  - Replace the diagonal with 2–3 stepped broken slab edges at the floor lines.
  - Give each step a 2px light top plane, a 1px dark broken lip and a short exposed front strip with a window remnant underneath.
  - Make the silhouette ragged instead of a straight 45° line.
  - Add a small rubble cone at the base on the right, around the bottom 1.5 tiles.
  - Extend the visible interior floor right of the stair room for 1–2 tiles before the break starts.
- **husk-d: FAIL (minor).** The fascia band above the shutter has evenly spaced short orange dashes in a row, which reads as faded shop lettering. That breaks the no-text rule. Fixes:
  - Remove the regular dash rhythm.
  - Use 2 irregular vertical rust drips of 1×3–4px, at uneven spacing, plus one darker water stain.

  The caved-in roof hole and the torn shutter both read correctly.
- **husk-e: PASS.** The brick parapet, burnt interior and the light exposed slab read as top planes, and the front has dense brick shading. It is clearly distinct from the other buildings. The white marks along the top edge of the gate image are background showing through the parapet notches, not stray pixels.
- **wall-h2: PASS.** It is taller than wall-h, has V-breaks with a light cap following the broken edge, and has rebar stubs, so it is clearly distinct. One nit: the rubble chips under the centre sit on the bottom pixel row and may look clipped when placed. Pull them up 1px or remove them.
- **wall-h3: FAIL.**
  - The broken slope on the left 1.5 tiles is front-face brick only, with no top plane. It reads as a flat ramp or elevation.
  - The slope is smooth, not stepped by brick course.
  - Its outline is dark red where wall-h and the rubble pieces use dark slate.
  - The brick fill is flat, with roughly two tones.

  Fixes:
  - Step the slope into 2–3 brick-course stairs.
  - Put a 1–2px lighter brick or grey top row on each step.
  - Change the top and left outline to the kit's dark slate.
  - Add a third, darker brick tone on the lower course and a 1px shadow under the grey cap.
- **rubble-pile-b: FAIL (moderate).** It is distinct from rubble-pile and has rebar. But the slabs have 1px rounded corners and almost no visible thickness, so they read as pillows or sandbags rather than broken concrete. Fixes:
  - Square the corners and make the broken edges jagged and straight-cut.
  - Add a 2px darker thickness face along the south edge of each slab, plus a lit top edge.
  - Add 3–4 small chunk pixels at the base so it reads as a heap and not a stack.

OVERALL: FAIL
