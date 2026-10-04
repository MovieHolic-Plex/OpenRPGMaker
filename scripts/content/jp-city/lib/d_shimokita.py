from dcommon import *
import os, jpenv
os.makedirs(jpenv.DISTRICTS_OUT, exist_ok=True)
# import export2; export2.export()   # 칩셋은 이미 최신(감독자가 내보냄)
from PIL import ImageDraw
kit = load(); rng = random.Random(51)
NC, NR = 96, 64
d = District(kit, NC, NR)
d.fill(0, 0, NR, NC, 'sw')

# ================================================================== 도로 정의
# 一番街 본통(보행자 우선, 3~4칸): 조각마다 위·아래 행이 어긋나 굽는다 (x0,x1,위행,아래행(미포함))
A1 = [(0, 14, 12, 16), (14, 22, 11, 15), (22, 28, 10, 14), (28, 40, 9, 12), (40, 46, 10, 14), (46, 58, 12, 15), (58, 64, 11, 15), (64, 92, 12, 16)]
# 南口 거리(보행자 우선)
SS = [(0, 24, 38, 42), (24, 30, 38, 43), (30, 38, 39, 43), (38, 53, 39, 46), (53, 58, 38, 43), (58, 92, 38, 42)]
EAST = (92, 96)                    # 동쪽 세로 골목(あずま通り형, 차량 가능)
LANE = (53, 56)                    # 남쪽 일방통행 생활도로(3칸, 차 2대)
PATH = (24, 28)                    # 선로가이 보행로(4칸)
V1 = (47, 53)                      # 南口 세로 큰 거리(6칸)
G1 = (14, 17)                      # 막다른 골목 (북)
G2 = (54, 57)                      # 2~3칸 세로 골목 (북)
DIAG = (31, 48)                    # 북쪽 빈터(대각선 골목)
DIAG2 = (14, 28)                   # 남쪽 빈터(대각선 골목)
G3 = (72, 75)                      # 막다른 골목 (남)
PLAZA = (37, 47)                   # 개찰구 앞 광장
HALL = (62, 84)                    # 공터 광장(이벤트)

def vlane(c0, c1, r0, r1, kind='lane_c'):
    for r in range(r0, r1):
        for c in range(c0, c1): d.set(r, c, kind)

# --- 一番街: 포장 보행자 거리 (가장자리 줄은 연석, 가운데는 잔잔한 포장)
for (a, b, t, e) in A1:
    for r in range(t, e):
        for c in range(a, b):
            d.set(r, c, 'pave_a' if (r * 2 + c * 3) % 11 else 'pave_b')
# --- 선로가이 보행로 + 식재대
for r in range(PATH[0], PATH[1]):
    for c in range(NC): d.set(r, c, 'pave_a' if (r * 3 + c) % 9 else 'pave_b')
for c in range(NC): d.set(PATH[1], c, 'plant_strip')
# --- 南口 거리
for (a, b, t, e) in SS:
    for r in range(t, e):
        for c in range(a, b): d.set(r, c, 'pave_a' if (r + c * 2) % 9 else 'pave_b')
# --- 남쪽 생활도로(일방통행): 연석 한 줄 + 노면
for c in range(NC):
    d.set(LANE[0], c, 'lane_n'); d.set(LANE[0] + 1, c, 'lane_c'); d.set(LANE[0] + 2, c, 'lane_s')
    d.set(LANE[1], c, 'sw'); d.set(LANE[0] - 1, c, 'sw')
# --- 세로 골목
vlane(V1[0], V1[1], PATH[1] + 1, NR, 'pave_a')
for r in range(PATH[1] + 1, NR):
    for c in range(V1[0], V1[1]):
        if (r + c) % 7 == 0: d.set(r, c, 'pave_b')
vlane(*G1, 15, 25, 'lane_c'); vlane(*G2, 15, 25, 'lane_c')
vlane(*G3, 43, 52, 'lane_c')
vlane(EAST[0], EAST[1], 0, NR, 'lane_c')
# 개찰구 앞 광장
for r in range(PATH[1] + 1, 38):
    for c in range(PLAZA[0], PLAZA[1]): d.set(r, c, 'pave_a' if (r + c) % 4 else 'pave_b')
