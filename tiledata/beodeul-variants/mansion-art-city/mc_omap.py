# 저택·예술 도시 야외 지도(64×38). 서쪽 = 귀족 저택 영지(담·쇠 울타리·대문, 앞마당 정원 분수·마차, 회양목 화단 정원),
# 동쪽 = 예술 거리(화랑·화방·카페·화가 작업실 집, 대리석 조각 광장과 큰 분수, 이젤 노점), 남쪽 = 동서 큰길.
# 땅은 버들항 파이프라인: ground.render(칩셋 풀 섞기) · terrain.paving(칩셋 거리 돌 + 연석) · roman.paving5(판석·자갈 + 연석).
# 나무는 칩셋 나무(city6 의 TREES 자리)를 그대로 잘라 쓰고 좌우·색조 변형으로 반복을 깬다.
import colorsys
from mc_base import *
from mc_base import _hash
import ground as G
import mc_ground as MG
import mc_build as B
import mc_props as MP
import kits7_manor as KM          # 버들항 저택 정원 조각(꽃밭·덤불) — 기존 그림, 다시 내보내지 않음
import mc_fix as FX               # 보정 패스: 헤링본 대로·로터리·연못·꽃밭·낙엽 오토타일

W, H = 64, 38
TREES = {'oakA': (224, 512, 4, 5), 'oakB': (288, 512, 3, 4), 'bushC': (336, 512, 2, 2), 'bushD': (368, 512, 3, 3), 'bushE': (368, 560, 2, 2)}


def chip_tree(k, v=0):
    x, y, w, h = TREES[k]; im = terrain.CH.crop((x, y, x + w * 16, y + h * 16)).convert('RGBA')
    if v % 2: im = flip(im)
    if v >= 2:
        o = im.copy(); p = o.load(); dh, dv = (.018, 1.07) if v == 2 else (-.02, .92)
        for yy in range(o.height):
            for xx in range(o.width):
                r, g, b, a = p[xx, yy]
                if not a: continue
                h_, s_, v_ = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
                if s_ > .18: h_ = (h_ + dh) % 1
                rr, gg, bb = colorsys.hsv_to_rgb(h_, s_, max(0, min(1, v_ * dv))); p[xx, yy] = (round(rr * 255), round(gg * 255), round(bb * 255), a)
        im = o
    return im


def foot(img, rows=1, soft=True, thr=10):
    """SPEC §2 발자국: soft = 맨 아랫줄에서 아래 반이 칠해진 칸만, solid = 아래 rows 줄에서 칠해진 칸."""
    out = []; cols = img.width // T; a = np.array(img.split()[3])
    for r in range(rows):
        for cx in range(cols):
            y1 = img.height - r * T
            n = int((a[y1 - T:y1, cx * T:cx * T + T] > 0).sum()); lo = int((a[y1 - 8:y1, cx * T:cx * T + T] > 0).sum())
            if (soft and r == 0 and lo >= thr) or (not soft and n >= 40): out.append((cx, -r))
    return out


