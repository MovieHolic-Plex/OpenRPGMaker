"""동굴 `joseon_cave`(48×48) 맵 빌더 — 계획은 tiledata/joseon-field/PLAN.md 「동굴」 절.

    python3 demo_cave.py          # tiledata/joseon-cave/ 에 굽는다(JS_OUT 으로 다른 폴더, JS_FORCE=1 은 점검 실패 무시)

바닥 종류: None=동굴 바닥 · lit=입구 햇빛 바닥 · pool=지하 못 · ceil=천장(벽 윗면) · cface0/cface1=천장 밑 벽 앞면 두 줄.
방 모양(걸을 칸 집합)만 정하면 벽은 규칙으로 나온다: 걸을 칸 바로 위의 비(非)바닥 칸 = 앞면 아랫줄, 그 위 = 앞면 윗줄, 그 위 = 천장.
(그래서 걸을 칸 위쪽 벽은 항상 세 줄 이상이고, 단언이 이를 확인한다.)
"""
import os, sys, random, collections
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, 'harness'))
import numpy as np
from tk import hsh, rnd, T
import water_blob as WB
import people as PP
import fld_map as FM
from fld_map import Kit

ROOT = FM.ROOT
OUT = os.environ.get('JS_OUT') or os.path.join(ROOT, 'tiledata', 'joseon-cave')
MW = MH = 48
R = random.Random(int(os.environ.get('JS_SEED', '5')))
kit = Kit(MW, MH, 'fa_cave', OUT, 'joseon-cave')
for g in ('cav_floor', 'cav_floor_lit', 'cav_ceil32', 'cav_face24', 'cav_pool94'):
    kit.add_group(g, kit.terr[g])
GID = {g: kit.gid(g) for g in kit.pieces}
KG = kit.KG
inb = kit.inb
START = (24, 47)
PEOPLE = kit.PEOPLE
VIS = set()      # 소품이 서면 안 되는 칸: 복도·출입구 길목
ANCH = []        # 막다른 끝이어도 되는 목적 칸(보물 상자 앞)


def rect(x0, y0, x1, y1):
    return {(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)}


def room(x0, y0, x1, y1, cut=1, seed=0, bump=False):
    """모서리를 cut 칸 깎은 사각 방. bump 면 위·아래 바깥 줄을 군데군데 한 칸씩 비워 가장자리를 울퉁불퉁하게 한다(안쪽 줄은 건드리지 않는다)."""
    out = set()
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            dx, dy = min(x - x0, x1 - x), y1 - y          # 모서리는 아래쪽만 깎는다: 위쪽이 계단이면 계단마다 짧은 앞면 조각이 허공에 뜬다
            if dx + dy < cut:
                continue
            if bump and (y == y1) and dx >= cut + 1 and rnd(x, y, 91 + seed) > 0.78:
                continue
            out.add((x, y))
    while True:       # 이웃이 둘 이하인 돌기 칸은 지운다(울퉁불퉁은 하되 외줄 돌기는 안 만든다)
        cut = [c for c in out if sum(1 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if (c[0] + dx, c[1] + dy) in out) <= 1 and bump]
        if not cut: break
        out -= set(cut)
    return out


# ================================================================ 1단계: 방·복도 (걸을 칸)
E_ROOM = room(19, 38, 28, 43, 1) | rect(19, 43, 28, 43)
LIT = rect(21, 44, 26, 47) | {(x, y) for (x, y) in rect(21, 42, 26, 43) if rnd(x, y, 61) > 0.45}     # 입구 목(6칸 폭) + 안쪽으로 번지는 햇빛 바닥(가장자리 불규칙)
P_ROOM = room(13, 15, 34, 31, 3, seed=1, bump=True)
R3 = room(20, 3, 27, 9, 1)
R1 = room(3, 21, 10, 29, 1)
R2 = room(37, 18, 46, 28, 1)
CORR = {
    'N': rect(23, 32, 25, 37),          # 입구 방 → 광장
    'TR': rect(23, 10, 25, 14),         # 광장 → 보물방
    'W1': rect(11, 24, 12, 26),         # 광장 ↔ 서방
    'E1': rect(35, 22, 36, 24),         # 광장 ↔ 동방
    'WS': rect(7, 30, 9, 39),           # 서방 → 남쪽 가로 복도
    'WH': rect(7, 40, 18, 42),          # 남쪽 가로 복도(서)
    'ES': rect(38, 29, 40, 39),         # 동방 → 남쪽 가로 복도
    'EH': rect(29, 40, 40, 42),         # 남쪽 가로 복도(동)
}
FLOOR = E_ROOM | LIT | P_ROOM | R3 | R1 | R2
for v in CORR.values():
    FLOOR |= v