for r in range(38, 46):
    for c in range(38, 53): d.set(r, c, 'pave_a' if (r + c) % 4 else 'pave_b')
# --- 북쪽 빈터: 주차장 + 대각선 골목(2칸, 한 칸씩 어긋남)
for r in range(15, 24):
    for c in range(DIAG[0], DIAG[1]): d.set(r, c, 'pave_b' if (r + c) % 5 else 'pave_a')
for r in range(16, 24):
    for c in range(DIAG[1] - 9, DIAG[1]): d.set(r, c, 'lot')
for r in range(16, 24):
    c = DIAG[0] + (r - 16)
    d.set(r, c, 'lane_c'); d.set(r, c + 1, 'lane_c')
for c in range(DIAG[1] - 9, DIAG[1], 5):
    for r in range(17, 24): d.set(r, c, 'lot_line')
# --- 남쪽 빈터: 코인 주차 + 대각선 골목(SS 거리 → 생활도로)
for r in range(43, 52):
    for c in range(DIAG2[0], DIAG2[1]): d.set(r, c, 'pave_b' if (r + c) % 5 else 'pave_a')
for r in range(46, 52):
    for c in range(DIAG2[0] + 6, DIAG2[1]): d.set(r, c, 'lot')
for r in range(43, 52):
    c = DIAG2[0] + int((r - 43) * 0.9)
    d.set(r, c, 'lane_c'); d.set(r, c + 1, 'lane_c')
for c in range(DIAG2[0] + 6, DIAG2[1], 4):
    for r in range(47, 52): d.set(r, c, 'lot_line')
for c in range(DIAG2[0], DIAG2[1]): d.set(52, c, 'sw')
# --- 공터 광장: 포장+잔디 한 판 + 이벤트 구역 + 놀이구역
for r in range(15, 24):
    for c in range(HALL[0], HALL[1]): d.set(r, c, 'pave_a' if (r * 5 + c) % 8 else 'pave_b')
for r in range(16, 24):
    for c in range(HALL[0], HALL[0] + 7): d.set(r, c, 'gravel')
# 뒷골목 옆 이면
for c in (12, 70, 88): d.set(14, c, 'manhole')
d.set(52, 36, 'manhole'); d.set(54, 20, 'manhole') if False else None

# --- 횡단보도 (차량과 평행: 동서 도로를 건너는 건 가로줄, 남북 도로를 건너는 건 세로줄)
def zebra_h(r0, r1, c0, c1):
    for c in range(c0, c1):
        for r in range(r0, r1): d.set(r, c, 'zeb_n' if r == r0 else 'zeb_s' if r == r1 - 1 else 'zeb_c')
def zebra_v(r0, r1, c0, c1):
    for r in range(r0, r1):
        for c in range(c0, c1): d.set(r, c, 'vz_c')
zebra_h(LANE[0], LANE[1], V1[0] + 1, V1[1] - 1)             # 南口 큰 거리가 생활도로를 건넘
zebra_h(LANE[0], LANE[1], G3[0], G3[1])                       # 막다른 골목(G3)은 담으로 막혔으니 횡단 없음
for (r0, r1) in ((12, 16), (24, 28), (38, 42)): zebra_v(r0, r1, EAST[0], EAST[1])   # 동서 길이 동쪽 골목을 건넘
# 점자블록: 연석에서 한 칸 안쪽 (생활도로 북쪽 보도 / 동쪽 골목 가장자리)
for c in range(0, EAST[0]):
    if not (V1[0] <= c < V1[1]):
        d.set(LANE[0] - 2, c, 'tactile_bar' if c % 8 in (3, 4, 5) else 'sw')

# ================================================================== 건물
FAMS = [('retail', 6), ('office', 2), ('izakaya', 1), ('mansion', 2), ('bar', 1)]
FAMS_BAR = [('bar', 2), ('retail', 3), ('izakaya', 2)]
BLD = []                                  # (c, w, rb, fam)
COVER = []
_orig_building = d.building
def _bld(spec, col, rb, lrecipe=False):
    asm = _orig_building(spec, col, rb, lrecipe); COVER.append((col, asm['n'], rb - asm['rows'] + 1, rb)); return asm
d.building = _bld
muraled = [0]; nmach = [0]

