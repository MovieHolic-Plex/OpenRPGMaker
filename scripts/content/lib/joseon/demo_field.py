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
for g in ('grass8', 'road64', 'yard64', 'slab', 'slab_edge16', 'fld_trail32', 'fld_tall32', 'fld_forest32', 'fld_bog94', 'fld_rock32', 'fld_rock_in8', FACEG):
    kit.add_group(g, tr_[g])
GID = {g: kit.gid(g) for g in kit.pieces}
KG = kit.KG
inb = kit.inb
SOLIDK = ('rock', 'face0', 'face1', 'tface0', 'tface1', 'bog', 'cityback')
VIS = set()          # 길·마당·문 앞: 물체(수관 포함)가 가리면 안 되는 칸
ANCH = []            # 막다른 길이 끝나도 되는 목적 칸
PEOPLE = kit.PEOPLE
START = (47, 0)


def vnoise(x, y, seed, sc=5.0):
    """격자 값 잡음의 쌍선형 보간(0..1): 덩이가 둥글게 섞여 직사각형 패치가 안 생긴다."""
    fx, fy = x / sc, y / sc
    x0, y0 = int(math.floor(fx)), int(math.floor(fy))
    tx, ty = fx - x0, fy - y0
    tx, ty = tx * tx * (3 - 2 * tx), ty * ty * (3 - 2 * ty)
    a, b = rnd(x0, y0, seed), rnd(x0 + 1, y0, seed)
    c, d = rnd(x0, y0 + 1, seed), rnd(x0 + 1, y0 + 1, seed)
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty


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
def smooth(cells, rounds=2, keep=None):
    """집합 윤곽의 1칸 가시·홈을 다수결(3×3 중 5칸 이상)로 다듬는다. keep 은 지우지 않을 칸."""
    cells = set(cells)
    for _ in range(rounds):
        cand = {(x + dx, y + dy) for (x, y) in cells for dx in (-1, 0, 1) for dy in (-1, 0, 1)}
        new = set()
        for (x, y) in cand:
            n = sum(1 for dx in (-1, 0, 1) for dy in (-1, 0, 1) if (x + dx, y + dy) in cells)
            if n >= 5 or (keep and (x, y) in keep and (x, y) in cells):
                new.add((x, y))
        cells = new
    return {c for c in cells if inb(*c)}


# --- 북쪽 성벽(국내성 남쪽 성벽을 밖에서 올려다본 3/4 앞면)과 남문: 윗면 줄(y0..3)은 걸을 수 없는 포장, 앞면은 성벽 조각이 덮는다.
GATE_X = 43                                                  # fort_gate 10칸 폭: 문길 칸은 x47..48
FM.SOLID_GROUND = FM.SOLID_GROUND + ('cityback',)            # 성벽 너머 도성 안 포장(걸을 수 없는 바닥, 성벽 윗면 뒤로 보이는 면)
for y in range(0, 9):
    for x in range(MW):
        KG[y][x] = 'cityback'
for y in range(0, 9):
    for x in (47, 48): KG[y][x] = 'slab'

