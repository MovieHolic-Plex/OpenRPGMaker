"""동굴 `joseon_cave`(48×48) 맵 빌더 — 계획은 tiledata/joseon-field/PLAN.md 「동굴」 절, 검수 반영은 QA_ROUND1.md G8.

    python3 demo_cave.py          # tiledata/joseon-cave/ 에 굽는다(JS_OUT 으로 다른 폴더, JS_FORCE=1 은 점검 실패 무시)

바닥 종류: None=동굴 바닥 · lit=입구 햇빛 바닥 · pool=지하 못 · ceil=천장(벽 윗면) · cface0/cface1=천장 밑 벽 앞면 두 줄.
방·복도(걸을 칸 집합)만 정하면 벽은 규칙으로 나온다: 걸을 칸 바로 위의 비(非)바닥 칸 = 앞면 아랫줄, 그 위 = 앞면 윗줄, 그 위 = 천장.
3단 구조(검수 G8): 천장 칸(cav_roof47, 이웃 8칸 블롭 — 바닥 그림자 1px → 밝은/어두운 테 → 안쪽 암반, 이끼·광맥 변형을 구역별로 섞음)
 + 앞면 두 줄(cav_face24) + 바닥 그림자(cav_floor_sh: 북·서쪽이 벽이면 그림자 띠). 벽 앞면에는 횃불이 걸린다.
방은 둥글고 불규칙한 윤곽(organic), 복도는 곡선 붓(curve_cells)이고, 방마다 앵커(용도)를 하나씩 둔다 —
 입구 방(기둥 한 쌍 + 햇빛 문턱) · 광장(못 + 바위 기둥 넷 + 횃불) · 서방=광산(수레·광석·결정) · 동방=짐승 소굴(뼈 둥지·해골) · 보물방(상자 단상).
"""
import os, sys, math, random, collections
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, 'harness'))
import numpy as np
from tk import hsh, rnd, T
import water_blob as WB
import people as PP
import fld_map as FM
from fld_map import Kit
from fld_shapes import vnoise, organic, smooth, curve_cells, squircle

ROOT = FM.ROOT
OUT = os.environ.get('JS_OUT') or os.path.join(ROOT, 'tiledata', 'joseon-cave')
MW = MH = 48
kit = Kit(MW, MH, 'cave', OUT, 'joseon-cave')
for g in ('cav_floor', 'cav_floor_sh', 'cav_floor_lit', 'cav_roof47', 'cav_face24', 'cav_pool94'):
    kit.add_group(g, kit.terr[g])
GID = {g: kit.gid(g) for g in kit.pieces}
KG = kit.KG
inb = kit.inb
START = (23, 47)
PEOPLE = kit.PEOPLE
VIS = set()      # 소품이 서면 안 되는 칸: 복도·출입구 길목
ANCH = []        # 막다른 끝이어도 되는 목적 칸(보물 상자 앞 등)
B = (MW, MH)


def rect(x0, y0, x1, y1):
    return {(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)}


