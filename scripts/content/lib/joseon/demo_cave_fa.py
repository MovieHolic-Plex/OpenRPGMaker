"""동굴 `joseon_cave_fa`(48×48) 맵 빌더 — 계획은 tiledata/joseon-field-fa/PLAN.md 「동굴」 절.

    python3 demo_cave_fa.py             # tiledata/joseon-cave-fa/ 에 굽는다(JS_OUT 으로 다른 폴더, JS_FORCE=1 은 점검 실패 무시)

바닥 종류: None(바닥) · lit(입구 햇빛 든 바닥) · ceil(천장=바위 윗면) · cface0/cface1(천장 밑 벽 앞면 2줄) · pool(지하 못).
벽 규칙(천장 밑 벽): 천장 칸의 바로 남쪽 열린 칸은 앞면 윗줄, 그 아래가 앞면 아랫줄, 그 아래가 걷는 바닥이다. 그래서 가로 복도는
높이 = 걷는 폭 + 2 로 판다(위 두 줄이 벽면). 열린 칸 집합(OPEN)만 정하면 벽면은 규칙으로 파생된다.
공용 틀은 fa_map.Kit. 모든 단언은 굽기 직전에 돌고 하나라도 걸리면 굽지 않는다(JS_FORCE 로만 우회).
"""
import os, sys, math, random, json, collections
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, 'harness'))
import numpy as np
from tk import hsh, rnd, T
import water_blob as WB
import people as PP
import fa_map as FM
from fa_map import Kit

ROOT = FM.ROOT
OUT = os.environ.get('JS_OUT') or os.path.join(ROOT, 'tiledata', 'joseon-cave-fa')
MW = MH = 48
kit = Kit(MW, MH, 'fa_cave', OUT, 'joseon-cave-fa')
tr_ = kit.terr
for g in ('cav_floor', 'cav_floor_lit', 'cav_ceil32', 'cav_face16', 'cav_pool94'):
    kit.add_group(g, tr_[g])
GID = {g: kit.gid(g) for g in kit.pieces}
KG = kit.KG
inb = kit.inb
START = (23, 47)


