"""bbox-chipsets round 4 (sketch arm): the model draws the floor plan as a character grid first; this code turns it into the
same layout JSON lay.mts executes (regions = rectangles cut from each room's cells, openings = door cells, entrance = the bottom-row door).

Sketch characters (one per 16px cell, rows = map height, every row = map width):
  '#' solid wall / void      'D' door or opening      'A'..'Z' (not D) = a room's cells (the room is declared in "rooms")
  'c' column, '=' half-wall/counter/railing (a 1x1 standing piece mapped in "symbols"), '^' dais cells (a dais id in "symbols")
c / = / ^ cells are floor of the room around them.

to_layout(sketch_rows, J) -> (layout, errors, info)   errors are English, for the Fixed call.
required_check(J, asks, layout, index_pieces, nudged) -> (errors, notes)"""
import re

def _rects(cells):
    """greedy row-major rectangle cover of a cell set {(x,y)} → [(x,y,w,h)]"""
    left = set(cells); out = []
    for (x, y) in sorted(cells, key=lambda c: (c[1], c[0])):
        if (x, y) not in left: continue
        w = 1
        while (x + w, y) in left: w += 1
        h = 1
        while all((x + i, y + h) in left for i in range(w)): h += 1
        for j in range(h):
            for i in range(w): left.discard((x + i, y + j))
        out.append((x, y, w, h))
    return out

