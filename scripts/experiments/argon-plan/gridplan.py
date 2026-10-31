#!/usr/bin/env python3
"""Round 2 grid plan: a cell-grid floor plan with a fixed legend (ceiling / wallface / floor-<mat> / door / window / object:<id> / label).
Shared by arm G (Argon fills an SVG skeleton) and arm J (Argon writes the same rects as JSON cells).
parse_svg / parse_json -> rect list; validate(rects, W, H, cat) -> (grid, errors with English Fixed calls); render(...) -> PNG.
No layout logic: code only checks and draws what the model wrote."""
import re, json
from PIL import Image, ImageDraw, ImageFont

CELL, FACE = 16, 2   # svg px per cell; wall face rows of this chipset

def catalog_footprints(catalog_text):
    """id -> dict(w, h, kind) from the catalog text. kind: floor | face (hangs on the wall face) | against (first floor row under a face) | stairs (3x3 kit over 2 face rows + 1 floor row)."""
    fp = {}
    for line in catalog_text.splitlines():
        m = re.match(r"^([a-z][^|]*?) \| (.+)$", line.strip())
        if not m or line.startswith(("id |", "floor:", "wall:")): continue
        pid, rest = m[1].strip(), m[2]
        if pid.endswith("WxH") or " / " in pid: continue
        kit = re.match(r"KIT (\d+)x(\d+)", rest); wh = re.match(r"(\d+)x(\d+)", rest); wide = re.match(r"(\d+) wide", rest)
        if kit:
            w, h = int(kit[1]), int(kit[2]); kind = "stairs" if "STAIRS UP" in rest else "floor"
        elif wh:
            w, h = int(wh[1]), int(wh[2]); kind = "against" if "stands under a north wall" in rest else "floor"
        elif wide:
            w, h = int(wide[1]), 1; kind = "face"
        else: continue
        fp[pid] = dict(w=w, h=h, kind=kind)
    return fp

SIZED = re.compile(r"^(dining|counter|kcounter|dais|dais-w) (\d+)x(\d+)( (wood|marble|stone))?$")
def footprint(pid, fp):
    if pid in fp: return fp[pid]
    m = SIZED.match(pid)
    if m: return dict(w=int(m[2]), h=int(m[3]), kind="floor")
    return None

def _attrs(tag):
    return {k: v for k, v in re.findall(r'([a-zA-Z_:-]+)\s*=\s*"([^"]*)"', tag)}

def parse_svg(svg):
    """-> (rects in px as dicts {cls, x, y, w, h, raw}, labels [(x_px, y_px, text)])."""
    rects, labels = [], []
    body = re.sub(r'<g[^>]*id="(skeleton|grid|coords)"[^>]*>.*?</g>', "", svg, flags=re.S)
    for tag in re.findall(r"<rect\b[^>]*>", body):
        a = _attrs(tag)
        if "class" not in a: continue
        try: rects.append(dict(cls=a["class"].strip(), x=float(a.get("x", 0)), y=float(a.get("y", 0)), w=float(a.get("width", 0)), h=float(a.get("height", 0)), raw=tag))
        except ValueError: rects.append(dict(cls=a["class"], x=-1, y=-1, w=0, h=0, raw=tag))
    for a, t in re.findall(r"<text\b([^>]*)>(.*?)</text>", body, re.S):
        aa = _attrs(a)
        if aa.get("class") == "coord": continue
        try: labels.append((float(aa.get("x", 0)) / CELL, float(aa.get("y", 0)) / CELL, re.sub(r"<[^>]+>", "", t).strip()))
        except ValueError: pass
    return rects, labels

def parse_json(d):
    rects = [dict(cls=str(c.get("class", "")), x=c.get("x", -1) * CELL if isinstance(c.get("x"), (int, float)) else -1, y=c.get("y", -1) * CELL if isinstance(c.get("y"), (int, float)) else -1,
                  w=(c.get("w") or 0) * CELL, h=(c.get("h") or 0) * CELL, raw=json.dumps(c)) for c in (d.get("cells") or []) if isinstance(c, dict)]
    labels = [(l.get("x", 0), l.get("y", 0), str(l.get("text", ""))) for l in (d.get("labels") or []) if isinstance(l, dict)]
    return rects, labels

