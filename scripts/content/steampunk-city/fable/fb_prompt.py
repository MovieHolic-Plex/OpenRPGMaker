"""Fable 한 방 프롬프트 틀과 계약 글 — 그 조각 역할의 색만 · 주인공 그림 · 버들항에서 잰 문/층 치수 · 직각 지붕(직사각형 지붕 덩이 + 납작한 앞벽). 모델이 읽는 글은 영어."""
import fb_common as C

P3 = C.P3

SYSTEM = ('You are a pixel artist who hand-authors 16px JRPG chipset pieces as rows of palette characters. You decide every pixel yourself. '
          'Your final message is exactly one JSON object and nothing else.')

TEMPLATE = """Draw ONE pixel-art piece for a 16px-grid top-down JRPG chipset.
You get exactly one attempt at the drawing: there is no preview of your own drawing, no feedback and no second try. Your final reply is parsed by a script and rendered pixel for pixel.
Output budget: your whole reply including any reasoning is cut off at {cap} tokens, and one pixel row of this canvas costs about {rowtok} tokens. Plan briefly (which rows are which part, which ramps you use). Do NOT write draft rows before the answer: a cut-off reply is a failed drawing.

FIRST, look at the attached pictures (each is magnified with nearest-neighbour; the caption says what it is and how to use it):
{imglist}

CHIPSET: steampunk_city - a steam-age industrial city: soot-stained red brick, riveted iron plate, brass and copper pipework with verdigris, slate roofs, gaslight, steam. It must read as STEAMPUNK: machinery, pipes, gauges, rivets and gears are part of the things themselves.

== THE PIECE ==
Name: {name}
Canvas: {w} x {h} pixels ({w} columns, {h} rows).{canvas_note}
Kind: "{kind}" - {kind_rule}.
Brief: {text}

{contract}

== SCALE (measured; the player sprite is the last picture) ==
- The player character is a 24x32 sprite frame; the figure in it is 16 px wide and 24 px tall and stands on one 16x16 map cell. Everything you draw is seen next to this figure by the same orthographic camera (front-above).
- Sizes accepted in this game's house style (measured on its kits, in pixels): a door leaf 10-16 wide x 22-26 tall; one storey of wall 32-48 tall; a window 8-10 wide x 8-14 tall; a lamp post 12 wide x 42 tall; a table 30 x 26; a bench 26 x 14.
- So here: a door OPENING is 16 px wide and 26-30 px tall (the figure must fit through it); one storey is at least 32 px tall; a counter or cart bed is about 16 px tall (waist height of the figure); a top face seen from above is a third to a half as deep as the front face below it is tall.

== COLOUR RULES (the last version of this chipset was rejected because its colours shouted) ==
{colour_rules}
- No letters or digits. Avoid accidental faces. No semi-transparent pixels: do not draw a ground shadow.
- No large flat fills (6x6 pixels or more of one colour) and NO checkerboard / salt-and-pepper speckle: every detail pixel is deliberate.

== LOCKED PALETTE of this piece's role (ramp: tone=hex, tone 0 is the darkest). Use ONLY these colours ==
{palette}

== OUTPUT FORMAT (strict) ==
Your final message is ONE JSON object and nothing else - no prose, no markdown fence, no code:
{{"legend": {{"<char>": "<ramp>:<tone>", ...}}, "rows": ["...", ...],{door_ex} "note": "..."}}
- "rows": exactly {h} strings, each exactly {w} characters. One character is one pixel. Row 0 is the top (north) row. Every row is a plain string literal: never write .replace(), .slice() or any expression.
- "." is transparent.{opaque_note} There is no shadow character.
- Every other character must be a key of your "legend" (single characters from a-z, A-Z, 0-9). Legend values are colours of the locked palette written "ramp:tone", e.g. "{eg}".
{door_rule}- "note": at most 20 words on what you drew.
Before you answer, count the characters of every row: each must be exactly {w}."""

CR_GROUND = """- This is a GROUND piece. Ground must RECEDE behind buildings and characters: low contrast, close tones. Use 3-4 neighbouring tones of ONE ramp for the material (a second ramp only where the brief names it).
- Joints / grout are only ONE tone step darker than the stone body (two steps at the very most, for a few pixels). NEVER outline each stone with a dark line and never use ink on the ground.
- Stones differ from each other by one tone step, in patches; a 1-pixel lighter upper-left edge on some stones is enough relief."""
CR_STRUCT = """- This is a STRUCTURE / OBJECT piece: 4-5 tones of one ramp per material, a clear light side (upper left) and shade side (right and bottom). Edges are toned with the darkest tone of the adjacent material; ink only for the deepest gaps and openings - never a uniform black outline around every shape.
- The ACCENT ramps (lit, red, green) are for small things only: a lit window pane, a lamp flame, a signal lens, an awning, a painted door - a few per cent of the pixels. Everything else is brick, slate (also used for iron), wood, brass (its dark tones are copper), verd (verdigris) and gstone (stone)."""

