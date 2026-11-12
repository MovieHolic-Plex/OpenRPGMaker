"""sf_station redraw 준비(모델 호출 없음): 단위(units)마다 프롬프트 · units.json. 틀은 steampunk-redo/sp_setup.py 를 따르되 «직각 지붕» 계약(redraw/CONTRACT.md §1)으로 바꿨다."""
import json, os
from PIL import Image
import sfr_lib as L
import sfr_units as U

H = L.HERE
SYSTEM = ('You are a pixel artist who hand-authors 16px JRPG chipset pieces as rows of palette characters. You decide every pixel yourself. '
          'Your final message is exactly one JSON object and nothing else.')
SEL = '/home/main/z-project/assistant-fable-runs/object-oneshot/pilot/selected'

KIND = {
 'box': 'box-like (crate, case, kiosk) - the top is seen from above as a rectangle (at least 4 rows per 16 rows of height) and the front face is below it',
 'low_furniture': 'low furniture (desk, console, table, bed, counter) - the top surface is seen from above (at least 5 rows of a 16-row canvas) with the front (south) face below it',
 'tall_furniture': 'tall furniture (cabinet, rack, locker, pod, vending machine) - the top panel is seen from above (4-6 rows, lighter than the front) with the tall front face below it',
 'round_body': 'round standing body (tank, reactor, bin) - the top end is seen from above as an ellipse at least 5 rows deep, with the cylindrical front below it whose bottom edge is an arc',
 'column': 'column-like (lamp post, mast) - the head shows its top seen from above as a plate or ellipse wider than a 1-2 row rim; the base plate shows its top too',
 'seat': 'seat - the surface where one sits is seen from above (at least 4 rows); a backrest stands at the north side as a vertical face',
 'structure': 'machine or structure - every block shows its top face (a rectangle, at least 4 rows) above its front face',
 'organic': 'organic (rocks, plants) - no geometric top plane required, but lit from the upper left with a clear volume',
 'other': 'other standing object - the main body shows a top surface (at least 3 rows) with the front face below it',
 'flat': 'lies flat on the floor - seen straight from above like a floor marking or plate; no front face (at most a 1-row thickness edge on the south side)',
 'wall_mounted': 'wall-mounted fixture - it hangs on the front face of a wall and is seen from the front; no top surface is needed',
 'ground': 'ground tiles - flat floor seen straight from above; no standing parts, no front faces',
 'wallset': 'wall set - ceiling-top tiles seen from above plus wall front-face tiles seen from the front',
 'building': 'building - a rectangular roof block seen from above on top of a flat south wall',
 'roof': 'roof piece of a building - the whole canvas is the ROOF seen from above (plus the things standing on it); the wall is a separate piece below',
 'wall': 'wall piece of a building - the flat south wall below the eave, seen from the front; the roof piece sits directly on top of it',
 'mid': 'middle storeys of a tower wall - flat south wall seen from the front; repeated vertically by a script',
}

