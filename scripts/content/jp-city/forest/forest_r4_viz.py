#!/usr/bin/env python3
"""숲 r4(나무 composer) 상태 쪽: ~/claude-viz/jp-forest-kit-1.html — 1× 로 버들항 숲과 나란히.

  python3 forest_r4_viz.py --scenes DIR --rounds "101:7.4,..." [--note TEXT]
줄마다: 버들항 woodland 원본 | 같은 composer 에 버들항 bd-tree 그림 | 같은 composer 에 jp 활엽 그림.
"""
import argparse
import html
import os
import shutil

VIZ = os.path.expanduser('~/claude-viz')
NAME = 'jp-forest-kit-1'
SCENES = [('blob', '덩이'), ('strips', '띠 1·2·3줄 / 세로 1·2칸'), ('lshape', 'L 자'), ('ring', '빈터 고리'), ('touching', '연못·길·집')]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--scenes', required=True)
    ap.add_argument('--table', default='')
    ap.add_argument('--note', default='')
    a = ap.parse_args()
    out = os.path.join(VIZ, NAME)
    shutil.rmtree(out, ignore_errors=True); os.makedirs(out)

    def cp(n):
        p = os.path.join(a.scenes, n)
        if not os.path.exists(p): return None
        shutil.copy(p, os.path.join(out, n)); return f'{NAME}/{n}'

    def fig(src, cap):
        return f'<figure><img src="{src}"><figcaption>{html.escape(cap)}</figcaption></figure>' if src else ''

    P = ['<h1>jp 숲 r4 — 나무 composer (활엽만, 1×)</h1>']
    if a.note: P.append(f'<p class="note">{html.escape(a.note)}</p>')
    P.append('<h2>붓 시험 (2×, 붓질마다 둘레만 다시 짠다) — 아래 모양 비교는 1×</h2><div class="row">'
             + fig(cp('bl-paint.gif'), 'jp 활엽 그림') + fig(cp('bd-paint.gif'), '버들항 bd-tree 그림(진단)') + '</div>')
    ref = cp('ref-beodeul.png')
    for sh, ko in SCENES:
        P.append(f'<h2>{ko}</h2><div class="row">' + fig(ref, '기준: 버들항 woodland 원본')
                 + fig(cp(f'bd-{sh}.png'), '같은 composer + 버들항 bd-tree 그림') + fig(cp(f'bl-{sh}.png'), '같은 composer + jp 활엽 그림') + '</div>')
    P.append('<h2>jp 활엽 나무 그림 (T4·T3·T2·C3·C2·T1, 그늘판 d)</h2><div class="row">' + fig(cp('bl-sprites.png'), '') + '</div>')
    if a.table: P.append('<h2>Argon 판별 (5장 평균 막는 결함)</h2>' + a.table)
    css = ('body{background:#1d2126;color:#dde;font:14px sans-serif;margin:16px}h1{font-size:18px}h2{font-size:15px;margin:18px 0 6px}'
           '.row{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-start}figure{margin:0}figcaption{font-size:12px;color:#aab;margin-top:3px}'
           'img{image-rendering:pixelated;display:block}.note{color:#fc8;max-width:1100px}table{border-collapse:collapse}td,th{border:1px solid #445;padding:3px 8px}')
    open(os.path.join(VIZ, NAME + '.html'), 'w').write(f'<!doctype html><meta charset="utf-8"><title>jp 숲 r4</title><style>{css}</style>' + '\n'.join(P))


if __name__ == '__main__':
    main()
