# Fresh adversarial Opus reviewer — final verdict (r48)

Piece(s): asphalt-ph. Reviewer had no prior scores in context; board = this folder. Text below is the reviewer's final message, verbatim.

Judged image(s): asphalt-ph sha b54a79137c9214a7da6db4a8ef1cadf366499437ddfaa1b5de6383190509e889 (gate FAIL).

---

Verdict: FAIL. All coordinates below are pixels in `asphalt-sample-4x.png`.

**What works**
- The south edge has a dry dark-brown ledge on every run, e.g. along y≈1140 under the 3-wide horizontal run and y≈885 under the 1-wide run.
- The grey is warm and opaque, nothing like the puddle, so it does not read as water.
- The edge wobble is continuous, not a per-tile bite pattern. Rim bumps on the 3-wide horizontal run, e.g. x≈120, 190, 380 at y≈970, do not land on 16px boundaries.

**Defects**

1. **The 1-wide horizontal run reads as a chain of segments (brief 1).** Along y≈840–885 it alternates light and dark blocks about 32 native px long, joined by hard, nearly vertical seams. Light blocks span x≈180–320, 440–570 and 695–820; dark blocks span x≈75–180, 320–440 and 570–695. It looks like a piano-key strip, not one continuous road surface.

2. **N/S and E/W behave differently (brief 1).** The 1-wide vertical run at x≈1095–1145, y≈75–815 is a flat, featureless dark strip with no mottling at all. The 1-wide horizontal run is heavily two-toned. The light patches are tied to global coordinates, so they never reach that column.

3. **The light mottling forms boxes and lanes, not broad flowing patches (brief 2).** The 3-wide vertical run has light rectangles with a straight right edge at x≈1325 (y 75–200, 295–470, 550–720). That splits the road into a light left lane and a dark right lane, stacked in blocks. The 2x2 patch (x 520–630, y 395–500) is split down the middle into light and dark halves, so it reads as two materials. The T stem (x 200–250, y 590–690) and the stub at x 180–250, y 395–470 are almost entirely light, so they read as a different surface pasted on.

4. **The dither looks mechanical (brief 2).** The light areas use a regular checker dot grid, like a grate or screen-door, e.g. x≈1235–1300, y≈105–160 and the T stem at x 200–250, y 600–680. Patch borders use horizontal stripe rows, e.g. x≈150–260, y≈1050–1100 and x≈230–290 at the top of the 1-wide run. This is not organic dither between grey steps, and the references' flat surfaces have none of it.

5. **The cracks contain cool blue-black pixels (brief 3).** Examples: (1272,240), (1297,249), (1332,307), (249,1007), (274,1016), (309,1076). The crack shape is also a stepped zigzag with a dark lip, which reads more like a twig or hairline lightning than a dirt-filled split.

6. **Single light pixels sit in a regular grid (brief 2).** They are evenly spaced across the dark areas, e.g. (130,995), (322,1010), (385,995), (575,1010), (640,995), (1290,140), (1255,245). They read as rivets or speckle, not occasional wear.

7. **The caps are not rounded (brief 5).** The isolated cell (x 460–500, y 585–630) is a notched square, not a rounded cap. The T arm ends at x≈140 and x≈310 (y 590–630) and the left end of the 1-wide horizontal run at x≈75, y 840–885 are cut square with small corner notches.

8. **The 3-wide horizontal run looks stamped (brief 6).** The 64px repeat is by design, but each period carries a high-contrast light blob and an identical crack pair. The blobs repeat at x≈160–240, 420–500 and 680–760 (y 1050–1130), and the crack pair repeats at x≈210, 465 and 720 (y≈990 and y≈1060). Together with the stripe dither, it falls short of the clean, quiet road in the modern-city reference at the same scale.

VERDICT: FAIL
