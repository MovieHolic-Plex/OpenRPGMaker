"""Fable 한 방 프롬프트 틀과 계약 글(세계 불문) — 그 세계의 잠긴 팔레트 · 주인공 그림 · 버들항에서 잰 문/층 치수 · 직각 지붕. 모델이 읽는 글은 영어.
세계마다 다른 글(칩셋 소개 BLURB · 재질 설명 MATERIALS)은 worlds/<id>.py 가 준다."""

SYSTEM = ('You are a pixel artist who hand-authors 16px JRPG chipset pieces as rows of palette characters. You decide every pixel yourself. '
          'Your final message is exactly one JSON object and nothing else.')

TEMPLATE = """Draw ONE pixel-art piece for a 16px-grid top-down JRPG chipset.
You get exactly one attempt at the drawing: there is no preview of your own drawing, no feedback and no second try. Your final reply is parsed by a script and rendered pixel for pixel.
Output budget: your whole reply including any reasoning is cut off at {cap} tokens, and one pixel row of this canvas costs about {rowtok} tokens. Plan briefly (which rows are which part, which ramps you use). Do NOT write draft rows before the answer: a cut-off reply is a failed drawing.

FIRST, look at the attached pictures (each is magnified with nearest-neighbour; the caption says what it is and how to use it):
{imglist}

CHIPSET: {blurb}

== THE PIECE ==
Name: {name}
Canvas: {w} x {h} pixels ({w} columns, {h} rows).
Kind: "{kind}" - {kind_rule}.
Brief: {text}
{variant}
{contract}

== SCALE (measured; the player sprite is the last picture) ==
- The player character is a 24x32 sprite frame; the figure in it is 16 px wide and 24 px tall and stands on one 16x16 map cell. Everything you draw is seen next to this figure by the same orthographic camera (front-above).
- Sizes accepted in this game's house style (measured on its kits, in pixels): a door leaf 10-16 wide x 22-26 tall; one storey of wall 32 tall; a window 8-10 wide x 8-14 tall; a lamp post 12 wide x 28-42 tall; a table 30 x 26; a bench 26 x 14; a jar or basket 10-14 wide.
- A counter or cart bed is about 16 px tall (waist height of the figure); a top face seen from above is a third to a half as deep as the front face below it is tall.

== COLOUR RULES ==
{colour_rules}
- No letters or digits. Avoid accidental faces. No semi-transparent pixels: do not draw a ground shadow.
- No large flat fills (6x6 pixels or more of one colour) and NO checkerboard / salt-and-pepper speckle: every detail pixel is deliberate.

== LOCKED PALETTE (ramp: tone=hex, tone 0 is the darkest). Use ONLY these colours ==
{palette}
{materials}
== OUTPUT FORMAT (strict) ==
Your final message is ONE JSON object and nothing else - no prose, no markdown fence, no code:
{{"legend": {{"<char>": "<ramp>:<tone>", ...}}, "rows": ["...", ...], "note": "..."}}
- "rows": exactly {h} strings, each exactly {w} characters. One character is one pixel. Row 0 is the top (north) row. Every row is a plain string literal: never write .replace(), .slice() or any expression.
- "." is transparent.{opaque_note} There is no shadow character.
- Every other character must be a key of your "legend" (single characters from a-z, A-Z, 0-9). Legend values are colours of the locked palette written "ramp:tone", e.g. "{eg}".
- "note": at most 20 words on what you drew.
Before you answer, count the characters of every row: each must be exactly {w}."""

CR_GROUND = """- This is a GROUND piece. Ground must RECEDE behind buildings and characters: low contrast, close tones. Use 3-4 neighbouring tones of the ramp(s) the brief names and nothing else.
- Joints / grout / cracks are only ONE tone step darker than the body (two steps at the very most, for a few pixels). NEVER outline each stone with a dark line.
- Stones or patches differ from each other by one tone step; a 1-pixel lighter upper-left edge on some stones is enough relief."""
CR_STRUCT = """- This is a STRUCTURE / OBJECT piece: 4-5 tones of one ramp per material, a clear light side (upper left) and shade side (right and bottom). Edges are toned with the darkest tones of the adjacent material - never a uniform black outline around every shape.
- Saturated ramps are for small things only (cloth, glazed tile, a flame, fruit, a painted door): a few per cent of the pixels unless the brief says the thing itself is cloth or tile.
- Match the existing pieces of this chipset in the attached pictures: the same tone steps, the same amount of detail, the same clean readable shapes."""

