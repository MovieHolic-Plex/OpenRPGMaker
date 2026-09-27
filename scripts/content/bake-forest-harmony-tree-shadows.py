#!/usr/bin/env python3
"""숲마을 나무 밑 그림자 칸 — forest_harmony 끝에 이식하는 투명 그림자 전용 16px 칸.

    python3 scripts/content/bake-forest-harmony-tree-shadows.py

왜: 굽이숲 수관 밑동과 낱그루 나무 밑동이 받침 잔디(240·1145) 위에 그대로 앉아, 수관 아래도 밑동 발치도 밝은 풀밭이었다
(2026-09-27 「작은 숲속에 오두막」 — 「나무들 하단에 그림자가 없으니 너무 어색하다」). 원본 칸의 픽셀은 건드리지 않고,
밑동 칸마다 그 칸의 **투명 부분**에만 드리우는 그림자 칸을 새로 굽는다. 시공기가 2층(바닥 위·3층 밑)에 놓는다.

규칙
  · 그림자는 검정이 아니라 숲 그늘색 한 가지(#10261a)에 알파 사다리 3단 + 4×4 순서 디더 — 도트 느낌 유지, 알파 0/계단값만.
  · 밑동 칸: 그 칸의 불투명 픽셀(줄기·뿌리)은 비우고 둘레에만 드리운다. 굽이숲 조립 3행은 수관이 위에서 드리우므로
    위 행일수록 진하다. 낱그루는 뿌리 둘레에 접지 그림자만.
  · 발치 칸(밑동 바로 아래 바닥): 윗줄에서 아래로 옅어지는 띠. 굽이숲 뿌리 행 아래 한 칸, 낱그루 밑동 아래 한 칸.
  · 같은 입력이면 같은 PNG(무작위 없음).

출력
  public/assets/forest-harmony/tree-shadows.png   (30칸 폭, 16px, RGBA)
  src/assets/forestHarmonyTreeShadows.json         (밑동 → 시트 칸 번호, 슬롯 메타)

칸 번호는 여기서 정하지 않는다. forestHarmonyTreeShadows.ts 가 타일셋의 마지막 이식 뒤 새 줄에 붙인다.
"""
import json
import math
import os
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CHIPSET = os.path.join(ROOT, "public/assets/forest-harmony/chipset.png")
OUT_PNG = os.path.join(ROOT, "public/assets/forest-harmony/tree-shadows.png")
OUT_JSON = os.path.join(ROOT, "src/assets/forestHarmonyTreeShadows.json")
TEXTURE_KEY = "tex_forest_harmony_tree_shadows"
S, TPR = 16, 30
SHADE = (16, 38, 26)
ALPHA = [0, 70, 110, 150]
BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]

# 굽이숲 3행 조립(src/editor/tools/village/forestTrunkTiles.ts) — 행 번호가 수관 그늘 세기를 정한다.
LEFT = [[1422, 1423, 1424], [1426, 1427, 1428], [1430, 1431, 1432]]
RIGHT = [[1453, 1454, 1455], [1457, 1458, 1459], [1461, 1462, 1463]]
PAIR = [[1425, 1350], [1429, 1428], [1433, 1432]]
GROVE_ROW = {}
for part in (LEFT, RIGHT, PAIR):
    for row, tiles in enumerate(part):
        for tile in tiles:
            GROVE_ROW.setdefault(tile, row)
# 조립 양끝 칸: 바깥쪽은 숲 밖 풀밭이라 그늘이 옆으로 옅어져야 한다(안 그러면 칸 모양 사각형이 남는다).
OUTER_LEFT = {LEFT[r][0] for r in range(3)}
OUTER_RIGHT = {RIGHT[r][2] for r in range(3)}
# 낱그루 밑동(맨 아랫줄). 합본 마을 침엽수·마른나무·활엽수, 숲 나무 띠의 활엽수·큰 참나무·짙은 나무.
SINGLE_ROOTS = [290, 291, 292, 293, 1068, 1069, 1070, 1095, 1096, 1011, 1012]