# ================================================================ 1단계: 방·복도 (걸을 칸)
# 바깥 암반 여백: 바닥은 x4..43, y6.. 안(어느 쪽으로도 4칸 이상 암반). 입구만 아래 가장자리로 뚫린다.
E_HALL = squircle(24, 40.6, 6.0, 3.7, 1, n=4.0, amp=0.08, bounds=B)                  # 입구 방: 가로로 퍼진 네모난 홀
LIT = rect(21, 44, 26, 47)                                                      # 햇빛 문턱(6칸 폭, 양쪽은 암벽 문설주)
P_ROOM = squircle(24, 23.2, 9.6, 7.0, 2, n=4.2, amp=0.10, bounds=B) | organic(18.5, 18.6, 4.6, 3.2, 12, amp=(0.10, 0.06, 0.04), bounds=B)   # 광장(북서쪽이 불룩)
R3 = squircle(24, 10.2, 4.6, 3.0, 3, n=2.6, amp=0.08, bounds=B)                 # 보물방
R1 = squircle(8.6, 25.6, 4.3, 4.4, 4, n=3.4, amp=0.10, bounds=B)                # 서방(광산)
R2 = squircle(39.4, 21.4, 4.0, 4.3, 5, n=3.4, amp=0.14, bounds=B)         # 동방(소굴): 둥글고 크기가 다르다
R4 = squircle(38.4, 35.6, 4.2, 3.4, 6, n=3.4, amp=0.10, bounds=B)               # 동남 막다른 방(샘이 솟는 수정 굴)
CORR = {
    'N': curve_cells([(23, 36), (25, 33), (24, 30)], 4, bounds=B),               # 입구 방 → 광장(넓은 통로, 살짝 휨)
    'TR': curve_cells([(24, 16), (24, 14), (24, 12)], 3, bounds=B),              # 광장 → 보물방
    'W1': curve_cells([(11, 24), (14, 25), (17, 25)], 3, bounds=B),              # 광장 ↔ 서방
    'E1': curve_cells([(33, 22), (35, 21), (37, 21)], 2, bounds=B),              # 광장 ↔ 동방(좁은 길목)
    'WR': {(x, y) for x in (8, 9) for y in range(28, 42)} | {(x, y) for x in range(8, 19) for y in (40, 41)},       # 서방 → 입구 방(고리 서쪽, 좁은 ㄴ자 한 번 꺾임)
    'ER': curve_cells([(39, 25), (40, 28), (38, 31)], 3, bounds=B),              # 동방 → 막다른 수정 굴
}
FLOOR = set(E_HALL) | LIT | P_ROOM | R3 | R1 | R2 | R4
for v in CORR.values():
    FLOOR |= set(v)
FLOOR = {c for c in FLOOR if inb(*c) and (c[1] >= 44 or (4 <= c[0] <= 43 and c[1] >= 6))}
FLOOR = (smooth(FLOOR, 1, B) | LIT) & {(x, y) for x in range(MW) for y in range(MH)}      # 1칸 홈·가시를 다수결로 다듬는다(문턱 LIT 는 그대로)


def fill_thin_walls(fl):
    """벽 두께가 석 줄 미만인 곳(걸을 칸 바로 위 비바닥 칸 아래·위가 다시 바닥)을 바닥으로 메운다. 앞면 두 줄 + 천장 한 줄이 서야 하므로 위쪽 바닥과의 사이는 세 줄 이상이어야 한다."""
    for _ in range(8):
        add = set()
        for (x, y) in fl:
            for k in (1, 2):                      # 바닥 (x,y) 의 위 한 칸·두 칸이 벽이고 그 위(세 칸째)가 다시 바닥이면: 위 두 칸을 바닥으로
                if (x, y - k) not in fl and (x, y - k - 1) in fl and k <= 2:
                    if k == 1 or (x, y - 1) not in fl: add.add((x, y - 1)); add.add((x, y - 2))
        if not add: break
        fl = fl | {c for c in add if inb(*c)}
    return fl


FLOOR = fill_thin_walls(FLOOR)
for _ in range(6):                                                    # 이웃 걸을 칸이 하나 이하인 돌기 칸은 벽으로 되돌린다(문턱·복도 끝 제외)
    stub = {(x, y) for (x, y) in FLOOR if (x, y) not in LIT and sum(1 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if (x + dx, y + dy) in FLOOR) <= 1}
    if not stub: break
    FLOOR -= stub
POOL = {c for c in squircle(20.8, 23.4, 3.7, 2.7, 7, n=2.2, amp=0.20, bounds=B) if c in P_ROOM}
POOL |= {c for c in squircle(38.5, 35.8, 2.7, 1.9, 8, n=2.2, amp=0.18, bounds=B) if c in R4}
POOL = smooth(POOL, 2, B)
POOL = {c for c in POOL if all((c[0] + dx, c[1] + dy) in FLOOR for dx in (-2, 0, 2) for dy in (-2, 0, 2))}   # 못은 벽에서 두 칸 떨어진다

for (x, y) in FLOOR:
    KG[y][x] = 'lit' if (x, y) in LIT else None
for (x, y) in POOL:
    KG[y][x] = 'pool'
OPEN = set(FLOOR)
for y in range(MH):
    for x in range(MW):
        if (x, y) not in OPEN:
            KG[y][x] = 'ceil'
for y in range(MH - 1):
    for x in range(MW):
        if (x, y) not in OPEN and (x, y + 1) in OPEN:
            KG[y][x] = 'cface1'
