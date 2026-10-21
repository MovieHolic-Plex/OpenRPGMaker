#!/usr/bin/env python3
"""숲 최신판만 보여 주는 짧은 쪽: ~/claude-viz/jp-forest-latest-1.html (이력 없음).

  python3 forest_latest_viz.py --scenes DIR --ref REF.png
DIR 의 bl-<모양>.png(jp_city 땅 위 최신 활엽 숲)를 1×·2× 로, 옆에 버들항 원본 손 숲(woodland 그림 + 원본 땅 그림자) 1×·2×.
"""
import argparse
import os
import shutil

from PIL import Image

VIZ = os.path.expanduser('~/claude-viz')
NAME = 'jp-forest-latest-1'
SCENES = [('blob', '덩이'), ('touching', '연못·길·집'), ('lshape', 'L 자'), ('ring', '빈터 고리'), ('strips', '띠 1·2·3줄')]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--scenes', required=True); ap.add_argument('--ref', required=True)
    a = ap.parse_args()
    out = os.path.join(VIZ, NAME)
    shutil.rmtree(out, ignore_errors=True); os.makedirs(out)

    def put(src, dst, scale):
        im = Image.open(src)
        if scale > 1: im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
        im.save(os.path.join(out, dst)); return f'{NAME}/{dst}'

    def fig(src, cap):
        return f'<figure><img src="{src}"><figcaption>{cap}</figcaption></figure>'
    r1, r2 = put(a.ref, 'beodeul-1x.png', 1), put(a.ref, 'beodeul-2x.png', 2)
    P = ['<h1>jp 활엽 숲 — 최신판 (r6 접지)</h1>',
         '<p class="note">볼 것: 나무 밑동과 수관 아래가 땅 그늘에 붙어 앉아 보이는지 — 오른쪽 버들항 원본 손 숲과 견줘서.</p>']
    for sh, ko in SCENES:
        src = os.path.join(a.scenes, f'bl-{sh}.png')
        if not os.path.exists(src): continue
        P.append(f'<h2>{ko}</h2><div class="row">' + fig(put(src, f'{sh}-1x.png', 1), 'jp 1×') + fig(r1, '버들항 원본 1×') + '</div>')
        P.append('<div class="row">' + fig(put(src, f'{sh}-2x.png', 2), 'jp 2×') + fig(r2, '버들항 원본 2×') + '</div>')
    css = ('body{background:#1d2126;color:#dde;font:14px sans-serif;margin:16px}h1{font-size:18px}h2{font-size:15px;margin:18px 0 6px}'
           '.row{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-start;margin-bottom:8px}figure{margin:0}figcaption{font-size:12px;color:#aab;margin-top:3px}'
           'img{image-rendering:pixelated;display:block}.note{color:#fc8}')
    open(os.path.join(VIZ, NAME + '.html'), 'w').write(f'<!doctype html><meta charset="utf-8"><title>jp 숲 최신판</title><style>{css}</style>' + '\n'.join(P))


if __name__ == '__main__':
    main()
