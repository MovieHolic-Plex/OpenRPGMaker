"""기후 숲 벽(9조각) — forest.py 의 격자 문법(2×2 칸 그루, 아래 그루 수관이 위 그루 밑동을 덮고, 줄기는 맨 아랫줄만)을 그대로 쓰고
수관 모양만 바꾼다. 눈 숲은 원뿔 침엽수(밝은 면 두 톤이 눈 — 빛이 닿는 왼쪽 위 가지 끝에 눈이 앉는다), 재 숲은 둥근 수관에 잿빛 잎 램프.
forest.py 의 forest_canvas 는 수관 함수를 받지 않아서 같은 절차를 여기 둔다(공유 파일은 고치지 않는다)."""
from __future__ import annotations

import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
import px  # noqa: E402
import tree as tr  # noqa: E402
import forest  # noqa: E402
from px import T  # noqa: E402

STEP = forest.STEP
LIFT = forest.LIFT


def cone_crown(P, seed: str = "snow-pine"):
    """원뿔 침엽수 수관(32×(32+LIFT)): 잎 무더기를 원뿔 안에 흩뿌리고, 단 끝마다 옆으로 내민 가지 덩이로 톱니를 만든다."""
    r = random.Random(seed)
    H = STEP + LIFT
    def half(y): return 1.5 + (y - 1) * 0.37
    pts: list[tuple[float, float]] = []
    for _ in range(1400):
        y = r.uniform(3, H - 5); h = half(y)
        x = 16 + r.uniform(-h + 2.5, h - 2.5)
        if all((x - a) ** 2 + ((y - b) * 1.3) ** 2 >= 4.8 ** 2 for a, b in pts):
            pts.append((x, y))
    centers: list[tuple] = [(x, y, r.uniform(3.6, 4.6), 1.3) for x, y in pts]
    for ty in (10.0, 18.5, 27.0, 35.0):                             # 단 끝 가지(가로로 납작) — 톱니 실루엣
        h = half(ty)
        centers.append((16 - h + 2.0, ty + 1.6, 2.6, 1.9))
        centers.append((16 + h - 2.0, ty + 1.6, 2.6, 1.9))
    centers.append((16, 3.5, 2.4, 0.9))
    centers += [(16, H - 7.0, 6.0, 1.9), (9, H - 6.0, 4.0, 1.6), (23, H - 6.0, 4.0, 1.6)]   # 밑단을 넓게 — 옆 그루와 맞닿는다
    canopy, mask = tr.cluster_canopy(STEP, H, centers, px.ramp(P["_leaf_hex"]), seed, 0.18, 0.85, 0.25)
    return canopy, mask


def forest_canvas(P, grass_px, cols: int, rows: int, crown_fn, seed: str):
    """forest.forest_canvas 와 같은 절차 — 수관 함수만 바꿔 끼운다. 반환 그림의 (0, T) 가 숲 영역 왼쪽 위 칸."""
    g = P["grass"]
    W = cols * STEP
    H = rows * STEP
    pad = T
    im = px.new(W, H + pad + T)
    for y in range(im.height):
        for x in range(W):
            im.putpixel((x, y), grass_px(x % T, y % T))
    P = dict(P); P["_leaf_ramp"] = px.ramp(P["_leaf_hex"])
    cv, mask = crown_fn(P, seed)
    union = [[False] * W for _ in range(im.height)]
    for j in range(rows):
        for i in range(cols):
            ox, oy = i * STEP, pad + j * STEP - LIFT
            for yy in range(len(mask)):
                for xx in range(STEP):
                    if mask[yy][xx] and 0 <= oy + yy < im.height:
                        union[oy + yy][ox + xx] = True
    lf = P["_leaf_ramp"]
    for y in range(im.height):
        for x in range(W):
            if union[y][x]:
                continue
            enclosed = y >= pad and any(union[y][xx] for xx in range(max(0, x - 13), x)) and any(union[y][xx] for xx in range(x + 1, min(W, x + 14))) \
                and y < pad + rows * STEP - 4                       # 솟은 수관 줄(y < pad)의 홈은 메우지 않는다 — 본 시트 forest_canvas 와 같은 규칙(I1 X3)
            if enclosed:                                        # 그루 사이 틈 = 숲 그늘(가장 어두운 잎색)
                im.putpixel((x, y), lf[0])
                continue
            near = any(0 <= y + dy < im.height and 0 <= x + dx < W and union[y + dy][x + dx]
                       for dy in range(-2, 3) for dx in range(-2, 3) if abs(dx) + abs(dy) <= 3)
            if near:
                im.putpixel((x, y), g[0] if (x * 3 + y) % 4 else g[1])     # 후광: 바닥의 그늘 톤(잎색이 바닥에 번지지 않게)
    for i in range(cols):
        ox, oy = i * STEP, pad + rows * STEP
        for y in range(oy - 3, oy + 5):
            for x in range(ox + 3, ox + 30):
                if 0 <= y < im.height and not union[y][x]:
                    d = ((x - ox - 16) / 12.5) ** 2 + ((y - oy - 1) / 3.0) ** 2
                    if d <= 1.0:
                        im.putpixel((x, y), g[0])
        forest.trunk(P, im, ox, oy - 3)
    for j in range(rows):
        for i in range(cols):
            im.alpha_composite(cv, (i * STEP, pad + j * STEP - LIFT))
    return im


def nine_slice(P, grass_px, prefix: str, crown_fn, seed: str):
    """3×3 그루 숲 → 9조각. 이름: {prefix}{tl,t,tr,l,c,r,bl,b,br}.{x}.{y} (kitlib Field.forest(prefix) 가 고른다)."""
    if crown_fn is forest.crown:                                    # 둥근 수관 숲 = 본 시트 숲 벽 조립 그대로(재 숲, I1 X3)
        im = forest.forest_canvas(P, grass_px, 3, 3, seed)
    else:
        im = forest_canvas(P, grass_px, 3, 3, crown_fn, seed)
    pad = T
    out = {}
    cols = {"l": 0, "": 1, "r": 2}
    for rk, (y0, y1) in {"t": (0, pad + STEP), "": (pad + STEP, pad + 2 * STEP), "b": (pad + 2 * STEP, pad + 3 * STEP + T)}.items():
        for ck, ci in cols.items():
            key = (rk + ck) or "c"
            x0 = ci * STEP
            for ty in range((y1 - y0) // T):
                for tx in range(2):
                    out[f"{prefix}{key}.{tx}.{ty}"] = im.crop((x0 + tx * T, y0 + ty * T, x0 + tx * T + T, y0 + ty * T + T))
    return out