for y in range(MH):
    for x in range(MW):
        if KG[y][x] == 'ceil' and y + 1 < MH and KG[y + 1][x] == 'cface1':
            KG[y][x] = 'cface0'
# 바닥에서 가장 가까운 거리(깊이 띠): 천장 칸마다 열린 바닥까지의 칸 수
DIST = {}
_fr = collections.deque((c, 0) for c in OPEN)
for c in OPEN: DIST[c] = 0
while _fr:
    (cx_, cy_), d_ = _fr.popleft()
    for dx_, dy_ in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        q_ = (cx_ + dx_, cy_ + dy_)
        if inb(*q_) and q_ not in DIST:
            DIST[q_] = d_ + 1; _fr.append((q_, d_ + 1))


def mset(cs, x, y):
    return kit.mask4(cs, x, y, edge_open=True)


def mask8(cs, x, y):
    m = 0
    for bit, (dx, dy) in ((WB.N, (0, -1)), (WB.E, (1, 0)), (WB.S, (0, 1)), (WB.W, (-1, 0)), (WB.NE, (1, -1)), (WB.SE, (1, 1)), (WB.SW, (-1, 1)), (WB.NW, (-1, -1))):
        X, Y = x + dx, y + dy
        if (X, Y) in cs or not inb(X, Y):
            m |= bit
    return m


def roof_variant(x, y):
    """구역별 천장 질감: 이끼(못 곁 북동), 광맥(서쪽 광산 둘레·보물방 둘레), 나머지는 평범 둘을 섞는다. 바닥에서 5칸 넘게 먼 속 암반은 깊은 변형 4종(6~9)을 불규칙하게 섞는다."""
    if DIST.get((x, y), 0) + vnoise(x, y, 119, 3.5) * 2.6 >= 5.6:
        return 6 + (hsh(x, y, 117) + int(vnoise(x, y, 118, 3.0) * 4)) % 4
    mo = vnoise(x, y, 111, 6.0)
    ore = vnoise(x, y, 112, 5.0)
    h3 = hsh(x, y, 114) % 3
    if (x < 20 and 12 < y < 44 and ore > 0.40) or (y < 24 and ore > 0.58):
        return (4 + hsh(x, y, 115) % 2) if h3 == 0 else hsh(x, y, 113) % 2        # 광맥 칸은 세 칸에 한 칸꼴(점이 격자로 서지 않게)
    if (x > 26 and y < 26 and mo > 0.50) or mo > 0.68:
        return (2 + hsh(x, y, 116) % 2) if h3 != 2 else hsh(x, y, 113) % 2
    return hsh(x, y, 113) % 2


def floor_variant(x, y):
    """바닥 변형(10): 같은 무늬가 격자로 되풀이되지 않게 잡음 구역마다 다른 변형 쌍을 쓴다."""
    z = int(vnoise(x, y, 121, 7.0) * 5.0) % 5
    return z + 5 * (hsh(x, y, 122) % 2)