KIND = {
 "roof": "flat roof block - the rectangular roof of a house seen from the front/above; a script puts a wall piece directly below it",
 "wall": "front wall block - one storey of flat front (south) wall with its door; a script puts a roof piece directly above it",
 "round_body": "round standing body (jar, pot, basket, drum) - the top opening or lid is seen from above as an ellipse at least 4 rows deep, with the rounded front below it",
 "box": "box-like (crate, chest, counter, bed, cart body) - the top is seen from above (at least 4 rows per 16 rows of height) and the front face is below it",
 "column": "column-like (lamp post, pillar, sign post, statue on a plinth) - the head / cap shows its top seen from above as an ellipse or plate wider than a 1-2 row rim; the base shows its top too",
 "container": "container with an opening (well, basin, trough, brazier, fountain) - the INSIDE of the opening (water, coals) is seen from above as an ellipse / band at least 4 rows deep, with the front wall below it",
 "figure": "figure or monument - the plinth or base shows its top slab seen from above under the standing part, with its front face below",
 "organic": "plant or rock - a natural shape seen from the front-above: the crown / top mass seen from above over a short trunk or base; irregular outline, no straight box edges",
 "animal": "animal seen from the front-above (three-quarter view from the south), standing or resting on the ground, readable silhouette",
 "other": "other standing object - the main body shows a top surface (at least 3 rows) with the front face below it",
 "ground": "ground tile - a flat floor seen straight from above; no standing parts, no front faces",
 "decal": "flat thing lying on the ground (rug, mat, scattered small things) seen straight from above; no height",
 "wallface": "interior wall face module - a flat front wall strip of a room, fully opaque, repeated side by side by a script",
 "wallmount": "thing mounted on an interior wall face (seen from the front, flat against the wall, transparent around it)",
 "structure": "small structure (stall, tent, kiosk, awning) - its roof or awning is a RECTANGLE or simple canopy seen from above/front over the top 35-45% of the canvas, with the open front (counter, goods, opening) below it",
 "stairs": "opening in the floor with steps going DOWN (seen from above/front): a dark rectangular hole with a rim, 3-5 steps descending toward the north getting darker",
}

