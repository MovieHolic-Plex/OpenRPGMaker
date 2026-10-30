#!/usr/bin/env python3
"""bbox-chipsets: English catalog text + labelled palette image for one place, from catalog.mts output.
  python3 catalog.py <place> <raw pieces.json> <out dir>      (run from the worktree root)
Korean names/descriptions in the chipset metadata are translated once per chipset by gpt-6.1-terra and cached in <out dir>/en-<tileset>.json."""
import json, os, sys, re, urllib.request, time
from PIL import Image, ImageDraw, ImageFont
place, raw, outd = sys.argv[1:4]
D = json.load(open(raw)); ts = D["tileset"]
OCX = "http://127.0.0.1:10200/v1/chat/completions"
cache_f = f"{outd}/en-{ts}.json"
EN = json.load(open(cache_f)) if os.path.exists(cache_f) else {}
HANGUL = re.compile(r"[가-힣぀-ヿ一-鿿]")
def want(key, text):
    return key not in EN and HANGUL.search(text or "")
todo = {}
for o in D["objects"]:
    t = f"{o['ko']} — {o['desc'][:160]}" + (f" | placement: {o['place'][:120]}" if o["place"] else "")
    if want("o:" + o["id"], t): todo["o:" + o["id"]] = t
for k in ("floors", "walls", "tables", "lines", "daises"):
    for f in D[k]:
        if want(f"{k[0]}:{f['id']}", f["ko"]): todo[f"{k[0]}:{f['id']}"] = f["ko"]
for g in D.get("grounds", []):
    if want("g:" + g["id"], g["ko"]): todo["g:" + g["id"]] = g["ko"]
for k, v in D["rooms"].items():
    if want("r:" + k, v["ko"]): todo["r:" + k] = v["ko"] + " / " + ", ".join(v["alias"])
if todo:
    items = list(todo.items())
    for i in range(0, len(items), 80):
        chunk = dict(items[i:i + 80])
        prompt = ("Translate these tileset piece notes (Korean/Japanese) into short plain English for a level designer. Keep facts (size, look, where it goes). "
                  "Object entries: one line, at most 25 words: name, then the key look/placement facts. Floor/wall/table entries: 1-5 words. "
                  "Return one JSON object with the same keys and English strings only.\n" + json.dumps(chunk, ensure_ascii=False))
        body = json.dumps({"model": "gpt-6.1-terra", "messages": [{"role": "user", "content": prompt}], "reasoning_effort": "low"}).encode()
        for a in range(3):
            try:
                with urllib.request.urlopen(urllib.request.Request(OCX, body, {"content-type": "application/json"}), timeout=600) as r: d = json.load(r)
                txt = d["choices"][0]["message"]["content"]; EN.update(json.loads(re.search(r"\{.*\}", txt, re.S).group(0))); break
            except Exception as e:
                print("translate retry", e, flush=True); time.sleep(10)
    json.dump(EN, open(cache_f, "w"), ensure_ascii=False, indent=1)
en = lambda k, fb: re.sub(HANGUL, "", EN.get(k, fb)).strip() or fb
RULE = {"floor": "floor (stands on floor cells, blocks walking)",
        "wall": "against-wall (first floor row right under a north wall face)",
        "hang": "wall-mounted (on the UPPER wall-face row, i.e. the region's top row y)",
        "flat": "floor decal (walkable, may lie under furniture)",
        "door": "door: x,y = a 1-cell opening in a HORIZONTAL solid wall (solid left and right, a room above, floor for two rows below)",
        "sidedoor": "side door: x,y = the bottom (walkable) cell of a 3-cell-tall opening in a VERTICAL solid wall"}
OUT = D.get("mode") == "outdoor"
L = [f"# Tileset catalog — {place} (chipset {ts}, 16px cells). The attached sheet shows every piece and the floor/wall swatches, labelled with exact ids, on a 16px grid.",
     "id | footprint w x h cells | placement rule | what it is"]
if OUT:
    L = [f"# Tileset catalog — {place} (chipset {ts}, 16px cells, OUTDOOR). The attached sheet shows every piece and ground swatch, labelled with exact ids, on a 16px grid.",
         "Pieces are stamped whole: x,y = the top-left cell of the piece's art box. 'cells' gives the art box row by row, top to bottom: X = blocks walking, o = drawn but walkable (roof/canopy you walk behind, or flat ground art), . = not drawn (keeps the ground under it).",
         "id | art box w x h | cells | role | what it is"]
    for o in D["objects"]: L.append(f"{o['id']} | {o['w']}x{o['h']} | {'/'.join(o['grid'])} | {o['role']} | {en('o:' + o['id'], o['id'])}")
    L += ["", "# Grounds (map 'base' and 'grounds' rect ids; edges of autotile grounds are drawn automatically)"]
    L += [f"{g['id']} | {'walkable' if g['walk'] else 'NOT walkable (water)'}{' | autotile edges' if g['autotile'] else ''} | {en('g:' + g['id'], g['id'])}" for g in D["grounds"]]
