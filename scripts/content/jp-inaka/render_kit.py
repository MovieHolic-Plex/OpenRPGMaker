#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "pillow"]
# ///
"""jp-inaka 키트를 저장소에 아무것도 쓰지 않고 그려 본다(작업자 대조판). 기준선 = R5 시작 커밋의 키트 그림, 기준 = 버들항 style-refs.

  python3 scripts/content/jp-inaka/render_kit.py --ids inaka-kura-storehouse,inaka-dagashiya --out /tmp/x [--scale 4] [--base 63b78c91fe]

출력: <out>/<id>.png(1배), <out>/board-<id>.png(기준선 | 지금 | 버들항 같은 종류, 같은 배율, 풀밭 위), 그리고 지표 한 줄씩:
  colors/tile 중앙값 · 5x5 평면 채움 비율 · 어두운 가장자리 무채색 비율(근흑 윤곽) · 고유색 수.
"""
from __future__ import annotations

import argparse
import io
import os
import subprocess
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, HERE)

STYLE_REFS = os.path.join(ROOT, 'harness-data', 'object-gate', 'style-refs')
KIND_REF = {'structure': 'building', 'vehicle': 'prop', 'prop': 'prop', 'column': 'prop', 'water': 'prop', 'tree': 'tree',
            'wall': 'wall', 'terrain': 'ground', 'flat': 'ground', 'organic': 'tree'}


def metrics(im: Image.Image) -> dict:
    a = np.array(im.convert('RGBA'))
    h, w = a.shape[:2]
    op = a[..., 3] > 0
    key = (a[..., 0].astype(np.int64) << 16) | (a[..., 1].astype(np.int64) << 8) | a[..., 2]
    per = []
    for ty in range(h // 16):
        for tx in range(w // 16):
            m = op[ty * 16:(ty + 1) * 16, tx * 16:(tx + 1) * 16]
            if m.all():
                per.append(len(np.unique(key[ty * 16:(ty + 1) * 16, tx * 16:(tx + 1) * 16])))
    flat = np.zeros((h, w), bool)
    for y in range(h - 4):
        for x in range(w - 4):
            blk = key[y:y + 5, x:x + 5]
            if op[y:y + 5, x:x + 5].all() and (blk == blk[0, 0]).all():
                flat[y:y + 5, x:x + 5] = True
    edge = dark = neutral = 0
    for y in range(h - 1):
        for x in range(w):
            if not op[y, x]:
                continue
            if any(not (0 <= y + dy < h and 0 <= x + dx < w and op[y + dy, x + dx]) for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                edge += 1
                r, g, b = (int(v) for v in a[y, x, :3])
                if 0.299 * r + 0.587 * g + 0.114 * b < 70:
                    dark += 1
                    if max(r, g, b) - min(r, g, b) <= 12:
                        neutral += 1
    return dict(colorsPerTile=float(np.median(per)) if per else 0.0, flat5=round(float(flat[op].mean()) if op.any() else 0, 3),
                darkEdgeNeutral=round(neutral / dark, 2) if dark else 0.0, colors=int(len(np.unique(key[op]))))


def _grass_bg(w, h):
    g = Image.open(os.path.join(STYLE_REFS, 'ground', 'grass.png')).convert('RGBA')
    bg = Image.new('RGBA', (w, h))
    for y in range(0, h, g.height):
        for x in range(0, w, g.width):
            bg.alpha_composite(g, (x, y))
    return bg


def board(parts: list[Image.Image], scale: int) -> Image.Image:
    pad = 8
    W = sum(p.width for p in parts) + pad * (len(parts) + 1)
    H = max(p.height for p in parts) + pad * 2
    bg = _grass_bg(W, H)
    x = pad
    for p in parts:
        bg.alpha_composite(p, (x, H - pad - p.height))
        x += p.width + pad
    for i in range(1, len(parts)):
        pass
    return bg.resize((W * scale, H * scale), Image.Resampling.NEAREST)


def baseline(kid: str, rev: str) -> Image.Image | None:
    try:
        raw = subprocess.check_output(['git', '-C', ROOT, 'show', f'{rev}:tiledata/jp-city/blocks/jp_inaka_pack/jp-{kid}.png'], stderr=subprocess.DEVNULL)
        return Image.open(io.BytesIO(raw)).convert('RGBA')
    except subprocess.CalledProcessError:
        return None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--ids', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--scale', type=int, default=4)
    ap.add_argument('--base', default='63b78c91fe')
    args = ap.parse_args()
    import bake_inaka  # noqa: F401  (등록)
    from inaka_art_houses import KITS
    _, _, renders, _ = bake_inaka._finalize()
    os.makedirs(args.out, exist_ok=True)
    byid = {k['id']: k for k in KITS}
    for kid in args.ids.split(','):
        kid = kid.strip()
        if kid not in renders:
            print('없는 키트', kid); continue
        im = renders[kid]
        im.save(os.path.join(args.out, kid + '.png'))
        ref_kind = KIND_REF.get(byid[kid]['kind'], 'prop')
        refdir = os.path.join(STYLE_REFS, ref_kind)
        refs = [Image.open(os.path.join(refdir, f)).convert('RGBA') for f in sorted(os.listdir(refdir)) if f.endswith('.png')][:2]
        old = baseline(kid, args.base)
        parts = ([old] if old is not None else []) + [im] + refs
        board(parts, args.scale).save(os.path.join(args.out, 'board-' + kid + '.png'))
        print(kid, 'now', metrics(im), '| before', metrics(old) if old is not None else '-', '| ref', ref_kind, [metrics(r) for r in refs])


if __name__ == '__main__':
    main()
