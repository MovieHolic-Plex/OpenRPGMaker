#!/usr/bin/env python3
"""beodeul-dungeon-samples.mts 가 쓴 JSON 을 버들항 시트로 원 해상도(16px) PNG 로 그린다.
   python3 scripts/content/render-beodeul-dungeon-samples.py <dir> [--marks]"""
import json, os, sys, glob
from PIL import Image, ImageDraw
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
# BEODEUL_SHEET = 시험 굽기 시트(예: bake_cave.py --test-out 폴더의 beodeul-city-chipset.png)로 그릴 때.
SHEET = Image.open(os.environ.get('BEODEUL_SHEET') or os.path.join(ROOT, 'public/assets/beodeul-city/beodeul-city-chipset.png')).convert('RGBA')
PER = SHEET.width // 16
_cache = {}
def tile(t):
    if t not in _cache:
        x, y = (t % PER) * 16, (t // PER) * 16
        _cache[t] = SHEET.crop((x, y, x + 16, y + 16))
    return _cache[t]
def rim_masks(d):
    """picture('#' 천장) → {(x,y): 오토타일 마스크}. 이웃이 천장이면 비트(N1 E2 S4 W8 NE16 SE32 SW64 NW128), 맵 밖은 천장."""
    W, H, pic = d['width'], d['height'], d['picture']
    ceil = lambda x, y: not (0 <= x < W and 0 <= y < H) or pic[y][x] == '#'
    out = {}
    for y in range(H):
        for x in range(W):
            if pic[y][x] != '#': continue
            m = 0
            for b, (dx, dy) in zip((1, 2, 4, 8, 16, 32, 64, 128), ((0, -1), (1, 0), (0, 1), (-1, 0), (1, -1), (1, 1), (-1, 1), (-1, -1))):
                if ceil(x + dx, y + dy): m |= b
            out[(x, y)] = m
    return out


def render(d, marks=False, rim=None):
    """rim = None: 시트 칸 그대로. rim = 결 seed(0·2): 천장 칸을 ceiling_art 로 덮어 그린다(굽기 전 미리 보기·관문 표본)."""
    W, H = d['width'], d['height']
    im = Image.new('RGBA', (W * 16, H * 16), (20, 16, 28, 255))
    masks = rim_masks(d) if rim is not None else {}
    if masks:
        sys.path.insert(0, os.path.join(ROOT, 'scripts/content/beodeul-dungeon'))
        import ceiling_art as C
    for layer in ('lower', 'upper'):
        arr = d[layer]
        for i, t in enumerate(arr):
            if t is None or t < 0: continue
            if layer == 'lower' and (i % W, i // W) in masks:
                im.alpha_composite(C.tile(masks[(i % W, i // W)], rim), ((i % W) * 16, (i // W) * 16)); continue
            im.alpha_composite(tile(t), ((i % W) * 16, (i // W) * 16))
    if marks:
        dr = ImageDraw.Draw(im)
        for rid, pts in (d.get('spots') or {}).items():
            for p in pts: dr.rectangle((p['x'] * 16 + 5, p['y'] * 16 + 5, p['x'] * 16 + 10, p['y'] * 16 + 10), outline=(80, 255, 120, 255))
        e = d.get('entrance')
        if e: dr.rectangle((e['x'] * 16 + 2, e['y'] * 16 + 2, e['x'] * 16 + 13, e['y'] * 16 + 13), outline=(80, 160, 255, 255))
    return im
if __name__ == '__main__':
    src = sys.argv[1]; marks = '--marks' in sys.argv
    rim = 0 if '--rim' in sys.argv else None
    for f in sorted(glob.glob(os.path.join(src, '*.json'))):
        d = json.load(open(f))
        if 'lower' not in d: continue
        render(d, marks, rim).save(f[:-5] + ('-marks' if marks else '') + '.png')
        print(f[:-5] + '.png', d['width'], d['height'])