TEMPLATE = """Draw ONE pixel-art picture for a 16px-grid top-down JRPG chipset.
You get exactly one attempt at the drawing: there is no preview of your own drawing, no feedback and no second try. Your final reply is parsed by a script and rendered pixel for pixel.
Output budget: your whole reply including any reasoning is cut off at {cap} tokens, and one pixel row of this canvas costs about {rowtok} tokens. Plan briefly (which rows are which part, which ramps you use). Do NOT write draft rows before the answer: a cut-off reply is a failed drawing.

FIRST, look at the attached pictures (each is magnified with nearest-neighbour; the caption says what it is and how to use it):
{imglist}

CHIPSET: sf_station - science fiction: a space station interior, a research base, a moon base and a neon city street at night. Clean hard-edged industrial design: blue-grey hull plate, white ceramic panels, dark navy, cyan screens and light strips, orange and yellow hazard markings; on the street dark blue towers whose signs and lit windows glow in magenta, cyan and violet. Game characters walk on these maps and must stay readable: floors are calm, low in saturation and recede; things that stand on the floor have a dark edge; saturated colours appear ONLY as lights, screens, signs and markings (a few per cent of the pixels).

== THE PICTURE ==
Name: {name}
Canvas: {w} x {h} pixels ({w} columns, {h} rows).{canvas_note}
Kind: "{kind}" - {kind_rule}.
Brief: {text}

{contract}

== SCALE (measured; the player sprite is picture {heron}) ==
- The player: sprite frame 24x32 px; the figure itself is 16 px wide and 24 px tall and stands with its feet on one 16x16 map cell. One map cell = 16 px.
- Sizes accepted in this game's house style (measured on its kits, in pixels): a door leaf 10-16 wide x 22-26 tall; one storey of wall 32-48 tall; a window 8-10 wide x 8-14 tall; a lamp post 12 wide x 42 tall; a table 30 x 26; a bench 26 x 14; an indoor table 32 x 16; a wall shelf 14 x 16.
- So here: a door opening is 14-16 px wide and 26-30 px tall (the figure must fit through it); one storey is at least 32 px tall; a desk, console or counter is about 16 px tall in total (waist height of the figure); a cabinet, locker or pod is 28-32 px tall (as tall as the figure or a little taller); a seat is 12-14 px wide.
- Camera: the figure is seen from the front and slightly from above; draw every object for the same camera. For furniture the top face depth is about a third to a half of its front height.

== STYLE RULES ==
- Shading like the accepted pieces in picture 1: 4-6 tones of one ramp per material, light from the upper left (top faces lightest, front faces darker, right and bottom edges in shade), edges toned with the darkest tone of the adjacent material, lit top-left edges lighter. Never a uniform black line around every shape.
- No large flat fills (6x6 pixels or more of one colour) and NO checkerboard / salt-and-pepper speckle to fake texture: every detail pixel is deliberate (a panel seam, a rivet, a vent slot, a light, a highlight).
- No letters, digits or logos (screens and signs show bars, dots and simple shapes). Avoid accidental faces (two dots and a line).
- This chipset has no semi-transparent pixels: do not draw a ground shadow.

== LOCKED PALETTE for this picture's role: {role} (ramp: tone=hex, tone 0 is the darkest). Use only these colours; a script snaps anything else to the nearest of them ==
{palette}
{role_rule}

== FORMAT EXAMPLE as row strings, in the exact format you must use ==
{refs}

== OUTPUT FORMAT (strict) ==
Your final message is ONE JSON object and nothing else - no prose, no markdown fence, no code:
{{"legend": {{"<char>": "<ramp>:<tone>", ...}}, "rows": ["...", ...], "top_rows": {top_example},{door_ex} "note": "..."}}
- "rows": exactly {h} strings, each exactly {w} characters. One character is one pixel. Row 0 is the top (north) row. Every row is a plain string literal: never write .replace(), .slice() or any expression.
- "." is transparent.{opaque_note} There is no shadow character.
- Every other character must be a key of your "legend" (single characters from a-z, A-Z, 0-9). Legend values are colours of the locked palette written "ramp:tone", e.g. "{eg}".
- "top_rows": {top_rule}
{door_rule}- "note": at most 20 words on what you drew.
Before you answer, count the characters of every row: each must be exactly {w}.
"""

C_PROP = """== VIEW CONTRACT: orthographic 3/4 top view (drawings that break it are rejected) ==
- The camera stands south of the object and looks down at about 45 degrees, with NO perspective. A standing object shows its TOP surfaces seen from above (a square top is a RECTANGLE band of rows, exactly as wide as the front face below it; a round top is an ellipse) AND its FRONT (south-facing) face below them.
- Not a front elevation (only a front face with a 1-2 row rim on top) and not a flat plan (a standing object with fewer than 3 rows of front face).
- No east or west side faces, no trapezoid tops that narrow toward the back, no isometric or diagonal projection: verticals stay vertical, horizontal edges stay horizontal.
- Every large part needs its own top surface. Light comes from the upper left: top planes are lighter than the front faces below them; right and bottom sides are in shade.
- Fill the canvas: the object uses most of the canvas width and height (leave at most 1 transparent column at each side) and its lowest opaque pixels are on the last row or the row above. Do not draw floor or ground around or under the object.{cells}"""

