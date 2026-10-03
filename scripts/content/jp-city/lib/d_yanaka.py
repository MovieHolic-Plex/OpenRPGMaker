from dcommon import *
import os, jpenv
os.makedirs(jpenv.DISTRICTS_OUT, exist_ok=True)
# 칩셋은 이미 최신(감독자가 내보냄) — export2.export() 는 호출하지 않는다.
kit = load(); rng = random.Random(41)
NC, NR = 96, 64
d = District(kit, NC, NR)
F = G.F
SUN = 'sunshade.sora'            # 상점가 日よけ는 통일(H18 정비)

# ---------------------------------------------------------------- 건물 유형(町家·看板建築·長屋·木造アパート)
ROOFS = ['roof.hip.slate', 'roof.hip', 'roof.slate', 'roof.tile']
def _eave(roof): return 'eave.slate' if roof in ('roof.hip.slate', 'roof.slate') else 'eave'
def _sun(n, dc, wd):
    cols = [c for c in range(1, n - 2) if (c + 1 < dc or c > dc + wd - 1)]
    return [dict(deco=SUN, col=c, floor='ground', row=0) for c in cols[:2]]
def machiya2(n, seed, sun=True, orange=False):
    """T01 목조 町家 2층(점포 겸 주택)"""
    r = random.Random(seed); nm = max(1, n - 3)
    roof = r.choice(ROOFS[:2]) if not orange else 'roof.hip'
    fl = r.choice(['koushi', 'koushi', 'pairs'])
    wall = r.choice(['kinari', 'shiro', 'hodo'] if fl == 'pairs' else ['kinari', 'shiro'])
    vs = [r.choice([0, 0, 1, 2, 3] if fl == 'koushi' else [0, 1, 1, 2]) for _ in range(nm)]
    gv = [r.choice([1, 2, 3, 4, 5]) for _ in range(max(1, n - 2))]; gv[0] = r.choice([1, 2, 4, 5])
    dd = r.choice(['machiya', 'noren']) if n >= 5 else 'house'
    wd = kit.decos[f'door.{dd}']['w']; dc = r.randint(0, max(0, n - wd)); decos = []
    if r.random() < .5: decos.append(dict(deco='inuyarai', col=0 if dc > 0 else n - 1, floor='ground', row=2))
    if fl == 'pairs' and r.random() < .7: decos.append(dict(deco=r.choice(['laundry', 'ac.0']), col=1 + r.randrange(max(1, n - 3)), floor=0))
    if sun: decos += _sun(n, dc, wd)
    return dict(n=n, head=None, roof=roof, eave=_eave(roof), floors=[F(fl, wall, vs)], ground='gr.machiya', ground_vs=gv, door=(dd, dc), decos=decos)
def machiya1(n, seed, sun=True):
    """T15 개방형 점포(튀김·반찬): 1층"""
    r = random.Random(seed); roof = r.choice(ROOFS[:2])
    gv = [r.choice([1, 2, 3, 4, 5]) for _ in range(max(1, n - 2))]; gv[0] = r.choice([1, 2, 4, 5])
    dd = 'noren' if n >= 4 else 'house'; wd = kit.decos[f'door.{dd}']['w']; dc = r.randint(0, max(0, n - wd))
    return dict(n=n, head=None, roof=roof, eave=_eave(roof), floors=[], ground='gr.machiya', ground_vs=gv, door=(dd, dc), decos=_sun(n, dc, wd) if sun else [])
def nagaya_unit(n, seed, wall, fl, roof):
    """長屋 한 軒(n=3~4). 문 'house'"""
    r = random.Random(seed); nm = max(1, n - 3)
    vs = [r.choice([0, 1, 2]) for _ in range(nm)]
    dc = r.choice([0, n - 2]); decos = []
    if r.random() < .45: decos.append(dict(deco=r.choice(['laundry', 'ac.0']), col=(n - 2 if dc == 0 else 0) if n > 3 else 0, floor=0))
    return dict(n=n, head=None, roof=roof, eave=_eave(roof), floors=[F(fl, wall, vs)], ground='gr.machiya', ground_vs=[5] * max(1, n - 2), door=('house', dc), decos=decos)
