"""야생 시트 공용 도구 — 바닥 바꿔 끼우기, 변마다 깊이가 다른 오토타일 마스크, 둑이 있는 물 오토타일.

공유 레시피(outdoor2·forest)는 바탕 풀을 monster_overworld._GRASS0 에서 읽는다. 숲 바닥·산 바닥·늪 바닥 위에 같은 화풍의
턱·키 큰 풀을 찍으려고 그 사전을 잠깐 바꿔 끼운다(`ground_as`). 공유 파일은 고치지 않는다."""
from __future__ import annotations

import contextlib
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
import px  # noqa: E402
from px import N, E, S, W, NE, SE, SW, NW, T  # noqa: E402
import monster_overworld as mo  # noqa: E402

SHADOW = (0, 0, 0, 64)


def ramp(P, key):
    return P[key]


def tex_px(im):
    """그림 → (x,y) 함수."""
    return lambda x, y: im.getpixel((x % T, y % T))


@contextlib.contextmanager
def ground_as(im):
    """공유 레시피가 바탕으로 읽는 풀 칸을 im 으로 잠깐 바꾼다."""
    old = dict(mo._GRASS0)
    for y in range(T):
        for x in range(T):
            mo._GRASS0[(x, y)] = im.getpixel((x, y))
    try:
        yield
    finally:
        mo._GRASS0.clear()
        mo._GRASS0.update(old)


def quiet_floor(name, ramp4, v):
    """조용한 바닥: 바탕(ramp4[1]) + 밝은 두 톤 덩이 + 아주 드문 어두운 덩이(변형 3만)."""
    d, b, l1, l2 = ramp4
    acc = [(l1, 15 + v, 3), (l2, 5, 2)]
    if v == 3:
        acc.append((d, 2, 2))
    return px.clumps(f"{name}{v}", b, acc)


# ---- 변마다 깊이가 다른 마스크 --------------------------------------------------------------------
def mask4(m: int, name: str, dn: int, ds: int, dw: int, de: int, radius: int = 2, amp: int = 1, fillet: int = 0):
    """px.inside_mask 와 같은 규칙(흔들림 주기 16·모서리 둥글기·안쪽 모서리 깎기)인데 북·남·서·동 깊이가 따로다.
    물가 북쪽 둑(흙 앞면이 보인다)은 두껍고 남쪽은 얇다 — 3/4 시점."""
    jn = px.edge_jitter(name, "ns", amp)
    jw = px.edge_jitter(name, "ew", amp)
    cut_n = lambda x, y: y < dn + jn[x]
    cut_s = lambda x, y: y > T - 1 - (ds + jn[(T - 1 - x) % T])
    cut_w = lambda x, y: x < dw + jw[y]
    cut_e = lambda x, y: x > T - 1 - (de + jw[(T - 1 - y) % T])
    inside = [[True] * T for _ in range(T)]
    for y in range(T):
        for x in range(T):
            if (not m & N and cut_n(x, y)) or (not m & S and cut_s(x, y)) or (not m & W and cut_w(x, y)) or (not m & E and cut_e(x, y)):
                inside[y][x] = False
    corners = ((N | W, 0, 0, 1, 1, dn, dw), (N | E, T - 1, 0, -1, 1, dn, de), (S | W, 0, T - 1, 1, -1, ds, dw), (S | E, T - 1, T - 1, -1, -1, ds, de))
    for bits, cx, cy, sx, sy, d1, d2 in corners:
        if m & bits:
            continue
        r = max(d1, d2) + radius
        ox, oy = cx + sx * r, cy + sy * r
        for dy in range(min(r, T - 1) + 1):
            for dx in range(min(r, T - 1) + 1):
                x, y = cx + sx * dx, cy + sy * dy
                if (x - ox) ** 2 + (y - oy) ** 2 > r * r + 1:
                    inside[y][x] = False
    notches = ((N | E, NE, cut_n, cut_e), (N | W, NW, cut_n, cut_w), (S | E, SE, cut_s, cut_e), (S | W, SW, cut_s, cut_w))
    for sides, diag, ca, cb in notches:
        if (m & sides) == sides and not m & diag:
            for y in range(T):
                for x in range(T):
                    if ca(x, y) and cb(x, y):
                        inside[y][x] = False
    if fillet:
        # 안쪽 모서리 둥글리기: 깎인 사각의 안쪽 꼭짓점 둘레를 반지름 fillet 로 더 깎는다(칸 경계 줄은 건드리지 않는다 — 이음새 유지)
        for (sides, diag), (fx, fy, d1, d2) in zip(((N | E, NE), (N | W, NW), (S | E, SE), (S | W, SW)),
                                                  ((1, 0, de, dn), (0, 0, dw, dn), (1, 1, de, ds), (0, 1, dw, ds))):
            if (m & sides) == sides and not m & diag and d1 > 0 and d2 > 0:
                r = fillet
                cxp = d1 + r - 0.5                 # 원 중심(모서리 좌표계: 바깥 꼭짓점이 (0,0))
                cyp = d2 + r - 0.5
                for yy in range(d2, min(T - 1, d2 + r)):
                    for xx in range(d1, min(T - 1, d1 + r)):
                        if (xx - cxp) ** 2 + (yy - cyp) ** 2 > r * r:
                            x = xx if not fx else T - 1 - xx
                            y = yy if not fy else T - 1 - yy
                            inside[y][x] = False
    return inside


