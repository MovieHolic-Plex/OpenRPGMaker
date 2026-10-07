"""해안 타일 — 항구 도시(무역항 문법)·해변(109번 도로 문법)·바닷길.

원작에서 읽은 문법(em SlateportCity·DewfordTown·Route109·Route104):
- 해변: 모래 땅이 열린 바다와 만난다. 경계는 계단처럼 꺾이는 물가 + 밝은 거품 줄, 물가 쪽 모래는 젖어 짙다.
- 바다: 바탕 파랑 위에 짧은 밝은 물결 줄이 엇갈려 떠 있다(조용한 무늬). 바다 바위(갈색 덩이)·잠긴 바위(어두운 소용돌이)가 뱃길을 막는다.
- 항구: 마을(풀·포장)은 모래·물보다 한 단 높다. 높은 마을이 물이나 모래와 만나는 **모든 면**에 같은 테두리가 돈다 —
  흰 갓돌 블록 8px(칸마다 한 장, 이음 2px 회색) + 갈색 밑돌 4px(바깥 모서리는 둥글게). 테두리는 늘 낮은 칸 쪽에 그린다:
  물 쪽은 부두 물 그룹 quay, 모래 쪽은 모래 둔치 그룹 bsand(테두리 쪽으로 막힘). 계단(seawall_steps_l/m/r)만 테두리를 끊는다.
  부두 물(quay)과 바다(shore)는 항구 입구에서 이어지고(connectGroups), quay 는 모래에, shore 는 높은 마을에 닿지 않게 깐다.
  나무 잔교가 물 위로 뻗고 끝 아래에 기둥 그림자, 정박한 돛배, 계선주, 상자·통, 천막 노점.
- 해변 소품: 파라솔(줄무늬 돔 + 동그란 그늘), 접이 의자, 튜브, 수건.
모든 픽셀은 좌표·규칙으로 직접 찍는다(원작·Scarloxy 픽셀 복사 없음).
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
import px  # noqa: E402
from px import N, E, S, W, NE, SE, SW, NW, T  # noqa: E402

SHADOW = (0, 0, 0, 64)
CLEAR = (0, 0, 0, 0)

# 오토타일 모양(이름, 깊이, 반지름, 흔들림). radius<0 = 칸 전체 사분원
AUTOTILE_PARAMS = {
    "shore": ("shore", 5, -1, 2),        # 바다 ↔ 모래: 둥글고 흔들리는 물가
    "pave": ("pave", 2, 1, 0),           # 포장길 ↔ 풀: 곧은 연석
    "deep": ("deep", 3, 2, 0),           # 깊은 물 ↔ 바다: 곧은 3px 변 + 귀 반지름 3·5 섞음(deep_mask, 적대 검수 L6 N1)
}


BAND_KINDS = ("quay", "bsand")             # 높은 마을 테두리(갓돌 + 밑돌)를 그리는 두 그룹 — 모양은 wall_band


def masks(kind: str) -> dict:
    if kind in BAND_KINDS:
        return {m: band_mask(m) for m in px.ALL47}
    if kind == "deep":
        return {m: deep_mask(m) for m in px.ALL47}
    return {m: px.inside_mask(m, *AUTOTILE_PARAMS[kind]) for m in px.ALL47}


def deep_mask(m: int):
    """깊은 물 모양: 변은 흔들림 없이 3px(칸마다 같은 흔들림표가 16px 주기 혹을 만든다, L6 N1),
    바깥 귀는 귀마다 반지름 6 또는 10(3·5 는 1배에서 네모 귀로 읽혔다) — 마스크·귀 방향으로 정해 칸 주기로 같은 귀가 반복되지 않는다.
    귀 깎임은 두 변이 다 열린 귀 안에서만 생기므로 이음매는 반지름과 무관하다."""
    out = px.inside_mask(m, "deep", 3, 0, 0)             # 곧은 3px 변, 귀는 네모(안쪽 귀 홈은 px 가 판다)
    for qi, (bits, sx, sy) in enumerate(((N | W, 1, 1), (N | E, -1, 1), (S | W, 1, -1), (S | E, -1, -1))):
        if m & bits:
            continue                                     # 한 변이라도 이어졌으면 바깥 귀가 아니다
        rr = 6 if (m * 7 + qi * 3 + (m >> 3)) % 5 < 2 else 10
        c = 3 + rr                                       # 원 중심(귀에서 안쪽으로 변 깊이 + 반지름)
        for dy in range(c):
            for dx in range(c):
                if (dx + 0.5 - c) ** 2 + (dy + 0.5 - c) ** 2 > rr * rr:
                    x = dx if sx > 0 else T - 1 - dx
                    y = dy if sy > 0 else T - 1 - dy
                    out[y][x] = False
    return out


_SAND0: dict = {}
_GRASS0: dict = {}


_SAND_FN = None


def init(P, sand_img, grass_px, sand_fn=None):
    global _SAND_FN
    _SAND_FN = sand_fn
    for y in range(T):
        for x in range(T):
            _SAND0[(x, y)] = sand_img.getpixel((x, y))
            _GRASS0[(x, y)] = grass_px(x, y)


def _ins(inside, m, x, y):
    """칸 밖 좌표는 이어진 변이면 가장자리 값을 잇는다(이음새에서 띠가 끊기지 않게)."""
    if 0 <= x < T and 0 <= y < T:
        return inside[y][x]
    if x < 0 and not m & W or x >= T and not m & E or y < 0 and not m & N or y >= T and not m & S:
        return False
    return inside[min(T - 1, max(0, y))][min(T - 1, max(0, x))]


def _near(inside, m, x, y, r):
    """(x,y) 에서 맨해튼 거리 r 안에 안쪽 점이 있나."""
    for dy in range(-r, r + 1):
        for dx in range(-r + abs(dy), r - abs(dy) + 1):
            if _ins(inside, m, x + dx, y + dy):
                return True
    return False


# ---- 바다 ---------------------------------------------------------------------------------------
_SWAY = (0, 1, 2, 1)


_SEA_SEEDS = px.torus_seeds("water-net", 5)      # 본 시트 연못(monster_overworld.water_px)과 같은 그물 — 같은 게임의 물(적대 검수 2차 N9)


def sea_px(P, x, y, f, deep=False, v=0, dark=False):
    """바다 한 점 = 본 시트 연못과 같은 그물 물결(보로노이 셀 경계 = 밝은 선, 프레임마다 씨앗이 1.4px 원을 돈다)을 바다 램프로.
    칸마다 같은 그물이라 이음매가 없다. 속 변형 v 는 셀 안쪽에만 반짝임 한두 점(칸 가장자리 3px 는 비움 → 변형끼리도 이음매 없음).
    깊은 단(deep)은 같은 색에 그물 곁 밝은 점을 줄여 한 톤 차분하게 — 칸 단위 색 계단이 생기지 않게 색 램프는 바꾸지 않는다."""
    s = P["sea_deep"] if dark else P["sea"]                # dark = 잠수 자리(짙은 네모 물, 원작 깊은 바다처럼 칸 경계가 곧다)
    seeds = [((sx + 1.4 * math.cos(math.pi / 2 * f + i * 1.3)) % T, (sy + 1.4 * math.sin(math.pi / 2 * f + i * 1.3)) % T) for i, (sx, sy) in enumerate(_SEA_SEEDS)]
    d1, d2, _, _ = px.voronoi(seeds, x + 0.5, y + 0.5)
    b = d2 - d1
    if b < 0.95:
        return s[3]
    if b < 1.7 and (x * 7 + y * 3) % 5 < (1 if deep else 2):
        return s[2]
    if (v, x, y) in ((1, 4, 6), (2, 11, 10), (3, 7, 13)) and f in (0, 1):     # 반짝임: 변형마다 다른 한 점(가로줄로 이어지지 않게, L3 N6)
        return s[4]
    return s[0] if (x + y * 2 + v) % 11 == 0 else s[1]


def sea(P, f, deep=False, v=0, dark=False):
    im = px.new()
    for y in range(T):
        for x in range(T):
            im.putpixel((x, y), sea_px(P, x, y, f, deep, v, dark))
    return im


def deep(P, m: int, f: int):
    """깊은 바다 오토타일(안 = 깊은 물, 밖 = 보통 바다, 막힘·잠수 자리). 같은 세포 물결을 깊은 램프로 그리고,
    가장자리 2px 는 바다와 깊은 물 사이 중간 톤(바다 램프 가장 어두운 단) 꽉 찬 띠 — 원작 Sootopolis·R124 처럼
    점묘 없이 한 단 계단(적대 검수 L6 N1). 모양은 deep_mask."""
    inside = deep_mask(m)
    mid = P["sea"][0]
    im = px.new()
    for y in range(T):
        for x in range(T):
            if not inside[y][x]:
                c = sea_px(P, x, y, f)
            elif _near_out(inside, m, x, y, 2):
                c = mid
            else:
                c = sea_px(P, x, y, f, dark=True)
            im.putpixel((x, y), c)
    return im


def _near_out(inside, m, x, y, r):
    """(x,y) 에서 맨해튼 거리 r 안에 바깥 점이 있나(칸 밖은 이어진 변이면 안으로 본다)."""
    for dy in range(-r, r + 1):
        for dx in range(-r + abs(dy), r - abs(dy) + 1):
            if not _ins(inside, m, x + dx, y + dy):
                return True
    return False


def shore(P, m: int, f: int):
    """해변 물가 오토타일(안 = 바다). 모래가 남쪽인 물가(해변 앞면)는 거품 1px + 얕은 물빛 1px + 젖은 모래 2px 두 줄,
    동서로 선 물가는 거품이 끊기고(2px 마다) 젖은 모래도 1px — 세로 해안이 둑처럼 안 보이게(적대 검수 27). 프레임 1은 거품이 밀려 올라온다."""
    inside = px.inside_mask(m, *AUTOTILE_PARAMS["shore"])
    fo, s, wet = P["foam"], P["sea"], P["wet"]
    run_up = f == 1
    recede = f == 3
    im = px.new()
    for y in range(T):
        for x in range(T):
            if inside[y][x]:
                nb = px.neighbours4(inside, x, y, m)
                vert = not (nb["n"] and nb["s"])           # 위·아래 쪽이 모래(가로로 누운 물가)
                if not all(nb.values()):
                    if vert:
                        c = fo[0] if recede else fo[1]
                    else:
                        c = (fo[0] if recede else fo[1]) if (y // 2) % 2 == 0 else s[3]
                else:
                    edge2 = any(not _ins(inside, m, x + dx, y + dy) for dx, dy in ((0, -2), (0, 2), (1, 1), (-1, 1), (1, -1), (-1, -1)))
                    c = s[3] if edge2 else sea_px(P, x, y, f)
                im.putpixel((x, y), c)
            else:
                near_v = _ins(inside, m, x, y - 1) or _ins(inside, m, x, y + 1)
                if _near(inside, m, x, y, 1):
                    c = fo[0] if run_up and near_v and (x + y) % 2 == 0 else wet[0]
                elif _near(inside, m, x, y, 2) and (near_v or _ins(inside, m, x, y - 2) or _ins(inside, m, x, y + 2)):
                    c = wet[1] if (x * 3 + y) % 4 else wet[0]
                else:
                    c = _SAND0[(x, y)]
                im.putpixel((x, y), c)
    return im


# ---- 높은 마을의 테두리(갓돌 블록 + 갈색 밑돌) — 부두 물과 모래 둔치가 같은 그림을 쓴다 ----------------------------
# 원작 무역항(em SlateportCity)을 8배로 재어 본 문법: 높은 마을(풀·포장)이 낮은 땅(모래)·물과 만나는 모든 면에 같은 테두리가 돈다.
# 흰 갓돌 블록 8px(위 1px 회색 테 · 흰 몸 4px · 아래 2~3px 회색 앞면, 블록은 칸마다 16px 한 장이라 이음이 2px 회색 줄)
# → 갈색 밑돌 4px(울퉁불퉁한 돌 · 맨 바깥 가장 어둡게) → 낮은 쪽 그늘(모래 1px · 물 2px). 바깥 모서리는 밑돌이 둥글게 돈다.
# 이 시트는 테두리를 늘 「낮은 칸」(모래·물) 쪽에 그린다 — 면이 남·북·동·서 어디를 향해도 두께와 재료가 같다(적대 검수 L1 N1·N2).
BLOCK, RIM = 8, 4
BAND = BLOCK + RIM
_BANDS: dict = {}


def _sides(m):
    """마스크 m 에서 높은 마을(바깥)이 있는 쪽: 열린 변 + 두 이웃 변이 이어졌는데 빈 대각."""
    sides = [s for s, b in (("n", N), ("s", S), ("w", W), ("e", E)) if not m & b]
    diag = []
    for b, a1, a2, nm in ((NE, N, E, "ne"), (SE, S, E, "se"), (SW, S, W, "sw"), (NW, N, W, "nw")):
        if m & a1 and m & a2 and not m & b:
            diag.append(nm)
    return sides, diag


def wall_band(m: int):
    """칸의 픽셀마다 (종류, 두께 t, 방향): 종류 'block'(갓돌, t = 마을 쪽에서 0..7) · 'rim'(밑돌) · 'shade'(t = 밑돌 밖 0,1..) · None(낮은 땅·물).
    방향은 블록이 놓인 변(n·s·w·e, 대각 모서리는 그 대각)."""
    if m in _BANDS:
        return _BANDS[m]
    sides, diag = _sides(m)
    R = 16.0
    grid = [[None] * T for _ in range(T)]
    for y in range(T):
        for x in range(T):
            d = {}
            if "n" in sides: d["n"] = y + 1
            if "s" in sides: d["s"] = T - y
            if "w" in sides: d["w"] = x + 1
            if "e" in sides: d["e"] = T - x
            cheb = dict(d)
            for nm in diag:
                ax = T - x if "e" in nm else x + 1
                ay = y + 1 if "n" in nm else T - y
                cheb[nm] = max(ax, ay)
            if not cheb:
                continue
            side = min(cheb, key=lambda k: (cheb[k], k not in ("n", "s")))
            bd = cheb[side]
            # 둥근 거리(밑돌·그늘): 이웃한 두 열린 변은 반지름 R 의 안쪽 모서리, 대각 모서리는 점에서의 거리
            rd = min(d.values()) if d else 99.0
            for a, b in (("n", "w"), ("n", "e"), ("s", "w"), ("s", "e")):
                if a in d and b in d and d[a] < R and d[b] < R:
                    rd = min(rd, R - math.hypot(R - d[a], R - d[b]))
            for nm in diag:
                ax = T - x if "e" in nm else x + 1
                ay = y + 1 if "n" in nm else T - y
                rd = min(rd, math.hypot(ax, ay))
            if bd <= BLOCK:
                grid[y][x] = ("block", bd - 1, side)
            elif rd <= BAND + 0.5:
                grid[y][x] = ("rim", min(RIM - 1, max(0, int(rd + 0.5) - BLOCK - 1)), side)
            elif rd <= BAND + 3.5:
                grid[y][x] = ("shade", int(rd + 0.5) - BAND - 1, side)
    _BANDS[m] = grid
    return grid


def band_mask(m: int):
    """이음새 검사용 안(낮은 땅·물) 모양 = 갓돌·밑돌이 아닌 곳."""
    g = wall_band(m)
    return [[g[y][x] is None or g[y][x][0] == "shade" for x in range(T)] for y in range(T)]


def band_px(P, m, x, y, low):
    """테두리 한 점. low(x, y, shade_t) = 낮은 쪽(모래·물) 색. None 이면 테두리 밖(바닥 그대로)."""
    q, rk = P["quay"], P["rock"]
    cell = wall_band(m)[y][x]
    if cell is None:
        return None
    kind, t, side = cell
    if kind == "shade":
        return low(x, y, t)
    along = x if side in ("n", "s") else y          # 블록이 이어지는 방향의 좌표
    if len(side) == 2:                              # 대각 모서리 기둥: 두 방향 다 테
        along = x if abs(x - (T - 1 if "e" in side else 0)) > abs(y - (0 if "n" in side else T - 1)) else y
    if kind == "block":
        end = along in (0, T - 1)
        if t == 0:
            return q[2] if side in ("s", "e") else q[3]  # 마을 쪽 위 테(빛 받는 북·서는 밝게)
        if end:
            return q[2]
        if t <= 4:
            return q[4] if t > 1 or side in ("n", "w") else q[3]
        if t == 5:
            return q[3]
        return q[1] if t == 6 else q[2]           # 앞면(낮은 쪽으로 2px)
    # 밑돌: 둥근 돌 덩이가 엇갈린다(4px 두께, 6px 마다 홈), 맨 바깥 가장 어둡게
    h = (along * 7 + t * 3 + (along // 6) * 5) % 9
    if t >= RIM - 1:
        return rk[0]
    if (along + 2 * (t // 2)) % 6 == 0:
        return rk[0]
    if t == 0:
        return rk[2] if h < 6 else rk[1]
    return rk[1] if h < 7 else rk[2]


def quay(P, m: int, f: int, v=0):
    """부두 오토타일(안 = 항구 물, 밖 = 높은 마을). 테두리(갓돌 8px + 밑돌 4px)를 물 칸 쪽에 그리고, 밑돌 밖 물은 2px 짙다.
    둔치 모래(bsand)와 같은 테두리 — 면이 어느 쪽을 향해도 같은 두께(적대 검수 L1 N2)."""
    sd = P["sea_deep"]
    im = px.new()
    for y in range(T):
        for x in range(T):
            c = band_px(P, m, x, y, lambda x, y, t: sd[0] if t <= 0 else sd[1] if t == 1 else sea_px(P, x, y, f, v=v))
            im.putpixel((x, y), c if c is not None else sea_px(P, x, y, f, v=v))
    return im


def bsand(P, m: int, v=0):
    """모래 둔치 오토타일(안 = 모래, 밖 = 높은 마을의 풀·포장). 부두와 같은 갓돌 + 밑돌 테두리를 모래 칸 쪽에 그리고 그 밑 1px 젖은 그늘.
    테두리 쪽으로는 막히고(가장자리 막힘 edge), 바다(shore)·부두 물(quay)·돌계단과는 이어진다(connectGroups·connectTiles)."""
    tex = _SAND_FN(v) if v and _SAND_FN else None
    base = (lambda x, y: tex.getpixel((x, y))) if tex else (lambda x, y: _SAND0[(x, y)])
    im = px.new()
    for y in range(T):
        for x in range(T):
            c = band_px(P, m, x, y, lambda x, y, t: P["wet"][1] if t <= 0 else base(x, y))
            im.putpixel((x, y), c if c is not None else base(x, y))
    return im


_PAVE: dict = {}


def pave_px(P, x, y, v=0):
    """포장 바닥: 따뜻한 회베이지 바탕에 1~2px 불규칙 반점(밝음·어두움), 이음은 16px 마다 끊긴 점선 — 칸 격자가 안 뜨고 벽돌처럼 안 읽힌다(적대 검수 5).
    v 는 반점 배치(속 변형 셋)."""
    key = (v,)
    if key not in _PAVE:
        p = P["pave"]
        r = px.rng(f"pave-speck{v}")
        grid = [[p[2]] * T for _ in range(T)]
        for _ in range(9):
            cx, cy = r.randrange(T), r.randrange(T)
            for dx, dy in ((0, 0), (1, 0)) if r.random() < 0.5 else ((0, 0),):
                grid[(cy + dy) % T][(cx + dx) % T] = p[1]
        for _ in range(6):
            cx, cy = r.randrange(T), r.randrange(T)
            grid[cy][cx] = p[3]
        jx, jy = r.randrange(4, 12), r.randrange(4, 12)
        for t in range(T):
            if (t + v) % 3:
                grid[jy][t] = p[1] if grid[jy][t] == p[2] else grid[jy][t]
            if (t * 2 + v) % 5 < 2 and t < jy:
                grid[t][jx] = p[1]
        _PAVE[key] = grid
    return _PAVE[key][y][x]


def pave(P, m: int, v=0):
    """포장길 오토타일(안 = 포장 돌, 밖 = 풀). 안쪽 가장자리 1px 연석(가장 어두운 톤), 그 밖 1px 풀 그늘."""
    inside = px.inside_mask(m, *AUTOTILE_PARAMS["pave"])
    p = P["pave"]; g = P["grass"]
    im = px.new()
    for y in range(T):
        for x in range(T):
            if inside[y][x]:
                nb = px.neighbours4(inside, x, y, m)
                im.putpixel((x, y), p[0] if not all(nb.values()) else pave_px(P, x, y, v))
            else:
                c = _GRASS0[(x, y)]
                if _near(inside, m, x, y, 1) and (x + y) % 2 == 0:
                    c = g[1]
                im.putpixel((x, y), c)
    return im


def seawall_steps(P, part="m"):
    """둔치 테두리를 끊은 돌계단(통행): 테두리와 같은 12px 높이에 세 단 — 디딤판(포장 회베이지, 윗줄 밝음) 3px + 챌판 1px 가장 어둡게,
    그 밑 1px 젖은 그늘과 모래. 끝 칸(l/r)은 4px 갓돌 볼(세로 블록 + 발치 밑돌)로 끊긴 테두리를 마무리한다(원작 무역항 남쪽 계단)."""
    p, q, rk = P["pave"], P["quay"], P["rock"]
    im = px.new()
    for y in range(T):
        for x in range(T):
            cx = x if part == "l" else T - 1 - x if part == "r" else 99
            if cx < 4:
                if y < BAND - 2:
                    c = (q[2] if cx == 0 or y == 0 else q[1] if cx == 3 else q[4] if y < 7 else q[3])
                elif y < BAND:
                    c = rk[1] if y == BAND - 2 else rk[0]
                elif y == BAND:
                    c = P["wet"][1]
                else:
                    c = _SAND0[(x, y)]
            else:
                k = y % 6                                 # 두 단: 디딤판 4px(윗줄 밝음) + 챌판 2px — 마지막 단은 아래 모래 칸(foot)에 놓인다
                c = p[3] if k == 0 else p[2] if k in (1, 2, 3) else p[0] if k == 4 else p[1]
            im.putpixel((x, y), c)
    return im


def seawall_steps_foot(P, part="m"):
    """돌계단 맨 아래 단(모래 칸, 통행): 테두리 줄 밖으로 한 단 튀어나온 디딤판 4px + 챌판 2px, 그 밑 젖은 그늘과 모래.
    끝 칸(l/r)은 갓돌 볼이 낮게 이어진다. 계단이 모래로 내려앉는다(원작 무역항 남쪽 계단, 적대 검수 L2 N2)."""
    p, q, rk = P["pave"], P["quay"], P["rock"]
    im = px.new()
    for y in range(T):
        for x in range(T):
            cx = x if part == "l" else T - 1 - x if part == "r" else 99
            if cx < 4 and y < 6:
                c = q[2] if cx == 0 else q[1] if cx == 3 or y == 5 else q[3]
            elif cx < 4 and y < 8:
                c = rk[0] if y == 7 else rk[1]
            elif y < 6:
                c = p[3] if y == 0 else p[2] if y < 4 else p[0] if y == 4 else p[1]
            elif y < 8 and cx >= 4:
                c = P["wet"][1] if y == 6 else P["wet"][0] if (x % 3 == 0) else _SAND0[(x, y)]
            else:
                c = _SAND0[(x, y)]
            im.putpixel((x, y), c)
    return im



# ---- 잔교 -------------------------------------------------------------------------------------
def dock(P, axis: str):
    """나무 잔교 바닥. axis v: 남북으로 걷는 잔교(널빤지가 가로), h: 동서(널빤지가 세로). 널빤지 4px = 윗빛 1·몸 2·틈 1, 못 두 개."""
    d = P["dock"]
    im = px.new()
    for y in range(T):
        for x in range(T):
            a, b = (y, x) if axis == "v" else (x, y)
            k = a % 4
            c = d[3] if k == 0 else d[2] if k in (1, 2) else d[0]
            if k in (1, 2) and b in (2, 13) and (a // 4) % 2 == (1 if b == 2 else 0) and k == 1:
                c = d[1]
            if b in (0, T - 1):
                c = d[1] if c != d[0] else d[0]
            im.putpixel((x, y), c)
    return im


def dock_post(P):
    """잔교 남쪽 끝 아래(물 칸 위층): 널빤지 두께 3px, 기둥 둘(물에 잠긴 발치 잔물결), 아래로 3px 그늘."""
    d, fo = P["dock"], P["foam"]
    im = px.new()
    for x in range(T):
        im.putpixel((x, 0), d[1]); im.putpixel((x, 1), d[1] if x % 4 else d[0]); im.putpixel((x, 2), d[0])
        for y in range(3, 6):
            im.putpixel((x, y), SHADOW)
    for cx in (7,):
        for y in range(3, 10):
            im.putpixel((cx - 1, y), d[2]); im.putpixel((cx, y), d[1]); im.putpixel((cx + 1, y), d[0])
        for dx in (-2, 2):
            im.putpixel((cx + dx, 10), fo[0])
        im.putpixel((cx, 10), fo[1])
    return im


# ---- 바다 물체 ----------------------------------------------------------------------------------
def _blob(cells_fn, ramp, im, ox=0, oy=0, W=T, H=T):
    """마스크 함수 안을 돌 덩이로 칠한다(왼쪽 위 빛, 오른쪽 아래·바깥 경계 진하게)."""
    for y in range(H):
        for x in range(W):
            if not cells_fn(x, y):
                continue
            edge_br = not cells_fn(x + 1, y) or not cells_fn(x, y + 1)
            edge_tl = not cells_fn(x - 1, y) or not cells_fn(x, y - 1)
            if edge_br:
                c = ramp[0]
            elif edge_tl:
                c = ramp[2]
            else:
                c = ramp[3] if (x + y) < (W + H) * 0.42 else ramp[2] if (x + y) < (W + H) * 0.6 else ramp[1]
            im.putpixel((ox + x, oy + y), c)


_ROCK_CONES = {
    "one": (1, [(7.5, 14.0, 7.0, 12.5)]),                                              # 칸을 거의 채우는 원뿔(적대 검수 L1 N18)
    "big": (2, [(11.5, 27.0, 11.0, 21.0), (22.5, 28.0, 8.0, 15.0)]),                    # 밑동을 2칸 가깝게(R109 둥근 봉우리, 통합 I2 Y3)
    "bigm": (2, [(20.5, 27.0, 11.0, 21.0), (9.0, 28.0, 8.0, 15.0)]),                     # 좌우를 바꾼 쌍(작은 원뿔이 왼쪽, L3 N3)
    "dome": (2, [(16.0, 28.0, 14.5, 25.0)]),                                             # 2×2 큰 바위 하나(바위 줄의 큰 덩이, I3 Z5)
    "mass": (3, [(13.0, 44.0, 11.0, 24.0), (30.0, 45.0, 11.0, 34.0), (39.0, 46.0, 7.5, 18.0), (21.0, 46.0, 9.0, 14.0), (6.5, 46.0, 5.5, 11.0)]),
}


def _sea_rock_ramp(P):
    """바다 바위 램프(손으로 고른 다섯 톤): 원작 R109 바다 바위의 흐린 분홍 갈색 — 채도 0.3~0.4, 몸통 명도 0.45~0.65.
    땅 바위 램프(주황, 채도 0.7)를 쓰면 사막 원뿔보다 밝은 주황 가시로 읽혔다(통합 I1 X7 → I2 Y3)."""
    return [px.hexc(h) for h in ("#4a3036", "#74505a", "#90686c", "#ac8682", "#cca6a0")]


def _rock_facets(cone, ci, kind):
    """원뿔 하나의 깎인 면 설계(손으로 정한 규칙 — 원작 픽셀을 옮기지 않는다, 적대 검수 I3 Z5).
    면 = 꼭대기에서 밑동으로 내려가는 능선(정규화 u 일정 선 = 꼭대기로 모인다)이 가른 세로 판 + 판마다 사선 꺾임 하나(위 판이 한 단 밝다).
    능선은 4줄마다 좌우로 1단 꺾여 이가 빠진 모서리가 된다."""
    cx, by, hw, h = cone
    r = px.rng(f"searock-{kind}-{ci}")
    nr = 1 if hw < 6 else 2 if hw < 10 else 3
    if nr == 1:
        ridges, base = [0.05 + r.uniform(-0.08, 0.08)], [3, 1]
    elif nr == 2:
        ridges, base = [-0.12 + r.uniform(-0.08, 0.08), 0.40 + r.uniform(-0.06, 0.06)], [3, 2, 1]
    else:
        ridges, base = [-0.2 + r.uniform(-0.06, 0.06), 0.15 + r.uniform(-0.06, 0.06), 0.52 + r.uniform(-0.05, 0.05)], [3, 2, 2, 1]
    # 판마다 꺾임(높이 t, 기울기 — 오른쪽이 내려가는 사선). 높이를 판마다 달리 해야 가로 이음매(벽돌 줄)로 안 읽힌다.
    # 빛 판(0)은 늘 꺾이고, 나머지는 셋 중 하나꼴로 꺾임 없이 통째 아래 판(어두운 쪽)이다.
    breaks = [(r.uniform(0.25, 0.55) if i == 0 or r.random() < 0.67 else 9.0, r.uniform(-0.7, -0.3)) for i, _ in enumerate(base)]
    jag = [[r.choice((-1, 0, 0, 1)) for _ in range(64)] for _ in ridges]
    return dict(ridges=ridges, base=base, breaks=breaks, jag=jag)


def searock(P, big):
    """바다 바위(위층, 물 칸 위에만): 원뿔 모양(윗부분 좁게) 몸을 깎인 면 판 3~4톤으로 칠한다(적대 검수 I3 Z5) —
    왼쪽 위 빛: 꼭대기·왼쪽 판이 밝고 오른쪽 판일수록 어둡다. 판 경계는 오른쪽·아래 판 쪽 1px 금, 빛 받는 판의 날은 1px 밝다.
    바깥 윤곽은 최암 톤, 실루엣은 몇 줄 1px 씩 이가 빠진다. 밑동 거품(아래 두껍게).
    "one" 1×1, "big" 2×2 = 원뿔 둘, "bigm" = 좌우 바꾼 쌍, "dome" 2×2 = 큰 바위 하나, "mass" 3×3 = 높낮이가 다른 원뿔 다섯이 붙은 바위산.
    앞(밑동이 아래인) 원뿔이 뒤 원뿔을 가린다."""
    kind = {True: "big", False: "one"}.get(big, big)
    n, cones = _ROCK_CONES[kind]
    cones = sorted(cones, key=lambda c: -c[1])
    rk, fo = _sea_rock_ramp(P), P["foam"]
    W = H = n * T
    chip = {}
    for ci, c in enumerate(cones):                        # 이 빠진 실루엣: 몇 줄만 한쪽 1px 안으로
        cx, by, hw, h = c
        r = px.rng(f"searock-chip-{kind}-{ci}")
        rows = {}
        y = int(by - h) + 3 + r.randint(0, 2)
        while y < by - 3:
            if (by - y) / h < 0.7:                        # 꼭대기 근처는 깎지 않는다(혹처럼 튀어 보였다)
                rows[(y, r.choice((-1, 1)))] = 1
            y += r.randint(4, 6)
        chip[c] = rows

    def inside(x, y):
        for c in cones:
            cx, by, hw, h = c
            if by - h <= y <= by:
                t = (by - y) / h                          # 0 밑 → 1 꼭대기
                half = hw * (1 - t ** 1.5) ** 0.75 + 1.0 * t   # 둥근 어깨의 바위 둔덕(뾰족한 개미탑이 아니게)
                d = x + 0.5 - cx
                half -= chip[c].get((y, 1 if d > 0 else -1), 0)
                if abs(d) <= half and (y < by - 1 or abs(d) <= half - 1):
                    return c
        return None

    facets = {c: _rock_facets(c, ci, kind) for ci, c in enumerate(cones)}

    def facet(x, y, c0):
        """(판 번호, 위 판인가) — 같은 원뿔 안에서만 뜻이 있다."""
        cx, by, hw, h = c0
        t = (by - y - 0.5) / h
        half = hw * (1 - min(1.0, max(0.0, t)) ** 1.5) ** 0.75 + 1.0 * t
        u = (x + 0.5 - cx) / max(1.0, half)
        fd = facets[c0]
        sl = sum(1 for k, rg in enumerate(fd["ridges"]) if u > rg + 0.07 * fd["jag"][k][int(y // 4) % 64])
        tb, slope = fd["breaks"][sl]
        return sl, t > tb + slope * u

    im = px.new(W, H)
    for y in range(H):
        for x in range(W):
            if inside(x, y):
                continue
            if y >= H - 5 and any(inside(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, -1), (0, -2))):
                if y == H - 1 and x % 4 == 1:
                    continue                              # 맨 아래 거품 줄은 끊긴다(물이 비친다 — 꽉 찬 칸이 아래층으로 굽히지 않게)
                im.putpixel((x, y), fo[1] if (x + y) % 3 else fo[0])
    for y in range(H):
        for x in range(W):
            c0 = inside(x, y)
            if not c0:
                continue
            cx, by, hw, h = c0
            f0 = facet(x, y, c0)
            last = len(facets[c0]["base"]) - 1
            tone = min(4, facets[c0]["base"][f0[0]] + (1 if f0[1] else 0))
            if y <= by - h + 2 and f0[0] < last:
                tone = 4                                  # 꼭대기 빛
            c = rk[tone]
            below, right = inside(x, y + 1), inside(x + 1, y)
            up, left = inside(x, y - 1), inside(x - 1, y)
            if not right or not below or not left or not up:
                c = rk[0]                                 # 바깥 1px 은 사방 최암 윤곽(사막 원뿔과 같은 문법, 통합 I1 X7)
            elif below != c0 or (right != c0 and right[1] > by):
                c = rk[0]                                 # 앞 원뿔과 뒤 원뿔 사이 홈(바위산이 한 덩이 얼룩이 되지 않게)
            elif up == c0 and facet(x, y - 1, c0) == (f0[0], True) and not f0[1]:
                c = rk[max(0, tone - 2)]                  # 판 꺾임 금: 아래 판 첫 줄(깎인 단의 그늘)
            elif (left == c0 and facet(x - 1, y, c0)[0] < f0[0]) or (up == c0 and inside(x - 1, y - 1) == c0 and facet(x - 1, y - 1, c0)[0] < f0[0] and facet(x, y - 1, c0)[0] == f0[0]):
                lf = facet(x - 1, y, c0) if left == c0 else facet(x - 1, y - 1, c0)
                lt = min(4, facets[c0]["base"][lf[0]] + (1 if lf[1] else 0))
                if f0[0] == last or lt - tone >= 2:
                    c = rk[0]                             # 능선 금: 그늘 경계(마지막 판)·톤이 크게 꺾이는 곳은 끊김 없이 최암
                elif lt > tone:
                    c = rk[max(1, tone - 1)]              # 한 단 꺾이는 능선: 한 단 어두운 금
                # 같은 톤끼리 맞닿은 능선은 금을 긋지 않는다(널빤지 이음매로 읽혔다)
            elif right == c0 and facet(x + 1, y, c0)[0] > f0[0] and f0[0] == 0 and (by - y) / h > 0.4:
                c = rk[min(4, tone + 1)]                  # 빛 받는 판의 깎인 날(위쪽만 — 밑까지 그으면 세로 줄무늬였다)
            im.putpixel((x, y), c)
    return im


def sandrock(P):
    """모래 위 바위 1×1(위층): 본 시트 바위(outdoor2.boulder — 덩이 셋, 왼쪽 위 빛, 아래·오른쪽 최암 윤곽)와 같은 그림을 모래 위에 쓴다.
    원뿔 끝을 모래에 세운 옛 그림은 「모래 더미·치즈 조각」으로 읽혔다(적대 검수 L1 N15). 같은 재료는 같은 게임의 같은 바위."""
    import outdoor2
    return outdoor2.boulder(P, 1)


def sea_whirl(P):
    """잠긴 바위 2×2 를 대신하는 1×1 (위층): 물 위로 살짝 나온 회색 돌 꼭대기 + 둘레 짙은 물 고리 + 끊긴 거품 고리."""
    s, sd, fo, q = P["sea"], P["sea_deep"], P["foam"], P["quay"]
    im = px.new()
    for y in range(T):
        for x in range(T):
            d = math.hypot(x - 7.5, (y - 8) * 1.2)
            a = math.atan2(y - 8, x - 7.5)
            if d < 2.6:
                l = -((x - 7.5) + (y - 8))
                im.putpixel((x, y), q[3] if l > 2 else q[2] if l > -1 else q[1])
            elif d < 4.4:
                im.putpixel((x, y), sd[0] if d < 3.4 else sd[1])
            elif d < 5.8 and math.sin(a * 3 + 0.5) > -0.2:
                im.putpixel((x, y), fo[1] if math.sin(a * 3 + 0.5) > 0.45 else fo[0])
    return im


def reef(P):
    """잠긴 바위 2×2(위층, 물 위): 넓은 짙은 물 고리 안에 회색 돌 꼭대기 둘·셋, 둘레 끊긴 거품 — 바위 줄을 벽으로 잇는 큰 조각(적대 검수 2차 N15)."""
    sd, fo, q = P["sea_deep"], P["foam"], P["quay"]
    im = px.new(2 * T, 2 * T)
    tops = [(12.5, 13.0, 3.2), (20.0, 18.5, 2.6), (13.5, 21.0, 2.0)]
    for y in range(2 * T):
        for x in range(2 * T):
            d = min(math.hypot(x + 0.5 - tx, (y + 0.5 - ty) * 1.2) - r for tx, ty, r in tops)
            ring = math.hypot((x + 0.5 - 16) / 13, (y + 0.5 - 17) / 11)
            if d < 0:
                tx, ty, r = min(tops, key=lambda t: math.hypot(x - t[0], y - t[1]) - t[2])
                l = -((x - tx) + (y - ty))
                im.putpixel((x, y), q[3] if l > 1.5 else q[2] if l > -1 else q[1])
            elif d < 1.6:
                im.putpixel((x, y), sd[0])
            elif ring < 0.82:
                im.putpixel((x, y), sd[1])
            elif ring < 1.0 and math.sin(math.atan2(y - 17, x - 16) * 5) > -0.1:
                im.putpixel((x, y), fo[1] if ring > 0.92 else fo[0])
    return im


def buoy(P):
    """부표(위층, 물 위): 빨강·흰 띠 둥근 몸 + 꼭대기 막대, 수면 거품."""
    r, w, fo = P["i2_red"], P["i2_white"], P["foam"]
    im = px.new()
    for y in range(4, 13):
        for x in range(4, 12):
            d = math.hypot((x - 7.5) / 3.6, (y - 9) / 3.6)
            if d > 1:
                continue
            band = r if (y - 4) // 2 % 2 == 0 else w
            c = band[0] if x >= 10 or y >= 12 else band[2] if x <= 5 and y <= 7 else band[1]
            if d > 0.86:
                c = r[0]
            im.putpixel((x, y), c)
    for y in range(1, 5):
        im.putpixel((7, y), P["quay"][0]); im.putpixel((8, y), P["quay"][1])
    im.putpixel((7, 1), r[1]); im.putpixel((8, 1), r[1])
    for x in range(3, 13):
        if x not in (7, 8):
            im.putpixel((x, 13), fo[1] if x % 3 else fo[0])
    return im


# ---- 땅 위 소품 ---------------------------------------------------------------------------------
def _outline(im, col):
    """불투명 칠 바깥 1px 를 윤곽색으로(투명 바탕 소품)."""
    W, H = im.size
    src = im.copy()
    for y in range(H):
        for x in range(W):
            if src.getpixel((x, y))[3]:
                continue
            if any(0 <= x + dx < W and 0 <= y + dy < H and src.getpixel((x + dx, y + dy))[3] == 255 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                im.putpixel((x, y), col)
    return im


def _outline_mat(P, im, fallback):
    """재료 윤곽: 바깥 1px 를 이웃 칠 색이 속한 램프의 가장 어두운 톤으로(나무는 짙은 나무, 천은 짙은 천 — 적대 검수 7).
    램프에 없는 색(그늘 등) 옆이면 fallback."""
    dark = {}
    for v in P.values():
        if isinstance(v, (list, tuple)) and v and isinstance(v[0], tuple):
            for c in v:
                dark.setdefault(tuple(c[:3]), v[0])
    W, H = im.size
    src = im.copy()
    for y in range(H):
        for x in range(W):
            if src.getpixel((x, y))[3]:
                continue
            for dx, dy in ((0, 1), (1, 0), (-1, 0), (0, -1)):
                if 0 <= x + dx < W and 0 <= y + dy < H:
                    c = src.getpixel((x + dx, y + dy))
                    if c[3] == 255:
                        im.putpixel((x, y), dark.get(c[:3], fallback))
                        break
    return im


def _shadow_ellipse(im, cx, cy, rx, ry):
    W, H = im.size
    for y in range(H):
        for x in range(W):
            if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 and im.getpixel((x, y))[3] == 0:
                im.putpixel((x, y), SHADOW)


def parasol(P, color: str):
    """파라솔 2×2(위층): 위에서 내려다본 우산 — 꼭지(2×2, 가운데)에서 방사형으로 갈라진 여덟 쪽(색·흰 번갈아),
    왼쪽 위가 밝고 오른쪽 아래가 어둡다, 아래 가장자리 2px 는 천 안쪽 그늘 띠(적대 검수 2차 N12). 기둥 3px 와 비켜 진 그늘."""
    C = P[color]; Wt = P["i2_white"]
    im = px.new(2 * T, 2 * T)
    cx, cy, rx, ry = 16.0, 12.0, 14.0, 10.5
    for y in range(2 * T):
        for x in range(2 * T):
            if ((x + 0.5 - cx - 2) / (rx - 1)) ** 2 + ((y + 0.5 - cy - 9) / (ry - 3)) ** 2 <= 1:
                im.putpixel((x, y), SHADOW)
    for y in range(22, 26):
        im.putpixel((15, y), P["quay"][1]); im.putpixel((16, y), P["quay"][0])
    for y in range(2 * T):
        for x in range(2 * T):
            dx, dy = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
            r2 = dx * dx + dy * dy
            if r2 > 1:
                continue
            ang = math.atan2(dy, dx)
            seg = int((ang + math.pi + math.pi / 8) / (math.pi / 4)) % 8
            ramp = C if seg % 2 == 0 else Wt
            ac = seg * math.pi / 4 - math.pi                       # 쪽의 가운데 방향 — 한 쪽은 한 톤(바람개비처럼 비틀리지 않게, 적대 검수 L1 N7)
            face = math.cos(ac + 3 * math.pi / 4)                  # 왼쪽 위를 보는 쪽이 밝다
            c = ramp[2] if face > 0.6 else ramp[1] if face > -0.6 else ramp[0]
            if r2 < 0.10 and face > -0.6:
                c = ramp[2]                                        # 꼭지 둘레 볼록한 빛
            if r2 > 0.78 and dy > 0.3:
                c = ramp[0]                                        # 아래 가장자리 천 안쪽 그늘 띠
            im.putpixel((x, y), c)
    q = P["quay"]
    for (x, y), c in (((15, 10), q[4]), ((16, 10), q[3]), ((15, 11), q[3]), ((16, 11), q[2]), ((15, 12), q[1]), ((16, 12), q[1])):
        im.putpixel((x, y), c)                                     # 꼭지(흰 손잡이 2×2 + 밑 그늘)
    return _outline(im, C[0])


def deckchair(P):
    """선베드 1×2(위층, 3/4): 위 칸은 비스듬히 선 등받이(가로 살, 맨 위 흰 베개 띠), 아래 칸은 앉는 판(살 셋) + 다리 2px 둘.
    등받이는 앉는 판과 같은 폭이고 두 판 사이에 꺾이는 짙은 경첩 줄 — 위로 좁아지던 등받이는 원 크기에서 병 모양으로 읽혔다(통합 I2 실내 Y3).
    그림자는 접지 1~2px 만(세운 판처럼 안 보이게, 적대 검수 11)."""
    b, w = P["i2_blue"], P["i2_white"]
    im = px.new(T, 2 * T)
    for x in range(4, 14):                                              # 접지 그림자
        im.putpixel((x, 30), SHADOW); im.putpixel((x + 1, 29), SHADOW) if x < 13 else None
    for y in range(3, 15):                                              # 등받이(앉는 판과 같은 폭)
        for x in range(3, 13):
            if y <= 5:
                c = w[2] if y < 5 else w[1]                             # 머리 베개 띠
            else:
                c = w[2] if (y - 6) % 3 == 0 else b[2] if x < 11 else b[1]
            if x in (3, 12):
                c = w[1] if x == 3 else w[0]
            im.putpixel((x, y), c)
    for x in range(3, 13):                                              # 경첩: 등받이가 앉는 판에서 꺾여 선다
        im.putpixel((x, 15), b[0])
    for y in range(16, 27):                                             # 앉는 판
        for x in range(3, 13):
            c = w[2] if (y - 16) % 4 == 0 else b[2] if x < 11 else b[1]
            if x in (3, 12):
                c = w[1] if x == 3 else w[0]
            if y == 26:
                c = w[0]
            im.putpixel((x, y), c)
    for x in (4, 5, 10, 11):                                            # 다리
        for y in (27, 28):
            im.putpixel((x, y), P["quay"][1] if x in (4, 10) else P["quay"][0])
    im.putpixel((3, 3), CLEAR); im.putpixel((12, 3), CLEAR)            # 베개 귀만 1px 둥글게
    return _outline(im, b[0])

def swimring(P):
    """튜브 1×1(위층): 빨강·흰 네 쪽 고리, 가운데 구멍으로 모래, 그늘."""
    r, w, ol = P["i2_red"], P["i2_white"], P["i2_ol"][0]
    im = px.new()
    _shadow_ellipse(im, 9, 10, 6, 4)
    for y in range(T):
        for x in range(T):
            d = math.hypot(x - 7.5, (y - 7.5) * 1.15)
            if 2.4 <= d <= 6.0:
                q = int((math.atan2(y - 7.5, x - 7.5) + math.pi) / (math.pi / 2)) % 4
                ramp = r if q % 2 == 0 else w
                c = ramp[2] if (x + y) < 13 and d > 3.4 else ramp[0] if (x + y) > 18 else ramp[1]
                im.putpixel((x, y), c)
    return _outline(im, r[0])


def towel(P, color: str):
    """수건 1×2(바닥 위, 걸을 수 있다): 줄무늬 천, 술 장식 끝."""
    C, w = P[color], P["i2_white"]
    im = px.new(T, 2 * T)
    for y in range(3, 29):
        for x in range(3, 13):
            c = C[1] if ((y - 3) // 4) % 2 == 0 else w[2]
            if x == 12 or y == 28:
                c = C[0] if c == C[1] else w[0]
            im.putpixel((x, y), c)
    for x in range(4, 13, 2):
        im.putpixel((x, 2), w[1]); im.putpixel((x, 29), w[1])
    return im


def beachball(P):
    """비치볼 1×1(위층): 여섯 쪽 색 공(빨강·흰·파랑·노랑), 왼쪽 위 반짝, 아래 납작 그늘. 모래성 대신(적대 검수 「모래성 모호」)."""
    cols = [P["i2_red"], P["i2_white"], P["i2_blue"], P["i2_white"], P["i2_yellow"], P["i2_white"]]
    im = px.new()
    _shadow_ellipse(im, 9, 13, 5, 2)
    for y in range(T):
        for x in range(T):
            dx, dy = (x - 7.5) / 5.5, (y - 7.5) / 5.5
            r2 = dx * dx + dy * dy
            if r2 > 1:
                continue
            seg = int((math.atan2(dy, dx) + math.pi) / (math.pi / 3)) % 6
            ramp = cols[seg]
            l = -(dx + dy) * 0.9 + (1 - r2) * 0.3
            im.putpixel((x, y), ramp[2] if l > 0.4 else ramp[1] if l > -0.5 else ramp[0])
    im.putpixel((5, 4), P["i2_white"][2]); im.putpixel((6, 4), P["i2_white"][2]); im.putpixel((5, 5), P["i2_white"][2])
    return _outline_mat(P, im, P["i2_ol"][0])


def bucket(P):
    """모래 양동이 1×1(위층): 위로 벌어진 파란 통(타원 입구 안쪽 어둡게 + 모래), 손잡이 고리, 옆 삽 하나."""
    b, y_, sd = P["i2_blue"], P["i2_yellow"], P["sand"]
    im = px.new()
    _shadow_ellipse(im, 9, 14, 6, 2)
    for y in range(6, 15):
        half = 4.5 - (y - 6) * 0.22
        for x in range(2, 14):
            if abs(x - 7.5) <= half:
                im.putpixel((x, y), b[2] if x < 6 else b[1] if x < 10 else b[0])
    for x in range(2, 14):
        for y in range(4, 9):
            e = ((x - 7.5) / 4.6) ** 2 + ((y - 6) / 1.7) ** 2
            if e <= 1:
                im.putpixel((x, y), b[2] if e > 0.55 else sd[2] if y >= 6 else b[0])
    for x, y in ((3, 4), (3, 3), (4, 2), (5, 1), (6, 1), (7, 1), (8, 1), (9, 1), (10, 2), (11, 3), (12, 4)):
        im.putpixel((x, y), b[0])
    for y in range(8, 15):                                              # 삽 자루
        im.putpixel((13, y), y_[1])
    for x in (12, 13, 14):
        im.putpixel((x, 14), y_[0]); im.putpixel((x, 15), y_[0]) if x != 14 else None
    return _outline_mat(P, im, P["i2_ol"][0])


def bollard(P):
    """계선주 1×1(위층, 갓돌 위): 작은 흰 버섯(8×8px) — 바다 쪽으로 살짝 기운 둥근 머리(윗면 밝음) + 짧은 목 + 밑판. 띠 없음(적대 검수 2차 N19)."""
    q = P["quay"]
    im = px.new()
    _shadow_ellipse(im, 9, 12, 4, 1.5)
    for x in range(5, 11):
        im.putpixel((x, 11), q[1] if x < 8 else q[0])
    for y in range(8, 11):
        for x in (7, 8):
            im.putpixel((x, y), q[2] if x == 7 else q[1])
    for y in range(4, 9):
        for x in range(4, 12):
            e = ((x + 0.5 - 8.3) / 3.6) ** 2 + ((y + 0.5 - 6.4) / 2.0) ** 2
            if e <= 1:
                im.putpixel((x, y), q[4] if y <= 5 and x < 8 else q[3] if y <= 6 else q[2] if x < 10 else q[1])
    return _outline_mat(P, im, q[0])


def crate(P):
    """나무 상자 1×1: 윗면(밝음) 4px + 앞면 대각 버팀, 윤곽은 나무 가장 어두운 톤, 오른쪽 아래 그늘."""
    d = P["dock"]
    im = px.new()
    for y in range(4, 16):
        for x in range(3, 16):
            if x >= 14 or y >= 14:
                im.putpixel((x, y), SHADOW)
    for y in range(2, 14):
        for x in range(1, 14):
            if y <= 5:
                c = d[3] if y < 5 else d[2]
            else:
                c = d[2]
                if x in (1, 13) or y == 13 or y == 6:
                    c = d[1]
                if abs((x - 1) - (y - 6) * 12 / 7) < 1.1:
                    c = d[1]
            im.putpixel((x, y), c)
    return _outline(im, d[0])


def barrel(P):
    """나무 통 1×1: 타원 윗면(어두운 속), 불룩한 몸, 쇠 띠 둘."""
    d, q = P["dock"], P["quay"]
    im = px.new()
    _shadow_ellipse(im, 10, 14, 6, 2)
    for y in range(3, 15):
        for x in range(2, 14):
            bul = 5.2 + 0.9 * math.sin((y - 3) / 11 * math.pi)
            if abs(x - 7.5) > bul:
                continue
            c = d[3] if x < 6 else d[2] if x < 10 else d[1]
            if y in (6, 12):
                c = q[1] if x < 9 else q[0]
            im.putpixel((x, y), c)
    for x in range(3, 13):
        for y in range(2, 5):
            if ((x - 7.5) / 5) ** 2 + ((y - 3.5) / 1.4) ** 2 <= 1:
                im.putpixel((x, y), d[0] if y == 3 and 4 < x < 11 else d[2])
    return _outline(im, d[0])


def palm(P):
    """야자 2×3(나무): 아래에서 휘어 오르는 마디 줄기(고리 무늬), 꼭대기에서 퍼져 늘어지는 두꺼운 잎 일곱(윗변 밝음·잎맥·아랫변 어둠,
    뒤 잎은 한 톤 어둡게), 잎 밑 열매 셋, 발치 그늘. 윤곽은 잎·줄기의 가장 어두운 톤."""
    lf, tr = P["leaf"], P["trunk"]
    W, H = 2 * T, 3 * T
    im = px.new(W, H)
    _shadow_ellipse(im, 17, 45, 8, 2)
    cx, cy = 16.0, 15.0
    for y in range(int(cy), 47):                          # 줄기
        t = (y - cy) / (46 - cy)
        mx = cx + 1 + 2.2 * math.sin(t * math.pi * 0.9)
        half = 1.5 + 1.3 * t
        for x in range(int(mx - half), int(mx + half) + 1):
            rel = (x - (mx - half)) / (2 * half + 0.01)
            c = tr[3] if rel < 0.3 else tr[2] if rel < 0.7 else tr[1]
            if (y - int(cy)) % 4 == 3:
                c = tr[1] if rel < 0.7 else tr[0]
            im.putpixel((x, y), c)
    fronds = [(-1.95, 13, 0.05, True), (-1.25, 11, 0.06, True), (-0.55, 13, 0.05, True),      # 뒤(위로) — 어둡게 먼저
              (-2.95, 15, 0.045, False), (-0.15, 15, 0.045, False), (2.45, 13, 0.03, False), (0.75, 13, 0.03, False)]
    for ang, L, droop, back in fronds:
        pts = []
        for i in range(25):
            t = i / 24
            pts.append((cx + math.cos(ang) * L * t, cy + math.sin(ang) * L * t + droop * (L * t) ** 2 * (1 if math.sin(ang) < 0.5 else 0.3)))
        for y in range(H):
            for x in range(W):
                best = None
                for i in range(len(pts) - 1):
                    (ax, ay), (bx, by) = pts[i], pts[i + 1]
                    vx, vy = bx - ax, by - ay
                    ll = vx * vx + vy * vy or 1
                    u = max(0.0, min(1.0, ((x - ax) * vx + (y - ay) * vy) / ll))
                    qx, qy = ax + u * vx, ay + u * vy
                    d = math.hypot(x - qx, y - qy)
                    if best is None or d < best[0]:
                        side = (vx * (y - ay) - vy * (x - ax)) / math.sqrt(ll)
                        best = (d, (i + u) / (len(pts) - 1), side)
                d, t, side = best
                w = 0.8 + 3.2 * math.sin(min(1.0, t * 1.15) * math.pi) ** 0.8 if t > 0.05 else 1.2
                if d > w:
                    continue
                up = -side if math.cos(ang) >= 0 else side      # 위쪽 변 = 빛
                c = lf[3] if up > w * 0.35 else lf[2] if up > -w * 0.25 else lf[1]
                if abs(side) < 0.6 and 0.1 < t < 0.85:
                    c = lf[1] if c != lf[1] else lf[0]
                if back:
                    c = {lf[3]: lf[2], lf[2]: lf[1], lf[1]: lf[0]}.get(c, c)
                if d > w - 0.9:
                    c = lf[0]
                im.putpixel((x, y), c)
    for ox, oy in ((13, 16), (17, 17), (15, 18)):            # 열매
        for x, y in ((ox, oy), (ox + 1, oy), (ox, oy + 1), (ox + 1, oy + 1)):
            im.putpixel((x, y), tr[2] if (x, y) == (ox, oy) else tr[1] if y == oy else tr[0])
    return im


def tent(P, color: str):
    """노점 천막 3×2(위층, 위에서 본 3/4): 위 22px = 줄무늬 사각 지붕 윗면 — 가운데 능선(밝음)에서 앞뒤로 접힌 네 면(대각 접힘선, 앞면이 더 크게 보인다),
    지붕 앞 끝 2px 물결 차양, 그 아래 앞 기둥 둘과 그늘 속 진열대(바구니 셋). 정면 입면으로 읽히던 옛 그림을 버린다(적대 검수 2차 N17)."""
    C, w, d = P[color], P["i2_white"], P["dock"]
    im = px.new(3 * T, 2 * T)
    for y in range(22, 32):
        for x in range(6, 47):
            im.putpixel((x, y), SHADOW)
    for y in range(22, 30):                               # 진열대 앞면(기둥 안쪽으로 좁혀 기둥이 따로 선다)
        for x in range(7, 41):
            c = d[2] if y == 22 else d[1] if y < 29 else d[0]
            im.putpixel((x, y), c)
    for gx, g in ((11, P["i2_red"]), (24, P["i2_yellow"]), (37, P["i2_orange"])):
        for x in range(gx - 4, gx + 5):
            im.putpixel((x, 23), d[3]); im.putpixel((x, 24), d[2])
        for y in range(20, 24):
            for x in range(gx - 4, gx + 5):
                if ((x - gx) / 4.2) ** 2 + ((y - 23) / 3) ** 2 <= 1:
                    im.putpixel((x, y), g[2] if x < gx and y < 22 else g[1] if x <= gx else g[0])
    for y in range(17, 31):                               # 차양 네 귀 아래 앞 기둥 둘(2px, 왼쪽 빛) — 진열대 밖 땅까지 내려 차양이 뜨지 않는다(적대 검수 L2 N4)
        for x, c in ((3, d[3]), (4, d[1]), (43, d[2]), (44, d[0])):
            im.putpixel((x, y), c)
    for x, c in ((2, d[1]), (5, d[0]), (42, d[1]), (45, d[0])):
        im.putpixel((x, 30), c)                           # 기둥 발
    for y in range(0, 20):                                # 지붕 윗면: 능선 y=6, 뒤 면(0..6) 좁고 어둡게, 앞 면(6..18) 넓고 밝게
        for x in range(1, 47):
            stripe = ((x - 1) // 6) % 2
            ramp = C if stripe == 0 else w
            fold = abs(x - 24) > 21 - abs(y - 6) * 0.2         # 양 끝 대각 접힘(박공)
            if y < 6:
                c = ramp[1] if not fold else ramp[0]
            elif y == 6:
                c = ramp[2]
            elif y < 17:
                c = ramp[2] if y < 10 and not fold else ramp[1] if not fold else ramp[0]
            else:
                edge = 18 + ((x - 1) % 6 in (2, 3))
                if y > edge:
                    continue
                c = ramp[0]
            if x in (1, 46):
                c = ramp[0]
            im.putpixel((x, y), c)
    return _outline_mat(P, im, P["i2_ol"][0])


def airmat(P, color: str):
    """에어매트 1×2(바닥 위 장식, 걸을 수 있다): 부푼 청록 매트 — 가로 골 다섯(밝은 등·어두운 골), 머리 쪽 베개 칸, 둥근 모서리."""
    C = P[color]
    im = px.new(T, 2 * T)
    for y in range(3, 30):
        for x in range(2, 14):
            if (x in (2, 13)) and (y in (3, 29)):
                continue
            k = (y - 3) % 5
            c = C[2] if k in (1, 2) else C[1] if k == 3 else C[0]
            if y < 8:
                c = C[2] if y in (4, 5) else C[1]
            if x == 13 or y == 29:
                c = C[0]
            im.putpixel((x, y), c)
    for x in range(4, 15):
        im.putpixel((x, 30), SHADOW)
    return _outline_mat(P, im, C[0])


def jar(P, kind: int):
    """시장 항아리·자루 1×1(위층, 막힘) — 목과 주둥이가 보여야 항아리로 읽힌다(적대 검수 L1 N4: 테 없는 둥근 몸은 공·알·빵으로 읽혔다).
    0 = 붉은 질그릇 독(넓은 어깨, 1px 잘록한 목, 짙은 타원 입구 + 밝은 테), 1 = 초록 유약 물항아리(키 큰 몸, 좁은 목, 벌어진 주둥이),
    2 = 곡식 자루(위를 끈으로 묶어 오므린 술 + 몸 주름 두 줄). 빛은 왼쪽 위, 윤곽은 재료의 가장 어두운 톤."""
    im = px.new()
    _shadow_ellipse(im, 9.5, 14.5, 5.5, 1.6)
    put = im.putpixel
    if kind == 2:
        r = [P["dock"][0], P["dock"][1], P["wet"][0], P["wet"][1], P["sand"][1]]
        for y in range(6, 15):                                            # 몸: 아래가 불룩한 자루
            half = 2.2 + 3.6 * math.sin(min(1.0, (y - 5) / 7.5) * math.pi / 2)
            for x in range(T):
                dx = x + 0.5 - 7.5
                if abs(dx) <= half:
                    l = -dx / half * 0.9 - (y - 10) / 5 * 0.4
                    put((x, y), r[4] if l > 0.75 and y < 11 else r[3] if l > 0.05 else r[2] if l > -0.6 else r[1])
        for y, x in ((7, 6), (8, 5), (9, 5), (10, 4), (7, 9), (8, 10), (9, 10), (11, 10)):
            put((x, y), r[1])                                             # 주름 두 줄(끈에서 내려온다)
        for x in range(6, 10):                                            # 묶은 끈
            put((x, 5), r[0] if x in (6, 9) else P["i2_red"][0])
        put((10, 5), P["i2_red"][0]); put((10, 6), P["i2_red"][1])        # 끈 매듭 꼬리
        for y, xs in ((4, range(6, 10)), (3, range(5, 11)), (2, (5, 7, 8, 10))):   # 오므린 술
            for x in xs:
                put((x, y), r[3] if x < 8 else r[2])
        put((6, 3), r[4])
        return _outline_mat(P, im, r[0])
    if kind == 0:
        r = P["brick"]                                                    # 질그릇 램프 4톤
        body, neck, mouth = (7.5, 9.6, 5.6, 4.6), (6, 10, 5), (4.9, 10.1, 3)
    else:
        g = P["i2_green"]
        r = [g[0], g[0], g[1], g[2]]
        body, neck, mouth = (7.5, 10.4, 4.4, 4.0), (6, 10, 4), (4.9, 10.1, 2)
    cx, cy, rx, ry = body
    for y in range(T):
        for x in range(T):
            dx, dy = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
            if dx * dx + dy * dy <= 1:
                l = -(dx * 1.1 + dy * 0.7)
                put((x, y), r[3] if l > 0.7 else r[2] if l > -0.25 else r[1])
                if dy > 0.82:
                    put((x, y), r[1])
    n0, n1, ny = neck                                                     # 목: 몸 위 1~2줄, 몸보다 좁다
    top = int(cy - ry)
    for y in range(mouth[2] + 2, top + 1):
        for x in range(n0, n1):
            put((x, y), r[2] if x < 8 else r[1])
    my = mouth[2]                                                         # 주둥이: 밝은 테 고리 + 짙은 입구
    for x in range(int(mouth[0]), int(mouth[1]) + 1):
        e = abs(x + 0.5 - 7.5) / (mouth[1] - 7.5)
        put((x, my), r[3] if e < 0.9 else r[2])
        put((x, my + 1), r[0] if e < 0.6 else r[2])
    put((int(mouth[0]), my + 1), r[2]); put((int(mouth[1]), my + 1), r[1])
    if kind == 0:
        for x in range(4, 12):                                            # 어깨 띠(질그릇 무늬 한 줄)
            if (x + 1) % 3:
                put((x, 8), r[1] if x > 5 else r[2])
    else:
        put((5, 9), g[2]); put((5, 10), g[2])                             # 유약 반짝임
    return _outline_mat(P, im, r[0])


def statue(P):
    """기념 동상 1×2(막힘): 계단식 흰 돌 받침(윗면 밝음·앞면 줄) 위에 청동(갈색) 인물 실루엣(한 팔을 든), 왼쪽 위 빛."""
    q, br = P["quay"], P["rock"]
    im = px.new(T, 2 * T)
    _shadow_ellipse(im, 10, 30, 7, 2)
    for y in range(20, 31):                               # 받침 두 단
        inset = 2 if y < 24 else 1
        for x in range(1 + inset, 15 - inset):
            c = q[4] if y in (20, 24) else q[2] if x < 12 - inset else q[1]
            if y in (23, 30):
                c = q[0]
            im.putpixel((x, y), c)
    def fig(x, y):
        head = (x + 0.5 - 7.5) ** 2 + (y + 0.5 - 5.0) ** 2 <= 4.6
        neck = 7 <= x <= 8 and 7 <= y <= 8
        torso = 9 <= y <= 14 and abs(x + 0.5 - 8) <= 3.2 - (y - 9) * 0.15
        legs = 15 <= y <= 19 and (6 <= x <= 7 or 9 <= x <= 10)
        arm_l = x == 4 and 9 <= y <= 13
        arm_r = x in (11, 12) and 2 <= y <= 9 and (x == 11 or y <= 3)     # 든 팔 + 손
        return head or neck or torso or legs or arm_l or arm_r
    for y in range(1, 20):
        for x in range(3, 14):
            if fig(x, y):
                c = br[3] if x < 7 and y < 9 else br[2] if x < 8 else br[1]
                im.putpixel((x, y), c)
    im.putpixel((6, 4), br[4])
    return _outline_mat(P, im, br[0])


def lighthouse(P):
    """등대 3×5(건물): 꼭대기 빨간 지붕 + 유리 등실(노란 빛), 난간, 흰·빨강 띠 탑(아래로 넓어짐), 돌 밑동과 가운데 칸 문."""
    w, r, q, gl, ol = P["i2_white"], P["i2_red"], P["quay"], P["i2_yellow"], P["i2_ol"][0]
    W = 3 * T
    cx = 24
    im = px.new(W, 5 * T)
    for y in range(70, 80):
        for x in range(10, 42):
            if x > 38 or y > 77:
                im.putpixel((x, y), SHADOW)
    for y in range(0, 80):
        if y < 6:                                         # 지붕
            half = 2 + y * 1.3
            for x in range(int(cx - half), int(cx + half) + 1):
                im.putpixel((x, y), r[2] if x < cx - 1 else r[1] if x < cx + 3 else r[0])
        elif y < 14:                                      # 등실
            for x in range(cx - 7, cx + 7):
                c = gl[2] if cx - 5 <= x <= cx + 4 and 7 <= y <= 12 else q[1]
                if x in (cx - 3, cx + 2) and 7 <= y <= 12:
                    c = q[0]
                im.putpixel((x, y), c)
        elif y < 16:                                      # 난간
            for x in range(cx - 10, cx + 10):
                im.putpixel((x, y), q[2] if y == 14 else q[0])
        elif y < 68:                                      # 탑
            t = (y - 16) / 52
            half = 6.5 + 5 * t
            band = r if ((y - 16) // 10) % 2 == 1 else w
            for x in range(int(cx - half), int(cx + half) + 1):
                rel = (x - (cx - half)) / (2 * half)
                c = band[2] if rel < 0.3 else band[1] if rel < 0.72 else band[0]
                im.putpixel((x, y), c)
        else:                                             # 밑동
            for x in range(cx - 14, cx + 14):
                c = q[3] if y == 68 else q[2] if x < cx + 6 else q[1]
                if (x - cx + 14) % 8 == 0 and y > 68:
                    c = q[1]
                im.putpixel((x, y), c)
    for y in range(66, 80):                               # 문(가운데 칸 16..31 안)
        for x in range(cx - 3, cx + 3):
            im.putpixel((x, y), P["dock"][1] if x < cx else P["dock"][0])
    for x in range(cx - 4, cx + 4):
        im.putpixel((x, 65), q[0])
    for y in (30, 44):                                    # 작은 창
        for x in (cx - 1, cx):
            im.putpixel((x, y), P["sea"][1]); im.putpixel((x, y + 1), P["sea"][0])
    return _outline_mat(P, im, ol)


def sailboat(P):
    """정박한 돛배 3×3(위층, 물 위, 3/4): 위가 넓은 선체 — 뱃전 안쪽 나무 갑판 윗면(널빤지 줄)이 보이고(적대 검수 2차 N24),
    그 아래 흰 옆면 + 파란 흘수선이 아래로 좁아진다. 갑판 가운데 돛대, 겹친 흰 돛 둘(앞돛이 큰 돛 앞), 물에 비친 그늘."""
    w, b, d, ol = P["i2_white"], P["i2_blue"], P["dock"], P["i2_ol"][0]
    im = px.new(3 * T, 3 * T)
    for y in range(38, 47):
        for x in range(8, 46):
            if ((x - 27) / 18) ** 2 + ((y - 42) / 4) ** 2 <= 1:
                im.putpixel((x, y), SHADOW)
    for y in range(25, 35):                               # 갑판 윗면(뱃전 테 안쪽) — 위에서 내려다본 깊이(적대 검수 L1 N8)
        for x in range(3, 45):
            e = ((x + 0.5 - 24) / 21) ** 2 + ((y + 0.5 - 30.0) / 4.6) ** 2
            if e > 1:
                continue
            c = w[2] if e > 0.7 else (d[3] if (y - 27) % 2 == 0 else d[2])
            im.putpixel((x, y), c)
    for y in range(31, 41):                               # 옆면: 아래로 좁아진다
        k = (y - 31) / 9
        x0, x1 = int(4 + 7 * k), int(44 - 5 * k)
        for x in range(x0, x1):
            if y < 33 and im.getpixel((x, y))[3] == 255 and y < 32:
                continue
            c = w[1] if y < 37 else b[1] if y < 39 else b[0]
            if x > x1 - 4:
                c = w[0] if y < 37 else b[0]
            im.putpixel((x, y), c)
    for y in range(3, 30):                                # 돛대
        im.putpixel((23, y), d[1]); im.putpixel((24, y), d[0])
    for y in range(5, 26):                                # 큰 돛: 바람을 받아 불룩한 뒷변, 돛대 쪽 밝고 배 쪽 그늘, 접힌 주름 한 줄
        t = (y - 5) / 20
        x1 = 25 + int(2 + 14 * t + 2.5 * math.sin(math.pi * t))
        for x in range(25, x1):
            u = (x - 25) / max(1, x1 - 25)
            c = w[2] if u < 0.45 else w[1] if u < 0.85 else w[0]
            if y in (19, 20):
                c = b[1] if u < 0.85 else b[0]
            if abs(u - 0.6) < 0.06 and y > 10 and y not in (19, 20):
                c = w[1]
            im.putpixel((x, y), c)
    for x in range(23, 43):                               # 붐(큰 돛 아래 가로대)
        im.putpixel((x, 26), d[1]); im.putpixel((x, 27), d[0]) if x > 24 else None
    for y in range(10, 27):                               # 앞돛(큰 돛 앞, 아래 끝이 겹친다): 앞변이 바람에 휜다
        t = (y - 10) / 16
        x0 = 22 - int(1 + 9 * t + 2 * math.sin(math.pi * t))
        x0 -= 2
        for x in range(x0, 20):                           # 돛대와 틈(윤곽 사이 1px 물빛 — 앞돛이 돛대 앞에 따로 선다)
            u = (19 - x) / max(1, 19 - x0)
            im.putpixel((x, y), w[2] if u < 0.3 else w[1] if u < 0.8 else w[0])
    for x, c in ((23, P["i2_red"][1]), (24, P["i2_red"][1]), (25, P["i2_red"][0])):
        im.putpixel((x, 2), c)
    return _outline_mat(P, im, ol)


def rowboat(P):
    """작은 배 2×1(위층, 물 위): 위에서 내려다본 나룻배 — 왼쪽이 뾰족한 뱃머리, 오른쪽이 평평한 고물,
    두꺼운 뱃전(밝은 윗면) 안쪽에 어두운 바닥판과 가로 좌석 둘, 오른쪽 아래 수면 그늘. 빵 덩이로 읽히던 타원을 버린다(적대 검수 19)."""
    d = P["dock"]
    im = px.new(2 * T, T)
    def hull(x, y, k=0.0):
        if not (2 + k <= x <= 29 - k):
            return False
        half = 6.0 - k if x >= 10 else (6.0 - k) * max(0.0, (x - 2 - k) / (8 - k)) ** 0.7
        return abs(y - 7.5) <= half
    for y in range(T):
        for x in range(2 * T):
            if hull(x - 1, y - 1) and not hull(x, y):
                im.putpixel((x, y), SHADOW)
    for y in range(T):
        for x in range(2 * T):
            if not hull(x, y):
                continue
            inner = hull(x, y, 2.0)
            if inner:
                c = d[1] if x not in (13, 14, 21, 22) else d[3]
                if x in (13, 21) or (x in (14, 22) and y == 7):
                    c = d[3]
            else:
                c = d[3] if y < 7.5 else d[2]
            im.putpixel((x, y), c)
    return _outline_mat(P, im, d[0])


def lamp(P):
    """가로등 1×2(위층): 쇠 기둥, 둥근 등갓 + 노란 유리, 받침."""
    q, gl, ol = P["quay"], P["i2_yellow"], P["i2_ol"][0]
    im = px.new(T, 2 * T)
    _shadow_ellipse(im, 9, 29, 4, 1.5)
    for y in range(8, 29):
        im.putpixel((7, y), q[1]); im.putpixel((8, y), q[0])
    for x in range(5, 11):
        im.putpixel((x, 28), q[1] if x < 8 else q[0]); im.putpixel((x, 27), q[2] if x < 8 else q[1])
    for y in range(1, 9):
        for x in range(4, 12):
            if (x - 7.5) ** 2 / 14 + (y - 4.5) ** 2 / 12 > 1:
                continue
            c = gl[2] if y > 2 and x < 9 else gl[1]
            if y <= 2:
                c = q[1]
            im.putpixel((x, y), c)
    return _outline_mat(P, im, ol)


def bench(P):
    """벤치 2×1(위층): 나무 등판(가로 널 둘) + 앉는 판, 쇠 다리."""
    d, q, ol = P["dock"], P["quay"], P["i2_ol"][0]
    im = px.new(2 * T, T)
    for y in range(4, 16):
        for x in range(3, 31):
            if y >= 13:
                im.putpixel((x, y), SHADOW)
    for x in range(2, 30):
        for y, c in ((2, d[3]), (3, d[2]), (5, d[3]), (6, d[2]), (8, d[3]), (9, d[2]), (10, d[1])):
            im.putpixel((x, y), c)
    for x in (3, 4, 27, 28):
        for y in range(10, 14):
            im.putpixel((x, y), q[0] if x in (4, 28) else q[1])
    return _outline_mat(P, im, ol)


def fountain(P):
    """분수 3×3(물체, 막힘): 둥근 돌 수반(윗돌 밝음·앞면) 안의 물, 가운데 받침과 물줄기(위로 솟아 퍼진다)."""
    q, s, fo, ol = P["quay"], P["sea"], P["foam"], P["i2_ol"][0]
    im = px.new(3 * T, 3 * T)
    cx, cy = 23.5, 27.0
    for y in range(3 * T):
        for x in range(3 * T):
            d = ((x - cx) / 21) ** 2 + ((y - cy) / 15) ** 2
            if d <= 1:
                inner = ((x - cx) / 17) ** 2 + ((y - cy) / 11) ** 2 <= 1
                if inner:
                    c = sea_px(P, x, y, 0)
                    if ((x - cx) / 17) ** 2 + ((y - cy) / 11) ** 2 > 0.8:
                        c = s[3]
                else:
                    c = q[3] if y < cy - 4 else q[2] if y < cy + 6 else q[1]
                im.putpixel((x, y), c)
            elif ((x - cx) / 21) ** 2 + ((y - cy - 4) / 15) ** 2 <= 1 and y > cy:
                im.putpixel((x, y), q[1] if y < cy + 17 else q[0])   # 수반 앞면
    for y in range(20, 27):                                # 가운데 돌 받침(물 위로 솟은 잔)
        for x in range(20, 28):
            if ((x - cx) / 4) ** 2 + ((y - 23) / 3) ** 2 <= 1:
                im.putpixel((x, y), q[3] if y < 22 else q[2] if x < 25 else q[1])
    for y in range(5, 22):                                 # 물기둥
        for x in range(22, 26):
            im.putpixel((x, y), fo[1] if x < 24 else s[3])
    for side in (-1, 1):                                   # 양쪽으로 떨어지는 물줄기(끊긴 점선 = 물방울)
        for i in range(0, 26):
            t = i / 25
            x = cx + side * 13 * t
            y = 6 + 30 * (t - 0.18) ** 2
            if i % 4 == 3:
                continue
            for dx in (0, side):
                xx, yy = int(round(x + dx)), int(round(y))
                if 0 <= xx < 3 * T and 0 <= yy < 3 * T:
                    im.putpixel((xx, yy), fo[1] if dx == 0 else s[3])
    for x in range(int(cx) - 2, int(cx) + 3):
        im.putpixel((x, 4), fo[0])
    return _outline_mat(P, im, ol)


def planter(P):
    """돌 화분 1×1: 네모 돌 상자(윗면 밝음) 안에 둥근 관목."""
    q, lf = P["quay"], P["leaf"]
    im = px.new()
    for y in range(9, 16):
        for x in range(2, 15):
            c = q[3] if y == 9 else q[2] if x < 12 else q[1]
            if y == 15:
                c = q[0]
            im.putpixel((x, y), c)
    for y in range(1, 11):
        for x in range(2, 15):
            if ((x - 8) / 6.2) ** 2 + ((y - 6) / 5) ** 2 <= 1:
                l = (x - 8) + (y - 6)
                c = lf[3] if l < -4 else lf[2] if l < 1 else lf[1]
                im.putpixel((x, y), c)
    return _outline(im, lf[0])


def net_rack(P):
    """그물 건조대 2×2(위층, 막힘): 나무 기둥 둘(2px, 왼쪽 빛·윗머리 밝음)에 가로대를 걸고, 청록 노끈 그물(코 밑 짙은 그림자 1px)을 늘어뜨렸다.
    그물은 1px 노끈 마름모 코(5px)이고 코 사이는 투명해 바닥이 비친다. 아래 끝은 처지고 찌 둘을 매단다.
    바닥에 깐 체크무늬 그물 더미는 과자·부스러기로 읽혀 버렸다(적대 검수 L5 N1, 원작 문법 = 건조대에 건 성긴 그물)."""
    d, st, r, w = P["dock"], P["roof_teal"], P["i2_red"], P["i2_white"]   # 청록 노끈: 회청은 회색 포장과 명도가 같아 코가 사라졌다(L6 N6)
    im = px.new(2 * T, 2 * T)
    for x in range(2, 31):                                # 기둥·그물 밑 그림자(비켜 오른쪽 아래)
        im.putpixel((x, 30), SHADOW)
    for x0 in (3, 27):                                    # 기둥
        for y in range(3, 30):
            im.putpixel((x0, y), d[3] if y > 4 else d[3]); im.putpixel((x0 + 1, y), d[1])
            im.putpixel((x0 - 1, y), d[0]); im.putpixel((x0 + 2, y), d[0])
        im.putpixel((x0, 2), d[3]); im.putpixel((x0 + 1, 2), d[2])
        for xx in range(x0 - 1, x0 + 3):
            im.putpixel((xx, 30), d[0])
    for x in range(1, 31):                                # 가로대
        im.putpixel((x, 5), d[3] if x < 30 else d[1]); im.putpixel((x, 6), d[1]); im.putpixel((x, 7), d[0])
    def bottom(x):
        return 20.0 + 3.5 * math.sin(math.pi * (x - 5) / 22)
    for y in range(8, 26):                                # 그물: 코 사이 투명
        for x in range(5, 27):
            if y > bottom(x):
                continue
            k1, k2 = (x + y) % 5 == 0, (x - y) % 5 == 0
            if k1 or k2:
                im.putpixel((x, y), st[3] if (k1 and x < 16) else st[2])
    cord = {(x, y) for x in range(32) for y in range(32) if im.getpixel((x, y)) in (st[2], st[3])}
    for (x, y) in cord:                                   # 코 선 밑 1px 짙은 그림자 — 포장 위에서도 선이 선다
        if (x, y + 1) not in cord and im.getpixel((x, y + 1))[3] == 0:
            im.putpixel((x, y + 1), st[0])
    for x in range(5, 27):                                # 처진 아래 끝 노끈
        im.putpixel((x, int(bottom(x))), st[2]); im.putpixel((x, int(bottom(x)) + 1), st[0])
    for x in range(5, 27):                                # 위 끝(가로대에 묶인 매듭)
        if x % 5 == 0:
            im.putpixel((x, 8), st[1])
    for cx in (11, 21):                                   # 찌 둘
        cy = int(bottom(cx)) + 3
        for y in range(cy - 2, cy + 3):
            for x in range(cx - 2, cx + 3):
                dd = math.hypot(x - cx, y - cy)
                if dd <= 2.2:
                    im.putpixel((x, y), r[0] if dd > 1.6 else (w[2] if y < cy else r[1]))
    return im


def basket(P, fill: str):
    """생선·과일 바구니 1×1(위층): 엮은 나무 테(가로 결 + 밝은 위 테) 안에 담긴 것(생선 = 은색 길쭉한 몸, 과일 = 둥근 알)."""
    d = P["dock"]
    im = px.new()
    _shadow_ellipse(im, 9, 14, 6, 2)
    for y in range(7, 15):
        for x in range(2, 14):
            if abs(x - 7.5) <= 5.5 - (y - 7) * 0.2:
                c = d[2] if (y % 2) else d[1]
                if x >= 11:
                    c = d[1] if c == d[2] else d[0]
                im.putpixel((x, y), c)
    for x in range(2, 14):
        im.putpixel((x, 7), d[3])
    if fill == "fish":
        q = P["quay"]
        for fx, fy in ((4, 5), (8, 4), (6, 6)):
            for i in range(5):
                im.putpixel((fx + i, fy + (1 if i == 2 else 0)), q[3] if i < 3 else q[2])
            im.putpixel((fx + 5, fy), q[1]); im.putpixel((fx + 5, fy + 2), q[1])
    else:
        for (fx, fy), ramp in zip(((4, 5), (8, 5), (6, 3), (10, 4)), (P["i2_red"], P["i2_orange"], P["i2_yellow"], P["i2_red"])):
            for y in range(fy, fy + 3):
                for x in range(fx, fx + 3):
                    if (x - fx - 1) ** 2 + (y - fy - 1) ** 2 <= 1.6:
                        im.putpixel((x, y), ramp[2] if (x, y) == (fx, fy) else ramp[1])
    return _outline_mat(P, im, d[0])


PROPS = {
    "parasol_red": (lambda P: parasol(P, "i2_red"), "prop"), "parasol_blue": (lambda P: parasol(P, "i2_blue"), "prop"),
    "parasol_green": (lambda P: parasol(P, "i2_green"), "prop"),
    "deckchair": (deckchair, "prop"), "towel_red": (lambda P: towel(P, "i2_red"), "decor"), "towel_blue": (lambda P: towel(P, "i2_blue"), "decor"),
    "palm": (palm, "tree"), "tent_blue": (lambda P: tent(P, "i2_blue"), "prop"), "tent_orange": (lambda P: tent(P, "i2_orange"), "prop"),
    "lighthouse": (lighthouse, "building"), "sailboat": (sailboat, "prop"), "rowboat": (rowboat, "prop"),
    "lamp": (lamp, "prop"), "bench": (bench, "prop"), "fountain": (fountain, "prop"), "net_rack": (net_rack, "prop"),
    "searock_big": (lambda P: searock(P, True), "prop"), "searock_big_m": (lambda P: searock(P, "bigm"), "prop"), "searock_dome": (lambda P: searock(P, "dome"), "prop"), "rockmass": (lambda P: searock(P, "mass"), "prop"), "reef": (reef, "prop"),
    "airmat_teal": (lambda P: airmat(P, "shallow"), "decor"), "airmat_pink": (lambda P: airmat(P, "i2_red"), "decor"), "statue": (statue, "prop"),
}
SINGLES = {
    "searock": lambda P: searock(P, False), "sea_whirl": sea_whirl, "buoy": buoy, "swimring": swimring, "beachball": beachball, "bucket": bucket, "basket_fish": lambda P: basket(P, "fish"), "basket_fruit": lambda P: basket(P, "fruit"),
    "bollard": bollard, "sandrock": sandrock, "jar_a": lambda P: jar(P, 0), "jar_b": lambda P: jar(P, 1), "jar_c": lambda P: jar(P, 2), "crate": crate, "barrel": barrel, "planter": planter,
}
