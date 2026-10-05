"""Pack reusable terrain cells independently of map coordinates and approved icons."""
import hashlib
from collections import Counter, defaultdict

import numpy as np
from PIL import Image

GROUND = {0: '바다', 1: '강', 2: '용암', 3: '독물', **dict(zip(range(10, 28),
          ['초원', '밀밭', '사바나', '모래', '사구', '흙', '황무지', '재', '현무암', '늪',
           '습지', '툰드라', '눈', '빙하', '정글', '협곡', '분화구', '푸른 밭']))}
OBJECT = ['', '활엽수림', '침엽수림', '정글 숲', '죽은 숲', '눈 숲', '산', '눈 산', '화산', '메사']


def pack(image, world, walk, out, stem):
    roads = {tuple(p) for p in world['road_cells']}
    bridges = {(p['x'], p['y']) for p in world['bridges']}
    ramps = {tuple(p) for p in world['ramp']}
    entries, cells, usage = {}, [], Counter()
    for y in range(world['height']):
        for x in range(world['width']):
            ground, obj = world['ground'][y][x], world['object'][y][x]
            label = (OBJECT[obj] if 0 < obj < len(OBJECT) else GROUND.get(ground, '지형'))
            if (x, y) in roads: label = '길'
            if (x, y) in bridges: label = '다리'
            if (x, y) in ramps: label = '경사로'
            pixels = np.ascontiguousarray(image[y*16:(y+1)*16, x*16:(x+1)*16])
            # Equal art with different passage remains two distinct materials.
            key = hashlib.sha256(pixels.tobytes() + walk[y][x].encode() + label.encode()).hexdigest()
            entries[key] = (pixels, label, walk[y][x] == '1')
            cells.append(key); usage[key] += 1
    keys = sorted(entries, key=lambda key: (entries[key][1], key))
    ids = {key: i for i, key in enumerate(keys)}
    cols = 12
    sheet = Image.new('RGB', (cols*16, ((len(keys)+cols-1)//cols)*16))
    meta, groups = [], defaultdict(list)
    for key in keys:
        i = ids[key]; pixels, label, passage = entries[key]
        sheet.paste(Image.fromarray(pixels), ((i % cols)*16, (i//cols)*16))
        meta.append(dict(key=key, label=label, walkable=passage)); groups[label].append(i)
    file = stem + '-terrain-tiles.png'; sheet.save(out / file, optimize=True)
    palette = [dict(name=label, tiles=tiles, representative=max(tiles, key=lambda i: usage[keys[i]]))
               for label, tiles in groups.items()]
    return dict(version=1, image=file, tilesPerRow=cols, tiles=meta,
                lowerTiles=[ids[key] for key in cells], groups=palette)
