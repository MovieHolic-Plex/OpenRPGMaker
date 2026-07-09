#!/usr/bin/env python3
"""흙길 오토타일 보라→갈색 교정 (C.2-2, 2026-07-07).

combined-town 칩셋의 흙길 블록(360~362, 390~392, 420~422, 450~452)이
보라 자갈로 렌더되던 것을 갈색 흙길로 교정한다. 결정적 실행:
대상 12타일 안에서만 아래 2색을 정확 치환하고, 잔디/하이라이트 색은 보존.
  (112, 63, 87)  보라 몸통   → (128, 90, 58)  중간 갈색
  (43, 32, 63)   짙은 보라   → (66, 46, 30)   짙은 갈색
"""
from PIL import Image

SHEET = "public/assets/easyrpg-chipset-combined-town-transparent.png"
TILES = [360, 361, 362, 390, 391, 392, 420, 421, 422, 450, 451, 452]
COLS, TILE = 30, 16
MAP = {(112, 63, 87, 255): (128, 90, 58, 255), (43, 32, 63, 255): (66, 46, 30, 255)}

im = Image.open(SHEET).convert("RGBA")
px = im.load()
changed = 0
for idx in TILES:
    x0, y0 = (idx % COLS) * TILE, (idx // COLS) * TILE
    for y in range(y0, y0 + TILE):
        for x in range(x0, x0 + TILE):
            if px[x, y] in MAP:
                px[x, y] = MAP[px[x, y]]
                changed += 1
im.save(SHEET)
print(f"recolored {changed} px across {len(TILES)} tiles")