def wood_apt(n, seed):
    """T12 목조 아파트(외계단)"""
    r = random.Random(seed); wall = r.choice(['kinari', 'shiro', 'hodo'])
    fls = [F('veranda', wall, [r.choice([0, 1, 2, 3]) for _ in range(4)]) for _ in range(2)]
    dc = r.choice([0, n - 2]); decos = [dict(deco='fe', col=n - 3 if dc == 0 else 0, floor=i) for i in range(2)]
    return dict(n=n, head=None, roof=r.choice(['roof.plain.plain', 'roof.stair.plain']), floors=fls, ground='gr.shutter.sora', door=('steel', dc), decos=decos)
def garage_house(n, seed):
    """T11 차고 겸용 주택"""
    r = random.Random(seed); nm = max(1, n - 3)
    roof = r.choice(['roof.hip', 'roof.tile', 'roof.slate', 'roof.hip.slate'])
    fl = r.choice(['pairs', 'slide']); wall = r.choice(['shiro', 'kinari', 'hodo'])
    vs = [r.choice([0, 1, 2, 3] if fl == 'pairs' else [0, 1, 2, 3, 4]) for _ in range(nm)]
    dc = r.choice([0, n - 2]); decos = []
    if fl == 'pairs' and r.random() < .5: decos.append(dict(deco=r.choice(['laundry', 'ac.0']), col=1, floor=0))
    return dict(n=n, head=None, roof=roof, eave=_eave(roof), floors=[F(fl, wall, vs)], ground='gr.garage', ground_vs=[0], door=('rollup', dc), decos=decos)
def kanban(n, seed, avail, fam=None):
    """T02/T14 看板建築·흰 간판 구식 점포: 평탄한 모르타르 정면(파라펫)"""
    r = random.Random(seed); fam = fam or r.choice(['bar', 'retail', 'retail', 'izakaya'])
    nfs = {7: (1, 1), 9: (2, 2), 11: (3, 3)}[avail]
    sp = None
    for t in range(40):
        s = G.gen(kit, fam, n, r.randint(*nfs), r.randrange(10 ** 6))
        if kit.assemble(s)['rows'] == avail: sp = s; break
    if sp is None: sp = G.gen(kit, fam, n, nfs[0], seed)
    # 야나카는 저채도: 흰·베이지 모르타르로 맞춘다
    for f in sp['floors']:
        if f['kind'] not in ('tile', 'curtain') and f['wall'] == 'conc': f['wall'] = r.choice(['shiro', 'kinari'])
    return sp
def apt_mid(n, seed, avail):
    """T06/T07 타일 맨션(저층)"""
    r = random.Random(seed)
    for t in range(60):
        nf = r.randint(1, 4); s = G.gen(kit, 'mansion', n, nf, r.randrange(10 ** 6))
        if kit.assemble(s)['rows'] == avail:
            for f in s['floors']: f['wall'] = r.choice(['shiro', 'kinari'])
            return s
    return G.gen(kit, 'mansion', n, 2, seed)

# ---------------------------------------------------------------- 바닥
import math
d.fill(0, 0, NR, NC, 'lane_c')
def zone(r0, r1, c0, c1, name):
    for r in range(r0, r1):
        for c in range(c0, c1): d.set(r, c, name)
def paving(r0, r1, c0, c1, a='pave_a', b='pave_b', k=6):
    for r in range(r0, r1):
        for c in range(c0, c1): d.set(r, c, b if (r + c) % k == 0 else a)
paving(22, 29, 0, 81)                           # 상점가(노천, 7행)
paving(22, 29, 81, NC, 'sando', 'sando_b', 7)   # 계단 쪽 돌바닥
zone(0, 2, 0, 46, 'gravel')                     # 주택 뒷마당(흙)
zone(0, 9, 46, NC, 'gravel')                    # 사찰·묘역(흙)
for r in range(0, 9):
    for c in range(62, 68): d.set(r, c, 'sando_b' if (r + c) % 5 == 0 else 'sando')