def sprinkle(spec, w, r):
    """벽화(5곳 이내)는 한 번에 한 곳만 정해 후처리로 얹는다."""
    spec = dict(spec); spec['decos'] = [x for x in spec.get('decos', []) if not x['deco'].startswith('plate.mark')]
    return spec

def pick_spec(rb, top, w, fams, r, minf=2, maxf=3, machiya_p=.07):
    avail = rb - top + 1
    fam = r.choices([f for f, _ in fams], [x for _, x in fams])[0]
    if fam == 'mansion' and w < 5: fam = 'retail'
    if w >= 5 and avail >= 8 and nmach[0] < 5 and r.random() < machiya_p:
        nmach[0] += 1
        sp = G.machiya(kit, w, r.randrange(10 ** 6), two=True)
        if kit.assemble(sp)['rows'] <= avail: return sp, 'machiya'
    return fit_spec(kit, fam, w, avail, r, minf, maxf), fam

def fillb(c0, c1, rb, top, fams=FAMS, wmin=4, wmax=8, minf=2, maxf=3, mural_ok=True, machiya_p=.07, gapfrom=None):
    """[c0,c1) 를 건물로 채운다. 폭·층수가 들쭉날쭉. rb 는 1층 아랫줄 행, top 은 건물 윗줄 하한."""
    out = []; c = c0
    last = None
    while c1 - c >= wmin:
        w = rng.randint(wmin, wmax)
        if c1 - (c + w) < wmin: w = c1 - c
        spec, fam = pick_spec(rb, top, w, fams, rng, minf, maxf, machiya_p)
        spec = sprinkle(spec, w, rng)
        if mural_ok and fam not in ('machiya',) and w >= 6 and len(spec['floors']) >= 2 and muraled[0] < 5 and rng.random() < .12:
            muraled[0] += 1; spec = vis(spec, 'mural.%d' % (muraled[0] % 4), 0, 1)
        asm = d.building(spec, c, rb); BLD.append((c, w, rb, fam)); out.append((c, w, fam))
        tr = rb - asm['rows'] + 1
        g0 = 0 if gapfrom is None else gapfrom
        for r in range(g0, tr):
            for cc in range(c, c + w):
                if 0 <= r < NR and d.surf[r][cc] == 'sw': d.set(r, cc, 'pave_a')
        c += w
    return out

def cutspans(c0, c1, gaps, minw=4):
    pts = [(c0, c1)]
    for (g0, g1) in gaps:
        nxt = []
        for (a, b) in pts:
            if g1 <= a or g0 >= b: nxt.append((a, b)); continue
            if g0 > a: nxt.append((a, g0))
            if g1 < b: nxt.append((g1, b))
        pts = nxt
    return [(a, b) for (a, b) in pts if b - a >= minw]

def over(name, c, row, dxp=0, dyp=0, solid=False, keyrow=None):
    """건물 위에 얹는 부품(건물 다음에 그려진다). row = 밑줄 행, keyrow = 그리기 순서 기준 행(건물 밑줄)."""
    P = kit.props[name]; w, h = P['w'], P['h']; r0 = row - h + 1
    d.items.append(((row if keyrow is None else keyrow) + 0.2, 1, 'propx', name, c * 16 + dxp, r0 * 16 + dyp))
    if solid:
        for cc in range(w):
            if P['walk'][h - 1][cc] == 'S' and 0 <= c + cc < NC: d.walk[row][c + cc] = 'S'
def under(name, c, row):
    """건물 뒤에 깔리는 부품(같은 줄의 건물이 위에 그려진다)."""
    P = kit.props[name]; w, h = P['w'], P['h']; r0 = row - h + 1
    d.items.append((row - 0.3, 0, 'propx', name, c * 16, r0 * 16))

