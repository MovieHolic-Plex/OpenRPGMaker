# Fresh adversarial Opus reviewer — final verdict (r54)

Piece(s): 15 inner-corner pieces (asphalt-in-*). Reviewer had no prior scores in context; board = this folder. Text below is the reviewer's final message, verbatim.

Judged image(s): r54 bite redraw, whole set.

---

I checked the 8x pieces, the gate boards for ne, nw, se, sw, se-sw and the + crossing, and the junction boards with and without corners. The two north singles pass. Every piece that contains a south bite fails for the same defect.

**The defect:** each south bite has a near-black pixel at roughly px (12,14) in se and (3,14) in sw, inside a ring of dark-brown pixels. At 8x it reads as an "eye", a dark rosette punched into the dirt. That breaks the "no lone dark flecks" rule, and it repeats identically in all 11 pieces that have a south bite. In the + and T gates it also adds to the dark spotting around the crossing centre.

Apart from that fleck, the south ledge shape is acceptable: there's no 1-px black slash, and sw mirrors se closely enough.

- asphalt-in-ne: PASS. Soft stepped bite that matches the dirt, and it reads rounded in context. Minor: the bottom edge of the bite is a straight 3-px light-grey run (around row 2, px 13-15), which reads slightly like an underline.
- asphalt-in-nw: PASS. Mirrors ne, with the same minor grey-run note at px 0-2.
- asphalt-in-se: FAIL - dark eye pixel in the middle of the bite.
- asphalt-in-sw: FAIL - same dark eye, mirrored.
- asphalt-in-ne-nw: PASS
- asphalt-in-ne-se: FAIL - se bite carries the dark eye.
- asphalt-in-ne-sw: FAIL - sw bite carries the dark eye.
- asphalt-in-nw-se: FAIL - se bite carries the dark eye.
- asphalt-in-nw-sw: FAIL - sw bite carries the dark eye.
- asphalt-in-se-sw: FAIL - two dark eyes side by side read as a pair of holes under the T stem.
- asphalt-in-ne-nw-se: FAIL - se dark eye.
- asphalt-in-ne-nw-sw: FAIL - sw dark eye.
- asphalt-in-ne-se-sw: FAIL - two dark eyes.
- asphalt-in-nw-se-sw: FAIL - two dark eyes.
- asphalt-in-ne-nw-se-sw: FAIL - two dark eyes. With the base road's dark flecks they make a dark rosette ring around the + centre.

OVERALL: FAIL

**Fixes:**
1. **se:** recolour the near-black centre pixel and the dark-brown pixels around it to the mid-dirt colour. Keep dark brown only as a single uneven row along the top edge of the bite, where the bite meets the asphalt. That row is the ledge shade continuing the road's south edge.
2. **sw:** apply the exact horizontal mirror of the se fix (x → 15−x). Rebuild all 9 combos that contain a south bite from the fixed se/sw so they stay identical.
3. **Light chips (optional):** keep at most 1–2 isolated light pixels in the upper half of the bite, and nothing on row 15.
4. **North bites (optional polish):** break the straight 3-px grey run at the bottom edge of ne/nw. Make it something like grey, mid dirt, grey, or shift one pixel up a row so it doesn't read as a rim.
5. **Re-check in context:** the bites are very subtle on the junction board. After the fix, compare the y≈515 corners on the with-corners board (around x=210, 300 and 650 at 4x) against the no-corners board. If the bite still reads as a small square step there, round the lowest bite row by one pixel inward so it tapers rather than ending in a 2-px square.