def cell(sheet, tile):
    x, y = (tile % TPR) * S, (tile // TPR) * S
    return sheet.crop((x, y, x + S, y + S))


def quantize(strength, x, y):
    level = strength * 3 + (BAYER[y % 4][x % 4] / 16 - 0.5) * 0.9
    return ALPHA[max(0, min(3, round(level)))]


def edge_fade(tile, x):
    """조립 끝 칸이면 바깥 가장자리 쪽으로 0 까지 옅어진다(안쪽 4칸은 그대로)."""
    if tile in OUTER_LEFT:
        return max(0.0, min(1.0, (x - 3) / 9))
    if tile in OUTER_RIGHT:
        return max(0.0, min(1.0, (12 - x) / 9))
    return 1.0


def root_columns(alpha):
    """뿌리(아래쪽 6줄)의 불투명 열 범위 — 낱그루 접지 타원의 중심과 폭."""
    cols = [x for x in range(S) if any(alpha.getpixel((x, y)) >= 128 for y in range(10, S))]
    return (min(cols), max(cols)) if cols else None


def trunk_shadow(sheet, tile, row):
    """밑동 칸 자체 — 불투명 픽셀은 비우고 투명 부분에만 드리운다.

    굽이숲(row 0~2): 수관이 드리우는 그늘. 위 행일수록 진하고 칸 양옆은 판판하게 이어진다(가로 반복 조립이라 칸 경계에서 끊기면 안 된다).
    낱그루(row None): 뿌리 중심 아래 가로로 넓은 타원 — 칸 모서리까지 가지 않아 사각형 윤곽이 생기지 않는다.
    """
    alpha = cell(sheet, tile).getchannel("A")
    opaque = [[alpha.getpixel((x, y)) >= 128 for x in range(S)] for y in range(S)]
    roots = root_columns(alpha)
    out = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    for y in range(S):
        for x in range(S):
            if opaque[y][x]:
                continue
            strength = 0.0
            if row is not None:
                top, bottom = {0: (0.56, 0.44), 1: (0.44, 0.32), 2: (0.32, 0.18)}[row]
                strength = (top + (bottom - top) * (y / (S - 1))) * edge_fade(tile, x)
            elif roots:
                cx, half = (roots[0] + roots[1]) / 2, max(3.0, (roots[1] - roots[0]) / 2 + 3)
                d = math.hypot((x + 0.5 - cx) / half, (y + 0.5 - 14.5) / 2.6)
                strength = max(0.0, 1 - d) * 0.9
            a = quantize(strength, x, y) if strength > 0 else 0
            if a:
                out.putpixel((x, y), (*SHADE, a))
    return out


def foot_shadow(sheet, tile, grove):
    """밑동 바로 아래 바닥 칸 — 굽이숲은 위 두세 줄만 성기게 옅어지는 띠, 낱그루는 타원의 아래 끝."""
    alpha = cell(sheet, tile).getchannel("A")
    roots = root_columns(alpha)
    out = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    for y in range(S):
        for x in range(S):
            if grove:
                strength = 0.24 * (1 - y / 4) * edge_fade(tile, x) if y < 4 else 0
            else:
                if not roots:
                    continue
                cx, half = (roots[0] + roots[1]) / 2, max(3.0, (roots[1] - roots[0]) / 2 + 3)
                d = math.hypot((x + 0.5 - cx) / half, (y + 16.5 - 14.5) / 2.6)
                strength = max(0.0, 1 - d) * 0.9
            a = quantize(strength, x, y) if strength > 0 else 0
            if a:
                out.putpixel((x, y), (*SHADE, a))
    return out


def main():
    sheet = Image.open(CHIPSET).convert("RGBA")
    entries = []  # (image, trunk tile, kind)
    for tile in sorted(GROVE_ROW):
        entries.append((trunk_shadow(sheet, tile, GROVE_ROW[tile]), tile, "trunk"))
    for tile in SINGLE_ROOTS:
        entries.append((trunk_shadow(sheet, tile, None), tile, "trunk"))
    for tile in sorted(t for t, row in GROVE_ROW.items() if row == 2):
        entries.append((foot_shadow(sheet, tile, True), tile, "foot"))
    for tile in SINGLE_ROOTS:
        entries.append((foot_shadow(sheet, tile, False), tile, "foot"))
    rows = (len(entries) + TPR - 1) // TPR
    out = Image.new("RGBA", (TPR * S, rows * S), (0, 0, 0, 0))
    for index, (image, _, _) in enumerate(entries):
        out.paste(image, ((index % TPR) * S, (index // TPR) * S))
    out.save(OUT_PNG, optimize=True)
    open_ = {"up": True, "down": True, "left": True, "right": True}
    trunk, foot = {}, {}
    slots = []
    for index, (_, tile, kind) in enumerate(entries):
        (trunk if kind == "trunk" else foot)[str(tile)] = index
        label = "나무 밑 그림자" if kind == "trunk" else "나무 발치 그림자"
        slots.append({
            "passability": open_, "priority": "lower", "terrain": 0,
            "tileMeta": {
                "role": "decoration", "label": f"{label} · {tile}",
                "description": f"밑동 {tile} {'칸' if kind == 'trunk' else '바로 아래 칸'}의 2층 그림자. 투명 그림자만 있고 통행에 관여하지 않는다. 나무를 심는 도구가 자동으로 놓는다.",
                "source": "user", "passage": "passable", "userLocked": True, "defaultLayer": "lower", "layerBacking": "none",
            },
        })
    data = {
        "textureKey": TEXTURE_KEY, "frames": len(entries),
        "trunk": trunk, "foot": foot,
        "slots": slots,
    }
    with open(OUT_JSON, "w", encoding="utf8") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=1)
        handle.write("\n")
    print(OUT_PNG, out.size, "tiles", len(entries))


if __name__ == "__main__":
    main()
