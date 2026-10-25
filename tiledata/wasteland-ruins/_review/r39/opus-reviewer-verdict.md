# Fresh adversarial Opus reviewer — final verdict (r39)

Piece(s): asphalt. Reviewer had no prior scores in context; board = this folder. Text below is the reviewer's final message, verbatim.

Judged image(s): asphalt sha e16df21c924211cc9509d8e3c6ec13b25aa494063df77c97b135e6ad70746996 (gate FAIL).

---

**Verdict: FAIL.** The material is right but the ends and the paint are wrong. It's close; this is not a rewrite.

**What passes**
- **It doesn't read as water.** The base is a neutral grey-brown (82,75,73) with cool specks. Next to `puddle-sample-4x.png` (saturated teal with highlight dashes) it is plainly a different material at 1x and 2x.
- **No ripple dashes and no 16px stamp rhythm.** On the long connected runs (horizontal strip x≈200–500, y≈200–245, and the wide area on the right) the specks are scattered and don't repeat per cell.
- **The south lip works.** The broken two-step dark lip (14,23,32 over 42,53,57) along the south edges reads as a chipped slab edge in 3/4 view, not a shoreline.

**Defects (coordinates in `asphalt-sample-4x.png`)**
1. **Dead ends are smooth rounded domes, not broken road ends.** This is the most visible problem at 2x.
   - The tops of the vertical strips at about (75–120, 70–110), (330–380, 70–105) and (590–635, 70–110), and the stub at (205–245, 390–430), are clean semicircles.
   - They read as a finger or nub of poured liquid, which is the one water-like trait left.
   - The brief asks for broken, chipped ends. These ends also don't match the square cut ends at (500, 205–240) and (300–315, 590–635).
2. **The lane paint reads as an object, not worn paint.**
   - The only paint in the sample is a solid, saturated yellow vertical bar (200,154,43) about 3×11px at 1x, at about (918–935, 262–310).
   - It has a clean outline and no wear, and looks like a stake or marker standing on the road.
   - The white fragment in the sheet (row 5, a pale rounded lozenge) has the same glossy, pill-shaped look.
3. **One crack reads as a symbol.** The crack at about (900–960, 145–158) is a single arched "︵" stroke and looks like a gull or eyebrow mark. The X-shaped crack pair at (840–895, 260–310) is borderline, but acceptable.
4. **There are almost no faded patches.** The interior is one flat value plus specks. The only lighter tone (104,96,94) shows up as single specks, not soft areas, so the wide area on the right reads like speckled carpet. The brief asks for faded patches and soft stains, and the dark-teal stains at about (855–885, 225–245) and (905–925, 335–350) are the only ones.
5. **Minor: the single island is a misshapen chip.** At about (455–505, 580–625) it is a sheared parallelogram with a slanted left side. It doesn't read as a lone square of road.

**Fix list**
1. Redraw the end-cap and dead-end mask cells with ragged, chipped ends:
   - a flat or diagonal break line with 1–2px notches and a missing chunk;
   - a few loose crumbs on the dirt just past the end;
   - no semicircles.

   Make them consistent with the square cut ends.
2. Redraw the yellow and white paint:
   - lower the saturation (yellow to about (150,125,60));
   - break each stroke into 2–3 segments with gaps;
   - eat into the edges with base-colour pixels so it looks scuffed;
   - lay it flat (a horizontal or angled dash, not a tall bar) and drop the outline.
3. Replace the arched crack with an irregular crack that branches or zigzags.
4. Add 2–3 large, soft faded patches, irregular 6–10px areas a step lighter, across the interior variants, plus one or two more muted stains. Keep them non-directional.
5. Reshape the island cell into a rough-edged square chunk with the same chipped south lip.

The other 4x sample is `asphalt-sample-4x.png`, in `/home/main/z-project/rpg-zzu-village-art/tiledata/wasteland-ruins/_review/r39/`.
