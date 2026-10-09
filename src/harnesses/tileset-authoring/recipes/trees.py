"""몬스터 수집 야외 나무 — 높이장 조명(lib/tree.py)으로 잎 덩어리를 쌓고, 줄기·뿌리·발밑 풀 자국을 손으로 얹는다."""
from __future__ import annotations

import math
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
import px  # noqa: E402
import tree as tr  # noqa: E402

W, H = 32, 48


def ground_patch(im, P, cx=16, cy=43, rx=14.5, ry=4.8):
    g = P["leaf"]
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2
            if d <= 1.0:
                px.put(im, x, y, g[3] if d > 0.62 else g[2])


def trunk_and_roots(im, P):
    t = P["trunk"]  # [7d370f, a84e1a, bf6c27, db9138]
    hi = px.hexc("#f9bc4c")
    cx = 16
    rows = []
    for y in range(31, 47):
        if y < 37:
            half = 2.6
        elif y < 42:
            half = 2.6 + (y - 36) * 0.75
        else:
            half = max(0.8, 6.3 - (y - 41) * 1.1)
        rows.append((y, half))
    for y, half in rows:
        for x in range(int(cx - half - 1), int(cx + half + 1)):
            rel = (x + 0.5 - cx) / half
            if abs(rel) > 1.0:
                continue
            c = t[3] if rel < -0.2 else t[2] if rel < 0.5 else t[1]
            if rel < -0.8 or (y >= 44 and abs(rel) > 0.6):
                c = t[0]
            px.put(im, x, y, c)
    for y, half in rows:  # 아래쪽 가장자리 윤곽
        px.put(im, cx, y, im.getpixel((cx, y)))
    px.put(im, cx - 2, 40, hi); px.put(im, cx - 1, 40, hi); px.put(im, cx - 2, 41, hi)
    px.put(im, cx - 1, 43, hi); px.put(im, cx, 43, hi); px.put(im, cx - 1, 44, hi)
    px.rect(im, cx - 1, 46, cx, 46, t[0])


def poisson(r: random.Random, rx: float, ry: float, cx: float, cy: float, mind: float, tries: int = 900):
    pts: list[tuple[float, float]] = []
    for _ in range(tries):
        x = cx + r.uniform(-rx, rx); y = cy + r.uniform(-ry, ry)
        if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 > 1.0:
            continue
        if all((x - a) ** 2 + (y - b) ** 2 >= mind * mind for a, b in pts):
            pts.append((x, y))
    return pts


REF_SHARES = (0.09, 0.23, 0.36, 0.25, 0.07)  # study 로 잰 기준 둥근 나무 잎의 톤 비중(암~명)


def round_tree(P, seed: str = "round-a", shares=REF_SHARES, noise_amp=0.30, ao=0.9, mind=3.6):
    r = random.Random(seed)
    f = tr.Field(W, 37)
    # 받침: 큰 덩어리 몇 개로 실루엣을 잡고, 그 위에 작은 잎 무더기를 흩뿌려 가장자리를 울퉁불퉁하게
    for cx, cy, rx, ry, hh in ((16, 17, 12.5, 13, 5), (9, 22, 8, 8, 4), (23, 22, 8, 8, 4), (16, 29, 10, 6, 4)):
        f.lump(cx, cy, rx, ry, hh, 0.8)
    for x, y in poisson(r, 14.2, 17.0, 16, 17.5, mind):
        rad = r.uniform(3.0, 4.6)
        f.lump(x, y, rad * 1.1, rad, rad * 0.95, 0.8)
    canopy, mask = tr.shade(f, px.ramp(P["_leaf_hex"]), seed, shares, noise_amp=noise_amp, ao_amp=ao)
    im = px.new(W, H)
    ground_patch(im, P, 16, 42, 13.0, 5.0)
    trunk_and_roots(im, P)
    im.alpha_composite(canopy, (0, 0))
    return im