zone(41, 52, 74, 89, 'gravel')                  # 児童遊園(흙바닥)
for r in range(29, 37):                         # 코인 주차장
    for c in range(60, 70): d.set(r, c, 'lot_line' if (c - 60) % 5 == 0 else 'lot')
for c in range(60, 70): d.set(28, c, 'pave_a')
# 점자블록: 골목 어귀(상점가 가장자리)에만 가로줄
for c in range(37, 41):
    d.set(22, c, 'tactile_bar'); d.set(28, c, 'tactile_bar')
# 시장 길 폭 변화: へび道 왼쪽 가장자리 L(y) (3칸 폭)
def snake_L(y): return 37 + int(round(3 * math.sin((y - 41) * math.pi / 11.0)))

# ---------------------------------------------------------------- 건물 줄
KIND_W = {'m2': (5, 6), 'kan7': (4, 6), 'kan9': (4, 6), 'old': (4, 5), 'apt9': (6, 8), 'm1': (5, 6), 'apt11': (6, 8)}
def spec_for(kind, w, seed):
    if kind == 'm2': return machiya2(w, seed)
    if kind == 'm1': return machiya1(w, seed)
    if kind == 'kan7': return kanban(w, seed, 7)
    if kind == 'kan9': return kanban(w, seed, 9)
    if kind == 'old': return kanban(w, seed, 7, 'retail')
    if kind == 'apt9': return apt_mid(w, seed, 9)
def row_shops(rb, c0, c1, weights):
    """상점 줄: 같은 종류가 연속 2동 이상 나오지 않게 채운다. 반환 [(col,w,kind,rows,rb)]"""
    out = []; c = c0; prev = prev2 = None
    while c1 - c >= 4:
        for _ in range(30):
            kind = rng.choices([k for k, _ in weights], [x for _, x in weights])[0]
            if kind != prev and kind != prev2: break
        lo, hi = KIND_W[kind]; w = rng.randint(lo, hi)
        if c1 - (c + w) < 4: w = c1 - c
        if w > 8 or (w < lo and kind not in ('kan7', 'kan9', 'old')): kind = 'kan7'; w = min(w, 8)
        if w < 4: break
        spec = spec_for(kind, w, rng.randrange(10 ** 6))
        rows = kit.assemble(spec)['rows']; d.building(spec, c, rb); out.append((c, w, kind, rows, rb))
        prev2, prev = prev, kind; c += w
    return out
def row_nag(rb, c0, c1, edge_fill=True, stag=None):
    """주택 줄: 長屋(2~4軒) 묶음·독립 주택·목조 아파트·차고 주택. 묶음 사이에 담. 반환 [(col,w,kind)]"""
    out = []; c = c0
    def RB(c_):                         # 길 가까운 필지는 위아래로 어긋나게 선다(二項道路 후퇴선 차이)
        if not stag: return rb
        lo, hi, amp = stag
        return rb + (int(round(amp * math.sin(c_ / 3.3))) if lo <= c_ <= hi else 0)
    while c1 - c >= 3:
        rem = c1 - c
        opts = [('nag', 6), ('nag2', 3), ('apt', 2 if rem >= 8 else 0), ('gar', 2 if rem >= 6 else 0), ('m2', 2 if rem >= 5 else 0)]
        kind = rng.choices([o for o, _ in opts], [wt for _, wt in opts])[0]
        if kind in ('nag', 'nag2'):
            nu = rng.choice([2, 3, 3, 4]) if kind == 'nag' else 2
            ws = [rng.choice([3, 3, 3, 4]) for _ in range(nu)]
            while sum(ws) > rem and ws: ws.pop()
            if not ws: break
            wall = rng.choice(['kinari', 'shiro', 'hodo']); fl = rng.choice(['pairs', 'pairs', 'koushi']); roof = rng.choice(ROOFS)
            cc = c
            for w in ws:
                d.building(nagaya_unit(w, rng.randrange(10 ** 6), wall if kind == 'nag' else rng.choice(['kinari', 'shiro', 'hodo']), fl, roof), cc, RB(cc)); out.append((cc, w, 'nag')); cc += w
            c = cc
        elif kind == 'apt':
            w = rng.choice([8, 9]) if rem >= 9 else rem
            if w < 7: break
            d.building(wood_apt(w, rng.randrange(10 ** 6)), c, RB(c)); out.append((c, w, 'apt')); c += w
        elif kind == 'gar':
            d.building(garage_house(6, rng.randrange(10 ** 6)), c, RB(c)); out.append((c, 6, 'gar')); c += 6
        else:
            w = rng.choice([5, 6]) if rem >= 6 else 5
            sp_ = machiya2(w, rng.randrange(10 ** 6), sun=False); sp_['ground_vs'] = [5] * len(sp_['ground_vs']); d.building(sp_, c, RB(c)); out.append((c, w, 'm2')); c += w
        if c1 - c >= 5 and rng.random() < .4:
            d.put(rng.choice(['wall.board', 'wall.hedge', 'gate.iron']), c, rb, solid=True); c += 1     # 필지 사이 담·철문
    if edge_fill and c < c1:
        for cc in range(c, c1): d.put('wall.hedge' if cc % 2 else 'wall.board', cc, rb, solid=True)
    return out

