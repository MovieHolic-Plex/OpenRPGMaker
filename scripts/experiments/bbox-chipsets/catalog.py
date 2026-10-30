#!/usr/bin/env python3
"""bbox-chipsets: English catalog text + labelled palette image + lookup index for one place, from catalog.mts / outdoor_catalog.mts output.
  python3 catalog.py <place> <raw pieces.json> <out dir>      (run from the worktree root)
Round 2 (smarter catalog for big chipsets — jp_city 781 / modern_city 493 pieces):
  - every category is listed with its piece count and 3 sample ids;
  - the ~12 categories most relevant to the request ("featured": example-table use + search hits + object-pool pieces) get up to 6
    representative pieces each, with full lines and a picture band in the palette;
  - <out>/index-<place>.json holds ALL pieces (line, category, search text, cells) for the find_pieces(category, tags) lookup in run.py.
Korean/Japanese names are translated once per chipset by gpt-6.1-terra (cached in <out dir>/en-<tileset>.json)."""
import json, os, sys, re, urllib.request, time
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cards import Sheet, pack
place, raw, outd = sys.argv[1:4]
D = json.load(open(raw)); ts = D["tileset"]; OUT = D.get("mode") == "outdoor"
OCX = "http://127.0.0.1:10200/v1/chat/completions"
cache_f = f"{outd}/en-{ts}.json"
EN = json.load(open(cache_f)) if os.path.exists(cache_f) else {}
HANGUL = re.compile(r"[가-힣぀-ヿ一-鿿]")
want = lambda key, text: key not in EN and HANGUL.search(text or "")
todo = {}
for o in D["objects"]:
    t = f"{o['ko']} — {o['desc'][:160]}" + (f" | placement: {o['place'][:120]}" if o["place"] else "")
    if want("o:" + o["id"], t): todo["o:" + o["id"]] = t
    if want("c:" + o["cat"], o["catKo"]): todo["c:" + o["cat"]] = o["catKo"]
for k in ("floors", "walls", "tables", "lines", "daises"):
    for f in D[k]:
        if want(f"{k[0]}:{f['id']}", f["ko"]): todo[f"{k[0]}:{f['id']}"] = f["ko"]
for g in D.get("grounds", []):
    if want("g:" + g["id"], g["ko"]): todo["g:" + g["id"]] = g["ko"]
for k, v in D["rooms"].items():
    if want("r:" + k, v["ko"]): todo["r:" + k] = v["ko"] + " / " + ", ".join(v["alias"])
def tr(chunk):
    prompt = ("Translate these tileset piece notes (Korean/Japanese) into short plain English for a level designer. Keep facts (size, look, where it goes). "
              "Object entries (o:): one line, at most 25 words: name, then the key look/placement facts. Category entries (c:): 1-4 words. Floor/wall/table entries: 1-5 words. "
              "Return one JSON object with the same keys and English strings only.\n" + json.dumps(chunk, ensure_ascii=False))
    body = json.dumps({"model": "gpt-6.1-terra", "messages": [{"role": "user", "content": prompt}], "reasoning_effort": "low"}).encode()
    for a in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(OCX, body, {"content-type": "application/json"}), timeout=900) as r: d = json.load(r)
            return json.loads(re.search(r"\{.*\}", d["choices"][0]["message"]["content"], re.S).group(0))
        except Exception as e:
            print("translate retry", e, flush=True); time.sleep(10)
    return {}
if todo:
    items = list(todo.items()); chunks = [dict(items[i:i + 60]) for i in range(0, len(items), 60)]
    with ThreadPoolExecutor(8) as ex:
        for r in ex.map(tr, chunks): EN.update(r)
    json.dump(EN, open(cache_f, "w"), ensure_ascii=False, indent=1)
en = lambda k, fb: re.sub(HANGUL, "", EN.get(k, fb)).strip() or fb
RULE = {"floor": "floor (stands on floor cells, blocks walking)",
        "wall": "against-wall (first floor row right under a north wall face)",
        "hang": "wall-mounted (on the UPPER wall-face row, i.e. the region's top row y)",
        "flat": "floor decal (walkable, may lie under furniture)",
        "door": "door: x,y = a 1-cell opening in a HORIZONTAL solid wall (solid left and right, a room above, floor for two rows below)",
        "sidedoor": "side door: x,y = the bottom (walkable) cell of a 3-cell-tall opening in a VERTICAL solid wall"}