def _dome_clip(canopy, ramp):
    """수관 돔 외곽(적대 검수 L4 N52 · L5 N59 — 상자 변에 잘리거나, 반지름만 깎아 혹·절벽이 남았다):
    무더기를 다 얹은 뒤 위쪽·옆을 타원(중심 15.5,17 · 반지름 14.5×16, 상자 안쪽 1px)으로 자른다. 원작 외딴 나무처럼 위는 둥근 돔이고,
    아래 반은 세로로 늘인 타원이라 옆만 매끈하게 좁히고 밑 끝은 잎 덩이 물결 그대로 둔다. 잘린 변은 다시 윤곽을 친다 — 오른쪽·아래는 최암,
    빛 쪽(왼쪽·위)은 암(원작도 빛 쪽에 윤곽이 있다)."""
    w, h = canopy.size
    def inside(x, y):
        if not (1 <= x <= w - 2 and 0 <= y < h):
            return False
        if canopy.getpixel((x, y))[3] == 0:
            return False
        ry = 16.0 if y < 17 else 22.0                                   # 아래 반은 길게 늘인 타원 — 옆은 매끈하게 좁아지고 밑 끝은 잎 덩이 물결 그대로
        return ((x + 0.5 - 15.5) / 14.5) ** 2 + ((y + 0.5 - 17.0) / ry) ** 2 <= 1.0
    out = px.new(w, h)
    for y in range(h):
        for x in range(w):
            if not inside(x, y):
                continue
            c = canopy.getpixel((x, y))
            cut = [not inside(x + dx, y + dy) and canopy.getpixel((min(w - 1, max(0, x + dx)), min(h - 1, max(0, y + dy))))[3] for dx, dy in ((1, 0), (0, 1), (-1, 0), (0, -1))]
            if cut[0] or cut[1]:
                c = ramp[0] if (x + y) % 4 else ramp[1]
            elif (cut[2] or cut[3]) and (x + y) % 2:
                c = ramp[1]
            out.putpixel((x, y), c)
    return out


def round_tree_c(P, seed: str = "round-a", mind: float = 5.0, rmin: float = 4.2, rmax: float = 6.0, lit_bias: float = 0.0, vslope: float = 0.7, hslope: float = 0.35):
    """클러스터 방식 둥근 나무(32×48): 돔 안에 잎 무더기를 흩뿌린다."""
    r = random.Random(seed)
    # 돔 가장자리에서 반지름 만큼 안쪽에 중심을 둬 실루엣이 덩이 모양으로 끝나게 한다
    pts = poisson(r, 14.0, 13.4, 16, 16.4, mind)
    centers = [(x, y, r.uniform(rmin, rmax)) for x, y in pts]
    # 구멍 방지: 안쪽 큰 덩이 몇 개
    centers += [(16, 12, 7.5), (9, 19, 6.5), (23, 19, 6.5), (16, 25, 8.5), (8, 27, 5), (24, 27, 5)]
    canopy, mask = tr.cluster_canopy(W, 37, centers, px.ramp(P["_leaf_hex"]), seed, lit_bias, vslope, hslope)
    canopy = _dome_clip(canopy, px.ramp(P["_leaf_hex"]))
    im = px.new(W, H)
    ground_patch(im, P, 16, 42, 13.0, 5.0)
    import forest as fo                                              # 외딴 나무 줄기 = 숲 줄기(같은 메타타일, L6 N67c) — 8px 곧은 그루터기 + 짙은 밑선
    fo.trunk(P, im, 0, 34)                                           # 수관 밑끝(y34~35) 바로 아래서 보이기 시작(L7 N71: 1px 풀 틈)
    im.alpha_composite(canopy, (0, 0))
    return im