C_FLAT = """== VIEW CONTRACT: a flat thing on the floor ==
- Seen straight from above, like a marking or a plate lying on the floor: no front face, no standing parts (at most a 1-row darker thickness edge on the south side).
- Light from the upper left: raised rims get a lighter upper-left edge and a darker lower-right edge.
- Pixels outside the shape are transparent ("."): the floor tile below shows through. Do not draw the floor itself.{cells}"""

C_WALLM = """== VIEW CONTRACT: a wall-mounted fixture ==
- The fixture hangs on the front face of a station wall (the wall face tile is drawn separately and lies under this piece). It is seen from the front, upright. No top surface is needed; a small lit upper edge and a shaded lower edge give it thickness.
- Draw only the fixture: all pixels around it are transparent ("."). Leave 1-2 transparent pixels of margin on every side so the wall shows around it.
- Light from the upper left."""

C_BUILDING = """== VIEW CONTRACT: ORTHOGRAPHIC 3/4 top view of a building - the "right-angle roof" (drawings that break it are rejected) ==
- The camera looks from the south, down at about 45 degrees, with NO perspective. The building is two stacked blocks of the SAME width: on top the ROOF seen from above, below it the flat SOUTH WALL seen from the front. Picture 2 shows it: the left building is RIGHT (its roof is a rectangle exactly as wide as the wall), the right building is REJECTED (its roof is a trapezoid with slanted ends).
- The roof block is a RECTANGLE: its left and right edges are straight vertical lines in the same columns as the wall's left and right edges (the roof may overhang the wall by 1 pixel each side). Its back (north) edge is a horizontal line, its front edge (eave / parapet) is a horizontal line directly above the wall. The roof is exactly as wide in its first row as in its eave row.
- FORBIDDEN: a trapezoid roof, any roof or top face that narrows toward the top, hip or gable slopes at the ends, visible east or west side walls, vanishing points, isometric diagonals. Only small details may be diagonal (hazard stripes, an antenna strut).
- {rows_rule} A tall facade with a thin roof strip on top is a front elevation and is rejected.
- The roof reads as a flat deck seen from above: a parapet rim around it (lighter on the north and west side, darker on the south and east side), panel seams as straight horizontal and vertical lines, and roof equipment (vent boxes, hatches, pipes, tanks, a dish) - each piece of equipment shows its own small top face and a 2-4 row front face. Equipment stays inside the roof rectangle; only a thin antenna (at most 2 pixels wide) may rise above the roof's back edge.
- A round roof part (dome, tank, cooling tower) is a clear ELLIPSE seen from above, readable at 1x, standing on the rectangular roof or base.
- The wall is a flat front: verticals vertical, horizontals horizontal; its first row is the shadow under the eave; the door reaches the last row; windows and panels are few and big enough to read. The lowest wall row is on the last canvas row. Transparent pixels only outside the silhouette. Do not draw ground."""

C_ROOF = """== VIEW CONTRACT: the ROOF PIECE of a building in an ORTHOGRAPHIC 3/4 top view - the "right-angle roof" (drawings that break it are rejected) ==
- The camera looks from the south, down at about 45 degrees, with NO perspective. THIS CANVAS IS ONLY THE ROOF: the roof seen from above plus the things standing on it. The south wall is a separate piece that sits directly below, exactly as wide. Picture 2 shows the rule: the left building is RIGHT (its roof is a rectangle exactly as wide as the wall), the right building is REJECTED (trapezoid roof with slanted ends).
- The roof is a RECTANGLE that fills the canvas: its left edge is column 0 from the first roof row to the last row, its right edge is the last column{mirror_edge}. The back (north) edge is a horizontal line at row {r0}, the eave / parapet front is on the last rows. The roof is exactly as wide in its first row as in its last row.
- FORBIDDEN: a trapezoid roof, a roof that narrows toward the top, hip or gable slopes at the ends, visible side walls, vanishing points, isometric diagonals.
- The roof reads as a flat deck seen from above: a parapet rim (lighter on the north and west side, darker on the south and east side), panel seams as straight horizontal and vertical lines, and roof equipment - each piece shows its own small top face and a 2-4 row front face. Equipment stays inside the roof rectangle; only a thin antenna (at most 2 pixels wide) may rise above row {r0}.
- A round roof part (dome, tank, cooling tower) is a clear ELLIPSE seen from above, readable at 1x.
- The last 2-3 rows are the front parapet / eave edge (a lit top line, then a darker face line). Do not draw any wall, window or door. Do not draw ground or sky."""

