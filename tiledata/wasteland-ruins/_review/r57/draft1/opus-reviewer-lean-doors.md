verdict: FAIL

- Rule 1 (3/4): roof top plane (rows 1-15) over front wall (rows 17-30) is structurally fine. Light direction is OK.
- Rule 2 (quality): defects.
  - The four "doors" lie in a hard 2x2 quilt (blue TL, white TR, green BL, orange BR) meeting at one cross point. That reads as four coloured tarps or crates, not shingled doors.
  - The orange door at (27,8) w=19 ends at x=45, and the outline pass puts a column of near-black wine (45,1,15) at x=46, rows 8-14. That is a visible red-black stripe on the right edge that no other door has.
  - The orange panel also gets a solid amber bottom row (otarp 6 = amber1), a bright yellow bar no other door has.
  - The grey shape in the top-right of the doorway (the burlap sack, x 25-30, rows 17-24) reads as a torn grey curtain or a rock, not a sack.
- Rule 3 (distinct): distinct in silhouette and colour, but only because it is a random colour block.
- Rule 4 (readability): fails on both key features.
  - Doors-as-roof: the recessed panels (`door_panel` draws two panels with only a 1-tone step, mat 3 vs 4) are invisible at 1x. There are no knobs or stiles that read, so nothing says "door".
  - Pallets: `pallet_face` draws three tall 3px light blocks (bx) with navy gaps and short yellow plank stubs between them. At 1x and 3x this reads as a barred window or railing over a black void, not as stood-up pallets. Pallets read as horizontal slats with three block feet, and here the vertical blocks dominate.

Fix (pixel-level):
1. Lay the doors as real shingles: four strips running the full roof width or nearly (each about 44 px wide, 4-5 rows tall), stepped back-to-front at rows 1, 4-5, 8, 11. Shift each strip 2-3 px east or west so the ends are staggered. Each lower strip overlaps the one behind it, with a 1px soot shadow line under every front edge. Never meet four corners at one point.
2. Make each door read as a door: give a 1px darker stile frame all round (mat 2), two clearly recessed panels per door (inner fill mat 2, lit bottom/right edge mat 5, so 3 tones of contrast), and a 2px brass knob (amber 1 + bark 1) at one short end. Peeled paint patches: at most 2 per door.
3. Remove the amber index from the orange door. Use `otarp` 2..4 like the others. Stop the orange door at x=45 with a proper `otarp` 1 right edge, so the outline does not paint wine at x=46.
4. Pallets: invert the emphasis. Draw 3-4 full-width horizontal slats (ply 4 with ply 5 top and ply 1 bottom), 2 rows each, with 1-row dark gaps. Vertical blocks should be only 2px wide stubs at the ends and middle, not 3px light posts spanning the full height. Cut the yellow/navy alternation entirely.
5. Sack: use burlap 2-4 as a bulging lump (rounded top at rows 22-24, tie neck at the top), sitting on the doorway floor at x 24-29, rows 23-29. Do not draw it as a diagonal grey drape.