def pine_tree_tiers(P, seed: str = "pine-a"):
    """침엽수(32×48): 가로로 납작한 잎 단 네 개를 위에서 아래로 겹쳐 쌓는다. 단마다 폭이 늘다가 다음 단에서 한 번 안쪽으로 꺾여
    톱니 실루엣이 되고, 단 밑에 어두운 선반 그림자가 진다. 빛은 왼쪽 위: 단의 왼쪽이 밝고 오른쪽이 어둡다."""
    import math
    r = random.Random(seed)
    lf = px.ramp(P["_leaf_hex"])
    cx = 16
    nz = tr.value_noise(W, 44, 2.1, seed)
    nz2 = tr.value_noise(W, 44, 4.5, seed + "x")
    im = px.new(W, H)
    canopy = px.new(W, 44)
    # 단: (위, 아래, 위쪽 반폭, 아래쪽 반폭). 다음 단은 앞 단 바닥 폭보다 안쪽에서 시작해 단마다 계단(톱니) 실루엣이 생긴다
    spans = [(0, 11, 0.8, 4.8), (8, 21, 2.2, 8.6), (17, 31, 4.6, 12.2), (26, 41, 8.0, 15.4)]
    widths: dict[int, float] = {}
    for ti, (top, bot, w0, w1) in reversed(list(enumerate(spans))):   # 아래 단부터 — 위 단이 아래 단 위로 늘어진다
        jit = []
        cur = 0
        for _ in range(bot - top + 2):
            if r.random() < 0.55:
                cur = max(-2, min(2, cur + r.choice((-1, 1))))
            jit.append(cur)
        for y in range(top, bot + 1):
            v = (y - top) / max(1, bot - top)
            v = (y - top) / max(1, bot - top)
            hw = min(15.4, spans[ti][2] + (spans[ti][3] - spans[ti][2]) * (v ** 0.85) + jit[y - top] * 0.75)
            for x in range(max(0, int(cx - hw - 1)), min(W, int(cx + hw + 2))):
                u = (x + 0.5 - cx) / max(hw, 1)
                if abs(u) > 1.0:
                    continue
                # 단 아래 가장자리: 5px 주기의 늘어진 가지(갈래) — 갈래 가운데가 길고 사이는 짧다
                lobe = 2 - abs(((x + ti * 2) % 5) - 2)
                if y > bot - 2 + lobe * 0.5 - 1:
                    continue
                light = -0.70 * u - 0.34 * v + (nz[y][x] - 0.5) * 0.95 + (nz2[y][x] - 0.5) * 0.5 + 0.27
                tone = 4 if light > 0.5 else 3 if light > 0.18 else 2 if light > -0.14 else 1
                if y >= bot - 3 + lobe * 0.5 - 1:     # 갈래 끝 그림자
                    tone = 0 if y >= bot - 2 + lobe * 0.5 - 1 - 0 else 1
                if u > 0.88:                           # 오른쪽 가장자리
                    tone = 0 if tone < 3 else 1
                elif u < -0.9:                         # 왼쪽 가장자리는 선 없이 잎색
                    tone = max(2, tone)
                canopy.putpixel((x, y), lf[tone])
    ground_patch(im, P, 16, 43, 13.0, 4.6)
    t = P["trunk"]; hi = px.hexc("#f9bc4c")
    for yy, half in ((39, 2.4), (40, 3.4), (41, 4.4), (42, 5.2), (43, 5.2), (44, 4.0), (45, 2.4)):
        for x in range(int(16 - half - 1), int(16 + half + 1)):
            rel = (x + 0.5 - 16) / half
            if abs(rel) > 1:
                continue
            c = t[3] if rel < -0.25 else t[2] if rel < 0.5 else t[1]
            if rel < -0.8 or yy >= 44:
                c = t[0]
            px.put(im, x, yy, c)
    px.put(im, 14, 41, hi); px.put(im, 15, 41, hi); px.put(im, 14, 42, hi)
    px.rect(im, 15, 46, 16, 46, t[0])
    im.alpha_composite(canopy, (0, 0))
    return im