def dist_out(inside, m, x, y, reach=4):
    """(x,y)(안쪽 점)에서 가장 가까운 바깥 점까지의 맨해튼 거리(reach 까지). 칸 밖은 이웃 비트로 본다."""
    best = reach + 1
    for dy in range(-reach, reach + 1):
        for dx in range(-reach, reach + 1):
            d = abs(dx) + abs(dy)
            if d >= best:
                continue
            xx, yy = x + dx, y + dy
            if 0 <= xx < T and 0 <= yy < T:
                out = not inside[yy][xx]
            else:
                sx = -1 if xx < 0 else 1 if xx >= T else 0
                sy = -1 if yy < 0 else 1 if yy >= T else 0
                cx, cy = min(T - 1, max(0, xx)), min(T - 1, max(0, yy))
                if sx == 0 or sy == 0:
                    out = not (m & {(0, -1): N, (1, 0): E, (0, 1): S, (-1, 0): W}[(sx, sy)]) or not inside[cy][cx]
                else:
                    diag, both = {(1, -1): (NE, N | E), (-1, -1): (NW, N | W), (1, 1): (SE, S | E), (-1, 1): (SW, S | W)}[(sx, sy)]
                    out = not (bool(m & diag) and (m & both) == both)
            if out:
                best = d
    return best


# ---- 둑이 있는 물(늪·강) ------------------------------------------------------------------------------
# (outer: 둑 바깥 경계, inner: 물 경계) — 둑 띠 = outer 안 & inner 밖. 북쪽 둑이 두껍다(흙 앞면).
BANK = {
    "outer": dict(dn=1, ds=1, dw=1, de=1, radius=3, amp=1),
    "inner": dict(dn=5, ds=2, dw=3, de=3, radius=3, amp=1),
}


def bank_masks(prefix: str):
    o, i = BANK["outer"], BANK["inner"]
    return ({m: mask4(m, f"{prefix}-o", **o) for m in px.ALL47}, {m: mask4(m, f"{prefix}-i", **i) for m in px.ALL47})


def water_tex(w, x, y, f, seeds):
    """mo.water_px 와 같은 그물 물결(시드 다름) — 늪은 탁한 램프로 같은 문법."""
    ss = [((sx + 1.4 * math.cos(math.pi / 2 * f + i * 1.3)) % T, (sy + 1.4 * math.sin(math.pi / 2 * f + i * 1.3)) % T) for i, (sx, sy) in enumerate(seeds)]
    d1, d2, _, _ = px.voronoi(ss, x + 0.5, y + 0.5)
    b = d2 - d1
    if b < 0.95:
        return w[3]
    if b < 1.7 and (x * 7 + y * 3) % 5 < 2:
        return w[2]
    return w[1] if (x + y * 2) % 11 == 0 else w[0]