# 북쪽 주택(寺앞길 북측): 점포 입면이 아니라 주택
nw = row_nag(9, 0, 37)
ne = row_nag(9, 41, 46)
# 북측 상점가 줄(rb=21): 町家·看板建築·흰 간판 점포
NS_W = [('m2', 6), ('kan7', 3), ('kan9', 2), ('old', 2)]
n_w = row_shops(21, 0, 37, NS_W)
n_e = row_shops(21, 41, 80, NS_W)
mH = d.building(apt_mid(8, 901, 9), 82, 21); mH2 = d.building(apt_mid(6, 905, 9), 90, 21)    # 계단 위 고지대 맨션
# 남측 상점가 줄(rb=36): 상점가 쪽은 지붕면 → 앞에 진열대 줄을 둔다. 높이 8행 이하만
S_W = [('m2', 4), ('m1', 2), ('kan7', 3), ('old', 2)]
s_w = row_shops(36, 0, 37, S_W)
s_e1 = row_shops(36, 41, 60, S_W)
s_e2 = row_shops(36, 70, 81, S_W)
mE = d.building(apt_mid(8, 911, 9), 82, 36); mE2 = d.building(apt_mid(6, 915, 9), 90, 36)

# 주택 구역 — へび道(藍染川 暗渠): 3칸 폭 길이 사인 곡선으로 꺾이고, 건물은 길 바깥으로 계단식으로 물러선다
def snake_blocks(rb, y0, y1, lane_w=3):
    Ls = [snake_L(y) for y in range(y0, y1 + 1)]
    return min(Ls), max(Ls) + lane_w
w_end, e_start = snake_blocks(48, 41, 48)
row_nag(48, 0, w_end, stag=(w_end - 16, w_end, 2))
x2 = 58                                           # 두 번째 남북 골목 x58~61(직선)
row_nag(48, e_start, x2, stag=(e_start, e_start + 16, 2))
row_nag(48, 62, 74)
w_end2, e_start2 = snake_blocks(60, 53, 60)
row_nag(60, 0, w_end2, stag=(w_end2 - 16, w_end2, 1))
row_nag(60, e_start2, x2, stag=(e_start2, e_start2 + 16, 1))
row_nag(60, 62, 96)
d.building(wood_apt(7, 933), 89, 48)             # 놀이터 옆 목조 아파트
# 길 바깥 틈(건물이 물러선 자리)은 포장 + 路地園芸
for (y0, y1, wE, eS) in ((41, 48, w_end, e_start), (53, 60, w_end2, e_start2)):
    for y in range(y0, y1 + 1):
        L = snake_L(y)
        for c in range(wE, L): d.set(y, c, 'lane_c')
        for c in range(L + 3, eS): d.set(y, c, 'lane_c')

