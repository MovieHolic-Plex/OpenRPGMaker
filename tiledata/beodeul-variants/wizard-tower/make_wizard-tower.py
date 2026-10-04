# 마법사의 탑 — 숲 속 정원(바깥) + 탑 안 3개 층.  다시 돌리면 같은 그림.  python3 make_wizard-tower.py
import os, sys, json, math
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '_common-4'))
sys.path.insert(0, HERE)
import numpy as np
from PIL import Image, ImageDraw
import c4
from c4 import *
import pa, pf, pz, kits7_manor as K
import wt_pieces as WP
import wt_interior
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = HERE

W, H = 40, 34
P = c4.Parts()
Hp, Wp = H * 16, W * 16
kind = np.ones((H, W), int)
out, fin = paint_ground(kind, {1: 'grass', 4: 'flag'}, seed=13, jitter=2.0)
Y, X = np.mgrid[0:Hp, 0:Wp]
from scipy.ndimage import distance_transform_edt as edt

# 별 광장: 납작한 원(3/4) — 돌바닥
PCX, PCY = 320, 312
dist = ((X - PCX) / 96.0) ** 2 + ((Y - PCY) / 74.0) ** 2
PLZ = dist < 1 + (noise(Hp, Wp, 5, 41) - .5) * .22
out[PLZ] = PAINT['flag'](X, Y, 43)[PLZ]

def polymask(pts, r, seed):
    m = np.zeros((Hp, Wp), bool)
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        dx, dy = x1 - x0, y1 - y0; L2 = dx * dx + dy * dy
        t = np.clip(((X - x0) * dx + (Y - y0) * dy) / L2, 0, 1)
        d = np.hypot(X - (x0 + t * dx), Y - (y0 + t * dy))
        m |= d < r + (noise(Hp, Wp, 6, seed) - .5) * 6
    return m
pm = polymask([(320, 540), (320, 500), (322, 440), (320, 390)], 12, 31)
pm |= polymask([(320, 452), (270, 446), (200, 428), (120, 392)], 7, 32)      # 온실 문
pm |= polymask([(320, 452), (380, 452), (450, 446), (520, 440)], 7, 33)      # 분수
pm |= polymask([(140, 400), (120, 420), (96, 440)], 6, 34)                  # 약초밭
pm &= ~PLZ
out[pm] = PAINT['dirt'](X, Y, 29)[pm]
edge = pm & ~(edt(pm) > 2)
out[edge & (noise(Hp, Wp, 2, 30) > .55)] = LF[3]
ground = Image.fromarray(np.dstack([out.astype(np.uint8), np.full((Hp, Wp), 255, np.uint8)]))

# 광장 가장자리 테두리 + 8각 별 상감
pe = PLZ & ~(edt(PLZ) > 2)
g = np.array(ground); g[pe, :3] = ST[2]; ground = Image.fromarray(g)
d = ImageDraw.Draw(ground)
def star(cx, cy, R, r, rot, fill, outline):
    pts = []
    for i in range(16):
        a = rot + i * math.pi / 8; rad = R if i % 2 == 0 else r
        pts.append((cx + rad * math.cos(a) * 1.0, cy + rad * math.sin(a) * 0.78))
    d.polygon(pts, fill=tuple(fill), outline=tuple(outline))
star(PCX, PCY, 66, 27, -math.pi / 2, ST[1], ST[0])
star(PCX, PCY, 58, 23, -math.pi / 2, ST[4], ST[2])
star(PCX, PCY, 38, 17, -math.pi / 2 + math.pi / 8, ST[5], ST[3])
d.ellipse((PCX - 15, PCY - 12, PCX + 15, PCY + 12), fill=tuple(SR[3]), outline=tuple(SR[0]))
d.ellipse((PCX - 11, PCY - 9, PCX + 11, PCY + 9), fill=tuple(SR[5]), outline=tuple(SR[2]))

