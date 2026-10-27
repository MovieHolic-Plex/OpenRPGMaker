# Fresh adversarial Opus reviewer — final verdict (r50)

Piece(s): asphalt-ph. Reviewer had no prior scores in context; board = this folder. Text below is the reviewer's final message, verbatim.

Judged image(s): asphalt-ph sha de05ee616fe864dc1aecd529377e54450fed1c8aa4d9244f79eacdbb2bcf1539 (gate FAIL).

---

I'm failing `asphalt-ph`. It reads as a grey stone slab or concrete pad cut out as a clean rounded sticker. It doesn't read as old cracked asphalt, and it is below the reference chipsets. All coordinates below are in `asphalt-sample-4x.png`. I only opened and measured images; I changed no files.

**1. Does it read as cracked asphalt? No.**
- **Texture:** There are three main tones (82,75,73 / 104,96,94 / 123,114,112) and only a trace of a fourth (141,132,130, 5 pixels in my sample). The dark and mid tones cover the surface in roughly equal blotchy clusters. That gives a digital-camouflage or granite look, clearest on the slab at (780–1015, 75–440) and the 3-wide strip at (75–820, 970–1140).
- **Missing asphalt cues:** Real asphalt is mostly one flat dark tone with sparse light aggregate specks, faded wheel-track wear and crack networks. None of these are present.
- **At 2x:** It reads as speckled stone or terrazzo.
- **Against the references:** The modern-city road shows the restraint expected here: a flat field with sparse marks. Beodeul paving has clear structure and highlight edges. This piece has neither.

**2. Repetition: there is a visible period stamp.**
- A 200×150 window of the 3-wide strip, shifted 512px (one 128px period at 4x), matches with 0% pixel difference. In the 3-wide vertical strip (1225–1395, 75–820) the same shift leaves only 7.5% of pixels different.
- **Horizontal 3-wide strip:** Potholes sit at (165, 995) and (680, 995), same row and same shape. Cracks sit at (155, 1045)/(665, 1045) and (230, 1120)/(740, 1120). In a 12-tile strip they read as identical stamped marks.
- **Vertical 3-wide strip:** Potholes at (1305, 150) and (1305, 665). Cracks at (1255, 95) and (1240, 605).
- **Tile borders:** I found no seam at the 16px borders. Column differences show no spike at tile boundaries.
- **1-wide runs:** No lattice or beads. They do show the same mottle with no wear variation along their length.

**3. Edges: they are not broken asphalt.**
- The rim wobble measures at most 1 native pixel. The top edge of the 3-wide strip is flat from x=75 to 820 at y≈955–968. The left edge of the 1-wide vertical run is at x=1092–1096 for its whole length. These are ruler-straight, die-cut edges.
- Every dead end is a perfect semicircle, so the roads look like pill or tube shapes: (75, 860), (820, 860), (1120, 80), (1120, 815), (140, 610), (300, 610), (225, 690).
- The isolated tile is a perfect 12-pixel disc at (455–505, 585–632). It reads as a coin or button, not a broken chunk.
- The 2×2 patch at (520–630, 395–505) has four identical rounded corners: a soft-cornered rectangle, i.e. a sticker or button.
- Where the T-junction stubs meet the main road, the inside corners are hard square notches while the outer caps are fully round. Examples: (120, 140), (120, 185), (580, 140), (580, 185), (210, 455), (240, 455). The mix gives a plumbing-pipe look.
- The south ledge is a clean, even 1px brown strip the full length of every run, for example the y≈888 underline of the 1-wide horizontal run. It reads as a drop-shadow outline, not a soil shadow.

**4. Wear features read as glyphs.**
- **Cracks:** They are isolated 3–8 pixel brown (74,56,40) dashes with no branching. Examples: (345, 355), (345, 415), (290, 235), (850, 355), (1370, 355). They read as twigs, scratches or dashes, not crack networks. Brown is also the wrong colour for a crack in grey asphalt; it should be a darker grey-black.
- **Potholes:** Brown lens shapes with a lighter centre, at (790, 150), (1305, 150), (165, 480), (165, 995) and (680, 995). They read as eyes, seeds or bullet holes.
- **Glyph:** At (330–375, 865) a dash plus a small ring reads as "-o".
- **Missing features:** I found no pale smudges or repair patches.

**5. Do features cross a 1-wide road or bite a rim? Yes.**
- The crack at (332–367, 357) spans about 35 of the 48px width of the vertical 1-wide road, nearly crossing it.
- The pothole at (165, 480) sits against the south rim of the 1-wide bend run.
- The dash at (330–370, 868) on the 1-wide horizontal run covers about two-thirds of its width.

**6. On par with the references? No.**
- It has fewer usable tone steps than Beodeul paving and no edge highlight.
- It is busier and noisier than the modern-city road, which shows that sparse marks on a flat field read better.
- Next to the sibling puddle piece, the rim is far cleaner and more geometric than anything else in the chipset.

Verdict: FAIL

Fixes, most important first:
1. **Break the rim.** Draw a jagged rim 1–3 native pixels deep with chipped bites, crumbled corners and loose fragments in the dirt. Replace the semicircle dead ends, the disc tile and the soft-cornered 2×2 with irregular broken ends. Round or chip the square inside corners at the T-junctions.
2. **Rebuild the texture as asphalt.** Use one dominant dark tone over most of the surface, with sparse 1px light aggregate specks. Add low-frequency lighter wear zones, such as along wheel tracks. Drop the even dark/mid camouflage. Add a lit 1px top rim and keep the south ledge, but vary it.
3. **Kill the 128px stamp.** Hash feature placement per tile or per region instead of tying it to the phase period, or lengthen the period, so wide runs never show matched pairs 128 native pixels apart.
4. **Redraw the cracks** as branching dark grey-black networks, including some alligator cracking, and keep them clear of 1-wide roads and rims. Redraw the potholes as irregular dark depressions with a lit lower lip and dirt or gravel inside, not brown lenses. Add the missing repair patches as slightly different-toned rectangles with uneven edges.
5. **Re-check:** look at the 1-wide runs and the isolated tile at 1x next to `ref-modern-city-road-8x.png` and the puddle sample.
