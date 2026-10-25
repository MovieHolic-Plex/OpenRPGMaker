#!/usr/bin/env python3
"""버들항 숲 composer 줄기 T3(나무껍질 대비) 굽기 — 2026-10-24 사용자 선택 「T3」·직접 허용(「이건 이제 통과」).

build.py 의 sheet-T3.png 에서 원본 버들항 칸과 화소가 다른 칸(줄기·뿌리 칸)만 뽑아 작은 번들 시트로 굽고,
나무 이름별 칸 바꿔치기 표를 src/assets/beodeulForestTrunks.json 에 쓴다. 수관 칸은 원본 그대로(원본 칸 번호를 계속 쓴다).
런타임은 beodeulForestComposer() 가 이 표를 읽어 바뀐 칸만 대상 칩셋에 이식한다(broadleaf·mixed 둘 다 — 같은 나무 이름).

3/4 관문(hard rule): 굽기 전에 나무마다 「원본 칸 + 새 칸」으로 조립한 그림을 object_gate.require_pass(kind organic, context bundle) 로 확인한다.
조립 그림은 관문에 낸 그림(.scratch mkgate.py)과 같은 화소다. 하나라도 막히면 아무것도 쓰지 않는다.

  python3 scripts/content/fallen-forest-trunks/bake.py
"""
import hashlib, json, sys
from pathlib import Path
import numpy as np
from PIL import Image

R = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(R / "src/harnesses/_core"))
import object_gate as OG  # noqa: E402

T, CITY_COLS, OUT_COLS = 16, 128, 16
VARIANT = "T3"
OUT_PNG = R / "public/assets/beodeul-forest-trunks/chipset.png"
OUT_JSON = R / "src/assets/beodeulForestTrunks.json"
TEXTURE = "tex_beodeul_forest_trunks"

city = np.array(Image.open(R / "public/assets/beodeul-city/beodeul-city-chipset.png").convert("RGBA"))
comp = json.loads((R / "src/assets/beodeulForestComposer.json").read_text())
orig = {s["name"]: s for s in comp["types"]["broadleaf"]["sprites"] if not s["dark"]}
var = json.loads((HERE / "sprites.json").read_text())[VARIANT]["sprites"]
sheet = np.array(Image.open(HERE / f"sheet-{VARIANT}.png").convert("RGBA"))

def city_tile(n):
    return city[n // CITY_COLS * T:(n // CITY_COLS + 1) * T, n % CITY_COLS * T:(n % CITY_COLS + 1) * T]

def var_tile(n):
    return sheet[n // 16 * T:(n // 16 + 1) * T, n % 16 * T:(n % 16 + 1) * T]

EMPTY = np.zeros((T, T, 4), np.uint8)
tiles, index, cells, cover, checks = [], {}, {}, {}, []
for s in var:
    if s["dark"] or s["name"] in cells:
        continue
    o = orig[s["name"]]
    assert (o["w"], o["h"]) == (s["w"], s["h"]), s["name"]
    row, img = [], np.zeros((s["h"] * T, s["w"] * T, 4), np.uint8)
    for i, (a, b) in enumerate(zip(o["tiles"], s["tiles"])):
        new = var_tile(b) if b >= 0 else EMPTY
        old = city_tile(a) if a >= 0 else EMPTY
        if np.array_equal(new, old):
            row.append(-1)          # 원본 칸 그대로
        elif not new[..., 3].any():
            row.append(-2)          # 이 칸은 비운다
        else:
            key = hashlib.sha1(new.tobytes()).hexdigest()
            if key not in index:
                index[key] = len(tiles)
                tiles.append(new)
            row.append(index[key])
        y, x = i // s["w"] * T, i % s["w"] * T
        img[y:y + T, x:x + T] = new
    cells[s["name"]] = row
    cover[s["name"]] = s["cover"]
    checks.append((Image.fromarray(img, "RGBA"), s["name"]))

for im, name in checks:   # 하나라도 막히면 ObjectGateRefused — 아무것도 쓰지 않는다
    sha = OG.require_pass(im, kind="organic", context="bundle", label=f"beodeul_city/forest-trunks/{VARIANT}/{name}")
    print(f"관문 통과 {name} {sha[:12]}")

rows = -(-len(tiles) // OUT_COLS)
out = np.zeros((rows * T, OUT_COLS * T, 4), np.uint8)
for i, t in enumerate(tiles):
    out[i // OUT_COLS * T:(i // OUT_COLS + 1) * T, i % OUT_COLS * T:(i % OUT_COLS + 1) * T] = t
OUT_PNG.parent.mkdir(parents=True, exist_ok=True)
Image.fromarray(out, "RGBA").save(OUT_PNG, optimize=True)
OUT_JSON.write_text(json.dumps(dict(
    source=f"scripts/content/fallen-forest-trunks/bake.py ({VARIANT} 나무껍질 대비, 2026-10-24 사용자 선택·허용). "
           "cells: 나무 칸마다 이 시트의 칸 번호, -1 = 원본 버들항 칸 그대로, -2 = 비움. 관문 영수증 harness-data/object-gate.",
    texture=TEXTURE, tileSize=T, tilesPerRow=OUT_COLS, count=len(tiles), cells=cells, cover=cover,
), ensure_ascii=False, indent=1) + "\n")
print(f"{len(tiles)}칸 → {OUT_PNG.relative_to(R)}, 표 → {OUT_JSON.relative_to(R)}")
