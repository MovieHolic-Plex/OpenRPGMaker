"""동굴 한 벌 — 바닥 · 벽(오토타일 47, 윗면+앞면) · 계단/사다리/구멍 · 석순 · 깨지는 바위 · 동굴 입구(야외).
기준 팩(Scarloxy)에는 동굴이 없다. 그래서 화풍 규칙만 기준에서 가져온다: 4~5톤 램프, 윤곽은 그 재료의 가장 어두운 톤, 빛은 왼쪽 위(위·왼 가장자리는 밝은 테,
오른·아래 가장자리는 어두운 테), 1px 잡음 없이 2~3px 덩이. 색은 seed.palette 의 cave_floor·cave_wall 램프 안에서만 쓴다.
벽은 3/4 시점: 위에서 본 바위 윗면 + 남쪽으로 드러난 수직 앞면(FACE 행) 한 줄."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
import px  # noqa: E402
from px import N, E, S, W, NE, SE, SW, NW, T  # noqa: E402


import math

FACE = 14                        # 남쪽 앞면 높이(px)
_FLOOR: dict[tuple[int, int], tuple] = {}

AUTOTILE_PARAMS = {"cave_wall": ("cave-wall", 0, 9, 0), "cave_sand": ("cave-sand", 3, -1, 2)}  # 칸 전체 사분원 — 모래 구석이 칸 모서리로 안 보이게(적대 검수 「모래 구석이 네모」)

TAU2 = 2 * math.pi * 2 / T       # 16칸에서 딱 2번 출렁(8px 덩이) — 칸 이음새에서 위상이 이어진다       # 16칸에서 딱 3번 출렁 — 칸 이음새에서 위상이 이어진다


def floor_tex(P, v: int):
    """바닥: 조용한 두 톤. 원작 동굴 바닥처럼 명도 차가 작고 알갱이 잡음이 없다 — 큰 덩이 둘뿐.
    변형 0 기본 · 1 결 어긋남 · 2 가는 균열 · 3 자갈 두 개."""
    f = P["cave_floor"]
    im = px.new()
    r = px.rng(f"cavefloorh{v}")
    for y in range(T):
        for x in range(T):
            im.putpixel((x, y), f[2])
    for row in range(8):                                           # 가로로 누운 3×1 결 — 한 방향만, 줄마다 위치만 어긋난다
        yy = row * 2 + (v % 2)
        x = r.randrange(0, 5)
        while x < T:
            ln = r.choice((3, 4, 5))
            col = f[3] if (row + x) % 3 else f[1]
            for i in range(ln):
                im.putpixel(((x + i) % T, yy % T), col)
            x += ln + r.choice((2, 3, 4))
    if v == 2:
        for x, y in ((3, 4), (4, 5), (5, 5), (6, 6), (7, 6), (8, 7), (11, 11), (10, 12), (9, 12)):
            im.putpixel((x, y), f[1])
    if v == 3:
        for ox, oy in ((10, 3), (3, 11)):
            for dx, dy in ((0, 0), (1, 0), (0, 1), (1, 1)):
                im.putpixel((ox + dx, oy + dy), f[3] if (dx, dy) != (1, 1) else f[1])
            im.putpixel((ox, oy), f[4])
    return im


def init_floor(P):
    t = floor_tex(P, 0)
    for y in range(T):
        for x in range(T):
            _FLOOR[(x, y)] = t.getpixel((x, y))


def autotile_masks(kind: str) -> dict:
    name, depth, radius, amp = AUTOTILE_PARAMS[kind]
    return {m: px.inside_mask(m, name, depth, radius, amp) for m in px.ALL47}


def _stone(seeds, x, y):
    d1, d2, _, (vx, vy) = px.voronoi(seeds, x + 0.5, y + 0.5)
    if d2 - d1 < 1.0:
        return True, 0
    light = vx + vy
    if -4.6 < light < -2.4 and abs(vx - vy) < 2.0:
        return False, 3
    if light < -1.2:
        return False, 2
    if light > 2.0:
        return False, 0
    return False, 1


_TOP: dict = {}


def _top_tex(P, v: int):
    """암반 윗면(고원): 바닥보다 밝은 한 톤 면. 원작처럼 물결 한 줄(중간 톤, ±1px, 끝은 체커 디더)과 칸마다 다른 자리의 밝은 파편 몇 개. 격자 반복 없음."""
    if v not in _TOP:
        import math as _m
        w = P["cave_wall"]
        r = px.rng(f"cavetop2-{v}")
        im = px.new()
        for y in range(T):
            for x in range(T):
                im.putpixel((x, y), w[3])
        y0 = r.randrange(5, 11)
        ph = r.uniform(0, 6.28)
        x0, x1 = r.randrange(0, 3), r.randrange(12, 16)
        for x in range(x0, x1):
            yy = y0 + round(1.2 * _m.sin(x * 0.7 + ph))
            im.putpixel((x, yy % T), w[2])
            if x in (x0, x1 - 1) or x % 5 == 2:
                im.putpixel((x, (yy + 1) % T), w[2] if (x + yy) % 2 else w[3])
        for _ in range(r.choice((2, 3))):
            fx, fy = r.randrange(1, 14), r.randrange(1, 14)
            if abs(fy - y0) < 3:
                fy = (fy + 5) % 14 + 1
            im.putpixel((fx, fy), w[4])
            if r.random() < 0.6:
                im.putpixel((fx + 1, fy), w[4])
        _TOP[v] = im
    return _TOP[v]


def _ext_outside(m: int, inside, pad: int = 9):
    """칸 밖 pad 칸까지 포함한 「바깥」 픽셀 목록. 칸 밖은 이웃 비트(대각은 두 변이 다 이어졌을 때만)로 안/밖을 정한다."""
    out = []
    for y in range(-pad, T + pad):
        for x in range(-pad, T + pad):
            sx = -1 if x < 0 else 1 if x >= T else 0
            sy = -1 if y < 0 else 1 if y >= T else 0
            if sx == 0 and sy == 0:
                if not inside[y][x]:
                    out.append((x, y))
                continue
            if sx == 0 or sy == 0:
                ok = bool(m & {(0, -1): N, (1, 0): E, (0, 1): S, (-1, 0): W}[(sx, sy)])
            else:
                diag, both = {(1, -1): (NE, N | E), (-1, -1): (NW, N | W), (1, 1): (SE, S | E), (-1, 1): (SW, S | W)}[(sx, sy)]
                ok = bool(m & diag) and (m & both) == both
            if not ok:
                out.append((x, y))
    return out


_SHARD = px.torus_seeds("cave-shard", 9)
_FSHARD = px.torus_seeds("cave-fshard", 6)


def _shard_tone(seeds, x, y, sy=1.0):
    """파편 모양 면: 보로노이 한 조각이 한 톤. 조각 번호로 톤을 고르고 조각 안쪽 위·왼쪽만 한 단 밝다 — 윤곽선 없이 면 대비로만 쪼갠다."""
    d1, d2, i, (vx, vy) = px.voronoi(seeds, x + 0.5, (y + 0.5) * sy)
    return (i * 7 + 3) % 3, vx + vy


def _face_px(w, x: int, r: int, k: int, side: bool):
    """남쪽 앞면 한 점(앞면 = 한 칸 높이 16px). r = 맨 위에서 내려온 줄, k = 바닥에서 올라간 줄. 원작 벽 앞면:
    위는 윗면 색이 8px 주기 톱니로 파고들고, 그 아래는 8×8 다이아몬드 비늘이 줄마다 반 칸씩 엇갈려 채우며, 아래로 갈수록 어둡고 맨 아랫줄은 최암 윤곽."""
    if k == 0 or (side and k < FACE - 3):
        return w[0]
    u = x % 8
    tongue = 1 + round(2.6 * (1 - abs(u - 3.5) / 4.0))               # 톱니 깊이 1~3
    if r < tongue:
        return w[4] if (r == 0 and 2 <= u <= 5) else w[3]
    if r == tongue and r >= 2:
        return w[2]
    band = (r - 3) // 4 if r >= 3 else 0
    off = 4 * (band % 2)
    dx = abs((x + off) % 8 - 3.5)
    dy = abs((r - 3) % 4 - 1.5) * 1.5
    inside = dx + dy <= 3.6
    depth = k                                                       # 작을수록 바닥에 가깝다
    if depth <= 2:
        return w[0] if depth <= 1 else w[1]
    if inside:
        return w[3] if (dx + dy <= 1.6 and r < 9 and (x + off) % 8 < 4) else w[2]
    return w[1] if depth > 4 else w[1]


def wall_cell(P, m: int, deep: int | None = None, tier: int = 1, outside_void: bool = False):
    """벽(암반 고원) 한 칸, 3/4 시점. 윗면은 바닥보다 밝은 조용한 한 톤 면이고, 어두운 건 테두리 띠뿐이다.
    열린 변(북·서·동)에는 물결치는 3톤 띠(맨 바깥 최암 윤곽 → 어두운 띠 → 중간 띠 → 안쪽 밝은 선), 남쪽 앞면은 FACE px 높이의
    벽으로 맨 아랫줄이 최암 윤곽이다. 면 안쪽(deep)은 윗면 그대로 — 어두운 속이 없다."""
    w = P["cave_wall"]
    name, depth, radius, amp = AUTOTILE_PARAMS["cave_wall"]
    inside = px.inside_mask(m, name, depth, radius, amp)
    south_open = not (m & S)
    ybot = {}
    for x in range(T):
        ys = [y for y in range(T) if inside[y][x]]
        ybot[x] = max(ys) if ys else -1
    outside = _ext_outside(m, inside)
    tv = (deep if deep is not None else 0) + (3 if (deep is not None and tier == 1) else 0)
    top = _top_tex(P, tv)
    im = px.new()
    for y in range(T):
        for x in range(T):
            if not inside[y][x]:
                im.putpixel((x, y), px.tint(w[0], 0.5) if outside_void else _FLOOR[(x, y)])
                continue
            if deep is not None:
                im.putpixel((x, y), top.getpixel((x, y)))
                continue
            face = south_open and ybot[x] >= 0 and y > ybot[x] - FACE
            if face:
                k = ybot[x] - y
                side = (x > 0 and not inside[y][x - 1]) or (x < T - 1 and not inside[y][x + 1]) \
                    or (x == 0 and not m & W) or (x == T - 1 and not m & E)
                im.putpixel((x, y), _face_px(w, x, FACE - 1 - k, k, side))
                continue
            best, bdx, bdy = 99.0, 0, 0
            for ox, oy in outside:
                dx, dy = ox - x, oy - y
                if dy > 0 and south_open:
                    continue                                              # 아래쪽 바깥은 앞면이 맡는다
                d = math.hypot(dx, dy * (1.7 if dy < 0 else 1.0))
                if d < best:
                    best, bdx, bdy = d, dx, dy
            if best > 11.4:
                im.putpixel((x, y), top.getpixel((x, y)))
                continue
            topedge = bdy < 0 and abs(bdy) * 1.7 >= abs(bdx)
            if topedge:                                              # 윗변: 최암 한 줄 + 비늘 띠(디더로 윗면과 섞는다)
                dn = abs(bdy)
                if dn <= 1:
                    c = w[0]
                elif dn <= 2:
                    c = w[1]
                elif dn <= 3:
                    c = w[2] if (x + y) % 2 == 0 or x % 8 in (2, 3) else w[3]
                elif dn <= 4:
                    c = w[4] if (x + y) % 2 == 0 else w[3]
                else:
                    c = top.getpixel((x, y))
            else:                                                    # 옆변: 12px 폭, 세로로 쌓인 8px 주기 `<` 비늘 + 체커 디더
                lit = bdx < 0
                eff = abs(bdx) + 0.35 * abs(bdy) + 1.6 * (1 - abs(y % 8 - 3.5) / 3.5)
                if abs(bdx) + 0.35 * abs(bdy) <= 1.3:
                    c = w[0]
                elif lit:
                    c = w[1] if eff <= 3.8 else w[2] if eff <= 6.8 else (w[3] if (x + y) % 2 else w[2]) if eff <= 8.2 else w[3] if eff <= 11.0 else top.getpixel((x, y))
                else:
                    c = w[1] if eff <= 4.2 else w[2] if eff <= 8.0 else (w[2] if (x + y) % 2 else w[3]) if eff <= 9.6 else w[3] if eff <= 11.0 else top.getpixel((x, y))
            im.putpixel((x, y), c)
    return im


def void_tile(P):
    """동굴 바깥 어둠: 질감 없는 단색(벽 최암 윤곽보다 한 단 더 어둡다). 원작 동굴 맵의 바깥은 이렇게 까맣다."""
    w = P["cave_wall"]
    return px.fill(px.new(), px.tint(w[0], 0.5))


def floor_shadow(P):
    """벽 앞면 밑 바닥: 원작처럼 그림자 띠 없이, 앞면 맨 아랫줄(최암 윤곽)이 그대로 바닥에 닿는다. 닿는 첫 줄만 한 단 어둡게."""
    f = P["cave_floor"]
    im = px.new()
    for y in range(T):
        for x in range(T):
            c = _FLOOR[(x, y)]
            if y == 0:
                c = f[1]
            im.putpixel((x, y), c)
    return im


def _floor_base(P):
    im = px.new()
    for y in range(T):
        for x in range(T):
            im.putpixel((x, y), _FLOOR[(x, y)])
    return im


def hole_down(P):
    """아래층 구멍(원작 문법): 바닥에 뚫린 검은 원, 안쪽에 아래로 내려가는 사다리 가로대가 보인다. 둘레는 최암 한 줄, 밝은 입술 없음."""
    w, f = P["cave_wall"], P["cave_floor"]
    im = _floor_base(P)
    dark = px.tint(w[0], 0.45)
    ins = lambda x, y: ((x - 7.5) / 7.0) ** 2 + ((y - 8.0) / 6.6) ** 2 <= 1.0
    for y in range(T):
        for x in range(T):
            if ins(x, y):
                im.putpixel((x, y), dark)
    for y in (4, 7, 10):                                          # 가로대
        for x in range(5, 11):
            im.putpixel((x, y), w[3])
            im.putpixel((x, y + 1), w[1])
    for y in range(3, 13):                                        # 레일
        im.putpixel((5, y), w[4]); im.putpixel((10, y), w[3])
    return im


def ladder_up(P):
    """위층으로 오르는 사다리(원작 문법): 바닥 칸 위에 놓인 밝은 사다리 하나 — 레일 둘, 가로대 셋, 밑에 짧은 그림자. 이 칸에서 이동 이벤트를 건다."""
    w, f = P["cave_wall"], P["cave_floor"]
    im = _floor_base(P)
    for y in range(2, 14):                                        # 레일
        for x, c in ((4, w[0]), (5, w[4]), (6, w[1]), (9, w[0]), (10, w[4]), (11, w[1])):
            im.putpixel((x, y), c)
    for y in (4, 7, 10):                                          # 가로대
        for x in range(6, 9):
            im.putpixel((x, y), w[4])
            im.putpixel((x, y + 1), w[1])
    for x in range(4, 12):
        im.putpixel((x, 14), f[0])
    return im


def pebbles(P, v: int):
    """작은 바위 무더기(원작 소품 문법): 둥근 돌 3~4개가 나란히 앉은 모양. 돌마다 윤곽(아래·오른쪽 최암, 위·왼쪽 중간 톤)이 따로 있고 안은 위·왼 밝음, 밑에 한 줄 그늘. 통행 불가 장식."""
    w, f = P["cave_wall"], P["cave_floor"]
    lobes = [(4.6, 8.4, 3.7), (11.2, 8.0, 3.9), (8.0, 4.6, 3.3)] if v == 0 else [(4.0, 9.0, 3.5), (9.0, 9.4, 3.9), (12.6, 5.6, 2.9), (6.8, 4.4, 2.9)]
    def owner(x, y):
        best, bi = 9.0, -1
        for i, (cx, cy, r) in enumerate(lobes):
            d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5 / r
            if d <= 1.0 and d < best:
                best, bi = d, i
        return bi
    im = _floor_base(P)
    for y in range(T):
        for x in range(T):
            o = owner(x, y)
            if o < 0:
                continue
            cx, cy, r = lobes[o]
            n = {k: owner(x + dx, y + dy) for k, (dx, dy) in {"u": (0, -1), "r": (1, 0), "d": (0, 1), "l": (-1, 0)}.items()}
            light = -((x - cx) + (y - cy)) / r
            if n["d"] != o or n["r"] != o:
                c = w[0]
            elif n["u"] != o or n["l"] != o:
                c = w[2] if n["u"] < 0 or n["l"] < 0 else w[1]
            else:
                c = w[4] if light > 0.75 else w[3] if light > 0.05 else w[2]
            im.putpixel((x, y), c)
    for x in range(2, 14):
        if owner(x, 12) >= 0 or owner(x, 13) >= 0:
            im.putpixel((x, 14), f[1]); im.putpixel((x, 13) if owner(x, 13) < 0 else (x, 14), f[1])
    return im


def sand_patch(P, v: int):
    """동굴 바닥의 노란 모래 구역(원작 소품): 한 톤 면에 점 몇 개. 경계는 칸 단위 계단식으로 이웃 칸을 배치해 만든다."""
    c = P["cave_sand"]
    im = px.new()
    r = px.rng(f"cavesand{v}")
    for y in range(T):
        for x in range(T):
            im.putpixel((x, y), c[2])
    for _ in range(9):
        im.putpixel((r.randrange(T), r.randrange(T)), c[1] if r.random() < 0.6 else c[3])
    return im


def sand_cell(P, m: int):
    """동굴 모래 구역 오토타일: 안은 모래 면(점 몇 개), 경계는 물결 2px + 바깥 바닥 쪽으로 모래 알 디더 한 줄 — 사각 구역이 칸 모양으로 안 보인다."""
    c = P["cave_sand"]
    inside = px.inside_mask(m, *AUTOTILE_PARAMS["cave_sand"])
    tex = sand_patch(P, 0)
    h = px.rng("cave-sand-fringe")
    table = [[h.random() for _ in range(T)] for _ in range(T)]
    im = px.new()
    for y in range(T):
        for x in range(T):
            nb = px.neighbours4(inside, x, y, m)
            if inside[y][x]:
                col = tex.getpixel((x, y))
                if not all(nb.values()) and table[y][x] < 0.5:
                    col = c[1]
                im.putpixel((x, y), col)
            else:
                col = _FLOOR[(x, y)]
                if any(nb.values()) and (x + y) % 2 == 0:
                    col = c[1] if table[y][x] < 0.7 else col
                im.putpixel((x, y), col)
    return im


def stalagmite(P, part: str, kind: str = "a"):
    """석순 1×2: 밑이 넓고 끝이 뭉툭하게 좁아지는 하나의 돌기둥(고깔·연필·눈사람 아님). 윤곽은 살짝 울퉁불퉁, 왼쪽 면 밝음·오른쪽 면 어둠, 끝은 밝은 채움, 가로 층 홈 한두 줄, 밑동 잔돌, 오른쪽 아래 그림자."""
    import math
    w, f = P["cave_wall"], P["cave_floor"]
    r = px.rng(f"stal3-{kind}")
    ph = [r.uniform(0, 6.28) for _ in range(3)]
    base_half, tip_half, expo = (6.8, 2.2, 0.95) if kind == "a" else (5.6, 1.8, 0.9)
    H = 27 if kind == "a" else 29
    prof = []
    for yy in range(H):
        t = yy / (H - 1)
        half = tip_half + (base_half - tip_half) * (t ** expo)
        half += 0.28 * math.sin(yy * 0.45 + ph[0])
        prof.append(max(1.3, half))
    off = 32 - H
    im = px.new()
    for y in range(T):
        yy = (y if part == "t" else y + T) - off
        if yy < 0 or yy >= H:
            continue
        half = prof[yy]
        cx = 7.6 + 0.35 * math.sin(yy * 0.3 + ph[2])
        for x in range(T):
            dx = x - cx
            if abs(dx) > half:
                continue
            u = (dx + half) / (2 * half)
            edge_l, edge_r = dx < -half + 1.0, dx > half - 1.0
            tip = yy <= 1
            if edge_r or (yy >= H - 1) or (tip and abs(dx) > half - 0.8):
                c = w[0]
            elif edge_l:
                c = w[2] if yy > 4 else w[3]
            elif tip:
                c = w[4]
            else:
                c = w[4] if u < 0.28 else w[3] if u < 0.52 else w[2] if u < 0.78 else w[1]
            im.putpixel((x, y), c)
    if part == "b":
        for x, y in ((0, 14), (15, 14)):
            im.putpixel((x, y), w[2] if x < 8 else w[1])
        for x in range(9, 16):
            if im.getpixel((x, 15))[3] == 0:
                im.putpixel((x, 15), f[0])
    return im


def _boulder_px(P, x, y, lobes):
    return any((x - cx) ** 2 + (y - cy) ** 2 <= r * r for cx, cy, r in lobes)


def _cave_rock(P, cracked: bool):
    """동굴 바위(칸을 가득 채움): 큰 덩이 하나+작은 덩이 둘, 덩이마다 왼쪽 위 밝음·오른쪽 아래 그늘·최암 윤곽, 밑에 바닥 그림자. 금 간 바위는 지그재그 균열."""
    w, f = P["cave_wall"], P["cave_floor"]
    lobes = [(8.2, 6.8, 6.0), (4.4, 10.0, 3.9), (11.8, 10.2, 4.0)] if not cracked else [(7.2, 6.0, 5.4), (4.6, 10.4, 4.2), (11.2, 10.4, 4.4)]
    ins = lambda x, y: _boulder_px(P, x, y, lobes)
    im = _floor_base(P)
    for x in range(1, 15):
        if ins(x, 12) or ins(x, 13):
            im.putpixel((x, 14), f[0]); im.putpixel((min(15, x + 1), 15), f[1] if x % 2 else f[0])
    for y in range(T):
        for x in range(T):
            if not ins(x, y):
                continue
            edge = [not ins(x + dx, y + dy) for dx, dy in ((0, -1), (1, 0), (0, 1), (-1, 0))]
            cx, cy, r = min(lobes, key=lambda l: (x - l[0]) ** 2 + (y - l[1]) ** 2 - l[2] ** 2)
            light = -((x - cx) + (y - cy)) / r
            if edge[2] or edge[1]:
                c = w[0]
            elif edge[0] or edge[3]:
                c = w[2]
            else:
                c = w[4] if light > 0.7 else w[3] if light > 0.15 else w[2] if light > -0.55 else w[1]
            im.putpixel((x, y), c)
    if cracked:
        for (x, y) in ((6, 3), (7, 4), (6, 5), (7, 6), (8, 7), (7, 8), (8, 9), (11, 8), (10, 9), (11, 10)):
            im.putpixel((x, y), w[0])
    return im


def cracked_rock(P):
    return _cave_rock(P, True)


def cave_boulder(P):
    return _cave_rock(P, False)


def cave_mouth(P):
    """야외 동굴 입구 3×3: 풀밭에 앉은 암반 덩어리 — 윗면은 밝은 고원 면, 옆·윗변은 3톤 띠, 앞면(남쪽)은 톱니+다이아몬드 비늘이고 그 가운데에 검은 문이 뚫린다. 입구 칸 = 아래 가운데."""
    import monster_overworld as mo
    g, w = P["grass"], P["cave_wall"]
    W3 = 3 * T
    im = px.new(W3, W3)
    for y in range(W3):
        for x in range(W3):
            im.putpixel((x, y), mo._GRASS0[(x % T, y % T)])
    X0, X1, Y0, Y1, R = 3, W3 - 4, 12, W3 - 3, 8
    def inside(x, y):
        if not (X0 <= x <= X1 and Y0 <= y <= Y1):
            return False
        cx = min(x - X0, X1 - x); cy = y - Y0
        return not (cx < R and cy < R and (R - cx - 0.5) ** 2 + (R - cy - 0.5) ** 2 > R * R)
    FACEY = Y1 - FACE_M + 1
    top = _top_tex(P, 0)
    door = lambda x, y: (18 <= x <= 29 and y >= 31) or (((x - 23.5) / 6.4) ** 2 + ((y - 31) / 7.0) ** 2 <= 1.0 and y < 31)
    for y in range(W3):
        for x in range(W3):
            if not inside(x, y):
                continue
            if y >= FACEY:
                k = Y1 - y
                side = x - X0 < 2 or X1 - x < 2
                c = _face_px(w, x - X0, y - FACEY, k, side)
            else:
                dl, dr, dt = x - X0, X1 - x, y - Y0
                # 모서리 근처는 둥근 바깥까지의 거리로
                dd = min(dl, dr)
                if dt < R and dd < R:
                    dd = min(dd, 99)
                    dist = ((R - min(dl, dr) - 0.5) ** 2 + (R - dt - 0.5) ** 2) ** 0.5
                    d_edge = R - dist if min(dl, dr) < R and dt < R else None
                else:
                    d_edge = None
                if d_edge is not None:
                    q = d_edge
                    c = w[0] if q <= 1.3 else w[1] if q <= 3.5 else w[2] if q <= 6.0 else w[3] if (x + y) % 2 and q <= 7.5 else top.getpixel((x % T, y % T))
                elif dt <= 4:
                    c = w[0] if dt <= 0 else w[1] if dt <= 1 else w[2] if dt <= 2 else (w[4] if (x + y) % 2 else w[3])
                elif dd <= 11:
                    lit = dl < dr
                    eff = dd + 1.6 * (1 - abs(y % 8 - 3.5) / 3.5)
                    if dd <= 1:
                        c = w[0]
                    elif lit:
                        c = w[1] if eff <= 3.8 else w[2] if eff <= 6.8 else (w[3] if (x + y) % 2 else w[2]) if eff <= 8.2 else w[3] if eff <= 11.0 else top.getpixel((x % T, y % T))
                    else:
                        c = w[1] if eff <= 4.2 else w[2] if eff <= 8.0 else (w[2] if (x + y) % 2 else w[3]) if eff <= 9.6 else w[3] if eff <= 11.0 else top.getpixel((x % T, y % T))
                else:
                    c = top.getpixel((x % T, y % T))
            im.putpixel((x, y), c)
    for y in range(W3):
        for x in range(W3):
            if not (inside(x, y) and door(x, y)):
                continue
            edge = any(not door(x + dx, y + dy) for dx, dy in ((0, -1), (-1, 0), (1, 0)))
            kk = (y - 24) / 21.0
            im.putpixel((x, y), w[0] if edge else px.tint(w[0], 0.55 if kk > 0.3 else 0.8))
    for y in range(W3):
        for x in range(W3):                                           # 문틀: 아치 둘레 한 겹 밝은 돌
            if inside(x, y) and not door(x, y) and y >= 22 and any(door(x + dx, y + dy) for dx, dy in ((0, 1), (1, 0), (-1, 0), (0, -1), (1, -1), (-1, -1))):
                im.putpixel((x, y), w[3] if x < 24 else w[1])
    return im


FACE_M = 24                                                          # 입구 덩어리의 앞면 높이(px)


# ---- 화강 동굴 문법(본 시트 동굴 벽, 적대 검수 L1 N3) -----------------------------------------------------------
# 옛 벽(wall_cell)은 윗면이 바닥보다 밝은 살구색 + 「~」 물결이라 모래 언덕·구운 빵으로 읽혔다. 원작 화강 동굴(RSE Granite Cave) 실측 문법:
# 벽 윗면은 바닥과 같은 계열의 거친 돌(바닥보다 같거나 어둡고 채도 낮음, 2~3px 돌 덩이 + 금), 남쪽 앞면은 한 칸(16px) 높이의 세로 바위 기둥 줄
# (8px 주기, 왼쪽 빛·오른쪽 그늘·기둥 사이 최암 홈, 맨 아래 2px 최암), 동·서 끝은 4px 사선 옆면(서쪽 면은 빛, 동쪽 면은 그늘).
# 옛 wall_cell 은 기후(사막 벼랑)·던전 시트가 램프만 바꿔 쓰므로 그대로 두고, 본 시트 동굴은 이 함수들을 쓴다.
_GTOP: dict = {}


def _deep(P):
    return px.tint(P["cave_floor"][0], 0.62)


# 손으로 정한 윗면 잔돌 배치 (x, y, 폭, 높이) — 칸 주기로 감긴다. 통합 I3 Z2: 옛 변형 0 은 rng 가 잔돌 셋을 한 높이(y≈3)에 6px 간격으로 앉혀,
# 가장자리 칸(at*)·속 칸 mid0 이 늘어선 곳에서 곧은 변 17칸이 「리벳 박은 점선」, 3×3 이 격자로 보였다.
# 이제 셋이 서로 다른 높이(4·8·12 줄 언저리)와 고르지 않은 가로 자리에 앉는다. 9·10 은 같은 밀도의 엇갈린 배치 —
# 곧은 변(at110)의 교대 칸으로 쓴다(granite_wall(top_v=…), 쇼케이스가 칸 위치 해시로 섞는다). 재료·램프·돌 모양은 rng 변형과 같다.
_GTOP_HAND = {
    0: ((2, 4, 4, 3), (10, 7, 3, 4), (5, 12, 3, 3)),
    9: ((7, 3, 3, 3), (13, 9, 4, 3), (1, 10, 3, 4)),
    10: ((11, 4, 4, 3), (3, 7, 3, 3), (8, 12, 4, 3)),
}


def _top_stone(im, x, y, w, h, f, dp):
    """윗면 돌 하나: 네 귀를 깎은 둥근 돌 — 왼쪽·위 테 f2(빛), 몸 f1, 오른쪽·아래 테 최암."""
    for dy in range(h):
        for dx in range(w):
            if (dx, dy) in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
                continue
            if dx == w - 1 or dy == h - 1:
                c = dp
            elif dx == 0 or dy == 0:
                c = f[2]
            else:
                c = f[1]
            im.putpixel(((x + dx) % T, (y + dy) % T), c)


def granite_top(P, v: int):
    """벽 윗면(위에서 본 암반): 바닥보다 두 단 어둡다 — 바탕 f0 + 3~4px 돌 덩이(몸 f1, 왼쪽 위 f2, 오른쪽 아래 최암) + 짧은 금(최암). 칸 주기로 감긴다.
    변형 0·9·10 은 손으로 정한 배치(_GTOP_HAND), 나머지는 rng."""
    if v not in _GTOP:
        f = P["cave_floor"]
        dp = _deep(P)
        im = px.fill(px.new(), f[0])
        if v in _GTOP_HAND:
            for x, y, w, h in _GTOP_HAND[v]:
                _top_stone(im, x, y, w, h, f, dp)
            _GTOP[v] = im
            return im
        r = px.rng(f"granite-top2-{v}")
        stones = []
        tries = 0
        while len(stones) < 4 and tries < 300:                          # 속 칸 4개(가장자리 칸 변형 0 은 손 배치 3개)
            tries += 1
            x, y, w, h = r.randrange(T), r.randrange(T), r.choice((3, 4, 4)), r.choice((3, 3, 4))
            if all(min(abs(x - a) % T, T - abs(x - a) % T) > 5 or min(abs(y - b) % T, T - abs(y - b) % T) > 4 for a, b in stones):
                stones.append((x, y))
                _top_stone(im, x, y, w, h, f, dp)
        for _ in range(1 if v in (2, 5) else 0):                       # 금: 대각 3px(속 변형 둘에만)
            x, y = r.randrange(T), r.randrange(T)
            sx = r.choice((1, -1))
            for k in range(3):
                if im.getpixel(((x + k * sx) % T, (y + k) % T)) == f[0]:
                    im.putpixel(((x + k * sx) % T, (y + k) % T), dp)
        _GTOP[v] = im
    return _GTOP[v]


# ---- 바위 절벽 앞면(동굴 벽·고원·동굴 입구가 같은 문법, 적대 검수 L2 N28·N30·N31) ------------------------------------
# 원작 화강 동굴·111번 도로 절벽: 앞면은 그 자리에서 가장 어두운 면이다. 폭 3~6px 의 세로 주름이 불규칙하게 이어 앉고(같은 폭이 되풀이되지 않는다),
# 주름마다 왼쪽 1px 만 빛(왼쪽 위 광원), 오른쪽 1px 는 최암 홈. 위 2px 은 밝은 테(햇빛 받는 모서리), 아래 3px 은 최암 — 위 밝음 → 아래 어둠.
# 주름 몇 개는 중간에서 가로 금으로 끊겨 큰 면·작은 면이 섞인다. 칸 변형(v)마다 주름 폭·금 자리가 달라 맵에서 해시로 섞으면 주기가 안 보인다.
# 주름은 칸 안에서 x=0 에서 시작해 x=15 홈으로 끝나므로 어느 변형끼리 붙어도 이음새가 맞는다.
_LUMPS = (((3.0, .30, 3.8, .31), (10.0, .24, 4.4, .27), (14.6, .40, 2.6, .24), (6.5, .70, 4.6, .32), (13.4, .74, 3.4, .29), (0.6, .76, 2.6, .25)),
          ((2.0, .34, 3.1, .33), (7.6, .26, 3.5, .25), (13.0, .38, 3.9, .36), (5.0, .74, 4.1, .28), (10.6, .74, 2.9, .30), (15.4, .80, 2.2, .20)),
          ((4.6, .32, 4.5, .33), (12.0, .21, 3.1, .22), (11.6, .62, 4.3, .34), (1.8, .72, 3.1, .28), (7.2, .80, 2.6, .22), (15.0, .30, 2.0, .22)))
# 앞면 바위 덩이: (중심 x(칸 안, 가로로 감김), 중심 y(앞면 높이 비율), 반폭 px, 반높이 비율). 아래 덩이가 위 덩이를 덮는다(앞에 있다).


def cliff_ramp(darkest, groove, body, lit, rim):
    return (darkest, groove, body, lit, rim)


def cliff_face_px(ramp, x: int, r: int, n: int, v: int = 0):
    """절벽 앞면 한 점. ramp = (최암, 홈, 몸, 빛, 테). x = 칸 안 가로(0..15), r = 앞면 맨 위에서 내려온 줄(0..n-1), n = 앞면 높이.
    크고 작은 바위 덩이 여섯이 겹쳐 앉은 면: 덩이마다 왼쪽 위가 밝고(테 → 빛 → 몸), 오른쪽 아래 가장자리는 홈.
    덩이 사이 틈은 홈·최암, 아래쪽 1/3 덩이는 한 단 어둡고, 맨 아래 2줄은 최암 — 위 밝음 → 아래 어둠.
    덩이 머리가 앞면 맨 위를 들쭉날쭉하게 만든다(그 위로 윗면이 비친다). 칸 변형(v)마다 덩이 배치가 다르다."""
    darkest, groove, body, lit, rim = ramp
    k = n - 1 - r
    if k <= 1:
        return darkest
    best = None
    for cx, cyf, rx, ryf in sorted(_LUMPS[v % len(_LUMPS)], key=lambda l: l[1]):
        cy, ry = cyf * n, max(1.6, ryf * n)
        dx = (x + 0.5 - cx + T / 2) % T - T / 2
        dy = r + 0.5 - cy
        nx, ny = dx / rx, dy / ry
        if nx * nx + ny * ny <= 1.0:
            best = (nx, ny)                                                # 아래(앞) 덩이가 이긴다
    if best is None:
        return None if r < 2 else groove if k > n // 3 else darkest      # 덩이 사이 틈
    nx, ny = best
    e = nx * nx + ny * ny
    if e > 0.74 and nx + ny > 0.15:
        return groove if k > n // 3 else darkest                         # 오른쪽 아래 윤곽
    hd = math.hypot(nx + 0.42, ny + 0.5)
    tones = (rim, lit, body, groove) if k > n // 3 else (lit, body, groove, darkest)
    return tones[0] if hd < 0.34 else tones[1] if hd < 0.78 else tones[2] if hd < 1.2 else tones[3]


_BOULDERS = ((4.6, 7.4, 5.4, 7.8), (12.4, 7.0, 4.8, 7.6))            # 한 칸 앞면의 바위 둘: (중심 x, 중심 y, 반폭, 반높이) — 칸 주기로 감긴다


def _lump_tone(P, dx, dy, rx, ry, lit=True):
    """둥근 바위 덩이 한 점의 톤: 왼쪽 위 작은 빛 덩이(f3) → 몸 f2 → 오른쪽 아래 그늘 f1 → 가장자리 f0 → 아래·오른쪽 윤곽 최암.
    lit=False(동쪽 옆면)는 한 단 어둡다."""
    f = P["cave_floor"]
    dp = _deep(P)
    nx, ny = dx / rx, dy / ry
    e = nx * nx + ny * ny
    if e > 0.78 and nx + ny > 0.25:
        return dp
    hd = math.hypot(nx + 0.42, ny + 0.48)
    tones = (f[3], f[2], f[1], f[0]) if lit else (f[2], f[1], f[0], dp)
    return tones[0] if hd < 0.32 else tones[1] if hd < 0.82 else tones[2] if hd < 1.22 else tones[3]


def granite_face_ramp(P):
    """동굴 앞면 램프: 바닥(f2)보다 두 단 어둡게 — 몸은 f0 보다도 어둡고, 아래는 최암(_deep). 테만 바닥 톤."""
    f = P["cave_floor"]
    dp = _deep(P)
    return cliff_ramp(px.tint(dp, 0.8), dp, px.tint(f[0], 0.84), f[0], f[2])


def _gface(P, x: int, r: int, k: int, side_l: bool, side_r: bool, v: int = 0):
    """동굴 남쪽 앞면 한 점(적대 검수 L2 N28 — 같은 알약 반복·앞면이 밝아 돌담으로 읽혔다): 공용 절벽 앞면(cliff_face_px).
    r = 앞면 맨 위에서 내려온 줄, k = 바닥에서 올라간 줄. 동·서 끝 열은 최암 윤곽."""
    ramp = granite_face_ramp(P)
    if k == 0 or side_l or side_r:
        return ramp[0] if k == 0 else ramp[1]
    return cliff_face_px(ramp, x % T, r, T, v)


def _gside(P, d: float, along: int, lit: bool):
    """동·서 옆면 한 점(바깥에서 d px 안, 변을 따라 along): 8px 주기로 변을 따라 이어 앉은 바위 덩이(폭 6px). 서쪽 면은 빛, 동쪽 면은 그늘."""
    f = P["cave_floor"]
    dp = _deep(P)
    if d <= 1.0:
        return dp
    if d > 6.4:
        return None
    a = (along % 8) + 0.5 - 4.0
    dx = (d - 3.6) if lit else (3.6 - d)                                  # 덩이 안 가로 위치: 서쪽 면은 바깥(서)이 -x, 동쪽 면은 바깥(동)이 +x
    return _lump_tone(P, dx, a, 3.4, 4.6, lit)


def granite_wall(P, m: int, deep: int | None = None, tier: int = 1, outside_void: bool = False, face_v: int = 0, top_v: int | None = None):
    """벽 한 칸(3/4): 윗면 granite_top · 북쪽이 열린 변은 최암 1px + f0 1px 테 · 동서가 열린 변은 4px 사선 옆면 · 남쪽이 열린 칸은 한 칸 높이 기둥 앞면.
    top_v = 윗면 잔돌 배치 변형(기본: 가장자리 0, 속은 deep/tier 로 정함) — 곧은 변 교대 칸(_GTOP_HAND 9·10)이 쓴다."""
    f = P["cave_floor"]
    dp = _deep(P)
    name, depth, radius, amp = AUTOTILE_PARAMS["cave_wall"]
    inside = px.inside_mask(m, name, depth, radius, amp)
    south_open = not (m & S)
    ybot = {}
    for x in range(T):
        ys = [y for y in range(T) if inside[y][x]]
        ybot[x] = max(ys) if ys else -1
    outside = _ext_outside(m, inside)
    tv = (deep if deep is not None else 0) + (3 if (deep is not None and tier == 1) else 0)
    top = granite_top(P, tv if top_v is None else top_v)
    im = px.new()
    for y in range(T):
        for x in range(T):
            if not inside[y][x]:
                im.putpixel((x, y), px.tint(P["cave_wall"][0], 0.5) if outside_void else _FLOOR[(x, y)])
                continue
            if deep is not None:
                im.putpixel((x, y), top.getpixel((x, y)))
                continue
            if south_open and ybot[x] >= 0 and y > ybot[x] - T:
                k = ybot[x] - y
                r = (T - 1) - k
                sl = (x > 0 and not inside[y][x - 1]) or (x == 0 and not m & W)
                sr = (x < T - 1 and not inside[y][x + 1]) or (x == T - 1 and not m & E)
                c = _gface(P, x, r, k, sl, sr, face_v)
                if c is not None:
                    im.putpixel((x, y), c)
                    continue
            best, bdx, bdy = 99.0, 0, 0
            for ox, oy in outside:
                dx, dy = ox - x, oy - y
                if dy > 0 and south_open:
                    continue
                d = math.hypot(dx, dy)
                if d < best:
                    best, bdx, bdy = d, dx, dy
            if best > 6.4:
                im.putpixel((x, y), top.getpixel((x, y)))
                continue
            d = int(best)
            if bdy < 0 and abs(bdy) >= abs(bdx):                        # 북쪽 테: 등 뒤로 떨어지는 면은 안 보인다 — 최암 1 + 밝은 모서리 1
                c = dp if best <= 1.2 else f[1] if best <= 2.2 else top.getpixel((x, y))
            else:                                                       # 서쪽(빛)·동쪽(그늘) 옆면: 변을 따라 이어 앉은 바위 덩이
                c = _gside(P, best, y, bdx < 0)
                if c is None:
                    c = top.getpixel((x, y))
            im.putpixel((x, y), c)
    return im


def _speckle(name: str, base, accents, gap: int = 2):
    """조용한 점 질감(L2 N34 — 3px 줄 + 1px 기둥이 「ㅜ」 글자로 읽혔다): 1px 점 또는 2px 가로·세로·대각 짝만 흩뿌린다.
    점끼리 gap px 안으로 붙지 않아 글자 모양이 생기지 않는다. 칸 주기로 감긴다."""
    im = px.fill(px.new(), base)
    r = px.rng(name)
    taken: set = set()
    for color, count in accents:
        placed, tries = 0, 0
        while placed < count and tries < 400:
            tries += 1
            x, y = r.randrange(T), r.randrange(T)
            shape = ((0, 0),) if r.random() < 0.3 else r.choice((((0, 0), (1, 0)), ((0, 0), (0, 1)), ((0, 0), (1, 1))))
            pts = [((x + dx) % T, (y + dy) % T) for dx, dy in shape]
            if any(((px_ + ax) % T, (py_ + ay) % T) in taken for px_, py_ in pts for ax in range(-gap, gap + 1) for ay in range(-gap, gap + 1)):
                continue
            for q in pts:
                im.putpixel(q, color)
                taken.add(q)
            placed += 1
    return im


def granite_floor(P, v: int):
    """바닥(L1 N19 · L2 N34): 조용한 점 질감. 바탕 f2 + 밝은 점 f3 + 어두운 점 f1(1~2px, 방향 없음, 서로 떨어져 있다).
    변형 2 는 가는 금 한 줄, 3 은 잔돌 둘."""
    f = P["cave_floor"]
    im = _speckle(f"granite-floor3-{v}", f[2], [(f[3], 8), (f[1], 6)])
    if v == 2:
        for x, y in ((4, 5), (5, 6), (6, 6), (7, 7), (8, 8)):
            im.putpixel((x, y), f[1])
    if v == 3:
        for ox, oy in ((10, 3), (3, 11)):
            im.putpixel((ox, oy), f[4]); im.putpixel((ox + 1, oy), f[3]); im.putpixel((ox, oy + 1), f[3]); im.putpixel((ox + 1, oy + 1), f[0])
    return im


def granite_floor_shadow(P):
    """벽 앞면 밑 바닥(L2 N34 — 세로 막대 줄이 장식 띠로 읽혔다): 앞면 최암 밑에 위에서 아래로 옅어지는 그림자 3px(f0 → f1 성김 → f1 드묾)."""
    f = P["cave_floor"]
    im = px.new()
    for y in range(T):
        for x in range(T):
            c = _FLOOR[(x, y)]
            if y == 0 or (y == 1 and x % 2 == 0) or (y == 2 and x % 4 == 1):
                c = f[0] if y == 0 else f[1]
            elif y == 1:
                c = f[1]
            im.putpixel((x, y), c)
    return im


def init_granite_floor(P):
    _GTOP.clear()
    t = granite_floor(P, 0)
    for y in range(T):
        for x in range(T):
            _FLOOR[(x, y)] = t.getpixel((x, y))


def granite_ramp(P):
    """석순·구멍 같은 옛 동굴 소품을 화강 벽과 같은 램프로 그리게 하는 P(cave_wall 자리에 바닥 계열 5톤)."""
    f = P["cave_floor"]
    return dict(P, cave_wall=[_deep(P), f[0], f[1], f[2], f[3]])


def granite_ladder(P):
    """위층 사다리(L1 N4 — 벽 앞면에 회색 네모로 박혔다): 벽 바로 아래 바닥 칸(그늘 바닥 위)에 서는 나무 사다리. 레일 둘이 칸 위끝까지 닿아 벽에 기댄다."""
    wd = P["wood"]
    im = granite_floor_shadow(P)
    for y in range(0, 14):
        for x, c in ((3, wd[0]), (4, wd[3]), (5, wd[1]), (10, wd[0]), (11, wd[3]), (12, wd[1])):
            im.putpixel((x, y), c)
    for y in (2, 6, 10):
        for x in range(6, 10):
            im.putpixel((x, y), wd[3]); im.putpixel((x, y + 1), wd[1])
    for x in range(3, 14):
        im.putpixel((x, 14), P["cave_floor"][0])
    return im


def push_boulder(P):
    """동굴 밀 바위(cave_boulder): 체육관 밀 바위 g2_boulder0 과 같은 그림을 동굴 바닥 위에 얹은 칸(감독 지시 2026-10-02 — 밀기 바위 그림은 하나).
    깨는 바위(갈색·X 금)·잔돌(작고 어둡다)과 색·모양이 다르다."""
    import gym2 as g2_
    im = _floor_base(P)
    im.alpha_composite(g2_.boulder(P, 0))
    return im


def smash_rock(P):
    """깨는 바위(바위깨기, L1 N5): 갈색 각진 바위에 X자 금(최암 1px + 그 옆 밝은 1px)이 뚜렷하다."""
    w, f = P["cave_wall"], P["cave_floor"]
    lobes = [(7.6, 6.6, 5.8), (4.4, 10.2, 4.0), (11.4, 10.4, 4.0)]
    ins = lambda x, y: _boulder_px(P, x, y, lobes)
    im = _floor_base(P)
    for x in range(1, 15):
        if ins(x, 12) or ins(x, 13):
            im.putpixel((x, 14), f[0])
    for y in range(T):
        for x in range(T):
            if not ins(x, y):
                continue
            edge = [not ins(x + dx, y + dy) for dx, dy in ((0, -1), (1, 0), (0, 1), (-1, 0))]
            light = -((x - 7.6) + (y - 7.5)) / 7.0
            if edge[2] or edge[1]:
                c = w[0]
            elif edge[0] or edge[3]:
                c = w[1]
            else:
                c = w[3] if light > 0.55 else w[2] if light > -0.35 else w[1]
            im.putpixel((x, y), c)
    for k in range(-4, 5):                                             # X자 금
        for (x, y) in ((8 + k, 8 + k), (8 + k, 8 - k)):
            if ins(x, y) and ins(x + 1, y):
                im.putpixel((x, y), w[0])
                if ins(x + 1, y) and abs(k) < 4:
                    im.putpixel((x + 1, y), w[4])
    return im


def small_pebbles(P, v: int):
    """잔돌 무더기(L1 N5 — 바위와 같은 크기·색이라 헷갈렸다): 10px 이하, 바닥 램프 한 톤 어두운 돌 셋. 통행 불가 장식."""
    f = P["cave_floor"]
    lobes = [(5.4, 9.8, 3.4), (10.6, 10.2, 3.1), (8.2, 6.4, 2.9)] if v == 0 else [(5.0, 10.4, 3.2), (9.8, 10.4, 3.5), (11.4, 6.6, 2.6)]
    def owner(x, y):
        for i, (cx, cy, r) in enumerate(lobes):
            if (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r:
                return i
        return -1
    im = _floor_base(P)
    for y in range(T):
        for x in range(T):
            o = owner(x, y)
            if o < 0:
                continue
            cx, cy, r = lobes[o]
            n_r, n_d = owner(x + 1, y), owner(x, y + 1)
            l = -((x + 0.5 - cx) + (y + 0.5 - cy)) / r
            n_l, n_u = owner(x - 1, y), owner(x, y - 1)
            if n_r < 0 or n_d < 0:
                c = _deep(P)                                               # 바깥쪽 아래·오른쪽 윤곽
            elif n_r != o or n_d != o:
                c = f[0]                                                   # 돌 사이 금
            elif n_l < 0 or n_u < 0:
                c = f[1]                                                   # 빛 쪽 가장자리
            else:
                c = f[3] if l > 0.7 else f[2] if l > -0.1 else f[1]
            im.putpixel((x, y), c)
    for x in range(4, 13):
        if owner(x, 12) >= 0 or owner(x, 11) >= 0:
            im.putpixel((x, 13), f[1])
    return im
