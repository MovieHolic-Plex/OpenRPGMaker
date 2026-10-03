from dcommon import *
import os, jpenv
os.makedirs(jpenv.DISTRICTS_OUT, exist_ok=True)
#import export2   # 칩셋은 이미 최신(감독자가 내보냄) — 다시 쓰지 않는다
#export2.export()
import math
from paint import Cv, K
from paint2 import gl
from parts_signs import frame

kit = load(); rng = random.Random(21)
NC, NR = 96, 64
AV0, AV1 = 36, 60                      # 주오도리(남북) 24칸: 인도4 + 보행자 천국 16 + 인도4
S0 = 44                                # 간다묘진도리(동서) 도로 첫 행
BN = 20                                # 북열 건물 1층 아랫줄 (문 앞 골목: 21~25)
BU = 41                                # 가드 아래 낮은 상가 아랫줄
BS = 60                                # 남열 건물 아랫줄 (문 앞 인도: 61~63)

# ---------------------------------------------------------------- 이 지구 전용 간판(아키하바라 어휘). 부품 파일은 건드리지 않고 스크립트 안에서만 만든다.
LOCAL = {}
_orig_prop_image = kit.prop_image
kit.prop_image = lambda n: LOCAL[n] if n in LOCAL else _orig_prop_image(n)
BPAL = [('aka', 'aka', 'shiro'), ('sora', 'sora', 'shiro'), ('kii', 'daidai', 'sumi'), ('midori', 'midori', 'shiro'),
        ('murasaki', 'pinku', 'shiro'), ('daidai', 'daidai', 'shiro'), ('lino', 'kinari', 'sumi')]
BTEXT = ['ゲーム', 'ガチャ', 'パーツ', 'アニメ', '中古', 'メイド', '電気', 'フィギュア', 'カード', 'ジャンク', '買取', 'ホビー', 'ラジオ', 'アキバ']
def make_board(text, pal):
    a, b, tc = BPAL[pal]; n = len(text); pitch = 17
    wt = math.ceil((n * pitch + 11) / 16); c = Cv(16 * wt, 32); W, H = c.w, c.h
    frame(c, W, H)
    x0, y0, iw, ih = 3, 3, W - 7, H - 7
    top = K(a, 0); mid = K(a, 1); low = K(b, 0)
    if a == b: top = K(a, 2); low = K(a, -1)
    c.R(x0, y0, iw, ih, mid)
    for j in range(ih):
        if j < 6: c.HL(x0, y0 + j, iw, top if j % 2 == 0 or j < 3 else mid)
        elif j >= ih - 6: c.HL(x0, y0 + j, iw, low if j % 2 == 0 or j >= ih - 4 else mid)
    c.HL(x0, y0, iw, K('shiro', 4)); c.VL(x0, y0, ih, K('shiro', 3))
    tx = x0 + (iw - ((n - 1) * pitch + 16)) // 2; ty = y0 + (ih - 16) // 2
    for i, ch in enumerate(text):
        if tc == 'shiro': gl(c, tx + i * pitch + 1, ty + 1, ch, K('sumi', 0), bold=True)
        gl(c, tx + i * pitch, ty, ch, K(tc, 4 if tc == 'shiro' else 0), bold=True)
    return wt, c.a
_deck = []
def board_name():
    """BTEXT 를 섞어 돌려 쓴다(같은 글자 연속 금지). 반환: (등록 이름, 폭 칸)"""
    global _deck
    if not _deck: _deck = BTEXT[:]; rng.shuffle(_deck)
    t = _deck.pop(); pal = rng.randrange(len(BPAL)); nm = f'bd.{t}.{pal}'
    if nm not in LOCAL:
        wt, a = make_board(t, pal); LOCAL[nm] = a; kit.props[nm] = dict(w=wt, h=2, walk=[['C'] * wt] * 2, cells=None)
    return nm, kit.props[nm]['w']

