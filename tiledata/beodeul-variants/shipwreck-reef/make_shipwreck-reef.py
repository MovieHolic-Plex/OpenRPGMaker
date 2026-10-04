# 난파선 암초 — 썰물에 드러난 갯벌 위의 난파선(바깥) + 선장실·화물칸·선원실(안쪽). 다시 돌리면 같은 그림.
#   python3 make_shipwreck-reef.py
import os, sys, math, json
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '_common-4'))
import numpy as np
from PIL import Image
from scipy.ndimage import distance_transform_edt as edt, binary_dilation
import c4
from c4 import *
import pa, pf, pz, pboat
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = HERE
sys.path.insert(0, HERE)
import sr_pieces, sr_interior

W, H = 64, 42
Hp, Wp = H * 16, W * 16
P = c4.Parts()
Y, X = np.mgrid[0:Hp, 0:Wp]
cyc, cxc = np.mgrid[0:H, 0:W]

# ------------------------------------------------------------ 지형 (픽셀 단위 마스크)
n1 = lambda sc, sd: noise(Hp, Wp, sc, sd)
# 풀/모래 경계 (북쪽), 젖은 갯벌 시작선
grass_line = 8.5 * 16 + (n1(10, 3) - .5) * 44
flat_line = 13 * 16 + (n1(9, 4) - .5) * 40
coast = 35 * 16 + (n1(12, 5) - .5) * 40
sea = Y > coast
# 서쪽 만·동쪽 만
sea |= ((X - 0) / 96.0) ** 2 + ((Y - 30 * 16) / 84.0) ** 2 < 1 + (n1(6, 6) - .5) * .3
sea |= ((X - 1024) / 118.0) ** 2 + ((Y - 27 * 16) / 100.0) ** 2 < 1 + (n1(6, 7) - .5) * .3
# 갯벌 물웅덩이 (막힌다)
POOLS = [(9.0, 22.0, 2.6, 1.7), (11.5, 16.5, 1.7, 1.2), (44.0, 20.5, 3.0, 1.9), (52.0, 24.0, 2.0, 1.4),
         (40.0, 15.0, 1.6, 1.1), (35.5, 33.0, 2.2, 1.0), (5.5, 27.5, 1.6, 1.2), (57.0, 17.0, 2.3, 1.5),
         (24.0, 12.6, 1.9, 1.2), (31.0, 15.6, 2.0, 1.3)]
pool = np.zeros((Hp, Wp), bool)
for (cx, cy, rx, ry) in POOLS:
    pool |= ((X - cx * 16) / (rx * 16.0)) ** 2 + ((Y - cy * 16) / (ry * 16.0)) ** 2 < 1 + (n1(4, 20 + int(cx)) - .5) * .35
water = sea | pool

out = PAINT['sand'](X, Y, 7)
grass = (Y < grass_line)
out[grass] = PAINT['grass'](X, Y, 9)[grass]
flat = (Y > flat_line) & ~water
out[flat] = PAINT['wetsand'](X, Y, 11)[flat]
# 갯벌 속 마른 모래톱 몇 덩이 (물 빠질 때 먼저 마르는 자리)
dry = flat & (n1(14, 13) > .62)
out[dry] = PAINT['sand'](X, Y, 15)[dry]

# 길 — 야영지에서 난파선 뱃전까지, 마른 모래로 다져진 폭 20~24px
def polymask(pts, r, seed):
    m = np.zeros((Hp, Wp), bool)
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        dx, dy = x1 - x0, y1 - y0; L2 = dx * dx + dy * dy
        t = np.clip(((X - x0) * dx + (Y - y0) * dy) / L2, 0, 1)
        d = np.hypot(X - (x0 + t * dx), Y - (y0 + t * dy))
        m |= d < r + (n1(6, seed) - .5) * 6
    return m
