#!/usr/bin/env python3
"""칸 배열 JSON(compose-scene.mts) → 원 해상도 PNG(구운 시트 칸을 그대로 붙인다). python3 render_scene.py in.json out.png
검사(validate): 시작 칸 BFS 로 문 접근칸·출구가 닿는지, 문 칸이 막혔는지, 위층 겹침이 없는지(구성기는 위층을 덮어쓰지 않는다)."""
import json, os, sys
from PIL import Image
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))
SHEET = Image.open(os.path.join(ROOT, 'public/assets/steampunk-city/steampunk-city-chipset.png')).convert('RGBA')
DATA = json.load(open(os.path.join(ROOT, 'src/assets/steampunkCityTileset.json'), encoding='utf-8'))
TPR = DATA['tilesPerRow']


def tile(t):
    return SHEET.crop(((t % TPR) * 16, (t // TPR) * 16, (t % TPR) * 16 + 16, (t // TPR) * 16 + 16))


def render(d):
    W, H = d['width'], d['height']
    im = Image.new('RGBA', (W * 16, H * 16), (0, 0, 0, 255))
    cache = {}
    for layer in ('lower', 'upper'):
        for i, t in enumerate(d[layer]):
            if t < 0: continue
            if t not in cache: cache[t] = tile(t)
            im.alpha_composite(cache[t], ((i % W) * 16, (i // W) * 16))
    return im


def passable(t): return t < 0 or bool(DATA['passability'][t]['up'])


def validate(d):
    W, H = d['width'], d['height']; errs = []
    walk = lambda x, y: 0 <= x < W and 0 <= y < H and passable(d['lower'][y * W + x]) and passable(d['upper'][y * W + x])
    s = d['start']; seen = {(s['x'], s['y'])} if walk(s['x'], s['y']) else set(); q = list(seen)
    if not seen: errs.append(('E_START_BLOCKED', 'start', s['x'], s['y']))
    while q:
        x, y = q.pop()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (x + dx, y + dy)
            if n not in seen and walk(*n): seen.add(n); q.append(n)
    for b in d['buildings']:
        for c in b['doors']:
            if walk(c['x'], c['y']): errs.append(('E_DOOR_CELL_OPEN', b['name'], c['x'], c['y']))
        for c in b['access']:
            if not walk(c['x'], c['y']): errs.append(('E_DOOR_ACCESS_BLOCKED', b['name'], c['x'], c['y']))
            elif (c['x'], c['y']) not in seen: errs.append(('E_DOOR_UNREACHABLE', b['name'], c['x'], c['y']))
    for c in d.get('exits', []):
        if (c['x'], c['y']) not in seen: errs.append(('E_EXIT_UNREACHABLE', 'exit', c['x'], c['y']))
    walkable = sum(1 for y in range(H) for x in range(W) if walk(x, y))
    if walkable and len(seen) < walkable:
        isl = [(x, y) for y in range(H) for x in range(W) if walk(x, y) and (x, y) not in seen]
        errs.append(('W_ISLAND', f'{len(isl)} 칸', isl[0][0], isl[0][1]))
    return errs


if __name__ == '__main__':
    d = json.load(open(sys.argv[1])); render(d).save(sys.argv[2]); print(sys.argv[2], validate(d)[:6])
