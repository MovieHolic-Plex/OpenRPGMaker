"""야외 필수 소품 — 기준 팩에서 잰 문법(돌은 바위 램프 5톤·왼쪽 위 빛·발밑 풀 자국·윤곽은 어두운 갈색)으로 직접 찍는다.
바위(밀기)·부술 수 있는 덤불·꽃·동서 턱·돌계단·나무다리. 그림은 전부 좌표/규칙 생성이고 기준 픽셀은 쓰지 않는다."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
import px  # noqa: E402
from px import T  # noqa: E402


def _grass(P, x, y):
    import monster_overworld as mo
    return mo._GRASS0[(x, y)]


def _base(P):
    im = px.new()
    for y in range(T):
        for x in range(T):
            im.putpixel((x, y), _grass(P, x, y))
    return im


def _lobes(shape):
    """원 몇 개의 합집합 마스크. shape = [(cx, cy, r)…]"""
    def inside(x, y):
        return any((x - cx) ** 2 + (y - cy) ** 2 <= r * r for cx, cy, r in shape)
    return inside


def boulder(P, variant: int):
    """밀 수 있는 바위: 돌덩이 둘~셋이 겹친 모양. 덩이마다 왼쪽 위가 밝고, 발밑에 풀이 한 줄 닿는다."""
    rk, g = P["rock"], P["grass"]
    lobes = [[(7.5, 6.5, 5.2), (4.2, 9.0, 3.6), (11.2, 9.2, 3.6)], [(7.0, 5.0, 4.0), (5.0, 9.5, 4.2), (10.8, 9.0, 3.8)]][variant % 2]
    inside = _lobes(lobes)
    im = _base(P)
    # 발밑 그림자 한 줄
    for x in range(2, 14):
        if inside(x, 12) or inside(x, 11):
            im.putpixel((x, 13), g[0])
    for y in range(T):
        for x in range(T):
            if not inside(x, y):
                continue
            edge = [not inside(x + dx, y + dy) for dx, dy in ((0, -1), (1, 0), (0, 1), (-1, 0))]
            # 이 점이 속한 덩이(중심이 가장 가까운 것)에 대한 빛
            cx, cy, r = min(lobes, key=lambda l: (x - l[0]) ** 2 + (y - l[1]) ** 2 - l[2] ** 2)
            lx, ly = (x - cx) / r, (y - cy) / r
            light = -(lx + ly)
            if edge[2] or edge[1]:
                c = rk[0]
            elif edge[0] or edge[3]:
                c = rk[1]
            elif light > 0.75:
                c = rk[4]
            elif light > 0.25:
                c = rk[3]
            elif light > -0.45:
                c = rk[2]
            else:
                c = rk[1]
            im.putpixel((x, y), c)
    # 아랫변에 닿은 풀 자국
    for x in range(3, 13):
        if inside(x, 11) and not inside(x, 12) and (x % 3 != 1):
            im.putpixel((x, 12), g[1] if x % 2 else g[0])
    return im


def bush(P, variant: int):
    """부술 수 있는(자르는) 작은 덤불: 나무 수관과 같은 잎 램프, 밑에 작은 밑동."""
    lf, tr, g = P["leaf"], P["trunk"], P["grass"]
    inside = _lobes([(8, 7, 5.4), (4.8, 8.8, 3.2), (11.2, 8.8, 3.2), (8, 4.6, 3.4)])
    im = _base(P)
    r = px.rng(f"bush{variant}")
    for y in range(T):
        for x in range(T):
            if not inside(x, y):
                continue
            edge = [not inside(x + dx, y + dy) for dx, dy in ((0, -1), (1, 0), (0, 1), (-1, 0))]
            if edge[2] or edge[1]:
                c = lf[0]
            elif edge[0] or edge[3]:
                c = lf[1]
            else:
                light = -((x - 8) + (y - 7)) / 6
                c = lf[4] if light > 0.7 and r.random() < 0.6 else lf[3] if light > 0.15 else lf[2] if light > -0.5 else lf[1]
                if r.random() < 0.08:
                    c = lf[1]
            im.putpixel((x, y), c)
    for x in (7, 8):
        for y in (12, 13):
            im.putpixel((x, y), tr[1] if y == 12 else tr[0])
    for x in (4, 5, 10, 11):
        im.putpixel((x, 13), g[0])
    return im


def flowers(P, kind: str):
    """꽃밭: 줄기 3~4개와 작은 꽃. 풀밭 위에 올리는 장식(통행 가능)."""
    g, pk, pl, gd = P["grass"], P["pink"], P["plaster"], P["gold"]
    cols = {"pink": (pk[1], pk[0]), "white": (pl[1], pl[0]), "yellow": (gd[1], gd[0])}
    f, f2 = cols[kind]
    im = _base(P)
    for i, (x, y) in enumerate(((3, 4), (10, 3), (6, 10), (12, 11))):
        px.put(im, x, y + 1, g[0]); px.put(im, x, y + 2, g[0])               # 줄기
        px.put(im, x - 1, y + 2, g[1]); px.put(im, x + 1, y + 2, g[1])        # 잎
        for dx, dy in ((0, 0), (-1, 0), (1, 0), (0, -1)):
            px.put(im, x + dx, y + dy, f)                                    # 꽃잎
        px.put(im, x, y, f2)                                                  # 꽃심
        px.put(im, x - 1, y - 1, f) if i % 2 == 0 else None
    return im


def ledge_side(P, side: str):
    """동·서 턱: 세로로 줄지어 앉은 낮은 돌 둔덕. 떨어지는 쪽(side)으로 그림자가 드리운다. 빛은 왼쪽 위."""
    rk, g = P["rock"], P["grass"]
    im = _base(P)
    r = px.rng("ledge-v")
    wob = [r.randint(0, 1) for _ in range(T)]
    # east = 오른쪽으로 떨어짐 → 돌 띠는 왼쪽(x 3~8), west = 오른쪽 띠(x 7~12)
    x_lo, x_hi = (3, 8) if side == "e" else (7, 12)
    for y in range(T):
        end = y < 2 or y > T - 3
        for x in range(x_lo + wob[y], x_hi + 1 - (1 if end else 0)):
            c = _rock_px(P, x + 5, y)
            if x == x_lo + wob[y]:
                c = rk[4] if y % 3 == 0 else rk[3]
            if x == x_hi - (1 if end else 0):
                c = rk[0]
            elif x >= x_hi - 1 and c in (rk[2], rk[3], rk[4]):
                c = rk[1]
            if end and (y in (0, T - 1)):
                continue
            im.putpixel((x, y), c)
        sx = x_hi + 1 if side == "e" else x_lo - 1
        for k in range(1, 3):
            xx = sx + k - 1 if side == "e" else sx - k + 1
            if 0 <= xx < T and not (end and y in (0, T - 1)):
                im.putpixel((xx, y), g[0] if (xx + y) % 2 else g[1])
    return im


def _rock_px(P, x, y):
    import monster_overworld as mo
    return mo.rock_px(P, x, y)


def stairs(P, part: str):
    """돌계단(앞에서 본 모습): 수평 단 3개. 단마다 윗면이 밝고 앞면(수직)이 어둡다. 양옆은 돌 둑이 낀다."""
    st, rk = P["steel"], P["rock"]
    im = _base(P)
    for y in range(T):
        for x in range(T):
            im.putpixel((x, y), rk[2])
    # 단: 윗면 3행(밝음) + 앞면 2행(어둠), 한 단 높이 5행
    for k in range(3):
        y0 = k * 5 + 1
        for y in range(y0, y0 + 5):
            for x in range(1, T - 1):
                if y < y0 + 3:
                    c = st[3] if k == 0 else st[2] if (x + y) % 5 else st[3]
                    c = st[2] if y == y0 + 2 else (st[3] if y == y0 else c)
                else:
                    c = st[1] if y == y0 + 3 else st[0]
                im.putpixel((x, y), c)
    for y in range(T):
        im.putpixel((0, y), rk[0]); im.putpixel((T - 1, y), rk[0])
    for x in range(T):
        im.putpixel((x, 0), rk[1]) if False else None
    return im


def bridge(P, orient: str):
    """나무다리. h = 동서로 건너는 다리(널은 세로로 놓임, 위아래 난간), v = 남북(널은 가로, 좌우 난간). 널 틈으로 물이 보인다."""
    wd, w = P["wood"], P["water"]
    im = px.new()
    if orient == "h":
        for y in range(T):
            for x in range(T):
                if 3 <= y <= 12:
                    plank = (x % 5) != 4
                    c = (wd[3] if y < 6 else wd[2]) if plank else wd[0]
                    if plank and x % 5 == 0:
                        c = wd[3] if y > 5 else wd[3]
                    im.putpixel((x, y), c)
        for x in range(T):
            for y in (1, 2):
                im.putpixel((x, y), wd[1] if y == 2 else wd[3])
            for y in (13, 14):
                im.putpixel((x, y), wd[0] if y == 14 else wd[1])
            for y in (3,):
                im.putpixel((x, y), wd[0])
        for x in (0, 8):
            for y in range(0, 4):
                im.putpixel((x, y), wd[0]); im.putpixel((x + 1, y), wd[1])
            for y in range(12, 16):
                im.putpixel((x, y), wd[0]); im.putpixel((x + 1, y), wd[1])
    else:
        for y in range(T):
            for x in range(T):
                if 3 <= x <= 12:
                    plank = (y % 5) != 4
                    c = (wd[3] if x < 6 else wd[2]) if plank else wd[0]
                    im.putpixel((x, y), c)
        for y in range(T):
            for x in (1, 2):
                im.putpixel((x, y), wd[3] if x == 1 else wd[2])
            for x in (13, 14):
                im.putpixel((x, y), wd[1] if x == 13 else wd[0])
            for x in (3,):
                im.putpixel((x, y), wd[0])
        for y in (0, 8):
            for x in range(0, 4):
                im.putpixel((x, y), wd[0]); im.putpixel((x, y + 1), wd[1])
            for x in range(12, 16):
                im.putpixel((x, y), wd[0]); im.putpixel((x, y + 1), wd[1])
    return im
