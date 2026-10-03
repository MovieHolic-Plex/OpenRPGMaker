"""사냥터 `joseon_field`(96×96) 맵 빌더 — 계획은 tiledata/joseon-field/PLAN.md.

    python3 demo_field.py            # tiledata/joseon-field/ 에 굽는다(JS_OUT 으로 다른 폴더, JS_FORCE=1 은 점검 실패 무시)
    JS_STAGE=1..4                       # 단계까지만 놓고 /tmp/fa/field_stage_*.png (1 지형 → 2 길·앵커 → 3 숲 → 4 소품)

공용 틀은 fld_map.Kit(바닥 종류 격자 + 물체 층 + 시트 재조립 pixelDiff 0 + 지도 게이트). 이 파일은 배치 규칙·자동 점검 단언을 더한다.
모든 단언은 굽기 직전에 돌고, 하나라도 걸리면 굽지 않는다(JS_FORCE 로만 우회).
"""
import os, sys, math, random, json, collections
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, 'harness'))
import numpy as np
from PIL import Image
from tk import hsh, rnd, T
import water_blob as WB
import people as PP
import fld_map as FM
from fld_map import Kit, is_tree, is_bush

ROOT = FM.ROOT
OUT = os.environ.get('JS_OUT') or os.path.join(ROOT, 'tiledata', 'joseon-field')
STAGE = int(os.environ.get('JS_STAGE', '9'))
MW = MH = 96
kit = Kit(MW, MH, 'field', OUT, 'joseon-field')
tr_ = kit.terr
FACEG = 'fld_face32' if 'fld_face32' in tr_ else 'fld_face16'     # 앞면 묶음(tier 0 = 땅에 닿는 두 줄이 앞 16칸)
for g in ('grass8', 'road64', 'yard64', 'slab', 'slab_edge16', 'fld_trail32', 'fld_tall32', 'fld_forest32', 'fld_bog94', 'fld_rock32', FACEG):
    kit.add_group(g, tr_[g])
GID = {g: kit.gid(g) for g in kit.pieces}
KG = kit.KG
inb = kit.inb
SOLIDK = ('rock', 'face0', 'face1', 'bog')
VIS = set()          # 길·마당·문 앞: 물체(수관 포함)가 가리면 안 되는 칸
ANCH = []            # 막다른 길이 끝나도 되는 목적 칸
PEOPLE = kit.PEOPLE
START = (47, 0)


