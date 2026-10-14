#!/usr/bin/env python3
"""칸 배열 JSON(compose-scene.mts) → 원 해상도 PNG. python3 render_scene.py in.json out.png  (DE_DIR 로 시트 폴더 바꾸기)"""
import json, os, sys
from PIL import Image
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))
D = os.environ.get('DE_DIR')
SHEET = Image.open(os.path.join(D, 'desert-east-chipset.png') if D else os.path.join(ROOT, 'public/assets/desert-east/desert-east-chipset.png')).convert('RGBA')
TPR = json.load(open(os.path.join(D or os.path.join(ROOT, 'src/assets'), 'desertEastSheet.json')))['tilesPerRow']


def tile(t):
    return SHEET.crop(((t % TPR) * 16, (t // TPR) * 16, (t % TPR) * 16 + 16, (t // TPR) * 16 + 16))


def render(d):
    W, H = d['width'], d['height']
    im = Image.new('RGBA', (W * 16, H * 16), (0, 0, 0, 255))
    cache = {}
    for layer in ('lower', 'lower2', 'upper', 'upper2'):
        if layer not in d: continue
        for i, t in enumerate(d[layer]):
            if t < 0: continue
            if t not in cache: cache[t] = tile(t)
            im.alpha_composite(cache[t], ((i % W) * 16, (i // W) * 16))
    return im


if __name__ == '__main__':
    d = json.load(open(sys.argv[1])); im = render(d)
    if len(sys.argv) > 3: im = im.resize((im.width * int(sys.argv[3]), im.height * int(sys.argv[3])), Image.NEAREST)
    im.save(sys.argv[2]); print(sys.argv[2])
