"""사냥터 `joseon_field`(96×96) 맵 빌더 — 계획은 tiledata/joseon-field/PLAN.md.

    python3 fa_demo_field.py            # tiledata/joseon-field/ 에 굽는다(JS_OUT 으로 다른 폴더, JS_FORCE=1 은 점검 실패 무시)
    JS_STAGE=1..4                       # 단계까지만 놓고 /tmp/fa/field_stage.png (지형 → 길·앵커 → 나무 → 소품)

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
R = random.Random(int(os.environ.get('JS_SEED', '11')))
kit = Kit(MW, MH, 'fa_field', OUT, 'joseon-field')
tr_ = kit.terr
FACEG = 'fld_face32' if 'fld_face32' in tr_ else 'fld_face16'     # 앞면 묶음 이름(tier 0 = 땅에 닿는 두 줄이 앞 16칸)
for g in ('grass8', 'road64', 'yard64', 'slab', 'slab_edge16', 'fld_trail32', 'fld_tall32', 'fld_forest32', 'fld_bog94', 'fld_rock32', FACEG):
    kit.add_group(g, tr_[g])
GID = {g: kit.gid(g) for g in kit.pieces}
KG = kit.KG
inb = kit.inb
WALKK = ('road', 'yard', 'slab', 'trail', 'tall', 'forest', None)
SOLIDK = ('rock', 'face0', 'face1', 'bog')
VIS = set()          # 길·마당·문 앞: 물체(수관 포함)가 가리면 안 되는 칸
ANCH = []            # 막다른 길이 끝나도 되는 목적 칸
PEOPLE = kit.PEOPLE


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
# --- 서쪽 바위산(윗면 + 앞면 2줄). 열마다 위·아래 높이가 달라 윤곽이 울퉁불퉁하고, 굴 입구 자리(x4..22)는 바닥선이 평평하다.
ROCK = set()
for x in range(0, 25):                                   # 아랫단(큰 고원): 높이 10줄 안팎, 굴 입구 자리(x4..22)는 바닥선이 평평
    yt = 34 + (hsh(x // 3, 1, 3) % 3)
    yb = 43 if 4 <= x <= 22 else (40 if x < 4 else 41)
    for y in range(yt, yb + 1):
        ROCK.add((x, y))
for x in range(5, 19):                                   # 윗단 봉우리(앞면이 따로 선다)
    yt = 22 + (hsh(x // 2, 2, 3) % 3) + (2 if x < 7 or x > 16 else 0)
    for y in range(yt, 31):
        ROCK.add((x, y))
for x in range(24, 31):                                  # 동쪽 곁봉우리
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
YARD_TOP = set()
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
# --- 바위산 앞마당(굴 앞): 두 줄
for y in (46, 47):
    for x in range(5, 31): KG[y][x] = 'yard'


def trail(points, kind='trail', seed=0):
    """웨이포인트를 4방향으로 잇는 1칸 폭 길. 한 번에 2~5칸씩 꺾어 가며 간다."""
    rg = random.Random(seed)
    cells = []
    x, y = points[0]
    for (tx, ty) in points[1:]:
        while (x, y) != (tx, ty):
            dx, dy = tx - x, ty - y
            if dx and dy:
                horiz = rg.random() < (abs(dx) / float(abs(dx) + abs(dy)))
            else:
                horiz = bool(dx)
            n = rg.randint(2, 5)
            for _ in range(n):
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


TRAILS = {}


def widen(cells, dx, dy):
    for (x, y) in cells:
        X, Y = x + dx, y + dy
        if inb(X, Y) and KG[Y][X] in (None, 'tall', 'forest'):
            KG[Y][X] = 'trail'


TRAILS['W'] = trail([(41, 20), (35, 20), (35, 27), (34, 38), (32, 45), (31, 46)], seed=3)       # 어귀 → 바위산 앞마당
TRAILS['A'] = trail([(31, 47), (38, 47), (38, 52), (47, 52)], seed=4)                                      # 앞마당 → 초원 줄기길
TRAILS['S'] = trail([(47, 23), (47, 30), (46, 37), (47, 44), (47, 52), (47, 58), (47, 63)], seed=5)       # 어귀 → 야영지
TRAILS['S2'] = trail([(48, 78), (48, 86), (47, 91), (47, 95)], seed=6)                                      # 야영지 → 남쪽 출구
TRAILS['E'] = trail([(54, 20), (62, 20), (62, 24), (70, 24), (72, 30), (76, 34)], seed=7)                 # 어귀 → 숲 쉼터
TRAILS['F'] = trail([(80, 43), (80, 52), (79, 60), (80, 66), (80, 72)], seed=8)                            # 쉼터 → 늪가
TRAILS['SW'] = trail([(57, 72), (66, 72), (80, 72), (88, 72), (92, 72), (92, 82)], seed=9)               # 야영지 → 늪가 → 늪 끝 표지
TRAILS['R'] = trail([(40, 72), (34, 72), (34, 76), (26, 76), (21, 72), (20, 70)], seed=10)                # 야영지 → 폐허
TRAILS['G'] = trail([(26, 76), (18, 79), (12, 79), (10, 77)], seed=11)                                    # 폐허길 → 무덤
TRAILS['P1'] = trail([(47, 31), (41, 31), (36, 31)], seed=12)                                             # 줄기길 → 서쪽 키 큰 풀(스폰)
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


START = (47, 0)
print('막힌 틈 메움', fix_pockets())

# 굴 입구 앞 걸을 칸·출구 칸을 마당(흙)으로: 조각의 F 칸이 단단한 바닥 위에 놓일 수 없으므로 바닥 종류를 먼저 마당으로 바꾼다
MOUTHS = [('fld_cave_a', 6), ('fld_cave_b', 13), ('fld_cave_c', 19)]
CAVE_F = []
for (nm, mx) in MOUTHS:
    rows = kit.rows(nm)
    for j, row in enumerate(rows):
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
    dirt_ry = fam['road'] | fam['yard'] | fam['slab'] | fam['trail']
    mass = fam['rock'] | fam['face0'] | fam['face1']
    gr = [[0] * MW for _ in range(MH)]
    for y in range(MH):
        for x in range(MW):
            k = KG[y][x]
            if k is None:
                gid = GID['grass8'] + (hsh(x, y, 3) % 6 if hsh(x, y, 5) % 12 < 10 else 6 + hsh(x, y, 9) % 2)
            elif k == 'road':
                gid = GID['road64'] + 16 * (hsh(x, y, 41) % 4) + mset(dirt_ry, x, y, True)
            elif k == 'yard':
                gid = GID['yard64'] + 16 * (hsh(x, y, 43) % 4) + mset(dirt_ry, x, y)
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


def cells_of_piece(name, x, y):
    return kit.cells_for(name, x, y)


def vis_hit(name, x, y):
    return any((X, Y) in VIS for (X, Y, ch) in cells_of_piece(name, x, y))


def total_walk():
    return {(x, y) for y in range(MH) for x in range(MW) if kit.walkable(x, y)}


def undo(name, x, y):
    kit.placed.pop(); kit.items.pop()
    for (X, Y, ch) in cells_of_piece(name, x, y):
        kit.DRAWN[(X, Y)].pop()
        if not kit.DRAWN[(X, Y)]: del kit.DRAWN[(X, Y)]
        if ch == 'X': kit.HARD.pop((X, Y), None)




def connected_ok():
    w = total_walk()
    seen = kit.reach(START)
    return len(seen) == len(w)


def put(name, x, y, ok=OKG, vis=True, conn=False, anchor=False, why=False):
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
    res = kit.place(nm, mx, 43, ok_kinds=('rock', 'face0', 'face1', 'yard', None))
    for c in CAVE_F:
        if c[2] == nm:
            kit.DOORS.append({'x': c[0], 'y': c[1] + 1, 'piece': nm})
            kit.EXITS.append({'to': 'joseon_cave', 'x': c[0], 'y': c[1], 'piece': nm})
            pw(c[0], c[1])
kit.EXITS.append({'to': 'gungnae_full', 'side': 'N', 'x0': 46, 'x1': 49, 'y': 0})
kit.EXITS.append({'to': 'next_field', 'side': 'S', 'x0': 47, 'x1': 48, 'y': 95})
pw(47, 95); pw(46, 0); pw(49, 0)

# --- 어귀: 장승 한 쌍 + 이정표 + 돌탑
for nm, x, y in (('jangseung_m', 44, 17), ('jangseung_f', 51, 17)):
    put(nm, x, y, ok=('yard',), vis=False)
put('fld_signpost', 54, 17, ok=('yard',), vis=False)
put('fld_signpost', 31, 44, ok=('yard',), vis=False)      # 앞마당 길목
put('fld_signpost', 48, 93, ok=OKG, vis=False)             # 남쪽 출구
for t in ('W', 'E', 'S'):
    pass

# --- 야영지(남쪽): 모닥불이 중심, 천막 둘·건조대·통나무 의자
CF = (48, 72)
put('fld_campfire', CF[0], CF[1], ok=('yard',), vis=False); pw(CF[0], CF[1] + 1)
put('fld_tent_b', 41, 66, ok=('yard', None), vis=False)
put('fld_tent_a', 53, 66, ok=('yard', None), vis=False)
put('fld_rack', 54, 71, ok=('yard', None), vis=False)
put('fld_log_b', 43, 72, ok=('yard',), vis=False)
put('fld_stump_a', 52, 73, ok=('yard',), vis=False)
put('fld_stump_b', 44, 75, ok=('yard',), vis=False)
put('fld_bones_a', 55, 75, ok=('yard', None), vis=False)

# --- 숲 쉼터(나무꾼): 통나무·그루터기·모닥불
put('fld_campfire', 80, 39, ok=('yard',), vis=False); pw(80, 40)
put('fld_log_a', 74, 40, ok=('yard',), vis=False)
put('fld_stump_a', 77, 36, ok=('yard',), vis=False)
put('fld_stump_b', 84, 37, ok=('yard',), vis=False)
put('fld_log_b', 82, 42, ok=('yard', 'forest'), vis=False)

# --- 폐허·무덤
put('fld_ruin_pagoda', 16, 66, ok=OKG, vis=False); pw(20, 70)
for (nm, x, y) in (('fld_grave_a', 8, 73), ('fld_grave_b', 13, 73), ('fld_grave_a', 9, 79), ('fld_grave_b', 14, 80), ('fld_tombstone', 19, 76), ('fld_cairn', 24, 71)):
    put(nm, x, y, ok=OKG, vis=False)
pw(10, 77)
put('fld_dead_a', 5, 68, ok=OKG); put('fld_dead_b', 27, 66, ok=OKG); put('fld_dead_a', 21, 84, ok=OKG)
# --- 늪 끝 표지
put('fld_signpost', 93, 82, ok=(None, 'forest'), vis=False); put('fld_bones_b', 90, 83, ok=(None, 'forest'), vis=False); pw(92, 82)

# --- 바위산: 큰 바위 덩이·광석 노두(갱도 입구 곁)·돌탑
put('fld_boulder_mass', 22, 40, ok=('rock', 'face0', None, 'yard'), vis=False) if False else None
put('fld_ore_a', 12, 47, ok=('yard',), vis=False)
put('fld_ore_b', 17, 48, ok=(None, 'yard'), vis=False)
put('fld_cairn', 23, 48, ok=(None, 'yard'), vis=False)

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
        if n2 == nm and abs(x2 - x) <= 6 and abs(y2 - y) <= 6:
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


def grow(region, names, tries, ok=OKG, conn=True, seed=0, shuffle=True, dens=None):
    rg = random.Random(seed)
    cand = sorted(region)
    rg.shuffle(cand)
    n = 0
    for (cx, cy) in cand[:tries]:
        nm = rg.choice(names)
        cv = kit.objects[nm]
        w, h = cv.w // T, cv.h // T
        x, y = cx - w // 2, cy - h + 1
        if not tree_name_ok(nm, x, y) or near_trunk(nm, x, y):
            continue
        res = put(nm, x, y, ok=ok, conn=conn)
        if res:
            TREEPOS.append((nm, x, y)); n += 1
    return n


# 동쪽 숲: 낙엽 바닥 위 큰 나무 + 중간 나무, 군락 조각
FOR_BOT = {c for c in FOREST if KG[c[1]][c[0]] == 'forest'}
n1 = grow({c for c in FOR_BOT if c[1] >= 12}, ZEL + PIN, 9000, seed=1)
for (nm, x, y) in ((('fld_grove_broad'), 86, 20), ('fld_grove_pine', 70, 52), ('fld_grove_broad', 87, 48), ('fld_grove_pine', 88, 28)):
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
            for k in (-2, -1, 1):          # 새 점이 3개 등간격 줄의 끝·가운데·시작이 되는가
                p0 = (x + dx * g * k, y + dy * g * k)
                if p0 in S_ and (p0[0] + dx * g, p0[1] + dy * g) in S_ and (p0[0] + 2 * dx * g, p0[1] + 2 * dy * g) in S_:
                    return True
    return False


def prop_ok(nm, x, y, gap):
    for (n, a, b) in PROPPOS:
        if abs(a - x) < gap and abs(b - y) < gap:
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


# --- 바위산 위: 큰 바위·돌탑·광석·고목(윗면은 막힘이라 걸림 없음)
RK = kcells('rock')
log_ = {}
log_['mass'] = scatter(['fld_boulder_mass'], RK, 4, ok=('rock',), gap=9, seed=21, conn=False, vis=False)
log_['rl'] = scatter(['fld_rock_l_a', 'fld_rock_l_b'], RK, 8, ok=('rock',), gap=5, seed=22, conn=False, vis=False)
log_['rm'] = scatter(['fld_rock_m_a', 'fld_rock_m_b'], RK, 12, ok=('rock',), gap=4, seed=23, conn=False, vis=False)
log_['rs'] = scatter(['fld_rock_s_a', 'fld_rock_s_b', 'fld_rock_s_c'], RK, 16, ok=('rock',), gap=3, seed=24, conn=False, vis=False)
log_['cairn'] = scatter(['fld_cairn'], RK, 3, ok=('rock',), gap=8, seed=25, conn=False, vis=False)
log_['ore'] = scatter(['fld_ore_a', 'fld_ore_b'], RK, 4, ok=('rock',), gap=7, seed=26, conn=False, vis=False)
log_['dead_top'] = scatter(['fld_dead_a', 'fld_dead_b'], RK, 3, ok=('rock',), gap=9, seed=27, conn=False, vis=False)

# --- 가장자리 나무: 북쪽 띠(어귀 길 둘레는 비운다)·서쪽·남쪽·바위산 북쪽 발치
ALLT = ZEL + PIN
north = {(x, y) for y in range(0, 10) for x in range(0, MW) if not (40 <= x <= 56) and KG[y][x] is None}
foot = {(x, y) for y in range(10, 22) for x in range(0, 41) if KG[y][x] is None}
westedge = {(x, y) for y in range(46, MH) for x in range(0, 5) if KG[y][x] is None}
south = {(x, y) for y in range(86, MH) for x in range(0, MW) if KG[y][x] is None}
log_['t_north'] = grow(north, ALLT, 6000, seed=31)
log_['t_foot'] = grow(foot, ALLT + MID, 2500, seed=32)
log_['t_west'] = grow(westedge, ALLT, 2500, seed=33)
log_['t_south'] = grow(south, ALLT, 4000, seed=34)
log_['t_mid'] = grow({(x, y) for (x, y) in kcells(None, 'tall', x0=26, y0=24, x1=66, y1=60) if (x, y) not in near_trail({(x, y)}, 2)}, ZEL + PIN + MID, 90, seed=35)

# --- 초원: 바위·꽃·덤불·뼈·짐승굴
MEAD = kcells(None, 'tall', x0=24, y0=22, x1=68, y1=62)
NT = near_trail(MEAD, 3)
log_['m_rl'] = scatter(['fld_rock_l_a', 'fld_rock_l_b', 'fld_rock_m_b'], MEAD, 5, gap=8, seed=41)
log_['m_rm'] = scatter(['fld_rock_m_a', 'fld_rock_m_b'], MEAD, 8, gap=5, seed=42)
log_['m_rs'] = scatter(['fld_rock_s_a', 'fld_rock_s_b', 'fld_rock_s_c'], MEAD, 16, gap=4, seed=43)
log_['m_fl'] = scatter(['fld_flowers_a', 'fld_flowers_b', 'fld_flowers_c'], NT, 26, gap=4, seed=44)
log_['m_fl2'] = scatter(['fld_flowers_a', 'fld_flowers_b', 'fld_flowers_c'], MEAD, 16, gap=5, seed=45)
log_['m_bu'] = scatter(['fld_bush_flower_a', 'fld_bush_flower_b', 'fld_bush_berry'] + BUSH, MEAD, 22, gap=4, seed=46)
TALLC = kcells('tall')
log_['m_bur'] = scatter(['fld_burrow'], near_trail(MEAD, 6) & {(x + dx, y + dy) for (x, y) in TALLC for dx in range(-3, 4) for dy in range(-3, 4)}, 6, gap=9, seed=47)
log_['m_bone'] = scatter(['fld_bones_a', 'fld_bones_b'], {(x + dx, y + dy) for (x, y) in TALLC for dx in range(-4, 5) for dy in range(-4, 5)} & MEAD, 6, gap=8, seed=48)
log_['m_stump'] = scatter(['fld_stump_a', 'fld_stump_b', 'fld_log_a', 'fld_log_b'], MEAD, 4, gap=9, seed=49)

# --- 숲: 고사리·그루터기·통나무·덤불
FORC = kcells('forest')
log_['f_fern'] = scatter(['fld_fern'], FORC, 26, gap=3, seed=51)
log_['f_stump'] = scatter(['fld_stump_a', 'fld_stump_b', 'fld_log_a', 'fld_log_b'], FORC, 8, gap=7, seed=52)
log_['f_bush'] = scatter(BUSH, FORC, 14, gap=4, seed=53)
log_['f_dead'] = scatter(['fld_dead_a', 'fld_dead_b'], FORC, 4, gap=10, seed=54)
log_['f_bone'] = scatter(['fld_bones_a', 'fld_bones_b'], FORC, 3, gap=12, seed=55)

# --- 바위산 앞마당·폐허·야영지 둘레·늪가
foot2 = kcells(None, x0=0, y0=48, x1=34, y1=62)
log_['a_rock'] = scatter(['fld_rock_m_a', 'fld_rock_s_a', 'fld_rock_s_b', 'fld_rock_l_a'], foot2, 6, gap=5, seed=61)
log_['a_bush'] = scatter(BUSH + ['fld_bush_berry'], foot2, 6, gap=4, seed=62)
ruin = kcells(None, 'tall', x0=4, y0=62, x1=32, y1=90)
log_['r_dead'] = scatter(['fld_dead_a', 'fld_dead_b'], ruin, 3, gap=8, seed=63)
log_['r_rock'] = scatter(['fld_rock_s_a', 'fld_rock_s_b', 'fld_rock_s_c', 'fld_rock_m_a'], ruin, 9, gap=4, seed=64)
log_['r_bush'] = scatter(BUSH, ruin, 8, gap=4, seed=65)
log_['r_fl'] = scatter(['fld_flowers_a', 'fld_flowers_c'], ruin, 6, gap=4, seed=66)
log_['r_pine'] = scatter(PIN, ruin, 4, gap=9, seed=67)
camp = kcells(None, 'tall', x0=34, y0=62, x1=64, y1=84)
log_['c_rock'] = scatter(['fld_rock_s_a', 'fld_rock_s_b', 'fld_rock_s_c'], camp, 6, gap=4, seed=71)
log_['c_bush'] = scatter(BUSH, camp, 9, gap=4, seed=72)
log_['c_tree'] = scatter(ZEL + MID, camp, 5, gap=9, seed=73)
log_['c_fl'] = scatter(['fld_flowers_a', 'fld_flowers_b', 'fld_flowers_c'], camp, 8, gap=4, seed=74)
bogrim = kcells(None, 'forest', x0=56, y0=68, x1=95, y1=94)
log_['b_tree'] = scatter(PIN + ZEL + MID, bogrim, 22, gap=6, seed=75)
log_['b_rock'] = scatter(['fld_rock_s_a', 'fld_rock_s_b', 'fld_rock_m_a'], bogrim, 8, gap=4, seed=76)
log_['b_bush'] = scatter(BUSH, bogrim, 10, gap=4, seed=77)
log_['b_dead'] = scatter(['fld_dead_a', 'fld_dead_b'], bogrim, 2, gap=10, seed=78)
print('소품·나무', log_)
if STAGE <= 4:
    stage_png('c'); sys.exit(0)