KIND = {
 "roof": "roof module - the rectangular roof block seen from the front/above, repeated side by side by a script",
 "wall": "wall module - one storey of flat front wall, fully opaque, cut into bays and stacked by a script",
 "round_body": "round standing body (boiler, tank) — the top end is seen from above as an ellipse or dome at least 6 rows deep (for a 48-row canvas: 10-14 rows), with the cylindrical front below it",
 "box": "box-like (crate, cart body) — the top is seen from above (at least 4 rows per 16 rows of height) and the front face is below it",
 "column": "column-like (lamp post, gauge post) — the head / cap shows its top seen from above as an ellipse or plate wider than a 1-2 row rim; the base plate shows its top too",
 "container": "container with an opening (vent, cart with a load, funnel) — the INSIDE of the opening or the load is seen from above as an ellipse / band at least 4 rows deep, with the front wall below it",
 "figure": "monument — the plinth shows its top slab seen from above (at least 4 rows) under the standing part, with its front face below",
 "other": "other standing object — the main body shows a top surface (at least 3 rows) with the front face below it",
 "ground": "ground tile — a flat floor seen straight from above; no standing parts, no front faces",
 "trans": "ground transition tile - a flat floor seen straight from above where two ground materials meet",
 "frame": "open frame (iron railing) - posts and rails; the top rail shows a 1-row lit top edge; no ground",
 "structure": "small structure (stall, kiosk) - its roof or awning is a RECTANGLE seen from above/front over the top 35-45% of the canvas (vertical left and right edges, as wide at the bottom as at the top), with the open front (counter, goods, window) below it",
 "part": "one part of a larger machine or vehicle that a script joins with its neighbour part",
 "feat": "a small part pasted by a script onto a roof or wall (transparent around it)"
}

_C_ROOF = """== VIEW CONTRACT: the ROOF BLOCK of a building in an ORTHOGRAPHIC top-down view (drawings that break it are rejected) ==
- The camera is orthographic: no perspective, no vanishing point. A building in this game is a rectangular ROOF BLOCK on top and a flat front WALL strip below it - exactly like the building in picture 1. THIS CANVAS IS ONLY THE ROOF BLOCK; the wall is a separate piece that sits directly below.
- THE ROOF SILHOUETTE IS A RECTANGLE THAT FILLS THE WHOLE CANVAS: every row from row 0 to the last row is opaque from column 0 to the last column (no "." anywhere). The left and right edges are vertical; the eave at the bottom is exactly as wide as the ridge at the top. NO hip ends, NO clipped or slanted corners, NO trapezoid that narrows toward the top, NO side slope, NO side wall, NO isometric diagonals. (The previous version of this roof narrowed toward the ridge and was rejected for exactly that.)
- The roof face is the south slope seen from the front/above as HORIZONTAL BANDS running the full width: rows 0-2 are the ridge capping (a lit row and a dark row under it); below it courses of slates (or metal sheets with standing seams) with staggered vertical joints - the courses are 2 rows high near the ridge, 3 rows in the middle and 4 rows near the eave, and the slates are one tone lighter near the ridge; the last 5-6 rows are the eave: a gutter or cornice line the full width and a shadow row under it on the last row.
- An outer END of the roof (the brief says which columns) is a barge-board / coping strip 2 pixels wide running straight down from ridge to eave, so the vertical edge reads as an edge.
- Things standing on the roof (chimney stack, boiler stack, skylight, dormer, vent pipes, turret) are drawn INSIDE the rectangle, over the slates: nothing sticks out above row 0 or beyond the sides. A stack shows its own top (a dark opening seen from above as an ellipse or rounded rectangle with a lit rim) and a short body below it, and throws a short shadow to the lower right on the slates; a skylight is a pane lying on the slope.
- Do not draw the wall, the storey below, a door, ground or sky."""

C_PART = """== VIEW CONTRACT: orthographic 3/4 top view, ONE PART of a larger object ==
- The camera is orthographic, south of the object, looking down at about 45 degrees. The object shows its TOP surfaces seen from above (round tops become ellipses, flat tops become bands of rows) AND its south-facing front below them. No east or west side faces, no perspective. Light from the upper left: tops lighter than fronts, right and bottom sides in shade.
- THIS CANVAS IS ONE PART. A script joins it with the neighbouring part named in the brief (its row strings are given at the end when it is already drawn). Along the shared edge the shape is OPEN: do not draw an outline or a rim there; outlines, bands, rivet rows, colours and tone steps continue across the shared edge at the same rows (or columns).
- Away from the shared edge the object fills the canvas. Its lowest opaque pixels are on the last row or the row above when the brief says the part stands on the ground. Do not draw ground, rails, water or sky."""

