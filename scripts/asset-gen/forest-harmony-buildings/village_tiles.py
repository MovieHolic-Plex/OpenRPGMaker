"""고른 생성 건물 그림을 16px 칸으로 잘라 새 칩셋 한 장으로 모은다.  python3 village_tiles.py <art-id> ...
칸 역할은 설계도({id}-bp.json 의 실제 설계도 — 머리 공간을 늘린 것)가 정한다: X·G = 하위(막힘·통행은 author_village 가 설계도로), * · A = 상위(통행), D = 원본 타일(위 329 검정, 아래 359).
같은 그림·같은 레이어 칸은 한 번만 싣는다. 출력 {OUT}/village/gen-sheet.png(30열) + gen-tiles.json"""
import json, os, re, sys
import numpy as np
from PIL import Image
from fhlib import *
BP = json.load(open(os.path.join(ROOT, 'tiledata/forest-harmony-buildings/blueprints.json')))
T, COLS = 16, 30
D = f"{OUT}/{os.environ.get('VDIR', 'village')}"; os.makedirs(D, exist_ok=True)
sheet, index, out = [], {}, {}
for n in sys.argv[1:]:
    bid = re.sub(r'-c\d+$', '', n); bp = next(b for b in BP['blueprints'] if b['id'] == bid)
    chk = json.load(open(f'{OUT}/{n}-bpcheck.json'))
    assert chk['pass'], f'{n} 는 검사 탈락작 — 마을에 쓰지 않는다'
    art = np.array(Image.open(f'{OUT}/{n}-art.png').convert('RGBA'))
    eff = json.load(open(f'{OUT}/{n}-bp.json'))     # bp_fit 이 머리 공간을 늘린 실제 설계도(위로 headExtra 줄, 그림이 올라온 하늘 칸은 '*')
    m = eff['map']; H, W = len(m), len(m[0]); cells = []
    assert art.shape[0] == H * T, f'{n}: 그림 높이와 설계도가 다르다 — bp_fit 을 다시 돌릴 것'
    for y in range(H):
        for x in range(W):
            c = m[y][x]
            if c == '.': cells.append(None); continue
            if c == 'D':
                cells.append({'layer': 'L', 'orig': 329 if y + 1 < H and m[y + 1][x] == 'D' else 359}); continue
            px = art[y * T:(y + 1) * T, x * T:(x + 1) * T]
            if not px[..., 3].any(): cells.append(None); continue
            prop = bp.get('kind') == 'prop'           # 소품은 바닥 위에 얹는 상위 칸(투명 유지), 막힘
            layer = 'U' if prop or c in '*A' else 'L'
            key = (layer, px.tobytes())
            if key not in index: index[key] = len(sheet); sheet.append(px)
            cells.append({'layer': layer, 'k': index[key], 'walk': (c == '*' or bool(bp.get('walk'))) if prop else c in '*AG'})   # 들꽃·갈대는 밟고 지나간다
    doors = [dict(x=x, y=y, front=[x, y + 1]) for y in range(H) for x in range(W) if m[y][x] == 'D' and not (y + 1 < H and m[y + 1][x] == 'D')]
    out[n] = dict(blueprint=bid, label=bp['label'], kind=bp.get('kind', 'building'), w=W, h=H, headExtra=eff['headExtra'], cells=cells, doors=doors)
rows = (len(sheet) + COLS - 1) // COLS
img = np.zeros((rows * T, COLS * T, 4), np.uint8)
for k, px in enumerate(sheet): img[(k // COLS) * T:(k // COLS + 1) * T, (k % COLS) * T:(k % COLS + 1) * T] = px
Image.fromarray(img).save(f'{D}/gen-sheet.png')
json.dump(dict(tiles=len(sheet), cols=COLS, buildings=out), open(f'{D}/gen-tiles.json', 'w'), ensure_ascii=False)
print('건물', len(out), '새 칸', len(sheet), '시트', img.shape[1], 'x', img.shape[0])