def noise(x, y, s, sc=3):
    return rnd(x // sc, y // sc, s)


def blob(cx, cy, rx, ry, seed, jag=0.3):
    out = set()
    for y in range(int(cy - ry * 1.4) - 1, int(cy + ry * 1.4) + 2):
        for x in range(int(cx - rx * 1.4) - 1, int(cx + rx * 1.4) + 2):
            d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
            if d <= 1.0 + jag * (noise(x, y, seed, 2) - 0.5) * 2 and inb(x, y):
                out.add((x, y))
    return out


# ================================================================ 1단계: 열린 칸(방 + 복도) → 천장·벽면 파생
def R(x0, y0, x1, y1):
    return {(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)}


ROOMS = {                                   # 방(위 두 줄은 벽면). 이름 → 사각형
    'E': (19, 37, 28, 44),                  # 입구 방
    'P': (13, 13, 34, 31),                  # 큰 광장
    'R1': (3, 21, 10, 29),                  # 서쪽 방
    'R2': (37, 19, 44, 28),                 # 동쪽 방
    'R3': (18, 3, 29, 9),                   # 보물방(막다른 한 갈래)
}
CORR = [                                    # 복도(방 밖 열린 칸). (x0, y0, x1, y1)
    (21, 45, 26, 47),                       # 입구 목(굴 밖으로 나가는 출구)
    (23, 32, 25, 36),                       # 입구 방 ↔ 광장
    (5, 30, 7, 44), (8, 41, 18, 44),        # 입구 방 ↔ 서쪽 방(ㄴ자)
    (40, 29, 42, 44), (29, 41, 39, 44),     # 입구 방 ↔ 동쪽 방(ㄴ자)
    (11, 24, 12, 27),                       # 서쪽 방 ↔ 광장
    (35, 22, 36, 25),                       # 동쪽 방 ↔ 광장
    (23, 10, 25, 12),                       # 광장 ↔ 보물방
]
OPEN = set()
for (x0, y0, x1, y1) in ROOMS.values(): OPEN |= R(x0, y0, x1, y1)
CORRC = set()
for c in CORR: CORRC |= R(*c)
OPEN |= CORRC
ROOMCELLS = set()
for (x0, y0, x1, y1) in ROOMS.values(): ROOMCELLS |= R(x0, y0, x1, y1)

for y in range(MH):
    for x in range(MW):
        KG[y][x] = None if (x, y) in OPEN else 'ceil'
# 벽면: 북쪽이 천장인 열린 칸 = 앞면 윗줄, 그 아래 칸 = 앞면 아랫줄
for (x, y) in sorted(OPEN):
    if KG[y - 1][x] == 'ceil' if y > 0 else True:
        KG[y][x] = 'cface0'
for (x, y) in sorted(OPEN):
    if y > 0 and KG[y - 1][x] == 'cface0':
        KG[y][x] = 'cface1'
# 지하 못: 광장 한가운데
POOL = blob(24, 22, 5.2, 3.2, 11, 0.12)
for (x, y) in POOL:
    if KG[y][x] is None: KG[y][x] = 'pool'
# 입구 햇빛 든 바닥: 출구 목과 입구 방 아랫부분(타원)
for (x, y) in OPEN:
    if KG[y][x] is None and ((x - 23.5) / 6.0) ** 2 + ((y - 47.5) / 5.2) ** 2 <= 1.0:
        KG[y][x] = 'lit'
for x in range(MW):                                    # 천장 위로는 아무것도 없다
    pass

kit.EXITS.append({'to': 'joseon_field_fa', 'side': 'S', 'x0': 21, 'x1': 26, 'y': 47, 'door': 'any of fld_cave_a / fld_cave_b / fld_cave_c'})

# ================================================================ 지형 → 바닥 번호
def ground_ids():
    fam = {k: kit.cells_of(k) for k in ('ceil', 'cface0', 'cface1', 'pool')}
    gr = [[0] * MW for _ in range(MH)]
    for y in range(MH):
        for x in range(MW):
            k = KG[y][x]
            if k is None:
                v = hsh(x, y, 5) % 12
                gid = GID['cav_floor'] + (hsh(x, y, 3) % 4 if v < 10 else 4 + hsh(x, y, 9) % 2)
            elif k == 'lit':
                gid = GID['cav_floor_lit'] + hsh(x, y, 3) % 4
            elif k == 'ceil':
                m = 0
                for bit, (dx, dy) in ((1, (0, -1)), (2, (1, 0)), (8, (-1, 0))):
                    X, Y = x + dx, y + dy
                    if (X, Y) in fam['ceil'] or not inb(X, Y): m |= bit
                if (x, y + 1) in fam['ceil'] or (x, y + 1) in fam['cface0'] or not inb(x, y + 1): m |= 4
                gid = GID['cav_ceil32'] + 16 * (hsh(x, y, 59) % 2) + m
            elif k in ('cface0', 'cface1'):
                same = fam[k]
                we = (1 if (x - 1, y) in same else 0) | (2 if (x + 1, y) in same else 0)
                gid = GID['cav_face16'] + 8 * (hsh(x // 3, y, 61) % 2) + (0 if k == 'cface0' else 4) + we
            elif k == 'pool':
                m8 = 0
                for bit, (dx, dy) in ((WB.N, (0, -1)), (WB.E, (1, 0)), (WB.S, (0, 1)), (WB.W, (-1, 0)), (WB.NE, (1, -1)), (WB.SE, (1, 1)), (WB.SW, (-1, 1)), (WB.NW, (-1, -1))):
                    if (x + dx, y + dy) in fam['pool']: m8 |= bit
                gid = GID['cav_pool94'] + WB.index47(m8) + 47 * (hsh(x, y, 29) % 2)
            else:
                raise ValueError(k)
            gr[y][x] = gid
    return gr


# ================================================================ 2단계: 물체
OKF = (None, 'lit')
KEEP = R(20, 43, 27, 47)               # 출구 앞은 비운다(입구 앞 걸을 칸)
PLACEPOS = []


def total_walk():
    return {(x, y) for y in range(MH) for x in range(MW) if kit.walkable(x, y)}


def connected_ok():
    return len(kit.reach(START)) == len(total_walk())


def put(name, x, y, ok=OKF, conn=True, keep=True):
    if not kit.can_place(name, x, y, ok_kinds=ok):
        return None
    if keep and any((X, Y) in KEEP for (X, Y, ch) in kit.cells_for(name, x, y)):
        return None
    res = kit.place(name, x, y, ok_kinds=ok)
    if conn and not connected_ok():
        kit.placed.pop(); kit.items.pop()
        for (X, Y, ch) in kit.cells_for(name, x, y):
            kit.DRAWN[(X, Y)].pop()
            if not kit.DRAWN[(X, Y)]: del kit.DRAWN[(X, Y)]
            if ch == 'X' and kit.HARD.get((X, Y)) == name: del kit.HARD[(X, Y)]
        return None
    PLACEPOS.append((name, x, y))
    return res


ANCH = []                                # 막다른 곳이어도 되는 칸(방 안)
# --- 못 둘레 석주 4개(광장), 화로 쌍: 입구 방·광장·양쪽 방·보물방
for (x, y) in ((16, 17), (16, 27), (32, 17), (32, 27)):
    assert put('cav_pillar', x, y), ('pillar', x, y)
for (x, y) in ((20, 41), (27, 41), (14, 15), (33, 15), (4, 23), (9, 23), (38, 21), (43, 21), (19, 5), (28, 5)):
    assert put('cav_brazier', x, y), ('brazier', x, y)
for (x, y) in ((20, 7), (27, 7)):
    put('cav_pillar', x, y)                                 # 보물방 석주 한 쌍(놓이지 않으면 비운다)
assert put('cav_chest', 23, 5) or put('cav_chest', 24, 5)       # 보물 상자 — 보물방 안쪽(북쪽 벽 아래)
CHEST = [(x, y) for (n, x, y) in PLACEPOS if n == 'cav_chest'][0]

rg = random.Random(31)


def cells_in(room, margin=1, kinds=OKF):
    x0, y0, x1, y1 = ROOMS[room]
    return [(x, y) for y in range(y0 + 2 + 0, y1 + 1) for x in range(x0 + margin, x1 - margin + 1) if KG[y][x] in kinds and (x, y) not in kit.DRAWN]


def near_kind(x, y, kind, r):
    return any(KG[Y][X] == kind for Y in range(y - r, y + r + 1) for X in range(x - r, x + r + 1) if inb(X, Y))


def scatter(name, cells, n, gap, seed, same_gap=None, must_near=None):
    """name 조각을 cells 중에서 n 개. 같은 이름끼리 gap 칸, 다른 소품과도 2칸 띄운다. 길(복도)엔 안 놓는다."""
    rg_ = random.Random(seed)
    cs = [c for c in cells if c not in CORRC]
    rg_.shuffle(cs)
    k = 0
    for (x, y) in cs:
        if k >= n: break
        if must_near and not near_kind(x, y, *must_near): continue
        if any(n_ == name and abs(x - px) + abs(y - py) < gap for (n_, px, py) in PLACEPOS): continue
        if any(abs(x - px) + abs(y - py) < 2 for (n_, px, py) in PLACEPOS): continue
        if put(name, x, y):
            k += 1
    return k


LOG = {}
RM = {r: cells_in(r) for r in ROOMS}
LOG['P_stal'] = scatter('cav_stalagmite', RM['P'], 9, gap=6, seed=1)
LOG['P_rock_a'] = scatter('cav_rock_a', RM['P'], 8, gap=5, seed=2)
LOG['P_rock_b'] = scatter('cav_rock_b', RM['P'], 4, gap=7, seed=3)
LOG['P_mush_a'] = scatter('cav_mushroom_a', RM['P'], 7, gap=5, seed=4, must_near=('pool', 3))
LOG['P_mush_b'] = scatter('cav_mushroom_b', RM['P'], 5, gap=5, seed=5, must_near=('pool', 3))
LOG['P_crys'] = scatter('cav_crystal', RM['P'], 4, gap=8, seed=6, must_near=('pool', 4))
for r, sd in (('R1', 10), ('R2', 20), ('E', 30)):
    LOG[r + '_stal'] = scatter('cav_stalagmite', RM[r], 3, gap=5, seed=sd + 1)
    LOG[r + '_rock'] = scatter('cav_rock_a', RM[r], 3, gap=5, seed=sd + 2)
    LOG[r + '_rock_b'] = scatter('cav_rock_b', RM[r], 1, gap=6, seed=sd + 3)
    LOG[r + '_mush'] = scatter('cav_mushroom_a' if r != 'R2' else 'cav_mushroom_b', RM[r], 2, gap=5, seed=sd + 4)
# 방 가장자리(벽면 아래 첫 줄)와 모서리에 석순·바위를 더 놓는다: 천장 바위가 지도의 60% 라 물체 피복은 바닥 위 밀도로 채운다
for r, sd in (('P', 40), ('R1', 50), ('R2', 60), ('E', 70), ('R3', 80)):
    x0, y0, x1, y1 = ROOMS[r]
    edge = [c for c in RM[r] if (c[0] in (x0 + 1, x1 - 1) or c[1] == y1 or c[1] == y0 + 2)]
    LOG[r + '_edge_stal'] = scatter('cav_stalagmite', edge, 12 if r == 'P' else 6, gap=3, seed=sd + 1)
    LOG[r + '_edge_rock'] = scatter('cav_rock_a', edge, 14 if r == 'P' else 6, gap=3, seed=sd + 2)
    LOG[r + '_edge_rockb'] = scatter('cav_rock_b', edge, 7 if r == 'P' else 3, gap=4, seed=sd + 3)
    LOG[r + '_edge_mush'] = scatter('cav_mushroom_b' if r in ('P', 'R1') else 'cav_mushroom_a', edge, 9 if r == 'P' else 4, gap=3, seed=sd + 4)
LOG['R1_crys'] = scatter('cav_crystal', RM['R1'], 2, gap=6, seed=15)
LOG['R2_crys'] = scatter('cav_crystal', RM['R2'], 2, gap=6, seed=25)
LOG['R3_crys'] = scatter('cav_crystal', RM['R3'], 2, gap=5, seed=35)
LOG['R3_stal'] = scatter('cav_stalagmite', RM['R3'], 2, gap=5, seed=36)
LOG['R3_mush'] = scatter('cav_mushroom_a', RM['R3'], 1, gap=5, seed=37)
print('소품', LOG)


def remove_item(name, x, y):
    for i, p in enumerate(kit.placed):
        if p[0] == name and p[1] == x and p[2] == y:
            kit.placed.pop(i); kit.items.pop(i); break
    for (X, Y, ch) in kit.cells_for(name, x, y):
        lst = kit.DRAWN.get((X, Y), [])
        for j, (n2, c2) in enumerate(lst):
            if n2 == name: lst.pop(j); break
        if not lst: kit.DRAWN.pop((X, Y), None)
        if ch == 'X' and kit.HARD.get((X, Y)) == name: kit.HARD.pop((X, Y), None)
    if (name, x, y) in PLACEPOS: PLACEPOS.remove((name, x, y))


def fill_plain(rounds=40):
    """10×10 전부 평범한 바닥인 빈 칸을 지운다: 창 가운데에 바위·석순·버섯을 놓는다."""
    for r in range(rounds):
        bad = FM.audit_plain(kit, 10, plain_kinds=(None, 'lit'))
        if not bad: return r
        x, y = bad[len(bad) // 2]
        cx, cy = x + 5, y + 5
        for nm, dx, dy in (('cav_rock_b', 0, 0), ('cav_stalagmite', -3, 2), ('cav_mushroom_a', 3, -2), ('cav_crystal', 2, 3), ('cav_rock_a', -4, -3)):
            put(nm, cx + dx, cy + dy)
    return rounds


print('빈 땅 메움 라운드', fill_plain())


def fix_lines():
    removed = 0
    for _ in range(12):
        bad = FM.audit_line3(kit.placed)
        if not bad: break
        for (n, (x, y), (dx, dy)) in bad:
            mid = (x + dx, y + dy)
            for (nm, px, py, pw_, ph_) in list(kit.placed):
                if nm == n and (px, py + ph_ - 1) == mid:
                    remove_item(nm, px, py); removed += 1; break
    return removed


print('줄 심기 뽑음', fix_lines())

# --- 사냥터 스폰(몬스터 이벤트 자리 좌표만): 광장 5 · 서쪽 방 2 · 동쪽 방 2 · 입구 방 1 · 보물방 1(상자 지킴이)
def add_spawns(zone, cells, n, gap, seed):
    rg_ = random.Random(seed)
    cs = sorted(c for c in cells if kit.walkable(*c) and c not in kit.DRAWN and c not in KEEP and c not in CORRC)
    rg_.shuffle(cs)
    k = 0
    for (x, y) in cs:
        if k >= n: break
        if any(abs(x - a['x']) + abs(y - a['y']) < gap for a in kit.SPAWNS): continue
        kit.SPAWNS.append({'x': x, 'y': y, 'zone': zone}); k += 1
    return k


print('스폰', add_spawns('plaza', RM['P'], 5, 7, 1), add_spawns('west', RM['R1'], 2, 5, 2), add_spawns('east', RM['R2'], 2, 5, 3),
      add_spawns('entry', RM['E'], 1, 5, 4), add_spawns('treasure', [(CHEST[0] + dx, CHEST[1] + 2 + dy) for dx in range(-2, 3) for dy in range(0, 2)], 1, 3, 5))

# 사람: 입구 방의 광부 한 명
PEOPLE = kit.PEOPLE
PEOPLE.append((22, 43, 5, PP.RIGHT, 1))
ANCH_ROOMS = set()

# ================================================================ 3단계: 자동 점검 단언
ROOMOF = {}
for nm, (x0, y0, x1, y1) in ROOMS.items():
    for c in R(x0, y0, x1, y1): ROOMOF[c] = nm


def audit_all():
    probs = []
    walk = total_walk()
    seen = kit.reach(START)
    # 1) 모든 걸을 칸이 출구에서 닿는다
    iso = FM.audit_unreachable_walk(kit, seen)
    if iso: probs.append('출구에서 못 닿는 걸을 칸 덩어리 %d: %s' % (len(iso), iso[:4]))
    # 2) 입구 앞 걸을 칸: 출구 목 6열 × 3줄 전부 걷는 칸
    for x in range(21, 27):
        for y in range(45, 48):
            if not kit.walkable(x, y): probs.append('출구 앞 걸을 칸 막힘 %s' % ((x, y),))
    # 3) 복도는 서로 다른 두 방(또는 출구)을 잇는다 / 막다른 갈래는 보물방 하나뿐
    adj = collections.defaultdict(set)                  # 복도 덩어리 → 닿는 방
    comp, cid = {}, 0
    for c in sorted(CORRC):
        if c in comp: continue
        st = [c]; comp[c] = cid
        while st:
            x, y = st.pop()
            for dx, dy in FM.DIRS4:
                n = (x + dx, y + dy)
                if n in CORRC and n not in comp: comp[n] = cid; st.append(n)
        cid += 1
    for c, i in comp.items():
        for dx, dy in FM.DIRS4:
            n = (c[0] + dx, c[1] + dy)
            if n in ROOMOF: adj[i].add(ROOMOF[n])
            if n[1] >= MH: adj[i].add('OUT')
    deg = collections.Counter()
    for i, rs in adj.items():
        if len(rs) < 2: probs.append('복도 덩어리 %d 가 방 둘을 잇지 않음 %s' % (i, sorted(rs)))
        for r in rs: deg[r] += 1
    deadrooms = sorted(r for r in ROOMS if deg[r] <= 1)
    if deadrooms != ['R3']: probs.append('막다른 방은 보물방(R3) 하나여야 함: %s' % deadrooms)
    # 4) 같은 소품 셋 일렬 금지
    ln = FM.audit_line3(kit.placed)
    if ln: probs.append('셋 일렬 %d: %s' % (len(ln), ln[:4]))
    # 5) 10×10 완전 빈 바닥 금지
    pl = FM.audit_plain(kit, 10, plain_kinds=(None, 'lit'))
    if pl: probs.append('10×10 빈 바닥 %d: %s' % (len(pl), pl[:4]))
    # 6) 천장·벽면·못 이음 일관: 벽 규칙
    bad = []
    for y in range(MH):
        for x in range(MW):
            k = KG[y][x]
            up = KG[y - 1][x] if y > 0 else 'ceil'
            dn = KG[y + 1][x] if y + 1 < MH else 'ceil'
            if k == 'cface0':
                if up != 'ceil': bad.append(('앞면 윗줄 위가 천장 아님', x, y))
                if dn != 'cface1': bad.append(('앞면 윗줄 아래가 아랫줄 아님', x, y))
            elif k == 'cface1':
                if up != 'cface0': bad.append(('앞면 아랫줄 위가 윗줄 아님', x, y))
                if dn not in (None, 'lit'): bad.append(('앞면 아랫줄 아래가 걷는 바닥 아님', x, y))
            elif k == 'ceil':
                if dn not in ('ceil', 'cface0'): bad.append(('천장 아래가 벽면 아님', x, y))
            elif k in (None, 'lit'):
                if up == 'ceil': bad.append(('천장 바로 밑에 벽면 없이 바닥', x, y))
            elif k == 'pool':
                for dx, dy in ((0, -1), (0, 1), (1, 0), (-1, 0)):
                    X, Y = x + dx, y + dy
                    if inb(X, Y) and KG[Y][X] in ('ceil', 'cface0', 'cface1'): bad.append(('못이 벽에 붙음', x, y))
    if bad: probs.append('이음·벽 규칙 불일치 %d: %s' % (len(bad), bad[:6]))
    # 7) 벽면 칸·못 칸 위에 물체 없음, 사람·스폰은 걸을 칸
    for (nm, x, y, w, h) in kit.placed:
        for (X, Y, ch) in kit.cells_for(nm, x, y):
            if KG[Y][X] not in OKF: probs.append('물체가 바닥 아닌 칸 위 %s %s' % (nm, (X, Y)))
    for p in PEOPLE:
        if not kit.walkable(p[0], p[1]): probs.append('사람 자리 불량 %s' % (p[:2],))
    for a in kit.SPAWNS:
        if not kit.walkable(a['x'], a['y']): probs.append('스폰 자리 불량 %s' % a)
    # 8) 보물 상자 앞 칸(남쪽)이 걸을 수 있다
    if not kit.walkable(CHEST[0], CHEST[1] + 1): probs.append('상자 앞이 막힘 %s' % (CHEST,))
    return probs, len(walk), len(seen)


PR, NW, NR = audit_all()
print('자동 점검', '모두 통과' if not PR else PR, '| 걸을 수 있는 칸 %d, 출구에서 닿는 칸 %d' % (NW, NR))
if PR and not os.environ.get('JS_FORCE'):
    print('자동 점검 FAIL — 굽지 않는다(JS_FORCE=1 로 무시)'); sys.exit(1)

direct, rep = kit.bake(ground_ids(), 'cave_fa', people_overlay=PP.overlay,
                       ground_kind_map={None: 'floor', 'lit': 'floor', 'ceil': 'wall', 'cface0': 'wall', 'cface1': 'wall', 'pool': 'water'},
                       extra_fields={'spawnZones': {k: sum(1 for a in kit.SPAWNS if a['zone'] == k) for k in ('plaza', 'west', 'east', 'entry', 'treasure')},
                                     'rooms': {k: list(v) for k, v in ROOMS.items()}, 'corridors': [list(c) for c in CORR],
                                     'chest': list(CHEST), 'audit': {'walkable': NW, 'reachableFromStart': NR, 'start': list(START)}})
print('굽기 끝', json.dumps(rep, ensure_ascii=False))
