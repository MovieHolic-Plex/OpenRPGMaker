# Fresh adversarial Opus reviewer — final verdict (r40)

Piece(s): asphalt. Reviewer had no prior scores in context; board = this folder. Text below is the reviewer's final message, verbatim.

Judged image(s): asphalt sha baaaacdec18ac1787526107446d6cb2153d2446079b864443ef1933c42e4b9ae (gate FAIL).

---

**Verdict: FAIL**

The road clearly reads as a different material from the puddle, so the "must not read as water" requirement is met. The puddle is bright teal-cyan with a light rim. The road is a dull dark grey slab with scattered specks, and there are no horizontal ripple dashes. The fails are the edge silhouette and the dead ends, both of which the brief named explicitly.

**Defects** (coordinates are in asphalt-sample-4x.png)

1. **Dead ends are rounded nubs, not broken road ends.**
   - The north stub of the long vertical strip, around (335–378, 75–100), has a smooth domed top.
   - The stub rising off the L, around (205–248, 395–425), is domed.
   - The top of the left vertical strip, around (75–120, 75–95), is domed.
   - The south end of the T stem, around (200–245, 680–695), is a soft rounded tip.
   - The single island, around (458–502, 585–632), is a round pebble or blob, not a cracked chunk of asphalt.

   At 1x and 2x these ends look like poured tar or mud, which is exactly what the brief ruled out.
2. **The chipped lip exists only on south-facing edges.**
   - Every bottom edge gets the dark (14,23,32)/(42,53,57) jagged lip, for example (200–500, 235–250), (75–380, 485–500), (525–635, 490–505) and (780–1015, 425–440).
   - The north, east and west edges, for example the right side of the vertical strip (370–380, 100–480) and the top of the 2x2 block (525–635, 392–400), are just a wobbly soft fade from grey to dirt. There is no break, no lip and no edge.

   As a result the road's outline on three sides reads as a blob or shoreline. This is most visible on the vertical strips.
3. **The south lip repeats on the tile grid.** The step-and-notch shape of the bottom lip comes back on 16px cells along the long horizontal strips, for example (200–500, 238–250), and on the L bottom. At 2x this reads as a stamped scallop rhythm. Sheet row 1 shows the same notch profile in every bottom-edge cell.
4. **One crack reads as a symbol.** The crack at about (895–960, 140–165) is a symmetric "^v" shape that looks like a seagull or a drawn glyph, not a fracture.
5. **The body colour is slightly warm.** It is (82,75,73), with R > G > B. Against the brown dirt it leans mauve or brown-grey rather than the cool charcoal or neutral grey the brief asks for. This is minor and not fatal on its own.
6. **The lane paint is thin.** The sample shows only one short yellow dash run, at about (900–955, 285–292). The white fragment that exists in the sheet (diagonal light dashes in the bottom-right of the interior rows) doesn't appear in the laid sample. This is minor.

**Not defects:** The speck distribution in the wide area has no visible 16px stamp rhythm. The faded patches and soft stains are present and subtle. The dirt is out of scope.

**Fix list**

1. Give the north, east and west edges an irregular broken boundary. Use angular bites and a 1px darker crumb border or small broken chunks into the dirt, instead of a soft wobble. Keep the 3/4 thickness shading on the south side.
2. Redraw the four dead-end cells as squared-off, snapped ends. Use a jagged straight-ish break line, one or two detached asphalt fragments, and maybe a crack running into the end. No domes.
3. Redraw the isolated mask cell (the single island) as an angular broken slab, not a round blob.
4. Vary the south-lip notch profile between cells, or between alternates, so the 16px repeat isn't visible along long strips.
5. Replace the "^v" crack with an asymmetric branching fracture.
6. Shift the body about 3–6 points toward neutral or cool, for example to roughly (76,76,78), so it stops reading mauve-brown next to the dirt.
7. Make sure at least one interior variant with the white paint fragment actually shows up in the laid sample.