C_WALL = """== VIEW CONTRACT: the south WALL PIECE of a building in an orthographic 3/4 top view ==
- This canvas is ONLY THE WALL; the roof piece (given at the end as row strings) sits directly above it: your row 0 touches the roof's last row and the wall is exactly as wide as the roof. Continue what comes down from the roof at the same columns.
- The wall is a flat front seen from the south, upright: verticals vertical, horizontals horizontal; no east or west side faces. It fills the canvas width from column 0{mirror_edge2}: no transparent pixels except where the brief says so. Row 0-1 are in the eave's shadow (darker tones of the wall material).
- Windows, panels and signs are few and big enough to read. The door and the base course reach the last row. No ground.
- Light from the upper left: left edges of frames and pipes are lit, right edges and undersides shaded."""

C_MID = """== VIEW CONTRACT: middle storeys of a tower's south wall ==
- This canvas is a band of the flat south wall of a tower, seen from the front, upright. A script stacks copies of it vertically between the roof piece and the ground-floor piece, so it must repeat: row {hm1} continues into row 0 of the next copy (a floor line may sit on the last row).
- It fills the canvas completely from column 0{mirror_edge2}: no transparent pixels. Verticals vertical, horizontals horizontal, no side faces.
- Each storey is 16 rows: a floor band line, then a row of windows (some lit, some dark - make the two storeys differ in which windows are lit), wall panels between them.
- Light from the upper left."""

C_GROUND = """== GROUND TILE CONTRACT (tiles are repeated edge to edge over large areas; a visible seam or a busy pattern is a failed tile) ==
- The canvas holds {n} tiles of 16x16 pixels side by side: tile 1 is columns 0-15, tile 2 is columns 16-31, and so on. A script cuts them apart.
- Fully opaque: every pixel is a colour, no "." anywhere.{overlay_note}
- The tiles are laid at random next to each other in every direction: each tile must join seamlessly with itself and with every other tile of this canvas on all four sides. Give all tiles the same treatment along their four edges (the same colours in the same places), and put what makes a tile different in its inner 12x12 area.
- Seen straight from above. No standing parts, no front faces.
- Calm: 3-4 neighbouring tones of one ramp for the body, details sparse and deliberate. Characters and furniture must read on top of it."""

C_WALLSET = """== WALL SET CONTRACT ==
- Rows 0-15 hold two CEILING-TOP tiles (tile A columns 0-15, tile B columns 16-31): the top of a thick wall seen straight from above. They are repeated over large areas in every direction (the whole map outside the rooms is filled with them), so they must join seamlessly with themselves and with each other on all four sides: same edge treatment on both, calm, fully opaque. A script draws the lit rims where the wall top ends.
- Rows 16-47 hold two WALL FRONT FACE variants, each 16 columns wide and 32 rows tall (variant A columns 0-15, variant B columns 16-31): the south face of that wall seen from the front, standing between the ceiling top (above) and the room floor (below). They are repeated horizontally in any order, so their left and right edges must join with themselves and with each other (horizontal bands run through at the same rows with the same colours). Fully opaque.
- Front face layout: rows 16-17 are the lit top edge of the wall under the ceiling top; then the wall panels; a horizontal accent strip; the last 3 rows (45-47) are the dark base / skirting where the wall meets the floor.
- The front face must be clearly lighter or differently coloured than the ceiling top so the player reads which is which.
- Light from the upper left."""