def validate(rects, W, H, cat_text, floors, as_json=False, labels=None):
    """Returns (plan, errors). plan = dict(base=[[cls]], objs=[...], windows=[...]). Errors carry exact Fixed calls."""
    fp = catalog_footprints(cat_text); errs = []
    def fixed(cls, x, y, w=1, h=1):
        return (f'{{"class": "{cls}", "x": {x}, "y": {y}, "w": {w}, "h": {h}}}' if as_json
                else f'<rect class="{cls}" x="{x * CELL}" y="{y * CELL}" width="{w * CELL}" height="{h * CELL}"/>')
    base = [[None] * W for _ in range(H)]; objs, wins = [], []
    BASE = {"ceiling", "wallface", "door"}
    for r in rects:
        c = r["cls"]
        x, y, w, h = r["x"] / CELL, r["y"] / CELL, r["w"] / CELL, r["h"] / CELL
        if any(abs(v - round(v)) > 1e-6 for v in (x, y, w, h)) or w < 1 or h < 1:
            sx, sy, sw, sh = (max(0, round(v)) for v in (x, y, w, h))
            errs.append(f"{r['raw'][:120]} is off the cell grid (every x, y, width, height must be a multiple of 16 px = whole cells). Fixed call: {fixed(c, sx, sy, max(1, sw), max(1, sh))}"); continue
        x, y, w, h = int(round(x)), int(round(y)), int(round(w)), int(round(h))
        if x < 0 or y < 0 or x + w > W or y + h > H:
            errs.append(f"{r['raw'][:120]} reaches outside the {W}x{H} map (cells x 0..{W - 1}, y 0..{H - 1}). Fixed call: {fixed(c, max(0, min(x, W - 1)), max(0, min(y, H - 1)), max(1, min(w, W - max(0, x))), max(1, min(h, H - max(0, y))))}"); continue
        if c in BASE or c.startswith("floor-"):
            if c.startswith("floor-") and c[6:] not in floors:
                errs.append(f'class "{c}": unknown floor material. Use floor-<id> with one of: {", ".join(floors)}.'); continue
            for j in range(y, y + h):   # painter's order, as in the picture: a later rect covers an earlier one
                for i in range(x, x + w): base[j][i] = c
        elif c == "window":
            wins.append((x, y, w, h))
        elif c.startswith("object:"):
            pid = c[7:]; f = footprint(pid, fp)
            if not f: errs.append(f'class "{c}": "{pid}" is not a catalog id. Use object:<catalog id> exactly as listed (e.g. "object:armchair", or a sized piece like "object:dining 3x2").'); continue
            if (w, h) != (f["w"], f["h"]):
                errs.append(f'"{pid}" at ({x},{y}) is drawn {w}x{h} cells but its catalog footprint is {f["w"]}x{f["h"]}. Fixed call: {fixed(c, x, y, f["w"], f["h"])}')
                w, h = f["w"], f["h"]
            objs.append(dict(id=pid, x=x, y=y, w=w, h=h, kind=f["kind"]))
        else:
            errs.append(f'{r["raw"][:100]}: unknown class "{c}". Allowed classes: ceiling, wallface, floor-<material>, door, window, object:<catalog id> (and <text class="label"> for labels).')
    at = lambda i, j: base[j][i] if 0 <= i < W and 0 <= j < H else None
    # wallface needs a ceiling run right above it (at most FACE rows); a ceiling with open ground below shows FACE rows of wallface
    for j in range(H):
        for i in range(W):
            if base[j][i] == "wallface":
                k = 1
                while at(i, j - k) == "wallface": k += 1
                if at(i, j - k) != "ceiling":
                    errs.append(f"wallface at ({i},{j}) has no ceiling above it: a wall face is the front of a wall whose top (ceiling) is the cell right above the face rows. Fixed call: {fixed('ceiling', i, j - k)} — or remove this wallface.")
                elif k > FACE:
                    errs.append(f"wallface at ({i},{j}) is {k} rows below its ceiling; a face is exactly {FACE} rows tall. Fixed call: {fixed('floor-' + floors[0], i, j)} (or the room's floor).")
    def runs(cells):   # group cells into horizontal runs (x0, y, length)
        out = []
        for (i, j) in sorted(cells, key=lambda p: (p[1], p[0])):
            if out and out[-1][1] == j and out[-1][0] + out[-1][2] == i: out[-1][2] += 1
            else: out.append([i, j, 1])
        return out
    noface = [(i, j) for j in range(H) for i in range(W) if base[j][i] == "ceiling" and (at(i, j + 1) or "").startswith("floor-")]
    for (i, j, n) in runs(noface)[:12]:
        errs.append(f"ceiling ({i},{j})..({i + n - 1},{j}) has floor right below it: every wall cell shows its face on its south side, so the {FACE} rows under it must be wallface. Fixed call: {fixed('wallface', i, j + 1, n, FACE)}")
    # closed outer loop: from the map edge, outside must not reach any floor
    seen = [[False] * W for _ in range(H)]; stack = [(i, j) for i in range(W) for j in (0, H - 1)] + [(i, j) for j in range(H) for i in (0, W - 1)]
    leaks = []
    while stack:
        i, j = stack.pop()
        if not (0 <= i < W and 0 <= j < H) or seen[j][i]: continue
        b = base[j][i]
        if b in ("ceiling", "wallface", "door"): continue
        seen[j][i] = True
        if b and b.startswith("floor-"): leaks.append((i, j)); continue
        stack += [(i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1)]
    fixc = set()
    for (i, j) in leaks:
        out = [(a, b) for a, b in ((i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1)) if 0 <= a < W and 0 <= b < H and seen[b][a] and base[b][a] is None]
        fixc.add((i, j) if (i in (0, W - 1) or j in (0, H - 1) or not out) else out[0])
    rh = [(i, j, n, 1) for i, j, n in runs(fixc)]; rv = [(i, j, 1, n) for j, i, n in runs({(b, a) for a, b in fixc})]
    for (i, j, w, h) in (rh if len(rh) <= len(rv) else rv)[:8]:
        errs.append(f"the ceiling loop around the building is not closed near ({i},{j}): floor touches the outside there. The outer wall is an unbroken 1-cell ceiling line around all floor (only doors cut it). Fixed call: {fixed('ceiling', i, j, w, h)}")
    # doors must be cut into a wall
    door = {(i, j) for j in range(H) for i in range(W) if base[j][i] == "door"}; done = set()
    for d in sorted(door, key=lambda p: (p[1], p[0])):
        if d in done: continue
        comp, st = set(), [d]
        while st:
            p = st.pop()
            if p in comp or p not in door: continue
            comp.add(p); st += [(p[0] + 1, p[1]), (p[0] - 1, p[1]), (p[0], p[1] + 1), (p[0], p[1] - 1)]
        done |= comp
        top = min(p[1] for p in comp); row = sorted(p[0] for p in comp if p[1] == top)
        horiz = at(row[0] - 1, top) == "ceiling" and at(row[-1] + 1, top) == "ceiling"
        xs = {p[0] for p in comp}; bot = max(p[1] for p in comp)
        k = 1
        while at(row[0], top - k) == "wallface": k += 1
        vcol = len(xs) == 1 and at(row[0] - 1, top) != "ceiling" and at(row[0], bot + 1) == "ceiling" and at(row[0], top - k) == "ceiling"
        vert = vcol and len(comp) == 1 and k - 1 == FACE
        if vcol and not vert and not horiz:
            x0 = row[0]
            errs.append(f"door at ({x0},{top})..({x0},{bot}) is in a vertical wall but not drawn as one: a vertical-wall door is 3 cells of the wall line — 2 wallface (the face of the wall above it) then 1 walkable door cell, with ceiling above and below. Fixed calls: {fixed('wallface', x0, bot - FACE, 1, FACE)} and {fixed('door', x0, bot, 1, 1)}" + (f" and {fixed('ceiling', x0, bot - FACE - 1, 1, 1)}" if at(x0, bot - FACE - 1) != "ceiling" else ""))
            continue
        if not (horiz or vert):
            cands = [(i, j) for j in range(H) for i in range(W) if base[j][i] == "ceiling" and at(i - 1, j) == "ceiling" and at(i + 1, j) == "ceiling"]
            near = min(cands, key=lambda p: abs(p[0] - row[0]) + abs(p[1] - top)) if cands else None
            errs.append(f"door at ({row[0]},{top}) is not cut into a wall: a door replaces wall cells — in a horizontal wall it needs ceiling on both sides of its top row; in a vertical wall it is 1 wide with ceiling below it and the wall's face above it."
                        + (f" Fixed call: {fixed('door', near[0], near[1], 1, 1 + FACE if near[1] + FACE < H - 1 else 1)} (the door through the nearest horizontal wall, ceiling row and its face rows)" if near else ""))
    # objects: on floor (face pieces on wallface), not overlapping
    occ = {}
    for o in objs:
        cells = [(o["x"] + a, o["y"] + b) for b in range(o["h"]) for a in range(o["w"])]
        want = {"face": ("wallface",), "stairs": None}.get(o["kind"])
        for (i, j) in cells:
            b = base[j][i]
            if o["kind"] == "stairs":
                ok = b == "wallface" or (b or "").startswith("floor-")
            elif want: ok = b in want
            else: ok = (b or "").startswith("floor-")
            if not ok:
                hint = "it hangs on a wallface row" if o["kind"] == "face" else "stairs up are a 3x3 kit: its top 2 rows on the 2 wallface rows of a north wall, its bottom row on the first floor row below them" if o["kind"] == "stairs" else "it stands on floor cells (the first floor row under a wall face for against-wall pieces)"
                errs.append(f'"{o["id"]}" at ({o["x"]},{o["y"]}) covers ({i},{j}) which is {b or "outside"}; {hint}. Move it.'); break
            if (i, j) in occ: errs.append(f'"{o["id"]}" at ({o["x"]},{o["y"]}) overlaps "{occ[(i, j)]}" at ({i},{j}). Move one of them.'); break
        for c in cells: occ.setdefault(c, o["id"])
        if o["kind"] == "against" and at(o["x"], o["y"] - 1) != "wallface":
            errs.append(f'"{o["id"]}" at ({o["x"]},{o["y"]}) is an against-wall piece: its top row must be right under a wallface row (the cell above it, ({o["x"]},{o["y"] - 1}), is {at(o["x"], o["y"] - 1) or "outside"}).')
    for (x, y, w, h) in wins:
        if any(at(i, j) != "wallface" for i in range(x, x + w) for j in range(y, y + h)):
            errs.append(f"window at ({x},{y}) is not on a wallface row: windows hang on the face of a wall. Fixed call: draw it on the wallface cell right under a ceiling of the outer wall.")
    # outer doors: only the entrance, on the bottom row
    for (i, j) in sorted(door):
        if j != H - 1 and any(0 <= a < W and 0 <= b < H and seen[b][a] or not (0 <= a < W and 0 <= b < H) for a, b in ((i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1))):
            errs.append(f"door at ({i},{j}) opens the outer wall to the outside: the only opening in the outer wall is the entrance on the bottom row y={H - 1}. Fixed call: {fixed('ceiling', i, j)}")
    # rooms (floor areas closed by ceiling, wallface and doors) must be furnished in the plan
    comp_of, comps = {}, []
    for j in range(H):
        for i in range(W):
            if (base[j][i] or "").startswith("floor-") and (i, j) not in comp_of and not seen[j][i]:
                k = len(comps); comps.append([]); st = [(i, j)]
                while st:
                    a, b = st.pop()
                    if (a, b) in comp_of or not (0 <= a < W and 0 <= b < H) or not (base[b][a] or "").startswith("floor-"): continue
                    comp_of[(a, b)] = k; comps[k].append((a, b)); st += [(a + 1, b), (a - 1, b), (a, b + 1), (a, b - 1)]
    lab = {(int(x), int(y)): t for x, y, t in (labels or [])}
    for k, cells in enumerate(comps):
        if len(cells) < 6: continue
        cs = set(cells); n = sum(1 for o in objs if any((o["x"] + a, o["y"] + b) in cs or (o["x"] + a, o["y"] + b + 1) in cs for a in range(o["w"]) for b in range(o["h"])))
        if n < 2:
            x0, y0 = min(cells, key=lambda p: (p[1], p[0])); name = next((t for (x, y), t in lab.items() if (x, y) in cs), None)
            errs.append(f"the room at ({x0},{y0}){' (' + name + ')' if name else ''} has {n} pieces: the plan shows each room furnished for its purpose. Add its furniture as object:<catalog id> boxes (several distinct pieces).")
    if not door: errs.append(f"no door: the entrance is a door cell in the outer ceiling line on the bottom row y={H - 1}.")
    return dict(base=base, objs=objs, windows=wins), errs[:40]

