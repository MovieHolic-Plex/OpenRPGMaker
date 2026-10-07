"""숲 벽(맵 테두리 나무) — 원작 마을·도로의 테두리는 외톨이 나무가 아니라 **빈틈없이 겹친 나무 격자**다.
원작 문법(FRLG 태초마을·RSE 미로마을 조립본을 눈으로 읽음):
- 나무 하나 = 2×2 칸 수관. 가로로 붙은 수관끼리 맞닿고, 세로로는 아래 나무의 수관 꼭대기가 위 나무 밑동을 8px 덮어 줄기가 안 보인다.
- 줄기·그림자는 맨 아랫줄 나무에만 보인다. 수관 둘레는 한 단 어두운 풀 그늘(후광)이 감싼다.
- 그래서 숲은 2×2 덩이의 9조각(모서리 4·변 4·속 1)으로 깔린다 — 속 덩이는 사방으로 반복해도 이음새가 없다.
그림은 lib/tree.py 의 덩이 수관 문법을 쓰고(외톨이 나무와 같은 화풍), 픽셀은 좌표로 찍는다."""
from __future__ import annotations

import math
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
import px  # noqa: E402
import tree as tr  # noqa: E402
from px import T  # noqa: E402

STEP = 32            # 나무 격자 간격(px)
LIFT = 9             # 수관이 자기 칸 위로 솟는 높이 — 위 나무 밑동을 덮는다


def crown(P, seed: str = "forest-crown"):
    """수관 하나(32×(32+LIFT)): 가로로 꽉 차는 둥근 돔. 위쪽 끝은 살짝 뾰족, 아래는 평평하게 넓다."""
    r = random.Random(seed)
    H = STEP + LIFT
    import math
    centers = [(16, 21, 12.5)]
    for k in range(14):                                          # 둘레 잎 덩이: 원 위에 고르게(가로 꽉 차게)
        a = math.pi * (0.80 + 1.40 * k / 13)                     # 왼쪽 아래 → 위 → 오른쪽 아래
        cx, cy = 16 + 10.6 * math.cos(a), 21 + 12.6 * math.sin(a)
        centers.append((cx, cy, r.uniform(4.6, 5.3)))
    for k in range(3):                                           # 밑단 둥근 덩이 셋
        centers.append((8 + k * 8, 32.5, r.uniform(5.0, 5.6)))
    for _ in range(6):
        x, y = r.uniform(9, 23), r.uniform(10, 28)
        centers.append((x, y, r.uniform(3.8, 4.6)))
    canopy, mask = tr.cluster_canopy(STEP, H, centers, px.ramp(P["_leaf_hex"]), seed, 0.05, 0.7, 0.3)
    return canopy, mask


def trunk(P, im, x0, y0):
    """맨 아랫줄 나무의 줄기(수관 밑으로 6px 보인다): 가운데 8px 폭, 왼쪽 밝음·오른쪽 어둠, 밑동은 살짝 벌어진다."""
    t = P["trunk"]
    for dy in range(7):
        half = 3.5 + (1.0 if dy >= 5 else 0.0)
        for x in range(int(x0 + 16 - half), int(x0 + 16 + half)):
            rel = (x + 0.5 - (x0 + 16 - half)) / (2 * half)
            c = t[3] if rel < 0.3 else t[2] if rel < 0.65 else t[1]
            if rel > 0.86 or dy == 6:
                c = t[0]
            px.put(im, x, y0 + dy, c)


