# 버들항 장르 웨이브 6 (gothic) — 폐가 저택 내부 던전(haunted-manor). 다시 돌리면 같은 그림이 나온다.
#   python3 make_haunted_manor.py   → parts/, partmeta.json, parts.md, render-1x/2x.png, grid.json, compare-ref.png, check-autotile.png
# 한 맵(56×45)에 저택 1층과 지하실을 놓는다: 1층(y0~33) = 현관·계단 홀 · 연회장 · 거미줄 서재 · 응접실 · 잠긴 문 너머 계단방,
# 지하(y34~44) = 포도주 창고. 계단방의 지하 내림 계단 ↔ 지하실 오름 계단은 LINKS 로 잇는다.
# 바닥은 맨 바탕 표본(ground-*) → 땅 덩이 오토타일(먼지·거미줄·곰팡이, 카펫 길) → 건물 조각·소품 순으로 칠한다(조수가 따라 할 순서).
import os, sys, json
OUT = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, OUT)
from hm_kit import *
from hm_kit import _hash
import hm_kit as HK
import hm_parts as HP
import dcheck
assert OUT.endswith('haunted-manor')

HP.register()
kit, S, SOFT = HP.kit, HP.S, HP.SOFT
W_, H_ = 56, 45
CELLAR_Y = 34
AMBER = (214, 168, 86)


class MMap(KMap):
    def __init__(s, *a):
        super().__init__(*a); s.lights = []

    def render(s):
        s.compute_faces()
        im = Image.new('RGBA', (s.W * T, s.H * T), (0, 0, 0, 255))
        for y in range(s.H):
            for x in range(s.W):
                P = (x * T, y * T)
                if s.fl[y][x]:
                    im.alpha_composite(dlib.floor_tile(s.fl[y][x], x, y), P)
                elif (x, y) in s.face:
                    sty, k, n = s.face[(x, y)]
                    capL = (x - 1, y) not in s.face and not s.open(x - 1, y)
                    capR = (x + 1, y) not in s.face and not s.open(x + 1, y)
                    im.alpha_composite(dlib.face_tile(sty, None, n - k, int(_hash(x, y, 3) * 6), capL, capR, n * T), P)
                else:
                    def op(dx, dy):
                        xx, yy = x + dx, y + dy
                        return s.inb(xx, yy) and (s.open(xx, yy) or (xx, yy) in s.face)
                    o8 = (op(0, -1), op(1, 0), op(0, 1), op(-1, 0), op(1, -1), op(1, 1), op(-1, 1), op(-1, -1))
                    im.alpha_composite(HK.ceiling(o8, int(_hash(x, y, 4) * 4), 'cellar' if y >= CELLAR_Y else 'manor'), P)
        for cells, sheet in s.under:
            for (x, y) in sorted(cells, key=lambda c: (c[1], c[0])): im.alpha_composite(atile_img(sheet, autotile_mask(cells, x, y)), (x * T, y * T))
        for (x, y, img) in s.decals: im.alpha_composite(img, (int(x * T), int(y * T)))
        for cells, sheet in s.over:
            for (x, y) in sorted(cells, key=lambda c: (c[1], c[0])): im.alpha_composite(atile_img(sheet, autotile_mask(cells, x, y)), (x * T, y * T))
        for (x, y, img, w, h, layer) in sorted(s.props, key=lambda p: (p[5], p[1], p[0])):
            im.alpha_composite(img, (x * T, (y + 1) * T - img.height))
        for (px_, py_, img) in s.lights: im.alpha_composite(img, (int(px_), int(py_)))
        for (px_, py_, img) in s.overlays: im.alpha_composite(img, (int(px_), int(py_)))
        s.img = im
        return im


m = MMap(W_, H_, 'haunted-manor')
BAD = []


def R(x0, y0, x1, y1, kind, wh=3, sty='manor'):
    """바닥 사각형을 연다(x1·y1 포함). wh = 그 칸 위 벽 앞면 높이."""
    m.floor(x0, y0, x1 - x0 + 1, y1 - y0 + 1, kind, wh, sty)


def CUT(x0, y0, w=1, h=1): m.cut(x0, y0, w, h)