def to_layout(rows, J):
    errors, info = [], {}
    rows = [r.rstrip("\n") for r in rows if r.strip()]
    if not rows: return None, ["The plan sketch is missing: start your answer with a ```plan block (the character grid), then a ```json block."], info
    W, H = max(len(r) for r in rows), len(rows)
    ragged = [(i, len(r)) for i, r in enumerate(rows) if len(r) != W]
    if ragged: errors.append(f"plan: rows have different lengths — every row must be exactly the map width {W}; ragged rows (row: length): " + ", ".join(f"{i}: {n}" for i, n in ragged[:12]) + ". Pad with '#'.")
    g = [list(r.ljust(W, "#")) for r in rows]
    bad = sorted({ch for r in g for ch in r if not (ch in "#Dc=^" or ("A" <= ch <= "Z"))})
    if bad: errors.append(f"plan: unknown characters {bad} — use only '#', 'D', room letters A-Z (not D), 'c', '=', '^'.")
    at = lambda x, y: g[y][x] if 0 <= x < W and 0 <= y < H else "#"
    room = lambda ch: ("A" <= ch <= "Z" and ch != "D") or ch in "c=^"
    rooms = J.get("rooms") if isinstance(J.get("rooms"), dict) else {}
    syms = J.get("symbols") if isinstance(J.get("symbols"), dict) else {}
    # border: closed except one entrance door on the bottom row
    for x in range(W):
        if at(x, 0) != "#": errors.append(f"plan: the top row must be all '#' (cell ({x},0) is '{at(x, 0)}').")
    for y in range(H):
        for x in (0, W - 1):
            if at(x, y) != "#": errors.append(f"plan: the walls are not closed — the left and right map columns must be '#' (cell ({x},{y}) is '{at(x, y)}').")
    ent = [x for x in range(W) if at(x, H - 1) == "D"]
    other = [x for x in range(W) if at(x, H - 1) not in "#D"]
    if other: errors.append(f"plan: the walls are not closed — the bottom row must be '#' except the one entrance 'D' (open cells at x={other[:8]}).")
    if len(ent) != 1: errors.append(f"plan: put exactly one entrance 'D' on the bottom row (found {len(ent)}).")
    elif not room(at(ent[0], H - 2)): errors.append(f"plan: the entrance 'D' at ({ent[0]},{H - 1}) must sit directly below a room cell (({ent[0]},{H - 2}) is '{at(ent[0], H - 2)}').")
    # doors: in a wall. Horizontal wall: '#' left and right, room/door above and below. Vertical wall: room left and right, a run of 3 'D' stacked.
    openings = []
    for y in range(H - 1):
        for x in range(W):
            if at(x, y) != "D": continue
            l, r, u, d = at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)
            if l == "#" and r == "#" and u != "#" and d != "#": openings.append((x, y)); continue
            if l != "#" and r != "#":
                top = y
                while at(x, top - 1) == "D": top -= 1
                bot = y
                while at(x, bot + 1) == "D": bot += 1
                if bot - top + 1 >= 3: openings.append((x, y)); continue
                if y == top: errors.append(f"plan: door at ({x},{y}) is in a vertical wall (rooms left and right) but only {bot - top + 1} 'D' tall — a door in a vertical wall is 3 'D' stacked (the top two become wall face, the bottom one is the passage).")
                continue
            errors.append(f"plan: door 'D' at ({x},{y}) is not in a wall — a door goes in a 1-cell-thick wall: '#' left and right with rooms above and below, or rooms left and right with 3 'D' stacked.")
    # rooms: each letter declared; cells → rectangles
    cells = {}
    for y in range(H):
        for x in range(W):
            ch = at(x, y)
            if "A" <= ch <= "Z" and ch != "D": cells.setdefault(ch, set()).add((x, y))
    for y in range(H):   # structure symbols belong to the room most of their neighbours belong to
        for x in range(W):
            ch = at(x, y)
            if ch in "c=^":
                near = [at(x + dx, y + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1)]
                near = [n for n in near if "A" <= n <= "Z" and n != "D"]
                if not near: errors.append(f"plan: '{ch}' at ({x},{y}) is not inside a room."); continue
                cells[max(set(near), key=near.count)].add((x, y))
    for ch in sorted(cells):
        if ch not in rooms: errors.append(f"plan: room letter '{ch}' is not declared in \"rooms\" — add \"{ch}\": {{\"id\", \"floor\", \"wall\", \"purpose\"}}.")
    for ch in rooms:
        if ch not in cells: errors.append(f"rooms: \"{ch}\" is declared but its letter is not in the plan.")
    regions, regionRoom = [], {}
    for ch, cs in sorted(cells.items()):
        R = rooms.get(ch) or {}
        rs = _rects(cs)
        if R.get("floor") == "tatami" and len(rs) != 1: errors.append(f"plan: room '{ch}' ({R.get('id')}) has a tatami floor, so its cells must form one rectangle (code lays whole mats); it is {len(rs)} rectangles.")
        for i, (x, y, w, h) in enumerate(rs):
            reg = {"id": (R.get("id") or ch) + (f"-{i + 1}" if i else ""), "x": x, "y": y, "w": w, "h": h, "floor": R.get("floor"), "wall": R.get("wall"), "purpose": R.get("purpose", "")}
            if R.get("jo") is not None and len(rs) == 1: reg["jo"] = R["jo"]
            regions.append(reg); regionRoom[reg["id"]] = R.get("id") or ch
    # symbols → pieces / daises
    objs, daises = [], []
    for s in "c=":
        pts = [(x, y) for y in range(H) for x in range(W) if at(x, y) == s]
        if pts and not syms.get(s): errors.append(f"symbols: the plan uses '{s}' but \"symbols\" has no \"{s}\": \"<1x1 catalog piece id>\" (a {'column / pillar' if s == 'c' else 'half-wall, counter, railing or planter'} piece).")
        elif pts: objs += [{"id": syms[s], "x": x, "y": y, "purpose": "plan " + s} for x, y in pts]
    dp = {(x, y) for y in range(H) for x in range(W) if at(x, y) == "^"}
    if dp and not syms.get("^"): errors.append("symbols: the plan uses '^' but \"symbols\" has no \"^\": \"<dais id>\".")
    elif dp:
        for (x, y, w, h) in _rects(dp): daises.append({"id": syms["^"], "x": x, "y": y, "w": w, "h": h})
    info = {"w": W, "h": H, "rooms": len(cells), "structCells": {s: sum(r.count(s) for r in rows) for s in "c=^"}, "doors": len(openings)}
    layout = {"map": {"w": W, "h": H}, "regions": regions, "openings": [{"x": x, "y": y, "w": 1, "h": 1} for x, y in openings],
              "entrance": {"x": ent[0], "y": H - 1} if len(ent) == 1 else None, "landmark": J.get("landmark"),
              "carpets": J.get("carpets") or [], "daises": (J.get("daises") or []) + daises, "objects": (J.get("objects") or []) + objs,
              "plan": ["".join(r) for r in g], "rooms": rooms, "symbols": syms, "required": J.get("required"), "regionRoom": regionRoom}
    return layout, errors, info

