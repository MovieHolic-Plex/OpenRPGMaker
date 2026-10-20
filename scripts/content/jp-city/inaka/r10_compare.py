#!/usr/bin/env python3
"""R10 탑 3/4 비교판: 버들항 통나무집 | jp_city 파출소·창고(깊이 판) | R7 | R9b | 지금(R10) — 같은 잔디 위 1배·4배.

  python3 scripts/content/jp-city/inaka/r10_compare.py OUT_DIR KIT_ID [KIT_ID ...]
    --r7 FILE   R7 판 inaka_art_houses.py 사본 (git show a70f212344:...)
    --r9b FILE  R9b 판 사본 (git show 8efee776a2:...)
    --refs DIR  koban.png / warehouse.png (jp_city depth34 렌더, 잘라 둔 것)

KIT_ID 마다 OUT_DIR/<id>-1x.png · <id>-4x.png 를 쓴다. 지붕 깊이(윗면 시작~처마 밑)와 벽 높이를 열 하나에서 재 표에 적는다.
"""
from __future__ import annotations

import argparse
import importlib.util
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
JP = os.path.join(ROOT, 'scripts', 'content', 'jp-city')
INAKA = os.path.join(ROOT, 'scripts', 'content', 'jp-inaka')
for p in (INAKA, os.path.join(JP, 'houses'), os.path.join(JP, 'blocks'), JP, HERE):
    if p not in sys.path:
        sys.path.insert(0, p)
from pilot_sheet import beo, grass_bg  # noqa: E402

BG = (112, 120, 104, 255)


def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def render(mod, kid):
    for k in mod.KITS:
        if k['id'] == kid:
            up, base = mod.Cv(k['w'] * 16, k['h'] * 16), mod.Cv(k['w'] * 16, k['h'] * 16)
            k['draw'](up, base)
            b = Image.fromarray(base.a, 'RGBA')
            b.alpha_composite(Image.fromarray(up.a, 'RGBA'))
            return b
    return None


def trim(i):
    bb = i.getbbox()
    return i.crop(bb) if bb else i


def strip(items, pad=10):
    items = [(lab, trim(im)) for lab, im in items if im is not None]
    w = sum(im.width for _, im in items) + pad * (len(items) + 1)
    h = max(im.height for _, im in items) + pad * 2
    g = grass_bg(w, h)
    x = pad
    for _, im in items:
        g.alpha_composite(im, (x, h - pad - im.height))
        x += im.width + pad
    return g, [lab for lab, _ in items]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('out')
    ap.add_argument('kits', nargs='+')
    ap.add_argument('--r7', required=True)
    ap.add_argument('--r9b', required=True)
    ap.add_argument('--refs', required=True)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    cur = load(os.path.join(INAKA, 'inaka_art_houses.py'), 'h_cur')
    r7 = load(a.r7, 'h_r7')
    r9b = load(a.r9b, 'h_r9b')
    refs = [('beodeul log cabin', beo('bd-out-cabin')),
            ('jp_city koban', Image.open(os.path.join(a.refs, 'koban.png')).convert('RGBA')),
            ('jp_city warehouse', Image.open(os.path.join(a.refs, 'warehouse.png')).convert('RGBA'))]
    for kid in a.kits:
        items = refs + [('R7', render(r7, kid)), ('R9b', render(r9b, kid)), ('R10', render(cur, kid))]
        g, labs = strip(items)
        g.save(os.path.join(a.out, f'{kid}-1x.png'))
        big = g.resize((g.width * 4, g.height * 4), Image.NEAREST)
        cap = Image.new('RGBA', (big.width, 28), (30, 30, 30, 255))
        ImageDraw.Draw(cap).text((8, 8), kid + '  |  ' + ' | '.join(labs), fill=(235, 235, 235, 255))
        out = Image.new('RGBA', (big.width, big.height + 28))
        out.paste(cap, (0, 0))
        out.paste(big, (0, 28))
        out.save(os.path.join(a.out, f'{kid}-4x.png'))
        print(kid, 'ok', g.size)


if __name__ == '__main__':
    main()
