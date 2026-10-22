# Fresh adversarial Opus reviewer — final verdict (r29)

Piece(s): slab-break. Reviewer had no prior scores in context; board = this folder. Text below is the reviewer's final message, verbatim.

Judged image(s): slab-break sha de08591f8cf64bc41d0fd83a4119cff223753369d2a8462bc39108fac2bbfffb (gate FAIL).

---

**Verdict: FAIL**

The overlay works on narrow pieces like strips, T-junctions and end caps. It fails on the wide pad, which is what most maps will show. That pad still reads as a rectangle with a sawtooth border, and the dark rim on every side makes the concrete look like a cut-out sticker.

**Defects (coordinates in the 4x composite)**

1. **Wide pad outline still reads as straight cell edges.** On the right pad (about x 780–1015, y 75–440), the bites are only 1–3 source px deep and nearly the same depth everywhere.
   - The left edge (x≈780–790) and right edge (x≈1008–1015) read as straight vertical lines at 2x.
   - The top (y≈78) and bottom (y≈435) read as straight lines trimmed with small regular notches, like a postage-stamp edge.
   - There are no rounded bites eating into the concrete, which is what the brief asks for. At 2x you clearly see a rectangle with fuzzy edges.
2. **The dark lip runs on all four sides, not only under south breaks.** The dark blue-grey 1px line follows the north rim of the big pad (y≈76–80), the left and right rims, and the whole outline of the island (x 460–495, y 585–620).
   - Every piece gets a full dark outline, so it reads as a sticker instead of broken slab.
   - On north rims the line breaks into separate dashes. For example, the top of the right arm of the cross (x 410–495, y≈205) and the top of the bottom T's arms (x 145–305, y≈585–595) read as dotted lines, which the brief forbids.
   - Lit broken rims are hard to see. Light rim pixels appear only in a few places, such as the bottom T's arms.
3. **Straight seam runs on the pad edge.** On the top T piece (x 520–632, y 80–240), slab-a's dark seam sits on the east cell boundary at x≈628–632, y≈135–195, and the overlay leaves it unbroken. The result is a perfectly straight 15px dark line on the outer edge.
   - On the 2x2 block, slab-a's light-and-dark seam at x≈545–550 (y 395–495) runs only 2–4 px inside a ragged edge, so that side still looks ruler-straight.
4. **Loose chunks touching the rim read as noise.** Small grey specks sit right against the break on the bottom T (around x 160–170, y≈580 and x 300–310, y≈580) and next to the arms of the cross (around x 240, 210 and x 495, 200).
   - Each has a dark outline and sits 1–2 px from the rim, so they read as stray pixels or torn-paper spikes rather than fallen chunks.
   - Spikes like the bottom T's right arm (x 285–305, y 595–620) look like torn paper, not broken concrete.

**What passes**

- The bite dirt colour sits naturally against dirt-b, with no visible hue or value seam.
- slab-a's interior seams and cracks run up to the break.
- No 16px grid shows inside pads.
- Strips and end caps look convincingly broken.

**Fixes**

1. Make bites deeper and less even on edges that have concrete behind them, such as the big pad. Each open edge should have 1–2 rounded bites 4–6 px deep and 5–9 px wide, with shallow 1–2 px stretches between them. Drop the uniform 1–3 px sawtooth.
2. Draw the dark 1px lip only on south-open edges, and on the south-facing lower curve of side bites. Make it a continuous run with no gaps on single pixels.
3. On north, east and west rims, replace the dark outline with a 1px lit rim, or leave no outline at all. Let the concrete-to-dirt value contrast carry the edge.
4. Where an open edge meets a cell boundary that carries a seam, make sure the bite covers that boundary. A bite should always overlap the corner and edge midpoints, so slab-a seams can never show as a straight line along the outer edge (top T east side, 2x2 block west side).
5. Move loose chunks at least 2–3 px out onto the dirt and cluster them, 1–2 per open edge at most. Give them a lit top pixel and a dark bottom pixel instead of a full dark ring. Remove single-pixel grey specks attached to the rim.
