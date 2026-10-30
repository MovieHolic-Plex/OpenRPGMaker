#!/usr/bin/env python3
"""bbox-better (b): turn 2 author reference rooms per task (atlas_biome_interior room templates) into bbox layout JSON + laid image.
Only pieces that exist in the task catalog are kept (tabletop goods dropped). Validated and rendered by the same painter.
  python3 scripts/experiments/bbox-better/examples.py      → $BBOX_RUNS/examples/<task>-<n>/ {layout.json, map.png, layout.png}"""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import RUNS, REFS, WT, lay, draw
PICK = {"inn": [("interiorAuthoredRoomTemplates.json", "authored-tavern-m"), ("interiorAuthoredRoomTemplates.json", "authored-tavern-l2")],
        "boss": [("interiorRoomTemplates.json", "throne:6,1"), ("interiorAuthoredRoomTemplates.json", "authored-morgue-m")]}


def catalog_ok(task, i):
    ids = set(l for l in open(f"{REFS}/{task}-pieces.txt").read().split("\n") if l)
    if i in ids: return True
    if i in ({"inn": ("rug red", "rug green", "rug blue", "rug brown"), "boss": ("rug royal", "rug red", "rug purple")}[task]): return True
    return task == "inn" and bool(re.match(r"^(dining \d+x\d+|counter \d+x1|kcounter \d+x1)$", i))


def mask_rects(t):
    m = t.get("mask") or ["." * t["w"]] * t["h"]
    rects, cur = [], None
    for y, row in enumerate(m):
        span = (row.index("."), row.rindex(".")) if "." in row else None
        if cur and span == cur["span"]: cur["h"] += 1
        else:
            if cur: rects.append(cur)
            cur = {"span": span, "y": y, "h": 1} if span else None
    if cur: rects.append(cur)
    return [{"x": 1 + r["span"][0], "y": 1 + r["y"], "w": r["span"][1] - r["span"][0] + 1, "h": r["h"]} for r in rects]


def convert(task, t):
    W, H = t["w"] + 2, t["h"] + 2
    regs = [dict(id=f"room{i}" if i else t["kind"], **r, floor=t["floor"], wall=t["wall"], purpose=t["kind"]) for i, r in enumerate(mask_rects(t))]
    objs, carpets, daises, dropped = [], [], [], []
    for it in t["items"]:
        x, y = it["x"] + 1, it["y"] + 1
        m = re.match(r"^dais (\d+)x(\d+) (\w+)$", it["id"])
        if m: daises.append({"id": f"dais {m[3]}", "x": x, "y": y, "w": int(m[1]), "h": int(m[2])}); continue
        if it["t"] == "l":
            cs = it.get("cells") or [[it["x"], it["y"]]]
            xs, ys = [c[0] for c in cs], [c[1] for c in cs]
            if catalog_ok(task, it["id"]): carpets.append({"id": it["id"], "x": min(xs) + 1, "y": min(ys) + 1, "w": max(xs) - min(xs) + 1, "h": max(ys) - min(ys) + 1})
            else: dropped.append(it["id"])
            continue
        if it["t"] == "g" or not catalog_ok(task, it["id"]): dropped.append(it["id"]); continue
        objs.append({"id": it["id"], "x": x, "y": y})
    bottom = max(r["y"] + r["h"] - 1 for r in regs)
    br = [r for r in regs if r["y"] + r["h"] - 1 == bottom][0]
    taken = set()
    from common import json as _j
    S = _j.load(open(f"{WT}/src/assets/handInteriorSpec.json"))["objects"]
    for o in objs:
        d = S.get(o["id"]); s = re.match(r"^[a-z]+ (\d+)x(\d+)$", o["id"])
        w, h = (d["w"], max(1, d["h"])) if d else ((int(s[1]), int(s[2])) if s else (1, 1))
        taken |= {(o["x"] + i, o["y"] + j) for i in range(w) for j in range(h)}
    cx = br["x"] + br["w"] // 2
    ex = min((x for x in range(br["x"], br["x"] + br["w"]) if (x, bottom) not in taken), key=lambda x: abs(x - cx))
    lm = next((o for o in objs if o["id"] in ("throne", "fireplace", "long hearth 5", "demon throne")), None)
    if lm: objs.remove(lm)
    L = {"map": {"w": W, "h": H}, **({"landmark": lm} if lm else {}), "regions": regs, "openings": [], "entrance": {"x": ex, "y": H - 1},
         "carpets": carpets, "daises": daises, "objects": objs}
    return L, dropped


if __name__ == "__main__":
  for task, picks in PICK.items():
      for n, (f, tid) in enumerate(picks, 1):
          t = [x for x in json.load(open(f"{WT}/src/assets/{f}"))["templates"]["atlas_biome_interior"] if x["id"] == tid][0]
          L, dropped = convert(task, t)
          G = f"{RUNS}/examples/{task}-{n}"; os.makedirs(G, exist_ok=True)
          chk = lay(G, "final", L, render=True)
          json.dump(L, open(f"{G}/layout.json", "w"), indent=1); draw(f"{G}/layout.json", f"{G}/layout.png")
          json.dump({"template": tid, "dropped": dropped, "check": chk}, open(f"{G}/SRC.json", "w"), indent=1)
          print(task, n, tid, "ok" if chk["ok"] else chk["errors"][:5], "dropped", sorted(set(dropped)))