S = Scene(W, H); S.base = ground; S.walk[:] = True
c4_TREES = {'oakA': (224, 512, 4, 5), 'oakB': (288, 512, 3, 4), 'bushC': (336, 512, 2, 2), 'bushD': (368, 512, 3, 3), 'bushE': (368, 560, 2, 2)}
def tree(name, cx, foot):
    x, y, w, h = c4_TREES[name]
    im = CH.crop((x, y, x + w * 16, y + h * 16)).convert('RGBA')
    S.put(im, int(cx * 16 - im.width // 2), foot - im.height, 'tree', foot=foot)
    S.block(int(cx) - 1, int((foot - 8) // 16), int(cx), int((foot - 8) // 16))
def bush(name, cx, foot):
    x, y, w, h = c4_TREES[name]
    im = CH.crop((x, y, x + w * 16, y + h * 16)).convert('RGBA')
    S.put(im, int(cx * 16 - im.width // 2), foot - im.height, 'bush', foot=foot)
    S.block(int(cx - w / 2 + .5), int((foot - 8) // 16))
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


def herb_bed(kind, seed):
    """32x22 나무 틀 이랑 (3/4 ): 윗면 T=흙+식물 7줄, 앞면 F=널판 12줄. 윗면이 더 밝고 앞면은 한 단 어둡다."""
    im = Image.new('RGBA', (32, 22), (0, 0, 0, 0)); px = im.load()
    rs = np.random.RandomState(seed)
    T0, T1, F1 = 3, 9, 21                                   # 윗면 y3..9 (7줄), 앞면 y10..21 (12줄)
    for y in range(T0, F1 + 1):
        for x in range(32):
            if y <= T1:
                px[x, y] = tuple(WD[4]) + (255,) if (x * 3 + y * 5) % 9 else tuple(WD[3]) + (255,)        # 흙(윗면, 밝다)
            else:
                k = y - T1 - 1
                c = WD[2] if (x // 8 + k // 6) % 2 == 0 else WD[1]                               # 널판 두 장 (F, 윗면보다 어둡다)
                if k % 6 == 5: c = WD[0]                                                          # 널판 사이 줄
                px[x, y] = tuple(c) + (255,)
    for x in range(32): px[x, T0] = tuple(WD[5]) + (255,); px[x, T1 + 1] = tuple(WD[5]) + (255,)     # 윗면 테두리 / 앞 모서리 하이라이트
    for x in range(32): px[x, F1] = tuple(WD[0]) + (255,)
    for y in range(T0, T1 + 1): px[0, y] = tuple(WD[5]) + (255,); px[31, y] = tuple(WD[1]) + (255,)
    for y in range(T1 + 1, F1 + 1): px[0, y] = tuple(WD[2]) + (255,); px[31, y] = tuple(WD[0]) + (255,)
    cols = {'herb': [LF[4], LF[5], LF[3]], 'flower': [RD[4], SR[5], (200, 130, 220), (240, 240, 240)], 'blue': [IN_[4], IN_[5], (240, 240, 240)]}[kind]
    for i in range(7):
        cx = 4 + i * 4 + rs.randint(-1, 1); cy = 6 + rs.randint(0, 2)
        px[cx, cy] = tuple(LF[2]) + (255,); px[cx, cy - 1] = tuple(LF[4]) + (255,); px[cx - 1, cy - 2] = tuple(LF[5]) + (255,); px[cx + 1, cy - 2] = tuple(LF[5]) + (255,)
        c = cols[rs.randint(0, len(cols))]
        if kind != 'herb': px[cx, cy - 3] = tuple(c) + (255,); px[cx + 1, cy - 3] = tuple(c) + (255,)
    return pz.fin(im)
IN_ = [rgb(h) if isinstance(h, str) else h for h in ['#141a3a', '#1f2b5e', '#2f4a8f', '#4470bd', '#6e9fdb', '#a9cbf0', '#e3f0ff']]
for k, nm in (('herb', '약초 이랑'), ('flower', '꽃 이랑'), ('blue', '푸른 별꽃 이랑')):
    P.add('bed_' + k, herb_bed(k, 3), nm + ' (32x22, 나무 틀 3/4 — 윗면 T7·앞면 F12)')
def bed(cx, cy, k=1, kind='herb'):
    S.put(herb_bed(kind, cx * 7 + cy * 3 + k), cx * 16, cy * 16 - 6, 'bed', foot=cy * 16 + 15); S.block(cx, cy, cx + 1, cy)
# 탑 (앵커 A)
TW = WP.wizard_tower()
P.add('wizard_tower', TW, '[옛 이름 그대로 덮어씀] 3/4 원통 마법사의 탑 (96x236) — 처마 석반 윗면 타원+앞면 원통 음영 (wizard-tower.png 와 같은 그림)')
S.put(TW, 272, 240 - TW.height, 'tower', foot=240 + 6)
S.block(18, 14, 22, 14); S.open_(20, 14, 20, 14)
S.marks['tower_door'] = (20, 15)
AR = WP.armillary(); OB = WP.moon_obelisk()
pp(AR, PCX, PCY + 26, 'armillary')
for (cx, cy) in ((15, 19), (25, 17), (24, 23), (13, 15)):
    pp(OB, cx * 16 + 8, cy * 16 + 16, 'obelisk')
# 남쪽 담 + 철문
gate, _w = K.garden_gate()
gate = gate.convert('RGBA')
LW = pz.fin(K.low_wall())
for wx in range(0, W):
    if 18 <= wx <= 22: continue
    for wy in (32, 33):
        S.put(LW, wx * 16, wy * 16, 'wall', foot=wy * 16 + 15)
S.put(gate, 18 * 16, H * 16 - gate.height, 'gate', foot=H * 16 - 2)
S.block(0, 32, 17, 33); S.block(23, 32, 39, 33); S.block(18, 33, 18, 33); S.block(22, 33, 22, 33)
S.marks['gate'] = (20, 33)
pp(pf.lamppost(), 17 * 16 + 8, 31 * 16 + 14, 'lamp'); pp(pf.lamppost(), 23 * 16 + 8, 31 * 16 + 14, 'lamp')
for (hx, n) in ((2, 3), (7, 2), (11, 3), (26, 2), (30, 3), (35, 2)):
    S.put(pz.fin(K.hedge_run(n)), hx * 16, 31 * 16, 'hedge', foot=31 * 16 + 12); S.block(hx, 31, hx + n - 1, 31)

# 서쪽 약초원 (앵커 B: 온실)
GH = WP.greenhouse(); P.add('greenhouse', GH, '유리 온실 (80x64)')
pp(GH, 88, 23 * 16, 'greenhouse', bl=(3, 22, 7, 22))
S.marks['greenhouse_door'] = (5, 23)
for cx, cy, kd in ((2, 25, 'herb'), (5, 25, 'flower'), (2, 27, 'flower'), (5, 27, 'herb'), (2, 29, 'herb'), (5, 29, 'blue'), (8, 29, 'herb')):
    bed(cx, cy, 1, kd)
S.marks['herb_bed'] = (4, 26)
pp(pz.herb_rack(), 8 * 16 + 8, 27 * 16, 'herbrack')
pp(pf.cauldron(), 9 * 16 + 8, 24 * 16 + 2, 'cauldron')
pp(pz.bench_park(), 10 * 16, 24 * 16 + 4, 'bench')
pp(K.cypress_tub(), 12 * 16 + 8, 29 * 16, 'cypress'); pp(K.cypress_tub(), 1 * 16 + 8, 22 * 16, 'cypress')
for cx, cy, kd in ((9, 19, 'blue'), (3, 18, 'flower'), (5, 18, 'herb')):
    bed(cx, cy, 5, kd)
pp(pz.planter_round(), 7 * 16 + 8, 19 * 16 + 2, 'planter'); pp(pz.planter_round(), 12 * 16 + 8, 22 * 16 + 2, 'planter')
# 동쪽 정원 (앵커 C: 분수·현자상)
pp(pf.fountain(), 520, 27 * 16, 'fountain', bl=(31, 25, 33, 26))
S.marks['fountain'] = (32, 27)
pp(pz.statue_sage(), 29 * 16, 22 * 16, 'sage')
SD = WP.sundial(); P.add('sundial', SD, '해시계 (32x34, 3/4 윗면 타원)')
pp(SD, 35 * 16, 21 * 16, 'sundial')
pp(pz.bench_park(), 29 * 16 + 8, 28 * 16 + 4, 'bench2'); pp(pz.bench_park(), 36 * 16, 26 * 16 + 10, 'bench3')
pp(K.cypress_tub(), 28 * 16 + 8, 25 * 16, 'cypress'); pp(K.cypress_tub(), 37 * 16 + 8, 23 * 16, 'cypress')
for cx, cy, kd in ((35, 28, 'flower'), (37, 28, 'blue'), (35, 30, 'herb'), (37, 30, 'flower'), (32, 30, 'blue'), (27, 18, 'flower'), (29, 18, 'herb')):
    bed(cx, cy, 9, kd)
pp(pz.planter_round(), 27 * 16 + 8, 20 * 16 + 2, 'planter'); pp(pz.planter_round(), 33 * 16 + 8, 20 * 16 + 2, 'planter')
# 숲
for nm, cx, foot in (('oakA', 2.5, 60), ('oakB', 6, 44), ('oakA', 9, 74), ('oakB', 12, 48), ('oakA', 15, 62), ('oakB', 17, 40),
                     ('oakA', 23.5, 64), ('oakB', 26, 44), ('oakA', 29, 76), ('oakB', 32, 50), ('oakA', 35, 66), ('oakB', 38, 44),
                     ('oakA', 2.5, 118), ('oakB', 6.5, 132), ('oakA', 10.5, 150), ('oakB', 30, 130), ('oakA', 34, 150), ('oakB', 38, 120),
                     ('oakA', 1.5, 200), ('oakB', 1.5, 300), ('oakA', 38.5, 200), ('oakB', 38.5, 302),
                     ('oakB', 15, 190), ('oakA', 26.5, 196), ('oakA', 38.5, 396), ('oakB', 1.5, 396), ('oakA', 38, 470), ('oakA', 2, 480)):
    tree(nm, cx, foot)
for nm, cx, foot in (('bushD', 5, 96), ('bushC', 15, 98), ('bushE', 8.5, 100), ('bushC', 21, 100), ('bushD', 24, 100), ('bushE', 33.5, 100),
                     ('bushC', 18, 26), ('bushE', 22.5, 26), ('bushD', 33, 176), ('bushC', 6.5, 176), ('bushC', 10, 214), ('bushE', 29.5, 216),
                     ('bushD', 4, 340), ('bushE', 38, 344), ('bushC', 13.5, 410), ('bushE', 28, 448), ('bushC', 4.5, 250), ('bushE', 36, 250)):
    bush(nm, cx, foot)
for cx, cy in ((16, 10), (24, 10), (12, 8), (28, 8), (14, 29), (27, 30)):
    pp(pa.boulder(), cx * 16 + 8, cy * 16 + 14, 'boulder')
tree('oakB', 33.5, 15 * 16 + 8); tree('oakA', 7.5, 15 * 16 + 4)
bush('bushC', 30.5, 19 * 16 - 2); bush('bushE', 36.5, 17 * 16 + 4)
pp(pz.bench_park(), 31 * 16, 16 * 16 + 8, 'bench4')

# 잔디 위 들꽃 덩이 (자연 무리, 걸을 수 있음)
def drift(cx, cy, cells, k):
    for (dx, dy) in cells:
        S.put(pz.fin(K.flower_patch(k + dx * 5 + dy * 11)), (cx + dx) * 16, (cy + dy) * 16, 'flowers', foot=(cy + dy) * 16 + 6)
drift(14, 8, [(0, 0), (1, 0), (1, 1), (2, 1)], 1); drift(25, 9, [(0, 0), (1, 0), (0, 1), (-1, 1), (-1, 2)], 2)
drift(10, 12, [(0, 0), (1, 0), (2, 1)], 3); drift(29, 13, [(0, 0), (1, 1), (2, 1), (2, 2)], 4)
drift(11, 20, [(0, 0), (0, 1), (1, 1)], 5); drift(27, 24, [(0, 0), (1, 0), (1, 1)], 6)
drift(16, 25, [(0, 0), (1, 0), (2, 0), (2, 1)], 7); drift(23, 26, [(0, 0), (1, 0), (1, 1)], 8)
drift(8, 14, [(0, 0), (1, 0)], 9); drift(31, 16, [(0, 0), (0, 1), (1, 1)], 10); drift(6, 21, [(0, 0), (1, 0)], 11)
drift(20, 27, [(-2, 0), (-1, 0), (2, 0), (3, 0)], 12)
for (hx, hy, n) in ((11, 15, 2), (27, 13, 2), (13, 29, 2), (26, 28, 2)):
    S.put(pz.fin(K.hedge_run(n)), hx * 16, hy * 16, 'hedge', foot=hy * 16 + 12); S.block(hx, hy, hx + n - 1, hy)
# 표식 · 통행
S.open_(19, 32, 21, 33)
marks = {'entrance': (20, 33), 'gate': S.marks['gate'], 'tower_door': S.marks['tower_door'], 'greenhouse_door': S.marks['greenhouse_door'],
         'herb_bed': S.marks['herb_bed'], 'fountain': S.marks['fountain'], 'sundial': (35, 22), 'plaza_center': (20, 19)}
ok, n = S.bfs(marks['entrance'], {k: v for k, v in marks.items() if k != 'entrance'})
print('BFS', ok, n)

outim = S.compose()
strip, floors, fwalks = wt_interior.build_all(P)
FW = max(W * 16, strip.width); OX = (FW - W * 16) // 2
full = Image.new('RGBA', (FW, H * 16 + 8 + strip.height), (10, 8, 14, 255))
full.paste(outim, (OX, 0)); full.paste(strip, (0, H * 16 + 8))
full = full.convert('RGB')
os.makedirs(os.path.join(HERE, '..', '_out-4'), exist_ok=True)
c4.save_pair(full, OUT)

dec = ~S.walk.copy()
for _, img, x, y, nm in S.objs:
    dec[max(0, y // 16):min(H, (y + img.height - 1) // 16 + 1), max(0, x // 16):min(W, (x + img.width - 1) // 16 + 1)] = True
dec |= np.asarray(pm | PLZ).reshape(H, 16, W, 16).mean(axis=(1, 3)) > 0.35
print('빈칸 최악', c4.empty_stats(S, dec))
grid = {'w': W, 'h': H, 'walk': [''.join('.' if v else '#' for v in r) for r in S.walk], 'legend': '. 걸음 / # 막힘',
        'marks': {k: list(v) for k, v in marks.items()}, 'bfs_from_entrance': ok,
        'interior_floors': {'note': '안쪽 3층은 이미지 아래 띠(y=%dpx~)에 16x14칸씩 나란히. 1층 출구 = 아래 중앙(8,13)' % (H * 16 + 8),
                            'floors': [{'name': nm, 'w': 16, 'h': 14, 'walk': [''.join('.' if v else '#' for v in r) for r in w_]}
                                       for nm, w_ in zip(('1층 서재', '2층 연금실', '3층 천문대'), fwalks)]}}
json.dump(grid, open(os.path.join(OUT, 'grid.json'), 'w'), ensure_ascii=False)
md, cnt, cells = P.save(os.path.join(OUT, 'parts'), '마법사의 탑')
open(os.path.join(OUT, 'parts.md'), 'w').write(md)
print('parts', cnt, cells)