def bank_water(m: int, f: int, prefix: str, water, bank, ground_px, seeds, masks, tex_ramp=None):
    """물 오토타일 한 칸. water = 물 램프 4톤(어두움→밝음), bank = 둑 램프 3톤(최암·중간·밝음), ground_px = 바깥 땅.
    북쪽(물 위쪽) 둑은 흙 앞면 3줄(밝은 윗선 → 중간 → 최암 물선), 옆·남쪽은 얇은 윤곽. 물 가장자리 한 줄은 밝은 물빛."""
    outer, inner = masks[0][m], masks[1][m]
    im = px.new()
    for y in range(T):
        for x in range(T):
            if inner[y][x]:
                c = water_tex(tex_ramp or water, x, y, f, seeds)
                d = dist_out(inner, m, x, y, 2)
                if d == 1:
                    c = water[3] if (x + y + f) % 3 else water[2]
                elif d == 2 and (x * 3 + y + f) % 4 == 0:
                    c = water[2]
                im.putpixel((x, y), c)
            elif outer[y][x]:
                # 둑 띠: 위쪽(물이 아래)에 있으면 흙 앞면, 아니면 얇은 윤곽
                below_water = any((0 <= y + k < T and inner[y + k][x]) or (y + k >= T and m & S and inner[T - 1][x]) for k in range(1, 5))
                above_water = any((0 <= y - k < T and inner[y - k][x]) for k in range(1, 4))
                dw = dist_out(outer, m, x, y, 3)
                if below_water and not above_water:
                    # 물에서 몇 줄 위인가
                    k = next((k for k in range(1, 6) if 0 <= y + k < T and inner[y + k][x]), 5)
                    c = bank[0] if k == 1 else bank[1] if k <= 3 else bank[2]
                    if dw == 1:
                        c = bank[2]
                else:
                    c = bank[0] if dw >= 2 else bank[1]
                im.putpixel((x, y), c)
            else:
                im.putpixel((x, y), ground_px(x, y))
    return im


def lobes(shape):
    return lambda x, y: any((x - cx) ** 2 + (y - cy) ** 2 <= r * r for cx, cy, r in shape)


def shade_obj(im, inside, lit_c, mid_c, dark_c, ol_c, cx, cy, rad, hi_c=None):
    """덩이 물체 칠하기: 오른쪽·아래 외곽은 최암, 위·왼쪽 외곽은 한 단 어둠, 안은 왼쪽 위가 밝다."""
    for y in range(im.height):
        for x in range(im.width):
            if not inside(x, y):
                continue
            edge = [not inside(x + dx, y + dy) for dx, dy in ((0, -1), (1, 0), (0, 1), (-1, 0))]
            light = -((x - cx) + (y - cy)) / rad
            if edge[1] or edge[2]:
                c = ol_c
            elif edge[0] or edge[3]:
                c = dark_c
            else:
                c = (hi_c if hi_c and light > 0.85 else lit_c) if light > 0.25 else mid_c if light > -0.45 else dark_c
            im.putpixel((x, y), c)
    return im


def forest_singles(P, grass_px, seed):
    """9조각 숲에 없는 외줄 조각: 외줄 가로(sl·sc·sr, 위 솟은 수관 + 2줄 + 아래 줄기 = 4줄), 외줄 세로(vt 3줄·vc 2줄·vb 3줄),
    외톨이 그루(o, 4줄). forest.forest_canvas 로 1줄·1열 숲을 그려 자른다 — 그림은 9조각과 같은 수관이다."""
    import forest as fo
    pad, step = T, fo.STEP
    out = {}
    row = fo.forest_canvas(P, grass_px, 3, 1, seed)              # 높이 pad + 32 + 16 = 4줄
    for ci, ck in enumerate("lcr"):
        for ty in range(4):
            for tx in range(2):
                out[f"s{ck}.{tx}.{ty}"] = row.crop((ci * step + tx * T, ty * T, ci * step + tx * T + T, ty * T + T))
    col = fo.forest_canvas(P, grass_px, 1, 3, seed)              # 높이 pad + 96 + 16 = 8줄
    for name, y0, n in (("vt", 0, 3), ("vc", pad + step, 2), ("vb", pad + 2 * step, 3)):
        for ty in range(n):
            for tx in range(2):
                out[f"{name}.{tx}.{ty}"] = col.crop((tx * T, y0 + ty * T, tx * T + T, y0 + ty * T + T))
    one = fo.forest_canvas(P, grass_px, 1, 1, seed)
    for ty in range(4):
        for tx in range(2):
            out[f"o.{tx}.{ty}"] = one.crop((tx * T, ty * T, tx * T + T, ty * T + T))
    return out