def pine_tree_c(P, seed: str = "pine-a", lit_bias: float = 0.2, vslope: float = 0.9, hslope: float = 0.1, mind: float = 5.4, rmin: float = 4.2, rmax: float = 5.4):
    """클러스터 침엽수(32×48): 원뿔 안에 잎 무더기를 흩뿌리고, 단 끝마다 옆으로 내민 가지 무더기(가로로 납작)를 얹어 톱니를 만든다."""
    r = random.Random(seed)
    centers: list[tuple] = []
    # 원뿔: 위 y=3 에서 반폭 1, 아래 y=36 에서 반폭 14
    def half(y): return 1.2 + (y - 2) * 0.38
    pts = []
    for _ in range(1200):
        y = r.uniform(3, 36); h = half(y)
        x = 16 + r.uniform(-h, h)
        if all((x - a) ** 2 + ((y - b) * 1.25) ** 2 >= mind * mind for a, b in pts):
            pts.append((x, y))
    for x, y in pts:
        centers.append((x, y, r.uniform(rmin, rmax), 1.25))
    for ty in (12.0, 20.0, 28.0, 35.0):           # 단 끝 가지: 폭 방향으로 길쭉
        h = half(ty)
        centers.append((16 - h + 0.6, ty + 1.8, 2.5, 1.9))
        centers.append((16 + h - 0.6, ty + 1.8, 2.5, 1.9))
    centers.append((16, 4.5, 2.6, 0.9))
    canopy, mask = tr.cluster_canopy(W, 41, centers, px.ramp(P["_leaf_hex"]), seed, lit_bias, vslope, hslope)
    im = px.new(W, H)
    ground_patch(im, P, 16, 43, 13.0, 4.6)
    t = P["trunk"]; hi = px.hexc("#f9bc4c")
    for yy, hf in ((39, 2.4), (40, 3.4), (41, 4.4), (42, 5.2), (43, 5.2), (44, 4.0), (45, 2.4)):
        for x in range(int(16 - hf - 1), int(16 + hf + 1)):
            rel = (x + 0.5 - 16) / hf
            if abs(rel) > 1:
                continue
            c = t[3] if rel < -0.25 else t[2] if rel < 0.5 else t[1]
            if rel < -0.8 or yy >= 44:
                c = t[0]
            px.put(im, x, yy, c)
    px.put(im, 14, 41, hi); px.put(im, 15, 41, hi); px.put(im, 14, 42, hi)
    px.rect(im, 15, 46, 16, 46, t[0])
    im.alpha_composite(canopy, (0, 0))
    return im


