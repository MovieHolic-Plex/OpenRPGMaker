#!/usr/bin/env python3
"""조건 V 계산 충실도(판정 아님): 목업과 지은 맵을 칸 단위로 맞댄다.
  python3 fidelity.py <run dir G> <prep dir>      (repo 루트에서)  → <G>/room/fidelity.json
  - cells: 목업 칸 지도(prep/cells.json)와 지은 맵 그림(room/map.png)을 같은 분류기(cellclass)로 void/floor/wall 로 나누고,
    가장 잘 맞는 평행 이동 하나를 찾아 «둘 중 하나라도 방 안인 칸» 가운데 분류가 같은 칸의 몫.
  - objects: 목업 물건 상자(prep/objects.json — 시각 판정자가 칸 좌표로 적은 것) 가운데, 같은 이동으로 옮긴 상자 ±1칸 안에
    지은 맵의 물건 칸(윗층·덮개 층에 타일이 있는 방 안 칸)이 있는 몫."""
import json, os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cellclass import classify

G, PREP = sys.argv[1], sys.argv[2]
cj = json.load(open(f"{PREP}/cells.json")); M = np.array([[" .#".index(c) for c in row] for row in cj["cells"]], dtype=np.int8)
P = classify(Image.open(f"{G}/room/map.png"))
meas = json.load(open(f"{G}/room/measure.json")); after = json.load(open(f"{G}/after.json"))
mp = after["maps"][meas["mapId"]]; W = mp["width"]; H = mp["height"]
P = P[:H, :W]
obj = np.zeros((H, W), dtype=bool)
for key in ("upperTiles", "upperOverlayTiles", "lowerOverlayTiles"):
    arr = mp.get(key) or []
    for i, t in enumerate(arr[:W * H]):
        if isinstance(t, int) and t >= 0: obj[i // W, i % W] = True
for L in (mp.get("extraLayers") or []):
    arr = L.get("tiles") if isinstance(L, dict) else None
    for i, t in enumerate((arr or [])[:W * H]):
        if isinstance(t, int) and t >= 0: obj[i // W, i % W] = True
obj &= (P == 1)

def agree(dx, dy):
    """P 를 (dx,dy) 옮겨 M 위에 — 둘 중 하나라도 방 안(non-void)인 칸 중 같은 분류의 몫."""
    Hm, Wm = M.shape; eq = tot = 0
    ys = range(min(0, dy), max(Hm, H + dy)); xs = range(min(0, dx), max(Wm, W + dx))
    for y in ys:
        for x in xs:
            m = M[y, x] if 0 <= y < Hm and 0 <= x < Wm else 0
            py, px = y - dy, x - dx
            p = P[py, px] if 0 <= py < H and 0 <= px < W else 0
            if m == 0 and p == 0: continue
            tot += 1; eq += int(m == p)
    return eq / max(1, tot)

Hm, Wm = M.shape
best = max(((agree(dx, dy), dx, dy) for dx in range(-W + 3, Wm - 2) for dy in range(-H + 3, Hm - 2)), key=lambda r: r[0])
score, dx, dy = best
out = {"cells": round(score, 3), "offset": [dx, dy], "mockup": [Wm, Hm], "map": [W, H]}
if os.path.exists(f"{PREP}/objects.json"):
    boxes = json.load(open(f"{PREP}/objects.json"))["objects"]; hit = []
    for b in boxes:
        x0, y0, x1, y1 = b["box"]; ok = False
        for y in range(y0 - 1, y1 + 2):
            for x in range(x0 - 1, x1 + 2):
                py, px = y - dy, x - dx
                if 0 <= py < H and 0 <= px < W and obj[py, px]: ok = True
        hit.append({"name": b["name"], "box": b["box"], "placed": ok})
    out["objects"] = round(sum(h["placed"] for h in hit) / max(1, len(hit)), 3); out["objectHits"] = hit
out["mapCells"] = ["".join(" .#"[int(c)] for c in row) for row in P]
json.dump(out, open(f"{G}/room/fidelity.json", "w"), indent=1, ensure_ascii=False)
print(json.dumps({k: out[k] for k in ("cells", "objects", "offset") if k in out}))
