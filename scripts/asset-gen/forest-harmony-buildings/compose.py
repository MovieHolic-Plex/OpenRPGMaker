"""참고 맵(왕궁 도시·성벽 정주지)에 생성 집을 같은 형태 자리에 끼워 넣어 전후를 그린다(숲마을 칩셋으로).
python3 compose.py fh-inn-c2 fh-shop-c1 ...   → <OUT>/ctx-<map>-before.png / -after.png"""
import json, sys
import numpy as np
from PIL import Image
from fhlib import *

MAPS = {'castle-town-100x100': 'castle-town', 'walled-settlement-43x45': 'walled-settlement'}

def render_map(m):
    W, H = m['width'], m['height']
    im = Image.new('RGBA', (W * 16, H * 16), (0, 0, 0, 255))
    cache = {}
    for L in ('lowerTiles', 'upperTiles'):
        for idx, v in enumerate(m[L]):
            if v is None or v < 0 or v >= 2550: continue
            if v not in cache: cache[v] = tile(v)
            im.alpha_composite(cache[v], ((idx % W) * 16, (idx // W) * 16))
    return im

def main(names):
    by_map = {}
    for n in names:
        s, b = building(n.rsplit('-c', 1)[0])
        ref = form(b['form'])['reference']
        by_map.setdefault(ref['id'], []).append((n, ref['x'], ref['y']))
    out = {}
    for mid, items in by_map.items():
        m = json.load(open(os.path.join(ROOT, f'src/project/regionReferences/{MAPS[mid]}.json')))['map']
        before = render_map(m); after = before.copy()
        # 원본 집의 문(116/146 갈색)도 검은 359 로 — 생성 집과 같은 문 문법으로 비교
        for n, x, y in items:
            art = Image.open(f'{OUT}/{n}-art.png')
            after.alpha_composite(art, (x * 16, y * 16))
        before.save(f'{OUT}/ctx-{MAPS[mid]}-before.png'); after.save(f'{OUT}/ctx-{MAPS[mid]}-after.png')
        out[MAPS[mid]] = [dict(id=n, x=x, y=y) for n, x, y in items]
        print(MAPS[mid], before.size, items)
    json.dump(out, open(f'{OUT}/ctx.json', 'w'), ensure_ascii=False)

main(sys.argv[1:])