PATH = [(328, 0), (326, 60), (318, 120), (304, 175), (284, 230), (262, 290), (240, 350), (226, 410), (224, 460), (240, 500), (276, 516), (318, 518), (350, 512)]
pm = polymask(PATH, 11, 31) & ~water
pm2 = polymask([(318, 150), (290, 156), (250, 172), (215, 178)], 7, 32) & ~water           # 야영지로 가는 샛길
pm3 = polymask([(284, 230), (360, 236), (450, 250), (520, 262)], 6, 33) & ~water & (Y > 13 * 16)   # 뼈대(늑재) 쪽 샛길
pmk = pm | pm2 | pm3
outdirt = PAINT['dirt'](X, Y, 29)
sandy = PAINT['sand'](X, Y, 30)
gm = pmk & (Y < flat_line)
out[gm] = outdirt[gm]
fm = pmk & (Y >= flat_line)
out[fm] = sandy[fm]
edge = pmk & ~(edt(pmk) > 2)
out[edge & (n1(2, 34) > .58) & (Y < grass_line)] = LF[3]

# 암초 능선 (막힌다) — 갯벌 위의 어두운 바위 띠. 길·난파선·야영지 자리는 비켜 간다.
WRECK_X0, WRECK_Y0 = 240, 392          # 난파선 스프라이트 왼위(px). 갑판이 셀 줄 27~28 에 정확히 앉게 8px 어긋남
keep = np.zeros((Hp, Wp), bool)
keep[WRECK_Y0 - 20:WRECK_Y0 + 150, WRECK_X0 - 40:WRECK_X0 + 240] = True
keep |= binary_dilation(pmk, iterations=14)
keep |= ((X - 250) / 140.0) ** 2 + ((Y - 190) / 60.0) ** 2 < 1                          # 야영지
keep |= (Y < flat_line + 8)
keep |= ((X - 520) / 150.0) ** 2 + ((Y - 420) / 70.0) ** 2 < 1                          # 늑재 마당
from scipy.ndimage import binary_opening, binary_closing
from scipy.ndimage import gaussian_filter
reef_n = gaussian_filter(n1(12, 41) * .7 + n1(5, 42) * .3, 5)
reef = (reef_n > np.quantile(reef_n[(Y > 200) & (Y < coast - 30)], .72)) & ~water & ~keep & (Y < coast - 16)
reef = binary_opening(reef, iterations=6)
reef = binary_closing(reef, iterations=3) & ~keep & ~water
# 바위: 윗면 ST[3] 알갱이, 앞면(아래 가장자리) 어둡게, 왼위 모서리 밝게
up = np.zeros_like(reef); up[6:] = reef[:-6]
face = reef & ~up[:, :] if False else reef & ~np.roll(reef, -6, axis=0)   # 아래 6px 안에 바위가 끝나는 곳 = 앞면
hi = reef & ~np.roll(reef, 2, axis=0) | (reef & ~np.roll(reef, 2, axis=1))
gr = n1(2, 47)
out[reef] = np.where((gr > .55)[reef][:, None], ST[4], ST[3]).astype(int)
out[reef & (gr < .25)] = ST[2]
out[face] = ST[2]
out[face & (n1(3, 48) > .6)] = ST[1]
out[hi & ~face] = ST[4]
rim = reef & ~(edt(reef) > 1.5)
out[rim & ~hi & ~face] = ST[1]
# 물 색·거품
out = shore(out, water, ~water, seed=5)
wetrim = (~water) & (edt(~water) < 5 + n1(4, 8) * 2) & (Y > flat_line) & ~reef
out[wetrim & ~pmk] = PAINT['wetsand'](X, Y, 23)[wetrim & ~pmk]
ground = Image.fromarray(np.dstack([out.astype(np.uint8), np.full((Hp, Wp), 255, np.uint8)]))

S = Scene(W, H)
S.base = ground
cellfrac = lambda m: m.reshape(H, 16, W, 16).mean(axis=(1, 3))
S.walk[:] = True
S.walk[cellfrac(water) > .3] = False
S.walk[cellfrac(reef) > .35] = False