for o in ([] if OUT else D["objects"]):
    rule = RULE[o["kind"]]
    if o["kind"] == "floor" and o["h"] == 0: rule = "no footprint: an overlay drawn with its top-left art cell at x,y over whatever is there (tabletop item on a table/bench top cell, or an item on a wall face)"
    if o["stairs"] == "up" and o["kind"] == "wall": rule = "stairs up: against-wall at the north wall (first floor row), climbs into the wall"
    elif o["stairs"]: rule += f"; stairs ({o['stairs']}) — keep its open (south) side free"
    tall = f" (art {o['up'] // 16} row(s) taller, drawn upward)" if o["up"] >= 16 else ""
    fp = f"{o['w']}x1 on the wall face" if o["kind"] == "hang" else ("overlay" if o["h"] == 0 and o["kind"] == "floor" else f"{o['w']}x{o['h']}{tall}")
    if o["kind"] in ("door", "sidedoor", "flat") and o["h"] == 0: fp = "1 cell"
    L.append(f"{o['id']} | {fp} | {rule} | {en('o:' + o['id'], o['id'])}")
if not OUT: L += ["", "# Floors (region 'floor' id) — " + "; ".join(f"{f['id']} = {en('f:' + f['id'], f['id'])}" for f in D["floors"]),
      "# Walls (region 'wall' id) — " + "; ".join(f"{f['id']} = {en('w:' + f['id'], f['id'])}" for f in D["walls"])]
if D["tables"]:
    L += ["", "# Sized pieces (any size: put them in 'objects' with the size in the id, e.g. '<id> 3x2'; one-row ones only Wx1)"]
    L += [f"{t['id']} WxH | {'W x 1 only' if t['oneRow'] else 'any W x H'} | floor | {en('t:' + t['id'], t['id'])}" for t in D["tables"]]
if D["lines"]: L.append(" / ".join(l["id"] for l in D["lines"]) + " | any W x H rect | decor | walkable carpet in 'carpets'")
if D["daises"]: L.append(" / ".join(d["id"] for d in D["daises"]) + " | any W x H | walkable raised platform in 'daises'")
open(f"{outd}/catalog-{place}.txt", "w").write("\n".join(L) + "\n")
# ---- palette image: native pixels x2, id under each piece
sheet = Image.open(D["sheet"]).convert("RGBA"); T = D["tileSize"]; TPR = sheet.width // T; K = 2
def tile(n):
    return sheet.crop(((n % TPR) * T, (n // TPR) * T, (n % TPR) * T + T, (n // TPR) * T + T))
try: F = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 11)
except Exception: F = ImageFont.load_default()
cards = []
def card(label, cells):   # cells: (dx, dy, tile, layer)
    xs = [c[0] for c in cells]; ys = [c[1] for c in cells]; x0, y0 = min(xs), min(ys)
    w, h = (max(xs) - x0 + 1) * T, (max(ys) - y0 + 1) * T
    im = Image.new("RGBA", (w, h), (60, 60, 70, 255))
    for c in sorted(cells, key=lambda c: c[3]):
        if c[2] >= 0: t = tile(c[2]); im.alpha_composite(t, ((c[0] - x0) * T, (c[1] - y0) * T))
    im = im.resize((w * K, h * K), Image.NEAREST)
    tw = int(F.getlength(label)) + 4
    cv = Image.new("RGBA", (max(im.width, tw), im.height + 14), (30, 30, 36, 255)); cv.alpha_composite(im, (0, 0))
    ImageDraw.Draw(cv).text((2, im.height + 1), label, fill=(255, 255, 255), font=F)
    cards.append(cv)
for g in D.get("grounds", []):
    card("ground:" + g["id"], [(x, y, g["tiles"][(y * 2 + x) % len(g["tiles"])] if not g["autotile"] else g["tiles"][0], 1) for y in range(2) for x in range(2)])
for f in D["floors"]:
    card("floor:" + f["id"], [(x, y, f["tiles"][((y % f["rows"]) * f["cols"] + x % f["cols"]) * 4], 1) for y in range(2) for x in range(2)])
for w in D["walls"]:
    c = min(4, w["cols"]); card("wall:" + w["id"], [(x, r, w["tiles"][(r * w["cols"] + x % w["cols"]) * 2], 1) for r in range(2) for x in range(max(2, c))])
for o in D["objects"]: card(o["id"], [tuple(c) for c in o["cells"]])
WMAX = 1500; x = y = rowh = 0; pos = []
for c in cards:
    if x + c.width > WMAX: x = 0; y += rowh + 8; rowh = 0
    pos.append((x, y)); x += c.width + 10; rowh = max(rowh, c.height)
out = Image.new("RGBA", (WMAX, y + rowh + 4), (30, 30, 36, 255))
for c, p in zip(cards, pos): out.alpha_composite(c, p)
out.save(f"{outd}/palette-{place}.png")
print(place, len(D["objects"]), "objects;", len(todo), "translated;", out.size)