def line(o):
    what = en("o:" + o["id"], o["ko"]) if not o.get("pool") else f"{o['ko']} — {o['desc'][:140]} (NEW piece)"
    if OUT: return f"{o['id']} | {o['w']}x{o['h']} | {'/'.join(o['grid'])} | {o['role']} | {what}"
    rule = RULE[o["kind"]]
    if o["kind"] == "floor" and o["h"] == 0: rule = "no footprint: an overlay drawn with its top-left art cell at x,y over whatever is there (tabletop item on a table/bench top cell, or an item on a wall face)"
    if o["stairs"] == "up" and o["kind"] == "wall": rule = "stairs up: against-wall at the north wall (first floor row), climbs into the wall"
    elif o["stairs"]: rule += f"; stairs ({o['stairs']}) — keep its open (south) side free"
    tall = f" (art {o['up'] // 16} row(s) taller, drawn upward)" if o["up"] >= 16 else ""
    fp = f"{o['w']}x1 on the wall face" if o["kind"] == "hang" else ("overlay" if o["h"] == 0 and o["kind"] == "floor" else f"{o['w']}x{o['h']}{tall}")
    if o["kind"] in ("door", "sidedoor", "flat") and o["h"] == 0: fp = "1 cell"
    return f"{o['id']} | {fp} | {rule} | {what}"
# ---- categories
cats = {}
for o in D["objects"]: cats.setdefault(o["cat"], []).append(o)
if len(cats) > 40:   # many 1-2 piece categories (joseon_baram props: well, jars, millstone...) → one "<role>-other" group each
    for c in [c for c in cats if len(cats[c]) < 3]:
        k = (c.split("-")[0] + "-other") if "-" in c else "other"
        for o in cats.pop(c): o["cat"] = k; o["catKo"] = (o["catKo"] + " (misc)") if not o["catKo"].endswith("(misc)") else o["catKo"]; cats.setdefault(k, []).append(o)
def cname(c): return (en("c:" + c, cats[c][0]["catKo"]) if not c.endswith("other") else "Miscellaneous " + (c.split("-")[0] + "s" if "-" in c else "pieces")) or c
def cscore(c): s = sorted((o["score"] for o in cats[c]), reverse=True); return sum(s[:10])
def reps(c, n):
    ms = sorted(cats[c], key=lambda o: (-o["score"], -(o["w"] * max(1, o["h"])), o["id"]))
    out, kinds = [], set()
    for o in ms:                                # prefer one of each kind first (floor / against-wall / wall-mounted / decal)
        if o["kind"] not in kinds: out.append(o); kinds.add(o["kind"])
        if len(out) >= n: break
    for o in ms:
        if len(out) >= n: break
        if o not in out: out.append(o)
    return out
