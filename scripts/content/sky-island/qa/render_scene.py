#!/usr/bin/env python3
"""칸 배열 JSON(compose-scene.mts) → 원 해상도 PNG(구운 시트 칸을 그대로 붙인다). python3 render_scene.py in.json out.png"""
import json, os, sys
from PIL import Image
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))
SHEET = Image.open(os.path.join(ROOT, 'public/assets/sky-island/sky-island-chipset.png')).convert('RGBA')
TPR = json.load(open(os.path.join(ROOT, 'src/assets/skyIslandSheet.json')))['tilesPerRow']


def tile(t):
    return SHEET.crop(((t % TPR) * 16, (t // TPR) * 16, (t % TPR) * 16 + 16, (t // TPR) * 16 + 16))


def render(d):
    W, H = d['width'], d['height']
    im = Image.new('RGBA', (W * 16, H * 16), (126, 176, 232, 255))
    cache = {}
    for layer in ('lower', 'lower2', 'upper', 'upper2'):
        if layer not in d: continue
        for i, t in enumerate(d[layer]):
            if t < 0: continue
            if t not in cache: cache[t] = tile(t)
            im.alpha_composite(cache[t], ((i % W) * 16, (i // W) * 16))
    return im


if __name__ == '__main__':
    d = json.load(open(sys.argv[1])); render(d).save(sys.argv[2]); print(sys.argv[2])
