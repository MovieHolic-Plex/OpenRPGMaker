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


# GBA 2세대 수관(2026-10-07 「포켓몬풍인데 왜 기본 칩셋이냐」 → 다시 그림): 큰 잎 덩이 일곱 개를 뒤(위)→앞(아래)으로 얹는다.
# 덩이마다 왼쪽 위가 밝고(가장 밝은 단은 위쪽 덩이에만), 오른쪽 아래 테 1px 은 짙은 틈 — 앞 덩이와 갈린다. 둘레는 사방 1px 짙은 윤곽.
GBA_CLUMPS = (
    (16.0, 11.0, 8.2, +1), (9.0, 17.0, 7.6, +1), (23.0, 17.0, 7.6, 0),
    (16.0, 22.0, 8.0, 0), (7.6, 27.0, 7.2, 0), (24.4, 27.0, 7.2, -1), (16.0, 30.0, 7.4, -1),
)


def _hh(x: int, y: int, k: int) -> float:
    """칸 좌표 해시 → [0,1). 선형 식(x*a+y*b)%m 은 사선 줄이 보여서 쓰지 않는다."""
    h = (x * 374761393 + y * 668265263 + k * 2147483647) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((h ^ (h >> 16)) & 0xFFFF) / 65536


def crown(P, seed: str = "forest-crown"):
    ramp = px.ramp(P["_leaf_hex"])
    r = random.Random(seed)
    W, H = STEP, STEP + LIFT
    cl = [(cx + r.uniform(-.6, .6), cy + r.uniform(-.5, .5), rad + r.uniform(-.3, .3), b) for cx, cy, rad, b in GBA_CLUMPS]
    tone = [[None] * W for _ in range(H)]
    for cx, cy, rad, bias in cl:
        wob = [r.uniform(-.12, .12) for _ in range(10)]
        for y in range(H):
            for x in range(W):
                dx, dy = x + .5 - cx, y + .5 - cy
                d = math.hypot(dx, dy)
                a = (math.atan2(dy, dx) + math.pi) / (2 * math.pi) * 10
                rr = rad * (1 + wob[int(a) % 10])
                if d > rr:
                    continue
                lt = -(dx * .62 + dy * .78) / rr + .05
                lt += (_hh(x // 2, y // 2, 11) - .5) * .42 + (_hh(x, y, 3) - .5) * .12   # 2px 잎 덩이로 단 경계를 흐트린다(선형 식은 사선 줄무늬가 됐다)
                t = 4 if lt > .66 else 3 if lt > .2 else 2 if lt > -.38 else 1
                t = max(1, min(4, t + bias))
                if d > rr - 1.3 and (dx * .6 + dy * .8) > .1 * rr:
                    t = 1
                tone[y][x] = t
    mask = [[tone[y][x] is not None for x in range(W)] for y in range(H)]
    out = px.new(W, H)
    for y in range(H):
        for x in range(W):
            if not mask[y][x]:
                continue
            t = tone[y][x]
            if any(not (0 <= X < W and 0 <= Y < H) or not mask[Y][X] for X, Y in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1))):
                out.putpixel((x, y), ramp[0])
                continue
            h = int(_hh(x, y, 29) * 23)                            # 잎 점 — 넓은 면이 판판하지 않게(해시: 격자 무늬가 안 생긴다)
            if t == 3 and h == 0:
                t = 4
            elif t == 2 and h == 1:
                t = 1
            elif t == 2 and h == 2:
                t = 3
            out.putpixel((x, y), ramp[t])
    return out, mask


def crown_scarloxy(P, seed: str = "forest-crown"):
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