order = sorted(cats, key=lambda c: (-cscore(c), c))
NFEAT = 14
feat, per = [], {}
for c in order:                                  # at most a third of the featured slots from one role (joseon: 7 wall families crowded out the yard props)
    r = c.split("-")[0] if "-" in c else c
    if cscore(c) <= 0 or len(feat) >= NFEAT or per.get(r, 0) >= max(3, NFEAT // 3): continue
    feat.append(c); per[r] = per.get(r, 0) + 1
for c in order:                                  # object-pool categories are always featured (made for these places)
    if c.startswith("new-") and c not in feat: feat.append(c)
detail = []
for c in feat: detail += reps(c, 6)
for o in sorted(D["objects"], key=lambda o: -o["score"]):
    if o.get("selected") and o not in detail: detail.append(o)
N = len(D["objects"])
L = [f"# Tileset catalog — {place} (chipset {ts}, 16px cells{', OUTDOOR' if OUT else ''}). The chipset has {N} pieces in {len(cats)} categories; only a sample is listed here.",
     "The attached sheet shows each FEATURED category's representative pieces (labelled with exact ids) and the floor/wall/ground swatches.",
     "To see more pieces of any category, or to search by tags, call the tool find_pieces(category, tags): it returns every matching id with its footprint, rule and description, plus a picture.",
     "Use it whenever a zone needs something the sample lacks. Prefer variety: different pieces for different zones and purposes rather than repeating one id.",
     "", "## All categories (category id | name | pieces | sample ids)"]
for c in order: L.append(f"{c}{' [featured]' if c in feat else ''} | {cname(c)} | {len(cats[c])} | {', '.join(o['id'] for o in reps(c, 3))}")
L += ["", "## Pieces (featured categories + pieces this chipset's own example rooms use for this kind of place)"]
if OUT:
    L += ["Pieces are stamped whole: x,y = the top-left cell of the piece's art box. 'cells' gives the art box row by row, top to bottom: X = blocks walking, o = drawn but walkable (roof/canopy you walk behind, or flat ground art), . = not drawn (keeps the ground under it).",
          "id | art box w x h | cells | role | what it is"]
else: L.append("id | footprint w x h cells | placement rule | what it is")
L += [line(o) for o in detail]
if OUT:
    L += ["", "# Grounds (map 'base', 'grounds' zone and ground-path ids; edges of autotile grounds are drawn automatically)"]
    L += [f"{g['id']} | {'walkable' if g['walk'] else 'NOT walkable (water)'}{' | autotile edges' if g['autotile'] else ''} | {en('g:' + g['id'], g['id'])}" for g in D["grounds"]]
else:
    L += ["", "# Floors (region 'floor' id) — " + "; ".join(f"{f['id']} = {en('f:' + f['id'], f['id'])}" for f in D["floors"]),
          "# Walls (region 'wall' id) — " + "; ".join(f"{f['id']} = {en('w:' + f['id'], f['id'])}" for f in D["walls"])]
if D["tables"]:
    L += ["", "# Sized pieces (any size: put them in 'objects' with the size in the id, e.g. '<id> 3x2'; one-row ones only Wx1)"]
    L += [f"{t['id']} WxH | {'W x 1 only' if t['oneRow'] else 'any W x H'} | floor | {en('t:' + t['id'], t['id'])}" for t in D["tables"]]
if D["lines"]: L.append(" / ".join(l["id"] for l in D["lines"]) + " | any W x H rect | decor | walkable carpet in 'carpets'")
if D["daises"]: L.append(" / ".join(d["id"] for d in D["daises"]) + " | any W x H | walkable raised platform in 'daises'")
open(f"{outd}/catalog-{place}.txt", "w").write("\n".join(L) + "\n")
# ---- lookup index (all pieces)
IDX = {"tileset": ts, "categories": {c: {"name": cname(c), "count": len(cats[c])} for c in order},
       "pieces": [{"id": o["id"], "cat": o["cat"], "line": line(o), "score": o["score"], "cells": o["cells"],
                   "text": " ".join([o["id"], en("o:" + o["id"], o["ko"]), o["ko"], o.get("desc", ""), " ".join(o.get("tags", [])), cname(o["cat"]), o["cat"]]).lower()} for o in D["objects"]]}
json.dump(IDX, open(f"{outd}/index-{place}.json", "w"), ensure_ascii=False)
# ---- palette image: swatches, then one band per featured category
SH = Sheet(D)
def palette(k):
    sw = []
    for g in D.get("grounds", []):
        sw.append(SH.card("ground:" + g["id"], [(x, y, g["tiles"][(y * 2 + x) % len(g["tiles"])] if not g["autotile"] else g["tiles"][0], 1) for y in range(2) for x in range(2)], 1))
    for f in D["floors"]:
        sw.append(SH.card("floor:" + f["id"], [(x, y, f["tiles"][((y % f["rows"]) * f["cols"] + x % f["cols"]) * 4], 1) for y in range(2) for x in range(2)], 1))
    for w in D["walls"]:
        c = min(4, w["cols"]); sw.append(SH.card("wall:" + w["id"], [(x, r, w["tiles"][(r * w["cols"] + x % w["cols"]) * 2], 1) for r in range(2) for x in range(max(2, c))], 1))
    bands = [("Grounds" if OUT else "Floors and walls", sw)]
    for c in feat: bands.append((f"{c} — {cname(c)} ({len(cats[c])} pieces; find_pieces for more)", [SH.card(o["id"], [tuple(x) for x in o["cells"]], k) for o in reps(c, 6)]))
    rest = [o for o in detail if o["cat"] not in feat]
    if rest: bands.append(("Other pieces used by this chipset's example rooms", [SH.card(o["id"], [tuple(x) for x in o["cells"]], k) for o in rest]))
    return pack(bands)
img = palette(2)
if img.height > 2600: img = palette(1)          # big outdoor pieces: native pixels keep the sheet readable after the model's downscale
img.save(f"{outd}/palette-{place}.png")
print(place, N, "pieces;", len(cats), "categories;", len(feat), "featured;", len(detail), "detailed;", len(todo), "translated;", img.size)
