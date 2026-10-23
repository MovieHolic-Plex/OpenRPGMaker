# Fresh adversarial Opus reviewer — final verdict (r46)

Piece(s): asphalt. Reviewer had no prior scores in context; board = this folder. Text below is the reviewer's final message, verbatim.

Judged image(s): asphalt sha a29e3bc82d33c81a06e5751465dc05a9c99bbf0c08d6cc9e59862706101b7974 (gate FAIL).

---

I checked the asphalt road autotile on the 4x sample, with 2x crops of the four straight runs and the top-left junction area. It fails, mainly on the cracks and the interior texture. The edges themselves are mostly fine. All coordinates below are in asphalt-sample-4x.png.

**What passes**
- **Edges on straight runs:** none of the four runs reads as a 16px sausage or bead chain.
  - The 1-wide horizontal run (x 75–822, y 840–888) has a low, irregular 1px wobble on its north edge and an irregular south ledge.
  - The 3-wide runs (x 75–822, y 968–1142 and x 1225–1400, y 75–820) have straight edges with only a 1px wobble.
  - The 1-wide vertical run (x 1095–1145, y 75–825) has irregular bumps on both sides with no per-cell period.
- **Asphalt colour:** the base tone is a warm grey (82,75,73). It does not read as the teal puddle.
- **South ledge:** a dry dark-brown ledge is present on every south edge.
- **Dead ends and the isolated cell** are rounded and irregular. Examples are the stubs at (75–120, 75–245) and (590–630, 75–245), and the isolated cell at (458–500, 585–630).

**Defects**
1. **Cracks cut across the whole width of 1-wide roads.** On the 1-wide horizontal run there are three identical diagonal cuts at about x 212, 342 and 600 (y 850–885). Junction arms have the same cuts at (280,230), (410,225) and (285,485). They read as joints between road segments, which brings back the per-segment chain rhythm the brief forbids. They are also not "rare": three in a 12-cell run.
2. **Cracks are a cool near-black teal**, not shaded warm asphalt. Sampled colours are (61,75,81) and (42,53,57). That is the same hue family as the puddle and reads as wet seams. It conflicts with brief item 3. Locations:
   - 1-wide run: x 212, 342, 600
   - 3-wide horizontal run: (200–235, 1025–1080), (255–320, 1040–1075), (705–765, 1035–1065)
   - 3-wide vertical run: (1285–1340, 655–685)
   - Solid block: (830–960, 140–380)

   They are also long (10–15 tile px), not short 2px cracks.
3. **Worn patches are small, hard-edged, flat discs**, not large soft patches. Each is a single lighter tone (about 10×8 tile px) with a crisp outline, so it reads as a pebble or stain. Seen at (540,1055), (1310,420), (1315,730), (860,225) and (930,280). The modern-city target surface is flat; these look like stickers on it.
4. **Flecks are an even 1×2 vertical-dash speckle, about two per cell over the whole surface**, rather than very sparse aggregate. In the 3-wide horizontal run they also form a near-regular row of paired dashes just above the south ledge. Along y ≈ 1125 the pairs sit about 20px apart at x ≈ 180/200, 240/260, 625/645 and 750/770. A second line follows y ≈ 1100. This reads as a dotted line along the ledge.
5. **The same fleck position repeats on the 1-wide vertical run.** A light dash on the left side recurs about every 2 cells, near x 1102 at y ≈ 175, 307, 432, 560 and 690. This is a mild visible tile repeat.
6. **Overall finish is below the house references.** The surface is a dead flat fill dotted with cool cracks and hard discs. It has no soft worn variation and reads as "dark paint on dirt" rather than old asphalt.

Defects in order of severity:
1. Full-width diagonal cracks on 1-wide roads (x 212, 342, 600 at y 850–885; junction arms at (280,230), (410,225), (285,485)) read as segment joints and recreate a chain rhythm.
2. Crack colour is a cool near-black teal (42,53,57)/(61,75,81) in the puddle's hue family, and the cracks are too long and too frequent to count as rare 2px cracks.
3. Worn patches are small, hard-edged, single-tone discs ((540,1055), (1310,420), (1315,730), (860,225), (930,280)), not large soft patches.
4. Flecks are an even 1×2-dash speckle, with a regular paired row along the south ledge of the 3-wide run (y ≈ 1100 and 1125).
5. A fleck repeats about every 2 cells on the 1-wide vertical run (x ≈ 1102).

VERDICT: FAIL