def pine_tiered(P, seed: str = "pine-t"):
    """층진 침엽수(32×48, 적대 검수 L1 N12 — 둥근 덤불 두 덩이로 읽혔다): 세 단의 삼각 치마. 아래 단부터 그리고 윗단이 앞으로 덮는다.
    단마다 윗변 2px 은 밝은 톤(빛 받는 왼쪽은 최명), 몸은 왼쪽 밝음 → 오른쪽 최암, 밑단은 4px 주기 톱니 잎 끝(최암),
    윗단 톱니 바로 밑 아래 단 1px 는 최암 그림자. 바늘결은 9px 주기 대각 점 한 톤 어둡게. 줄기는 밑단 아래로 6px 보인다."""
    lf = px.ramp(P["_leaf_hex"])
    t = P["trunk"]
    r = random.Random(seed)
    tiers = [(1, 15 + r.choice((0, 1)), 8.4 + r.uniform(-0.4, 0.4)), (7, 26 + r.choice((0, 1)), 12.4 + r.uniform(-0.5, 0.5)),
             (15, 37 + r.choice((0, 1)), 15.4 + r.uniform(-0.4, 0.2))]
    im = px.new(W, H)
    for y in range(37, 48):                                          # 발밑 그늘(침엽수는 잎이 빽빽해 둥근 나무보다 한 톤 짙다)
        for x in range(2, 31):
            d = ((x + 0.5 - 16) / 12.0) ** 2 + ((y + 0.5 - 43) / 4.2) ** 2
            if d <= 1.0:
                px.put(im, x, y, lf[3] if d > 0.7 else lf[2])
    for y in range(33, 46):                                          # 줄기: 4px, 밑동은 벌어진다
        half = 2.0 if y < 42 else 2.0 + (y - 41) * 0.8
        for x in range(int(16 - half - 1), int(16 + half + 1)):
            rel = (x + 0.5 - 16) / half
            if abs(rel) > 1:
                continue
            c = t[3] if rel < -0.4 else t[2] if rel < 0.3 else t[1]
            if rel > 0.7 or y == 45:
                c = t[0]
            px.put(im, x, y, c)
    cv = px.new(W, H)
    owner = [[-1] * W for _ in range(H)]
    bot_edge = [[False] * W for _ in range(H)]
    for ti in (2, 1, 0):
        top, bot, half = tiers[ti]
        def hw(y, top=top, bot=bot, half=half):
            tt = (y - top) / (bot - top)
            return 0.8 + (half - 0.8) * max(0.0, tt) ** 0.85
        def bottom(x, ti=ti, bot=bot, half=half):
            u = (x + 0.5 - 16) / half
            k = (x + ti * 2) % 6
            return bot - (1 if k in (1, 2) else 0) + round(1.0 * u * u)
        cols: dict[int, int] = {}
        for y in range(top, min(H, bot + 3)):
            for x in range(W):
                if abs(x + 0.5 - 16) > hw(min(y, bot)) or y > bottom(x):
                    continue
                cols.setdefault(x, y)
                depth = y - cols[x]
                u = (x + 0.5 - 16) / max(1.0, hw(min(y, bot)))
                tt = (y - top) / (bot - top)
                v = u + 1.3 * tt - 0.62 * (2 - ti) + 0.2                  # 왼쪽·위가 밝다. 윗단도 아래 단과 같은 중간 녹색이 바탕(L2 N36 — 맨 위 단이 풀색으로 흐려졌다)
                tone = 4 if v < -0.6 else 3 if v < 0.45 else 2 if v < 1.15 else 1
                if depth <= 1:
                    tone = min(4, tone + 1)                                # 단 윗변 2px 은 한 톤 밝게
                elif (x * 3 + y * 5 + ti) % 13 == 0 and tone >= 3:
                    tone -= 1                                              # 바늘결(밝은 면에만 드문드문)
                c = lf[tone]
                if y == bottom(x):
                    c = lf[0] if u > -0.4 else lf[1]
                left_out = abs(x - 0.5 - 16) > hw(min(y, bot))
                right_out = abs(x + 1.5 - 16) > hw(min(y, bot))
                if right_out and u > 0:
                    c = lf[0]                                              # 윤곽은 끊기지 않는 1px(점선이면 꼭대기가 흐리게 사라진다)
                elif left_out and u < 0 and (ti == 0 or (y + ti) % 2 == 0):
                    c = lf[1]                                              # 맨 윗단은 빛 쪽 윤곽도 이어 그린다(꼭대기가 풀에 녹지 않게)
                cv.putpixel((x, y), c)
                owner[y][x] = ti
                bot_edge[y][x] = y == bottom(x)
    for y in range(1, H):                                            # 윗단 톱니 밑 = 아래 단 위 1px 최암 그림자
        for x in range(W):
            if owner[y][x] >= 0 and owner[y - 1][x] >= 0 and owner[y - 1][x] < owner[y][x] and bot_edge[y - 1][x]:
                cv.putpixel((x, y), lf[0])
    px.put(cv, 15, 1, lf[3]); px.put(cv, 16, 1, lf[2]); px.put(cv, 15, 0, lf[1])   # 꼭대기 순
    im.alpha_composite(cv, (0, 0))
    return im
