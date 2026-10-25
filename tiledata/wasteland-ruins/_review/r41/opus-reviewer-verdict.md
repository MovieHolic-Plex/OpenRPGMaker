# Fresh adversarial Opus reviewer — final verdict (r41)

Piece(s): asphalt. Reviewer had no prior scores in context; board = this folder. Text below is the reviewer's final message, verbatim.

Judged image(s): asphalt sha ea5cc1f28ff46631ca4a8ed6dd34313a79ba025751ded664db7d6b50a56fda68 (gate FAIL).

---

**VERDICT: FAIL.** The colour and specks are fine. The edges, the isolated cell and the dead ends do not meet the brief.

**What passes**
- **Not water (brief 1):** the main fill is a warm charcoal (82,75,73). That is clearly not navy, and next to the turquoise puddle it reads as asphalt. One small concern: the cool blue-grey specks (97,118,125) and (61,75,81) plus the navy-black south lip (14,23,32) push it slightly cold-wet. The big block at (790–1010, 80–430) shows this most.
- **Specks (brief 2):** they are non-directional, 1–2px, and spread evenly. This passes.

**Defects, by sample-4x coordinates**

1. **Broken lip only on one side (brief 4).** The block's east edge (x≈1012–1016, y 80–430) moves only 1px for its whole length. The north edge (y≈72–80, x 790–1010) is the same: a 1px-wobble outline with no chunks into the dirt. The arms are the same:
   - west side of the vertical road, x≈330, y 70–480
   - east side of that road, x≈375
   - west arm, x≈72–80, y 75–240
   Only the south sides get the thick dark lip, at (205–500, 240–250) and (75–375, 490–500). Elsewhere it reads as a thin outline, not broken asphalt.

2. **Same edge shape repeats (brief 6).** On the block's east edge the profile repeats exactly every 16 source pixels (64 sample px): 253×4, 254×4, 253×4, 254,254, 253,253, five times running from y 80 to 400. The block's south edge (y≈432–440, x 790–1000) is a 1px square-wave that repeats every 8 source pixels. It reads as a stamped zig-zag, not a fracture.

3. **The isolated cell is a blob (brief 5).** The cell at (458–502, 585–632) is a small rounded lozenge with all four corners softened, inset inside its 64px tile. It is not an angular broken slab. The 2×2 piece at (520–635, 390–505) has rounded corners too, which makes it read as a pillow or rounded rectangle.

4. **Dead ends are clean cuts, not snapped (brief 5).** Each of these is a near-straight cut with softened corners and no jagged break:
   - north ends at (75–120, 70–80), (330–375, 70–80), (585–630, 70–80) and (205–245, 395–400)
   - east ends at (480–500, 195–245) and (170–180, 130–185)
   - west end at (200–210, 200–245)

5. **Stray dark specks off the road.** A 2–3px dark-blue square sits detached above or left of every north dead end: (68–80, 66–74), (325–335, 66–74), (580–590, 66–74), (198–208, 384–392). They look like rendering errors.

6. **Paint and cracks read as symbols (brief 3, partly brief 7).**
   - The white paint at (910–945, 340–380) is a diagonal hatched bar. It does not follow any lane direction and looks like a ladder or zip icon, not worn lane paint.
   - The dark stain at (850–880, 215–240) is shaped like a bird or arrowhead.
   - The yellow dashes at (900–955, 285–292) are three tiny marks that are hard to see at 2x.
   - None of the paint appears on the 1-cell roads, which is where it would actually show in play.
   - The cracks themselves at (895–955, 148–185) and (838–895, 260–370) read as fractures. They do look generic, though, and sit in light patches like smudges, at (860–890, 300–335).

7. **Below the reference quality (brief 8).** The north, east and west edges are a 1px outline with no edge highlight and no top-face lip. The surface is flat with no light-to-dark modelling. It looks like a dark paint fill on dirt rather than 3/4 top-down raised ground.

Defects, most severe first:
1. The broken lip with chunks into dirt exists only on south edges; north, east and west are a 1px-wobble outline (brief 4).
2. The edge profile repeats every 16px on the east edge and every 8px on the south edge of the block (brief 6).
3. The isolated cell (458–502, 585–632) and the 2×2 piece (520–635, 390–505) are rounded blobs, not broken slabs (brief 5).
4. Dead ends are clean straight cuts with rounded corners, not snapped (brief 5).
5. Detached dark-speck artifacts sit above every north dead end (68,66), (325,66), (580,66), (198,384).
6. The white paint is a diagonal hatched glyph, the dark stain is glyph-like, and the yellow paint is too small to read (briefs 3 and 7).
7. The surface has no 3/4 lip or modelling on most edges; overall quality is below the references (brief 8).

VERDICT: FAIL