C_GROUND = """== GROUND TILE CONTRACT (the tile is repeated edge to edge over large areas; a visible seam or a visible 16-pixel rhythm is a failed tile) ==
- Fully opaque: all pixels are colours, no "." anywhere. Seen straight from above; no standing parts.
- The tile wraps: the last column touches column 0 of the next copy and the last row touches row 0 of the copy below. A stone or brick cut by an edge continues on the opposite edge with the same colours at the same rows / columns. Check your four edges against each other before you answer.
- No frame: no joint line along the whole of row 0, the last row, column 0 or the last column, and the border is not darker than the middle.
- No single feature that the eye catches when the tile repeats (one bright stone, one dark blotch): spread the variation evenly."""
C_VARIANT = C_GROUND + """
- VARIANT RULE: this tile is laid at random among the other variants of the same surface, so its border must be the border of VARIANT A (given at the end as row strings): row 0, row 15, column 0 and column 15 are EXACTLY variant A's pixels - copy them character by character. Inside (rows 1-14, columns 1-14) draw a different arrangement so the two tiles do not look like copies."""
C_PROP = """== VIEW CONTRACT: orthographic 3/4 top view (drawings that break it are rejected) ==
- The camera is orthographic, south of the object, looking down at about 45 degrees. A standing object shows its TOP surfaces seen from above (a square top becomes a band of rows, a round top becomes an ellipse) AND its FRONT (south-facing) face below them.
- Not a front elevation (only a front face with a 1-2 row rim on top) and not a flat plan. No east or west side faces, no isometric or diagonal projection, no perspective: verticals stay vertical, horizontal edges stay horizontal. A roof or awning on the object is a RECTANGLE with vertical left and right edges (as wide at its bottom as at its top).
- Every large part needs its own top surface. Light comes from the upper left: top planes are lighter than the front faces below them.
- Fill the canvas: the object uses most of the canvas width and height and its lowest opaque pixels are on the last row or the row above. Do not draw ground, pavement or water around or under the object."""
C_FEAT = """== VIEW CONTRACT: a small part that a script pastes onto a roof or a wall ==
- Orthographic camera, front-above; verticals vertical, horizontals horizontal; no side faces, no perspective. Light from the upper left.
- Transparent ("." ) wherever the part is not: a script pastes it over a roof or wall picture. The part fills the canvas as far as its shape allows. No ground, no background wall or slates around it."""
C_ROOF = _C_ROOF + """
- THIS ROOF IS A MODULE THAT A SCRIPT REPEATS SIDE BY SIDE to make roofs of any width: column {last} touches column 0 of the next copy. The slate joints, the ridge capping and the eave gutter must continue across that edge (wrap in x). So do NOT draw end copings, chimneys, dormers or anything unique - only the repeating roof surface, ridge and eave. The script adds ends and roof furniture."""
C_WALLMOD = """== VIEW CONTRACT: a WALL MODULE of a building in an orthographic top-down view ==
- A flat front (south) wall strip, one storey high: verticals vertical, horizontals horizontal; no side faces, no perspective, no ground, no roof. FULLY OPAQUE: no "." anywhere.
- A SCRIPT CUTS THIS CANVAS INTO BAYS AND REARRANGES THEM, and stacks storeys on top of each other. So the masonry must be periodic: courses exactly 4 rows high (3 rows of brick or stone + 1 joint row), starting at row 0; in even courses a vertical joint at columns 7 and 15 of every 16; in odd courses at columns 3 and 11. That way any bay joins any other bay and any storey joins the storey below.
- Each bay named in the brief is self-contained inside its own columns: nothing (frame, sill, pipe, shadow) crosses a bay boundary.
- Light from the upper left: left and top edges of frames lit, right edges and undersides shaded. Windows are big enough to read (8-10 wide x 12-14 tall glass with a frame), not grids of tiny panes."""


def palette_text(role):
    return '\n'.join(f'  {r}: ' + ' '.join(f'{i}={c}' for i, c in enumerate(t)) for r, t in P3.ROLES[role].items())


def cap_for(w, h):
    """출력 상한(토큰) — 화소 수에 따라. 48×56(2,688px) 을 넘는 조각은 한 번에 못 그린다(잘린다): 쪼개서 주문한다."""
    px = w * h
    for lim, cap in ((256, 8000), (512, 9000), (768, 10000), (1024, 12000), (1536, 16000), (1920, 18000), (2304, 20000), (2760, 24000)):
        if px <= lim:
            return cap
    raise ValueError(f'{w}x{h} = {px}px is over the piece limit')


class Jobs:
    def __init__(self):
        self.J = []

    def add(self, pid, ko, name, w, h, cls, kind, text, needs=(), group=None, old=None, cap=None, contract=None, prio=None):
        self.J.append(dict(id=pid, ko=ko, name=name, w=w, h=h, cls=cls, kind=kind, text=text, needs=[list(n) for n in needs], group=group, old=old, cap=cap or cap_for(w, h), contract=contract, prio=prio))