# ---------------------------------------------------------------- 사찰(담+산문 위주) · 묘역
for c in range(46, 62): d.put('wall.tsuiji', c, 9)
for c in range(68, 80): d.put('wall.tsuiji', c, 9)
d.put('gate.iron_open', 80, 9, solid=False)           # 潜り戸
for c in range(81, NC): d.put('wall.tsuiji', c, 9)
d.put('sanmon6', 62, 9)
d.put('stone_lantern', 61, 7); d.put('stone_lantern', 68, 7)
d.put('tree.sakura', 49, 4); d.put('tree.sakura', 74, 3); d.put('tree.sakura', 89, 4); d.put('tree.ginkgo', 58, 3); d.put('tree.zelkova', 92, 3)
for gx0 in (47, 52, 70, 76, 83, 89):                   # 묘석 구획
    for r in (5, 7):
        for k in range(3): d.put('wall.block', gx0 + k, r, solid=True)
d.put('stone_lantern', 57, 6); d.put('stone_lantern', 80, 6)

# ---------------------------------------------------------------- 夕やけだんだん(15x5) + 옹벽
d.put('yuyake_stairs', 81, 27, solid=False)
for c in range(81, NC): d.put('wall.block', c, 28, solid=True)
for r in (23, 25, 27): d.put('street_flag', 80, r) if False else None

# ---------------------------------------------------------------- 코인 주차장(차 3대·요금판·선)
d.put('car.white', 60, 33, solid=False); d.put('car.silver_r', 65, 33, solid=False); d.put('car.blue', 61, 36, solid=False)
d.put('coin_sign', 69, 31); d.put('coin_p', 69, 35)
d.put('vend_pair', 70, 28) if False else None

# ---------------------------------------------------------------- 児童遊園(흙바닥+놀이기구+울타리)
d.put('slide', 77, 46); d.put('swing', 82, 46); d.put('sandbox', 77, 50, solid=False)
d.put('bench', 84, 50); d.put('bench', 86, 44)
d.put('tree.zelkova', 84, 48)
for c in range(74, 88):
    if c not in (80, 81): d.put('wall.hedge', c, 42, solid=True)
for r in (44, 46, 48, 50):
    d.put('wall.hedge', 88, r, solid=True)
    if r in (44, 46): d.put('wall.hedge', 73, r, solid=True)
for c in range(74, 88):
    if c not in (80, 81): d.put('wall.hedge', c, 51, solid=True)

def try_put(name, c, row, span=7):
    for dc in sorted(range(-span, span + 1), key=abs):
        if 0 <= c + dc < NC and safe_put(d, name, c + dc, row): return True
    return False
# ---------------------------------------------------------------- 길가: 전봇대·표지·자판기
for c, r in ((7, 13), (38, 13), (69, 13), (91, 13), (12, 39), (46, 39), (68, 39), (8, 51), (40, 51), (66, 51)):
    try_put('utility_pole2', c, r, 9)
for c, r in ((10, 28), (48, 28), (73, 28), (30, 28), (58, 28)):         # 상점가 가장자리 전봇대(전선이 가로지른다)
    safe_put(d, 'utility_pole2', c, r)
safe_put(d, 'curve_mirror', 41, 13); safe_put(d, 'curve_mirror', 36, 40)
try_put('post_box', 36, 24); try_put('vending.aka', 43, 24); try_put('vending.sora', 77, 24)
safe_put(d, 'garbage_net', 30, 41); safe_put(d, 'garbage_net', 56, 52)
safe_put(d, 'roadsign', 33, 38)
for c in (14, 33, 53, 74):
    try_put('street_flag', c, 23)
