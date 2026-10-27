#!/usr/bin/env python3
"""맵 그림(village-art-probe 산출 PNG)에 주인공(Actor1 0번 아래 보기, 24×32, 16px 맵에서 1배)을 세운다.
    python3 wl_hero_map.py <map.png> <out-base> <cx,cy> [<cx,cy> ...]
칸 (cx,cy) 에 발을 둔다(게임과 같이 칸 가운데, 아래 맞춤). 산출: <out-base>-1x.png(전체), <out-base>-3x.png(첫 칸 둘레 20×13칸 3배)."""
import os, sys
import numpy as np
from PIL import Image
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))


def hero():
    im = Image.open(os.path.join(ROOT, 'public/assets/easyrpg/charset/Actor1.png'))
    bg = im.getpixel((0, 0)); a = np.array(im.convert('RGBA')); a[np.array(im) == bg, 3] = 0
    return Image.fromarray(a[64:96, 24:48])


def main(src, out, *cells):
    im = Image.open(src).convert('RGBA'); h = hero()
    pts = [tuple(int(v) for v in c.split(',')) for c in cells]
    for cx, cy in pts:
        im.alpha_composite(h, (cx * 16 - 4, (cy + 1) * 16 - 32))
    im.convert('RGB').save(out + '-1x.png')
    cx, cy = pts[0]; W, H = 20, 13
    x0 = max(0, min(im.width // 16 - W, cx - W // 2)); y0 = max(0, min(im.height // 16 - H, cy - H // 2))
    crop = im.crop((x0 * 16, y0 * 16, (x0 + W) * 16, (y0 + H) * 16))
    crop.resize((crop.width * 3, crop.height * 3), Image.NEAREST).convert('RGB').save(out + '-3x.png')


if __name__ == '__main__': main(*sys.argv[1:])