# ---- 야생 숲(2칸 높이 그루 + 통행 가능한 수관 머리) ---------------------------------------------------------
# 원작(Viridian·Petalburg) 문법: 그루 = 2×2 칸, 줄기는 둘째 줄 안에서 수관 아래 끝에 덮인다. 막는 칸은 모두 잎(또는 줄기)으로 칠한다.
# 수관은 자기 칸 위로 LIFT px 솟는다 — 위에 그루가 있으면 그 그루의 밑동을 덮고(이음매 없는 숲벽), 없으면 위 칸에
# 「수관 머리」(투명 바탕, 위층, 걸을 수 있다)로 걸친다. 주인공이 그 칸에 서면 수관 뒤를 지나간다.
WLIFT = 14
WCROWN_H = WLIFT + 27


def woods_crown(P, seed: str):
    """숲 그루 수관 = 본 시트 숲벽 수관(forest.crown — 짙은 윤곽 고리·큰 잎덩이·밝은 호 하나의 둥근 돔) 그대로(QA-L5 N1).
    forest.crown 은 32×41(칸 위로 9px 솟는다) — 야생 숲 그루는 칸 위로 WLIFT=14px 솟고 밑 27px 에서 끝나 줄기가 보인다(41 = 14 + 27).
    늪 나무는 같은 그림에 잎 램프 인자만 어둡게 준다."""
    import forest as fo
    return fo.crown(P, seed)


def woods_canvas(P, floor_px, trees: set, cols: int, rows: int, seed: str, shadow_c, crowns_only=False):
    """trees = {(i, j)} 그루(왼쪽 위 칸 (2i, 2j)). 그림 높이 = rows*32 + WLIFT(맨 위 수관 머리 자리), (0, WLIFT) 가 그루 (0,0) 의 왼쪽 위."""
    L = WLIFT
    Wd, Hd = cols * 32, rows * 32 + L
    im = px.new(Wd, Hd)
    lf = px.ramp(P["_leaf_hex"])
    if not crowns_only:
        for y in range(Hd):
            for x in range(Wd):
                im.putpixel((x, y), floor_px(x % T, (y - L) % T))
    crown, cmask = woods_crown(P, seed)
    union = [[False] * Wd for _ in range(Hd)]
    for (i, j) in trees:
        for yy in range(WCROWN_H):
            for xx in range(32):
                if cmask[yy][xx]:
                    X, Y = i * 32 + xx, j * 32 + yy
                    if 0 <= X < Wd and 0 <= Y < Hd:
                        union[Y][X] = True
    if not crowns_only:
        for y in range(Hd):
            for x in range(Wd):
                if union[y][x]:
                    continue
                lr = any(union[y][xx] for xx in range(max(0, x - 13), x)) and any(union[y][xx] for xx in range(x + 1, min(Wd, x + 14)))
                ud = any(union[yy][x] for yy in range(max(0, y - 14), y)) and any(union[yy][x] for yy in range(y + 1, min(Hd, y + 10)))
                if lr and ud:
                    im.putpixel((x, y), lf[0])                       # 그루 사이 틈 = 숲 그늘
                    continue
                near = any(0 <= y + dy < Hd and 0 <= x + dx < Wd and union[y + dy][x + dx]
                           for dy in range(-2, 3) for dx in range(-2, 3) if abs(dx) + abs(dy) <= 2)
                if near:
                    im.putpixel((x, y), lf[0] if (x * 3 + y) % 4 else lf[1])
        t = P["trunk"]
        for (i, j) in trees:                                         # 발밑 그림자 + 줄기(아래 그루 수관이 덮으면 안 보인다)
            ox, oy = i * 32, L + j * 32
            for y in range(oy + 27, oy + 32):
                for x in range(ox + 4, ox + 28):
                    d = ((x + 0.5 - ox - 16) / 11.5) ** 2 + ((y + 0.5 - oy - 30.5) / 2.4) ** 2
                    if d <= 1 and 0 <= y < Hd and not union[y][x]:
                        im.putpixel((x, y), shadow_c)
            for y in range(oy + 22, oy + 31):
                for x in range(ox + 13, ox + 19):
                    k = x - ox - 13
                    c = t[3] if k == 0 else t[2] if k <= 2 else t[1] if k <= 4 else t[0]
                    if y == oy + 30:
                        c = t[0]
                    if 0 <= y < Hd:
                        im.putpixel((x, y), c)
            for x in (ox + 12, ox + 19):
                if 0 <= oy + 30 < Hd:
                    im.putpixel((x, oy + 30), t[0])
    for (i, j) in sorted(trees, key=lambda q: q[1]):
        im.alpha_composite(crown, (i * 32, j * 32))
    return im