class OMap:
    def __init__(s):
        s.road = np.zeros((H, W), bool); s.plaza = np.zeros((H, W), bool); s.brick = np.zeros((H, W), bool); s.gravel = np.zeros((H, W), bool)
        s.gpath = set(); s.fence = set(); s.hedge = set(); s.wallm = np.zeros((H, W), bool)
        s.avenue = np.zeros((H, W), bool); s.rotaries = []; s.pond = set(); s.beds = {}; s.litter = set()
        s.block = set(); s.occ = {}; s.objs = []; s.ground_objs = []; s.trees = []; s.doors = {}; s.bshadow = []; s.BAD = []
    def free(s, cells):
        return all(0 <= x < W and 0 <= y < H and (x, y) not in s.occ for x, y in cells)
    def claim(s, cells, name):
        for c in cells: s.occ[c] = name
    def building(s, name, h, x, bottom, frows, door=None):
        im = I(h); below = h.get('below', 0) if isinstance(h, dict) else 0
        fw = -(-im.width // T); hb = im.height - below
        px, py = x * T, (bottom + 1) * T - hb
        cells = [(x + i, bottom - j) for i in range(fw) for j in range(frows)]
        if not s.free(cells): s.BAD.append(('bld', name, [c for c in cells if c in s.occ][:3]))
        s.claim(cells, name); s.block |= set(cells)
        rows_up = -(-hb // T)
        for i in range(fw):                                                  # 지붕·처마 칸: 걷기 + 가림(소품 금지)
            for j in range(frows, rows_up):
                c = (x + i, bottom - j)
                if c not in s.occ: s.occ[c] = name + ':roof'
        if door is not None:
            d = (x + door, bottom); s.block.discard(d); s.doors[name] = d
        s.objs.append((im, px, py, (bottom + 1) * T)); s.bshadow.append((im, px, py))
    def prop(s, name, im, x, bottom, rows=1, soft=True, block=None, claim=True):
        im = I(im)
        fw, fh = im.width // T, -(-im.height // T)
        blk = foot(im, rows, soft) if block is None else block
        bc = [(x + bx, bottom + by) for bx, by in blk]
        if claim:
            cells = bc if bc else [(x + i, bottom) for i in range(fw)]
            if not s.free(cells): s.BAD.append(('prop', name, x, bottom, [c for c in cells if c in s.occ][:2]))
            s.claim(cells, name)
        s.block |= set(bc)
        s.objs.append((im, x * T, (bottom + 1) * T - im.height, (bottom + 1) * T))
    def tree(s, k, x, bottom, v=None):
        im = chip_tree(k, int(_hash(x, bottom, 77) * 4) if v is None else v)
        w = im.width // T
        trunk = [(w // 2 - (1 if w % 2 == 0 else 0), 0), (w // 2, 0)] if w >= 3 else [(w // 2 if w > 1 else 0, 0)]
        s.prop('tree', im, x, bottom, block=sorted(set(trunk)))
        s.trees.append((x * T, (bottom + 1) * T - im.height, im.width, im.height))

    # ---------------------------------------------------------------- 그리기
    def render(s):
        rm = np.zeros((H * T, W * T), bool)
        for m in (s.road, s.plaza, s.brick, s.gravel, s.avenue):
            rm |= np.kron(m, np.ones((T, T), bool))
        img, _ = G.render(W * T, H * T, s.trees, rm)
        ANY = (s.plaza | s.brick | s.gravel | s.avenue).tolist()
        img.alpha_composite(terrain.paving(s.road.tolist(), 160, 96, joins=ANY))
        R_ = s.road.tolist()
        img.alpha_composite(roman.paving5((s.brick).tolist(), MG.brick_px, joins=(s.road | s.plaza | s.avenue).tolist(), edge=roman.TC))
        img.alpha_composite(FX.avenue_paving(s.avenue.tolist(), (s.road | s.plaza | s.brick).tolist(), s.rotaries))
        img.alpha_composite(roman.paving5(s.plaza.tolist(), MG.marble_px, joins=(s.road | s.brick | s.avenue).tolist(), edge=MRB))
        img.alpha_composite(roman.paving5(s.gravel.tolist(), roman.tex_gravel, joins=(s.road | s.brick).tolist(), curb=True, edge=roman.GRV))
        gs = MG.autotile_gravel()
        for (x, y) in s.gpath: img.alpha_composite(MG.atile(gs, MG.mask_of(s.gpath | {c for c in zip(*np.nonzero(s.gravel.T))}, x, y)), (x * T, y * T))
        if s.litter: FX.lay(img, FX.autotile_litter(), s.litter)                 # 낙엽·흙 맨땅(걷기, 아래층)
        if s.pond: FX.lay(img, FX.autotile_pond(), s.pond)                       # 정원 연못(막힘)
        for col, cells in s.beds.items(): FX.lay(img, FX.autotile_flowerbed(col), cells)
        for im, x, y in s.ground_objs: img.alpha_composite(im, (x, y))
        sh = Image.new('L', img.size, 0)                                        # 건물 그림자(오른쪽 아래로 6·3px, 버들항 규칙)
        for im, x, y in s.bshadow:
            sh.paste(255, (x + 6, y + 3), im.split()[3].point(lambda v: 255 if v > 128 else 0))
        for im, x, y in s.bshadow:
            sh.paste(0, (x, y), im.split()[3].point(lambda v: 255 if v > 128 else 0))
        shl = Image.new('RGBA', img.size, (27, 16, 36, 0)); shl.putalpha(sh.point(lambda v: 80 if v else 0))
        img.alpha_composite(shl)
        fs = MG.autotile_fence(); hs = MG.autotile_hedge()
        objs = list(s.objs)
        for (x, y) in s.fence: objs.append((MG.atile(fs, MG.mask_of(s.fence | s.fence_join, x, y)), x * T, y * T, (y + 1) * T))
        for (x, y) in s.hedge: objs.append((MG.atile(hs, MG.mask_of(s.hedge, x, y)), x * T, y * T, (y + 1) * T))
        for im, x, y, z in sorted(objs, key=lambda o: (o[3], o[1])): img.alpha_composite(im, (int(x), int(y)))
        s.img = img
        return img

    def walk(s, x, y):
        return 0 <= x < W and 0 <= y < H and (x, y) not in s.block

    def bfs(s, a, b):
        from collections import deque
        q = deque([a]); seen = {a}
        while q:
            c = q.popleft()
            if c == b: return True
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                n = (c[0] + dx, c[1] + dy)
                if n not in seen and s.walk(*n): seen.add(n); q.append(n)
        return False

    def dist(s, a):
        from collections import deque
        q = deque([a]); d = {a: 0}
        while q:
            c = q.popleft()
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                n = (c[0] + dx, c[1] + dy)
                if n not in d and s.walk(*n): d[n] = d[c] + 1; q.append(n)
        return d


def build(S):
    """S: 새 조각 이름 → 그림(건물은 dict). 반환 (지도, 이름 붙은 지점)."""
    m = OMap(); m.fence_join = set()
    def rect(arr, x0, y0, x1, y1): arr[y0:y1 + 1, x0:x1 + 1] = True
    # ---------------- 길·포장
    rect(m.road, 0, 34, 63, 35)
    # 보정: 큰 벽돌 대로(x31~34) = 헤링본 + 어두운 테두리 띠, 큰길과 만나는 남쪽 끝은 교차 광장(x31~39, y26~33, 가운데 로터리)
    rect(m.avenue, 31, 0, 34, 33); rect(m.avenue, 35, 26, 39, 33); rect(m.brick, 45, 26, 48, 33)
    m.rotaries.append((36 * T, 30 * T, 58.0))
    rect(m.plaza, 35, 11, 62, 25)
    rect(m.gravel, 3, 12, 28, 17)
    for y in range(18, 33):
        for x in (14, 15, 16): m.gpath.add((x, y))
    for x in range(3, 29):
        m.gpath.add((x, 25))
    for x in (14, 15, 16): m.gpath.add((x, 33))
    # ---------------- 영지 담·울타리·대문
    wm = [[False] * 31 for _ in range(34)]
    for y in range(2, 34): wm[y][1] = True
    for x in range(1, 31): wm[2][x] = True
    for y in range(2, 12): wm[y][30] = True
    for x in list(range(1, 13)) + list(range(18, 31)): wm[33][x] = True
    for y in range(34):
        for x in range(31):
            if wm[y][x]: m.block.add((x, y)); m.occ[(x, y)] = 'wall'
    m.ground_objs.append((B.estate_wall_noble(wm), 0, 0))
    for y in range(12, 33): m.fence.add((30, y)); m.block.add((30, y)); m.occ[(30, y)] = 'fence'
    m.fence_join = {(30, 11), (30, 33)}
    for x in (13, 17): m.prop('gate_pier', S['gate_pier'], x, 33, block=[(0, 0)])
    m.prop('gate_iron', S['gate_iron'], 14, 33, block=[])
    # ---------------- 저택
    m.building('mansion', S['mansion_slate'], 7, 11, 4, door=8)
    for x in range(11, 20):
        for y in (6, 7): m.block.add((x, y)); m.occ[(x, y)] = 'mansion'
    for x, k in ((2, 'oakB'), (5, 'bushC')): m.tree(k, x, 6 if k == 'oakB' else 9)
    m.tree('bushE', 2, 11); m.tree('oakB', 24, 7); m.tree('bushD', 27, 10)
    # 앞마당
    m.prop('fountain_garden', S['fountain_garden'], 14, 17, rows=2, soft=False)
    m.prop('lamp', S['lamp_gilt'], 12, 13); m.prop('lamp', S['lamp_gilt'], 18, 13)
    m.prop('carriage', S['carriage_noble'], 22, 15, rows=1, soft=False)
    m.prop('topiary', S['topiary_spiral'], 3, 13); m.prop('topiary', S['topiary_spiral'], 28, 13)
    m.prop('urn', S['urn_flowers'], 9, 13); m.prop('urn', S['urn_flowers'], 21, 13)
    m.prop('topiary', S['topiary_cone'], 3, 17); m.prop('topiary', S['topiary_cone'], 28, 17)
    m.prop('bench', S['bench_marble'], 6, 17, block=[(0, 0), (1, 0)]); m.prop('bench', S['bench_marble'], 23, 17, block=[(0, 0), (1, 0)])
    m.prop('lamp2', S['lamp_gilt_double'], 6, 14, block=[(1, 0)])
    for (x, b) in ((10, 16), (20, 16)): m.prop('tball', S['topiary_ball'], x, b, block=[(0, 0)])
    for (x, b) in ((26, 15), (3, 15)): m.prop('urn', S['urn_flowers'], x, b)
    # 정원(회양목 화단 넷 × 둘, 생울타리, 장미 아치)
    for y in range(18, 33):
        if y in (24, 25, 26): continue
        for x in (13, 17):
            if y == 30: continue                                               # 보정: 축 길에서 연못·꽃밭 구획으로 드는 틈
            m.hedge.add((x, y)); m.block.add((x, y)); m.occ[(x, y)] = 'hedge'
    for i, (x, b) in enumerate(((4, 22), (8, 22), (19, 22), (23, 22))):
        m.prop('parterre', S['parterre_bed'] if i % 2 == 0 else S['parterre_bed_b'], x, b, rows=2, soft=False)
    # 보정: 서쪽 아래 구획 = 불규칙 정원 연못(분수와 별개), 동쪽 아래 구획 = 세 색 꽃밭 덩이
    POND = ('......XXXX...', '....XXXXXXX..', '....XXXXXXXX.', '.....XXXXXX..', '.......XXX...')
    for j, row in enumerate(POND):
        for i, ch in enumerate(row):
            if ch == 'X': m.pond.add((i, 28 + j))
    BEDS = {'red':    ('..RR.......', '.RRRR......', '..RR.......', '...........', '...........'),
            'yellow': ('........YY.', '.......YYY.', '........Y..', '...........', '...........'),
            'white':  ('...........', '...........', '...........', '....WWW....', '...WWWWW...')}
    for col, rows in BEDS.items():
        cells = set()
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch != '.': cells.add((18 + i, 28 + j))
        m.beds[col] = cells
    for c in set(m.pond) | {c for v in m.beds.values() for c in v}:
        m.block.add(c); m.occ[c] = 'pond' if c in m.pond else 'bed'
    m.prop('rose_arch', S['rose_arch'], 14, 23, block=[(0, 0), (2, 0)])
    m.prop('sundial', S['sundial'], 15, 29, block=[(0, 0)])
    for x in (14, 16): m.prop('tball', S['topiary_ball'], x, 27, block=[(0, 0)])
    m.prop('statue', S['statue_winged'], 27, 23, rows=1, soft=False)
    m.prop('statue', S['statue_winged'], 2, 32, rows=1, soft=False)
    m.prop('bench', S['bench_marble'], 5, 24, block=[(0, 0), (1, 0)]); m.prop('bench', S['bench_marble'], 23, 24, block=[(0, 0), (1, 0)])
    for x in list(range(3, 13)) + list(range(18, 29)):
        m.hedge.add((x, 19)); m.block.add((x, 19)); m.occ[(x, 19)] = 'hedge'
    for x in list(range(4, 12)) + list(range(19, 27)):
        m.hedge.add((x, 27)); m.block.add((x, 27)); m.occ[(x, 27)] = 'hedge'
    m.tree('bushE', 27, 32); m.tree('bushE', 2, 20)
    for (x, b) in ((12, 27), (18, 27), (3, 27)): m.prop('tcone', S['topiary_cone'], x, b)
    for i, (x, b) in enumerate(((4, 20), (7, 20), (11, 20), (20, 20), (23, 20), (26, 20), (5, 26), (8, 28), (21, 26), (24, 28), (6, 23), (24, 23), (10, 26), (20, 28), (22, 28), (26, 28), (5, 28), (11, 28), (18, 32), (25, 32), (12, 23), (18, 23), (19, 24), (11, 24), (10, 32), (20, 32), (23, 32), (6, 32))):
        if (x, b) in m.occ: continue                                         # 보정: 연못·꽃밭 자리의 옛 꽃 점은 뺀다
        m.prop('flowers', KM.flower_patch(i + 3), x, b, block=[], claim=True)
    for (x, b) in ((27, 27), (2, 25), (27, 20)): m.prop('bush', KM.bush('c' if x > 10 else 'e'), x, b)
    # ---------------- 예술 거리 북쪽 줄(화방·화랑·카페·화가 작업실)
    m.building('artshop', S['shop_house'], 36, 10, 4, door=2)
    m.building('gallery', S['gallery_copper'], 42, 10, 4, door=4)
    m.building('cafe', S['cafe_house'], 52, 10, 4, door=2)
    m.building('atelier', S['atelier_house'], 59, 10, 6, door=1)
    for (k, x, b) in (('oakB', 35, 2), ('bushE', 41, 1), ('oakA', 50, 2), ('bushC', 57, 1)): m.tree(k, x, b)
    # 광장
    m.prop('fountain_grand', S['fountain_grand'], 45, 21, rows=3, soft=False)
    m.prop('statue', S['statue_muse'], 40, 22, rows=1, soft=False)
    m.prop('statue', S['statue_winged'], 52, 22, rows=1, soft=False)
    for (k, x) in (('sculpture_spiral', 38), ('bust_pedestal', 43), ('bust_pedestal', 50), ('sculpture_ring', 55)): m.prop('sc', S[k], x, 25, block=[(0, 0)])
    m.prop('bench', S['bench_marble'], 41, 15, block=[(0, 0), (1, 0)])
    m.prop('parterre', S['parterre_bed'], 41, 17, rows=2, soft=False); m.prop('parterre', S['parterre_bed_b'], 50, 17, rows=2, soft=False)
    for x in (43, 49): m.prop('treepl', pz.fin(pz.tree_planter()), x - 1 if x == 43 else x, 13, block=[(0, 0), (1, 0)])
    m.prop('stall2', S['painter_stall'], 36, 15, rows=2, soft=False)
    for (x, b) in ((39, 25), (54, 25), (57, 25)): m.prop('urn', S['urn_flowers'], x, b)
    m.prop('bench', S['bench_marble'], 44, 24, block=[(0, 0), (1, 0)]); m.prop('bench', S['bench_marble'], 48, 24, block=[(0, 0), (1, 0)])
    m.prop('urn', S['urn_flowers'], 44, 12); m.prop('urn', S['urn_flowers'], 48, 12)
    m.prop('lamp2', S['lamp_gilt_double'], 39, 12, block=[(1, 0)]); m.prop('lamp2', S['lamp_gilt_double'], 60, 24, block=[(1, 0)])
    m.prop('lamp', S['lamp_gilt'], 42, 19); m.prop('lamp', S['lamp_gilt'], 51, 19)
    # 카페 테라스
    m.prop('parasol', S['cafe_parasol'], 51, 14, rows=1, soft=False, block=[(0, 0), (1, 0), (2, 0)])
    m.prop('parasol', S['cafe_parasol_b'], 56, 14, rows=1, soft=False, block=[(0, 0), (1, 0), (2, 0)])
    m.prop('cafe', S['cafe_table'], 57, 11, block=[(0, 0), (1, 0)])
    for x in (53, 57): m.prop('planter', S['terrace_planter'], x, 16, block=[(0, 0), (1, 0)])
    m.prop('poster', S['poster_column'], 61, 14)
    # 화가 노점(광장 서쪽)
    m.prop('stall', S['painter_stall'], 35, 19, rows=2, soft=False)
    m.prop('screen', S['art_screen'], 35, 23, block=[(0, 0), (1, 0)])
    m.prop('easel', S['easel_landscape'], 39, 15); m.prop('easel', S['easel_flowers'], 39, 18)
    m.prop('easel_set', S['easel_set'], 37, 22, block=[(0, 0), (1, 0)])
    m.prop('canvas', S['canvas_stack'], 38, 19, block=[(0, 0)])
    m.prop('easel', S['easel_sea'], 58, 21); m.prop('easel', S['easel_landscape'], 56, 19)
    m.prop('canvas', S['canvas_stack_b'], 59, 19, block=[(0, 0)])
    m.prop('tcone', S['topiary_cone'], 62, 21)
    # ---------------- 남쪽 줄(큰길을 보는 집)
    # 보정: 대로 교차 광장(옛 house_s1 자리) — 로터리 원판 위 날개 조각상, 네 귀 금 가로등, 꽃 항아리
    m.prop('statue', S['statue_winged'], 35, 30, rows=1, soft=False)
    for (x, b) in ((31, 26), (39, 26), (31, 33), (39, 33)): m.prop('lamp', S['lamp_gilt'], x, b)
    for (x, b) in ((33, 27), (38, 27)): m.prop('urn', S['urn_flowers'], x, b)
    m.building('house_s2', S['atelier_low'], 40, 33, 4, door=1)
    m.building('house_s3', S['shop_house_b'], 49, 33, 4, door=2)
    m.building('house_s4', S['house_b'], 55, 33, 4, door=2)
    m.building('house_s5', S['house_c'], 60, 33, 4, door=1)
    m.prop('lamp', S['lamp_gilt'], 45, 28); m.prop('lamp', S['lamp_gilt'], 48, 31)
    # 나무(북쪽 지붕 뒤, 동쪽 끝)
    for (k, x, b) in (('bushE', 0, 1), ('bushC', 58, 1)): pass
    # ---------------- 큰길 남쪽 보도: 가로등·나무
    for x in (4, 12, 20, 28, 37, 46, 55):
        m.prop('lamp', S['lamp_gilt'], x, 36)
    for i, x in enumerate((0, 7, 15, 23, 31, 40, 50, 59)):
        m.tree(('bushC', 'bushE', 'bushD')[i % 3], x + 1, 37)
    m.prop('bench', S['bench_marble'], 9, 36, block=[(0, 0), (1, 0)]); m.prop('bench', S['bench_marble'], 43, 37, block=[(0, 0), (1, 0)])
    m.prop('urn', S['urn_flowers'], 26, 37); m.prop('urn', S['urn_flowers'], 53, 37)
    # 보정: 나무 밑·의자 앞·길 모퉁이의 밟힌 흙과 낙엽(autotile-leaf-litter, 걷기)
    LIT = [((2, 7), ('XXX.', 'XXXX', '.XX.')), ((23, 8), ('.XXX', 'XXXX', '..X.')), ((6, 36), ('..X..', 'XXXXX')),
           ((40, 36), ('XXX..', '.XXXX')), ((37, 0), ('XXX.', '.XXX')), ((46, 0), ('XXX', '.XX')), ((58, 36), ('.XX', 'XXX'))]
    for (ox, oy), rows in LIT:
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                c = (ox + i, oy + j)
                if ch == 'X' and 0 <= c[0] < W and 0 <= c[1] < H and not (m.road[c[1], c[0]] or m.plaza[c[1], c[0]] or m.avenue[c[1], c[0]]): m.litter.add(c)
    marks = dict(entrance=(33, 35), mansion_door=m.doors['mansion'], gallery_door=m.doors['gallery'], cafe_door=m.doors['cafe'],
                 shop_door=m.doors['artshop'], atelier_door=m.doors['atelier'], fountain_front=(46, 22), sundial=(15, 28),
                 garden_west=(3, 28), garden_east=(24, 30), stall=(36, 20), statue_muse=(40, 23), estate_gate=(15, 33))
    for k in ('house_s2', 'house_s3', 'house_s4', 'house_s5'): marks[k] = m.doors[k]
    marks['junction_statue'] = (35, 31); marks['pond_shore'] = (12, 30); marks['flowerbeds'] = (19, 31)
    return m, marks