# ---------------------------------------------------------------- N1 : 一番街 북쪽 (남향 정면이 골목을 본다; 위는 맵 밖으로 이어진다)
T2 = (28, 8)                                    # 본다형: 5층 분양맨션 + 저층 극장 정면 (x28~35)
for (a, b, t, e) in A1:
    rb = t - 1
    for (sa, sb) in cutspans(a, b, [EAST]):
        if sa <= T2[0] and T2[0] + T2[1] <= sb:
            if T2[0] - sa >= 4: fillb(sa, T2[0], rb, -6, minf=3, maxf=5)
            spec = G.gen(kit, 'mansion', T2[1], 4, 2711)
            d.building(spec, T2[0], rb); BLD.append((T2[0], T2[1], rb, 'theatre'))
            over('theatre_front8', T2[0], rb)
            if sb - (T2[0] + T2[1]) >= 4: fillb(T2[0] + T2[1], sb, rb, -6, minf=3, maxf=5)
        else:
            fillb(sa, sb, rb, -6, minf=3, maxf=5)
fillb(EAST[1] - 0, EAST[1], 10, 0) if False else None

# ---------------------------------------------------------------- N2 : 一番街 남쪽 · 선로가이 북쪽 (정면이 보행로를 본다)
N2RB = PATH[0] - 1
T1 = (17, 14)                                   # 스즈나리형: 목조 2층 소극장 + 1층 요코초
HALLB = (HALL[0], HALL[1])
def e_at(a, b): return max(e for (x0, x1, t, e) in A1 if x1 > a and x0 < b)
for (a, b) in cutspans(0, EAST[0], [G1, G2, DIAG, HALLB, (T1[0], T1[0] + T1[1])]):
    for (x0, x1, t, e) in A1:
        sa, sb = max(a, x0), min(b, x1)
        if sb - sa >= 4: fillb(sa, sb, N2RB, e, gapfrom=e)
# 스즈나리(T01)
spec = G.gen(kit, 'office', T1[1], 2, 1101)
d.building(spec, T1[0], N2RB); BLD.append((T1[0], T1[1], N2RB, 'theatre'))
over('theatre_front8', T1[0] + 3, N2RB - 5, keyrow=N2RB)       # 2층 극장 정면 (입구·입간판)
for k, c in enumerate((T1[0], T1[0] + 4, T1[0] + 8, T1[0] + 10)):
    if c + 4 <= T1[0] + T1[1] + 1: over('tin_stall.%d' % (k % 3), c, N2RB)     # 1층 요코초

# ---------------------------------------------------------------- S1 : 선로가이 남쪽 / 정면은 南口 거리를 본다
def ss_t(c):
    for (a, b, t, e) in SS:
        if a <= c < b: return t
    return 38
S1TOP = 29
for (a, b) in cutspans(0, 24, []):
    for (x0, x1, t, e) in SS:
        sa, sb = max(a, x0), min(b, x1)
        if sb - sa >= 4: fillb(sa, sb, t - 1, S1TOP, FAMS, 4, 7, 2, 2, gapfrom=PATH[1] + 1)
# 옛 식품시장 터(함석지붕 점포 줄 2열)
for k, c in enumerate((24, 28, 32)):
    over('tin_stall.%d' % ((k + 1) % 3), c, 37, solid=True)
    over('tin_stall.%d' % ((k + 2) % 3), c, 33, solid=True)
for r in range(29, 38):
    for c in range(24, 37): d.set(r, c, 'pave_b' if (r + c) % 6 else 'pave_a')
for c in range(24, 37): d.set(28, c, 'plant_strip')
# 역 동쪽 건물 (고가 시작부를 가린다) x53~62
for (sa, sb) in ((53, 62),):
    spec = G.gen(kit, 'office', sb - sa, 2, 7001)
    d.building(spec, sa, ss_t(sa) - 1); BLD.append((sa, sb - sa, ss_t(sa) - 1, 'office'))
# 개찰구 앞 극장 빌딩(T03) x38~48 (南口 거리 남쪽, 광장 앞)
# ---------------------------------------------------------------- 고가 이노카시라선 x54~96 (왼쪽 끝은 건물 뒤로 사라진다)
VB = 37
vk = ['viaduct6', 'viaduct6_shops', 'viaduct6_shut', 'viaduct6_shops', 'viaduct6_pass', 'viaduct6_shops', 'viaduct6_pass']
for k, c in enumerate(range(54, 96, 6)): under(vk[k], c, VB)
for c, nm in ((54, 'train10_b'), (64, 'train8_b'), (72, 'train10_b'), (82, 'train8_b'), (90, 'train8_b')):
    under(nm, c, VB - 5)