STOP = set("a an the of for with and or in on at to from by as is are be where which who that this those these each".split())
def _words(s): return [w for w in re.findall(r"[a-z]+", (s or "").lower()) if w not in STOP and len(w) > 2]

def required_check(J, asks, layout, pieces, nudged):
    """every ask must be covered by placed ids (that exist in the layout) or a 'missing' note. A 'missing' claim is refused once when
    the chipset index has pieces whose text holds the ask's words (the model is pointed at them)."""
    errors, notes = [], []
    req = J.get("required") if isinstance(J.get("required"), list) else []
    placed = set()
    for o in [layout.get("landmark") or {}] + (layout.get("objects") or []):
        if isinstance(o, dict) and isinstance(o.get("id"), str): placed.add(o["id"]); placed.add(o["id"].split(" ")[0])
    by = {}
    for r in req:
        if isinstance(r, dict) and isinstance(r.get("ask"), str): by[r["ask"].strip().lower()] = r
    for a in asks:
        r = by.get(a.lower())
        if not r: errors.append(f"required: \"{a}\" is not in your \"required\" list — add {{\"ask\": \"{a}\", \"ids\": [ids you placed for it]}} (or \"missing\": \"why no piece fits\")."); continue
        ids = [i for i in (r.get("ids") or []) if isinstance(i, str)]
        if ids:
            nope = [i for i in ids if i not in placed]
            if nope: errors.append(f"required: \"{a}\" lists {nope} but they are not placed in \"objects\" — place them, sized and positioned for this use.")
            continue
        if r.get("missing"):
            words = _words(a)
            hits = [p for p in pieces if any(w in p["text"] for w in words if len(w) > 3)]
            if hits and a not in nudged:
                nudged.add(a)
                errors.append(f"required: \"{a}\" is marked missing, but the chipset has pieces matching it (e.g. {', '.join(p['id'] for p in hits[:6])}) — look at them with find_pieces and place a fitting one, or say why none of them fits.")
            else: notes.append(f"{a}: {r['missing']}")
            continue
        errors.append(f"required: \"{a}\" has neither \"ids\" nor \"missing\".")
    return errors, notes

def box_rooms(layout):
    """plan-level box test, same for both arms: open spaces = 4-connected unions of region cells (door cells are outside regions).
    A space is a box when its cells fill >= 90% of its bounding box and it holds no dais / column / half-wall cell.
    Returns (boxes, spaces)."""
    cells = set()
    for r in layout.get("regions") or []:
        for y in range(r["y"], r["y"] + r["h"]):
            for x in range(r["x"], r["x"] + r["w"]): cells.add((x, y))
    struct = set()
    for d in layout.get("daises") or []:
        for y in range(d["y"], d["y"] + d["h"]):
            for x in range(d["x"], d["x"] + d["w"]): struct.add((x, y))
    for y, row in enumerate(layout.get("plan") or []):
        for x, ch in enumerate(row):
            if ch in "c=^": struct.add((x, y))
    seen, boxes, spaces = set(), 0, 0
    for c in sorted(cells):
        if c in seen: continue
        comp, st = [], [c]; seen.add(c)
        while st:
            x, y = st.pop(); comp.append((x, y))
            for n in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if n in cells and n not in seen: seen.add(n); st.append(n)
        xs = [p[0] for p in comp]; ys = [p[1] for p in comp]
        bb = (max(xs) - min(xs) + 1) * (max(ys) - min(ys) + 1)
        spaces += 1
        if len(comp) >= 0.9 * bb and not any(p in struct for p in comp): boxes += 1
    return boxes, spaces
