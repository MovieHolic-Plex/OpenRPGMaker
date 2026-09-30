"""새로 만든 칸을 world-plus-terrain.png (30열, 분홍 키 배경) 로 모으고 world-plus-terrain.json 에 출처를 적는다.
출처 구분: reassembly = 원본 칸을 잘라 얹기·뒤집기·팔레트 치환, handpixel = 원본 팔레트·질감·외곽선으로 좌표 명시해 찍은 도트."""
import json, os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import terrain_extra as TE
import terrain_lib as T

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..')
COLS = 30
KEY = tuple(int(v) for v in T.KEY)
cells = []   # dict(col,row,name,prov,group)
canvas = {}  # (col,row) -> rgb16 (keyed)


def put(col, row, name, prov, group, rgb, a):
    img = np.empty((16, 16, 3), np.uint8)
    img[:] = KEY
    h, w = a.shape
    sub = img[:h, :w]
    sub[a] = rgb[a]
    canvas[(col, row)] = img
    cells.append(dict(col=col, row=row, name=name, prov=prov, group=group))


def put_multi(col, row, name, prov, group, rgb, a):
    """16 보다 큰 스프라이트를 칸 단위로 쪼갠다."""
    h, w = a.shape
    for j in range((h + 15) // 16):
        for i in range((w + 15) // 16):
            sr, sa = rgb[j * 16:(j + 1) * 16, i * 16:(i + 1) * 16], a[j * 16:(j + 1) * 16, i * 16:(i + 1) * 16]
            pr = np.zeros((16, 16, 3), np.uint8); pa = np.zeros((16, 16), bool)
            pr[:sr.shape[0], :sr.shape[1]] = sr; pa[:sa.shape[0], :sa.shape[1]] = sa
            put(col + i, row + j, f'{name}@{i},{j}' if (h > 16 or w > 16) else name, prov, group, pr, pa)


row = 0
# 1) 3x4 킷: 도로 4종x2, 녹임 3종x4  (블록 = 3열 x 4행, 원본 킷과 같은 배치)
kits = []
for st in ('grass', 'sand', 'snow', 'dirt'):
    for v, k in enumerate(TE.road_kits(st)):
        kits.append((f'road_{st}_{v}', 'road', k))
for g, gn in ((T.SNOW, 'snow'), (T.SAND, 'sand'), (T.DIRT, 'dirt')):
    for v, k in enumerate(T.melt_kits(g)):
        kits.append((f'melt_{gn}_{v}', 'melt', k))
for n, (nm, grp, k) in enumerate(kits):
    bc, br = (n % 10) * 3, row + (n // 10) * 4
    for role, (c, rr_) in T.wm.ROLE.items():
        if role == 'body':
            pass
        rgb, a = k[role]
        put(bc + c, br + rr_, f'{nm}:{role}', 'handpixel', grp, rgb, a)
    put(bc + 1, br, f'{nm}:plain', 'handpixel', grp, *k['body'])
row += ((len(kits) + 9) // 10) * 4

# 2) 다리: 가로 4(단독·첫·중간·끝) + 세로 4
combos = [('single', True, True), ('first', True, False), ('mid', False, False), ('last', False, True)]
for i, (nm, f, l) in enumerate(combos):
    rgb, a, sh = TE.bridge_sprite(f, l)
    put(i, row, f'bridge_h_{nm}', 'handpixel', 'bridge', rgb, a)
    put(4 + i, row, f'bridge_v_{nm}', 'handpixel', 'bridge', rgb.transpose(1, 0, 2), a.T)
# 3) 고원(3단계): 윗면·가장자리·절벽 앞면·모서리·계단·경사. 손 도트, 원본 World 팔레트만. 한 줄에 30칸씩 채움.
import terrain_highland as HL
row += 1
col = 0
for nm, prov, grp, rgb, a in HL.tile_catalog():
    if col >= COLS:
        col = 0; row += 1
    put(col, row, nm, prov.replace('-', ''), grp, rgb, a); col += 1
row += 1
# 4) 뒤집기 변형(숲·산 몸통) — 원본 몸통 칸을 좌우 뒤집음
col = 0
for k, nm in ((6, 'forest'), (7, 'mountain'), (8, 'snowforest'), (9, 'snowmountain')):
    c0, r0 = T.wm.KIT[k]
    bc, brr = T.wm.ROLE['body']
    blk = T.S.a[(r0 + brr) * 16:(r0 + brr + 1) * 16, (c0 + bc) * 16:(c0 + bc + 1) * 16]
    a = ~np.all(blk == KEY, axis=2)
    put(col, row, f'{nm}_body_mirror', 'reassembly', 'mirror', blk[:, ::-1].copy(), a[:, ::-1].copy()); col += 1
row += 1
# 5) 바닥 장식 스프라이트
col = 0
for nm, (rgb, a) in TE.SPR.items():
    w = (a.shape[1] + 15) // 16
    if col + w > COLS:
        col = 0; row += 1
    put_multi(col, row, nm, 'handpixel', 'decor', rgb, a)
    col += w
row += 1

rows = row
sheet = np.empty((rows * 16, COLS * 16, 3), np.uint8)
sheet[:] = KEY
for (c, r), im in canvas.items():
    sheet[r * 16:(r + 1) * 16, c * 16:(c + 1) * 16] = im
Image.fromarray(sheet).save(os.path.join(OUT, 'world-plus-terrain.png'))
n_re = sum(1 for c in cells if c['prov'].startswith('reassembly'))
n_hp = sum(1 for c in cells if c['prov'] == 'handpixel')
json.dump(dict(cols=COLS, rows=rows, key=list(KEY), counts=dict(total=len(cells), reassembly=n_re, handpixel=n_hp), cells=cells),
          open(os.path.join(OUT, 'world-plus-terrain.json'), 'w'), ensure_ascii=False, indent=1)
print('cells', len(cells), 'reassembly', n_re, 'handpixel', n_hp, 'rows', rows)