# 고가 하부 기둥 앞 보도에 점자블록 (남쪽 보도 연석에서 한 칸 안쪽)

# ---------------------------------------------------------------- S2 : 南口 거리 남쪽 / 생활도로 북쪽
S2RB = LANE[0] - 4                               # 49: 1층 아랫줄, 50 = 진열, 51 = 점자블록, 52 = 연석쪽 보도
gapsS2 = [V1, DIAG2, G3, (PLAZA[0] - 1, PLAZA[0] - 1)]
T3 = (38, 9)
for (x0, x1, t, e) in SS:
    for (a, b) in cutspans(max(0, x0), x1, [V1, DIAG2, G3, (38, 47), (30, 38)]):
        if b - a >= 4:
            fillb(a, b, S2RB, e, FAMS, 4, 8, 2, 3, gapfrom=e)
# 駅前 극장 빌딩 (T03): 개찰구 정면 아래
spec = G.gen(kit, 'office', 8, 2, 9031)
d.building(spec, 30, S2RB); BLD.append((30, 8, S2RB, 'theatre'))
over('theatre_front8', 30, S2RB, keyrow=S2RB)                      # 駅前 소극장 두 곳 병설
# G3 막다른 골목 오른쪽 · 왼쪽
# ---------------------------------------------------------------- S3 : 생활도로 남쪽 한 줄 (낮은 상가·주택)
for (a, b) in cutspans(0, EAST[0], [V1, (0, 16), (60, 76)]):
    fillb(a, b, NR - 1, LANE[1] + 2, [('retail', 4), ('bar', 2), ('mansion', 1)], 4, 7, 1, 1, mural_ok=False, machiya_p=.15, gapfrom=LANE[1] + 1)

# 건물에 덮이지 않은 기본 인도 칸은 포장으로 통일(회색 판이 남지 않게)
_cov = set()
for (c0_, w_, t_, b_) in COVER:
    for r_ in range(max(0, t_), b_ + 1):
        for c_ in range(c0_, c0_ + w_): _cov.add((r_, c_))
for r_ in range(NR):
    for c_ in range(NC):
        if d.surf[r_][c_] == 'sw' and (r_, c_) not in _cov: d.set(r_, c_, 'pave_a')

# ================================================================== 소품
occ = set()
def free(name, c, row):
    P = kit.props[name]; w, h = P['w'], P['h']
    for rr in range(row - h + 1, row + 1):
        for cc in range(c, c + w):
            if (rr, cc) in occ: return False
    return True
def mark(name, c, row):
    P = kit.props[name]; w, h = P['w'], P['h']
    for rr in range(row - h + 1, row + 1):
        for cc in range(c, c + w): occ.add((rr, cc))
def P(name, c, row, **kw):
    w = kit.props[name]['w']
    if c < 0 or c + w > NC or not (0 <= row < NR): return False
    if not free(name, c, row): return False
    if not safe_put(d, name, c, row, **kw): return False
    mark(name, c, row); return True

# 건물/고가 점유(사람·소품이 겹치지 않게)
BMASK = set()
for (c, w, rb, fam) in BLD:
    asm_rows = None
    for r in range(rb - 18, rb + 1):
        for cc in range(c, c + w): BMASK.add((r, cc))
for r in range(32, 38):
    for c in range(54, 96): BMASK.add((r, c))
for c in range(24, 37):
    for r in range(29, 38): BMASK.add((r, c))
def cell_ok(r, c):
    if not (0 <= r < NR and 0 <= c < NC): return False
    if (r, c) in BMASK or (r, c) in occ: return False
    s = d.surf[r][c]
    if s is None or s in ('sw_shade', 'plant_strip', 'lawn', 'lane_n', 'lane_s', 'lot') or d.walk[r][c] != 'F': return False
    if LANE[0] <= r < LANE[1] and c < EAST[0]: return False
    return True

