#!/usr/bin/env python3
"""zoom crops of every level crossing (old stairs or new cuts) of a rendered bbox-village map.
  crops(run_dir, terrain_json, scale) -> list of (label, PIL image)   ; contact(run_dir, terrain, out_png, scale)"""
import json, sys
from PIL import Image, ImageDraw

def crossings(layout):
    """(x, y_foot, w, dir, label): y_foot = low-level row against the cliff."""
    out = []
    for s in layout.get("cuts", []):
        w = int(s["id"].split("-w")[1]); out.append((s["x"], s["y"], w, s.get("dir", "north"), s["id"]))
    for s in layout.get("stairs", []):   # old bbox-village: rect on the low side, h = rise + 1
        y = s["y"] if s.get("dir") == "north" else s["y"] + s["h"] - 1
        out.append((s["x"], y, s["w"], s.get("dir"), f"old stairs {s['w']}x{s['h']}"))
    return out

def crops(run, terrain, scale=4):
    L = json.load(open(f"{run}/layout.json")); T = json.load(open(terrain)); W, lv = T["W"], T["levels"]
    im = Image.open(f"{run}/map.png").convert("RGB")
    pad = im.height - T["H"] * 16
    res = []
    for x, y, w, d, lab in crossings(L):
        lo = lv[y * W + x]; hi = lv[(y - 1 if d == "north" else y + 1) * W + x]; rise = abs(hi - lo)
        x0, x1 = max(0, (x - 3) * 16), min(im.width, (x + w + 3) * 16)
        top = (y - 3) * 16 + pad - max(lo, hi) * 16
        bot = (y + 4) * 16 + pad - lo * 16
        c = im.crop((x0, max(0, top), x1, min(im.height, bot)))
        c = c.resize((c.width * scale, c.height * scale), Image.NEAREST)
        res.append((f"{lab} @({x},{y}) {d} · cliff {rise}", c))
    return res

def contact(run, terrain, out, scale=4):
    cs = crops(run, terrain, scale)
    if not cs: return False
    gap, lab = 10, 18
    Wt = sum(c.width for _, c in cs) + gap * (len(cs) + 1); Ht = max(c.height for _, c in cs) + lab + 2 * gap
    sheet = Image.new("RGB", (Wt, Ht), (22, 22, 28)); d = ImageDraw.Draw(sheet); x = gap
    for t, c in cs:
        sheet.paste(c, (x, gap + lab)); d.text((x, gap), t, fill=(255, 220, 120)); x += c.width + gap
    sheet.save(out); return True

if __name__ == "__main__":
    print(contact(sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]) if len(sys.argv) > 4 else 4))