def woods_pieces(P, floor_px, seed: str, shadow_c):
    """그루 하나의 2×2 칸 그림 16벌(이웃 위·아래·왼·오 유무 4비트: 위 1·아래 2·왼 4·오 8)과 수관 머리 2칸.
    이름: {code:x}.{x}.{y}, cap.{x}."""
    out = {}
    for code in range(16):
        up, dn, lf_, rt = bool(code & 1), bool(code & 2), bool(code & 4), bool(code & 8)
        ts = {(1, 1)}
        if up: ts.add((1, 0))
        if dn: ts.add((1, 2))
        if lf_: ts.add((0, 1))
        if rt: ts.add((2, 1))
        if up and lf_: ts.add((0, 0))
        if up and rt: ts.add((2, 0))
        if dn and lf_: ts.add((0, 2))
        if dn and rt: ts.add((2, 2))
        cv = woods_canvas(P, floor_px, ts, 3, 3, seed, shadow_c)
        for ty in range(2):
            for tx in range(2):
                X, Y = 32 + tx * T, WLIFT + 32 + ty * T
                out[f"{code:x}.{tx}.{ty}"] = cv.crop((X, Y, X + T, Y + T))
    cap = woods_canvas(P, floor_px, {(0, 0)}, 1, 1, seed, shadow_c, crowns_only=True)
    big = px.new(32, T)
    big.alpha_composite(cap.crop((0, 0, 32, WLIFT)), (0, T - WLIFT))
    for tx in range(2):
        out[f"cap.{tx}"] = big.crop((tx * T, 0, tx * T + T, T))
    return out


# ---- 평평한 물(늪·강) — 넓은 면은 한 톤, 반짝임만 띄엄띄엄 -------------------------------------------------
# 원작 R120 늪 물·R119 강: 물 속은 거의 평면이고 가로 반짝임 몇 개만 있다. 그물 무늬를 깔면 타일 바닥·얼음으로 읽힌다(QA1 #24·#41).
POND_GEOM = {
    "swater": (dict(dn=1, ds=1, dw=1, de=1, radius=10, amp=0), dict(dn=3, ds=2, dw=2, de=2, radius=9, amp=0)),   # 안쪽 구석은 두 둑이 만나는 작은 ㄱ 자 그대로 — 덧깎기(fillet)는 구석 밖 물속에 사선 토막을 그렸다(QA-L3 S5)
    "rwater": (dict(dn=0, ds=0, dw=0, de=0, radius=8, amp=0), dict(dn=6, ds=5, dw=5, de=5, radius=3, amp=0, fillet=3)),
}
GLINTS = [[(3, 5, 3), (9, 11, 4)], [(6, 3, 4)], [(10, 6, 3), (3, 12, 3)], [], [(4, 8, 4), (11, 3, 2)], [(8, 10, 3)]]