def main():
    rd = f'{H}/refs'
    refs_rows = {}

    def rowref(title, im, role='structure'):
        im, _ = L.snap(im, L.PAL.ramps_for(role))
        legend, rows = L.png_to_rows(im, L.PAL.ramps_for(role))
        return f'"{title}", {im.width}x{im.height}:\nlegend: {{' + ', '.join(f'"{k}": "{v}"' for k, v in legend.items()) + '}\nrows:\n' + '\n'.join(rows)
    cap1 = ('Four accepted pieces of this chipset (control terminal 16x32, alarm beacon 16x32, supply capsule 32x32, toilet 16x16 source pixels; 6x). '
            'They are the STYLE STANDARD: the tones per material, the edge toning, how much top face a standing object shows above its front face.')
    cap2 = ('The view rule for buildings (another chipset, another palette - take ONLY the view): LEFT building = RIGHT (roof block is a rectangle seen from above, exactly as wide as the wall below, '
            'vertical left and right edges). RIGHT building = REJECTED (trapezoid roof with slanted ends).')
    IMG = {'prop': [('anchors@6x.png', cap1)], 'building': [('anchors@6x.png', cap1), ('roof-right-wrong.png', cap2)], 'ground': [('anchors@6x.png', cap1 + ' For floor tiles take only the palette use and the shading depth.')]}
    cap_im = Image.open(f'{SEL}/sf-supply-capsule.png').convert('RGBA'); term = Image.open(f'{SEL}/sf-terminal.png').convert('RGBA')
    REF = {'prop': rowref('supply capsule (accepted piece, third in picture 1; colours snapped to this palette by a script)', cap_im) + '\n\n' + rowref('control terminal (accepted piece, first in picture 1)', term),
           'small': rowref('control terminal (accepted piece, first in picture 1)', term),
           'ground': rowref('one old floor tile of this chipset (FORMAT example only - it is being replaced; draw better than this)', L.old_piece('deck-plate').crop((0, 0, 16, 16)), 'ground')}
    P = L.PAL
    def pal_of(u):
        names = P.ramps_for(u['role'], u.get('extra', ()))
        out = []
        for sec in ('INK', 'GROUND', 'STRUCTURE', 'ACCENT'):
            ns = [n for n in names if P.ROLE_OF[n] == sec]
            if not ns: continue
            out.append(f' {sec}' + (' (only for lights, screens, signs, markings and glow - a few pixels, never a large surface)' if sec == 'ACCENT' else ''))
            out += [f'  {n}: ' + ' '.join(f'{i}={c}' for i, c in enumerate(P.ALL[n])) + f'   - {P.NOTE[n]}' for n in ns]
        return '\n'.join(out)
    RULE = {'ground': 'GROUND rule: 3-4 neighbouring tones of ONE ramp for a material; joints and grout at most 2 tones darker than the fill (use ink only for a real hole or gap); the floor must recede, not shout.',
            'structure': 'STRUCTURE rule: 4-5 tones of one ramp per material; ink for the darkest edges and deep gaps; ACCENT ramps only for small lights, screens, signs and markings.'}
    hero_cap = 'The PLAYER CHARACTER of this game at 1x (left) and 4x (right), standing on the 16-pixel map grid: sprite frame 24x32, the figure is 16 px wide and 24 px tall. Draw to this scale and for this camera.'
    for k in IMG: IMG[k] = IMG[k] + [('hero-scale.png', hero_cap)]
    objs = []
    for u in U.UNITS:
        cls, w, h, kind = u['cls'], u['w'], u['h'], u['kind']
        px = w * h
        cap = u.get('cap') or int(min(26000, 6500 + px * 6.3))
        half = (f' This canvas is the LEFT (west) HALF of a left-right symmetric picture {w * 2} pixels wide: a script mirrors your {w} columns to make the right half. '
                f'Column {w - 1} is next to the centre line: draw the left half of everything that sits on the centre line touching column {w - 1}. Column 0 is the outer (west) end.') if u.get('mirror') else ''
        cells = ''
        if cls in ('prop', 'flat') and (w > 16 or h > 16):
            cells = f'\n- The canvas is {w // 16} x {h // 16} map cells of 16 pixels. Every cell of the canvas must contain some opaque pixels (the game stores the picture cell by cell).'
        me = ' (the centre line side; the outer edge is column 0)' if u.get('mirror') else ''
        me2 = f' to column {w - 1}' + (' (the centre line)' if u.get('mirror') else '')
        if cls == 'prop': contract, imgs, ref = C_PROP.format(cells=cells), IMG['prop'], REF['prop' if px >= 512 else 'small']
        elif cls == 'flat': contract, imgs, ref = C_FLAT.format(cells=cells), IMG['prop'], REF['small']
        elif cls == 'wallm': contract, imgs, ref = C_WALLM, IMG['prop'], REF['small']
        elif cls == 'bwhole':
            r1 = u['roof'] - 1
            rr = f'The roof takes rows 0-{r1} and the wall takes rows {r1 + 1}-{h - 1}.' if not u.get('round') else u['round']
            contract, imgs, ref = C_BUILDING.format(rows_rule=rr), IMG['building'], REF['prop']
        elif cls == 'roof': contract, imgs, ref = C_ROOF.format(mirror_edge=me, r0=u.get('r0', 0)), IMG['building'], REF['prop']
        elif cls == 'wall': contract, imgs, ref = C_WALL.format(mirror_edge2=me2), IMG['building'], REF['small']
        elif cls == 'mid': contract, imgs, ref = C_MID.format(mirror_edge2=me2, hm1=h - 1), IMG['building'], REF['small']
        elif cls == 'ground':
            ov = ''
            if u.get('overlay'): ov = ' EXCEPTION for this canvas: ' + u['overlay']
            contract, imgs, ref = C_GROUND.format(n=w // 16, overlay_note=ov), IMG['ground'], REF['ground']
        elif cls == 'wallset': contract, imgs, ref = C_WALLSET, IMG['ground'], REF['ground']
        else: raise SystemExit(cls)
        if u.get('contract_extra'): contract += '\n' + u['contract_extra']
        notop = cls in ('ground', 'wallset', 'wall', 'mid', 'flat', 'wallm')
        opaque = cls in ('ground', 'wallset', 'mid') and not u.get('overlay')
        prompt = TEMPLATE.format(cap=cap, rowtok=round(w * 0.8) + 4, imglist='\n'.join(f'- picture {i + 1}: {c}' for i, (_, c) in enumerate(imgs)), name=u['name'], w=w, h=h,
                                 canvas_note=half, kind=kind, kind_rule=KIND[kind], text=u['text'], contract=contract, palette=pal_of(u), refs=ref, heron=len(imgs),
                                 role=u['role'].upper(), role_rule=RULE[u['role']], eg='g_deck:1' if u['role'] == 'ground' else 's_hull:3',
                                 door_ex=' "door": [x, y, w, h],' if u.get('door') else '', door_rule='- "door": the door OPENING you drew (the leaf area the figure walks through, without frame) as [first column, first row, width, height] in canvas pixels.\n' if u.get('door') else '',
                                 top_example='null' if notop else '[first, last]', opaque_note=' This canvas has no transparent pixel.' if opaque else '',
                                 top_rule='null.' if notop else ('first and last row index (0-based, inclusive) of the ROOF seen from above.' if cls in ('bwhole', 'roof') else
                                                                 'first and last row index (0-based, inclusive) of the MAIN top surface seen from above. At least 3 rows, and lighter on average than the front face below it.'))
        open(f'{H}/prompts/{u["id"]}.txt', 'w', encoding='utf-8').write(prompt)
        objs.append(dict(u, cap=cap, images=[f for f, _ in imgs]))
    json.dump({'objects': objs, 'system': SYSTEM}, open(f'{H}/units.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    import collections
    print(len(objs), 'units', dict(collections.Counter(o['cls'] for o in objs)), 'px', sum(o['w'] * o['h'] for o in objs),
          'est $', round(sum(0.045 + o['w'] * o['h'] / 1000 * 0.115 for o in objs), 2), 'worst $', round(sum(o['cap'] * 20e-6 + 0.05 for o in objs), 2))


if __name__ == '__main__':
    main()