def noise(x, y, s, sc=3):
    return rnd(x // sc, y // sc, s)


def blob(cx, cy, rx, ry, seed, jag=0.35):
    out = set()
    for y in range(int(cy - ry * 1.4) - 1, int(cy + ry * 1.4) + 2):
        for x in range(int(cx - rx * 1.4) - 1, int(cx + rx * 1.4) + 2):
            d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
            if d <= 1.0 + jag * (noise(x, y, seed, 2) - 0.5) * 2 and inb(x, y):
                out.add((x, y))
    return out


def setk(cells, kind, only=(None,)):
    for (x, y) in cells:
        if inb(x, y) and KG[y][x] in only:
            KG[y][x] = kind


# ================================================================ 1단계: 바닥
# --- 서쪽 바위산(윗면 + 앞면 2줄): 아랫단 큰 고원 + 윗단 봉우리(앞면이 따로 선다) + 동쪽 곁봉우리. 굴 입구 자리(x4..22)는 바닥선이 평평하다.
ROCK = set()
for x in range(0, 25):
    yt = 34 + (hsh(x // 3, 1, 3) % 3)
    yb = 43 if 4 <= x <= 22 else (40 if x < 4 else 41)
    for y in range(yt, yb + 1):
        ROCK.add((x, y))
for x in range(5, 19):
    yt = 22 + (hsh(x // 2, 2, 3) % 3) + (2 if x < 7 or x > 16 else 0)
    for y in range(yt, 31):
        ROCK.add((x, y))
for x in range(24, 31):
    for y in range(23 + (x % 2), 31):
        ROCK.add((x, y))
for x in range(53, 62):                                  # 초원 한가운데 낮은 바위 언덕
    for y in range(39 + (x in (53, 61)), 42):
        ROCK.add((x, y))
FACE0 = {(x, y + 1) for (x, y) in ROCK if (x, y + 1) not in ROCK}
FACE1 = {(x, y + 1) for (x, y) in FACE0}
assert not (FACE1 & ROCK), '바위 아래 두 줄이 다른 바위와 겹친다(벽 두께 2줄이 안 나옴)'
setk(ROCK, 'rock', only=(None,)); setk(FACE0, 'face0', only=(None,)); setk(FACE1, 'face1', only=(None,))

# --- 어귀 큰길(석판 → 흙길) + 어귀 마당
for y in range(0, 6):
    for x in range(46, 50): KG[y][x] = 'slab'
for y in range(6, 17):
    for x in range(46, 50): KG[y][x] = 'road'
for y in range(17, 23):
    for x in range(42, 54): KG[y][x] = 'yard'

# --- 숲(동쪽)·늪·야영지·초원 키 큰 풀
FOREST = blob(82, 36, 14, 29, 5, 0.22) | blob(86, 14, 9, 8, 6, 0.3)
FOREST = {c for c in FOREST if c[0] >= 68}
setk(FOREST, 'forest')
BOG = blob(78, 84, 11.5, 6.5, 9, 0.2) | blob(70, 82, 5, 4, 10, 0.2)
setk(BOG, 'bog', only=(None, 'forest'))
TALL = blob(33, 31, 5.5, 4.2, 21) | blob(60, 30, 6.5, 4.5, 22) | blob(36, 53, 5.5, 4.5, 23) | blob(60, 54, 6, 4.5, 24) | blob(46, 58, 3, 2.5, 25) | blob(32, 74, 6, 4, 26) | blob(20, 82, 4, 3, 27)
setk(TALL, 'tall')
CAMP = blob(48, 71, 8.5, 6.0, 31, 0.15)
setk(CAMP, 'yard', only=(None, 'tall'))
CLEAR = blob(80, 38, 5.5, 4.5, 32, 0.15)
setk(CLEAR, 'yard', only=(None, 'forest'))
for y in (46, 47, 48):                                     # 바위산 앞마당(굴 앞) 두 줄
    for x in range(5, 31): KG[y][x] = 'yard'


def trail(points, kind='trail', seed=0):
    """웨이포인트를 4방향으로 잇는 1칸 폭 길. 한 번에 2~5칸씩 꺾어 가며 간다."""
    rg = random.Random(seed)
    cells = []
    x, y = points[0]
    for (tx, ty) in points[1:]:
        while (x, y) != (tx, ty):
            dx, dy = tx - x, ty - y
            horiz = (rg.random() < (abs(dx) / float(abs(dx) + abs(dy)))) if (dx and dy) else bool(dx)
            for _ in range(rg.randint(2, 5)):
                if horiz and x != tx: x += 1 if tx > x else -1
                elif y != ty: y += 1 if ty > y else -1
                elif x != tx: x += 1 if tx > x else -1
                cells.append((x, y))
                if (x, y) == (tx, ty): break
    cells = [points[0]] + cells
    for (cx, cy) in cells:
        if inb(cx, cy) and KG[cy][cx] in (None, 'tall', 'forest'):
            KG[cy][cx] = kind
    return cells


def widen(cells, dx, dy):
    for (x, y) in cells:
        X, Y = x + dx, y + dy
        if inb(X, Y) and KG[Y][X] in (None, 'tall', 'forest'):
            KG[Y][X] = 'trail'


TRAILS = {}
TRAILS['W'] = trail([(41, 20), (35, 20), (35, 27), (34, 38), (32, 45), (31, 46)], seed=3)                  # 어귀 → 바위산 앞마당
TRAILS['A'] = trail([(31, 47), (38, 47), (38, 52), (47, 52)], seed=4)                                      # 앞마당 → 초원 줄기길
TRAILS['S'] = trail([(47, 23), (47, 30), (46, 37), (47, 44), (47, 52), (47, 58), (47, 63)], seed=5)        # 어귀 → 야영지
TRAILS['S2'] = trail([(48, 78), (48, 86), (47, 91), (47, 95)], seed=6)                                     # 야영지 → 남쪽 출구
TRAILS['E'] = trail([(54, 20), (62, 20), (62, 24), (70, 24), (72, 30), (76, 34)], seed=7)                  # 어귀 → 숲 쉼터
TRAILS['F'] = trail([(80, 43), (80, 52), (79, 60), (80, 66), (80, 72)], seed=8)                            # 쉼터 → 늪가
TRAILS['SW'] = trail([(55, 72), (66, 72), (80, 72), (88, 72), (92, 72), (92, 82)], seed=9)                 # 야영지 → 늪가 → 늪 끝 표지
TRAILS['R'] = trail([(42, 72), (34, 72), (34, 76), (26, 76), (21, 72), (20, 70)], seed=10)                 # 야영지 → 폐허
TRAILS['G'] = trail([(26, 76), (18, 79), (12, 79), (10, 77)], seed=11)                                     # 폐허길 → 무덤
TRAILS['P1'] = trail([(47, 31), (41, 31), (36, 31)], seed=12)                                              # 줄기길 → 키 큰 풀(스폰)
TRAILS['P2'] = trail([(47, 31), (54, 31), (58, 31)], seed=13)
TRAILS['P3'] = trail([(47, 55), (42, 55), (38, 54)], seed=14)
TRAILS['P4'] = trail([(47, 55), (54, 55), (58, 55)], seed=15)
for k, (dx, dy) in (('S', (1, 0)), ('W', (0, 1)), ('E', (0, 1)), ('S2', (1, 0))):
    widen(TRAILS[k], dx, dy)


def fix_pockets():
    """바닥만으로 시작점에서 못 닿는 걸을 칸(늪·바위에 둘러싸인 풀 틈)은 둘러싼 단단한 바닥 종류로 메운다."""
    n = 0
    for _ in range(4):
        seen = kit.reach(START, ok=lambda x, y: inb(x, y) and KG[y][x] not in SOLIDK)
        bad = [(x, y) for y in range(MH) for x in range(MW) if KG[y][x] not in SOLIDK and (x, y) not in seen]
        if not bad:
            break
        for (x, y) in bad:
            cnt = collections.Counter(KG[y + dy][x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if inb(x + dx, y + dy) and KG[y + dy][x + dx] in SOLIDK)
            KG[y][x] = cnt.most_common(1)[0][0] if cnt else 'bog'
            n += 1
    return n


PROT = {(36, 31), (58, 31), (38, 54), (58, 55), (20, 70), (10, 77), (92, 82), (47, 95), (47, 0)}


def prune_spurs():
    """길·마당의 가지 끝(이웃 길 칸이 하나뿐인 칸)을 지운다. 목적지(PROT)는 남긴다."""
    n = 0
    for _ in range(30):
        rm = []
        for y in range(MH):
            for x in range(MW):
                if KG[y][x] in ('trail', 'yard') and (x, y) not in PROT:
                    nb = sum(1 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if inb(x + dx, y + dy) and KG[y + dy][x + dx] in ('trail', 'yard', 'road', 'slab'))
                    if nb <= 1: rm.append((x, y))
        if not rm: break
        for (x, y) in rm: KG[y][x] = None
        n += len(rm)
    return n


print('막힌 틈 메움', fix_pockets(), '| 길 가지 끝 지움', prune_spurs())

# 굴 입구 앞 걸을 칸·출구 칸을 마당(흙)으로: 조각의 F 칸이 단단한 바닥 위에 놓일 수 없으므로 바닥 종류를 먼저 마당으로 바꾼다
MOUTHS = [('fld_cave_a', 6), ('fld_cave_b', 13), ('fld_cave_c', 19)]
CAVE_F = []
for (nm, mx) in MOUTHS:
    for j, row in enumerate(kit.rows(nm)):
        for i, ch in enumerate(row):
            if ch == 'F':
                KG[43 + j][mx + i] = 'yard'
                CAVE_F.append((mx + i, 43 + j, nm))


# ================================================================ 지형 → 바닥 번호
def mset(cs, x, y, open_edge=False):
    return kit.mask4(cs, x, y, edge_open=open_edge)


def ground_ids():
    fam = {k: kit.cells_of(k) for k in ('road', 'yard', 'slab', 'trail', 'tall', 'forest', 'bog', 'rock', 'face0', 'face1')}
    dirt = fam['road'] | fam['yard'] | fam['slab'] | fam['trail']
    mass = fam['rock'] | fam['face0'] | fam['face1']
    gr = [[0] * MW for _ in range(MH)]
    for y in range(MH):
        for x in range(MW):
            k = KG[y][x]
            if k is None:
                gid = GID['grass8'] + (hsh(x, y, 3) % 6 if hsh(x, y, 5) % 12 < 10 else 6 + hsh(x, y, 9) % 2)
            elif k == 'road':
                gid = GID['road64'] + 16 * (hsh(x, y, 41) % 4) + mset(dirt, x, y, True)
            elif k == 'yard':
                gid = GID['yard64'] + 16 * (hsh(x, y, 43) % 4) + mset(dirt, x, y)
            elif k == 'slab':
                m = mset(fam['slab'], x, y, True)
                gid = GID['slab'] + hsh(x, y, 17) % 5 if m == 15 else GID['slab_edge16'] + m
            elif k == 'trail':
                gid = GID['fld_trail32'] + 16 * (hsh(x, y, 47) % 2) + mset(dirt, x, y)
            elif k == 'tall':
                gid = GID['fld_tall32'] + 16 * (1 if hsh(x // 5, y // 5, 17) % 3 == 0 else 0) + mset(fam['tall'], x, y)
            elif k == 'forest':
                gid = GID['fld_forest32'] + 16 * (hsh(x, y, 53) % 2) + mset(fam['forest'], x, y)
            elif k == 'bog':
                m8 = 0
                for bit, (dx, dy) in ((WB.N, (0, -1)), (WB.E, (1, 0)), (WB.S, (0, 1)), (WB.W, (-1, 0)), (WB.NE, (1, -1)), (WB.SE, (1, 1)), (WB.SW, (-1, 1)), (WB.NW, (-1, -1))):
                    if (x + dx, y + dy) in fam['bog']: m8 |= bit
                gid = GID['fld_bog94'] + WB.index47(m8) + 47 * (hsh(x, y, 29) % 2)
            elif k == 'rock':
                m = 0
                for bit, (dx, dy) in ((1, (0, -1)), (2, (1, 0)), (8, (-1, 0))):
                    if (x + dx, y + dy) in fam['rock']: m |= bit
                if (x, y + 1) in mass: m |= 4
                gid = GID['fld_rock32'] + 16 * (hsh(x, y, 59) % 2) + m
            elif k in ('face0', 'face1'):
                same = fam[k]
                we = (1 if (x - 1, y) in same else 0) | (2 if (x + 1, y) in same else 0)
                gid = GID[FACEG] + 8 * (hsh(x // 3, y, 61) % 2) + (0 if k == 'face0' else 4) + we
            else:
                gid = GID['grass8']
            gr[y][x] = gid
    return gr


def stage_png(tag):
    gr = ground_ids()
    TARR = [t.a for t in kit.tiles]
    g = np.zeros((MH * T, MW * T, 4), np.uint8)
    for y in range(MH):
        for x in range(MW):
            g[y * T:(y + 1) * T, x * T:(x + 1) * T] = TARR[gr[y][x]]
    if tag != 'g':
        FM._comp(g, kit.compose_objects(), 0, 0)
    os.makedirs('/tmp/fa', exist_ok=True)
    Image.fromarray(g, 'RGBA').save('/tmp/fa/field_stage_%s.png' % tag)


if STAGE <= 1:
    stage_png('g'); sys.exit(0)

# ================================================================ 2단계: 길·앵커
for y in range(MH):
    for x in range(MW):
        if KG[y][x] in ('road', 'yard', 'slab', 'trail'):
            VIS.add((x, y))
for c in CAVE_F:
    VIS.add((c[0], c[1]))
OKG = (None, 'tall', 'forest')


def vis_hit(name, x, y):
    return any((X, Y) in VIS for (X, Y, ch) in kit.cells_for(name, x, y))


def total_walk():
    return {(x, y) for y in range(MH) for x in range(MW) if kit.walkable(x, y)}


def undo(name, x, y):
    kit.placed.pop(); kit.items.pop()
    for (X, Y, ch) in kit.cells_for(name, x, y):
        kit.DRAWN[(X, Y)].pop()
        if not kit.DRAWN[(X, Y)]: del kit.DRAWN[(X, Y)]
        if ch == 'X': kit.HARD.pop((X, Y), None)


def connected_ok():
    return len(kit.reach(START)) == len(total_walk())


def put(name, x, y, ok=OKG, vis=True, conn=False):
    """조각을 놓는다. vis: 길 칸을 가리지 않아야 한다. conn: 놓은 뒤에도 모든 걸을 칸이 시작점에서 닿아야 한다."""
    if not kit.can_place(name, x, y, ok_kinds=ok):
        return None
    if vis and vis_hit(name, x, y):
        return None
    res = kit.place(name, x, y, ok_kinds=ok)
    if conn and not connected_ok():
        undo(name, x, y)
        return None
    return res


def pw(x, y):
    ANCH.append((x, y))


# --- 굴 입구 셋(앵커): 조각 맨 윗줄이 윗면 바위 마지막 줄을 덮고 아래 두 줄이 앞면을 덮는다
for (nm, mx) in MOUTHS:
    kit.place(nm, mx, 43, ok_kinds=('rock', 'face0', 'face1', 'yard', None))
    for c in CAVE_F:
        if c[2] == nm:
            kit.DOORS.append({'x': c[0], 'y': c[1] + 1, 'piece': nm})
            kit.EXITS.append({'to': 'joseon_cave', 'x': c[0], 'y': c[1], 'piece': nm})
            pw(c[0], c[1])
kit.EXITS.append({'to': 'gungnae_full', 'side': 'N', 'x0': 46, 'x1': 49, 'y': 0})
kit.EXITS.append({'to': 'next_field', 'side': 'S', 'x0': 47, 'x1': 48, 'y': 95})
pw(47, 95); pw(46, 0); pw(49, 0)

# --- 어귀: 장승 한 쌍 + 이정표
for nm, x, y in (('jangseung_m', 44, 17), ('jangseung_f', 51, 17)):
    put(nm, x, y, ok=('yard',), vis=False)
put('fld_signpost', 54, 17, ok=('yard',), vis=False)
put('fld_signpost', 31, 44, ok=('yard',), vis=False)      # 앞마당 길목
put('fld_signpost', 48, 93, ok=OKG, vis=False)             # 남쪽 출구

# --- 야영지(남쪽): 모닥불이 중심, 천막 둘·건조대·통나무 의자
put('fld_campfire', 48, 72, ok=('yard',), vis=False); pw(48, 73)
put('fld_tent_b', 41, 66, ok=('yard', None), vis=False)
put('fld_tent_a', 53, 66, ok=('yard', None), vis=False)
put('fld_rack', 54, 71, ok=('yard', None), vis=False)
put('fld_log_b', 43, 72, ok=('yard',), vis=False)
put('fld_stump_a', 52, 73, ok=('yard',), vis=False)
put('fld_stump_b', 44, 75, ok=('yard',), vis=False)
put('fld_bones_a', 55, 75, ok=('yard', None), vis=False)

# --- 숲 쉼터(나무꾼): 모닥불·통나무·그루터기
put('fld_campfire', 80, 39, ok=('yard',), vis=False); pw(80, 40)
put('fld_log_a', 74, 40, ok=('yard',), vis=False)
put('fld_stump_a', 77, 36, ok=('yard',), vis=False)
put('fld_stump_b', 84, 37, ok=('yard',), vis=False)
put('fld_log_b', 82, 42, ok=('yard', 'forest'), vis=False)

# --- 폐허·무덤
def keep_visible(name, x, y, up=3, side=1):
    """놓은 조각의 몸체와 그 위·옆 여백을 VIS 에 넣는다: 나중에 자라는 나무 수관이 폐허·무덤을 가리지 않게."""
    for (X, Y, ch) in kit.cells_for(name, x, y):
        for dy in range(-up, 1):
            for dx in range(-side, side + 1):
                VIS.add((X + dx, Y + dy))


if put('fld_ruin_pagoda', 16, 66, ok=OKG, vis=False): keep_visible('fld_ruin_pagoda', 16, 66, up=4, side=2)
pw(20, 70)
for (nm, x, y) in (('fld_grave_a', 8, 73), ('fld_grave_b', 13, 73), ('fld_grave_a', 9, 79), ('fld_grave_b', 14, 80), ('fld_tombstone', 19, 76), ('fld_cairn', 24, 71)):
    if put(nm, x, y, ok=OKG, vis=False): keep_visible(nm, x, y, up=3, side=1)
pw(10, 77)
put('fld_dead_a', 5, 68, ok=OKG); put('fld_dead_b', 27, 66, ok=OKG); put('fld_dead_a', 21, 84, ok=OKG)
# --- 늪 끝 표지
put('fld_signpost', 93, 82, ok=(None, 'forest'), vis=False); put('fld_bones_b', 90, 83, ok=(None, 'forest'), vis=False); pw(92, 82)
# --- 앞마당 광석 노두(갱도 입구 곁)
put('fld_ore_a', 12, 47, ok=('yard',), vis=False)
put('fld_ore_b', 17, 48, ok=(None, 'yard'), vis=False)

# 사람(사냥꾼): 어귀·앞마당·야영지·쉼터
for (x, y, ch, d, fr) in ((44, 20, 0, PP.RIGHT, 1), (51, 21, 3, PP.LEFT, 0), (14, 48, 5, PP.UP, 1), (46, 74, 2, PP.RIGHT, 1), (50, 69, 6, PP.FRONT, 0), (52, 77, 1, PP.LEFT, 2), (78, 41, 4, PP.UP, 1)):
    PEOPLE.append((x, y, ch, d, fr))
if STAGE <= 2:
    stage_png('a'); sys.exit(0)

# ================================================================ 3단계: 나무
ZEL = ['zelkova_' + c for c in 'abcdefghij'] + ['fld_zelkova_' + c for c in 'abcd']
PIN = ['pine_' + c for c in 'abcdef'] + ['fld_pine_' + c for c in 'abcd']
MID = ['persimmon_' + c for c in 'abcdef'] + ['small_z_a', 'small_z_b', 'small_p']
BUSH = ['bush_a', 'bush_b', 'bush_c', 'bush_d', 'bush_e', 'bush_f', 'bush_l_a', 'bush_l_b', 'bush_l_c', 'bush_l_d', 'bush_s_a', 'bush_s_b', 'bush_s_c', 'bush_s_d']
TREEPOS = []        # (이름, x, y) 왼쪽 위


def tree_name_ok(nm, x, y):
    if nm.startswith(('bush', 'fld_bush')):
        return True
    for (n2, x2, y2) in TREEPOS:
        if n2 == nm and abs(x2 - x) <= 6 and abs(y2 - y) <= 6:      # 지도 게이트 M4: 같은 나무가 6칸 안에 둘이면 FAIL
            return False
    return True


def near_trunk(nm, x, y, dx=2, dy=2):
    """이미 놓은 나무 몸통(맨 아래 줄)과 너무 붙지 않게."""
    w, h = kit.objects[nm].w // T, kit.objects[nm].h // T
    for (n2, x2, y2) in TREEPOS:
        if n2.startswith('bush'): continue
        h2 = kit.objects[n2].h // T
        if abs((y + h) - (y2 + h2)) <= dy and abs((x + w / 2.0) - (x2 + kit.objects[n2].w // T / 2.0)) < dx + 1.6:
            return True
    return False


def grow(region, names, tries, ok=OKG, conn=True, seed=0, passes=6, dx=2, dy=2):
    """region 의 칸을 발 자리로 삼아 나무를 심는다. 같은 칸을 이름만 바꿔 passes 번 시도하므로 촘촘한 숲도 나온다."""
    rg = random.Random(seed)
    base = sorted(region)
    n = 0
    for _p in range(passes):
        cand = list(base)
        rg.shuffle(cand)
        for (cx, cy) in cand[:tries]:
            nm = rg.choice(names)
            cv = kit.objects[nm]
            w, h = cv.w // T, cv.h // T
            x, y = cx - w // 2, cy - h + 1
            if not tree_name_ok(nm, x, y) or near_trunk(nm, x, y, dx, dy):
                continue
            if put(nm, x, y, ok=ok, conn=conn):
                TREEPOS.append((nm, x, y)); n += 1
    return n


FOR_BOT = {c for c in FOREST if KG[c[1]][c[0]] == 'forest'}
n1 = grow({c for c in FOR_BOT if c[1] >= 12}, ZEL + PIN + MID, 9000, seed=1, passes=8)
for (nm, x, y) in (('fld_grove_broad', 86, 20), ('fld_grove_pine', 70, 52), ('fld_grove_broad', 87, 48), ('fld_grove_pine', 88, 28)):
    if put(nm, x, y, ok=OKG, conn=True): TREEPOS.append((nm, x, y))
n2 = grow({c for c in FOR_BOT if c[1] >= 8}, MID, 4000, seed=2)
print('숲 나무', n1, n2)
if STAGE <= 3:
    stage_png('b'); sys.exit(0)

# ================================================================ 4단계: 소품 · 가장자리 나무
PROPPOS = []


def line_hit(nm, x, y):
    S_ = {(a, b) for (n, a, b) in PROPPOS if n == nm}
    for dx, dy in ((1, 0), (0, 1), (1, 1), (1, -1)):
        for g in range(1, 8):
            for k in (-2, -1, 1):
                p0 = (x + dx * g * k, y + dy * g * k)
                if p0 in S_ and (p0[0] + dx * g, p0[1] + dy * g) in S_ and (p0[0] + 2 * dx * g, p0[1] + 2 * dy * g) in S_:
                    return True
    return False


def prop_ok(nm, x, y, gap):
    """같은 소품은 gap 칸 이상 떨어지고, 다른 소품은 2칸 이상(겹침 방지). 같은 소품 셋이 등간격 일렬이 되는 자리는 거른다."""
    for (n, a, b) in PROPPOS:
        g = gap if n == nm else 2
        if abs(a - x) < g and abs(b - y) < g:
            return False
    return not line_hit(nm, x, y)


def scatter(names, region, n, ok=OKG, gap=3, seed=0, conn=True, vis=True, tries=4000, weights=None):
    rg = random.Random(seed)
    cand = sorted(region)
    rg.shuffle(cand)
    done = 0
    for (cx, cy) in cand[:tries]:
        if done >= n: break
        nm = rg.choices(names, weights=weights)[0] if weights else rg.choice(names)
        cv = kit.objects[nm]
        w, h = cv.w // T, cv.h // T
        x, y = cx - w // 2, cy - h + 1
        if not prop_ok(nm, x, y, gap):
            continue
        if is_tree(nm) and not tree_name_ok(nm, x, y):
            continue
        if put(nm, x, y, ok=ok, conn=conn, vis=vis):
            PROPPOS.append((nm, x, y)); done += 1
            if is_tree(nm): TREEPOS.append((nm, x, y))
    return done


def kcells(*kinds, x0=0, y0=0, x1=MW - 1, y1=MH - 1):
    return {(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1) if KG[y][x] in kinds and (x, y) not in kit.DRAWN}


def near_trail(cs, r):
    out = set()
    for (x, y) in cs:
        if any((x + dx, y + dy) in VIS for dx in range(-r, r + 1) for dy in range(-r, r + 1)):
            out.add((x, y))
    return out


LOG = {}
# --- 바위산 위: 큰 바위·돌탑·광석·고목(윗면은 막힘이라 걸림 없음)
RK = kcells('rock')
LOG['mass'] = scatter(['fld_boulder_mass'], RK, 4, ok=('rock',), gap=9, seed=21, conn=False, vis=False)
LOG['rl'] = scatter(['fld_rock_l_a', 'fld_rock_l_b'], RK, 8, ok=('rock',), gap=5, seed=22, conn=False, vis=False)
LOG['rm'] = scatter(['fld_rock_m_a', 'fld_rock_m_b'], RK, 12, ok=('rock',), gap=4, seed=23, conn=False, vis=False)
LOG['rs'] = scatter(['fld_rock_s_a', 'fld_rock_s_b', 'fld_rock_s_c'], RK, 16, ok=('rock',), gap=3, seed=24, conn=False, vis=False)
LOG['cairn'] = scatter(['fld_cairn'], RK, 3, ok=('rock',), gap=8, seed=25, conn=False, vis=False)
LOG['ore'] = scatter(['fld_ore_a', 'fld_ore_b'], RK, 4, ok=('rock',), gap=7, seed=26, conn=False, vis=False)

# --- 가장자리 나무: 북쪽 띠(어귀 길 둘레는 비운다)·서쪽·남쪽·바위산 북쪽 발치
ALLT = ZEL + PIN
north = {(x, y) for y in range(0, 10) for x in range(0, MW) if not (40 <= x <= 56) and KG[y][x] is None}
foot = {(x, y) for y in range(10, 22) for x in range(0, 41) if KG[y][x] is None}
westedge = {(x, y) for y in range(46, MH) for x in range(0, 5) if KG[y][x] is None}
south = {(x, y) for y in range(86, MH) for x in range(0, MW) if KG[y][x] is None}
LOG['t_north'] = grow(north, ALLT + MID, 6000, seed=31)
LOG['t_foot'] = grow(foot, ALLT + MID, 2500, seed=32, passes=3)
LOG['t_west'] = grow(westedge, ALLT, 2500, seed=33)
LOG['t_south'] = grow(south, ALLT + MID, 4000, seed=34)
LOG['t_mid'] = grow({(x, y) for (x, y) in kcells(None, 'tall', x0=26, y0=24, x1=66, y1=60) if (x, y) not in near_trail({(x, y)}, 2)}, ZEL + PIN + MID, 90, seed=35, passes=1)

# --- 초원: 바위·꽃·덤불·뼈·짐승굴
MEAD = kcells(None, 'tall', x0=24, y0=22, x1=68, y1=62)
NT = near_trail(MEAD, 3)
LOG['m_rl'] = scatter(['fld_rock_l_a', 'fld_rock_l_b', 'fld_rock_m_b'], MEAD, 5, gap=8, seed=41)
LOG['m_rm'] = scatter(['fld_rock_m_a', 'fld_rock_m_b'], MEAD, 8, gap=5, seed=42)
LOG['m_rs'] = scatter(['fld_rock_s_a', 'fld_rock_s_b', 'fld_rock_s_c'], MEAD, 16, gap=4, seed=43)
LOG['m_fl'] = scatter(['fld_flowers_a', 'fld_flowers_b', 'fld_flowers_c'], NT, 26, gap=4, seed=44)
LOG['m_fl2'] = scatter(['fld_flowers_a', 'fld_flowers_b', 'fld_flowers_c'], MEAD, 16, gap=5, seed=45)
LOG['m_bu'] = scatter(['fld_bush_flower_a', 'fld_bush_flower_b', 'fld_bush_berry'] + BUSH, MEAD, 22, gap=4, seed=46)
TALLC = kcells('tall')
TALLNEAR = {(x + dx, y + dy) for (x, y) in TALLC for dx in range(-3, 4) for dy in range(-3, 4)}
LOG['m_bur'] = scatter(['fld_burrow'], TALLNEAR & MEAD, 6, gap=9, seed=47)
LOG['m_bone'] = scatter(['fld_bones_a', 'fld_bones_b'], TALLNEAR & MEAD, 6, gap=8, seed=48)
LOG['m_stump'] = scatter(['fld_stump_a', 'fld_stump_b', 'fld_log_a', 'fld_log_b'], MEAD, 4, gap=9, seed=49)

# --- 숲: 고사리·그루터기·통나무·덤불
FORC = kcells('forest')
LOG['f_fern'] = scatter(['fld_fern'], FORC, 26, gap=3, seed=51)
LOG['f_stump'] = scatter(['fld_stump_a', 'fld_stump_b', 'fld_log_a', 'fld_log_b'], FORC, 8, gap=7, seed=52)
LOG['f_bush'] = scatter(BUSH, FORC, 14, gap=4, seed=53)
LOG['f_dead'] = scatter(['fld_dead_a', 'fld_dead_b'], FORC, 4, gap=10, seed=54)
LOG['f_bone'] = scatter(['fld_bones_a', 'fld_bones_b'], FORC, 3, gap=12, seed=55)

# --- 바위산 앞마당·폐허·야영지 둘레·늪가
foot2 = kcells(None, x0=0, y0=48, x1=34, y1=62)
LOG['a_rock'] = scatter(['fld_rock_m_a', 'fld_rock_s_a', 'fld_rock_s_b', 'fld_rock_l_a'], foot2, 6, gap=5, seed=61)
LOG['a_bush'] = scatter(BUSH + ['fld_bush_berry'], foot2, 6, gap=4, seed=62)
ruin = kcells(None, 'tall', x0=4, y0=62, x1=32, y1=90)
LOG['r_dead'] = scatter(['fld_dead_a', 'fld_dead_b'], ruin, 3, gap=8, seed=63)
LOG['r_rock'] = scatter(['fld_rock_s_a', 'fld_rock_s_b', 'fld_rock_s_c', 'fld_rock_m_a'], ruin, 9, gap=4, seed=64)
LOG['r_bush'] = scatter(BUSH, ruin, 8, gap=4, seed=65)
LOG['r_fl'] = scatter(['fld_flowers_a', 'fld_flowers_c'], ruin, 6, gap=4, seed=66)
LOG['r_pine'] = scatter(PIN, ruin, 4, gap=9, seed=67)
camp = kcells(None, 'tall', x0=34, y0=62, x1=64, y1=84)
LOG['c_rock'] = scatter(['fld_rock_s_a', 'fld_rock_s_b', 'fld_rock_s_c'], camp, 6, gap=4, seed=71)
LOG['c_bush'] = scatter(BUSH, camp, 9, gap=4, seed=72)
LOG['c_tree'] = scatter(ZEL + MID, camp, 5, gap=9, seed=73)
LOG['c_fl'] = scatter(['fld_flowers_a', 'fld_flowers_b', 'fld_flowers_c'], camp, 8, gap=4, seed=74)
bogrim = kcells(None, 'forest', x0=56, y0=68, x1=95, y1=94)
LOG['b_tree'] = scatter(PIN + ZEL + MID, bogrim, 22, gap=6, seed=75)
LOG['b_rock'] = scatter(['fld_rock_s_a', 'fld_rock_s_b', 'fld_rock_m_a'], bogrim, 8, gap=4, seed=76)
LOG['b_bush'] = scatter(BUSH, bogrim, 10, gap=4, seed=77)
print('소품·나무', LOG)
if STAGE <= 4:
    stage_png('c'); sys.exit(0)

# ================================================================ 5단계: 빈 땅 메우기(물체가 아니라 지형으로) · 사람 · 스폰
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
    for lst in (TREEPOS, PROPPOS):
        if (name, x, y) in lst: lst.remove((name, x, y))


def fill_plain(rounds=40):
    """10×10 칸이 전부 평범한 풀(물체 그림도 없음)인 빈 광장을 지운다: 그 창의 가운데에 키 큰 풀 덩이(스폰 자리가 되는 땅)를 깔고 곁에 바위·꽃을 얹는다."""
    for r in range(rounds):
        bad = FM.audit_plain(kit, 10)
        if not bad:
            return r
        x, y = bad[len(bad) // 2]
        cx, cy = x + 5, y + 5
        for (px, py) in blob(cx, cy, 3.6, 2.8, 90 + r, 0.3):
            if KG[py][px] is None and (px, py) not in kit.DRAWN: KG[py][px] = 'tall'
        for nm, ddx, ddy in (('fld_rock_m_a', -4, 2), ('fld_flowers_b', 4, -2), ('fld_bush_berry', 1, 4), ('fld_rock_s_b', -2, -4)):
            if put(nm, cx + ddx, cy + ddy, ok=OKG, conn=True):
                PROPPOS.append((nm, cx + ddx, cy + ddy))
    return rounds


print('빈 땅 메움 라운드', fill_plain())


# 맨 잔디 창(지도 게이트 M1: 20×15칸 창에서 40% 이하) 완화: 작은 소품(꽃·잔돌)은 칸을 덮지 못하므로 창이 넘치면 그 창의 맨 잔디 무게중심에 키 큰 풀 덩이를 깐다
SMALLP = ('fld_flowers', 'fld_fern', 'fld_rock_s', 'fld_burrow', 'fld_bones', 'fld_stump', 'fld_cairn', 'fld_ore', 'fld_signpost')


def bare_grid():
    B = np.zeros((MH, MW), bool)
    for y in range(MH):
        for x in range(MW):
            if KG[y][x] is None:
                d = kit.DRAWN.get((x, y), [])
                B[y, x] = all(nm.startswith(SMALLP) for (nm, _c) in d)
    return B


def relieve_lawn(limit=0.27, rounds=260):
    for r in range(rounds):
        B = bare_grid()
        ii = np.pad(B.astype(np.int32).cumsum(0).cumsum(1), ((1, 0), (1, 0)))
        best = (0, 0, 0)
        for y in range(0, MH - 15 + 1):
            for x in range(0, MW - 20 + 1):
                v = ii[y + 15, x + 20] - ii[y, x + 20] - ii[y + 15, x] + ii[y, x]
                if v > best[0]: best = (v, x, y)
        v, x, y = best
        if v / 300.0 <= limit:
            return r, round(v / 300.0, 3)
        ys, xs = np.nonzero(B[y:y + 15, x:x + 20])
        rg = random.Random(700 + r)
        k = rg.randrange(len(xs))                      # 무게중심 대신 맨 칸 하나를 골라 그 둘레에 깐다(같은 자리 반복 방지)
        cx, cy = x + int(xs[k]), y + int(ys[k])
        for (px, py) in blob(cx, cy, 2.4 + rg.random() * 2.2, 1.9 + rg.random() * 1.6, 800 + r, 0.4):
            if KG[py][px] is None: KG[py][px] = 'tall'
    return rounds, None


print('맨 잔디 창 완화', relieve_lawn())

# 지도 위 점검에서 걸리는 줄 심기: 같은 소품 셋 일렬 · 나무 셋 일렬(축·대각 등간격)은 가운데를 뽑는다
def fix_lines():
    removed = 0
    for _ in range(12):
        bad = FM.audit_line3(kit.placed)
        if not bad:
            break
        # (이름, (x, y) 시작점, (dx, dy)) → 가운데 점을 뽑는다
        for (n, (x, y), (dx, dy)) in bad:
            if n == 'tree':
                mid = (x + dx, y + dy)
                for (nm, px, py, pw_, ph_) in list(kit.placed):
                    if is_tree(nm) and not is_bush(nm) and (px, py + ph_ - 1) == mid:
                        remove_item(nm, px, py); removed += 1; break
            else:
                mid = (x + dx, y + dy)
                for (nm, px, py, pw_, ph_) in list(kit.placed):
                    if nm == n and (px, py + ph_ - 1) == mid:
                        remove_item(nm, px, py); removed += 1; break
    return removed


print('줄 심기 뽑음', fix_lines())

# 사냥터 스폰(몬스터 이벤트 자리): 종류별로 간격을 두고 걸을 수 있는 칸에
SP = []


def add_spawns(kind, cells, n, gap, seed):
    rg = random.Random(seed)
    cs = sorted(c for c in cells if kit.walkable(*c) and c not in kit.DRAWN and c not in VIS)
    rg.shuffle(cs)
    k = 0
    for (x, y) in cs:
        if k >= n: break
        if any(abs(x - a['x']) + abs(y - a['y']) < gap for a in kit.SPAWNS):
            continue
        kit.SPAWNS.append({'x': x, 'y': y, 'zone': kind}); k += 1
    return k


print('스폰', add_spawns('meadow', {c for c in kcells('tall') if 24 <= c[0] <= 68}, 8, 8, 1), add_spawns('forest', kcells('forest'), 7, 9, 2),
      add_spawns('swamp', {(x + dx, y + dy) for (x, y) in kcells('bog') for dx in range(-2, 3) for dy in range(-2, 3)} - kcells('bog'), 4, 10, 3),
      add_spawns('ruin', kcells(None, 'tall', x0=4, y0=62, x1=32, y1=90), 4, 8, 4), add_spawns('foot', kcells(None, 'yard', x0=0, y0=46, x1=34, y1=62), 2, 10, 5))
for a in kit.SPAWNS:
    pw(a['x'], a['y'])
for (x, y) in ((36, 31), (58, 31), (38, 54), (58, 55), (20, 70), (10, 77)):
    pw(x, y)
if STAGE <= 5:
    stage_png('d'); sys.exit(0)

# ================================================================ 6단계: 자동 점검 단언 → 굽기
CAVEF = {(c[0], c[1]) for c in CAVE_F}


def audit_all():
    """굽기 직전 점검. 하나라도 걸리면 굽지 않는다. 반환: 문제 목록(빈 목록이면 통과)."""
    probs = []
    walk = total_walk()
    seen = kit.reach(START)
    # 1) 모든 걸을 칸이 어귀에서 닿는다(끊긴 길·외톨이 땅 없음) + 출구·굴 앞 칸 도달
    iso = FM.audit_unreachable_walk(kit, seen)
    if iso: probs.append('어귀에서 못 닿는 걸을 칸 덩어리 %d개: %s' % (len(iso), iso[:5]))
    for nm, (x, y) in (('북 출구', (47, 0)), ('남 출구', (47, 95)), ('북 출구 끝', (49, 0))):
        if (x, y) not in seen: probs.append(nm + ' 못 닿음 %s' % ((x, y),))
    for (x, y, nm) in CAVE_F:
        if (x, y) not in seen: probs.append('굴 입구 앞 칸 못 닿음 %s %s' % (nm, (x, y)))
        # 입구 앞에 걸을 칸이 3줄 이상(문 앞 아래 3칸)
        if sum(1 for k in range(1, 4) if kit.walkable(x, y + k)) < 3: probs.append('굴 입구 앞 걸을 칸 부족 %s' % ((x, y),))
    for d in kit.DOORS:
        if (d['x'], d['y']) not in seen: probs.append('문 앞 칸 못 닿음 %s' % d)
    # 2) 막다른 길 없음(길 끝은 앵커 곁이어야 한다)
    de = FM.audit_deadends(kit, ('trail', 'road', 'yard', 'slab'), ANCH)
    if de: probs.append('막다른 길 %d: %s' % (len(de), de[:8]))
    # 3) 같은 소품·나무 셋 일렬 금지
    ln = FM.audit_line3(kit.placed)
    if ln: probs.append('셋 일렬 %d: %s' % (len(ln), ln[:4]))
    # 4) 10×10 완전 빈 땅 금지
    pl = FM.audit_plain(kit, 10)
    if pl: probs.append('10×10 빈 광장 %d: %s' % (len(pl), pl[:4]))
    # 5) 길은 어디론가 이어진다: 짐승길 덩어리마다 목적(앵커·마당·출구·다른 길)에 닿는다 — 도달성 + 막다른 길 점검이 이미 보장. 마스크 일관은 아래.
    gr = ground_ids()
    inv = {}
    for g, v in kit.pieces.items():
        for k, t in enumerate(v['tiles']): inv[t] = (g, k)
    fam = {k: kit.cells_of(k) for k in ('trail', 'bog', 'rock', 'face0', 'face1', 'tall', 'forest')}
    dirtc = kit.cells_of('road', 'yard', 'slab', 'trail')
    bad_mask = []
    for y in range(MH):
        for x in range(MW):
            g, k = inv.get(gr[y][x], (None, 0))
            if g == 'fld_trail32' and (k & 15) != kit.mask4(dirtc, x, y): bad_mask.append(('trail', x, y))
            if g == 'fld_tall32' and (k & 15) != kit.mask4(fam['tall'], x, y): bad_mask.append(('tall', x, y))
            if g == 'fld_forest32' and (k & 15) != kit.mask4(fam['forest'], x, y): bad_mask.append(('forest', x, y))
            if g == 'fld_bog94':
                m8 = 0
                for bit, (dx, dy) in ((WB.N, (0, -1)), (WB.E, (1, 0)), (WB.S, (0, 1)), (WB.W, (-1, 0)), (WB.NE, (1, -1)), (WB.SE, (1, 1)), (WB.SW, (-1, 1)), (WB.NW, (-1, -1))):
                    if (x + dx, y + dy) in fam['bog']: m8 |= bit
                if k % 47 != WB.index47(m8): bad_mask.append(('bog', x, y))
    # 절벽 이음: 앞면 윗줄 위는 바위, 아랫줄 위는 윗줄, 아랫줄 아래는 바위·앞면이 아니다(벽 두께 정확히 2줄). 바위 아래는 바위나 앞면 윗줄.
    for (x, y) in fam['face0']:
        if (x, y - 1) not in fam['rock']: bad_mask.append(('face0 위가 바위 아님', x, y))
        if (x, y + 1) not in fam['face1'] and (x, y + 1) not in CAVEF: bad_mask.append(('face0 아래가 face1 아님', x, y))
    for (x, y) in fam['face1']:
        if (x, y - 1) not in fam['face0']: bad_mask.append(('face1 위가 face0 아님', x, y))
        if (x, y + 1) in fam['rock'] or (x, y + 1) in fam['face0']: bad_mask.append(('face1 아래가 벽·바위', x, y))
    for (x, y) in fam['rock']:
        if (x, y + 1) not in fam['rock'] and (x, y + 1) not in fam['face0']: bad_mask.append(('바위 아래 앞면 없음', x, y))
    if bad_mask: probs.append('이음 마스크 불일치 %d: %s' % (len(bad_mask), bad_mask[:6]))
    # 6) 사람은 걸을 칸에, 머리 칸도 막힌 몸체가 아니게
    for p in PEOPLE:
        if not kit.walkable(p[0], p[1]) or (p[0], p[1] - 1) in kit.HARD or (p[0], p[1]) in VIS and False:
            probs.append('사람 자리 불량 %s' % (p[:2],))
    # 7) 스폰은 걸을 칸
    for a in kit.SPAWNS:
        if not kit.walkable(a['x'], a['y']): probs.append('스폰 자리 불량 %s' % a)
    return probs, len(walk), len(seen)


PR, NW, NR = audit_all()
print('자동 점검', '모두 통과' if not PR else PR, '| 걸을 수 있는 칸 %d, 어귀에서 닿는 칸 %d' % (NW, NR))
if PR and not os.environ.get('JS_FORCE'):
    print('자동 점검 FAIL — 굽지 않는다(JS_FORCE=1 로 무시)'); sys.exit(1)
if STAGE <= 6:
    stage_png('e'); sys.exit(0)

direct, rep = kit.bake(ground_ids(), 'field', people_overlay=PP.overlay,
                       ground_kind_map={'trail': 'road', 'tall': 'grass', 'forest': 'grass', 'bog': 'water', 'rock': 'wall', 'face0': 'wall', 'face1': 'wall'},
                       extra_fields={'spawnZones': {k: sum(1 for a in kit.SPAWNS if a['zone'] == k) for k in ('meadow', 'forest', 'swamp', 'ruin', 'foot')},
                                     'audit': {'walkable': NW, 'reachableFromStart': NR, 'start': list(START)}})
print('굽기 끝', json.dumps(rep, ensure_ascii=False))
