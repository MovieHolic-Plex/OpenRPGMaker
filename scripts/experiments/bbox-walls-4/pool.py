#!/usr/bin/env python3
"""bbox-walls-2: merge the object pool (another agent's output) into this experiment.
Reads ~/z-project/assistant-whole-game/suite/rooms/objpool/<chipset>/*.json (+ same-name .png) and writes $BW_RUNS/pool.json:
  [{id, name, category, kind (floor|wall|hang|flat), w, h, up (rows the art rises above the footprint), png, places}]
Lenient about the pool JSON shape (name_en, category, footprint "2x1"|{w,h}|[w,h], placement text).
  python3 pool.py [chipset=atlas_biome_interior]"""
import glob, json, os, re, sys
from PIL import Image
HOME = os.path.expanduser("~")
RUNS = os.environ.get("BW_RUNS", f"{HOME}/z-project/assistant-whole-game/suite/rooms/runs-bboxwalls4")
CS = sys.argv[1] if len(sys.argv) > 1 else "atlas_biome_interior"
SRC = f"{HOME}/z-project/assistant-whole-game/suite/rooms/objpool/{CS}"
T = 16


def wh(fp):
    if isinstance(fp, dict): return int(fp.get("w", 1)), int(fp.get("h", 1))
    if isinstance(fp, (list, tuple)) and len(fp) >= 2: return int(fp[0]), int(fp[1])
    m = re.search(r"(\d+)\s*[x×]\s*(\d+)", str(fp or ""))
    return (int(m[1]), int(m[2])) if m else (None, None)


def kind_of(p):
    s = json.dumps(p).lower() if not isinstance(p, str) else p.lower()
    if re.search(r"\bhang|wall[- ]?mount|on the face|mounted", s): return "hang"
    if re.search(r"against[- ]?(the )?wall|\bwall\b", s): return "wall"
    if re.search(r"\bflat\b|decal|walkable|rug|mat\b", s): return "flat"
    return "floor"


out = []
for jf in sorted(glob.glob(f"{SRC}/*.json")):
    png = jf[:-5] + ".png"
    if not os.path.exists(png): continue
    try: r = json.load(open(jf))
    except Exception: continue
    im = Image.open(png); cols, rows = round(im.width / T), round(im.height / T)
    slug = os.path.basename(jf)[:-5]
    pid = re.sub(r"[^a-z0-9]+", "-", str(r.get("id") or r.get("slug") or slug).lower()).strip("-")
    pl = r.get("anchor") or r.get("placement") or ""
    kind = kind_of(pl if isinstance(pl, str) else (pl.get("anchor") or pl.get("kind") or json.dumps(pl)))
    w, h = wh(r.get("footprint"))
    if w is None: w, h = cols, (0 if kind == "hang" else 1)
    if kind == "hang": h = 0
    # the pool's footprint is the art size; tall pieces (gate_kind tall_furniture / column) stand on their bottom row and rise above it
    if kind in ("floor", "wall") and str(r.get("gate_kind", "")) in ("tall_furniture", "column", "tall") and rows > 1: h = 1
    up = max(0, rows - max(1, h)) if kind != "hang" else 0
    if kind == "flat": up = 0; h = rows
    out.append({"id": pid, "name": r.get("name_en") or r.get("name") or pid, "category": r.get("category") or "", "kind": kind,
                "w": w, "h": h, "up": up, "cols": cols, "rows": rows, "png": png,
                "places": r.get("places") or r.get("place") or [], "brief": r.get("brief") or r.get("description") or ""})
os.makedirs(RUNS, exist_ok=True)
json.dump(out, open(f"{RUNS}/pool.json", "w"), indent=1, ensure_ascii=False)
print(f"pool {CS}: {len(out)} items", [o["id"] for o in out])