# --- 가게 앞 진열: 고착 옷걸이 랙·레코드 웨건·자전거·화분·입간판
DISPL = ['rack.0', 'rack.1', 'record_wagon', 'pot', 'planter', 'a_frame', 'bike.sora', 'bike.aka', 'bike_cluster', 'rack.1', 'rack.0', 'bike.midori', 'a_frame']
for (c, w, rb, fam) in sorted(BLD):
    row = rb + 1
    if row >= NR - 1 or fam == 'theatre': continue
    if d.surf[row][c] is None or d.surf[row][c] in ('lane_n', 'lane_c', 'lane_s', 'lot', 'lawn'): continue
    if rng.random() < .75:
        nm = rng.choice(DISPL); pw = kit.props[nm]['w']
        P(nm, c + rng.randint(0, max(0, w - pw)), row, solid=True)
    if w >= 7 and rng.random() < .5:
        nm = rng.choice(DISPL); pw = kit.props[nm]['w']
        P(nm, c + rng.randint(0, max(0, w - pw)), row, solid=True)
# --- 점포 캐노피(부분 차양): 폭 6 이상 소매점 몇 곳
nsc = 0
for (c, w, rb, fam) in sorted(BLD):
    if fam in ('retail', 'bar') and w >= 6 and rb in (N2RB, S2RB, 37) and nsc < 6 and rng.random() < .45:
        over('shop_cover.%d' % (nsc % 4), c, rb - 2, keyrow=rb); nsc += 1
# --- 돌출 간판(블레이드): 건물 모서리에서 앞으로
for (c, w, rb, fam) in sorted(BLD):
    if fam == 'theatre' or rb < 5 or rng.random() > .5: continue
    cc = c + (w - 1 if rng.random() < .5 else 0)
    k = rng.randrange(4)
    if (rb - 2, cc) not in occ: d.put('blade_sign.%d' % k, cc, rb - 1, solid=False)
# --- 극장 입간판(출연자 입간판): 극장 정면 앞
P('a_frame', T1[0] + 1, N2RB + 1, solid=True); P('a_frame', T1[0] + T1[1] - 2, N2RB + 1, solid=True)
P('a_frame', T2[0] + 1, 9, solid=True) if False else None
# --- 가로등 깃발(상점가 정체성)
for (a, b, t, e) in A1:
    for c in range(a + 2, b - 1, 9): P('street_flag', c, t, solid=True)
for (a, b, t, e) in SS:
    for c in range(a + 3, b - 1, 10):
        if not (PLAZA[0] <= c < V1[1]): P('street_flag', c, t, solid=True)
for c in range(2, EAST[0] - 1, 12):
    P('street_flag', c, PATH[0] + 1, solid=True) if (c % 24) else None
# --- 전봇대(이면 골목·전선)
POLES = [(G1[0], 23), (G2[0], 23), (DIAG[0] + 7, 24), (DIAG2[0] + 5, 46), (G3[0] + 1, 47), (EAST[0] - 2, 20), (EAST[0] - 2, 49), (HALL[0] + 12, 23)]
for c, r in POLES: P('utility_pole2', c, r, solid=True)
# 막다른 골목 G1: 담 · 자전거 · 쓰레기망 · 고양이
for k in range(3): P('wall.tsuiji', G1[0] + k, 24, solid=True)
P('bike_cluster', G1[0], 22, solid=False); P('garbage_net', G1[0] + 1, 19, solid=True); P('cat.loaf', G1[0] + 2, 21, solid=False); P('vending.sora', G1[0] + 1, 23, solid=True) if False else None
P('curve_mirror', G2[1] - 1, 17, solid=True); P('vending.aka', G2[0], 24, solid=True) if False else None
P('wall.board', G2[0] + 1, 24, solid=True); P('wall.board', G2[0] + 2, 24, solid=True) if False else None
# 막다른 골목 G3(남)
for k in range(3): P('wall.hedge', G3[0] + k, 50, solid=True)
P('bike_cluster', G3[0], 47, solid=False); P('garbage_net', G3[0] + 1, 45, solid=True); P('cat.sit', G3[0] + 2, 48, solid=False); P('stop_sign', G3[1] - 1, 44, solid=True) if False else None
# 북쪽 빈터 : 코인 주차(차 2대) + 자판기 + 대각선 골목
P('coin_sign', DIAG[1] - 1, 17, solid=True)
for nm, c, r in (('car.white', DIAG[1] - 8, 19), ('car.silver', DIAG[1] - 8, 23)):
    if free(nm, c, r): d.put(nm, c, r, solid=True); mark(nm, c, r)