def forest_canvas(P, grass_px, cols: int, rows: int, seed: str = "forest-crown"):
    """cols×rows 그루의 숲(각 그루 2×2 칸)을 풀 위에 그린다. 위쪽에 LIFT 만큼 여백을 두고(꼭대기 줄 수관이 솟을 자리), 아래는 줄기·그림자 한 줄.
    반환: (그림, 칸 단위 폭, 칸 단위 높이). 그림의 (0, 0) 은 숲 영역 왼쪽 위 칸의 왼쪽 위 — 솟은 수관은 그 위 칸(-1 줄)에 걸친다."""
    g = P["grass"]
    W = cols * STEP
    H = rows * STEP
    pad = T                                                     # 위 한 칸: 꼭대기 수관이 솟는 줄
    im = px.new(W, H + pad + T)
    for y in range(im.height):
        for x in range(W):
            im.putpixel((x, y), grass_px(x % T, y % T))
    P = dict(P); P["_leaf_ramp"] = px.ramp(P["_leaf_hex"])
    cv, mask = crown(P, seed)
    # 후광: 모든 수관 마스크를 합친 뒤 2px 키운 테두리를 한 단 어두운 풀로
    union = [[False] * W for _ in range(im.height)]
    for j in range(rows):
        for i in range(cols):
            ox, oy = i * STEP, pad + j * STEP - LIFT
            for yy in range(len(mask)):
                for xx in range(STEP):
                    if mask[yy][xx] and 0 <= oy + yy < im.height:
                        union[oy + yy][ox + xx] = True
    for y in range(im.height):
        for x in range(W):
            if union[y][x]:
                continue
            # 솟은 수관 줄(y < pad)의 수관 사이 홈은 숲 그늘로 메우지 않는다 — 돌출부·모서리 조각이 이웃 없이 놓이면 짙은 네모로 비친다(적대 검수 L1 N15)
            enclosed = y >= pad and any(union[y][xx] for xx in range(max(0, x - 13), x)) and any(union[y][xx] for xx in range(x + 1, min(W, x + 14))) \
                and y < pad + rows * STEP - 4
            if enclosed:                                        # 나무 사이 틈 = 숲 그늘(가장 어두운 잎색)
                lf = P["_leaf_ramp"]
                im.putpixel((x, y), lf[0])
                continue
            near = any(0 <= y + dy < im.height and 0 <= x + dx < W and union[y + dy][x + dx]
                       for dy in range(-2, 3) for dx in range(-2, 3) if abs(dx) + abs(dy) <= 3)
            if near:
                lf = P["_leaf_ramp"]
                im.putpixel((x, y), lf[0] if (x * 3 + y) % 4 else lf[1])
    # 맨 아랫줄 줄기·그림자(수관이 덮지 않는 밑동)
    for i in range(cols):
        ox, oy = i * STEP, pad + rows * STEP
        for y in range(oy - 3, oy + 5):
            for x in range(ox + 3, ox + 30):
                if 0 <= y < im.height and not union[y][x]:
                    d = ((x - ox - 16) / 12.5) ** 2 + ((y - oy - 1) / 3.0) ** 2
                    if d <= 1.0:
                        im.putpixel((x, y), g[0])
        trunk(P, im, ox, oy - 3)
    for j in range(rows):                                       # 위→아래: 아래 수관이 위 밑동을 덮는다
        for i in range(cols):
            im.alpha_composite(cv, (i * STEP, pad + j * STEP - LIFT))
    return im


def nine_slice(P, grass_px, seed: str = "forest-crown"):
    """3×3 그루 숲을 그려 9조각(각 2칸 폭)의 칸 그림을 뽑는다.
    이름: forest_{tl,t,tr,l,c,r,bl,b,br}.{x}.{y} — 위쪽 조각(t*)은 솟는 줄 1칸을 더 가져 3줄, 아래쪽(b*)은 줄기 줄 1칸을 더 가져 3줄, 가운데 줄은 2줄."""
    im = forest_canvas(P, grass_px, 3, 3, seed)
    pad = T
    out = {}
    cols = {"l": 0, "": 1, "r": 2}
    for rk, (y0, y1) in {"t": (0, pad + STEP), "": (pad + STEP, pad + 2 * STEP), "b": (pad + 2 * STEP, pad + 3 * STEP + T)}.items():
        for ck, ci in cols.items():
            name = "forest_" + ({("t", "l"): "tl", ("t", ""): "t", ("t", "r"): "tr", ("", "l"): "l", ("", ""): "c", ("", "r"): "r",
                                 ("b", "l"): "bl", ("b", ""): "b", ("b", "r"): "br"}[(rk, ck)])
            x0 = ci * STEP
            for ty in range((y1 - y0) // T):
                for tx in range(2):
                    out[f"{name}.{tx}.{ty}"] = im.crop((x0 + tx * T, y0 + ty * T, x0 + tx * T + T, y0 + ty * T + T))
    return out