# ---------------------------------------------------------------- 점포 전면 다양화
GR = {
    'retail':  [('gr.konbini.0', 1), ('gr.konbini.1', 1), ('gr.shutter.aka', 1.4), ('gr.shutter.sora', 1.4), ('gr.shutter.kii', 1.4), ('gr.garage', .8), ('gr.glass.aka', .6), ('gr.glass.sora', .6), ('gr.glass.kii', .6)],
    'office':  [('gr.shutter.aka', 1.2), ('gr.shutter.sora', 1.2), ('gr.shutter.kii', 1.2), ('gr.garage', 1), ('gr.glass.sora', .6), ('gr.glass.kii', .6), ('gr.konbini.1', .8)],
    'mansion': [('gr.garage', 1)],
    'izakaya': [('gr.izakaya', 1)],
    'bar':     [('gr.izakaya', 1), ('gr.shutter.aka', .8)],
}
def gkey(g): return g.split('.')[1]
def pick_ground(fam, prev):
    opts = [(g, w) for g, w in GR[fam] if gkey(g) != prev] or GR[fam]
    return rng.choices([g for g, _ in opts], [w for _, w in opts])[0]

def make_spec(fam, w, avail, prev, floors_var=0, ad=0.0):
    """아랫줄까지 avail 행(roof 2 + 층 2x + 1층 3)에 맞는 건물. 옥상 막대(roofsign) 는 쓰지 않는다."""
    nf = max(1, (avail - 5) // 2 - (rng.choice([0, 0, 0, 0, 0, 1]) if floors_var else 0))
    if fam == 'mansion' and w < 5: w = 5
    spec = G.gen(kit, fam, w, nf, rng.randrange(10 ** 6)); spec['head'] = None
    g = pick_ground(fam, prev); spec['ground'] = g
    dd = kit.cat['doorDefault'][g]; wd = kit.decos[f'door.{dd}']['w']
    spec['door'] = (dd, rng.choice([0, w - wd, (w - wd) // 2, w - wd]) if w >= 4 else 0)
    # 문과 같은 쪽 가장자리의 배관/방화계단이 문 위를 지나지 않게는 레시피가 이미 처리. 광고만 얹는다.
    if w >= 6 and nf >= 3 and rng.random() < ad:
        opts = [n for n, ww in (('facade_ad.1', 10), ('facade_ad.0', 8), ('vision.0', 6), ('vision.1', 6)) if ww <= w - 0]
        k = rng.choice(opts); ww = {'facade_ad.1': 10, 'facade_ad.0': 8}.get(k, 6)
        spec = vis(spec, k, (w - ww) // 2, rng.randrange(1, nf))
    return spec, g

BLD = []        # 놓은 건물 기록: dict(c,w,rb,spec,ground,top,bands)
def put_building(spec, c, rb):
    asm = d.building(spec, c, rb); R = asm['rows']; r0 = rb + 1 - R
    bands = []; rel = 0
    for bid, nb, off, vs in kit.pieces(d_spec := dict(spec)):
        h = len(kit.band_cells(bid, nb, vs)); bands.append((bid, rel, h)); rel += h
    dd, dc = spec['door']; wd = kit.decos[f'door.{dd}']['w']
    BLD.append(dict(c=c, w=spec['n'], rb=rb, spec=spec, r0=r0, bands=bands, dc=dc, wd=wd, nf=len(spec['floors'])))
    return BLD[-1]

def place_row(c0, c1, rb, top, fams, wmin, wmax, ad=0.35, fv=1):
    prev = None; c = c0
    while c1 - c >= wmin:
        w = rng.randint(wmin, wmax)
        if c1 - (c + w) < wmin: w = c1 - c
        fam = rng.choices([f for f, _ in fams], [x for _, x in fams])[0]
        spec, g = make_spec(fam, w, rb - top + 1, prev, fv, ad)
        spec['n'] = spec['n']; prev = gkey(g)
        put_building(spec, c, rb); c += w

d = District(kit, NC, NR)

# ---------------------------------------------------------------- 바닥
d.fill(0, 0, NR, NC, 'sw')
d.fill(0, AV0, NR, AV1, 'road_c')                                   # 주오도리(보행자 천국: 끝 방책으로 막힘)
d.fill(0, AV0, NR, AV0 + 4, 'sw'); d.fill(0, AV1 - 4, NR, AV1, 'sw')
d.hline(S0 - 2, 0, NC, 'sw_shade'); d.hline(S0 - 1, 0, NC, 'sw')    # 간다묘진도리 + 인도
d.hline(S0, 0, NC, 'road_n'); d.fill(S0 + 1, 0, S0 + 5, NC, 'road_c'); d.hline(S0 + 3, 0, NC, 'road_dash'); d.hline(S0 + 5, 0, NC, 'road_s')
d.hline(S0 + 6, 0, NC, 'sw'); d.hline(S0 + 7, 0, NC, 'sw')
for r in range(S0, S0 + 6):
    for c in range(AV0, AV1): d.set(r, c, 'road_c')
for r in range(6, 58):                                                # 포장석
    for c in range(AV0 + 4, AV1 - 4):
        if not (S0 <= r < S0 + 6): d.set(r, c, 'pave_a' if (r + c) % 5 else 'pave_b')
# 북열 건물 뒤 골목(라디오 데파트 거리 풍): 열차 데크 앞까지 5행
d.hline(21, 0, NC, 'sw_shade')
for r in (22, 23, 24, 25): d.hline(r, 0, NC, 'sw')
# 남열 건물 앞 인도 3행 (문이 맵 끝에 닿지 않게 건물을 위로 올렸다)
d.hline(BS + 1, 0, NC, 'sw_shade'); d.hline(BS + 2, 0, NC, 'sw'); d.hline(BS + 3, 0, NC, 'sw')
# 횡단보도: 동서 도로를 건너므로 줄은 차량 진행(동서)과 평행 = 가로줄(zeb_n/c/s 위·중·아래 행). 폭 4칸
for x0 in (AV0 - 4, AV1):
    for r in range(S0, S0 + 6):
        for c in range(x0, x0 + 4): d.set(r, c, 'zeb_n' if r == S0 else 'zeb_s' if r == S0 + 5 else 'zeb_c')
# 정지선 (횡단보도 바로 앞): 동행 차선은 서쪽(x31), 서행 차선은 동쪽(x64)
for r, nm in ((S0, 'stop_n'), (S0 + 1, 'stop_c'), (S0 + 2, 'stop_c')): d.set(r, AV0 - 5, nm)
for r, nm in ((S0 + 3, 'stop_c'), (S0 + 4, 'stop_c'), (S0 + 5, 'stop_s')): d.set(r, AV1 + 4, nm)
# 점자블록: 연석에서 1칸 안쪽 선형 + 횡단보도 접점 점형
for c in range(NC):
    d.set(S0 - 2, c, 'sw_tactile'); d.set(S0 + 7, c, 'sw_tactile')
for x0 in (AV0 - 4, AV1):
    for c in range(x0, x0 + 4): d.set(S0 - 1, c, 'tactile_dot'); d.set(S0 + 6, c, 'tactile_dot')
for r in list(range(6, S0 - 2)) + list(range(S0 + 8, 58)):          # 주오도리 인도 연석 1칸 안쪽(서 x38, 동 x57)
    d.set(r, AV0 + 2, 'tactile_bar'); d.set(r, AV1 - 3, 'tactile_bar')

# ---------------------------------------------------------------- 고가 + 열차 (가드 하부 상가)
VPAT_W = ['viaduct6_shops', 'viaduct6_shut', 'viaduct6_shops', 'viaduct6_pass', 'viaduct6_shops', 'viaduct6_shut']
VPAT_E = ['viaduct6_shut', 'viaduct6_shops', 'viaduct6_pass', 'viaduct6_shops', 'viaduct6_shops', 'viaduct6_shut']
for i, c in enumerate(range(0, AV0, 6)): d.put(VPAT_W[i], c, 33, solid=False)
for c in range(AV0, AV1, 6): d.put('viaduct6', c, 33, solid=False)             # 주오도리 축: 열린 통과 아치
for i, c in enumerate(range(AV1, NC, 6)): d.put(VPAT_E[i], c, 33, solid=False)
for i, c in enumerate(range(0, AV0, 6)):                                       # 가드 하부 점포 앞 전구
    if VPAT_W[i] == 'viaduct6_shops': d.put('gaado_light', c + 1, 34, solid=False); d.put('gaado_light', c + 4, 34, solid=False)
for i, c in enumerate(range(AV1, NC, 6)):
    if VPAT_E[i] == 'viaduct6_shops': d.put('gaado_light', c + 2, 34, solid=False)
TRAINS = [(0, 'train8_y', 3), (24, 'train8_g', 3), (48, 'train8_b', 3), (72, 'train8_y', 3)]   # 총무선(황)·야마노테(녹)·게이힌토호쿠(청)
for c0, nm, n in TRAINS:
    for k in range(n): d.put(nm, c0 + 8 * k, 29, solid=False)
for c in (5, 17, 29, 41, 53, 65, 77, 89):                                         # 가선 기둥: 열차 뒤(선로 쪽) 12칸 간격
    d.put('catenary_pole', c, 30, dx=8, solid=False)

# ---------------------------------------------------------------- 건물
fam_n = [('retail', 5), ('office', 3), ('mansion', 1), ('bar', 1)]
place_row(0, AV0, BN, 0, fam_n, 5, 11, ad=.40)
place_row(AV1, NC, BN, 0, fam_n, 5, 11, ad=.40)
fam_u = [('retail', 4), ('office', 1), ('bar', 1)]                            # 가드 아래 낮은 상가
place_row(0, AV0 - 4, BU, 35, fam_u, 4, 8, ad=0, fv=0)
place_row(AV1 + 4, NC, BU, 35, fam_u, 4, 8, ad=0, fv=0)
fam_s = [('retail', 4), ('office', 2), ('izakaya', 1), ('bar', 1)]              # 남열: 도로 쪽이 등, 앞(남) 인도 3행
place_row(0, 14, BS, S0 + 8, fam_s, 5, 9, ad=.3, fv=0)
place_row(17, AV0 - 2, BS, S0 + 8, fam_s, 5, 9, ad=.3, fv=0)
place_row(AV1 + 2, 77, BS, S0 + 8, fam_s, 5, 9, ad=.3, fv=0)
place_row(80, NC, BS, S0 + 8, fam_s, 5, 9, ad=.3, fv=0)

# ---------------------------------------------------------------- 건물 단장(간판 박스·袖看板 적층·가챠 벽·네온 간판)
USED = []
def hit(c0, c1, r0, r1): return any(not (b1 < c0 or b0 > c1 or a1 < r0 or a0 > r1) for (a0, a1, b0, b1) in USED)
def overlay(name, c, r0, key, z=1):
    P = kit.props[name]; USED.append((r0, r0 + P['h'] - 1, c, c + P['w'] - 1)); d.items.append((key, z, 'prop', name, c, r0))
def door_zone(b):
    return b['c'] + b['dc'] - 1, b['c'] + b['dc'] + b['wd']
neon_done = {'r': False, 'b': False}
for i, b in enumerate(BLD):
    c, w, rb, r0, bands, nf = b['c'], b['w'], b['rb'], b['r0'], b['bands'], b['nf']
    floors = [x for x in bands if x[0].startswith('fl.')]; gr = bands[-1]; dz0, dz1 = door_zone(b)
    gtop = r0 + gr[1]
    for dc_ in b['spec'].get('decos', []):
        if dc_.get('deco', '').startswith(('facade_ad', 'vision')):
            D_ = kit.decos[dc_['deco']]; fi_ = dc_['floor']; USED.append((r0 + floors[fi_][1], r0 + floors[fi_][1] + D_['h'] - 1, c + dc_['col'], c + dc_['col'] + D_['w'] - 1))
    ads_here = any(dc.get('deco', '').startswith(('facade_ad', 'vision')) for dc in b['spec'].get('decos', []))
    # 점포 전면: 가챠 벽 (문 반대편, 개방 점포 열)
    if w >= 7 and gkey(gr[0]) in ('konbini', 'shutter', 'glass') and rng.random() < .45:
        for gc in (c + w - 4, c):
            if gc >= c and gc + 4 <= c + w and (gc + 4 <= dz0 or gc >= dz1 + 1):
                d.put('gacha_wall', gc, rb, solid=True); break
    if nf < 1 or len(floors) == 0: continue
    big = (r0 <= 3 and w >= 7 and nf >= 4)
    # 이색 네온 간판 (라디오회관식 적·청): 북열 큰 건물 한 동씩
    if big and not neon_done['r'] and c < AV0 and c >= 6 and not hit(c + w - 3, c + w - 2, gtop - 6, gtop - 1):
        overlay('akiba_neon_r', c + w - 3, gtop - 6, rb); neon_done['r'] = True; used_neon = True
    elif big and not neon_done['b'] and c >= AV1 and not hit(c + 1, c + 2, gtop - 6, gtop - 1):
        overlay('akiba_neon_b', c + 1, gtop - 6, rb); neon_done['b'] = True; used_neon = True
    else: used_neon = False
    # 글자 간판 박스(2칸 높이): 층 하나 골라서
    nb_ = 1 if nf <= 2 else rng.choice([1, 1, 2])
    fl_pick = rng.sample(range(len(floors)), min(nb_, len(floors)))
    for fi in fl_pick:
        if used_neon and fi == 0: continue
        if rng.random() < (.45 if b['rb'] == BN else .6):
            nm, bw = board_name()
            if bw + 2 > w: continue
            cc = c + rng.randint(1, w - bw - 1)
            if hit(cc, cc + bw - 1, r0 + floors[fi][1], r0 + floors[fi][1] + 1): continue
            overlay(nm, cc, r0 + floors[fi][1], rb)
    # 袖看板 적층 (건물 모서리마다 3~5단): 건물 가장자리 열, 크기·종류 변주
    if w >= 5 and nf >= 2 and rng.random() < (.65 if rb == BN else .4):
        edge = c if rng.random() < .5 else c + w - 1
        rows_avail = gr[1] - floors[0][1]
        k = min(rows_avail // 3, rng.choice([2, 3, 3]))
        for j in range(k):
            if hit(edge, edge, r0 + floors[0][1] + j * 3 + (rows_avail - k * 3) // 2, r0 + floors[0][1] + j * 3 + (rows_avail - k * 3) // 2 + 2): continue
            overlay(f'blade_sign.{rng.randrange(4)}', edge, r0 + floors[0][1] + j * 3 + (rows_avail - k * 3) // 2, rb)

# ---------------------------------------------------------------- 소품 배치(문 앞 막힘 방지)
occ = []
def free(name, c, row):
    P = kit.props[name]; w, h = P['w'], P['h']
    if c < 0 or c + w > NC or row - h + 1 < 0 or row >= NR: return False
    for (a0, a1, b0, b1) in occ:
        if not (b1 < c or b0 > c + w - 1) and not (a1 < row - h + 1 or a0 > row): return False
    for (dr, dc) in d.doors:
        if c - 1 <= dc <= c + w and not (row < dr + 1 or row - h + 1 > dr + 3): return False
    return True
def sp(name, c, row, solid=True, **kw):
    if not free(name, c, row): return False
    P = kit.props[name]; occ.append((row - P['h'] + 1, row, c, c + P['w'] - 1))
    d.put(name, c, row, solid=solid, **kw); return True
def sp_try(name, c0, c1, r0, r1, n=1, solid=True, tries=40):
    got = 0
    for _ in range(tries):
        if got >= n: break
        if sp(name, rng.randint(c0, c1), rng.randint(r0, r1), solid=solid): got += 1
    return got

# 방책·콘 (끝 막힘): 불규칙하게, 좌우 비대칭
for c in range(AV0 + 4, AV1 - 4, 3):
    if c in (49,): continue
    d.put('barricade3', c, 4, solid=False)
for c in range(AV0 + 4, AV1 - 4, 3):
    if c in (43, 55): continue
    d.put('barricade3', c, 60 - 0, solid=False)
for (c, r) in ((AV0 + 3, 5), (AV1 - 5, 5), (AV0 + 3, 59), (AV1 - 4, 58), (46, 5)): d.put('cone', c, r)
# 동서 도로 끝 봉쇄(보행자 천국): 방책 + 콘 + 경비
for r in (S0 + 1, S0 + 3):
    d.put('barricade3', 27, r, solid=False); d.put('barricade3', 66, r + 1, solid=False)
d.put('barricade3', 27, S0 + 5, solid=False)
for (c, r) in ((26, S0 + 2), (30, S0 + 3), (65, S0 + 2), (68, S0 + 4)): d.put('cone', c, r, solid=False)
d.put('person.7', 25, S0 + 4, dx=4, solid=False); d.put('person.22', 30, S0 + 1, dx=2, solid=False)
d.put('person.14', 68, S0 + 5, dx=-3, solid=False); d.put('person.31', 64, S0 + 1, solid=False)

# 가로수(드문드문·비대칭)·가로등(대로변은 전봇대 대신)·신호기
for (c, r) in ((AV0, 15), (AV1 - 4, 38), (AV0, 57)): d.put('tree.zelkova', c, r)
for (c, r) in ((AV0 + 1, 7), (AV0 + 1, 40), (AV1 - 2, 12), (AV1 - 2, 22), (AV1 - 2, 54)):
    if not any(c <= dc <= c + 1 and dr - 1 <= r <= dr + 3 for dr, dc in d.doors): d.put('lamp_post', c, r)
d.put('metro_exit', AV0, 24)
for (c, r) in ((AV0 - 1, S0 - 1), (AV1, S0 - 1), (AV0 - 1, S0 + 8), (AV1, S0 + 8)): safe_put(d, 'signal', c, r)
for (c, r) in ((AV0 + 3, 20), (AV0 + 3, 46 - 3 - 0), (AV1 - 4, 36)): d.put('maid_flyer_stand', c, r)
d.put('post_box', AV1 - 1, 42); d.put('stop_sign', 29, S0 + 6) if False else None

# 북 골목(라디오 데파트 거리): 전봇대+전선, 자판기, 자전거, 코인 주차, 흡연소, 쓰레기, 전단지 스탠드
for (c0, c1) in ((0, AV0 - 5), (AV1 + 4, NC - 3)):
    sp_try('utility_pole2', c0 + 2, c1 - 2, 25, 25, 2)
    sp_try('vend_trio', c0, c1 - 5, 24, 25, 1); sp_try('vend_pair', c0, c1 - 4, 24, 25, 1)
    sp_try('vending.aka', c0, c1, 24, 25, 1); sp_try('vending.sora', c0, c1, 24, 25, 1); sp_try('vending.midori', c0, c1, 23, 25, 1)
    sp_try('bike_cluster', c0, c1 - 2, 22, 25, 3, solid=False); sp_try('bike.aka', c0, c1, 24, 25, 1, solid=False); sp_try('bike.sora', c0, c1, 24, 25, 1, solid=False)
    sp_try('smoking_area', c0, c1, 24, 25, 1); sp_try('garbage_net', c0, c1, 23, 25, 2)
    sp_try('coin_p', c0, c1, 24, 25, 3); sp_try('coin_sign', c0, c1, 24, 25, 1)
    sp_try('maid_flyer_stand', c0, c1, 22, 24, 2); sp_try('post_box', c0, c1, 24, 25, 1)
    sp_try('curve_mirror', c0, c1, 24, 25, 1)
# 남 인도·골목
for (c0, c1) in ((1, 13), (18, AV0 - 3), (AV1 + 3, 76), (81, NC - 2)):
    sp_try('vending.aka', c0, c1, 62, 63, 1); sp_try('vending.sora', c0, c1, 62, 63, 1)
    sp_try('bike_cluster', c0, c1 - 2, 62, 63, 1, solid=False); sp_try('garbage_net', c0, c1, 62, 63, 1)
sp_try('smoking_area', 18, 30, 62, 63, 1); sp_try('vend_pair', 82, 90, 62, 63, 1)
sp_try('utility_pole2', 14, 16, 61, 63, 1); sp_try('utility_pole2', 77, 79, 61, 63, 1)       # 뒷골목 전봇대
for c in (14, 77):                                                                          # 골목 길 위 소품
    sp('bike_cluster', c, 56, solid=False); sp('coin_sign', c + 2, 57)
# 가드 아래 낮은 상가 앞 인도: 자판기·전단지·소품
for (c0, c1) in ((0, 30), (68, 94)):
    sp_try('vending.aka', c0, c1, 43, 43, 1); sp_try('maid_flyer_stand', c0, c1, 42, 43, 2)
for (c, r) in ((AV0 - 2, 52), (AV1 + 1, 52)): pass

# ---------------------------------------------------------------- 차량: 간다묘진도리 (좌측통행: 동행 = 북쪽 차선(S0+2), 서행 = 남쪽 차선(S0+5))
def lane_cars(row, c0, c1, east, truck=False):
    cols = ['white', 'silver', 'black', 'red', 'blue', 'taxi', 'green', 'navy', 'white']
    seq = []; total = 0; span = c1 - c0
    while True:
        p = rng.random()
        if p < .17: nm = 'van.white' if east else 'van.silver_r'
        else:
            nm = 'car.' + rng.choice(cols); nm = nm if east else nm + '_r'
        gap = rng.choice([2, 3, 4, 6, 9, 12]); w = kit.props[nm]['w']
        if total + w > span: break
        seq.append([nm, gap]); total += w + gap
    if truck and seq:
        i = rng.randrange(len(seq)); seq[i][0] = 'ad_truck' if east else 'ad_truck_r'
        if total + 1 > span + 2: seq[i][1] = max(1, seq[i][1] - 1)
    c = c0 + rng.randint(0, 3)
    for nm, gap in seq:
        w = kit.props[nm]['w']
        if c + w > c1 + 1: break
        d.put(nm, c, row, solid=False); c += w + gap
lane_cars(S0 + 2, 0, 24, True, truck=True); lane_cars(S0 + 5, 0, 24, False)
lane_cars(S0 + 2, 70, NC - 1, True); lane_cars(S0 + 5, 70, NC - 1, False, truck=True)

# ---------------------------------------------------------------- 사람(Actor1 원본 person.0~39 만)
crowd(d, rng, 8, 26, AV0 + 5, AV1 - 6, 22)                      # 북쪽은 한산
crowd(d, rng, 34, 43, AV0 + 5, AV1 - 6, 30)                     # 가드 지나 전기상가 앞: 붐빔
crowd(d, rng, 50, 58, AV0 + 5, AV1 - 6, 36)                     # 남쪽(큰 점포 앞)이 가장 붐빔
crowd(d, rng, S0 + 1, S0 + 5, AV0 + 1, AV1 - 2, 8)              # 도로 횡단
crowd(d, rng, 34, 34, AV0 + 1, AV1 - 2, 6)                      # 열린 아치 아래
crowd(d, rng, 22, 24, 0, NC - 4, 16)                            # 북 골목
crowd(d, rng, S0 - 1, S0 - 1, 0, NC - 4, 12); crowd(d, rng, S0 + 6, S0 + 6, 0, NC - 4, 12)
crowd(d, rng, BS + 2, BS + 3, 0, NC - 4, 14)                    # 남 인도
# 점포 앞 줄: 문 앞 한쪽에 서 있는 줄(문 바로 앞은 비움)
for b in [x for x in BLD if x['rb'] == BN and x['w'] >= 7][1:3]:
    cx = b['c'] + b['dc'] + b['wd'] + 1
    for j in range(5): d.put(f'person.{rng.randrange(40)}', cx, BN + 3 + (j % 2), dx=j * 6 % 12 - 4, dy=-2 + j * 4, solid=False)

im = d.render()
Image.fromarray(im).save(os.path.join(jpenv.DISTRICTS_OUT, 'district_akiba.png'))
print(im.shape, 'buildings', len(BLD), 'north', sum(1 for x in BLD if x['rb'] == BN), 'under', sum(1 for x in BLD if x['rb'] == BU), 'south', sum(1 for x in BLD if x['rb'] == BS))
check(d, 'akiba')
# 건물끼리 겹침 검사
for rbv in set(x['rb'] for x in BLD):
    row = sorted([x for x in BLD if x['rb'] == rbv], key=lambda x: x['c'])
    for a, b in zip(row, row[1:]):
        assert a['c'] + a['w'] <= b['c'], ('겹침', rbv, a['c'], a['w'], b['c'])