def pond_masks(prefix: str):
    o, i = POND_GEOM[prefix]
    return ({m: mask4(m, f"{prefix}-o", **o) for m in px.ALL47}, {m: mask4(m, f"{prefix}-i", **i) for m in px.ALL47})


def pond(m: int, f: int, masks, water, ground_px, bank_px, outline, glint_set: int = 0, lip=None):
    """물 오토타일 한 칸. water = 4톤(어두움→밝음). 안: 바탕 water[1], 둑 바로 아래(북쪽) 1px 그늘 water[0], 가장자리 1px 물빛 water[2],
    반짝임 = 가로 3~4px water[3](프레임마다 1px 흔들림). 둑 띠: bank_px(x, y, 북쪽 둑인가) — 바깥 경계 1px 는 outline.
    lip = 북쪽 둑 맨 윗줄 색(흙 앞면이 보이는 둑)."""
    outer, inner = masks[0][m], masks[1][m]
    im = px.new()
    sx = (0, 1, 1, 0)[f]
    gl = set()
    for gx, gy, n in GLINTS[glint_set % len(GLINTS)]:
        n2 = n - (1 if f == 3 and n > 2 else 0)
        for k in range(n2):
            gl.add((gx + k + sx, gy))
    for y in range(T):
        for x in range(T):
            if inner[y][x]:
                c = water[1]
                d = dist_out(inner, m, x, y, 2)
                above_bank = (y > 0 and not inner[y - 1][x]) or (y == 0 and not m & N)
                if above_bank:
                    c = water[0]
                elif d == 1:
                    c = water[2]
                elif (x, y) in gl and d >= 2:
                    c = water[3]
                im.putpixel((x, y), c)
            elif outer[y][x]:
                north = any(0 <= y + k < T and inner[y + k][x] for k in range(1, 7)) and not any(0 <= y - k < T and inner[y - k][x] for k in range(1, 5))
                dw = dist_out(outer, m, x, y, 2)
                c = outline if dw == 1 else bank_px(x, y, north)
                if lip is not None and north and dw == 2:
                    c = lip
                im.putpixel((x, y), c)
            else:
                im.putpixel((x, y), ground_px(x, y))
    return im


def round_patch_mask(m, name: str, depth: int, radius: int, amp: int):
    """둥근 덩이 마스크(늪 진흙 wild_swamp.MUD · 숲 빛 공터 wild_forest.SUN): 바깥 모서리는 칸 전체 사분원(px.inside_mask radius<0), 안쪽 모서리(두 곁은 같은 재료인데 대각만 빈 칸)는
    네모 홈 대신 1/4 타원 홈으로 판다 — 반지름은 두 변의 깎임 깊이(칸 변에서 잰 값이라 위·옆 칸 이음매가 그대로 맞는다).
    한 칸씩 물러나는 경계가 볼록 큰 곡선 + 오목 작은 곡선으로 이어져 칸 계단이 아니라 물결로 읽힌다(I3 Z6)."""
    ins = px.inside_mask(m, name, depth, radius, amp)
    jn, jw = px.edge_jitter(name, "ns", amp), px.edge_jitter(name, "ew", amp)
    for sides, diag, fx, fy, U, V in ((N | E, NE, 1, 0, depth + jw[T - 1], depth + jn[T - 1]), (N | W, NW, 0, 0, depth + jw[0], depth + jn[0]),
                                      (S | E, SE, 1, 1, depth + jw[0], depth + jn[0]), (S | W, SW, 0, 1, depth + jw[T - 1], depth + jn[T - 1])):
        if (m & sides) != sides or m & diag:
            continue
        for v in range(V):
            for u in range(U):
                if (u / U) ** 2 + (v / V) ** 2 >= 1:
                    ins[v if not fy else T - 1 - v][u if not fx else T - 1 - u] = True
    return ins