def ground_ids():
    fam = {k: kit.cells_of(k) for k in ('ceil', 'cface0', 'cface1', 'pool')}
    mass = fam['ceil'] | fam['cface0'] | fam['cface1']
    gr = [[0] * MW for _ in range(MH)]
    for y in range(MH):
        for x in range(MW):
            k = KG[y][x]
            if k is None:
                fv = floor_variant(x, y)
                bits = (1 if (x, y - 1) in mass else 0) | (2 if (x - 1, y) in mass else 0) | (4 if (x - 1, y - 1) in mass and not ((x, y - 1) in mass or (x - 1, y) in mass) else 0)
                if y == 43 and 21 <= x <= 26:
                    gid = GID['cav_floor_lit'] + 4 + hsh(x, y, 42) % 2           # 문턱 바로 위: 돌바닥에 흙이 번지기 시작
                elif bits:
                    gid = GID['cav_floor_sh'] + 8 * (fv % 5) + bits
                else:
                    gid = GID['cav_floor'] + fv
            elif k == 'lit':
                gid = GID['cav_floor_lit'] + ((hsh(x, y, 41) + y) % 4 if y > 44 else 6 + hsh(x, y, 41) % 2)
            elif k == 'ceil':
                gid = GID['cav_roof47'] + 47 * roof_variant(x, y) + WB.index47(mask8(mass, x, y))
            elif k in ('cface0', 'cface1'):
                same = fam[k]
                we = (1 if (x - 1, y) in same else 0) | (2 if (x + 1, y) in same else 0)
                gid = GID['cav_face24'] + 8 * (hsh(x // 3, y, 61) % 3) + (0 if k == 'cface0' else 4) + we
            else:      # pool
                gid = GID['cav_pool94'] + WB.index47(mask8(fam['pool'], x, y)) + 47 * (hsh(x, y, 29) % 2)
            gr[y][x] = gid
    return gr


# ================================================================ 2단계: 앵커·소품
for v in CORR.values():
    VIS |= set(v)
VIS |= rect(22, 36, 25, 47)             # 입구 방 한가운데 길목 + 햇빛 문턱
VIS |= rect(21, 44, 26, 47)
VIS |= {(x, y) for y in range(12, 18) for x in range(22, 27)}       # 광장 → 보물방 길목
VIS |= {(x, y) for y in range(11, 14) for x in range(22, 27)}        # 보물 단상 앞길(계단 쪽)


def total_walk():
    return {(x, y) for y in range(MH) for x in range(MW) if kit.walkable(x, y)}


def connected_ok():
    return len(kit.reach(START)) == len(total_walk())


def undo(name, x, y):
    kit.placed.pop(); kit.items.pop()
    for (X, Y, ch) in kit.cells_for(name, x, y):
        kit.DRAWN[(X, Y)].pop()
        if not kit.DRAWN[(X, Y)]: del kit.DRAWN[(X, Y)]
        if ch == 'X': kit.HARD.pop((X, Y), None)


def dead_cells():
    W_ = total_walk()
    out = set()
    for (x, y) in W_:
        if sum(1 for dx, dy in FM.DIRS4 if (x + dx, y + dy) in W_) <= 1 and not any(abs(x - a) + abs(y - b) <= 1 for (a, b) in ANCH):
            out.add((x, y))
    return out


def put(name, x, y, ok=(None,), vis=True, conn=True):
    if not kit.can_place(name, x, y, ok_kinds=ok):
        return None
    if vis and any((X, Y) in VIS for (X, Y, ch) in kit.cells_for(name, x, y)):
        return None
    base = dead_cells()
    res = kit.place(name, x, y, ok_kinds=ok)
    if conn and (not connected_ok() or not dead_cells() <= base):
        undo(name, x, y)
        return None
    return res


def put_any(name, cands, **kw):
    for (x, y) in cands:
        if put(name, x, y, **kw):
            return (x, y)
    print('  놓지 못함', name, cands[:2])
    return None


DEAD0 = dead_cells()
# 입구: 햇빛 든 바닥이 맨 아래 가장자리까지 → 들판(joseon_field)의 굴 입구로 나간다
kit.EXITS.append({'to': 'joseon_field', 'side': 'S', 'x0': 21, 'x1': 26, 'y': 47})
kit.DOORS.append({'x': 23, 'y': 47, 'piece': 'cave-entrance'}); kit.DOORS.append({'x': 24, 'y': 47, 'piece': 'cave-entrance'})
ANCH.extend([(23, 47), (24, 47)])

POS = collections.defaultdict(list)
OKF = (None,)


def makes_line(nm, x, y):
    S_ = set(POS[nm])
    for (px, py) in POS[nm]:
        if (2 * px - x, 2 * py - y) in S_ or (2 * x - px, 2 * y - py) in S_: return True
        if (x + px) % 2 == 0 and (y + py) % 2 == 0 and ((x + px) // 2, (y + py) // 2) in S_: return True
    for (u, v_, pu, pv) in ((x, y, 0, 1), (y, x, 1, 0)):               # 같은 열·줄 12칸 창에 셋 이상 금지
        line = sorted([p[pv] for p in POS[nm] if p[pu] == u] + [v_])
        i = line.index(v_)
        for a_ in range(max(0, i - 2), i + 1):
            if a_ + 2 < len(line) and line[a_ + 2] - line[a_] <= 12: return True
    return False


def scatter(names, region, count, gap=3, seed=0, near=None, ok=OKF, vis=True):
    rg = random.Random(seed)
    cand = sorted(region)
    rg.shuffle(cand)
    n = 0
    for (x, y) in cand:
        if n >= count: break
        nm = rg.choice(names)
        if any(max(abs(x - px), abs(y - py)) < gap for (px, py) in POS[nm]): continue
        if makes_line(nm, x, y): continue
        if near and not near(x, y): continue
        if put(nm, x, y, ok=ok, vis=vis):
            POS[nm].append((x, y)); n += 1
    return n


def near_wall(x, y, d=1):
    return any(KG[y + dy][x + dx] in ('ceil', 'cface0', 'cface1') for dx in range(-d, d + 1) for dy in range(-d, d + 1) if inb(x + dx, y + dy))


def near_pool(x, y, d=2):
    return any((x + dx, y + dy) in POOL for dx in range(-d, d + 1) for dy in range(-d, d + 1))


ROOMS = {'P': P_ROOM, 'R1': R1, 'R2': R2, 'R3': R3, 'E': E_HALL, 'R4': R4}
ZF = lambda cs: {c for c in cs if KG[c[1]][c[0]] is None and c in FLOOR}
CENTRE = lambda cs: {c for c in ZF(cs) if not near_wall(c[0], c[1], 1)}

# ---- 입구 방: 바위 기둥 한 쌍(북쪽 통로 양옆 문설주), 뼈 한 무더기
put_any('cav_brazier', [(20, 38), (21, 38), (20, 39)], vis=False)            # 입구 방 북쪽 통로 양옆 화로
put_any('cav_brazier', [(28, 38), (27, 38), (28, 39)], vis=False)
put('fld_bones_a', 28, 42, vis=False)
# ---- 광장: 큰 석순 군락 둘(북서·남동), 못 둘레 결정, 보물방 길목 양옆 화로(길 안내), 못 곁 버섯
put_any('cav_stalagmite_wide', [(15, 23), (15, 22), (16, 24)], vis=False)
put_any('cav_stalagmite_wide', [(31, 25), (30, 25), (31, 26)], vis=False)
put_any('cav_stalagmite_wide', [(29, 18), (28, 18), (30, 19)], vis=False)
put_any('cav_crystal_b', [(26, 26), (27, 26), (26, 27)], vis=False)
put_any('cav_brazier', [(21, 17), (20, 17), (21, 18)], vis=False)
put_any('cav_brazier', [(27, 17), (28, 17), (27, 18), (27, 16), (26, 16)], vis=False)
# ---- 보물방: 상자 단상(막다른 갈래의 목적) + 양옆 결정 줄기
put_any('cav_chest_dais', [(23, 8), (23, 7), (23, 9)], vis=False)
CHEST = (24, 10)
ANCH.extend([(CHEST[0] - 1, CHEST[1] + 1), (CHEST[0], CHEST[1] + 1), (CHEST[0] + 1, CHEST[1] + 1)])
put_any('cav_crystal_c', [(20, 8), (20, 9), (21, 9)], vis=False)
put_any('cav_crystal_c', [(28, 8), (27, 8), (28, 9)], vis=False)
# ---- 서방(광산): 수레·광석·결정 군락
put_any('cav_cart', [(6, 27), (6, 28), (7, 27)], vis=False)
put('fld_ore_b', 5, 23, ok=OKF, vis=False); put('fld_ore_a', 10, 22, ok=OKF, vis=False); put('fld_ore_b', 6, 30, ok=OKF, vis=False)
put_any('cav_crystal_b', [(7, 22), (8, 22), (6, 22)], vis=False)
# ---- 동방(소굴): 뼈 둥지 한 곳과 그 둘레에 모인 뼈·해골(하나의 뼈 무더기)
put_any('cav_nest', [(39, 20), (38, 20), (39, 21)], vis=False)
put('fld_bones_b', 37, 22, vis=False); put('fld_bones_a', 41, 22, vis=False); put('fld_bones_b', 40, 24, vis=False)
put_any('cav_stalagmite_b', [(41, 18), (42, 18), (41, 19)], vis=False)
# ---- 동남 막다른 수정 굴: 샘 둘레 결정 군락 + 광석(막다른 방의 보상)
for nm_, cs_ in (('cav_crystal_b', [(35, 34), (35, 35)]), ('cav_crystal_c', [(41, 33), (41, 34), (40, 33)]), ('cav_crystal', [(36, 38), (37, 38)]), ('cav_crystal_c', [(41, 38), (40, 38)]), ('fld_ore_a', [(35, 37), (36, 37)])):
    put_any(nm_, cs_, vis=False)
ANCH.extend([(38, 33), (39, 33)])

# ---- 벽 횃불: 북벽(앞면 두 줄)에 간격을 두고 건다. 앞면 윗줄 칸에 서고 양옆이 같은 앞면이어야 한다.
WALL = []
for (x, y) in sorted(kit.cells_of('cface0')):
    if KG[y + 1][x] == 'cface1' and KG[y][x - 1] == 'cface0' and KG[y][x + 1] == 'cface0' and True:
        WALL.append((x, y))
rgw = random.Random(9)
rgw.shuffle(WALL)
TORCH_POS = []
for (x, y) in WALL:
    if len(TORCH_POS) >= 9: break
    if any(abs(x - a) + abs(y - b) < 6 for (a, b) in TORCH_POS): continue
    nm = 'cav_torch_a' if len(TORCH_POS) % 2 == 0 else 'cav_torch_b'
    if put(nm, x, y, ok=('cface0', 'cface1'), vis=False, conn=False):
        TORCH_POS.append((x, y))

# ---- 흩뿌릴 소품: 석순·결정·돌·이끼·웅덩이·버섯. 변형이 많고 군집(벽 곁 / 못 곁)이 있어 복제·일렬이 안 생긴다.
ALL = ZF(set().union(*[set(v) for v in ROOMS.values()]))
INNER = CENTRE(ALL)
LOG = {}
LOG['stal'] = scatter(['cav_stalagmite', 'cav_stalagmite_b', 'cav_stalagmite_c'], ALL, 15, gap=4, seed=1, near=lambda x, y: near_wall(x, y, 2))
LOG['stalw2'] = scatter(['cav_stalagmite_wide'], ALL, 4, gap=6, seed=61)
LOG['stalw'] = scatter(['cav_stalagmite_wide'], ALL, 14, gap=4, seed=21, near=lambda x, y: near_wall(x, y, 2))
LOG['cry'] = scatter(['cav_crystal', 'cav_crystal_b', 'cav_crystal_c'], ALL, 14, gap=4, seed=2, near=lambda x, y: near_wall(x, y, 1))
LOG['mush'] = scatter(['cav_mushroom_a', 'cav_mushroom_b'], ALL, 8, gap=3, seed=3, near=lambda x, y: near_pool(x, y, 2))
LOG['rock'] = scatter(['cav_rock_a', 'cav_rock_b', 'cav_rock_c', 'cav_rubble'], ALL, 18, gap=3, seed=4)
LOG['boulder'] = scatter(['fld_boulder_mass'], ALL, 2, gap=9, seed=41, vis=True)
LOG['mrock'] = scatter(['fld_rock_m_a', 'fld_rock_m_b'], ALL, 10, gap=5, seed=43)
LOG['rockl'] = scatter(['fld_rock_l_a', 'fld_rock_l_b'], ALL, 6, gap=6, seed=42, vis=True)
LOG['rubble'] = scatter(['cav_rubble'], ALL, 6, gap=6, seed=24, near=lambda x, y: near_wall(x, y, 2))
LOG['moss'] = scatter(['cav_moss'], ALL, 7, gap=6, seed=25, near=lambda x, y: near_pool(x, y, 4) or near_wall(x, y, 2))
LOG['pud'] = scatter(['cav_puddle'], ALL, 2, gap=9, seed=26, near=lambda x, y: not near_pool(x, y, 6))
LOG['bones'] = scatter(['fld_bones_a'], ALL, 1, gap=9, seed=5, near=lambda x, y: x < 12)
LOG['ore'] = scatter(['fld_ore_a', 'fld_ore_b'], ALL, 5, gap=6, seed=7, near=lambda x, y: near_wall(x, y, 1) and (x < 14 or y < 14))
# 복도: 길목(VIS)을 피해 곁에 한두 개(석순·결정·돌무더기·이끼)
CORRC = {c for v in CORR.values() for c in v if KG[c[1]][c[0]] is None and c not in kit.DRAWN and c not in FLOOR - set(c for v2 in CORR.values() for c in v2)}
LOG['corr'] = scatter(['cav_stalagmite_c', 'cav_crystal_c', 'cav_rock_c', 'cav_moss', 'cav_rubble'], {c for c in CORRC if near_wall(c[0], c[1], 1)}, 8, gap=6, seed=31, vis=False)
print('소품', LOG, '횃불', len(TORCH_POS), '벽 후보', len(WALL))


# ---- 10×10 완전 빈 바닥 메우기
def plain_fill(max_rounds=40):
    n = 0
    for _ in range(max_rounds):
        bad = FM.audit_plain(kit, 10, (None, 'lit'))
        if not bad: break
        x0, y0 = bad[len(bad) // 2]
        reg = {(x, y) for (x, y) in rect(x0, y0, x0 + 9, y0 + 9) if KG[y][x] is None}
        got = scatter(['cav_rock_a', 'cav_rock_c', 'cav_stalagmite_c', 'cav_crystal', 'cav_moss'], reg, 1, gap=1, seed=100 + n)
        if not got: break
        n += got
    return n


print('빈 창 메움', plain_fill(), '남은', len(FM.audit_plain(kit, 10, (None, 'lit'))))

# ================================================================ 3단계: 스폰·사람
SP = []
rg = random.Random(3)


def spawn(zone, kind, cells, n):
    cs = [c for c in sorted(cells) if kit.walkable(*c) and c not in VIS and c not in kit.DRAWN and KG[c[1]][c[0]] is None]
    rg.shuffle(cs)
    got = []
    for c in cs:
        if len(got) >= n: break
        if any(abs(c[0] - g[0]) + abs(c[1] - g[1]) < 4 for g in got): continue
        got.append(c)
    for c in got:
        SP.append({'x': c[0], 'y': c[1], 'zone': zone, 'kind': kind})


spawn('plaza', 'cave-bat', P_ROOM, 6)
spawn('mine', 'cave-spider', R1, 3)
spawn('den', 'cave-beast', R2, 3)
spawn('entrance', 'cave-slime', E_HALL, 2)
spawn('treasure', 'cave-boss', R3, 1)
spawn('ring-W', 'cave-bat', set(CORR['WR']), 2)
spawn('crystal', 'cave-slime', R4, 2)
kit.SPAWNS.extend(SP)
ANCH.extend((s['x'], s['y']) for s in SP)
for (x, y, ch, d, fr) in ((17, 40, 2, PP.RIGHT, 1), (8, 25, 5, PP.FRONT, 0)):    # 입구 방 서쪽 가장자리의 모험가(길목 밖), 광산 방의 광부
    for (dx_, dy_) in ((0, 0), (1, 0), (0, 1), (-1, 0), (0, -1), (1, 1), (-1, 1), (2, 0)):
        if kit.walkable(x + dx_, y + dy_) and (x + dx_, y + dy_) not in kit.DRAWN and (x + dx_, y + dy_) not in VIS:
            PEOPLE.append((x + dx_, y + dy_, ch, d, fr)); break

# ================================================================ 4단계: 자동 점검 단언
PROBS = []
WALK = total_walk()
SEEN = kit.reach(START)
isl = FM.audit_unreachable_walk(kit, SEEN)
if isl:
    PROBS.append('시작점에서 못 닿는 걸을 칸 덩어리 %d개 %s' % (len(isl), isl[:3]))
tgt = [(CHEST[0], CHEST[1] + 1), (23, 47), (24, 47)] + [(s['x'], s['y']) for s in SP]
miss = [t for t in tgt if t not in SEEN]
if miss:
    PROBS.append('목표 칸에 못 닿음 %s' % miss[:6])
if DEAD0:
    PROBS.append('방 모양만으로 막다른 칸 %d: %s' % (len(DEAD0), sorted(DEAD0)[:6]))
dead = [c for c in dead_cells()]
if dead:
    PROBS.append('막다른 걸을 칸 %d: %s' % (len(dead), dead[:6]))
thin = [(x, y) for (x, y) in FLOOR if KG[y][x] in (None, 'lit') and not any(all((x + dx + i, y + dy + j) in FLOOR for i in (0, 1) for j in (0, 1)) for dx in (-1, 0) for dy in (-1, 0))]
if thin:
    PROBS.append('외줄 복도 칸 %d: %s' % (len(thin), thin[:6]))
l3 = FM.audit_line3(kit.placed)
if l3:
    PROBS.append('일렬 3개 소품 %d: %s' % (len(l3), l3[:4]))
by = collections.defaultdict(list)
for (n, x, y, w, h) in kit.placed:
    by[n].append((x + w // 2, y + h - 1))
al = []
for n, v in by.items():
    for axis in (0, 1):
        for (px, py) in v:
            grp = [q for q in v if q[axis] == (px, py)[axis] and 0 <= q[1 - axis] - (px, py)[1 - axis] <= 12]
            if len(grp) >= 3: al.append((n, axis, (px, py), len(grp)))
if al:
    PROBS.append('같은 종 정렬(같은 열·줄 3개 이상) %d: %s' % (len(al), al[:4]))
pl = FM.audit_plain(kit, 10, (None, 'lit'))
if pl:
    PROBS.append('빈 바닥 10×10 %d: %s' % (len(pl), pl[:4]))
if not all(kit.walkable(x, y) for x in (22, 23, 24, 25) for y in (45, 46, 47)):
    PROBS.append('입구 앞 걸을 칸이 막혔다')
cl = []
for y in range(MH):
    for x in range(MW):
        k = KG[y][x]
        if k == 'cface0' and not (KG[y - 1][x] == 'ceil' if y > 0 else True):
            cl.append(('앞면 윗줄 위가 천장이 아님', x, y))
        if k == 'cface0' and KG[y + 1][x] != 'cface1':
            cl.append(('앞면 윗줄 아래가 아랫줄이 아님', x, y))
        if k == 'cface1' and (KG[y - 1][x] != 'cface0' or KG[y + 1][x] not in (None, 'lit', 'pool')):
            cl.append(('앞면 아랫줄 이음', x, y))
        if k == 'ceil' and y + 1 < MH and KG[y + 1][x] in (None, 'lit', 'pool'):
            cl.append(('천장이 바닥에 바로 닿음', x, y))
        if k == 'pool' and any(KG[y + dy][x + dx] in ('ceil', 'cface0', 'cface1') for dx, dy in FM.DIRS4 if inb(x + dx, y + dy)):
            cl.append(('못이 벽에 닿음', x, y))
if cl:
    PROBS.append('벽 이음 %d: %s' % (len(cl), cl[:4]))
# 천장 질감이 한 가지가 아니다(검수: 암반 70% 같은 칸): 천장 칸의 변형별 비율이 모두 62% 미만이고 바닥 곁 천장(깊은 변형 제외)에서 이끼·광맥이 각각 8% 이상
ceil_cells = [(x, y) for y in range(MH) for x in range(MW) if KG[y][x] == 'ceil']
vc = collections.Counter(roof_variant(x, y) for (x, y) in ceil_cells)
tot = float(len(ceil_cells))
near_n = float(sum(v for k, v in vc.items() if k < 6))
if max(vc.values()) / tot >= 0.62 or (vc[2] + vc[3]) / near_n < 0.08 or (vc[4] + vc[5]) / near_n < 0.08:
    PROBS.append('천장 질감 분포 치우침 %s' % {k: round(v / tot, 2) for k, v in sorted(vc.items())})
# 벽 횃불은 앞면 위에 선다(벽 부착) + 최소 6개
if len(TORCH_POS) < 6:
    PROBS.append('벽 횃불이 6개 미만 %d' % len(TORCH_POS))
print('자동 점검', PROBS or '모두 통과')
if PROBS and not os.environ.get('JS_FORCE'):
    sys.exit(1)

# ================================================================ 5단계: 굽기
SOLID_KIND = {'ceil': 'water', 'cface0': 'water', 'cface1': 'water', 'pool': 'water', 'lit': 'road'}
detail = [[(KG[y][x] or 'floor') for x in range(MW)] for y in range(MH)]
ids = ground_ids()
direct, rep = kit.bake(ids, 'cave', people_overlay=PP.overlay, ground_kind_map=SOLID_KIND,
                       extra_fields={'groundDetail': detail, 'note': 'groundKind 의 water 는 걸을 수 없는 바닥(천장·벽 앞면·지하 못)이다 — 진짜 종류는 groundDetail. 입구 y44..47 = 들판(joseon_field)으로 나가는 출구'})
print('저장', OUT)