C_PROP = """== VIEW CONTRACT: orthographic 3/4 top view (drawings that break it are rejected) ==
- The camera is orthographic, south of the object, looking down at about 45 degrees. A standing object shows its TOP surfaces seen from above (a square top becomes a band of rows, a round top becomes an ellipse) AND its FRONT (south-facing) face below them.
- Not a front elevation (only a front face with a 1-2 row rim on top) and not a flat plan. No east or west side faces, no isometric or diagonal projection, no perspective: verticals stay vertical, horizontal edges stay horizontal.
- Every large part needs its own top surface. Light comes from the upper left: top planes are lighter than the front faces below them.
- Fill the canvas: the object uses most of the canvas width and height and its lowest opaque pixels are on the last row or the row above. Do not draw ground, sand, pavement or water around or under the object."""
C_ORGANIC = """== VIEW CONTRACT: orthographic 3/4 top view of a natural thing ==
- Orthographic camera, south of the thing, looking down at about 45 degrees: a crown or top mass seen partly from above, over the trunk / stem / base seen from the front. No perspective, no isometric diagonals.
- Light from the upper left: the upper-left of every mass is lighter, the lower right is in shade. Irregular natural outline, toned with the darkest tones of its own ramp.
- Fill the canvas: its lowest opaque pixels are on the last row or the row above, centred. Do not draw ground or a ground shadow."""
C_DECAL = """== VIEW CONTRACT: a flat thing on the ground ==
- Seen straight from above, no height, no front face. Transparent around it. It may fill the canvas up to 1 px from the edges."""
C_WALLMOUNT = """== VIEW CONTRACT: a thing fixed flat on an interior wall face ==
- Seen from the front (the wall is a flat front face); verticals vertical, horizontals horizontal. Transparent ("." ) around it: a script pastes it over a wall picture. Light from the upper left. No floor, no wall around it.
- It must read on any of this chipset's wall faces: a 1-px darker rim on its right and bottom sides."""
C_GROUND = """== GROUND TILE CONTRACT (the tile is repeated edge to edge over large areas; a visible seam or a visible 16-pixel rhythm is a failed tile) ==
- Fully opaque: all pixels are colours, no "." anywhere. Seen straight from above; no standing parts.
- The tile wraps: the last column touches column 0 of the next copy and the last row touches row 0 of the copy below. A stone or brick cut by an edge continues on the opposite edge with the same colours at the same rows / columns. Check your four edges against each other before you answer.
- No frame: no joint line along the whole of row 0, the last row, column 0 or the last column, and the border is not darker than the middle.
- No single feature that the eye catches when the tile repeats (one bright stone, one dark blotch): spread the variation evenly."""
C_VARIANT_TILE = C_GROUND + """
- VARIANT RULE: this tile is laid at random among the other variants of the same surface, so its border must be the border of VARIANT A (given below as row strings): row 0, row 15, column 0 and column 15 are EXACTLY variant A's pixels - copy them character by character. Inside (rows 1-14, columns 1-14) draw a different arrangement so the two tiles do not look like copies."""
C_ROOF = """== VIEW CONTRACT: the ROOF BLOCK of a house in an ORTHOGRAPHIC top-down view (drawings that break it are rejected) ==
- The camera is orthographic: no perspective, no vanishing point. A house in this game is a rectangular ROOF BLOCK on top and a flat front WALL strip below it - exactly like the houses in picture 1. THIS CANVAS IS ONLY THE ROOF BLOCK; the wall is a separate piece that a script puts directly below.
- THE ROOF SILHOUETTE IS A RECTANGLE THAT FILLS THE WHOLE CANVAS: every row from row 0 to the last row is opaque from column 0 to the last column (no "." anywhere). The left and right edges are vertical. NO hip ends, NO slanted corners, NO trapezoid, NO side slope, NO side wall, NO isometric diagonals.
- It is a FLAT roof terrace seen from above: a parapet rim 2-3 px wide runs around all four sides (back rim darker line at row 0-1, left rim lit, right rim shaded, front rim = the lightest band on the last 3-4 rows with a 1-px shadow line under it on the last row). Inside the rim is the roof slab seen from above, one or two tones lighter than the wall material, with soft patches - not one flat colour.
- Things on the roof named in the brief (a dome, a rug laid out to air, jars, a hatch, drying fruit, a low wind-catcher, an awning on poles) are drawn INSIDE the rim, seen from above/front, each with a short shadow to its lower right. Nothing sticks out above row 0 or beyond the sides.
- Do not draw the wall, a door, ground or sky."""
C_WALL = """== VIEW CONTRACT: the front WALL BLOCK of a house in an orthographic top-down view ==
- A flat front (south) wall, one storey high, seen straight on: verticals vertical, horizontals horizontal; no side faces, no perspective, no roof, no ground. FULLY OPAQUE: no "." anywhere.
- A script puts a roof block directly above row 0, so row 0 is plain wall right under the roof's front rim (a 1-px shadow line along row 0 is right). The last row is the ground line of the wall: the darkest tone of the wall material.
- Left edge column lit by one tone, right edge 2 columns shaded: the light comes from the upper left.
- THE DOOR: {door}
- Windows are small and deep-set (8-10 wide x 8-12 tall, dark inside, a sill and a lintel), set at mid height; they never touch the door frame or the wall edges (keep 3 px)."""
C_WALLFACE = """== VIEW CONTRACT: an INTERIOR WALL FACE MODULE (a room's back wall seen from the front) ==
- A flat front wall strip seen straight on, FULLY OPAQUE: no "." anywhere. A script repeats this canvas side by side, so column 15 touches column 0 of the next copy: every course line, band and pattern must continue across that edge (wrap in x). Nothing unique that would visibly repeat every 16 px except where the brief asks for it (a niche, a window).
- Row 0 is the top of the wall under the ceiling (a 1-px darker line), the last 2 rows are the skirting at the floor (darker). Light from the upper left."""
C_STAIRS = """== VIEW CONTRACT: a way DOWN set into the floor, orthographic 3/4 top view ==
- A rectangular opening in the floor seen from above/front, with a stone or wooden rim 2 px wide on its west, north and east sides (the rim's top is lit) - the south side is open: the player walks in from the south.
- Inside, 3-5 steps descend toward the north: the nearest step (south) is the lightest, each step further north is one tone darker and 2-3 rows deep, ending in a dark shadow at the top of the opening.
- Fill the canvas. No walls around it, no ground outside the rim."""

CONTRACT = {'ground': C_GROUND, 'tilevar': C_VARIANT_TILE, 'prop': C_PROP, 'organic': C_ORGANIC, 'decal': C_DECAL, 'wallmount': C_WALLMOUNT, 'roof': C_ROOF, 'wall': C_WALL, 'wallface': C_WALLFACE, 'stairs': C_STAIRS}

VARIANT = """
== THIS IS A NEW LOOK OF AN EXISTING PIECE ==
The game already has one picture of this kind of thing (shown below as row strings in this same palette, and in the attached pictures). Games built with this chipset all look the same because every game uses that one picture. Draw a MATERIALLY DIFFERENT {what} - different silhouette detail, different make, different colours within the palette - that a player recognises as the same KIND of thing but would never mistake for the same picture.
It replaces the existing picture cell for cell, so:
- same canvas size; the thing stands on the same ground cells and is about as tall and as wide as the existing one;
- canvas cells (each 16x16 pixels), top row first, "X" = this cell must contain part of the drawing, "." = this cell must stay completely transparent: {cells}
- do NOT copy the existing rows; reuse its tone steps and level of detail only.

== THE EXISTING PICTURE as row strings, {w}x{h} ==
legend: {legend}
rows:
{rows}
"""


def palette_text(ramps, only=None):
    return '\n'.join(f'  {r}: ' + ' '.join(f'{i}={c}' for i, c in enumerate(t)) for r, t in ramps.items() if only is None or r in only)