P('vend_pair', DIAG[0], 22, solid=True) if False else None
P('bike_rack', DIAG[0] + 1, 23, solid=True); P('bike_cluster', DIAG[0] + 4, 23, solid=False)
# 남쪽 빈터 : 코인 주차(차 3대) + 대각선 골목
P('coin_p', DIAG2[0] + 1, 45, solid=True); P('coin_sign', DIAG2[1] - 1, 51, solid=True)
for nm, c, r in (('car.green', DIAG2[0] + 10, 46), ('car.red', DIAG2[0] + 8, 50), ('car.blue', DIAG2[0] + 2, 50)):
    if free(nm, c, r): d.put(nm, c, r, solid=True); mark(nm, c, r)
P('vending.midori', DIAG2[1] - 2, 44, solid=True)
# 선로가이: 가로수(불규칙·종 섞기), 벤치, 화분, 자판기, 흡연소
for c, nm in ((7, 'tree.zelkova'), (21, 'tree.ginkgo'), (33, 'tree.zelkova'), (44, 'tree.sakura'), (59, 'tree.ginkgo'), (91, 'tree.zelkova')):
    P(nm, c, PATH[1], solid=True)
for c in (4, 12, 27, 39, 52, 69, 80): P('bench', c, PATH[1], solid=True)
for c in (10, 18, 30, 36, 50, 66): P('planter', c, PATH[1], solid=True)
for c in (15, 24, 45): P('vending.%s' % rng.choice(['aka', 'sora', 'midori']), c, PATH[1], solid=True)
P('smoking_area', 55, PATH[1], solid=True)
# 개찰구 앞 광장: 지상 출입구 + 환기탑 + 자전거 + 벤치
P('station_gate', PLAZA[0] + 2, 36, solid=True)
P('vent_tower', PLAZA[0] - 1, 33, solid=True); P('vent_tower', PLAZA[1] - 1, 33, solid=True)
P('bike_cluster', PLAZA[0] + 1, 31, solid=False); P('bike_cluster', PLAZA[0] + 6, 31, solid=False); P('planter', PLAZA[0] + 4, 30, solid=True)
P('bench', PLAZA[0] + 8, 30, solid=True)
# 南口 아치 게이트(큰 거리, 연석 안쪽 보행로)
P('arch_shotengai2', V1[0] - 1, 43, solid=False)
# 南口 거리 소품 : 레코드 웨건·고착 랙, 계단/자전거, 광장 작은 나무
P('tree.zelkova', 42, 41, solid=True); P('bench', 45, 44, solid=True); P('record_wagon', 41, 44, solid=True)
# 고가 아래(점포 앞): 주륜장·진열·표지
for c in (58, 62, 70, 74, 82, 86): P('bike_cluster', c, VB + 1, solid=False)
for c in (64, 76, 88): P('record_wagon', c, VB + 1, solid=True)
P('catenary_pole', 67, VB + 1, solid=True); P('catenary_pole', 79, VB + 1, solid=True)
# 시장터 : 현수 등
P('string_lanterns4', 24, 30, solid=False); P('string_lanterns4', 28, 30, solid=False); P('string_lanterns4', 32, 30, solid=False)
# 공터 광장 : 키친카·천막·무대 대용(아치형 천막)·벤치·나무·놀이 구역
cx = HALL[0]
over('van.white', cx + 17, 21, solid=True)                          # 크레페 키친카 대용 (상표 없음)
over('shop_cover.1', cx + 14, 19)                                    # 천막
P('tin_stall.1', cx + 1, 22, solid=True); P('tin_stall.2', cx + 5, 22, solid=True)
P('string_lanterns4', cx + 1, 17, solid=False); P('string_lanterns4', cx + 5, 17, solid=False)
for c in (cx + 8, cx + 11): P('wall.hedge', c, 22, solid=True); P('wall.hedge', c, 16, solid=True) if False else None
P('bench', cx + 9, 18, solid=True) if False else None
P('bench', cx + 8, 23, solid=True); P('bench', cx + 12, 23, solid=True)
P('tree.sakura', cx + 8, 17, solid=True) if False else None
P('tree.ginkgo', cx + 4, 20, solid=True) if False else None
P('tree.zelkova', cx + 9, 17, solid=True)
P('swing', cx + 17, 16, solid=True); P('sandbox', cx + 17, 21, solid=True) if False else None
P('slide', cx + 20, 18, solid=True) if False else None
P('sandbox', cx + 20, 23, solid=True); P('bike_cluster', cx + 14, 23, solid=False)
P('tree.ginkgo', cx + 21, 22, solid=True) if False else None
# 일방통행 생활도로: 차 2대 (동행 = 위 차선)
for nm, c in (('car.white', 9), ('van.white', 63)):
    d.put(nm, c, LANE[1] - 1, solid=False); mark(nm, c, LANE[1] - 1)