# ------------------------------------------------------------ 소품 배치 도우미
c4_TREES = {'oakA': (224, 512, 4, 5), 'oakB': (288, 512, 3, 4), 'bushC': (336, 512, 2, 2), 'bushD': (368, 512, 3, 3), 'bushE': (368, 560, 2, 2)}
def _crop(name):
    x, y, w, h = c4_TREES[name]; return CH.crop((x, y, x + w * 16, y + h * 16)).convert('RGBA')
def tree(name, cx, foot):
    im = _crop(name); S.put(im, cx * 16 - im.width // 2, foot - im.height, 'tree', foot=foot)
    S.block(int(cx) - 1, int((foot - 8) // 16), int(cx), int((foot - 8) // 16))
def bush(name, cx, foot):
    im = _crop(name); S.put(im, cx * 16 - im.width // 2, foot - im.height, 'bush', foot=foot)
    S.block(int(cx - im.width / 32 + .5), int((foot - 8) // 16))
def pp(obj, cx, foot, name='', bl='foot', shrink=0):
    im = pz.fin(obj) if hasattr(obj, 'img') else obj.convert('RGBA')
    x = int(cx - im.width // 2); y = int(foot - im.height)
    S.put(im, x, y, name, foot=foot)
    if bl == 'foot':
        cy = (foot - 1) // 16
        S.block((x + shrink) // 16, cy, (x + im.width - 1 - shrink) // 16, cy)
    elif bl:
        S.block(*bl)
    return im

# ------------------------------------------------------------ 새 조각
pieces, info = sr_pieces.all_pieces()
PIECE = {}
for nm, im, note in pieces:
    P.add(nm, im, note); PIECE[nm] = im

# ------------------------------------------------------------ 난파선 (앵커)
WR = PIECE['wreck']
S.put(WR, WRECK_X0, WRECK_Y0, 'wreck', foot=WRECK_Y0 + 96)
al = np.array(WR)[..., 3] > 0
# 셀 단위 통행: 갑판 띠(예: 위에서 본 판)만 걷고 나머지 선체·돛대는 막는다
edge_d = info['edge']
deck = np.zeros((H, W), bool)
for cy in range(H):
    for cx in range(W):
        rx = cx * 16 + 8 - WRECK_X0; ry = cy * 16 + 8 - WRECK_Y0
        e = edge_d.get(rx)
        if e and e[0] <= ry <= e[1] + 1:
            deck[cy, cx] = True
hull_block = np.zeros((H, W), bool)
for cy in range(H):
    for cx in range(W):
        x0, y0 = cx * 16 - WRECK_X0, cy * 16 - WRECK_Y0
        if x0 < 0 or y0 < 0 or x0 + 16 > WR.width or y0 + 16 > WR.height:
            if x0 + 16 <= 0 or y0 + 16 <= 0 or x0 >= WR.width or y0 >= WR.height: continue
        sub = al[max(0, y0):max(0, y0) + 16, max(0, x0):max(0, x0) + 16]
        if sub.size and sub.mean() > .28: hull_block[cy, cx] = True
S.walk[hull_block] = False
S.walk[deck] = True
# 돛대·찢긴 돛·삭구 — 선체 위에 같은 좌표로 겹친다(따로 그린 조각: 기둥 이름). 앞 돛대 밑동 칸만 막는다(주 돛대는 승강구 칸과 겹쳐 열어 둔다)
S.put(PIECE['wreck_rig_pole'], WRECK_X0, WRECK_Y0, 'wreck_rig', foot=WRECK_Y0 + 97)
for _mx in (158,):
    S.walk[(WRECK_Y0 + 62) // 16, (WRECK_X0 + _mx) // 16] = False
# 뱃전 아래 빈 모래띠(선체 밑 그림자 칸)는 막힌 채로 둔다 — 걸으면 선체를 뚫는다
# 승강 널판(현문) — 남쪽 뱃전에서 모래로 (스프라이트 32×48)
GW = PIECE['gangway']
gx_, gtop = 21 * 16, 29 * 16
S.put(GW, gx_, gtop, 'gangway', foot=gtop + 48)
S.open_(21, 29, 22, 31)
# 선체 열린 곳: 승강구(위에서 내려가는 구멍), 고물 문 — 표식
HATCH = (WRECK_X0 + 99, WRECK_Y0 + 51)
S.marks['hatch'] = (HATCH[0] // 16, HATCH[1] // 16 + 1)
S.marks['stern_door'] = ((WRECK_X0 + 44) // 16, (WRECK_Y0 + 54) // 16)
S.marks['deck_mid'] = ((WRECK_X0 + 130) // 16, (WRECK_Y0 + 58) // 16)

# ------------------------------------------------------------ 늑재(뼈대) — 뱃머리 부서진 자리 동쪽 모래
pp(PIECE['rib_big'], 33 * 16 + 4, 30 * 16 + 4, 'rib', bl=(32, 29, 33, 29))
pp(PIECE['rib_big'], 37 * 16, 27 * 16 + 12, 'rib', bl=(36, 26, 37, 26))
pp(PIECE['rib_small'], 35 * 16 + 10, 33 * 16 - 2, 'ribs', bl=(35, 32, 35, 32))
pp(PIECE['snapped_mast'], 42 * 16, 30 * 16 + 6, 'mast', bl=(41, 29, 43, 29))
pp(PIECE['figurehead'], 47 * 16, 27 * 16 + 4, 'figurehead', bl=(46, 26, 47, 26))
pp(PIECE['plank_pile'], 40 * 16, 25 * 16 + 8, 'planks', bl=(39, 24, 40, 24))
pp(PIECE['driftwood_a'], 44 * 16 + 8, 33 * 16 + 4, 'driftwood', bl=None)
pp(PIECE['driftwood_b'], 30 * 16, 33 * 16 + 8, 'driftwood', bl=None)
pp(PIECE['buried_chest'], 34 * 16 + 8, 24 * 16 + 4, 'chest', bl=(34, 23, 34, 23))
pp(PIECE['lifebuoy'], 44 * 16 + 8, 22 * 16 + 4, 'lifebuoy', bl=None)

# ------------------------------------------------------------ 난파선 서쪽·고물 뒤
pp(PIECE['broken_barrel'], 12 * 16 + 4, 27 * 16 + 6, 'barrel', bl=(11, 26, 12, 26))
pp(PIECE['plank_pile'], 13 * 16, 31 * 16 + 4, 'planks', bl=(12, 30, 13, 30))
pp(pz.anchor(), 6 * 16 + 8, 29 * 16 + 8, 'anchor')
pp(PIECE['rope_coil'], 15 * 16 + 4, 33 * 16, 'rope', bl=None)
pp(PIECE['driftwood_a'], 8 * 16 + 8, 32 * 16 + 4, 'driftwood', bl=None)

# ------------------------------------------------------------ 야영지 (북쪽 해안 어귀) — 난파선 생존자의 캠프
tx, ty = 13, 10
S.put(PIECE['tarp_lean'], tx * 16 - 8, ty * 16 - 12, 'tarp', foot=ty * 16 + 14)
S.block(tx - 1, ty, tx + 1, ty)
pp(PIECE['campfire'], 16 * 16 + 8, 12 * 16 + 4, 'campfire', bl=(16, 11, 16, 11))
pp(pf.barrels(), 10 * 16 + 8, 11 * 16 + 8, 'barrels')
pp(PIECE['rope_coil'], 13 * 16 + 8, 12 * 16 + 10, 'rope', bl=None)
pp(pz.fish_barrel(), 17 * 16 + 8, 10 * 16 + 12, 'fishbarrel')
pp(pboat.boat('rowboat', 0), 20 * 16, 11 * 16 + 4, 'rowboat', bl=(18, 10, 21, 10))
pp(pz.net_rack(), 11 * 16, 13 * 16 + 8, 'net')
pp(PIECE['shells'], 15 * 16 + 4, 13 * 16 + 6, 'shells', bl=None)
pp(PIECE['shells'], 27 * 16, 9 * 16 + 6, 'shells', bl=None)

# ------------------------------------------------------------ 북쪽 풀밭·나무
for nm, cx, foot in (('oakB', 11, 132), ('bushD', 14.5, 116), ('bushC', 17, 104), ('oakB', 26.5, 134), ('bushE', 24, 108), ('bushC', 30, 106),
                     ('oakB', 34.5, 130), ('bushD', 40, 118), ('oakB', 44.5, 136), ('bushE', 48.5, 106), ('oakB', 52.5, 132), ('bushC', 55, 104),
                     ('bushE', 9.8, 112), ('bushC', 38, 100)):
    if nm.startswith('oak'): tree(nm, cx, foot)
    else: bush(nm, cx, foot)
for cx, cy in ((29, 8), (47, 9), (55, 9), (37, 8)):
    pp(pa.boulder(), cx * 16 + 8, cy * 16 + 14, 'boulder')
for cx, cy in ((36, 11), (50, 11), (54, 12), (30, 12), (42, 10)):
    pp(pa.stones(), cx * 16, cy * 16 + 10, 'stones', bl=None)
pp(pz.bench_park(), 28 * 16, 8 * 16 + 10, 'bench') if False else None

# ------------------------------------------------------------ 암초·갯벌 소품 (자연 덩어리)
def cluster(names, cx, cy, spread, seed, block=False):
    rng = np.random.default_rng(seed)
    for nm in names:
        px = int(cx * 16 + rng.integers(-spread, spread + 1)); py = int(cy * 16 + rng.integers(-spread // 2, spread // 2 + 1) + 12)
        cxx, cyy = px // 16, (py - 1) // 16
        if not (0 <= cxx < W and 0 <= cyy < H) or water[min(Hp - 1, py - 4), min(Wp - 1, px)] or pmk[min(Hp - 1, py - 4), min(Wp - 1, px)]: continue
        pp(PIECE[nm], px, py, nm, bl=(cxx, cyy, cxx, cyy) if block else None)
for nm_list, cx, cy, sp, sd, bl in (
        (['barnacle_rock_a', 'seaweed_a', 'barnacle_rock_b'], 6.0, 17, 30, 51, True),
        (['barnacle_rock_b', 'seaweed_b', 'seaweed_a'], 13.5, 20, 26, 52, True),
        (['barnacle_rock_a', 'seaweed_a'], 4.0, 24, 20, 53, True),
        (['barnacle_rock_b', 'seaweed_b', 'barnacle_rock_a'], 47.0, 15.5, 30, 54, True),
        (['barnacle_rock_a', 'seaweed_a', 'seaweed_b'], 56.0, 21, 24, 55, True),
        (['barnacle_rock_b', 'seaweed_a'], 49.0, 32, 22, 56, True),
        (['barnacle_rock_a', 'barnacle_rock_b', 'seaweed_b'], 21.0, 15.5, 28, 57, True),
        (['seaweed_a', 'seaweed_b', 'shells'], 38.5, 30.5, 34, 58, False),
        (['seaweed_b', 'shells', 'seaweed_a'], 26.0, 34, 40, 59, False),
        (['seaweed_a', 'shells'], 10.0, 34, 30, 60, False),
        (['seaweed_b', 'seaweed_a'], 55.0, 30, 22, 61, False),
        (['driftwood_b', 'shells'], 60.0, 21, 18, 62, False),
        (['seaweed_a', 'shells', 'driftwood_b', 'seaweed_b'], 25.0, 12.5, 34, 63, False),
        (['barnacle_rock_b', 'seaweed_b', 'shells'], 38.0, 10.5, 30, 64, True),
        (['driftwood_a', 'shells', 'seaweed_a'], 31.0, 16.0, 30, 65, False),
        (['barnacle_rock_a', 'seaweed_a', 'seaweed_b'], 44.0, 13.0, 26, 66, True)):
    cluster(nm_list, cx, cy, sp, sd, bl)

# 풀밭·모래 경계 바깥에 있는 것들이 길을 막지 않는지 검사하기 전에, 길 위를 다시 연다
pathcell = cellfrac(pmk) > .35
S.walk[pathcell & ~cellfrac(water).astype(bool) & (cyc < 27) & (cyc >= 0)] |= False
# 길 셀 중 소품이 막은 곳은 그대로 두고 BFS 로 끊김을 본다

# ------------------------------------------------------------ 표식·통행 검사
S.marks['gangway_foot'] = (21, 32)
S.marks['camp'] = (11, 10)
S.marks['ribs'] = (34, 30)
marks = {'entrance': (20, 4), 'camp': S.marks['camp'], 'gangway_foot': S.marks['gangway_foot'],
         'deck_mid': S.marks['deck_mid'], 'hatch': S.marks['hatch'], 'stern_door': S.marks['stern_door'], 'ribs': S.marks['ribs']}
ok, n = S.bfs(marks['entrance'], {k: v for k, v in marks.items() if k != 'entrance'})
print('BFS', ok, n, 'reef%', round(float(reef.mean()),3))

# ------------------------------------------------------------ 크롭 (48×34 로 줄인다: 빈 갯벌을 메우지 않고 맵을 줄인다)
CX0, CY0, CW, CH = 8, 4, 48, 34
S2 = c4.Scene(CW, CH)
S2.base = S.base.crop((CX0 * 16, CY0 * 16, (CX0 + CW) * 16, (CY0 + CH) * 16))
S2.walk = S.walk[CY0:CY0 + CH, CX0:CX0 + CW].copy()
S2.objs = [(k - CY0 * 16, im, x - CX0 * 16, y - CY0 * 16, nm) for k, im, x, y, nm in S.objs]
S2.marks = {k: (v[0] - CX0, v[1] - CY0) for k, v in S.marks.items()}
pathcell = pathcell[CY0:CY0 + CH, CX0:CX0 + CW]
water_c = cellfrac(water)[CY0:CY0 + CH, CX0:CX0 + CW]
S = S2; W, H = CW, CH
marks = {k: (v[0] - CX0, v[1] - CY0) for k, v in marks.items()}
ok, n = S.bfs(marks['entrance'], {k: v for k, v in marks.items() if k != 'entrance'})
print('BFS(crop)', ok, n)
out_img = S.compose()
strip, floors, fwalks = sr_interior.build_all(P)
full = Image.new('RGBA', (max(W * 16, strip.width), H * 16 + 8 + strip.height), (10, 8, 14, 255))
full.paste(out_img, (0, 0)); full.paste(strip, (0, H * 16 + 8))
full = full.convert('RGB')
os.makedirs(os.path.join(HERE, '..', '_out-4'), exist_ok=True)
c4.save_pair(full, OUT)

# 빈 바닥 통계 (한 화면 20x15)
dec = ~S.walk.copy()
for _, img, x, y, nm in S.objs:
    dec[max(0, y // 16):min(H, (y + img.height - 1) // 16 + 1), max(0, x // 16):min(W, (x + img.width - 1) // 16 + 1)] = True
dec |= pathcell
print('빈칸 최악', c4.empty_stats(S, dec))

grid = {'w': W, 'h': H, 'walk': [''.join('.' if v else '#' for v in r) for r in S.walk],
        'legend': '. 걸음 / # 막힘 (갑판 띠는 걸음)', 'marks': {k: list(v) for k, v in marks.items()}, 'bfs_from_entrance': ok,
        'interior_floors': {'note': '안쪽 3칸은 이미지 아래 띠(y=%dpx~)에 나란히. 선장실 16x14, 화물칸 24x14, 선원실 16x14' % (H * 16 + 8),
                            'floors': [{'name': nm, 'w': w_.shape[1], 'h': w_.shape[0], 'walk': [''.join('.' if v else '#' for v in r) for r in w_]}
                                       for nm, w_ in zip(('선장실', '화물칸', '선원실'), [np.asarray(a) for a in fwalks])]}}
json.dump(grid, open(os.path.join(OUT, 'grid.json'), 'w'), ensure_ascii=False)
md, cnt, cells = P.save(os.path.join(OUT, 'parts'), '난파선 암초')
open(os.path.join(OUT, 'parts.md'), 'w').write(md)
print('parts', cnt, cells)
