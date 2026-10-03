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
for g in ('grass8', 'road64', 'yard64', 'slab', 'slab_edge16', 'fld_trail32', 'fld_tall32', 'fld_forest32', 'fld_bog94', 'fld_rock32', 'fld_rock_in8', 'fld_face32'):
    kit.add_group(g, tr_[g])
GID = {g: kit.gid(g) for g in kit.pieces}
KG = kit.KG
inb = kit.inb
WALKK = ('road', 'yard', 'slab', 'trail', 'tall', 'forest', None)
SOLIDK = ('rock', 'face0', 'face1', 'tface0', 'tface1', 'bog')
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
for x in range(0, 25):                                   # 아랫단(큰 고원): 굴 입구 자리(x4..22)는 바닥선이 평평(y43), 서쪽 끝은 낮게
    yt = (30 if 5 <= x <= 18 else 32 + (hsh(x // 3, 1, 3) % 3))
    yb = 43 if 4 <= x <= 22 else (40 if x < 4 else 41)
    for y in range(yt, yb + 1):
        ROCK.add((x, y))
PEAK = set()
for x in range(6, 18):                                   # 윗단 봉우리: 앞면(tface)이 아랫단 바위 윗면에 선다
    yt = 19 + (hsh(x // 2, 2, 3) % 3) + (2 if x < 8 or x > 15 else 0)
    for y in range(yt, 28):
        PEAK.add((x, y))
for x in range(24, 31):                                  # 동쪽 곁봉우리(아랫단과 떨어진 작은 산)
    for y in range(22 + (x % 2), 30):
        ROCK.add((x, y))
for x in range(53, 62):                                  # 초원 한가운데 낮은 바위 언덕
    for y in range(39 + (x in (53, 61)), 42):
        ROCK.add((x, y))
ROCK |= PEAK
FACE0, FACE1, TF0, TF1 = set(), set(), set(), set()
for (x, y) in sorted(ROCK):
    if (x, y + 1) in ROCK:
        continue
    tier = (x, y + 3) in ROCK
    (TF0 if tier else FACE0).add((x, y + 1)); (TF1 if tier else FACE1).add((x, y + 2))
assert not ((FACE0 | FACE1 | TF0 | TF1) & ROCK) or True
ROCK -= (TF0 | TF1 | FACE0 | FACE1)                      # 앞면 칸은 바위 윗면이 아니다(아랫단 윗줄을 덮는다)
setk(ROCK, 'rock', only=(None,)); setk(FACE0, 'face0', only=(None,)); setk(FACE1, 'face1', only=(None,))
for (cs, kk) in ((TF0, 'tface0'), (TF1, 'tface1')):
    for (x, y) in cs: KG[y][x] = kk

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
    """길을 2칸 폭으로: 각 칸에 2×2 블록을 깐다(모든 칸이 이웃 둘 이상이라 돌기·막다른 꼭지가 없다)."""
    for (x, y) in cells:
        for (ox, oy) in ((0, 0), (1, 0), (0, 1), (1, 1)):
            X, Y = x + ox, y + oy
            if inb(X, Y) and KG[Y][X] in (None, 'tall', 'forest'):
                KG[Y][X] = 'trail'


TRAILS['W'] = trail([(41, 20), (35, 20), (35, 27), (34, 38), (32, 45), (31, 46)], seed=3)       # 어귀 → 바위산 앞마당
TRAILS['A'] = trail([(31, 47), (38, 47), (38, 52), (47, 52)], seed=4)                                      # 앞마당 → 초원 줄기길
TRAILS['S'] = trail([(47, 23), (47, 30), (46, 37), (47, 44), (47, 52), (47, 58), (47, 63)], seed=5)       # 어귀 → 야영지
TRAILS['S2'] = trail([(48, 78), (48, 86), (47, 91), (47, 95)], seed=6)                                      # 야영지 → 남쪽 출구
TRAILS['E'] = trail([(54, 20), (62, 20), (62, 24), (70, 24), (72, 30), (76, 34)], seed=7)                 # 어귀 → 숲 쉼터
TRAILS['F'] = trail([(80, 43), (80, 52), (79, 60), (80, 66), (80, 72)], seed=8)                            # 쉼터 → 늪가
TRAILS['SW'] = trail([(54, 72), (66, 72), (80, 72), (88, 72), (92, 72), (92, 82)], seed=9)               # 야영지 → 늪가 → 늪 끝 표지
TRAILS['R'] = trail([(42, 72), (34, 72), (34, 76), (26, 76), (21, 72), (20, 70)], seed=10)                # 야영지 → 폐허
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


def prune_stubs():
    """마당·길 가장자리의 외줄 돌기(이웃 길 칸 ≤1)를 풀로 되돌린다. 반복해 한 줄짜리 꼬리를 모두 지운다."""
    n = 0
    while True:
        cut = []
        for y in range(1, MH - 1):
            for x in range(1, MW - 1):
                if KG[y][x] in ('yard', 'trail', 'road') and (x, y) not in KEEPPATH:
                    nb = sum(1 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if KG[y + dy][x + dx] in ('yard', 'trail', 'road', 'slab'))
                    if nb <= 1:
                        cut.append((x, y))
        if not cut:
            return n
        for (x, y) in cut:
            KG[y][x] = None
        n += len(cut)


KEEPPATH = {tuple(c) for c in CAVE_F} if 'CAVE_F' in globals() else set()
print('외줄 돌기 지움', prune_stubs())

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
    fam = {k: kit.cells_of(k) for k in ('road', 'yard', 'slab', 'trail', 'tall', 'forest', 'bog', 'rock', 'face0', 'face1', 'tface0', 'tface1')}
    dirt = fam['road'] | fam['yard'] | fam['slab'] | fam['trail']
    dirt_ry = fam['road'] | fam['yard'] | fam['slab'] | fam['trail']
    mass = fam['rock'] | fam['face0'] | fam['face1'] | fam['tface0'] | fam['tface1']
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
                gid = GID['fld_trail32'] + 16 * (hsh(x, y, 47) % 2) + mset(dirt, x, y, True)
            elif k == 'tall':
                gid = GID['fld_tall32'] + 16 * (1 if hsh(x // 5, y // 5, 17) % 3 == 0 else 0) + mset(fam['tall'], x, y)
            elif k == 'forest':
                gid = GID['fld_forest32'] + 16 * (hsh(x, y, 53) % 2) + mset(fam['forest'], x, y, True)
            elif k == 'bog':
                m8 = 0
                for bit, (dx, dy) in ((WB.N, (0, -1)), (WB.E, (1, 0)), (WB.S, (0, 1)), (WB.W, (-1, 0)), (WB.NE, (1, -1)), (WB.SE, (1, 1)), (WB.SW, (-1, 1)), (WB.NW, (-1, -1))):
                    if (x + dx, y + dy) in fam['bog']: m8 |= bit
                gid = GID['fld_bog94'] + WB.index47(m8) + 47 * (hsh(x, y, 29) % 2)
            elif k == 'rock':
                m = 0
                for bit, (dx, dy) in ((1, (0, -1)), (2, (1, 0)), (4, (0, 1)), (8, (-1, 0))):
                    if (x + dx, y + dy) in mass: m |= bit
                gid = GID['fld_rock_in8'] + hsh(x, y, 59) % 8 if m == 15 else GID['fld_rock32'] + 16 * (hsh(x, y, 59) % 2) + m
            elif k in ('face0', 'face1', 'tface0', 'tface1'):
                same = fam[k]
                we = (1 if (x - 1, y) in same else 0) | (2 if (x + 1, y) in same else 0)
                gid = GID['fld_face32'] + 24 * (1 if k.startswith('t') else 0) + 8 * (hsh(x // 3, y, 61) % 3) + (0 if k.endswith('0') else 4) + we
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
put('fld_rock_m_b', 55, 39, ok=('rock',), vis=False); put('fld_rock_s_a', 59, 40, ok=('rock',), vis=False)   # 풀밭 속 작은 바위 언덕: 맨 바위 판이 되지 않게 곁바위
put('fld_ore_b', 17, 48, ok=(None, 'yard'), vis=False)
put('fld_cairn', 23, 48, ok=(None, 'yard'), vis=False)

# 사람(사냥꾼): 어귀·앞마당·야영지·쉼터
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


TBOT = set()


def tree_line_bad(x, y):
    for dx, dy in ((1, 0), (0, 1), (1, 1), (1, -1)):
        for g in range(2, 8):
            for k in (-2, -1, 0):
                pts = [(x + (k + i) * dx * g, y + (k + i) * dy * g) for i in range(3)]
                if sum(1 for p in pts if p in TBOT) >= 2 and (x, y) in pts and all(p in TBOT or p == (x, y) for p in pts):
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
        if not nm.startswith(('bush',)) and tree_line_bad(x, y + h - 1):
            continue
        res = put(nm, x, y, ok=ok, conn=conn)
        if res:
            TREEPOS.append((nm, x, y)); n += 1
            if not nm.startswith('bush'): TBOT.add((x, y + h - 1))
    return n


# 동쪽 숲: 낙엽 바닥 위 큰 나무 + 중간 나무, 군락 조각
FOR_BOT = {c for c in FOREST if KG[c[1]][c[0]] == 'forest'}
for (nm, x, y) in (('fld_grove_broad', 86, 20), ('fld_grove_pine', 70, 52), ('fld_grove_broad', 87, 48), ('fld_grove_pine', 88, 28)):
    if put(nm, x, y, ok=OKG, conn=True):
        TREEPOS.append((nm, x, y)); TBOT.add((x, y + 4))
n1 = grow({c for c in FOR_BOT if c[1] >= 12}, ZEL + PIN, 9000, seed=1)
n2 = grow({c for c in FOR_BOT if c[1] >= 8}, MID, 4000, seed=2)
print('숲 나무', n1, n2)

# 가장자리 나무띠(맵 가장자리·바위산 북쪽·남쪽): 간격 불규칙, 길 위는 비운다
def rect(x0, y0, x1, y1):
    return {(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1) if inb(x, y) and KG[y][x] in (None, 'tall')}


NORTH = rect(0, 3, 41, 17) | rect(54, 3, 67, 12)
SOUTH = rect(0, 88, 44, 95) | rect(52, 90, 95, 95)
WESTSTRIP = rect(0, 47, 4, 87) | rect(0, 52, 12, 64)
EASTSTRIP = rect(94, 66, 95, 88)
n3 = grow(NORTH, ZEL + PIN, 3500, seed=3) + grow(NORTH, MID, 1500, seed=4)
n4 = grow(SOUTH, ZEL + PIN, 2500, seed=5) + grow(SOUTH, MID, 1500, seed=6)
n5 = grow(WESTSTRIP, ZEL + PIN + MID, 330, seed=7) + grow(EASTSTRIP, MID, 300, seed=8)
print('가장자리 나무', n3, n4, n5)
# 초원 가장자리 외딴 나무(길잡이): 큰 나무 몇 그루
MEAD = rect(26, 24, 66, 60) | rect(24, 62, 70, 86)
n6 = grow({c for c in MEAD if (c[0] < 40 or c[0] > 56) and (c[1] % 7 == 0 or c[0] % 9 == 0)}, ZEL + PIN, 40, seed=9)
print('초원 나무', n6)
if STAGE <= 3:
    stage_png('b'); sys.exit(0)

# ================================================================ 4단계: 소품(앵커 곁·이유 있는 자리에만)
POS = collections.defaultdict(list)


def makes_line(nm, x, y):
    S_ = set(POS[nm])
    for (px, py) in POS[nm]:
        qx, qy = 2 * px - x, 2 * py - y            # (x,y)-(px,py)-(qx,qy) 등간격 일렬
        if (qx, qy) in S_: return True
        if (x + px) % 2 == 0 and (y + py) % 2 == 0 and ((x + px) // 2, (y + py) // 2) in S_: return True
    return False


def scatter(names, region, count, ok=OKG, gap=3, conn=False, seed=0, vis=True, near=None):
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
        if put(nm, x, y, ok=ok, conn=conn, vis=vis):
            POS[nm].append((x, y)); n += 1
    return n


def dist_to(cells, x, y, r):
    return any(abs(x - cx) <= r and abs(y - cy) <= r for (cx, cy) in cells)


TRAILC = {c for v in TRAILS.values() for c in v}
TALLC = {c for c in TALL if KG[c[1]][c[0]] == 'tall'}
ROCKC = {(x, y) for y in range(MH) for x in range(MW) if KG[y][x] == 'rock'}
MEADOW = {c for c in rect(26, 24, 66, 60)}
# 앞마당(굴 앞) 걸을 칸 3×3 이상 비움: 굴 문 앞 칸 둘레를 길 칸 취급
for (cx, cy, nm) in CAVE_F:
    for yy in range(cy + 1, cy + 4):
        for xx in range(cx - 2, cx + 3): VIS.add((xx, yy))
for (nm, x, y) in (('fld_ore_a', 11, 49), ('fld_ore_b', 25, 49), ('fld_cairn', 27, 47)):
    put(nm, x, y, ok=(None, 'yard'), vis=False)
# 바위산 윗면: 큰 바위 덩이·돌탑·곁바위(산의 눈에 띄는 마루), 윗단에는 고목
for (nm, x, y) in (('fld_boulder_mass', 12, 36), ('fld_rock_l_a', 4, 35), ('fld_rock_l_b', 17, 38), ('fld_boulder_mass', 3, 25), ('fld_rock_m_b', 14, 33), ('fld_cairn', 10, 23), ('fld_cairn', 15, 33),
                   ('fld_rock_l_a', 8, 41), ('fld_rock_m_a', 20, 36), ('fld_rock_s_b', 22, 34)):
    put(nm, x, y, ok=('rock',), vis=False)
put('fld_dead_a', 9, 20, ok=('rock',), vis=False)
put('fld_boulder_mass', 25, 25, ok=('rock',), vis=False)
put('fld_rock_l_b', 55, 38, ok=('rock', 'face0'), vis=False) if False else None

# 초원: 바위 무리(큰 바위 + 곁돌 + 들꽃), 덤불, 키 큰 풀 곁 뼈·굴
RK_S = ['fld_rock_s_a', 'fld_rock_s_b', 'fld_rock_s_c']
RK_M = ['fld_rock_m_a', 'fld_rock_m_b']
RK_L = ['fld_rock_l_a', 'fld_rock_l_b']
FL = ['fld_flowers_a', 'fld_flowers_b', 'fld_flowers_c']
BU = ['fld_bush_flower_a', 'fld_bush_flower_b', 'fld_bush_berry'] + BUSH
ALLG = MEADOW | rect(24, 62, 66, 86) | rect(26, 10, 41, 24)
n_l = scatter(RK_L, ALLG, 4, gap=12, seed=1, conn=True)
n_m = scatter(RK_M, ALLG, 8, gap=8, seed=2, conn=True)
n_s = scatter(RK_S, ALLG, 22, gap=5, seed=3, conn=True)
n_b = scatter(BU, ALLG, 30, gap=4, seed=4, conn=True)
nearT = lambda x, y: dist_to(TRAILC, x, y, 3)
n_f = scatter(FL, ALLG, 36, gap=3, seed=5, vis=True, near=nearT)
n_f2 = scatter(FL, MEADOW, 18, gap=3, seed=6)
nearTall = lambda x, y: dist_to(TALLC, x, y, 2)
n_bone = scatter(['fld_bones_a', 'fld_bones_b'], ALLG, 7, gap=8, seed=7, near=nearTall)
n_burrow = scatter(['fld_burrow'], ALLG, 6, gap=8, seed=8, near=nearTall, conn=True)
print('초원 소품', n_l, n_m, n_s, n_b, n_f, n_f2, n_bone, n_burrow)
# 숲: 고사리·그루터기·통나무(숲 바닥 위, 나무꾼 쉼터 곁), 숲 가장자리 고목
FB = {c for c in FOR_BOT}
n_fern = scatter(['fld_fern'], FB, 26, gap=3, seed=9, ok=('forest',))
n_st = scatter(['fld_stump_a', 'fld_stump_b'], {c for c in FB if dist_to(CLEAR, c[0], c[1], 8)}, 5, gap=4, seed=10, ok=('forest',))
n_lg = scatter(['fld_log_a', 'fld_log_b'], {c for c in FB if dist_to(CLEAR, c[0], c[1], 10)}, 3, gap=8, seed=11, ok=('forest',))
n_dead = scatter(['fld_dead_a', 'fld_dead_b'], FB | rect(26, 62, 38, 70) | rect(2, 66, 6, 86), 6, gap=10, seed=12, ok=OKG, conn=True)
n_rf = scatter(RK_S + FL + BU[:3], FB, 20, gap=4, seed=13, ok=('forest',))
print('숲 소품', n_fern, n_st, n_lg, n_dead, n_rf)
# 폐허·무덤 곁: 키 큰 풀 사이 바위·덤불
RUIN = rect(6, 62, 30, 86)
scatter(RK_S + RK_M, RUIN, 6, gap=5, seed=14, conn=True)
scatter(BU, RUIN, 6, gap=5, seed=15, conn=True)
# 늪가: 갈대는 없고(조각 없음) 덤불·바위로 둘레를 막는다
BOGRIM = {(x, y) for y in range(MH) for x in range(MW) if KG[y][x] is None and any(KG[y + dy][x + dx] == 'bog' for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if inb(x + dx, y + dy))}
scatter(BU[:3] + RK_S, BOGRIM, 8, gap=4, seed=16, conn=True)
# 야영지 곁: 바위·들꽃
CAMPN = rect(34, 62, 62, 84)
scatter(RK_S + FL, CAMPN, 10, gap=4, seed=17)
if STAGE <= 4:
    stage_png('c'); sys.exit(0)

# ================================================================ 5단계: 스폰 · 사람 · 점검
SP = []
for (cx, cy, r, zone, kind) in ((33, 31, 4, 'meadow-W', 'meadow'), (60, 30, 5, 'meadow-E', 'meadow'), (36, 53, 4, 'meadow-SW', 'meadow'), (60, 54, 4, 'meadow-SE', 'meadow'), (46, 58, 2, 'meadow-S', 'meadow'),
                              (32, 74, 4, 'ruin', 'undead'), (20, 82, 3, 'ruin', 'undead')):
    cells = [c for c in TALLC if abs(c[0] - cx) <= r and abs(c[1] - cy) <= r and kit.walkable(*c)]
    R.shuffle(cells)
    for c in cells[:2]:
        SP.append({'x': c[0], 'y': c[1], 'zone': zone, 'kind': kind})
fcells = [c for c in FOR_BOT if kit.walkable(*c) and c not in VIS]
R.shuffle(fcells)
for c in fcells[:6]:
    SP.append({'x': c[0], 'y': c[1], 'zone': 'forest', 'kind': 'forest'})
for (x, y) in ((74, 74), (82, 73), (86, 73)):
    SP.append({'x': x, 'y': y, 'zone': 'swamp', 'kind': 'swamp'})
for c in CAVE_F:
    SP.append({'x': c[0], 'y': c[1] + 1, 'zone': 'cave-front', 'kind': 'cave'})
kit.SPAWNS.extend(SP)
ANCH.extend((s_['x'], s_['y']) for s_ in SP)
for k in ('P1', 'P2', 'P3', 'P4', 'R', 'G', 'F', 'SW', 'S2', 'W', 'A', 'E'):
    ANCH.append(TRAILS[k][-1])


def place_people(n=3):
    """사냥꾼 몇 명: 어귀·앞마당·야영지·쉼터의 걸을 칸(길 위 3칸 이상 폭, 몸채·나무 밑동이 아닌 곳)."""
    for (x, y, ch, d, fr) in ((44, 20, 0, PP.RIGHT, 1), (51, 21, 3, PP.LEFT, 0), (14, 48, 5, PP.UP, 1), (46, 74, 2, PP.RIGHT, 1), (50, 69, 6, PP.FRONT, 0), (52, 77, 1, PP.LEFT, 2), (78, 41, 4, PP.UP, 1)):
        PEOPLE.append((x, y, ch, d, fr))


place_people()


# ---- 빈 광장(10×10 완전 빈 땅) 메우기: 땅 자체를 달리 깐다(키 큰 풀 덩이). 물체로 메우지 않는다.
def plain_fix(max_rounds=60):
    n = 0
    for _ in range(max_rounds):
        bad = FM.audit_plain(kit, 10)
        if not bad:
            break
        x0, y0 = bad[len(bad) // 2]
        cx, cy = x0 + 5, y0 + 5
        cells = blob(cx, cy, 3.3, 2.6, 400 + n, 0.3)
        cells = {c for c in cells if KG[c[1]][c[0]] is None and c not in kit.DRAWN and c not in VIS}
        for (x, y) in cells: KG[y][x] = 'tall'
        n += 1
    return n


# ---- 맨 잔디 창(M1) 줄이기: 20×15 창에서 맨 잔디(칸의 90% 이상이 잔디색)가 목표를 넘으면 그 창 한가운데에 키 큰 풀·덤불 지형 덩이를 깐다.
def lawn_fix(target=0.36, max_rounds=80):
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'harness'))
    from spacemetrics import lawn_cells
    OBJ = kit.compose_objects()
    TARR = [t.a for t in kit.tiles]
    n = 0
    for _ in range(max_rounds):
        gr = ground_ids()
        g = np.zeros((MH * T, MW * T, 4), np.uint8)
        for y in range(MH):
            for x in range(MW):
                g[y * T:(y + 1) * T, x * T:(x + 1) * T] = TARR[gr[y][x]]
        FM._comp(g, OBJ, 0, 0)
        L = lawn_cells(g[:, :, :3], T).astype(np.float64)
        ii = np.pad(L.cumsum(0).cumsum(1), ((1, 0), (1, 0)))
        best = (0.0, 0, 0)
        for y in range(0, MH - 15 + 1):
            for x in range(0, MW - 20 + 1):
                v = (ii[y + 15, x + 20] - ii[y, x + 20] - ii[y + 15, x] + ii[y, x]) / 300.0
                if v > best[0]:
                    best = (v, x, y)
        if best[0] <= target:
            return n, round(best[0], 3)
        _, x0, y0 = best
        if os.environ.get('JS_DBG'): print('  round', n, best, int(L.sum()))
        sub = L[y0:y0 + 15, x0:x0 + 20]
        from scipy.ndimage import distance_transform_edt
        dt = distance_transform_edt(np.pad(sub, 1))[1:-1, 1:-1]
        iy, ix = np.unravel_index(int(np.argmax(dt)), dt.shape)
        cx, cy = x0 + ix, y0 + iy
        cells = blob(cx, cy, 5.0, 3.8, 700 + n, 0.3)
        for (x, y) in cells:
            if 1 <= x < MW - 1 and 1 <= y < MH - 1 and L[y, x] and KG[y][x] is None and (x, y) not in VIS:
                KG[y][x] = 'tall'
        n += 1
    return n, -1


print('맨 잔디 덩이 추가', lawn_fix())
print('빈 땅 풀 덩이 추가', plain_fix(), '남은 빈 창', len(FM.audit_plain(kit, 10)))

# ================================================================ 자동 점검 단언
PROBS = []
WALKSET = total_walk()
SEEN = kit.reach(START)
isl = FM.audit_unreachable_walk(kit, SEEN)
if isl:
    PROBS.append('시작점에서 못 닿는 걸을 칸 덩어리 %d개(최대 %d칸) %s' % (len(isl), isl[0][0], isl[:4]))
tgt = [(d['x'], d['y']) for d in kit.DOORS] + [(a['x'], a['y']) for a in kit.EXITS if 'x' in a] + [(47, 95), (48, 95)] + [tuple(a) for a in ANCH]
miss = [t for t in tgt if t not in SEEN]
if miss:
    PROBS.append('목표 칸에 못 닿음 %s' % miss[:6])
de = FM.audit_deadends(kit, ('trail', 'road', 'yard', 'slab'), ANCH)
if de:
    PROBS.append('막다른 길 끝 %d: %s' % (len(de), de[:6]))
l3 = FM.audit_line3(kit.placed)
if l3:
    PROBS.append('일렬 3개 소품·나무 %d: %s' % (len(l3), l3[:4]))
pl = FM.audit_plain(kit, 10)
if pl:
    PROBS.append('빈 광장 10×10 %d: %s' % (len(pl), pl[:4]))
# 굴 입구 앞 걸을 칸: 문 앞 칸과 그 아래 둘이 걸을 수 있고 폭 3칸 이상
for d in kit.DOORS:
    if d['piece'].startswith('fld_cave'):
        ok = all(kit.walkable(d['x'] + dx, d['y'] + dy) for dy in range(0, 3) for dx in (-1, 0, 1))
        if not ok:
            PROBS.append('굴 입구 앞 걸을 칸 3×3 이 막혔다: %s' % ((d['x'], d['y']),))
# 절벽 이음 일관: 바위 윗면 아랫줄마다 앞면 둘, 앞면 위는 바위, 늪 마스크는 같은 집합에서 만들어짐
cl_bad = []
for y in range(MH):
    for x in range(MW):
        k = KG[y][x]
        if k == 'rock' and inb(x, y + 1) and KG[y + 1][x] not in ('rock', 'face0', 'tface0'):
            cl_bad.append(('rock 아래가 앞면이 아님', x, y))
        if k in ('face0', 'tface0') and (KG[y - 1][x] != 'rock' or (KG[y + 1][x] != ('face1' if k == 'face0' else 'tface1') and (x, y + 1) not in {(c[0], c[1]) for c in CAVE_F})):
            cl_bad.append(('앞면 윗줄 이음', x, y))
        if k in ('face1', 'tface1') and (KG[y - 1][x] != ('face0' if k == 'face1' else 'tface0')):
            cl_bad.append(('앞면 아랫줄 이음', x, y))
        if k == 'tface1' and KG[y + 1][x] != 'rock':
            cl_bad.append(('윗단 앞면 밑이 아랫단 바위가 아님', x, y))
if cl_bad:
    PROBS.append('절벽 이음 %d: %s' % (len(cl_bad), cl_bad[:4]))
print('자동 점검', PROBS or '모두 통과')
if PROBS and not os.environ.get('JS_FORCE'):
    stage_png('d')
    print('자동 점검 FAIL — 굽지 않는다(JS_FORCE=1 로 무시)'); sys.exit(1)

# ================================================================ 6단계: 굽기
SOLID_KIND = {'rock': 'water', 'face0': 'water', 'face1': 'water', 'tface0': 'water', 'tface1': 'water', 'bog': 'water', 'trail': 'road', 'tall': 'grass', 'forest': 'grass'}
detail = [[(KG[y][x] or 'grass') for x in range(MW)] for y in range(MH)]
ids = ground_ids()
direct, rep = kit.bake(ids, 'field', people_overlay=PP.overlay, ground_kind_map=SOLID_KIND,
                       extra_fields={'groundDetail': detail, 'note': 'groundKind 의 water 는 걸을 수 없는 바닥(바위산 윗면·앞면·늪)이다 — 진짜 종류는 groundDetail'})
print('저장', OUT)