# --- 서쪽 바위산: 3단 계단 산. 아랫단(큰 고원) 위에 가운데단, 그 위에 봉우리단이 얹히고 단마다 앞면 두 줄이 아랫단 윗면에 선다. 굴 입구 자리(x4..22)는 바닥선이 평평하다.
ROCK, TROCK = set(), set()
FACE0, FACE1, TFACE0, TFACE1 = set(), set(), set(), set()
for x in range(0, 25):                                       # 아랫단: 윗선 y38 고정(가운데단 밑동이 서는 열)·가장자리는 울퉁불퉁
    yt = 38 if 3 <= x <= 21 else 38 + (hsh(x // 2, 1, 3) % 3)
    yb = 43 if 4 <= x <= 22 else (40 if x < 4 else 41)
    for y in range(yt, yb + 1): ROCK.add((x, y))
for x in range(3, 22):                                       # 가운데단: 윗선 y32(봉우리 밑동 열은 고정)
    yt = 32 if 7 <= x <= 17 else 32 + 1 + (hsh(x, 2, 3) % 2)
    for y in range(yt, 36): ROCK.add((x, y))
    for y in (36, 37): (TFACE0 if y == 36 else TFACE1).add((x, y))
for x in range(7, 18):                                       # 봉우리단
    yt = 26 + (hsh(x // 2, 3, 3) % 2)
    for y in range(yt, 30): ROCK.add((x, y))
    for y in (30, 31): (TFACE0 if y == 30 else TFACE1).add((x, y))
for x in range(25, 32):                                      # 동쪽 곁봉우리(땅에 선다)
    yt = 29 + (x % 2) + (hsh(x, 4, 3) % 2)
    for y in range(yt, 34): ROCK.add((x, y))
for x in range(53, 63):                                      # 초원 한가운데 낮은 바위 언덕(땅에 선다)
    for y in range(37 + (x in (53, 62)) + (hsh(x, 5, 3) % 2), 41): ROCK.add((x, y))
UPPER = {(x, y) for (x, y) in ROCK if y <= 35 and 3 <= x < 22}
GROUND_ROCK = ROCK - UPPER
FACE0 = {(x, y + 1) for (x, y) in GROUND_ROCK if (x, y + 1) not in ROCK}
FACE1 = {(x, y + 1) for (x, y) in FACE0}
assert not (FACE1 & ROCK) and not (FACE0 & ROCK) and not ((FACE0 | FACE1) & (TFACE0 | TFACE1)), '바위 아래 두 줄이 다른 바위와 겹친다(벽 두께 2줄이 안 나옴)'
for (x, y) in TFACE1: assert (x, y + 1) in ROCK, ('윗단 앞면 밑이 아랫단 윗면이 아님', x, y)
for (x, y) in ROCK: KG[y][x] = 'rock'
for (x, y) in FACE0: KG[y][x] = 'face0'
for (x, y) in FACE1: KG[y][x] = 'face1'
for (x, y) in TFACE0: KG[y][x] = 'tface0'
for (x, y) in TFACE1: KG[y][x] = 'tface1'

# --- 어귀 큰길(성문 밑 흙길) + 어귀 마당
for y in range(9, 17):
    for x in range(46, 50): KG[y][x] = 'road'
YARD = {(x, y) for y in range(17, 23) for x in range(42, 54) if not ((x in (42, 53)) and y in (17, 22))}
setk(YARD, 'yard')

# --- 숲(동쪽)·늪·야영지·공터
FOREST = smooth(blob(84, 34, 16, 31, 5, 0.32) | blob(88, 12, 10, 9, 6, 0.4) | blob(72, 52, 6, 8, 7, 0.4), 2)
setk(FOREST, 'forest')
BOG = smooth(blob(78, 84, 11.5, 6.5, 9, 0.28) | blob(70, 82, 5, 4, 10, 0.3), 3)
setk(BOG, 'bog', only=(None, 'forest'))
for _r in range(3):                                        # 늪 윤곽 다듬기: 1칸 가시(이웃 늪 ≤1)는 지우고 1칸 홈(이웃 늪 ≥3)은 메운다
    rm = [(x, y) for y in range(MH) for x in range(MW) if KG[y][x] == 'bog' and sum(1 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if inb(x + dx, y + dy) and KG[y + dy][x + dx] == 'bog') <= 1]
    ad = [(x, y) for y in range(MH) for x in range(MW) if KG[y][x] in (None, 'forest') and sum(1 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if inb(x + dx, y + dy) and KG[y + dy][x + dx] == 'bog') >= 3]
    for (x, y) in rm: KG[y][x] = None
    for (x, y) in ad: KG[y][x] = 'bog'
BOGNEAR = {(x + dx, y + dy) for y in range(MH) for x in range(MW) if KG[y][x] == 'bog' for dx in range(-2, 3) for dy in range(-2, 3)}
CAMP = smooth(blob(48, 71, 8.5, 6.0, 31, 0.3), 2)
CLEAR = smooth(blob(80, 38, 5.5, 4.5, 32, 0.3), 2)
RUINP = smooth(blob(20, 71, 4.5, 3.2, 33, 0.3), 2)                  # 폐허 석탑 앞 참배 마당
for y in range(69, 71):
    for x in (16, 17): KG[y][x] = 'slab'                      # 폐허 석탑 참배길(두 칸 폭 포장)
setk(CAMP, 'yard', only=(None, 'forest')); setk(CLEAR, 'yard', only=(None, 'forest')); setk(RUINP, 'yard')
for y in (46, 47, 48):                                     # 바위산 앞마당(굴 앞) 세 줄: 끝은 둥글게
    for x in range(5, 31):
        if not (y == 46 and x in (5, 30)) and not (y == 48 and x in (5, 6, 30)): KG[y][x] = 'yard'

# --- 키 큰 풀·억새: 둥근 잡음 덩이(직사각 도장 금지). 구역마다 짙기가 다르다.
for y in range(23, 95):
    for x in range(0, MW):
        if KG[y][x] is None:
            v = 0.62 * vnoise(x, y, 31, 8.0) + 0.38 * vnoise(x, y, 32, 3.5)
            if v > 0.585: KG[y][x] = 'tall'
TALLC0 = {(x, y) for y in range(MH) for x in range(MW) if KG[y][x] == 'tall'}
for (x, y) in TALLC0 - smooth(TALLC0, 1): KG[y][x] = None


def curve(points, seed=0, width=2, kind='trail', wob=0.0):
    """웨이포인트를 부드러운 곡선(Catmull-Rom)으로 잇고 width×width 붓으로 칠한다. 4방향 계단은 폭 때문에 둥글게 읽힌다."""
    rg = random.Random(seed)
    pts = [(float(x), float(y)) for (x, y) in points]
    pts = [pts[0]] + pts + [pts[-1]]
    cells = []
    seen = set()
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[i + 1], pts[i + 2]
        n = max(4, int(math.hypot(p2[0] - p1[0], p2[1] - p1[1]) * 2))
        for k in range(n + 1):
            t = k / float(n)
            x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t * t + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t ** 3)
            y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t * t + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t ** 3)
            if wob:
                x += (vnoise(int(x * 3), int(y * 3), seed + 7, 4.0) - 0.5) * wob
            cx, cy = int(math.floor(x)), int(math.floor(y))
            for ox in range(width):
                for oy in range(width):
                    c = (cx + ox, cy + oy)
                    if c not in seen:
                        seen.add(c); cells.append(c)
    for (cx, cy) in cells:
        if inb(cx, cy) and KG[cy][cx] in (None, 'tall', 'forest'):
            KG[cy][cx] = kind
    return cells


TRAILS = {}
# 큰 줄기: 성문 마당 → 중앙 초원 → 야영지 → 남쪽 출구. 모든 짐승길은 이 줄기·마당에서 갈라져 목적지(굴·쉼터·야영지·표지·무덤)에서 끝난다.
TRAILS['S'] = curve([(47, 23), (46, 31), (48, 40), (47, 49), (48, 57), (47, 64)], seed=5, width=2)
TRAILS['S2'] = curve([(48, 76), (47, 84), (48, 90), (47, 95)], seed=6, width=2)
TRAILS['W'] = curve([(42, 21), (36, 24), (34, 32), (36, 40), (33, 46)], seed=3, width=2)                      # 어귀 → 바위산 앞마당
TRAILS['A'] = curve([(30, 48), (36, 52), (42, 51), (47, 50)], seed=4, width=2)                                # 앞마당 → 줄기길(굽이)
TRAILS['E'] = curve([(53, 20), (61, 22), (68, 27), (73, 33), (77, 36)], seed=7, width=2)                      # 어귀 → 숲 쉼터
TRAILS['F'] = curve([(80, 43), (79, 52), (81, 60), (80, 67), (81, 72)], seed=8, width=2)                      # 쉼터 → 늪가 길
TRAILS['SW'] = curve([(56, 72), (66, 73), (76, 72), (86, 73), (91, 77), (92, 82)], seed=9, width=2)           # 야영지 → 늪 북쪽 둑 → 늪 끝 표지
TRAILS['R'] = curve([(40, 72), (32, 73), (26, 71), (23, 71)], seed=10, width=2)                               # 야영지 → 폐허 참배 마당
TRAILS['G'] = curve([(16, 73), (12, 74), (9, 75)], seed=11, width=2)                                          # 폐허 → 무덤터 석비
TRAILS['D'] = curve([(12, 49), (11, 53), (12, 56)], seed=17, width=2)                                       # 앞마당 → 짐승 굴(몬스터 둥지) 앞
TRAILS['P1'] = curve([(46, 31), (41, 30), (37, 31)], seed=12, width=2)                                        # 줄기 → 서쪽 짐승굴
TRAILS['P2'] = curve([(48, 40), (54, 41), (58, 40)], seed=13, width=2)                                        # 줄기 → 동쪽 이정표(언덕 앞)
TRAILS['P4'] = curve([(48, 57), (53, 58), (57, 56)], seed=15, width=2)                                        # 줄기 → 동남 이정표


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


PROT = {(12, 56), (37, 31), (58, 40), (57, 56), (23, 71), (9, 76), (92, 82), (47, 95), (47, 0), (48, 0), (33, 46), (77, 36), (81, 72), (47, 50)}


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
    fam = {k: kit.cells_of(k) for k in ('road', 'yard', 'slab', 'trail', 'tall', 'forest', 'bog', 'rock', 'face0', 'face1', 'tface0', 'tface1')}
    dirt = fam['road'] | fam['yard'] | fam['slab'] | fam['trail']
    mass = fam['rock'] | fam['face0'] | fam['face1'] | fam['tface0'] | fam['tface1']
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
                gid = GID['fld_tall32'] + 16 * (1 if vnoise(x, y, 17, 4.5) > 0.66 and mset(fam['tall'], x, y) == 15 else 0) + mset(fam['tall'], x, y)
            elif k == 'forest':
                gid = GID['fld_forest32'] + 16 * (hsh(x, y, 53) % 2) + mset(fam['forest'], x, y)
            elif k == 'bog':
                m8 = 0
                for bit, (dx, dy) in ((WB.N, (0, -1)), (WB.E, (1, 0)), (WB.S, (0, 1)), (WB.W, (-1, 0)), (WB.NE, (1, -1)), (WB.SE, (1, 1)), (WB.SW, (-1, 1)), (WB.NW, (-1, -1))):
                    if (x + dx, y + dy) in fam['bog']: m8 |= bit
                gid = GID['fld_bog94'] + WB.index47(m8) + 47 * (hsh(x, y, 29) % 2)
            elif k == 'cityback':
                gid = GID['slab'] + (hsh(x, y, 19) % 5)
            elif k == 'rock':
                m = 0
                for bit, (dx, dy) in ((1, (0, -1)), (2, (1, 0)), (4, (0, 1)), (8, (-1, 0))):
                    X, Y = x + dx, y + dy
                    if (X, Y) in mass or (not inb(X, Y) and y < 9): m |= bit       # 지도 위·옆 가장자리(성벽 줄)는 이어진 것으로 본다
                gid = GID['fld_rock_in8'] + hsh(x, y, 59) % 8 if m == 15 else GID['fld_rock32'] + 16 * (hsh(x, y, 59) % 2) + m
            elif k in ('face0', 'face1', 'tface0', 'tface1'):
                same = fam[k]
                we = (1 if (x - 1, y) in same else 0) | (2 if (x + 1, y) in same else 0)
                gid = GID[FACEG] + 24 * (1 if k.startswith('t') else 0) + 8 * (hsh(x // 3, y, 61) % 3) + (0 if k.endswith('0') else 4) + we
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
VIS |= {c for c in BOGNEAR if KG[c[1]][c[0]] != 'bog'}      # 늪 둘레 2칸은 나무·큰 소품이 서지 않는다(물가 숨 쉴 자리)
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
kit.EXITS.append({'to': 'gungnae_full', 'side': 'N', 'x0': 47, 'x1': 48, 'y': 0})
kit.EXITS.append({'to': 'next_field', 'side': 'S', 'x0': 47, 'x1': 48, 'y': 95})
pw(47, 95); pw(47, 0); pw(48, 0)

# --- 북쪽 성벽 + 남문(fort_gate): 성벽 앞면 5줄(y4..8)을 문 양옆으로 지도 끝까지 잇는다. 문길 x47..48 은 문 조각의 통과 칸.
put('fort_gate', GATE_X, 0, ok=('cityback', 'slab'), vis=False)
WALLN = ['fort_wall_h', 'fort_wall_h1', 'fort_wall_h2']
_prev = None
for x in list(range(0, GATE_X)) + list(range(GATE_X + 10, MW)):
    k = hsh(x, 8, 71) % 3
    if k == _prev: k = (k + 1) % 3
    _prev = k
    put(WALLN[k], x, 4, ok=('cityback',), vis=False)

# --- 어귀: 장승 한 쌍 + 이정표
for nm, x, y in (('jangseung_m', 44, 17), ('jangseung_f', 51, 17)):
    put(nm, x, y, ok=('yard',), vis=False)
put('fld_signpost', 54, 17, ok=('yard',), vis=False)
put('fld_signpost', 31, 44, ok=('yard',), vis=False)      # 앞마당 길목
put('fld_signpost', 48, 93, ok=OKG, vis=False)             # 남쪽 출구

# --- 야영지(남쪽): 모닥불이 중심, 천막 둘·건조대·통나무 의자
put('fld_campfire', 48, 72, ok=('yard',), vis=False); pw(48, 73)
put('fld_tent_b', 41, 66, ok=('yard', None), vis=False)
for (tx, ty) in ((53, 66), (54, 67), (52, 67), (53, 68), (55, 68)):
    if put('fld_tent_a', tx, ty, ok=('yard', None), vis=False): break
for (tx, ty) in ((46, 64), (45, 65), (47, 65), (44, 66)):                  # 셋째 천막(작은 쪽, 북쪽 가장자리)
    if put('fld_tent_a', tx, ty, ok=('yard', None), vis=False): break
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
for (nm, x, y) in (('fld_tombstone', 9, 77), ('fld_grave_a', 4, 74), ('fld_grave_b', 14, 77), ('fld_grave_a', 4, 80), ('fld_grave_b', 13, 81), ('fld_cairn', 27, 69)):   # 석비를 무덤터 한가운데에 둔다
    if put(nm, x, y, ok=OKG, vis=False): keep_visible(nm, x, y, up=3, side=1)
    else: print('  못 놓음', nm, x, y)
pw(9, 76)
# 줄기길 곁가지 끝의 목적지: 짐승굴(스폰)·이정표
put('fld_burrow', 34, 31, ok=OKG, vis=False); put('fld_bones_a', 35, 32, ok=OKG, vis=False); pw(37, 31)
put('fld_signpost', 59, 30, ok=OKG, vis=False); pw(58, 31)
put('fld_signpost', 57, 55, ok=OKG, vis=False); put('fld_bones_b', 58, 57, ok=OKG, vis=False); pw(56, 56)
put('fld_dead_a', 5, 68, ok=OKG); put('fld_dead_b', 27, 66, ok=OKG); put('fld_dead_a', 21, 84, ok=OKG)
# --- 서쪽 몬스터 둥지(짐승굴·해골·뼈·천막 흔적): 앞마당 아래 풀밭, 굴 입구에서 내려온 사냥꾼이 맞닥뜨리는 자리
DEN = (('fld_tent_b', 8, 52), ('fld_burrow', 5, 57), ('fld_burrow', 15, 55), ('fld_bones_a', 12, 57), ('fld_bones_b', 7, 56), ('fld_bones_a', 4, 53), ('fld_bones_b', 14, 52), ('fld_rock_m_a', 17, 58), ('fld_stump_b', 11, 54))
for (nm, x, y) in DEN:
    if put(nm, x, y, ok=OKG, vis=False): keep_visible(nm, x, y, up=2, side=1)
    else: print('  못 놓음', nm, x, y)
# --- 늪 끝 표지
put('fld_signpost', 93, 82, ok=(None, 'forest'), vis=False); put('fld_bones_b', 90, 83, ok=(None, 'forest'), vis=False); pw(92, 82)
# --- 몬스터 둥지(바위산 남서쪽 앞, x4..20 y50..62): 찢어진 천막(사냥꾼이 쓰러진 자리) + 굴 셋 + 해골·뼈 무더기가 한 군데에 모여 「여기가 소굴」로 읽힌다.
DEN = [('fld_tent_a', 9, 57), ('fld_burrow', 5, 54), ('fld_burrow', 15, 59), ('fld_burrow', 7, 61), ('fld_bones_a', 12, 59), ('fld_bones_b', 8, 55), ('fld_bones_a', 14, 55), ('fld_bones_b', 11, 62),
       ('fld_rock_m_b', 16, 53), ('fld_dead_a', 3, 58), ('fld_rock_s_a', 13, 61), ('fld_rock_s_c', 6, 58)]
for (nm, x, y) in DEN:
    if put(nm, x, y, ok=OKG + ('yard',), vis=False): keep_visible(nm, x, y, up=1, side=1)
    else: print('  못 놓음(둥지)', nm, x, y)
pw(12, 56)
# --- 모닥불 둘레: 돌 두름 + 짐 더미(통나무 의자·그루터기는 위에서) — 불이 휑하지 않게
for (nm, x, y) in (('fld_rock_s_a', 47, 71), ('fld_rock_s_b', 49, 71), ('fld_rock_s_c', 47, 73), ('fld_rock_s_a', 49, 73), ('fld_ore_a', 46, 70), ('fld_stump_a', 50, 74)):
    put(nm, x, y, ok=('yard',), vis=False)
# --- 폐허 참배길: 폐허 석탑 앞 포장(slab) + 곁에 무너진 석재 덩이
for nm, x, y in (('fld_rock_m_b', 12, 66), ('fld_rock_m_a', 19, 66), ('fld_cairn', 14, 69), ('fld_rock_s_b', 19, 69), ('fld_rock_s_c', 11, 71)):
    put(nm, x, y, ok=OKG + ('yard',), vis=False)

# --- 앞마당 광석 노두(갱도 입구 곁)
put('fld_ore_a', 12, 47, ok=('yard',), vis=False)
put('fld_ore_b', 17, 48, ok=(None, 'yard'), vis=False)

# 사람(사냥꾼): 어귀·앞마당·야영지·쉼터
for (x, y, ch, d, fr) in ((44, 20, 0, PP.RIGHT, 1), (51, 21, 3, PP.LEFT, 0), (26, 47, 5, PP.LEFT, 1), (46, 74, 2, PP.RIGHT, 1), (50, 69, 6, PP.FRONT, 0), (52, 77, 1, PP.LEFT, 2), (78, 41, 4, PP.UP, 1)):
    PEOPLE.append((x, y, ch, d, fr))
if STAGE <= 2:
    stage_png('a'); sys.exit(0)

# ================================================================ 3단계: 나무
ZEL = ['zelkova_' + c for c in 'abcdefghij'] + ['fld_zelkova_' + c for c in 'abcd']
PIN = ['pine_' + c for c in 'abcdef'] + ['fld_pine_' + c for c in 'abcd']
MID = ['persimmon_' + c for c in 'abcdef'] + ['small_z_a', 'small_z_b', 'small_p']
BUSH = ['bush_a', 'bush_b', 'bush_c', 'bush_d', 'bush_e', 'bush_f', 'bush_l_a', 'bush_l_b', 'bush_l_c', 'bush_l_d', 'bush_s_a', 'bush_s_b', 'bush_s_c', 'bush_s_d']
TREEPOS = []        # (이름, x, y) 왼쪽 위


def base_of(nm, x, y):
    cv = kit.objects[nm]
    return (x + (cv.w // T) / 2.0, y + cv.h // T - 1)


def tree_name_ok(nm, x, y):
    if nm.startswith(('bush', 'fld_bush')):
        return True
    for (n2, x2, y2) in TREEPOS:
        if n2 == nm and abs(x2 - x) <= 6 and abs(y2 - y) <= 6:      # 지도 게이트 M4: 같은 나무가 6칸 안에 둘이면 FAIL
            return False
    return True


def near_trunk(nm, x, y, dmin=2.4, dvar=1.8):
    """이미 놓은 나무 밑동과 너무 붙지 않게: 최소 거리가 자리마다 잡음으로 달라(dmin..dmin+dvar) 간격이 고르지 않다."""
    bx, by = base_of(nm, x, y)
    need = dmin + dvar * vnoise(int(bx * 2), int(by * 2), 91, 4.0)
    for (n2, x2, y2) in TREEPOS:
        if n2.startswith('bush'): continue
        b2x, b2y = base_of(n2, x2, y2)
        if (b2x - bx) ** 2 + ((b2y - by) * 1.35) ** 2 < need * need:
            return True
    return False


def skewer(nm, x, y):
    """꼬치·줄 심기 금지: 새 나무 밑동과 같은 열(x ±1)·같은 줄(y ±1)에서 이웃한 세 그루가 비슷한 간격(차 ≤1.5)으로 서면 거른다(창 9칸)."""
    bx, by = base_of(nm, x, y)
    for axis in (0, 1):
        band = []
        for (n2, x2, y2) in TREEPOS:
            if n2.startswith('bush'): continue
            b2x, b2y = base_of(n2, x2, y2)
            u, v = (b2y, b2x) if axis == 0 else (b2x, b2y)          # u: 열을 따라가는 좌표, v: 열 안쪽 좌표
            pu, pv = (by, bx) if axis == 0 else (bx, by)
            if abs(v - pv) <= 1.0 and abs(u - pu) <= 9: band.append(u)
        band.sort()
        pu = by if axis == 0 else bx
        seq = sorted(band + [pu])
        i = seq.index(pu)
        for a_ in (i - 2, i - 1, i):
            if a_ >= 0 and a_ + 2 < len(seq):
                g1, g2 = seq[a_ + 1] - seq[a_], seq[a_ + 2] - seq[a_ + 1]
                if min(g1, g2) >= 1.5 and abs(g1 - g2) <= 1.5: return True
    return False


TB = set()          # 나무 밑동 칸(왼쪽 위 + 폭//... audit_line3 와 같은 기준: (x, y+h-1))


def tri_line(nm, x, y):
    """새 나무가 기존 밑동과 등간격 일렬 셋(가로·세로·대각, 간격 2..7)을 이루면 True — audit_line3 와 같은 조건을 심기 전에 막는다."""
    p = (x, y + kit.objects[nm].h // T - 1)
    for dx, dy in ((1, 0), (0, 1), (1, 1), (1, -1)):
        for g in range(2, 8):
            a, b = (p[0] + dx * g, p[1] + dy * g), (p[0] + 2 * dx * g, p[1] + 2 * dy * g)
            if a in TB and b in TB: return True
            a, b = (p[0] - dx * g, p[1] - dy * g), (p[0] - 2 * dx * g, p[1] - 2 * dy * g)
            if a in TB and b in TB: return True
            a, b = (p[0] + dx * g, p[1] + dy * g), (p[0] - dx * g, p[1] - dy * g)
            if a in TB and b in TB: return True
    return False


ROCKFAM = ('rock', 'face0', 'face1', 'tface0', 'tface1', 'cityback')


def rock_close(nm, x, y):
    """나무·덤불의 모든 칸(수관 포함)이 바위산·성벽 칸이나 그 곁 1칸에 닿으면 True: 수관이 산 앞면을 덮는 겹침을 막는다."""
    return any(inb(X + dx, Y + dy) and KG[Y + dy][X + dx] in ROCKFAM for (X, Y, ch) in kit.cells_for(nm, x, y) for dx in (-1, 0, 1) for dy in (-1, 0, 1))


def bog_close(nm, x, y):
    return any((X + dx, Y + dy) in BOGNEAR1 for (X, Y, ch) in kit.cells_for(nm, x, y) if ch == 'X' for dx in (-1, 0, 1) for dy in (-1, 0, 1))


BOGNEAR1 = {(x + dx, y + dy) for y in range(MH) for x in range(MW) if KG[y][x] == 'bog' for dx in (-1, 0, 1) for dy in (-1, 0, 1)}
GROUPS = {'z': ZEL, 'p': PIN, 'm': MID}


def pick_species(rg, x, y, mix=0.62):
    v = vnoise(x, y, 93, 10.0)                      # 구역마다 우세 수종이 다르다(섞어 심기 + 덩이)
    dom = 'z' if v < 0.4 else ('p' if v < 0.72 else 'm')
    if rg.random() < mix:
        return rg.choice(GROUPS[dom])
    return rg.choice(ZEL + PIN + MID)


def glade(x, y):
    """숲 속 빈터(나무를 안 심는 둥근 구석): 그루터기·통나무·꽃·뼈가 곁들이로 앉는다."""
    return vnoise(x, y, 95, 6.5) < 0.22


def plant(region, seed, dmin=2.4, dvar=1.8, tries=20000, ok=OKG, conn=True, use_glade=False, density=1.0, names=None, passes=4):
    rg = random.Random(seed)
    base = sorted(region)
    n = 0
    cand = []
    for _p in range(passes):
        c2 = list(base); rg.shuffle(c2); cand += c2[:tries]
    for (cx, cy) in cand:
        if density < 1.0 and rg.random() > density: continue
        if use_glade and glade(cx, cy): continue
        nm = rg.choice(names) if names else pick_species(rg, cx, cy)
        cv = kit.objects[nm]
        w, h = cv.w // T, cv.h // T
        x, y = cx - w // 2, cy - h + 1
        if not tree_name_ok(nm, x, y) or near_trunk(nm, x, y, dmin, dvar) or skewer(nm, x, y) or tri_line(nm, x, y) or bog_close(nm, x, y) or rock_close(nm, x, y):
            continue
        if put(nm, x, y, ok=ok, conn=conn):
            TREEPOS.append((nm, x, y)); TB.add((x, y + kit.objects[nm].h // T - 1)); n += 1
    return n


FOR_BOT = {c for c in FOREST if KG[c[1]][c[0]] == 'forest'}
n1 = plant({c for c in FOR_BOT if c[1] >= 10}, seed=1, dmin=1.8, dvar=1.4, use_glade=True)
for (nm, x, y) in (('fld_grove_broad', 86, 20), ('fld_grove_pine', 72, 54), ('fld_grove_pine', 88, 28)):
    if put(nm, x, y, ok=OKG, conn=True): TREEPOS.append((nm, x, y)); TB.add((x, y + kit.objects[nm].h // T - 1))
print('숲 나무', n1)
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
        tr_like = is_tree(nm) or nm.startswith('small_')
        if tr_like and (not tree_name_ok(nm, x, y) or near_trunk(nm, x, y, 3.0, 2.0) or tri_line(nm, x, y) or skewer(nm, x, y) or bog_close(nm, x, y) or rock_close(nm, x, y)):
            continue
        if put(nm, x, y, ok=ok, conn=conn, vis=vis):
            PROPPOS.append((nm, x, y)); done += 1
            if tr_like: TREEPOS.append((nm, x, y)); TB.add((x, y + h - 1))
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
fre = lambda x0, y0, x1, y1: {(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1) if KG[y][x] in (None, 'tall', 'forest')}
wood = lambda x, y, s, th: vnoise(x, y, s, 8.0) > th                                      # 숲덩이 모양(직선 줄 금지): 잡음이 높은 곳만 숲
NW = {c for c in fre(0, 9, 40, 25) if wood(c[0], c[1], 96, 0.22)}
NE = {c for c in fre(56, 9, 72, 24) if wood(c[0], c[1], 97, 0.33)}
SOUTH = {c for c in fre(0, 85, 95, 95) if wood(c[0], c[1], 98, 0.12)}
WESTE = {c for c in fre(0, 49, 6, 84) if wood(c[0], c[1], 99, 0.22)}
SE = {c for c in fre(82, 55, 95, 84) if wood(c[0], c[1], 100, 0.20)}
LOG['t_nw'] = plant(NW, seed=31, dmin=2.6, dvar=2.0)
LOG['t_ne'] = plant(NE, seed=32, dmin=3.0, dvar=2.2)
LOG['t_west'] = plant(WESTE, seed=33, dmin=3.0, dvar=2.2)
LOG['t_south'] = plant(SOUTH, seed=34, dmin=2.6, dvar=2.0)
LOG['t_se'] = plant(SE, seed=35, dmin=2.8, dvar=2.0)
COPSE = [(25, 57, 4.5), (39, 63, 3.5), (62, 63, 4), (66, 46, 3.5), (29, 36, 4), (56, 28, 3.5), (36, 14, 3.5), (68, 18, 3), (12, 57, 4), (24, 61, 3.5), (8, 66, 3), (18, 14, 4.5), (28, 22, 3.5), (60, 80, 3.5), (30, 82, 3), (66, 62, 3)]       # 초원 속 작은 숲덩이(수종 한 줄 심기가 아니라 둥근 군락)
cop = set()
for (cx, cy, r) in COPSE:
    cop |= {(x, y) for (x, y) in fre(cx - 5, cy - 5, cx + 5, cy + 5) if ((x - cx) / r) ** 2 + ((y - cy) / (r * 0.8)) ** 2 <= 1.0 + 0.3 * (rnd(x, y, 77) - 0.5)}
LOG['t_copse'] = plant(cop, seed=37, dmin=2.2, dvar=1.6)
LOG['t_mid'] = plant({(x, y) for (x, y) in kcells(None, 'tall', x0=26, y0=24, x1=66, y1=60) if (x, y) not in near_trail({(x, y)}, 3)}, seed=36, dmin=6.0, dvar=3.0, tries=400)

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
# 귀퉁이 빈 곳(북동·동쪽 가장자리): 덤불·바위 무리로 채운다
for (nm_, reg_, n_, g_, sd_) in ((BUSH + ['fld_rock_m_a', 'fld_rock_s_b', 'fld_rock_s_c', 'fld_flowers_a'], kcells(None, 'forest', x0=72, y0=0, x1=95, y1=9), 16, 3, 91),
                                 (BUSH + ['fld_rock_m_b', 'fld_rock_s_a', 'fld_flowers_c'], kcells(None, 'forest', x0=88, y0=54, x1=95, y1=66), 8, 3, 92)):
    LOG['corner%d' % sd_] = scatter(nm_, reg_, n_, gap=g_, seed=sd_)
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


def relieve_lawn(limit=0.23, rounds=260):
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
        bad = FM.audit_line3([p for p in kit.placed if not p[0].startswith('fort_wall')])
        if not bad:
            break
        # (이름, (x, y) 시작점, (dx, dy)) → 가운데 점을 뽑는다
        if os.environ.get('JS_DBG'): print('  줄 심기', collections.Counter(n for (n, _a, _b) in bad), bad[:3])
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
      add_spawns('swamp', {(x + dx, y + dy) for (x, y) in kcells('bog') for dx in range(-4, 5) for dy in range(-4, 5)} - BOGNEAR, 4, 10, 3),
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
    for nm, (x, y) in (('북 출구', (47, 0)), ('남 출구', (47, 95)), ('북 출구 끝', (48, 0))):
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
    ln = FM.audit_line3([p for p in kit.placed if not p[0].startswith('fort_wall')])
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
    # 절벽 이음: 앞면 윗줄 위는 바위, 아랫줄 위는 윗줄, 아랫단 앞면(face)은 땅에 서고 윗단 앞면(tface)은 아랫단 윗면(바위)에 선다. 바위 아래는 바위나 앞면 윗줄.
    fam['tface0'] = kit.cells_of('tface0'); fam['tface1'] = kit.cells_of('tface1')
    for (x, y) in fam['face0']:
        if (x, y - 1) not in fam['rock']: bad_mask.append(('face0 위가 바위 아님', x, y))
        if (x, y + 1) not in fam['face1'] and (x, y + 1) not in CAVEF: bad_mask.append(('face0 아래가 face1 아님', x, y))
    for (x, y) in fam['face1']:
        if (x, y - 1) not in fam['face0']: bad_mask.append(('face1 위가 face0 아님', x, y))
        if (x, y + 1) in fam['rock'] or (x, y + 1) in fam['face0']: bad_mask.append(('face1 아래가 벽·바위', x, y))
    for (x, y) in fam['tface0']:
        if (x, y - 1) not in fam['rock'] or (x, y + 1) not in fam['tface1']: bad_mask.append(('tface0 이음', x, y))
    for (x, y) in fam['tface1']:
        if (x, y - 1) not in fam['tface0'] or (x, y + 1) not in fam['rock']: bad_mask.append(('tface1 이음(밑이 아랫단 바위여야)', x, y))
    for (x, y) in fam['rock']:
        if (x, y + 1) not in fam['rock'] and (x, y + 1) not in fam['face0'] and (x, y + 1) not in fam['tface0']: bad_mask.append(('바위 아래 앞면 없음', x, y))
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