def P(name, x, y, block=None, layer=1, check=True):
    """조각을 칸 (x, y)(= 왼쪽 아래 칸)에 놓는다. block 이 없으면 메타의 brows 로 발자국을 잰다."""
    img = S[name]
    br = kit.meta[name]['brows']
    if block is None:
        block = [] if br == 0 else foot(img, br, 10, name in SOFT)
    if check:
        for (bx, by) in block:
            c = (x + bx, y + by)
            if not (m.inb(*c) and m.fl[c[1]][c[0]] is not None and c not in m.blocked): BAD.append((name, x + bx, y + by))
    m.props_add(x, y, img, block, layer)


def DEC(name, x, y):
    """벽 앞면 위 장식: 모든 칸이 앞면이어야 한다."""
    img = S[name]; m.compute_faces(); w = -(-img.width // T); h = -(-img.height // T)
    for j in range(h):
        for i in range(w):
            if (x + i, y + j) not in m.face: BAD.append((name + '@face', x + i, y + j))
    m.decal(x, y, img)


def FD(name, x, y): m.decal(x, y, S[name])


def glowc(cx, cy, col=AMBER, size=56, a=56): m.glow_at(cx + .5, cy + .5, glow(size, col, a))


def blob(rows, x0, y0):
    """문자 그림('#' = 칸)으로 덩이 칸 집합."""
    return {(x0 + i, y0 + j) for j, r in enumerate(rows) for i, ch in enumerate(r) if ch == '#'}


def UNDER(cells, sheet):
    cells = {c for c in cells if m.inb(*c) and m.fl[c[1]][c[0]] is not None}
    m.under.append((cells, sheet)); return cells


BX = lambda w, h: [(dx, -dy) for dx in range(w) for dy in range(h)]

# ================================================================ 1. 맨 바탕(방·통로)
# 현관·계단 홀 A
R(25, 11, 34, 22, 'hm_foyer')
CUT(25, 11); CUT(34, 11)
R(29, 23, 30, 24, 'hm_foyer', 1)                      # 남쪽 출입구(맨 아래 칸 = 밖으로 나가는 칸)
# 연회장 B
R(6, 10, 19, 19, 'hm_checker')
CUT(6, 19); CUT(19, 19); CUT(6, 10)
R(20, 14, 24, 16, 'hm_foyer', 2)                      # B ↔ A 복도
# 거미줄 서재 C (연회장 남쪽, 북쪽 벽을 뚫은 문간으로)
R(4, 24, 15, 31, 'hm_rotten')
CUT(15, 31); CUT(4, 31)
R(8, 20, 9, 23, 'hm_rotten', 1)                       # B ↔ C 문간(앞면 3줄을 뚫은 통로)
# 응접실 D
R(38, 12, 51, 19, 'hm_boards')
CUT(51, 19); CUT(38, 12)
R(35, 15, 37, 17, 'hm_foyer', 2)                      # A ↔ D 문간
# 계단방 F (응접실 북쪽, 잠긴 문 너머)
R(43, 3, 49, 8, 'hm_rotten')
CUT(43, 8)
R(47, 9, 48, 11, 'hm_rotten', 1)                      # 잠긴 문 통로
# 지하 포도주 창고 G
R(16, 38, 47, 43, 'hm_cellar', 3, 'mcellar')
R(10, 40, 15, 43, 'hm_cellar', 2, 'mcellar')          # 서쪽 통 곁방
R(48, 39, 53, 43, 'hm_cellar', 3, 'mcellar')          # 동쪽 곁방
CUT(16, 38); CUT(53, 39)
m.compute_faces()

if os.environ.get('STAGE') == 'bare':
    m.render().save(os.path.join(OUT, '_qa', 'bare.png')); sys.exit()

DS, CW, MD, CP, BN = HP.DS, HP.CW, HP.MD, HP.CP, HP.BN
# ================================================================ 2. 땅 덩이 오토타일(맨 바탕 위, 소품 아래) + 카펫 길
# --- 현관·계단 홀 A
UNDER({(x, y) for x in (29, 30) for y in range(15, 23)}, CP)                         # 입구 → 계단 발치 카펫
UNDER(blob(["##  ", "### ", "####", " ## "], 25, 12), MD)                           # 판자 창 밑 물 얼룩
UNDER(blob([" ##", "###", " ##"], 32, 14), CW)                                      # 시계 곁 거미줄
UNDER(blob(["#  ", "## ", "###", " ##"], 25, 19), DS)                                # 남서 구석 먼지
UNDER(blob(["  #", " ##", "###"], 32, 20), DS)
# --- 연회장 B
UNDER({(x, y) for x in range(9, 16) for y in range(14, 19)} - {(9, 18), (15, 14)}, CP)    # 식탁 밑 낡은 카펫
UNDER(blob([" ##", "###", "  #"], 17, 10), CW)
UNDER(blob(["## ", "###", "## "], 6, 15), CW)
UNDER(blob(["  ##  ", "######"], 10, 18), DS)
UNDER(blob(["#", "##", " #"], 17, 13), DS)
# --- 서재 C
UNDER(blob(["  ##", " ###", "####", " ## "], 12, 25), CW)
UNDER(blob(["##  ", "### ", "##  "], 4, 28), CW)
UNDER(blob([" ### ", "#####"], 7, 29), DS)
UNDER(blob(["##", "#"], 10, 25), DS)
# --- 응접실 D
UNDER(blob(["  ### ", " #####", "######", "  ##  "], 46, 12), MD)                   # 창 밑 물 얼룩
UNDER(blob(["   ##", "  ###", " ####", "#### "], 47, 16), CW)
UNDER(blob(["##   ", "#### "], 41, 18), DS)
UNDER(blob([" ##", "###"], 43, 13), DS)
# --- 계단방 F
UNDER(blob([" ###", "####", "## "], 46, 3), CW)
UNDER(blob(["##", "#"], 43, 5), DS)
# --- 지하 포도주 창고 G
UNDER(blob(["  ####  ", " ###### ", "########", "  ##### "], 18, 40), MD)
UNDER(blob(["   ###", " #####", "######"], 34, 41), MD)
UNDER(blob(["##  ", "### ", "####"], 10, 41), MD)
UNDER(blob(["###", "## ", "#  "], 17, 38), CW)
UNDER(blob(["  ##", " ###", "####"], 50, 40), CW)
UNDER(blob([" ## ", "####"], 28, 42), DS)
UNDER(blob(["####", " ###", "  # "], 25, 38), CW)

# ================================================================ 3. 건물 조각·소품
# --- 현관·계단 홀 A
DEC('window_boarded', 26, 8); DEC('stair_landing_dark', 28, 8); DEC('portrait_empty', 32, 8)
STAIR_WALK = {(1, 0), (2, 0), (1, -1), (2, -1)}
P('grand_stair_broken', 28, 14, block=[(dx, -dy) for dx in range(4) for dy in range(4) if (dx, -dy) not in STAIR_WALK])
P('grandfather_clock', 33, 13)
P('candelabra_lit', 27, 15); P('candelabra_out', 32, 15); glowc(27, 14)
P('urn_dead_flowers', 26, 14); P('urn_dead_flowers', 33, 22); P('candelabra_out', 21, 14)
P('coat_rack', 27, 22)
P('hall_bench', 25, 18); P('console_table', 33, 18)
P('raven_bust', 25, 21)
P('chandelier_fallen', 31, 20)
FD('portrait_fallen', 31, 16)
for (x, y) in ((32, 19), (26, 16)): FD('plaster_debris', x, y)
FD('vase_broken', 32, 17); FD('plaster_debris', 27, 19)
FD('doormat_torn', 29, 23)
# --- 연회장 B
DEC('portrait_empty', 7, 7); DEC('window_boarded', 9, 7); DEC('window_boarded', 14, 7); DEC('sconce_lit', 16, 8); DEC('portrait_empty', 17, 7)
glowc(16, 8, size=40, a=46)
P('fireplace', 11, 10, block=[(0, 0), (1, 0), (2, 0)])
glowc(12, 9, (200, 110, 60), 40, 34)
P('armchair_torn', 10, 12); P('armchair_torn', 14, 12)
P('banquet_table', 10, 16, block=BX(5, 2))
for x in (11, 13): P('chair_high', x, 14)
P('chair_high', 9, 16); P('chair_toppled', 15, 16); P('chair_toppled', 11, 17); P('chair_high', 13, 18)
P('candelabra_lit', 7, 12); P('candelabra_lit', 18, 12); glowc(7, 11); glowc(18, 11)
P('candelabra_out', 7, 18)
P('console_table', 6, 15); P('chair_toppled', 18, 14); FD('vase_broken', 17, 15); FD('portrait_fallen', 7, 11)
P('floor_hole', 17, 18, block=BX(2, 2))
for (x, y) in ((16, 18), (18, 16), (16, 13)): FD('plaster_debris', x, y)
# --- 서재 C
P('doorframe_broken', 8, 23, block=[])
for x in (4, 6, 10, 12): P('bookcase_dusty', x, 24, block=[(0, 0), (1, 0)])
DEC('cobweb_wall_r', 14, 21)
P('desk_cobweb', 5, 27, block=BX(2, 2)); P('armchair_torn', 7, 28)
P('globe_stand', 13, 27)
P('bookcase_toppled', 10, 30, block=BX(3, 2))
for (x, y) in ((9, 30), (13, 30), (8, 26), (12, 28), (4, 26)): FD('book_spill', x, y)
P('candelabra_lit', 14, 25); glowc(14, 24)
P('candelabra_out', 4, 30)
P('trunk_old', 14, 31)
# --- 응접실 D
P('door_locked', 47, 11, block=[(0, 0), (1, 0)], check=False)
m.hidden |= {(47, 11), (48, 11)}                                                # 열쇠로 여는 문: 통행 검사에서는 열린 것으로 본다
DEC('mirror_broken', 40, 9); DEC('portrait_oval', 43, 9); DEC('window_boarded', 50, 9)
DEC('sconce_lit', 45, 10); DEC('sconce_out', 49, 10); glowc(45, 10, size=40, a=46)
FD('portrait_fallen', 42, 12)
P('piano_upright', 50, 13, block=BX(2, 2))
for (x, y) in ((40, 12), (41, 13)): FD('mirror_shards', x, y)
FD('rug_round', 41, 16)
P('rocking_chair', 42, 17); P('side_table', 44, 17)
P('sofa_sheeted', 46, 16, block=[(0, 0), (1, 0), (2, 0)])
P('chair_sheeted', 50, 17); P('chair_sheeted', 45, 19); P('armchair_torn', 49, 18)
P('birdcage', 38, 19); P('console_table', 40, 19);
P('candelabra_lit', 39, 13); glowc(39, 12)
# --- 계단방 F
P('cellar_stair_down', 44, 6, block=[(0, 0), (0, -1), (0, -2), (2, 0), (2, -1), (2, -2), (1, -2)])
DEC('cobweb_wall', 43, 0); DEC('cobweb_wall_r', 48, 0)
P('crate_stack', 49, 5); P('crate_rotten', 49, 6); P('sack_pile', 43, 4); P('barrel_small', 48, 3); P('trunk_old', 44, 8)
P('lantern_floor', 49, 8); glowc(49, 8)
# --- 지하 포도주 창고 G
P('cellar_stair_up', 44, 41, block=[(0, 0), (0, -1), (0, -2), (0, -3), (2, 0), (2, -1), (2, -2), (2, -3)])
for x in (17, 20, 24, 28, 36, 40): P('wine_rack', x, 38, block=[(0, 0), (1, 0)])
for x in (49, 51): P('wine_rack', x, 39, block=[(0, 0), (1, 0)])
for x in (22, 32, 40): P('cellar_pillar', x, 41)
for x in (18, 26, 34): P('cask_cradle', x, 43, block=[(0, 0), (1, 0)])
P('barrel_stack', 10, 43, block=BX(2, 2)); P('barrel_small', 12, 43); P('crate_rotten', 15, 40); P('sack_pile', 10, 40)
P('crate_stack', 53, 43); P('barrel_small', 48, 43); P('sack_pile', 50, 43)
P('lantern_floor', 30, 39); glowc(30, 39, size=64); P('lantern_floor', 52, 41); glowc(52, 41)
for (x, y) in ((21, 39), (37, 40), (27, 41), (43, 43)): FD('bottles_broken', x, y)
P('barrel_small', 19, 38); P('crate_rotten', 23, 38); P('barrel_small', 34, 38); P('sack_pile', 31, 43)
P('crate_stack', 38, 43); P('barrel_small', 39, 43); P('trunk_old', 42, 43)
if BAD: print('배치 오류', BAD)

if os.environ.get('STAGE') == 'props':
    m.render().save(os.path.join(OUT, '_qa', 'props.png')); sys.exit()

# ================================================================ 4. 통행(층 이동 고리를 더한 BFS)·빈 바닥·내보내기
LINKS = [((45, 5), (45, 38))]
def bfs_all(start):
    from collections import deque
    adj = {}
    for a, b in LINKS: adj.setdefault(a, []).append(b); adj.setdefault(b, []).append(a)
    seen = {start: 0}; q = deque([start])
    while q:
        c = q.popleft()
        for n in [(c[0] + 1, c[1]), (c[0] - 1, c[1]), (c[0], c[1] + 1), (c[0], c[1] - 1)] + adj.get(c, []):
            if n not in seen and m.is_walk(*n): seen[n] = seen[c] + 1; q.append(n)
    return seen
ENT = (29, 24)
m.render()
reach = bfs_all(ENT)
WP = {'출입구': (29, 24), '큰 계단 발치': (29, 13), '홀 가운데': (30, 18), '연회장 벽난로 앞': (12, 11), '식탁 남쪽': (12, 19), '연회장 서남 구석': (8, 18),
      '서재 문간': (8, 23), '서재 책상 앞': (5, 29), '서재 동남': (13, 29), '응접실 흔들의자 곁': (43, 18), '피아노 앞': (50, 15), '잠긴 문 앞': (47, 12),
      '계단방(문 너머)': (47, 8), '계단방 북쪽': (47, 3), '지하 도착': (45, 38), '지하 서쪽 곁방': (13, 41), '지하 동쪽 곁방': (50, 42), '지하 가운데': (30, 41)}
wp_res = {k: dict(at=list(v), reach=v in reach, steps=reach.get(v)) for k, v in WP.items()}
hid = set(m.hidden); m.hidden = set(); reach_nohid = bfs_all(ENT); m.hidden = hid
walk_total = sum(1 for y in range(H_) for x in range(W_) if m.is_walk(x, y))
unreached = sorted(c for c in ((x, y) for y in range(H_) for x in range(W_)) if m.is_walk(*c) and c not in reach)
emp = dcheck.emptiness(m)
blobcells = set()
for cells, sh in m.under: blobcells |= cells
def emp_with_blobs():
    """같은 20×15 창 빈 바닥 비율 — 땅 덩이 오토타일(먼지·거미줄·곰팡이·카펫)이 덮은 칸도 쓰인 칸으로 센다(참고 값)."""
    used = set(blobcells)
    for (x, y, img, w, h, layer) in m.props:
        for dy in range(-(-img.height // T)):
            for dx in range(-(-img.width // T)): used.add((x + dx, y - dy))
    for (x, y, img) in m.decals:
        for dy in range(max(1, -(-img.height // T))):
            for dx in range(max(1, -(-img.width // T))): used.add((int(x) + dx, int(y) + dy))
    best = (0, None)
    for y0 in range(0, H_ - 15 + 1, 2):
        for x0 in range(0, W_ - 20 + 1, 2):
            e = sum(1 for y in range(y0, y0 + 15) for x in range(x0, x0 + 20) if m.fl[y][x] is not None and (x, y) not in used and (x, y) not in m.blocked)
            if e / 300.0 > best[0]: best = (round(e / 300.0, 3), (x0, y0))
    return dict(max=best[0], at=best[1])
EMPB = emp_with_blobs()
print('walk', walk_total, 'reached', len(reach), 'unreached', len(unreached), unreached[:12])
print('wp', {k: (v['reach'], v['steps']) for k, v in wp_res.items()})
print('empty', emp, 'with blobs', EMPB)
if os.environ.get('STAGE') == 'metrics': sys.exit()