# 路地園芸: 주택 앞 화분 줄·자전거·우산꽂이
for (rb, c0_, c1_) in ((9, 0, 37), (48, 0, 37), (48, 41, 74), (60, 0, 37), (60, 41, 96)):
    for _ in range((c1_ - c0_) // 7):
        c = rng.randint(c0_, c1_ - 2)
        safe_put(d, rng.choice(['pot', 'pot', 'planter', 'bike.aka', 'bike.sora', 'bike.midori', 'a_frame']), c, rb + 1)

# 상점가 북측 앞: 화분·자전거·A형 간판·袖看板
for c0_, w_, kind, rows_, rb in n_w + n_e:
    for k_ in range(rng.choice([1, 2])):
        c = rng.randint(c0_, c0_ + w_ - 1)
        nm = rng.choice(['pot', 'pot', 'planter', 'a_frame', 'rack.0', 'rack.1', 'bike.aka', 'bike.sora', 'bike.midori'])
        safe_put(d, nm, c, 22)
for i_, c in enumerate((8, 19, 31, 45, 57, 70)):
    try_put(f'blade_sign.{i_ % 4}', c, 23)
for c in (14, 52, 66): try_put('bike_cluster', c, 23)
# 상점가 남측 앞: 진열대(채소·생선·튀김) — 지붕면만 보이는 뒷줄에 가게 얼굴을 만든다
cov = 0
for (c0_, w_, kind, rows_, rb) in s_w + s_e1 + s_e2:
    top = rb - rows_ + 1
    if w_ >= 5 and rng.random() < .9:
        d.put(f'shop_cover.{cov % 4}', c0_ + (w_ - 6) // 2, top - 1, solid=False); cov += 1
    else:
        safe_put(d, rng.choice(['pot', 'a_frame', 'planter', 'rack.0']), c0_ + 1, top - 1)

# ---------------------------------------------------------------- 고양이(처마 위 목각 4 · 지붕 · 계단 · 담 · 길)
def eave_cat(col, rb, name='cat.wood'): d.items.append((rb + .3, 1, 'propx', name, col * 16, (rb - 3) * 16))
def roof_cat(col, rb, rows, name='cat.sit'):
    r0 = rb + 1 - rows; d.items.append((rb + .3, 1, 'propx', name, col * 16, (r0 + 1) * 16))
mm = [x for x in n_w + n_e if x[2] == 'm2']
for x in mm[:4]: eave_cat(x[0] + 1, x[4])
sp = [x for x in n_w + n_e if x[2] != 'm2']
if mm: roof_cat(mm[-1][0] + 2, mm[-1][4], mm[-1][3], 'cat.loaf')
roof_cat(s_w[1][0] + 1, 36, s_w[1][3], 'cat.sit')
d.put('cat.sit', 87, 25, solid=False, dy=4); d.put('cat.loaf', 92, 26, solid=False)
d.items.append((9.4, 1, 'propx', 'cat.loaf', 54 * 16, 8 * 16 + 4))      # 築地塀 위
d.put('cat.wood', 71, 41, solid=False); d.put('cat.sit', 39, 45, solid=False); d.put('cat.sit', 60, 49, solid=False); d.put('cat.loaf', 34, 62, solid=False)

# ---------------------------------------------------------------- 사람(Actor1 person.0~39)
crowd(d, rng, 23, 27, 0, 78, 30)
crowd(d, rng, 10, 12, 2, 94, 6); crowd(d, rng, 37, 39, 2, 94, 7)
crowd(d, rng, 49, 51, 2, 68, 5); crowd(d, rng, 42, 50, 76, 86, 4); crowd(d, rng, 14, 21, 38, 39, 2)
crowd(d, rng, 23, 27, 83, 94, 3)

# ---------------------------------------------------------------- 겹침 점검(건물끼리, 단단한 소품이 건물 몸체 위에)
def overlap_report():
    B = []
    for key, z, kind, *rest in d.items:
        if kind == 'bld':
            asm, col, r0 = rest; B.append((col, r0, col + asm['n'] - 1, r0 + asm['rows'] - 1))
    bad = []
    for i in range(len(B)):
        for j in range(i + 1, len(B)):
            a, b = B[i], B[j]
            if not (a[2] < b[0] or b[2] < a[0] or a[3] < b[1] or b[3] < a[1]): bad.append((a, b))
    print('건물 겹침', len(bad), bad[:5])
overlap_report()

im = d.render()
Image.fromarray(im).save(os.path.join(jpenv.DISTRICTS_OUT, 'district_yanaka.png')); print(im.shape)
check(d, 'yanaka')