# 공원/주차 (생활도로 남쪽): 놀이터 + 코인 주차장
for r in range(57, 64):
    for c in range(0, 16): d.set(r, c, 'gravel')
for c in range(0, 16): d.set(56, c, 'sw')
P('swing', 2, 61, solid=True); P('slide', 7, 61, solid=True); P('sandbox', 11, 62, solid=True)
P('bench', 5, 63, solid=True); P('tree.ginkgo', 13, 60, solid=True) if False else None
for c in range(0, 16): d.set(57, c, 'plant_strip') if False else None
for c in range(0, 16, 3): d.set(56, c, 'sw')
for r in range(57, 64):
    for c in range(60, 76): d.set(r, c, 'lot')
for c in range(60, 76, 5):
    for r in range(58, 64): d.set(r, c, 'lot_line')
P('coin_sign', 60, 63, solid=True); P('coin_p', 74, 63, solid=True); P('vending.aka', 75, 62, solid=True) if False else None
for nm, c in (('car.red', 61), ('car.silver', 66), ('car.black', 71)):
    d.put(nm, c, 63, solid=True); mark(nm, c, 63)
P('roadsign', V1[0] + 2, 52, solid=True) if False else None
P('barricade3', EAST[0] - 4, 24, solid=True) if False else None
# ================================================================== 사람
def people(r0, r1, c0, c1, n, tries=500):
    placed = 0; t = 0
    while placed < n and t < tries:
        t += 1
        r = rng.randint(r0, r1); c = rng.randint(c0, c1)
        if all(cell_ok(rr, cc) for rr in (r, r - 1) for cc in (c, c + 1)):
            d.put('person.%d' % rng.randrange(40), c, r, dx=rng.randint(-2, 2), dy=rng.randint(-1, 1), solid=False)
            for rr in (r, r - 1):
                for cc in (c - 1, c, c + 1, c + 2): occ.add((rr, cc))
            placed += 1
people(24, 28, 0, 90, 9); people(29, 37, 37, 52, 8); people(14, 23, 62, 84, 8)
people(11, 14, 0, 90, 8); people(38, 45, 0, 91, 8); people(16, 23, 31, 43, 2)
people(44, 51, 47, 52, 4); people(15, 23, 17, 21, 1) if False else None; people(57, 63, 0, 14, 2)
people(0, 60, EAST[0], EAST[1] - 2, 4)

# ================================================================== 렌더
im = d.render()
img = Image.fromarray(im); dr = ImageDraw.Draw(img)
poles = []
for key, z, kind, *rest in d.items:
    if kind == 'propx' and rest[0] == 'utility_pole2': poles.append((rest[1], rest[2]))
poles.sort()
def wire(p, q, sag=5):
    (x0, y0), (x1, y1) = p, q
    n = max(abs(x1 - x0), 1)
    for i in range(n + 1):
        t = i / n; x = x0 + (x1 - x0) * t; y = y0 + (y1 - y0) * t + sag * 4 * t * (1 - t)
        dr.point((int(x), int(y)), fill=(40, 36, 44, 255))
for i in range(len(poles)):
    for j in range(i + 1, len(poles)):
        (x0, y0), (x1, y1) = poles[i], poles[j]
        if 0 < abs(x1 - x0) < 380 and abs(y1 - y0) < 48:
            for oy in (6, 12): wire((x0 + 8, y0 + oy), (x1 + 8, y1 + oy))
im = np.array(img)
Image.fromarray(im).save(os.path.join(jpenv.DISTRICTS_OUT, 'district_shimokita.png')); print(im.shape)
check(d, 'shimokita')