FLOORCOL = {"plank": (176, 132, 84), "boards": (150, 112, 74), "dplank": (110, 74, 50), "hobbit": (196, 150, 80), "flag": (130, 130, 136), "ktile": (210, 210, 200), "terra": (176, 90, 66),
            "rush": (170, 160, 100), "straw": (200, 180, 110), "marble": (220, 220, 225), "carpet": (140, 60, 70), "stone": (120, 116, 110), "dirt": (120, 96, 70)}
def render(plan, labels, W, H, out, C=32):
    try: F = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 10); FB = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 11)
    except Exception: F = FB = ImageFont.load_default()
    M = 20; im = Image.new("RGB", (W * C + M, H * C + M), (18, 18, 22)); d = ImageDraw.Draw(im, "RGBA")
    for j in range(H):
        for i in range(W):
            b = plan["base"][j][i]; bx = [M + i * C, M + j * C, M + i * C + C - 1, M + j * C + C - 1]
            if b == "ceiling": d.rectangle(bx, fill=(40, 40, 48))
            elif b == "wallface": d.rectangle(bx, fill=(120, 96, 80))
            elif b == "door": d.rectangle(bx, fill=(90, 230, 110))
            elif b and b.startswith("floor-"):
                m = b[6:]; d.rectangle(bx, fill=FLOORCOL.get(m, (150 + hash(m) % 60, 140, 120)))
    for (x, y, w, h) in plan["windows"]: d.rectangle([M + x * C + 4, M + y * C + 6, M + (x + w) * C - 5, M + (y + h) * C - 7], fill=(150, 210, 255))
    for o in plan["objs"]:
        wall = o["kind"] in ("face", "against", "stairs")
        d.rectangle([M + o["x"] * C + 1, M + o["y"] * C + 1, M + (o["x"] + o["w"]) * C - 2, M + (o["y"] + o["h"]) * C - 2], fill=(255, 190, 60, 150) if wall else (90, 170, 255, 140), outline=(255, 220, 120) if wall else (170, 215, 255), width=2)
        d.text((M + o["x"] * C + 3, M + o["y"] * C + 3), o["id"][:max(5, o["w"] * 5)], fill=(255, 255, 255), font=F)
    for (x, y, t) in labels: d.text((M + x * C, M + y * C - 12), t[:30], fill=(255, 240, 150), font=FB)
    for gx in range(W + 1): d.line([(M + gx * C, M), (M + gx * C, M + H * C)], fill=(255, 255, 255, 30))
    for gy in range(H + 1): d.line([(M, M + gy * C), (M + W * C, M + gy * C)], fill=(255, 255, 255, 30))
    for i in range(W): d.text((M + i * C + 9, 4), str(i), fill=(160, 160, 170), font=F)
    for j in range(H): d.text((2, M + j * C + 10), str(j), fill=(160, 160, 170), font=F)
    im.save(out)

def skeleton(W, H):
    g = "".join(f'<line x1="{i * CELL}" y1="0" x2="{i * CELL}" y2="{H * CELL}"/>' for i in range(W + 1)) + "".join(f'<line x1="0" y1="{j * CELL}" x2="{W * CELL}" y2="{j * CELL}"/>' for j in range(H + 1))
    co = "".join(f'<text class="coord" x="{i * CELL + 4}" y="-4">{i}</text>' for i in range(W)) + "".join(f'<text class="coord" x="-14" y="{j * CELL + 12}">{j}</text>' for j in range(H))
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W * CELL + 16}" height="{H * CELL + 16}" viewBox="-16 -16 {W * CELL + 16} {H * CELL + 16}">\n'
            f'<g id="grid" stroke="#333" stroke-width="0.5">{g}</g>\n<g id="coords" font-size="7" fill="#999">{co}</g>\n<g id="plan">\n  <!-- add your <rect class="..."/> and <text class="label"> elements here -->\n</g>\n</svg>')