POOL = set()
for (x, y) in P_ROOM:
    d = ((x - 19.2) / 3.1) ** 2 + ((y - 22.8) / 2.1) ** 2
    if d <= 1.0 + 0.3 * (rnd(x // 1, y, 77) - 0.5):
        POOL.add((x, y))
POOL2 = {(x, y) for (x, y) in R2 if ((x - 42.0) / 2.55) ** 2 + ((y - 23.4) / 2.65) ** 2 <= 1.0 + 0.18 * (rnd(x, y, 79) - 0.5) and 39 <= x <= 44 and 20 <= y <= 27}      # 둥글린 못(옥타곤 윤곽 + 약한 흔들림): 직사각 L자가 되지 않게
for _r in range(2):      # 못 윤곽 다듬기(1칸 가시·홈 정리)
    rm = {(x, y) for (x, y) in POOL2 if sum(1 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if (x + dx, y + dy) in POOL2) <= 1}
    POOL2 -= rm
POOL |= POOL2

for (x, y) in FLOOR:
    KG[y][x] = 'lit' if (x, y) in LIT else None
for (x, y) in POOL:
    KG[y][x] = 'pool'
# 벽: 걸을 칸(못 포함) 바로 위 = 앞면 아랫줄, 그 위 = 윗줄, 나머지 = 천장
OPEN = set(FLOOR)
for y in range(MH):
    for x in range(MW):
        if (x, y) not in OPEN:
            KG[y][x] = 'ceil'
for y in range(1, MH):
    for x in range(MW):
        if (x, y) not in OPEN and y + 1 < MH and (x, y + 1) in OPEN:
            KG[y][x] = 'cface1'
for y in range(MH):
    for x in range(MW):
        if KG[y][x] == 'ceil' and y + 1 < MH and KG[y + 1][x] == 'cface1':
            KG[y][x] = 'cface0'
# 짧은 앞면(폭 3칸 미만)은 허공에 뜬 벽 조각처럼 보이므로 천장으로 되돌린다(방 모서리 계단 부분).
SHORT = set()
for y in range(MH):
    x = 0
    while x < MW:
        if KG[y][x] == 'cface1':
            x1 = x
            while x1 + 1 < MW and KG[y][x1 + 1] == 'cface1': x1 += 1
            if x1 - x + 1 < 3:
                for xx in range(x, x1 + 1):
                    KG[y][xx] = 'ceil'; KG[y - 1][xx] = 'ceil'; SHORT.add((xx, y))
            x = x1 + 1
        else:
            x += 1


def mset(cs, x, y):
    return kit.mask4(cs, x, y, edge_open=True)


def ground_ids():
    fam = {k: kit.cells_of(k) for k in ('ceil', 'cface0', 'cface1', 'pool')}
    mass = fam['ceil'] | fam['cface0'] | fam['cface1']
    gr = [[0] * MW for _ in range(MH)]
    for y in range(MH):
        for x in range(MW):
            k = KG[y][x]
            if k is None:
                gid = GID['cav_floor'] + (0, 2, 4)[hsh(x, y, 17) % 3]      # 결이 고른 변형만(1·3·5 는 밝은 점이 많아 격자무늬처럼 보인다)
            elif k == 'lit':
                gid = GID['cav_floor_lit'] + (hsh(x, y, 41) + y) % 4
            elif k == 'ceil':
                gid = GID['cav_ceil32'] + 16 * (hsh(x, y, 59) % 2) + mset(mass, x, y)
            elif k in ('cface0', 'cface1'):
                same = fam[k]
                we = (1 if (x - 1, y) in same else 0) | (2 if (x + 1, y) in same else 0)
                gid = GID['cav_face24'] + 8 * (hsh(x // 3, y, 61) % 3) + (0 if k == 'cface0' else 4) + we
            else:      # pool
                m8 = 0
                for bit, (dx, dy) in ((WB.N, (0, -1)), (WB.E, (1, 0)), (WB.S, (0, 1)), (WB.W, (-1, 0)), (WB.NE, (1, -1)), (WB.SE, (1, 1)), (WB.SW, (-1, 1)), (WB.NW, (-1, -1))):
                    if (x + dx, y + dy) in fam['pool']: m8 |= bit
                gid = GID['cav_pool94'] + WB.index47(m8) + 47 * (hsh(x, y, 29) % 2)
            gr[y][x] = gid
    return gr


# ================================================================ 2단계: 앵커
for k in ('W1', 'E1'):
    VIS |= CORR[k]
for (x0, y0, x1, y1) in ((24, 10, 24, 14), (24, 32, 24, 37), (8, 30, 8, 39), (39, 29, 39, 39), (7, 41, 18, 41), (29, 41, 40, 41)):
    VIS |= rect(x0, y0, x1, y1)           # 복도는 한가운데 한 줄만 비운다(양 가장자리에는 소품이 설 수 있다)
VIS |= rect(23, 36, 25, 47)              # 입구 방 한가운데 길목
VIS |= rect(21, 44, 26, 47)
VIS |= rect(22, 7, 24, 9)               # 보물 상자 앞 길
for (x, y) in list(rect(11, 23, 12, 27)) + list(rect(35, 21, 36, 25)):
    VIS.add((x, y))
OKF = (None,)


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
    """걸을 칸 중 걸을 이웃이 1개 이하인 칸(앵커 곁 제외). 소품이 틈을 막아 새 막다른 칸을 만들면 그 소품은 취소한다."""
    W_ = total_walk()
    out = set()
    for (x, y) in W_:
        if sum(1 for dx, dy in FM.DIRS4 if (x + dx, y + dy) in W_) <= 1 and not any(abs(x - a) + abs(y - b) <= 1 for (a, b) in ANCH):
            out.add((x, y))
    return out


def put(name, x, y, ok=OKF, vis=True, conn=True):
    if not kit.can_place(name, x, y, ok_kinds=ok):
        return None
    if vis and any((X, Y) in VIS for (X, Y, ch) in kit.cells_for(name, x, y)):
        return None
    base = dead_cells()
    res = kit.place(name, x, y, ok_kinds=ok)
    if conn and (not connected_ok() or not dead_cells() <= base):
        if os.environ.get('JS_DBG'): print('  put 취소', name, x, y, 'conn' if not connected_ok() else 'dead %s' % sorted(dead_cells() - base)[:3])
        undo(name, x, y)
        return None
    return res


DEAD0 = dead_cells()
# 입구: 햇빛 든 바닥이 맨 아래 가장자리까지 → 들판(joseon_field)의 굴 입구로 나간다
kit.EXITS.append({'to': 'joseon_field', 'side': 'S', 'x0': 21, 'x1': 26, 'y': 47})
kit.DOORS.append({'x': 23, 'y': 47, 'piece': 'cave-entrance'}); kit.DOORS.append({'x': 24, 'y': 47, 'piece': 'cave-entrance'})
ANCH.extend([(23, 47), (24, 47)])

def put_any(name, cands, **kw):
    """후보 칸을 차례로 시도해 처음 놓이는 곳에 놓는다(벽 가장자리 모서리에서 틈을 막아 막다른 칸이 생기면 다음 후보로)."""
    for (x, y) in cands:
        if put(name, x, y, **kw):
            return (x, y)
    print('  놓지 못함', name, cands[:2])
    return None


# 입구 방: 목 양옆 화로 둘(문루처럼 입구를 가름) + 북쪽 복도 양옆 화로 + 한쪽 구석 모닥불(입구 길목은 비운다)
put_any('cav_brazier', [(20, 42), (20, 41), (19, 42)], vis=False); put_any('cav_brazier', [(27, 42), (27, 41), (28, 42)], vis=False)
put_any('cav_brazier', [(21, 38), (22, 38), (21, 39)], vis=False); put_any('cav_brazier', [(27, 38), (26, 38), (27, 39)], vis=False)
put('fld_campfire', 20, 39, ok=OKF, vis=False)
put('fld_bones_a', 28, 40, vis=False)
# 광장: 석주 넷(모서리), 화로 둘(보물방 복도 양옆)
for (x, y) in ((16, 17), (31, 17), (16, 27), (31, 27)):
    put('cav_pillar', x, y, vis=False)
put_any('cav_brazier', [(22, 16), (21, 16), (22, 17)], vis=False); put_any('cav_brazier', [(26, 16), (27, 16), (27, 17)], vis=False)
# 보물방: 상자 하나(막다른 갈래의 보상), 화로 둘
put_any('cav_brazier', [(22, 3), (21, 4), (22, 4)], vis=False); put_any('cav_brazier', [(25, 3), (26, 4), (25, 4)], vis=False)
CHEST = (23, 6)
put('cav_chest', CHEST[0], CHEST[1], vis=False); ANCH.append((CHEST[0], CHEST[1] + 1)); ANCH.append((CHEST[0], CHEST[1] - 1))
# 서방(광산 방): 광석 노두·화로 / 동방(짐승굴 방): 화로(상자는 보물방 하나뿐)
put_any('cav_brazier', [(5, 22), (4, 22), (6, 22)], vis=False)
put('fld_ore_b', 3, 26, ok=OKF, vis=False); put('fld_ore_a', 10, 28, ok=OKF, vis=False)
put_any('cav_brazier', [(44, 19), (43, 19), (45, 20)], vis=False)

# ================================================================ 3단계: 소품 (방 안, 땅 자체 → 물체)
POS = collections.defaultdict(list)


def makes_line(nm, x, y):
    S_ = set(POS[nm])
    for (px, py) in POS[nm]:
        if (2 * px - x, 2 * py - y) in S_ or (2 * x - px, 2 * y - py) in S_: return True
        if (x + px) % 2 == 0 and (y + py) % 2 == 0 and ((x + px) // 2, (y + py) // 2) in S_: return True
    return False


def scatter(names, region, count, gap=3, seed=0, near=None, ok=OKF, vis=True, conn=True):
    rg = random.Random(seed)
    cand = sorted(region)
    rg.shuffle(cand)
    n = 0
    for (x, y) in cand:
        if n >= count: break
        nm = rg.choice(names)
        key = 'mush' if nm.startswith('cav_mushroom') else nm       # 버섯 두 종은 한 무리로 센다(번갈아 일렬이 되지 않게)
        if any(max(abs(x - px), abs(y - py)) < gap for (px, py) in POS[key]): continue
        if makes_line(key, x, y): continue
        if near and not near(x, y): continue
        if put(nm, x, y, ok=ok, vis=vis, conn=conn):
            POS[key].append((x, y)); n += 1
    return n


def near_wall(x, y, d=1):
    return any(KG[y + dy][x + dx] in ('ceil', 'cface0', 'cface1') for dx in range(-d, d + 1) for dy in range(-d, d + 1) if inb(x + dx, y + dy))


def near_pool(x, y, d=2):
    return any((x + dx, y + dy) in POOL for dx in range(-d, d + 1) for dy in range(-d, d + 1))


ROOMS = {'P': P_ROOM, 'R1': R1, 'R2': R2, 'R3': R3, 'E': E_ROOM}
inroom = lambda c: any(c in v for v in ROOMS.values())
ALL = {c for v in ROOMS.values() for c in v if KG[c[1]][c[0]] is None}
STAL = ['cav_stalagmite']
n1 = scatter(STAL, ALL, 34, gap=3, seed=1, near=lambda x, y: near_wall(x, y, 2))
n2 = scatter(['cav_crystal'], ALL, 20, gap=3, seed=2, near=lambda x, y: near_wall(x, y, 1))
n3 = scatter(['cav_mushroom_a', 'cav_mushroom_b'], ALL, 10, gap=4, seed=3, near=lambda x, y: near_pool(x, y, 1))
n4 = scatter(['cav_rock_a', 'cav_rock_b'], ALL, 60, gap=3, seed=4)
n5 = scatter(['fld_bones_a', 'fld_bones_b'], {c for c in ALL if c in R1 or c in R2 or c in P_ROOM}, 6, gap=6, seed=5)
n6 = scatter(['cav_mushroom_a', 'cav_mushroom_b'], {c for c in ALL if c in R2 or c in R3}, 5, gap=4, seed=6)
n8 = scatter(['fld_rock_m_a', 'fld_rock_m_b', 'fld_rock_l_a', 'fld_rock_l_b'], ALL, 12, gap=6, seed=8, near=lambda x, y: near_wall(x, y, 2))
n7 = scatter(['fld_ore_a', 'fld_ore_b'], {c for c in ALL if c in R1 or c in R2 or c in P_ROOM}, 8, gap=5, seed=7, near=lambda x, y: near_wall(x, y, 1))
# 고리 복도 가장자리: 한가운데 한 줄은 비우고 양 가장자리에 석순·바위·수정을 드문드문
CEDGE = {c for k, v in CORR.items() for c in v if KG[c[1]][c[0]] is None and c not in VIS and near_wall(c[0], c[1], 1)}
n9 = scatter(['cav_stalagmite', 'cav_rock_a', 'cav_rock_b', 'cav_crystal'], CEDGE, 16, gap=5, seed=9)


# 바위 속 박힌 광물·이끼: 천장 칸 위에 구역별로 다른 물체를 얹어 바위 판이 한 가지 타일로 보이지 않게 한다(북서 광석 · 북동 수정 · 남서 청록 이끼 · 남동 광석+수정)
def embed(box, names, count, seed, gap=4):
    x0, y0, x1, y1 = box
    reg = {(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1) if KG[y][x] == 'ceil' and all(KG[y + dy][x + dx] == 'ceil' for dx in (-1, 0, 1) for dy in (-1, 0, 1) if inb(x + dx, y + dy))
           and 2 <= min([abs(x - a) + abs(y - b) for (a, b) in OPEN if abs(x - a) <= 4 and abs(y - b) <= 4] or [9]) <= 3}      # 동굴 가장자리 바로 뒤 바위(벽 두께 안쪽)에만: 허공에 흩뿌리지 않는다
    return scatter(names, reg, count, gap=gap, seed=seed, ok=('ceil',), vis=False, conn=False)


EMB = [embed((0, 0, 20, 24), ['fld_ore_a', 'fld_ore_b'], 8, 21, 3), embed((26, 0, 47, 18), ['cav_crystal'], 8, 22, 3),
       embed((0, 30, 20, 47), ['cav_mushroom_b'], 8, 23, 3), embed((28, 30, 47, 47), ['fld_ore_a', 'cav_crystal'], 8, 24, 3)]
print('소품', n1, n2, n3, n4, n5, n6, n7, n8, n9, EMB)


# ---- 10×10 완전 빈 바닥 메우기: 광장 속 빈 창은 소품을 더 놓아 채운다(소품은 방 안에서만, 길목은 비운다)
def plain_fill(max_rounds=40):
    n = 0
    for _ in range(max_rounds):
        bad = FM.audit_plain(kit, 10, (None, 'lit'))
        if not bad: break
        x0, y0 = bad[len(bad) // 2]
        reg = {(x, y) for (x, y) in rect(x0, y0, x0 + 9, y0 + 9) if KG[y][x] is None}
        got = scatter(['cav_rock_a', 'cav_rock_b', 'cav_stalagmite', 'cav_crystal'], reg, 1, gap=1, seed=100 + n)
        if not got:
            break
        n += got
    return n


print('빈 창 메움', plain_fill(), '남은', len(FM.audit_plain(kit, 10, (None, 'lit'))))

# ================================================================ 4단계: 스폰·사람
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
spawn('entrance', 'cave-slime', E_ROOM, 2)
spawn('treasure', 'cave-boss', R3, 1)
spawn('hall-W', 'cave-bat', CORR['WH'] | CORR['WS'], 2)
spawn('hall-E', 'cave-bat', CORR['EH'] | CORR['ES'], 2)
kit.SPAWNS.extend(SP)
ANCH.extend((s['x'], s['y']) for s in SP)
for cands, ch, d, fr in (([(27, 40), (28, 41), (19, 40), (19, 41)], 2, PP.LEFT, 1), ([(6, 25), (7, 25), (6, 26), (8, 24), (5, 24), (7, 27), (9, 25)], 5, PP.FRONT, 0)):    # 입구 방의 모험가(길목 밖), 광산 방의 광부
    for (x, y) in cands:
        if kit.walkable(x, y) and (x, y) not in kit.DRAWN and (x, y) not in VIS:
            PEOPLE.append((x, y, ch, d, fr)); break

# ================================================================ 5단계: 자동 점검 단언
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
# 막다른 길: 걸을 칸 중 걸을 수 있는 이웃이 1개 이하인 칸(보물 상자 앞은 목적지)
dead = []
for (x, y) in WALK:
    nb = sum(1 for dx, dy in FM.DIRS4 if (x + dx, y + dy) in WALK)
    if nb <= 1 and not any(abs(x - a) + abs(y - b) <= 1 for (a, b) in ANCH):
        dead.append((x, y))
if dead:
    PROBS.append('막다른 걸을 칸 %d: %s' % (len(dead), dead[:6]))
l3 = FM.audit_line3(kit.placed)
if l3:
    PROBS.append('일렬 3개 소품 %d: %s' % (len(l3), l3[:4]))
pl = FM.audit_plain(kit, 10, (None, 'lit'))
if pl:
    PROBS.append('빈 바닥 10×10 %d: %s' % (len(pl), pl[:4]))
ok = all(kit.walkable(x, y) for x in range(21, 27) for y in (45, 46, 47))
if not ok:
    PROBS.append('입구 앞 걸을 칸이 막혔다')
# 벽 이음: 천장 밑 두 줄 앞면 규칙(앞면 윗줄 위=천장, 앞면 아랫줄 위=윗줄, 아랫줄 아래=바닥) + 못 둘레 바닥
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
        if k == 'ceil' and y + 1 < MH and KG[y + 1][x] in (None, 'lit', 'pool') and (x, y) not in SHORT:
            cl.append(('천장이 바닥에 바로 닿음', x, y))
        if k == 'pool' and any(KG[y + dy][x + dx] in ('ceil', 'cface0', 'cface1') for dx, dy in FM.DIRS4 if inb(x + dx, y + dy)):
            cl.append(('못이 벽에 닿음', x, y))
if cl:
    PROBS.append('벽 이음 %d: %s' % (len(cl), cl[:4]))
print('자동 점검', PROBS or '모두 통과')
if PROBS and not os.environ.get('JS_FORCE'):
    sys.exit(1)

# ================================================================ 6단계: 굽기
SOLID_KIND = {'ceil': 'water', 'cface0': 'water', 'cface1': 'water', 'pool': 'water', 'lit': 'road'}
detail = [[(KG[y][x] or 'floor') for x in range(MW)] for y in range(MH)]
ids = ground_ids()
direct, rep = kit.bake(ids, 'cave', people_overlay=PP.overlay, ground_kind_map=SOLID_KIND,
                       extra_fields={'groundDetail': detail, 'note': 'groundKind 의 water 는 걸을 수 없는 바닥(천장·벽 앞면·지하 못)이다 — 진짜 종류는 groundDetail. 입구 y45..47 = 들판(joseon_field)으로 나가는 출구'})
print('저장', OUT)
